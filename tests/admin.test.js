import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRepository, paymentDocId } from '../server/repository.js';
import { createAdminRepository, listParams } from '../server/admin-repository.js';
import { makeAdminHandler } from '../server/admin-handlers.js';
import { makeHandler } from '../server/handlers.js';
import { assertAdmin, assertSession, protectAdminTarget, validUID } from '../server/access.js';
import { DEFAULT_SETTINGS, validateSettings } from '../shared/settings.js';
import { DEMO_METADATA } from '../shared/citations.js';
import { MemoryFirestore, user, env, call } from './helpers.js';

const owner = { uid: 'primary-owner', email: 'owner@example.test', name: 'Pemilik' };
const adminUser = { uid: 'admin-one', email: 'admin@example.test', name: 'Admin' };
const config = { ...env, ADMIN_OWNER_UIDS: owner.uid };
async function setup() {
  const db = new MemoryFirestore(), repo = createRepository(db), admin = createAdminRepository(db, config);
  await repo.ensureProfile(user); await repo.ensureProfile(owner, { owner: true }); await repo.ensureProfile(adminUser, { owner: true });
  const auth = { getUser: async () => ({ disabled: false, emailVerified: true, providerData: [{ providerId: 'google.com' }], metadata: {} }), updateUser: async () => {}, revokeRefreshTokens: async () => {} };
  const overrides = { env: config, repo, admin, services: { db, auth }, authenticate: async () => adminUser };
  return { db, repo, admin, auth, overrides, handler: makeAdminHandler(overrides) };
}
const creditBody = { action: 'adjustCredits', uid: user.uid, mode: 'add', amount: 10, reason: 'Kompensasi dukungan pelanggan' };
test('owner bootstrap uses server UID configuration and existing user balances remain intact', async () => {
  const { repo, db } = await setup();
  await db.doc(`users/${user.uid}`).update({ credits: 77 });
  assert.equal((await repo.ensureProfile(user)).role, 'user');
  assert.equal((await repo.ensureProfile(user, { owner: true })).credits, 77);
  assert.equal(db.records.get(`users/${owner.uid}`).role, 'admin');
  for (const uid of ['', '.', '..', 'a/b', 'a\\b', 'space name', 'x\u0000x']) assert.equal(validUID(uid), false);
});
test('admin API rejects unauthenticated, ordinary and blocked accounts despite browser role claims', async () => {
  const { overrides } = await setup();
  const ordinary = makeAdminHandler({ ...overrides, authenticate: async () => ({ ...user, role: 'admin', admin: true }) });
  assert.equal((await call(ordinary, { method: 'GET' })).statusCode, 403);
  const { db } = overrides.services; await db.doc(`users/${adminUser.uid}`).update({ status: 'blocked' });
  assert.equal((await call(makeAdminHandler(overrides), { method: 'GET' })).statusCode, 403);
  assert.equal((await call(ordinary, { customHeaders: { authorization: undefined } })).statusCode, 401);
  assert.equal((await call(ordinary, { method: 'DELETE' })).statusCode, 405);
});
test('admin role is rechecked inside every mutation transaction', async () => {
  const { admin, db } = await setup();
  await db.doc(`users/${adminUser.uid}`).update({ role: 'user' });
  await assert.rejects(admin.adjustCredits(adminUser, 'admin-credit-key-00001', creditBody), { code: 'ADMIN_REQUIRED' });
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  assert.throws(() => assertAdmin({ role: 'admin', status: 'blocked' }), { code: 'ACCOUNT_BLOCKED' });
});
test('credit changes, ledger and audit are atomic and idempotent under concurrent retries', async () => {
  const { admin, db } = await setup();
  const results = await Promise.all([admin.adjustCredits(adminUser, 'admin-credit-key-00001', creditBody), admin.adjustCredits(adminUser, 'admin-credit-key-00001', creditBody)]);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 15);
  assert.equal(results.filter((item) => item.replayed).length, 1);
  assert.equal([...db.records.keys()].filter((key) => key.includes('/creditLedger/')).length, 1);
  const audit = [...db.records.entries()].find(([key]) => key.startsWith('adminAudit/'))[1];
  assert.equal(audit.before.credits, 5); assert.equal(audit.after.credits, 15); assert.equal(audit.actorUID, adminUser.uid); assert.equal(audit.reason, creditBody.reason);
  await assert.rejects(admin.adjustCredits(adminUser, 'admin-credit-key-00001', { ...creditBody, amount: 20 }), { code: 'IDEMPOTENCY_CONFLICT' });
});
test('invalid reasons, negative balances and stale set-balance changes roll back completely', async () => {
  const { admin, db } = await setup();
  for (const input of [{ reason: 'x' }, { mode: 'subtract', amount: 6 }, { mode: 'set', amount: 9, expectedBalance: 4 }, { amount: 1.5 }, { uid: '../admin' }]) await assert.rejects(admin.adjustCredits(adminUser, 'admin-credit-key-00001', { ...creditBody, ...input }));
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  assert.equal([...db.records.keys()].filter((key) => key.startsWith('adminAudit/')).length, 0);
  await admin.adjustCredits(adminUser, 'admin-credit-key-00002', { ...creditBody, mode: 'set', amount: 0, expectedBalance: 5 });
  assert.equal(db.records.get(`users/${user.uid}`).credits, 0);
});
test('concurrent credit subtraction cannot overdraw a user balance', async () => {
  const { admin, db } = await setup();
  const outcomes = await Promise.allSettled([admin.adjustCredits(adminUser, 'admin-credit-key-00001', { ...creditBody, mode: 'subtract', amount: 4 }), admin.adjustCredits(adminUser, 'admin-credit-key-00002', { ...creditBody, mode: 'subtract', amount: 4 })]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1); assert.equal(db.records.get(`users/${user.uid}`).credits, 1);
});
test('self and primary owner cannot be blocked, demoted or have sessions revoked', async () => {
  const { admin } = await setup();
  for (const uid of [adminUser.uid, owner.uid]) for (const action of ['setRole', 'setStatus', 'revokeSessions']) await assert.rejects(admin.changeUser(adminUser, 'admin-change-key-00001', action, { uid, role: 'user', status: 'blocked', reason: 'Percobaan perlindungan akun' }), { status: 403 });
  assert.throws(() => protectAdminTarget(adminUser, owner.uid, config), { code: 'OWNER_PROTECTED' });
});
test('granting and revoking another admin is authoritative immediately', async () => {
  const { admin, repo } = await setup();
  await admin.changeUser(adminUser, 'admin-change-key-00001', 'setRole', { uid: user.uid, role: 'admin', reason: 'Tambahkan pengelola aplikasi' });
  assert.equal((await repo.ensureProfile(user)).role, 'admin');
  await admin.changeUser(owner, 'admin-change-key-00002', 'setRole', { uid: user.uid, role: 'user', reason: 'Akhiri akses pengelola aplikasi' });
  await assert.rejects(admin.adjustCredits(user, 'admin-credit-key-00003', creditBody), { code: 'ADMIN_REQUIRED' });
});
test('account block persists even when Firebase Auth synchronization fails', async () => {
  const { overrides, auth, db } = await setup();
  auth.updateUser = async () => { throw new Error('Provider unavailable'); };
  const handler = makeAdminHandler(overrides);
  const result = await call(handler, { body: { action: 'setStatus', uid: user.uid, status: 'blocked', reason: 'Akun dilaporkan untuk diperiksa' } });
  assert.equal(result.statusCode, 200); assert.ok(result.body.data.authSyncWarning); assert.equal(db.records.get(`users/${user.uid}`).status, 'blocked');
  const citation = makeHandler('citations', { ...overrides, authenticate: async () => user, resolveMetadata: async () => DEMO_METADATA });
  assert.equal((await call(citation, { body: { mode: 'doi', input: '10.1038/nature14539' } })).statusCode, 403);
  let disabled, revoked = 0; auth.updateUser = async (_, data) => { disabled = data.disabled; }; auth.revokeRefreshTokens = async () => { revoked++; };
  const retry = await call(handler, { body: { action: 'setStatus', uid: user.uid, status: 'blocked', reason: 'Akun dilaporkan untuk diperiksa' } });
  assert.equal(retry.body.data.authSyncWarning, ''); assert.equal(disabled, true); assert.equal(revoked, 1); assert.equal(db.records.get(`users/${user.uid}`).authSyncError, '');
});
test('internal notes live outside public user profiles and are audited', async () => {
  const { admin, db } = await setup();
  await admin.changeUser(adminUser, 'admin-change-key-00001', 'saveNotes', { uid: user.uid, text: 'Catatan dukungan internal', reason: 'Catat hasil pemeriksaan akun' });
  assert.equal(db.records.get(`adminUserNotes/${user.uid}`).text, 'Catatan dukungan internal');
  assert.equal(db.records.get(`users/${user.uid}`).notes, undefined);
});
test('user search, role/status filters and cursors return a bounded stable page', async () => {
  const { repo, admin } = await setup();
  for (const [uid, name] of [['person-a', 'Ayu'], ['person-b', 'Ayu B'], ['person-c', 'Budi']]) await repo.ensureProfile({ uid, name, email: `${uid}@example.test` });
  const first = await admin.listUsers({ limit: 1, q: 'ayu', searchBy: 'name', role: 'user', status: 'active' });
  assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
  const second = await admin.listUsers({ limit: 1, q: 'ayu', searchBy: 'name', cursor: first.nextCursor });
  assert.equal(second.items.length, 1); assert.notEqual(first.items[0].uid, second.items[0].uid);
  const exact = await admin.listUsers({ q: user.uid, searchBy: 'uid' }); assert.equal(exact.items[0].uid, user.uid);
  assert.equal((await admin.listUsers({ q: 'writer@', searchBy: 'email' })).items.length, 1);
});
test('record pages filter payments, reconciliation requests and audit entries by time and user', async () => {
  const { admin, db } = await setup(); const time = Date.parse('2026-10-18T12:00:00+07:00');
  await db.doc('payments/pay-a').set({ uid: user.uid, status: 'pending', createdAt: time });
  await db.doc('payments/pay-b').set({ uid: owner.uid, status: 'paid', createdAt: time });
  const page = await admin.listRecords('payments', { uid: user.uid, status: 'pending', start: '2026-10-18', end: '2026-10-18' });
  assert.equal(page.items.length, 1); assert.equal(page.items[0].id, 'pay-a');
  for (const input of [{ limit: 1000 }, { cursor: '../x' }, { start: '2026-02-31' }, { start: '2026-10-19', end: '2026-10-18' }]) assert.throws(() => listParams(input));
});
test('user detail contains only that user history/ledger/payments, with private notes and Auth info', async () => {
  const { db, handler } = await setup();
  await db.doc(`users/${user.uid}/history/citation-a`).set({ title: 'Riset', timestamp: 1 });
  await db.doc(`users/${owner.uid}/history/citation-b`).set({ title: 'Other', timestamp: 2 });
  const response = await call(handler, { method: 'GET', query: { resource: 'user', uid: user.uid } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.data.history.length, 1); assert.equal(response.body.data.auth.providers[0], 'google.com');
});
test('settings validation rejects invalid prices and concurrent overwrites', async () => {
  const { admin, repo } = await setup();
  assert.throws(() => validateSettings({ pricePerCredit: 1 })); assert.throws(() => validateSettings({ minTopup: 1 })); assert.throws(() => validateSettings({ maxBatch: 51 }));
  assert.throws(() => validateSettings({ maintenance: 'false' }));
  await admin.updateSettings(adminUser, 'admin-settings-key-00001', { settings: { pricePerCredit: 1000, welcomeCredits: 8 }, expectedUpdatedAt: 0, reason: 'Perbarui harga dan kredit awal' });
  assert.equal((await repo.getSettings()).pricePerCredit, 1000);
  await assert.rejects(admin.updateSettings(adminUser, 'admin-settings-key-00002', { settings: { welcomeCredits: 9 }, expectedUpdatedAt: 0, reason: 'Pengaturan sudah berubah lagi' }), { code: 'SETTINGS_CHANGED' });
});
test('public config exposes only whitelisted settings and server uses dynamic price/welcome credits', async () => {
  const { repo, db, overrides } = await setup();
  await db.doc('settings/app').set({ ...DEFAULT_SETTINGS, pricePerCredit: 1000, welcomeCredits: 8, secret: 'must-not-be-exposed' });
  const configResponse = await call(makeHandler('config', overrides), { method: 'GET', customHeaders: { authorization: undefined } });
  assert.equal(configResponse.statusCode, 200); assert.equal(configResponse.body.data.secret, undefined);
  let amount;
  const create = makeHandler('createPayment', { ...overrides, authenticate: async () => user, gateway: { create: async (input) => { amount = input.amount; return { invoice: 'dynamic-price-001', amount, finalAmount: amount, status: 'pending', paymentURL: 'https://www.bayar.gg/pay' }; } } });
  assert.equal((await call(create, { body: { credits: 10, amount: 1 } })).statusCode, 201); assert.equal(amount, 10000);
  const newcomer = { uid: 'new-signup', email: 'new@example.test' };
  const profile = await call(makeHandler('profile', { ...overrides, authenticate: async () => newcomer })); assert.equal(profile.body.data.credits, 8);
  assert.equal((await repo.ensureProfile(user)).credits, 5);
});
test('maintenance and feature switches block new operations but paid callbacks still credit', async () => {
  const { db, repo, overrides } = await setup();
  await db.doc('settings/app').set({ ...DEFAULT_SETTINGS, maintenance: true });
  const citations = makeHandler('citations', { ...overrides, authenticate: async () => user, resolveMetadata: async () => DEMO_METADATA });
  assert.equal((await call(citations, { body: { mode: 'doi', input: '10.1038/nature14539' } })).body.error.code, 'MAINTENANCE');
  const reservation = await repo.reservePayment(user.uid, 'payment-key-original-001', 10, 7500);
  await repo.finishPayment(reservation.ref, user.uid, 10, { invoice: 'old-payment-001', amount: 7500, finalAmount: 7500, status: 'pending', paymentURL: 'https://www.bayar.gg/pay' });
  const webhook = makeHandler('webhook', { ...overrides, gateway: { check: async () => ({ invoice_id: 'old-payment-001', status: 'paid', amount: 7500, final_amount: 7500 }) } });
  assert.equal((await call(webhook, { body: { invoice_id: 'old-payment-001' } })).statusCode, 200); assert.equal(db.records.get(`users/${user.uid}`).credits, 15);
});
test('saved invoice can be resumed after pricing/minimum or maintenance settings change', async () => {
  const { db, repo, overrides } = await setup(); const key = 'payment-key-original-001';
  const reservation = await repo.reservePayment(user.uid, key, 10, 7500);
  await repo.finishPayment(reservation.ref, user.uid, 10, { invoice: 'old-payment-001', amount: 7500, finalAmount: 7500, status: 'pending', paymentURL: 'https://www.bayar.gg/pay' });
  await db.doc('settings/app').set({ ...DEFAULT_SETTINGS, minTopup: 20, maintenance: true });
  const handler = makeHandler('createPayment', { ...overrides, authenticate: async () => user });
  const result = await call(handler, { body: { credits: 10 }, customHeaders: { 'idempotency-key': key } });
  assert.equal(result.statusCode, 200); assert.equal(result.body.data.amount, 7500);
});
test('disabled signup and city lookup are enforced by the server', async () => {
  const { db, overrides } = await setup();
  await db.doc('settings/app').set({ ...DEFAULT_SETTINGS, signupEnabled: false, autoCityEnabled: false });
  const signup = await call(makeHandler('profile', { ...overrides, authenticate: async () => ({ uid: 'not-registered' }) })); assert.equal(signup.statusCode, 403);
  const city = await call(makeHandler('city', { ...overrides, authenticate: async () => user, resolveMetadata() { throw new Error('Must not fetch'); } }), { body: { mode: 'doi', input: '10.1234/test' } });
  assert.equal(city.body.data.cityStatus, 'disabled');
});
test('overview aggregates actual data across users and paid amounts without counting pending revenue', async () => {
  const { db, admin } = await setup();
  await db.doc('payments/paid-a').set({ status: 'paid', credited: true, amount: 7500, credits: 10, paidAt: Date.now() });
  await db.doc('payments/pending-b').set({ status: 'pending', credited: false, amount: 50000, credits: 50 });
  await db.doc(`users/${user.uid}/history/example`).set({ timestamp: Date.now() });
  const overview = await admin.overview(); assert.equal(overview.users, 3); assert.equal(overview.admins, 2); assert.equal(overview.citations, 1); assert.equal(overview.grossRevenue, 7500); assert.equal(overview.pendingPayments, 1); assert.equal(overview.daily.length, 7);
});
test('admin city directory requires evidence URL, exact match keys and an audit reason', async () => {
  const { admin, db } = await setup();
  const input = { kind: 'issn', matchValue: '1234-567X', city: 'Bandung', sourceURL: 'https://jurnal.example/about/contact', enabled: true, reason: 'Bersumber dari halaman kontak jurnal' };
  const result = await admin.upsertLocation(adminUser, 'admin-location-key-001', input);
  assert.equal(db.records.get(`publisherLocations/${result.id}`).city, 'Bandung');
  await assert.rejects(admin.upsertLocation(adminUser, 'admin-location-key-002', { ...input, sourceURL: 'https://127.0.0.1/contact' }), { code: 'PRIVATE_URL' });
  await assert.rejects(admin.upsertLocation(adminUser, 'admin-location-key-003', { ...input, matchValue: 'invalid' }), { code: 'INVALID_ISSN' });
});
test('payment reconciliation verifies merchant amount before linking and credits paid invoices once', async () => {
  const { db, admin, repo } = await setup(); const requestID = createHash('sha256').update('unknown-request').digest('hex');
  await db.doc(`paymentRequests/${requestID}`).set({ uid: user.uid, credits: 10, amount: 7500, state: 'unknown', createdAt: Date.now() - 180000 });
  const input = { requestID, invoice: 'merchant-invoice-001', reason: 'Cocokkan invoice merchant dan bukti pengguna' };
  const verified = { invoice_id: input.invoice, amount: 7500, final_amount: 7520, status: 'paid' };
  await assert.rejects(admin.recoverPayment(adminUser, 'admin-recover-key-001', input, { ...verified, amount: 9999 }, 'https://www.bayar.gg/pay'), { code: 'AMOUNT_MISMATCH' });
  await admin.recoverPayment(adminUser, 'admin-recover-key-001', input, verified, 'https://www.bayar.gg/pay');
  await Promise.all([repo.settlePayment(input.invoice, verified), repo.settlePayment(input.invoice, verified)]);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 15); assert.equal(db.records.get(`payments/${paymentDocId(input.invoice)}`).credited, true);
  assert.equal((await admin.recoverPayment(adminUser, 'admin-recover-key-001', input, verified, 'https://www.bayar.gg/pay')).replayed, true);
  await assert.rejects(admin.recoverPayment(adminUser, 'admin-recover-key-002', input, verified, 'https://www.bayar.gg/pay'), { code: 'INVOICE_EXISTS' });
});
test('admin cannot mark an invoice paid when gateway still reports pending', async () => {
  const { overrides, repo, db } = await setup(); const invoice = 'pending-invoice-001';
  const reservation = await repo.reservePayment(user.uid, 'payment-key-original-001', 10, 7500);
  await repo.finishPayment(reservation.ref, user.uid, 10, { invoice, amount: 7500, finalAmount: 7500, status: 'pending' });
  const handler = makeAdminHandler({ ...overrides, gateway: { check: async () => ({ invoice_id: invoice, amount: 7500, final_amount: 7500, status: 'pending' }) } });
  const result = await call(handler, { body: { action: 'syncPayment', invoice, status: 'paid', reason: 'Periksa status pembayaran pelanggan' } });
  assert.equal(result.statusCode, 200); assert.equal(result.body.data.credited, false); assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  assert.equal((await call(handler, { body: { action: 'markPaid', invoice, reason: 'Percobaan perubahan status' } })).statusCode, 400);
});
test('admin origin and missing idempotency key are rejected before mutation', async () => {
  const { handler, db } = await setup();
  assert.equal((await call(handler, { body: creditBody, customHeaders: { origin: 'https://evil.example' } })).statusCode, 403);
  assert.equal((await call(handler, { body: creditBody, customHeaders: { 'idempotency-key': undefined } })).statusCode, 400);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});

test('session revocation rejects tokens authenticated before the administrator action', async () => {
  const { db, repo, overrides } = await setup();
  await db.doc(`users/${user.uid}`).update({ sessionRevokedAt: 200000 });
  assert.throws(() => assertSession({ auth_time: 199 }, { sessionRevokedAt: 200000 }), { code: 'SESSION_REVOKED' });
  const handler = makeHandler('profile', { ...overrides, authenticate: async () => ({ ...user, auth_time: 199 }) });
  assert.equal((await call(handler)).statusCode, 401);
  const fresh = makeHandler('profile', { ...overrides, authenticate: async () => ({ ...user, auth_time: 201 }) });
  assert.equal((await call(fresh)).statusCode, 200); assert.equal((await repo.ensureProfile(user)).credits, 5);
});
