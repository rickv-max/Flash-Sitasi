import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../server/repository.js';
import { createAdminRepository } from '../server/admin-repository.js';
import { makeAdminHandler } from '../server/admin-handlers.js';
import { makeHandler } from '../server/handlers.js';
import { createGateway } from '../server/gateway.js';
import { publicMemberId } from '../server/membership.js';
import { DEFAULT_SETTINGS, readStoredSettings } from '../shared/settings.js';
import { purchaseQuote } from '../shared/catalog.js';
import { assertAdmin } from '../server/access.js';
import { MemoryFirestore, call, env, user } from './helpers.js';

const operator = { uid: 'membership-admin', name: 'Admin', email: 'admin@example.test' };
async function setup() {
  const db = new MemoryFirestore(), repo = createRepository(db), admin = createAdminRepository(db, env);
  await repo.ensureProfile({ ...user, picture: 'https://lh3.googleusercontent.com/a/example' });
  await repo.ensureProfile(operator, { owner: true });
  let sequence = 0;
  const profile = () => db.records.get('users/' + user.uid);
  const setBadge = (tier, mode = 'manual', extra = {}) => admin.setMembership(operator, 'membership-action-' + (++sequence), { uid: user.uid, tier, mode, expectedVersion: profile().membershipVersion || 0, reason: 'Perbarui badge anggota yang dipilih', ...extra });
  const invoice = async (packageId, custom = {}) => {
    const quote = purchaseQuote(packageId ? { packageId } : { credits: 10 }, DEFAULT_SETTINGS);
    const payment = { invoice: 'membership-invoice-' + (++sequence), ...quote, status: 'pending', finalAmount: quote.amount, ...custom };
    const request = await repo.reservePayment(user.uid, 'membership-payment-' + sequence, payment.credits, payment.amount, payment);
    await repo.finishPayment(request.ref, user.uid, payment.credits, payment);
    return payment;
  };
  const paid = (payment) => repo.settlePayment(payment.invoice, { invoice_id: payment.invoice, status: 'paid', amount: payment.amount, final_amount: payment.finalAmount });
  return { db, repo, admin, profile, setBadge, invoice, paid };
}
const publicProfile = { name: 'Peneliti Pilihan', bio: 'Riset dan penulisan.', visible: true, showPhoto: true };

test('Sultan is 999 credits at Rp500000, including legacy settings; later admin prices remain independent', async () => {
  assert.deepEqual(purchaseQuote({ packageId: 'sultan' }, DEFAULT_SETTINGS), { credits: 999, amount: 500000, packageId: 'sultan', packageName: 'Sultan' });
  assert.equal(readStoredSettings({ sultanPackagePrice: 999000 }).sultanPackagePrice, 500000);
  assert.equal(readStoredSettings({ sultanPackagePrice: 600000, sultanPackageRevision: 2 }).sultanPackagePrice, 600000);
  const { repo, db, admin } = await setup();
  await db.doc('settings/app').set({ ...DEFAULT_SETTINGS, sultanPackagePrice: 999000 });
  assert.equal((await repo.getSettings()).sultanPackagePrice, 500000);
  await admin.updateSettings(operator, 'membership-settings-001', { settings: { sultanPackagePrice: 450000 }, reason: 'Ubah harga paket secara terpisah', expectedUpdatedAt: 0 });
  assert.equal((await repo.getSettings()).sultanPackagePrice, 450000);
  assert.equal(db.records.get('settings/app').sultanPackageRevision, 2);
  assert.equal((await repo.getSettings()).proPackagePrice, 115000);
});

test('the QRIS maximum accepts Sultan at exactly Rp500000 and sends only its fixed quota', async () => {
  const posts = [];
  const gateway = createGateway({ key: 'test-key', checkout: 'https://www.bayar.gg/pay', origin: env.APP_URL }, async (url, options) => {
    if (url.endsWith('get-payment-methods.php')) return Response.json({ success: true, data: { payment_methods: [{ id: 'qris', available: true, min_amount: 5000, max_amount: 500000 }] } });
    posts.push(JSON.parse(options.body)); return Response.json({ success: true, data: { invoice_id: 'sultan-qris-boundary', amount: 500000, final_amount: 500000, payment_url: 'https://www.bayar.gg/pay?invoice=sultan-qris-boundary' } });
  });
  const { repo, db } = await setup();
  const handler = makeHandler('createPayment', { env, repo, gateway, authenticate: async () => user });
  const result = await call(handler, { body: { packageId: 'sultan', expectedAmount: 500000, expectedCredits: 999, catalogRevision: 2 } });
  assert.equal(result.statusCode, 201); assert.equal(result.body.data.credits, 999); assert.equal(result.body.data.amount, 500000);
  assert.equal(posts.length, 1); assert.equal(posts[0].payment_method, 'qris'); assert.equal(posts[0].amount, 500000);
  assert.equal(db.records.get('users/' + user.uid).credits, 5);
});

