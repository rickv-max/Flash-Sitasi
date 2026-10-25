import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseQuote, creditPackages } from '../shared/catalog.js';
import { DEFAULT_SETTINGS, validateSettings } from '../shared/settings.js';
import { publicPaymentMethods, methodSupports } from '../shared/payment-methods.js';
import { makeHandler } from '../server/handlers.js';
import { createRepository } from '../server/repository.js';
import { createGateway } from '../server/gateway.js';
import { MemoryFirestore, call, env, user } from './helpers.js';

async function setup(settings = {}) {
  const db = new MemoryFirestore(), repo = createRepository(db);
  await repo.ensureProfile(user);
  await db.doc('settings/app').set({ ...DEFAULT_SETTINGS, ...settings });
  const created = [];
  const gateway = { create: async (input) => {
    created.push(input); const invoice = `package-invoice-${created.length}`;
    return { invoice, amount: input.amount, finalAmount: input.amount, paymentURL: `https://www.bayar.gg/pay?invoice=${invoice}`, status: 'pending', expiresAt: null };
  } };
  return { db, repo, created, handler: makeHandler('createPayment', { env, repo, gateway, authenticate: async () => user }) };
}

test('named packages have the requested credit counts and fixed prices independent of unit pricing', () => {
  const settings = validateSettings({ pricePerCredit: 1000 });
  assert.deepEqual(creditPackages(settings).map(({ id, credits, price }) => ({ id, credits, price })), [
    { id: 'pro', credits: 199, price: 115000 }, { id: 'plus', credits: 499, price: 299000 }, { id: 'sultan', credits: 999, price: 500000 },
  ]);
  assert.equal(purchaseQuote({ credits: 199 }, settings).amount, 199000);
  assert.equal(purchaseQuote({ packageId: 'pro' }, settings).amount, 115000);
  for (const value of [0, -1, 4999, 5000001, 115000.5, '115000']) assert.throws(() => validateSettings({ proPackagePrice: value }));
  assert.equal(validateSettings({ proPackagePrice: 129000 }).plusPackagePrice, 299000);
});

test('server quotes each package, ignores forged browser prices and rejects mixed selections', async () => {
  const { handler, created } = await setup({ pricePerCredit: 1000 });
  for (const [index, id] of ['pro', 'plus', 'sultan'].entries()) {
    const result = await call(handler, { body: { packageId: id, catalogRevision: 2, amount: 1, packageName: 'forged' }, customHeaders: { 'idempotency-key': `package-request-key-${index}` } });
    assert.equal(result.statusCode, 201); assert.equal(result.body.data.packageId, id);
    assert.equal(result.body.data.amount, [115000, 299000, 500000][index]);
    assert.equal(result.body.data.credits, [199, 499, 999][index]);
  }
  assert.equal(created.length, 3);
  assert.equal((await call(handler, { body: { packageId: 'pro', credits: 199 } })).statusCode, 400);
  assert.equal((await call(handler, { body: { packageId: 'unknown' } })).statusCode, 400);
});

test('changed prices require customer review before invoice creation and do not reserve or deduct credit', async () => {
  const { handler, db, created } = await setup({ pricePerCredit: 1000, proPackagePrice: 129000 });
  for (const body of [{ credits: 50, expectedAmount: 37500 }, { packageId: 'pro', expectedAmount: 115000 }]) {
    const result = await call(handler, { body });
    assert.equal(result.statusCode, 409); assert.equal(result.body.error.code, 'PRICE_CHANGED');
  }
  assert.equal(created.length, 0); assert.equal([...db.records.keys()].filter((key) => key.startsWith('paymentRequests/')).length, 0);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  const ok = await call(handler, { body: { packageId: 'pro', expectedAmount: 129000 } });
  assert.equal(ok.statusCode, 201); assert.equal(ok.body.data.amount, 129000);
});

test('package invoices retain their price on retry and cannot reuse a unit-credit request identity', async () => {
  const { handler, db, created } = await setup(); const key = 'package-idempotent-key-001';
  const first = await call(handler, { body: { packageId: 'pro', expectedAmount: 115000 }, customHeaders: { 'idempotency-key': key } });
  await db.doc('settings/app').update({ proPackagePrice: 129000, pricePerCredit: 1000, paymentEnabled: false });
  const retry = await call(handler, { body: { packageId: 'pro', expectedAmount: 115000 }, customHeaders: { 'idempotency-key': key } });
  assert.equal(retry.statusCode, 200); assert.equal(retry.body.data.invoice, first.body.data.invoice); assert.equal(retry.body.data.amount, 115000);
  assert.equal(created.length, 1);
  assert.equal((await call(handler, { body: { credits: 199 }, customHeaders: { 'idempotency-key': key } })).statusCode, 409);
  assert.equal((await call(handler, { body: { packageId: 'plus' }, customHeaders: { 'idempotency-key': key } })).statusCode, 409);
});

test('a paid Sultan invoice grants exactly 999 credits once and rejects underpayment', async () => {
  const { handler, repo, db } = await setup();
  const response = await call(handler, { body: { packageId: 'sultan', catalogRevision: 2 } }); const payment = response.body.data;
  await assert.rejects(repo.settlePayment(payment.invoice, { invoice_id: payment.invoice, status: 'paid', amount: 500000, final_amount: 499999 }), { code: 'AMOUNT_MISMATCH' });
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  const verified = { invoice_id: payment.invoice, status: 'paid', amount: 500000, final_amount: 500000 };
  await Promise.all([repo.settlePayment(payment.invoice, verified), repo.settlePayment(payment.invoice, verified)]);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 1004);
});

