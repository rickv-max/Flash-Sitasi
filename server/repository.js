import { createHash } from 'node:crypto';
import { WELCOME_CREDITS } from '../shared/catalog.js';
import { AppError } from './errors.js';
import { DEFAULT_SETTINGS, validateSettings } from '../shared/settings.js';
import { assertActive } from './access.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
export const paymentDocId = (invoice) => hash(invoice);

export function createRepository(db) {
  const profileRef = (uid) => db.doc(`users/${uid}`);
  const paymentRef = (invoice) => db.doc(`payments/${paymentDocId(invoice)}`);
  return {
    async getSettings() {
      const snap = await db.doc('settings/app').get();
      try { return validateSettings(snap.exists ? snap.data() : DEFAULT_SETTINGS); }
      catch { throw new AppError(503, 'APP_SETTINGS_INVALID', 'Pengaturan aplikasi perlu diperiksa pengelola.'); }
    },
    async ensureProfile(user, { owner = false, welcomeCredits = WELCOME_CREDITS, signupEnabled = true, markLogin = false } = {}) {
      return db.runTransaction(async (tx) => {
        const ref = profileRef(user.uid);
        const snap = await tx.get(ref);
        if (snap.exists) {
          const data = snap.data();
          const patch = {};
          if (data.credits === undefined) patch.credits = welcomeCredits;
          if (!data.role || owner && data.role !== 'admin') patch.role = owner ? 'admin' : 'user';
          if (!data.status) patch.status = 'active';
          if (owner && data.status === 'blocked') patch.status = 'active';
          if (data.emailLower === undefined) patch.emailLower = (data.email || user.email || '').toLowerCase();
          if (data.nameLower === undefined) patch.nameLower = (data.name || user.name || '').toLowerCase();
          if (markLogin || Date.now() - (data.lastSeenAt || 0) > 300000) patch.lastSeenAt = Date.now();
          if (markLogin) patch.lastLoginAt = Date.now();
          if (Object.keys(patch).length) tx.update(ref, patch);
          return { ...data, ...patch };
        }
        if (!signupEnabled && !owner) throw new AppError(403, 'SIGNUP_PAUSED', 'Pendaftaran akun baru sementara dinonaktifkan.');
        const data = { credits: welcomeCredits, email: user.email || '', emailLower: (user.email || '').toLowerCase(),
          name: user.name || '', nameLower: (user.name || '').toLowerCase(), role: owner ? 'admin' : 'user', status: 'active',
          createdAt: Date.now(), lastSeenAt: Date.now(), lastLoginAt: Date.now() };
        tx.set(ref, data);
        return data;
      });
    },
    async getPaymentRequest(uid, key) {
      const snap = await db.doc(`paymentRequests/${hash(`${uid}:${key}`)}`).get();
      return snap.exists ? snap.data() : null;
    },
    async reservePayment(uid, key, credits, amount, selection = {}) {
      const ref = db.doc(`paymentRequests/${hash(`${uid}:${key}`)}`);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) {
          const data = snap.data();
          if (data.credits !== credits || (data.packageId || '') !== (selection.packageId || '')) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Permintaan ini sudah dipakai untuk pilihan kredit lain.');
          if (data.state === 'ready') return { ref, existing: data.payment };
          const error = new AppError(409, 'PAYMENT_PROCESSING',
            data.state === 'unknown' ? 'Tagihan mungkin sudah dibuat. Periksa transaksi di bayar.gg atau hubungi pengelola sebelum membuat tagihan baru.' :
              'Permintaan sebelumnya masih diproses. Tunggu sebentar lalu periksa kembali.');
          error.paymentPending = true;
          throw error;
        }
        // Persist before contacting the provider: never retry an ambiguous POST.
        tx.set(ref, { uid, credits, amount, packageId: selection.packageId || '', packageName: selection.packageName || 'Satuan', state: 'creating', createdAt: Date.now() });
        return { ref };
      });
    },
    async finishPayment(ref, uid, credits, payment) {
      await db.runTransaction(async (tx) => {
        const target = paymentRef(payment.invoice);
        const existing = await tx.get(target);
        if (existing.exists) throw new AppError(409, 'DUPLICATE_INVOICE', 'Nomor tagihan sudah terdaftar. Hubungi pengelola.');
        tx.set(target, { ...payment, uid, credits, credited: false, createdAt: Date.now(), lastChecked: 0 });
        tx.update(ref, { state: 'ready', payment, updatedAt: Date.now() });
      });
    },
    async failPayment(ref, definitive) {
      // A rejected 4xx creates no invoice; an ambiguous response requires reconciliation.
      if (definitive) await ref.delete();
      else await ref.update({ state: 'unknown', updatedAt: Date.now() });
    },
    async getPayment(invoice, uid) {
      const snap = await paymentRef(invoice).get();
      if (!snap.exists || (uid && snap.data().uid !== uid)) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Tagihan tidak ditemukan untuk akun ini.');
      return snap.data();
    },
    async settlePayment(invoice, verified) {
      return db.runTransaction(async (tx) => {
        const ref = paymentRef(invoice);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Tagihan belum tercatat.');
        const payment = snap.data();
        if (payment.credited) return payment;
        if (Number(verified.final_amount) !== payment.finalAmount ||
            (verified.amount != null && Number(verified.amount) !== payment.amount) ||
            (verified.paid_amount != null && Number(verified.paid_amount) < payment.finalAmount)) {
          throw new AppError(409, 'AMOUNT_MISMATCH', 'Nominal pembayaran tidak cocok dengan tagihan.');
        }
        if (verified.status !== 'paid') {
          const update = { status: verified.status, lastChecked: Date.now() };
          tx.update(ref, update);
          return { ...payment, ...update };
        }
        const userRef = profileRef(payment.uid);
        const profile = await tx.get(userRef);
        if (!profile.exists) throw new AppError(409, 'PROFILE_MISSING', 'Profil pemilik tagihan belum tersedia.');
        const oldCredits = profile.data().credits;
        if (!Number.isSafeInteger(oldCredits) || oldCredits < 0 || !Number.isSafeInteger(oldCredits + payment.credits)) throw new AppError(409, 'BALANCE_INVALID', 'Saldo kredit perlu diperiksa pengelola.');
        const paid = { status: 'paid', credited: true, paidAt: Date.now(), lastChecked: Date.now() };
        tx.update(userRef, { credits: oldCredits + payment.credits });
        tx.update(ref, paid);
        tx.set(db.doc(`users/${payment.uid}/creditLedger/${paymentDocId(invoice)}`), {
          invoice, amount: payment.amount, credits: payment.credits, timestamp: Date.now(), type: 'topup',
        });
        return { ...payment, ...paid };
      });
    },
    async getCitation(uid, key) {
      const snap = await db.doc(`users/${uid}/history/${key}`).get();
      return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },
    async saveCitation(uid, key, citation) {
      return db.runTransaction(async (tx) => {
        const ref = db.doc(`users/${uid}/history/${key}`);
        const [existing, profile] = await Promise.all([tx.get(ref), tx.get(profileRef(uid))]);
        if (existing.exists) {
          if (existing.data().requestHash !== citation.requestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Permintaan ini sudah dipakai untuk referensi lain.');
          return { id: existing.id, ...existing.data() };
        }
        const balance = profile.data()?.credits;
        assertActive(profile.data());
        if (!Number.isSafeInteger(balance) || balance < 1) throw new AppError(402, 'INSUFFICIENT_CREDITS', 'Kredit habis. Isi ulang untuk melanjutkan.');
        const saved = { ...citation, timestamp: Date.now() };
        tx.set(ref, saved);
        tx.update(profileRef(uid), { credits: balance - 1 });
        tx.set(db.doc(`users/${uid}/creditLedger/citation_${key}`), { type: 'citation', credits: -1, balanceAfter: balance - 1,
          citationID: key, description: 'Pembuatan sitasi', timestamp: saved.timestamp });
        return { id: key, ...saved };
      });
    },
    async getCityCache(key) {
      const snap = await db.doc(`cityCache/${key}`).get();
      return snap.exists && snap.data().expiresAt > Date.now() ? snap.data().result : null;
    },
    async setCityCache(key, result) {
      const expiresAt = Date.now() + (result.city ? 30 : 1) * 86400000;
      await db.doc(`cityCache/${key}`).set({ result, updatedAt: Date.now(), expiresAt, expireAt: new Date(expiresAt) });
    },
    async getCityOverride(keys) {
      for (const key of keys) {
        const snap = await db.doc(`publisherLocations/${key}`).get();
        if (snap.exists && snap.data().enabled !== false) return { id: snap.id, ...snap.data() };
      }
      return null;
    },
    async rateLimit(uid, type, limit = 10) {
      const bucket = Math.floor(Date.now() / 60000);
      await db.runTransaction(async (tx) => {
        const ref = db.doc(`rateLimits/${hash(`${uid}:${type}:${bucket}`)}`);
        const snap = await tx.get(ref); const count = snap.exists ? snap.data().count : 0;
        if (count >= limit) throw new AppError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan. Tunggu satu menit lalu coba kembali.');
        tx.set(ref, { uid, type, count: count + 1, expiresAt: (bucket + 2) * 60000, expireAt: new Date((bucket + 2) * 60000) });
      });
    },
  };
}