test('legacy Sultan invoice retry retains the original 1999 credits and Rp999000 snapshot', async () => {
  const db = new MemoryFirestore(), original = createRepository(db); await original.ensureProfile(user);
  const ref = await original.reservePayment(user.uid, 'legacy-sultan-request-001', 1999, 999000, { packageId: 'sultan', packageName: 'Sultan' });
  await original.finishPayment(ref.ref, user.uid, 1999, { invoice: 'legacy-sultan-before-change', packageId: 'sultan', packageName: 'Sultan', amount: 999000, finalAmount: 999000, status: 'pending' });
  const response = await call(makeHandler('createPayment', { env, repo: original, authenticate: async () => user }), { body: { packageId: 'sultan', expectedAmount: 999000 }, customHeaders: { 'idempotency-key': 'legacy-sultan-request-001' } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.data.amount, 999000); assert.equal(response.body.data.credits, 1999);
});

test('pending and underpaid invoices do not upgrade membership; paid callbacks grant once', async () => {
  const { invoice, paid, profile, repo } = await setup(); const payment = await invoice('sultan');
  assert.equal(profile().membershipTier, 'regular');
  await assert.rejects(repo.settlePayment(payment.invoice, { status: 'paid', amount: 500000, final_amount: 499999 }), { code: 'AMOUNT_MISMATCH' });
  assert.equal(profile().membershipTier, 'regular');
  await Promise.all([paid(payment), paid(payment)]);
  assert.equal(profile().credits, 1004); assert.equal(profile().membershipTier, 'sultan'); assert.equal(profile().purchasedTier, 'sultan'); assert.equal(profile().membershipVersion, 1);
  await paid(await invoice('pro'));
  assert.equal(profile().membershipTier, 'sultan');
});

test('admin changes a badge without changing credits or granting administrative access, with one audit on retry', async () => {
  const { profile, setBadge, db, admin } = await setup();
  const result = await setBadge('sultan');
  assert.equal(profile().membershipTier, 'sultan'); assert.equal(profile().credits, 5); assert.equal(profile().role, 'user');
  assert.throws(() => assertAdmin(profile()), { code: 'ADMIN_REQUIRED' });
  const input = { uid: user.uid, tier: 'sultan', mode: 'manual', expectedVersion: 0, reason: 'Perbarui badge anggota yang dipilih' };
  const retry = await admin.setMembership(operator, 'membership-action-1', input); assert.equal(retry.replayed, true); assert.equal(retry.operationId, result.operationId);
  const audits = [...db.records.entries()].filter(([path]) => path.startsWith('adminAudit/'));
  assert.equal(audits.length, 1); assert.equal(audits[0][1].before.membershipTier, 'regular'); assert.equal(audits[0][1].after.membershipTier, 'sultan');
});

test('manual downgrade persists through payments; automatic mode restores the highest paid package', async () => {
  const { profile, setBadge, invoice, paid } = await setup();
  await setBadge('pro'); await paid(await invoice('sultan'));
  assert.equal(profile().membershipTier, 'pro'); assert.equal(profile().purchasedTier, 'sultan'); assert.equal(profile().credits, 1004);
  await setBadge('regular'); assert.equal(profile().membershipTier, 'regular');
  await setBadge('regular', 'automatic'); assert.equal(profile().membershipTier, 'sultan'); assert.equal(profile().membershipManualOverride, false); assert.equal(profile().credits, 1004);
});

test('ordinary users, invalid badges, missing reasons and stale changes cannot mutate membership', async () => {
  const { admin, profile, db, repo } = await setup();
  const input = { uid: user.uid, tier: 'pro', mode: 'manual', expectedVersion: 0, reason: 'Perbarui status anggota' };
  await assert.rejects(admin.setMembership(user, 'membership-denied-001', input), { code: 'ADMIN_REQUIRED' });
  for (const extra of [{ tier: 'admin' }, { tier: '__proto__' }, { mode: 'whatever' }, { expectedVersion: '0' }, { uid: '../admin' }, { reason: 'x' }]) await assert.rejects(admin.setMembership(operator, 'membership-invalid-001', { ...input, ...extra }));
  const outcomes = await Promise.allSettled([admin.setMembership(operator, 'membership-race-001', input), admin.setMembership(operator, 'membership-race-002', { ...input, tier: 'plus' })]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1); assert.equal(outcomes.find((item) => item.status === 'rejected').reason.code, 'MEMBERSHIP_CHANGED');
  assert.equal(profile().credits, 5);
  const handler = makeAdminHandler({ env, repo, admin, services: { db, auth: {} }, authenticate: async () => user });
  assert.equal((await call(handler, { body: { action: 'setMembership', ...input } })).statusCode, 403);
});

test('an operator whose role was revoked is rechecked inside the membership transaction', async () => {
  const { db, setBadge, profile } = await setup();
  await db.doc('users/' + operator.uid).update({ role: 'user' });
  await assert.rejects(setBadge('sultan'), { code: 'ADMIN_REQUIRED' }); assert.equal(profile().membershipTier, 'regular');
});

test('a profile may publish only its own selected public fields and cannot assign its own badge', async () => {
  const { repo, profile, setBadge } = await setup(); await setBadge('pro');
  const handler = makeHandler('profile', { env, repo, authenticate: async () => user });
  const response = await call(handler, { body: { action: 'updatePublicProfile', profile: { ...publicProfile, membershipTier: 'sultan', role: 'admin', credits: 999999 } } });
  assert.equal(response.statusCode, 200); assert.equal(profile().membershipTier, 'pro'); assert.equal(profile().role, 'user'); assert.equal(profile().credits, 5);
  const result = await call(makeHandler('members', { env, repo }), { method: 'GET', customHeaders: { authorization: undefined } });
  assert.equal(result.statusCode, 200); assert.equal(result.body.data.items.length, 1);
  assert.deepEqual(Object.keys(result.body.data.items[0]).sort(), ['bio', 'name', 'photoURL', 'publicId', 'tier']);
  assert.equal(result.body.data.items[0].name, publicProfile.name); assert.equal(result.body.data.items[0].tier, 'pro'); assert.ok(!JSON.stringify(result.body).includes(user.uid)); assert.ok(!JSON.stringify(result.body).includes(user.email));
});

test('public profiles are opt in, disappear on withdrawal or blocking, and update when badges change', async () => {
  const { repo, setBadge, admin, db } = await setup(); await setBadge('plus');
  assert.equal((await repo.publicMembers()).items.length, 0);
  await repo.updatePublicProfile(user.uid, publicProfile); assert.equal((await repo.publicMembers()).items[0].tier, 'plus');
  await setBadge('sultan'); assert.equal((await repo.publicMembers()).items[0].tier, 'sultan');
  await repo.updatePublicProfile(user.uid, { ...publicProfile, visible: false }); assert.equal((await repo.publicMembers()).items.length, 0);
  await repo.updatePublicProfile(user.uid, publicProfile);
  await admin.changeUser(operator, 'membership-block-001', 'setStatus', { uid: user.uid, status: 'blocked', reason: 'Blokir akun yang sedang diperiksa' });
  assert.equal((await repo.publicMembers()).items.length, 0); assert.equal(db.records.has('publicMembers/' + publicMemberId(user.uid)), false);
  await assert.rejects(repo.updatePublicProfile(user.uid, publicProfile), { code: 'ACCOUNT_BLOCKED' });
});

test('legacy paid packages recover their badge on login without altering balances or private visibility', async () => {
  const db = new MemoryFirestore(), repo = createRepository(db);
  await db.doc('users/' + user.uid).set({ name: user.name, email: user.email, credits: 23, role: 'user', status: 'active' });
  await db.doc('payments/old-pro').set({ uid: user.uid, packageId: 'pro', credited: true });
  await db.doc('payments/old-plus').set({ uid: user.uid, packageId: 'plus', credited: true });
  await db.doc('payments/old-unpaid').set({ uid: user.uid, packageId: 'sultan', credited: false });
  const first = await repo.ensureProfile(user); assert.equal(first.membershipTier, 'plus'); assert.equal(first.purchasedTier, 'plus'); assert.equal(first.credits, 23);
  const second = await repo.ensureProfile(user); assert.equal(second.membershipVersion, first.membershipVersion); assert.equal(second.credits, 23);
  assert.equal((await repo.publicMembers()).items.length, 0);
});

test('invalid public fields are rejected; provider image URLs and record fields are sanitized', async () => {
  const { repo, setBadge, db } = await setup(); await setBadge('sultan');
  for (const extra of [{ name: '' }, { name: 'a'.repeat(51) }, { bio: 'x'.repeat(161) }, { visible: 'yes' }, { showPhoto: 'yes' }]) await assert.rejects(repo.updatePublicProfile(user.uid, { ...publicProfile, ...extra }), { code: 'INVALID_PUBLIC_PROFILE' });
  await db.doc('users/' + user.uid).update({ photoURL: 'https://localhost/secret' });
  await repo.updatePublicProfile(user.uid, publicProfile); const item = (await repo.publicMembers()).items[0]; assert.equal(item.photoURL, '');
  await db.doc('publicMembers/' + publicMemberId(user.uid)).update({ email: 'private@example.test', credits: 100 });
  assert.ok(!JSON.stringify(await repo.publicMembers()).includes('private@example.test'));
});

test('stale Sultan pages must reload before a new invoice and mismatched quotas never charge', async () => {
  const { repo, db } = await setup(); let creates = 0;
  const handler = makeHandler('createPayment', { env, repo, authenticate: async () => user, gateway: { create: async () => { creates++; throw new Error('Must not create'); } } });
  for (const body of [{ packageId: 'sultan', expectedAmount: 999000 }, { packageId: 'sultan', expectedAmount: 500000 }, { packageId: 'sultan', expectedAmount: 500000, expectedCredits: 1999, catalogRevision: 2 }]) {
    const result = await call(handler, { body }); assert.equal(result.statusCode, 409); assert.equal(result.body.error.code, 'PACKAGE_CHANGED');
  }
  assert.equal(creates, 0); assert.equal([...db.records.keys()].filter((key) => key.startsWith('paymentRequests/')).length, 0);
});