test('method metadata strips account secrets and checks provider-specific nominal limits', () => {
  const methods = publicPaymentMethods({ data: { payment_methods: [
    { id: 'qris', enabled: true, available: true, max_amount: 500000, private_key: 'must-not-leak' },
    { id: 'qris_livin', enabled: true, available: true, min_amount: 1000, max_amount: 5000000, account: 'private-account' },
    { id: 'ovo', enabled: true, available: false }, { id: 'all', enabled: true, available: true },
  ] } });
  assert.equal(methods.length, 2); assert.equal(methodSupports(methods[0], 999000), false); assert.equal(methodSupports(methods[1], 999000), true);
  assert.ok(!JSON.stringify(methods).includes('must-not-leak')); assert.ok(!JSON.stringify(methods).includes('private-account'));
  const reported = publicPaymentMethods({ data: { payment_methods: [{ id: 'qris', available: true, max_amount: 5000000 }] } });
  assert.equal(methodSupports(reported[0], 999000), true);
});

test('large invoices select an eligible active method and unsupported payments never send a create POST', async () => {
  for (const merchantAvailable of [true, false]) {
    const posts = [];
    const gateway = createGateway({ key: 'test-key', checkout: 'https://www.bayar.gg/pay', origin: env.APP_URL }, async (url, options) => {
      if (url.endsWith('get-payment-methods.php')) return Response.json({ success: true, data: { payment_methods: [
        { id: 'qris', enabled: true, available: true, max_amount: 500000 }, { id: 'qris_livin', enabled: true, available: merchantAvailable, max_amount: 5000000 },
      ] } });
      posts.push(JSON.parse(options.body));
      return Response.json({ success: true, data: { invoice_id: 'sultan-large-payment', amount: 999000, final_amount: 999000, payment_url: 'https://www.bayar.gg/pay?invoice=sultan-large-payment' } });
    });
    if (merchantAvailable) { await gateway.create({ amount: 999000, credits: 1999, user, packageName: 'Sultan' }); assert.equal(posts[0].payment_method, 'qris_livin'); assert.ok(posts[0].description.includes('Sultan')); }
    else { await assert.rejects(gateway.create({ amount: 999000, credits: 1999, user }), { code: 'PAYMENT_METHOD_UNAVAILABLE', definitive: true }); assert.equal(posts.length, 0); }
  }
});

test('public payment options need no database or login and only expose public method data', async () => {
  const result = await call(makeHandler('paymentOptions', { env: {}, gateway: { methods: async () => [{ id: 'qris', minAmount: 5000, maxAmount: 500000 }] } }), { method: 'GET', customHeaders: { authorization: undefined } });
  assert.equal(result.statusCode, 200); assert.deepEqual(result.body.data.methods[0], { id: 'qris', minAmount: 5000, maxAmount: 500000 });
});
test('unsupported gateway limits release the reservation and allow a safe retry after enabling a method', async () => {
  const { repo, db } = await setup(); let posts = 0, enabled = false;
  const gateway = createGateway({ key: 'test-key', checkout: 'https://www.bayar.gg/pay', origin: env.APP_URL }, async (url) => {
    if (url.endsWith('get-payment-methods.php')) return Response.json({ success: true, data: { payment_methods: [{ id: 'qris_livin', available: enabled, max_amount: 5000000 }] } });
    posts++; return Response.json({ success: true, data: { invoice_id: 'sultan-retry-enabled', amount: 500000, final_amount: 500000, payment_url: 'https://www.bayar.gg/pay?invoice=sultan-retry-enabled' } });
  });
  const handler = makeHandler('createPayment', { env, repo, gateway, authenticate: async () => user });
  const rejected = await call(handler, { body: { packageId: 'sultan', catalogRevision: 2 } });
  assert.equal(rejected.body.error.code, 'PAYMENT_METHOD_UNAVAILABLE'); assert.equal(rejected.body.error.paymentPending, undefined);
  assert.equal(posts, 0); assert.equal([...db.records.keys()].filter((key) => key.startsWith('paymentRequests/')).length, 0);
  enabled = true;
  assert.equal((await call(handler, { body: { packageId: 'sultan', catalogRevision: 2 } })).statusCode, 201); assert.equal(posts, 1);
});

test('public payment options include safe availability status without requiring login or database access', async () => {
  const gateway = createGateway({ key: 'fixture-key' }, async () => Response.json({ success: true, data: { payment_methods: [{ id: 'qris', enabled: false, available: false, private_key: 'NEVER_EXPOSE' }] } }));
  const result = await call(makeHandler('paymentOptions', { env: {}, gateway }), { method: 'GET', customHeaders: { authorization: undefined } });
  assert.equal(result.statusCode, 200); assert.equal(result.body.data.availability.state, 'provider_unavailable');
  assert.deepEqual(result.body.data.methods, []); assert.ok(!JSON.stringify(result.body).includes('NEVER_EXPOSE'));
});
