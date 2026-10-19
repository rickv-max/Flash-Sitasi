import { createHash } from 'node:crypto';
import { AggregateField } from 'firebase-admin/firestore';
import { AppError } from './errors.js';
import { assertAdmin, assertSession, protectAdminTarget, validUID } from './access.js';
import { DEFAULT_SETTINGS, validateSettings } from '../shared/settings.js';
import { locationKey, cleanCity } from './city.js';
import { publicURL } from './safe-fetch.js';
import { paymentDocId } from './repository.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const clean = (value = '', max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fields = ['name', 'email', 'role', 'status', 'credits', 'createdAt', 'lastSeenAt', 'lastLoginAt', 'authSyncError'];
const userRow = (doc) => ({ uid: doc.id, ...Object.fromEntries(fields.filter((field) => doc.data()[field] !== undefined).map((field) => [field, doc.data()[field]])) });
function reasonOf(reason) {
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500) throw new AppError(400, 'REASON_REQUIRED', 'Isi alasan tindakan sepanjang 5–500 karakter.');
  return reason.trim();
}
function parseDate(value) {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new AppError(400, 'INVALID_DATE', 'Tanggal filter belum valid.');
  return Date.parse(`${value}T00:00:00+07:00`);
}
export function listParams(input = {}) {
  const limit = Number(input.limit || 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(400, 'INVALID_LIMIT', 'Jumlah data per halaman harus 1–100.');
  const q = clean(input.q, 128).toLowerCase();
  const cursor = clean(input.cursor, 150);
  if (cursor && (!validUID(cursor) || cursor.length > 128)) throw new AppError(400, 'INVALID_CURSOR', 'Penanda halaman tidak valid.');
  const start = parseDate(input.start), end = parseDate(input.end);
  if (start && end && start > end) throw new AppError(400, 'INVALID_DATE', 'Tanggal awal melewati tanggal akhir.');
  return { limit, q, cursor, start, end: end ? end + 86400000 : null };
}

export function createAdminRepository(db, env = process.env) {
  const userRef = (uid) => db.doc(`users/${uid}`);
  async function page(query, params, map = (doc) => ({ id: doc.id, ...doc.data() })) {
    const snap = await query.limit(params.limit + 1).get();
    const docs = snap.docs.slice(0, params.limit);
    return { items: docs.map(map), nextCursor: snap.docs.length > params.limit ? docs.at(-1)?.id : null };
  }
  // Keep cursor collection out of Firestore's immutable Query internals.
  async function paginate(collection, query, params, map) {
    if (params.cursor) {
      const previous = await collection.doc(params.cursor).get();
      if (!previous.exists) throw new AppError(409, 'CURSOR_EXPIRED', 'Data halaman berubah. Mulai lagi dari halaman pertama.');
      query = query.startAfter(previous);
    }
    return page(query, { ...params, cursor: '' }, map);
  }

  async function audited(actor, key, action, target, reason, input, execute) {
    const operationId = hash(`${actor.uid}:${key}`);
    const requestHash = hash(JSON.stringify({ action, target, reason, input }));
    const operationRef = db.doc(`adminAudit/${operationId}`);
    return db.runTransaction(async (tx) => {
      const [operator, previous] = await Promise.all([tx.get(userRef(actor.uid)), tx.get(operationRef)]);
      assertAdmin(operator.data());
      assertSession(actor, operator.data());
      if (previous.exists) {
        if (previous.data().requestHash !== requestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Permintaan admin ini sudah dipakai untuk tindakan lain.');
        return { ...previous.data().result, operationId, replayed: true };
      }
      const change = await execute(tx, operationId);
      change.write?.();
      const result = change.result || change.after || {};
      tx.set(operationRef, { actorUID: actor.uid, actorEmail: actor.email || '', action, target,
        reason: reasonOf(reason), before: change.before || null, after: change.after || null,
        result, requestHash, timestamp: Date.now() });
      return { ...result, operationId, replayed: false };
    });
  }

  return {
    async profile(uid) {
      const snap = await userRef(uid).get();
      return snap.exists ? snap.data() : null;
    },
    async overview() {
      const users = db.collection('users'), payments = db.collection('payments'), citations = db.collectionGroup('history');
      const count = async (query) => (await query.count().get()).data().count;
      const jakartaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const midnight = Date.parse(`${jakartaDate}T00:00:00+07:00`);
      const [userCount, blocked, adminCount, citationCount, pendingPayments, paid, balance, daily] = await Promise.all([
        count(users), count(users.where('status', '==', 'blocked')), count(users.where('role', '==', 'admin')), count(citations),
        count(payments.where('status', '==', 'pending')),
        payments.where('credited', '==', true).aggregate({ count: AggregateField.count(), gross: AggregateField.sum('amount'), credits: AggregateField.sum('credits') }).get().then((snap) => snap.data()),
        users.aggregate({ total: AggregateField.sum('credits') }).get().then((snap) => snap.data().total),
        Promise.all(Array.from({ length: 7 }, async (_, index) => {
          const start = midnight - (6 - index) * 86400000;
          const [citationsMade, paidOrders] = await Promise.all([
            count(citations.where('timestamp', '>=', start).where('timestamp', '<', start + 86400000)),
            count(payments.where('paidAt', '>=', start).where('paidAt', '<', start + 86400000)),
          ]);
          return { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(start), citations: citationsMade, payments: paidOrders };
        })),
      ]);
      return { users: userCount, blocked, admins: adminCount, citations: citationCount, pendingPayments,
        paidPayments: paid.count, grossRevenue: paid.gross || 0, purchasedCredits: paid.credits || 0,
        outstandingCredits: balance || 0, daily, generatedAt: Date.now(), timeZone: 'Asia/Jakarta' };
    },
    async listUsers(input) {
      const params = listParams(input); const collection = db.collection('users');
      if (params.q && input.searchBy === 'uid') {
        if (!validUID(input.q)) throw new AppError(400, 'INVALID_UID', 'UID tidak valid.');
        const snap = await userRef(input.q).get();
        return { items: snap.exists ? [userRow(snap)] : [], nextCursor: null };
      }
      let query = collection;
      for (const [field, allowed] of [['role', ['user', 'admin']], ['status', ['active', 'blocked']]]) {
        if (input[field] && input[field] !== 'all') {
          if (!allowed.includes(input[field])) throw new AppError(400, 'INVALID_FILTER', 'Filter pengguna tidak valid.');
          query = query.where(field, '==', input[field]);
        }
      }
      if (params.q) {
        const field = input.searchBy === 'name' ? 'nameLower' : 'emailLower';
        query = query.where(field, '>=', params.q).where(field, '<=', `${params.q}\uf8ff`).orderBy(field, 'asc');
      }
      query = query.orderBy('createdAt', 'desc');
      return paginate(collection, query, params, userRow);
    },
    async userDetail(uid) {
      if (!validUID(uid)) throw new AppError(400, 'INVALID_UID', 'UID pengguna tidak valid.');
      const [profile, notes, history, ledger, payments] = await Promise.all([
        userRef(uid).get(), db.doc(`adminUserNotes/${uid}`).get(),
        db.collection(`users/${uid}/history`).orderBy('timestamp', 'desc').limit(25).get(),
        db.collection(`users/${uid}/creditLedger`).orderBy('timestamp', 'desc').limit(25).get(),
        db.collection('payments').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(25).get(),
      ]);
      if (!profile.exists) throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
      return { profile: userRow(profile), notes: notes.exists ? notes.data().text : '',
        history: history.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        ledger: ledger.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        payments: payments.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
    },
    async listRecords(kind, input) {
      const params = listParams(input);
      const spec = { payments: ['payments', 'createdAt'], requests: ['paymentRequests', 'createdAt'], audit: ['adminAudit', 'timestamp'], locations: ['publisherLocations', 'updatedAt'] }[kind];
      if (!spec) throw new AppError(400, 'INVALID_LIST', 'Jenis data admin tidak valid.');
      const [name, timeField] = spec; const collection = db.collection(name); let query = collection;
      if (kind === 'payments' && params.q) {
        const snap = await db.doc(`payments/${paymentDocId(input.q.trim())}`).get();
        return { items: snap.exists ? [{ id: snap.id, ...snap.data() }] : [], nextCursor: null };
      }
      if (input.uid) { if (!validUID(input.uid)) throw new AppError(400, 'INVALID_UID', 'UID tidak valid.'); query = query.where(kind === 'audit' ? 'target' : 'uid', '==', input.uid); }
      if (kind === 'payments' && input.status && input.status !== 'all') {
        if (!['pending', 'paid', 'expired', 'cancelled'].includes(input.status)) throw new AppError(400, 'INVALID_FILTER', 'Status transaksi tidak valid.');
        query = query.where('status', '==', input.status);
      }
      if (kind === 'requests' && input.status && input.status !== 'all') {
        if (!['creating', 'unknown', 'ready'].includes(input.status)) throw new AppError(400, 'INVALID_FILTER', 'Status permintaan tidak valid.');
        query = query.where('state', '==', input.status);
      }
      if (kind === 'audit' && input.auditAction) query = query.where('action', '==', clean(input.auditAction, 50));
      if (params.start) query = query.where(timeField, '>=', params.start);
      if (params.end) query = query.where(timeField, '<', params.end);
      query = query.orderBy(timeField, 'desc');
      return paginate(collection, query, params);
    },
    async adjustCredits(actor, key, input) {
      const { uid, mode, amount, expectedBalance } = input;
      if (!validUID(uid) || !['add', 'subtract', 'set'].includes(mode) || !Number.isSafeInteger(amount) || amount < (mode === 'set' ? 0 : 1) || amount > 1000000) throw new AppError(400, 'INVALID_CREDIT_CHANGE', 'Jumlah/perubahan kredit belum valid.');
      return audited(actor, key, 'adjustCredits', uid, input.reason, { mode, amount, expectedBalance: expectedBalance ?? null }, async (tx, operationId) => {
        const target = await tx.get(userRef(uid));
        if (!target.exists) throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
        const before = target.data().credits;
        if (!Number.isSafeInteger(before) || before < 0) throw new AppError(409, 'BALANCE_INVALID', 'Saldo pengguna tidak valid.');
        if (mode === 'set' && expectedBalance !== before) throw new AppError(409, 'BALANCE_CHANGED', 'Saldo berubah sejak data ditampilkan. Muat ulang sebelum menetapkan saldo.');
        const after = mode === 'set' ? amount : before + (mode === 'add' ? amount : -amount);
        if (!Number.isSafeInteger(after) || after < 0 || after > 1000000000) throw new AppError(409, 'INVALID_BALANCE', 'Perubahan membuat saldo negatif atau melebihi batas.');
        return { before: { credits: before }, after: { credits: after }, result: { uid, credits: after, delta: after - before }, write() {
          tx.update(userRef(uid), { credits: after, updatedAt: Date.now() });
          tx.set(db.doc(`users/${uid}/creditLedger/admin_${operationId}`), { type: 'admin_adjustment', credits: after - before, balanceAfter: after, timestamp: Date.now(), description: 'Penyesuaian kredit oleh admin' });
        } };
      });
    },
    async changeUser(actor, key, action, input) {
      const { uid } = input;
      if (!validUID(uid)) throw new AppError(400, 'INVALID_UID', 'UID pengguna tidak valid.');
      if (['setRole', 'setStatus', 'revokeSessions'].includes(action)) protectAdminTarget(actor, uid, env);
      if (action === 'setRole' && !['user', 'admin'].includes(input.role)) throw new AppError(400, 'INVALID_ROLE', 'Peran tidak valid.');
      if (action === 'setStatus' && !['active', 'blocked'].includes(input.status)) throw new AppError(400, 'INVALID_STATUS', 'Status tidak valid.');
      if (action === 'saveNotes' && (typeof input.text !== 'string' || input.text.length > 4000)) throw new AppError(400, 'INVALID_NOTES', 'Catatan maksimal 4.000 karakter.');
      return audited(actor, key, action, uid, input.reason, { role: input.role || null, status: input.status || null, text: input.text ?? null }, async (tx) => {
        const target = await tx.get(userRef(uid));
        if (!target.exists) throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
        let before, after;
        if (action === 'saveNotes') {
          const notes = await tx.get(db.doc(`adminUserNotes/${uid}`));
          before = { text: notes.data()?.text || '' }; after = { text: input.text.trim() };
        } else if (action === 'setRole') { before = { role: target.data().role || 'user' }; after = { role: input.role }; }
        else if (action === 'setStatus') { before = { status: target.data().status || 'active' }; after = { status: input.status, authSyncError: '' }; }
        else if (action === 'revokeSessions') { before = { sessionRevokedAt: target.data().sessionRevokedAt || null }; after = { sessionRevokedAt: Date.now() }; }
        else throw new AppError(400, 'INVALID_ACTION', 'Tindakan tidak valid.');
        return { before, after, result: { uid, ...after }, write() {
          if (action === 'saveNotes') tx.set(db.doc(`adminUserNotes/${uid}`), { text: after.text, updatedAt: Date.now(), actorUID: actor.uid });
          else tx.update(userRef(uid), { ...after, updatedAt: Date.now() });
        } };
      });
    },
    async markAuthSync(uid, operationId, error) {
      const message = error ? 'Sinkronisasi Firebase Auth tertunda. Ulangi tindakan untuk mencoba lagi.' : '';
      await db.runTransaction(async (tx) => {
        const ref = userRef(uid); const snap = await tx.get(ref);
        if (snap.exists) tx.update(ref, { authSyncError: message });
        tx.update(db.doc(`adminAudit/${operationId}`), { authSync: error ? 'pending' : 'done' });
      });
      return message;
    },
    async updateSettings(actor, key, input) {
      if (!input.settings || typeof input.settings !== 'object' || Array.isArray(input.settings)) throw new AppError(400, 'INVALID_SETTINGS', 'Pengaturan belum valid.');
      return audited(actor, key, 'updateSettings', 'app', input.reason, input.settings, async (tx) => {
        const ref = db.doc('settings/app'); const snap = await tx.get(ref); const existing = snap.data() || {};
        if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== (existing.updatedAt || 0)) throw new AppError(409, 'SETTINGS_CHANGED', 'Pengaturan sudah diubah admin lain. Muat ulang data.');
        let settings;
        try { settings = validateSettings({ ...DEFAULT_SETTINGS, ...existing, ...input.settings }); }
        catch (error) { throw new AppError(400, 'INVALID_SETTINGS', error.message); }
        const after = { ...settings, updatedAt: Date.now() };
        return { before: validateSettings(existing), after, result: after, write() { tx.set(ref, after); } };
      });
    },
    async settings() {
      const snap = await db.doc('settings/app').get(); return { ...validateSettings(snap.data() || {}), updatedAt: snap.data()?.updatedAt || 0 };
    },
    async upsertLocation(actor, key, input) {
      const { kind, matchValue, sourceURL, enabled = true } = input;
      if (!['issn', 'journal', 'journal-url', 'publisher'].includes(kind) || typeof matchValue !== 'string' || !matchValue.trim() || matchValue.length > 250 || typeof enabled !== 'boolean') throw new AppError(400, 'INVALID_LOCATION', 'Data pemetaan penerbit/jurnal belum valid.');
      const city = cleanCity(input.city);
      if (!city) throw new AppError(400, 'INVALID_CITY', 'Isi nama kota, bukan alamat lengkap.');
      if (kind === 'issn' && !/^\d{4}-\d{3}[\dX]$/i.test(matchValue.trim())) throw new AppError(400, 'INVALID_ISSN', 'ISSN harus berbentuk 1234-567X.');
      const url = publicURL(sourceURL).href;
      if (kind === 'journal-url') publicURL(matchValue);
      const id = locationKey(kind, matchValue);
      return audited(actor, key, 'upsertLocation', id, input.reason, { kind, matchValue, city, sourceURL: url, enabled }, async (tx) => {
        const ref = db.doc(`publisherLocations/${id}`), snap = await tx.get(ref);
        const after = { kind, matchValue: matchValue.trim(), city, sourceURL: url, enabled, reason: reasonOf(input.reason), updatedAt: Date.now(), actorUID: actor.uid };
        return { before: snap.data() || null, after, result: { id, ...after }, write() { tx.set(ref, after); } };
      });
    },
    async auditPayment(actor, key, action, target, reason, details = {}) {
      return audited(actor, key, action, target, reason, details, async () => ({ after: details, result: { ...details } }));
    },
    async recoverPayment(actor, key, input, verified, checkout) {
      const { requestID, invoice } = input;
      if (!/^[a-f0-9]{64}$/.test(requestID) || !/^[A-Za-z0-9_-]{3,160}$/.test(invoice)) throw new AppError(400, 'INVALID_RECOVERY', 'ID permintaan atau invoice tidak valid.');
      return audited(actor, key, 'recoverPayment', requestID, input.reason, { requestID, invoice }, async (tx) => {
        const requestRef = db.doc(`paymentRequests/${requestID}`), payRef = db.doc(`payments/${paymentDocId(invoice)}`);
        const [request, payment] = await Promise.all([tx.get(requestRef), tx.get(payRef)]);
        if (!request.exists) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Permintaan pembayaran tidak ditemukan.');
        const data = request.data();
        if (data.state === 'ready' || payment.exists) throw new AppError(409, 'INVOICE_EXISTS', 'Permintaan atau invoice ini sudah terhubung.');
        if (Date.now() - data.createdAt < 120000) throw new AppError(409, 'REQUEST_BUSY', 'Tunggu minimal dua menit sejak request dibuat sebelum rekonsiliasi.');
        if (verified.invoice_id !== invoice || Number(verified.amount) !== data.amount || !Number.isSafeInteger(Number(verified.final_amount)) || Number(verified.final_amount) < data.amount) throw new AppError(409, 'AMOUNT_MISMATCH', 'Invoice penyedia tidak cocok dengan permintaan tersimpan.');
        const url = new URL(checkout); url.searchParams.set('invoice', invoice);
        const recovered = { invoice, uid: data.uid, credits: data.credits, amount: data.amount, finalAmount: Number(verified.final_amount), paymentURL: url.href,
          status: 'pending', credited: false, expiresAt: verified.expires_at || null, createdAt: data.createdAt, lastChecked: 0, recoveredAt: Date.now() };
        return { before: { state: data.state }, after: { invoice, uid: data.uid, state: 'ready' }, result: { invoice, uid: data.uid }, write() {
          tx.set(payRef, recovered); tx.update(requestRef, { state: 'ready', payment: recovered, updatedAt: Date.now() });
        } };
      });
    },
  };
}
