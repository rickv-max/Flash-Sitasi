import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway, normalizePayment, verifyWebhook } from '../server/gateway.js';
import { createRepository, paymentDocId } from '../server/repository.js';
import { makeHandler } from '../server/handlers.js';
import { topupPrice } from '../shared/catalog.js';
import { MemoryFirestore, call, env, user } from './helpers.js';

const invoice = 'BAYAR-1234567890-ABC123';
const providerData = { invoice_id: invoice, amount: 7500, final_amount: 7523, payment_url: `https://www.bayar.gg/pay?invoice=${invoice}`, status: 'pending' };
const payment = { invoice, amount: 7500, finalAmount: 7523, paymentURL: providerData.payment_url, status: 'pending', expiresAt: null };
const availableMethods = { success: true, data: { payment_methods: [{ id: 'qris', name: 'QRIS', enabled: true, available: true, min_amount: 5000, max_amount: 500000 }] } };
function signedBody(overrides = {}, timestamp = String(Math.floor(Date.now() / 1000))) {
  const body = { event: 'payment.paid', invoice_id: invoice, status: 'paid', amount: 7500, final_amount: 7523, timestamp: Number(timestamp), ...overrides };
  const signature = createHmac('sha256', env.BAYAR_GG_WEBHOOK_SECRET).update(`${body.invoice_id}|${body.status}|${body.final_amount}|${timestamp}`).digest('hex');
  return { body, customHeaders: { 'x-webhook-signature': signature, 'x-webhook-timestamp': timestamp } };
}
async function setup() {
  const db = new MemoryFirestore(); const repo = createRepository(db);
  await repo.ensureProfile(user);
  const reservation = await repo.reservePayment(user.uid, 'test-request-key-0001', 10, 7500);
  await repo.finishPayment(reservation.ref, user.uid, 10, payment);
  return { db, repo, overrides: { env, repo, authenticate: async () => user, gateway: { check: async () => ({ ...providerData, status: 'paid' }) } } };
}

test('top up uses integer credits within QRIS-compatible bounds', () => {
  assert.equal(topupPrice(10), 7500); assert.equal(topupPrice(500), 375000);
  for (const invalid of [0, 1, 6, 9, 501, -10, 10.5, '10', NaN, Infinity, null]) assert.throws(() => topupPrice(invalid));
});
for (const [name, body] of [ ['data', { success: true, data: providerData }], ['payment', { success: true, payment: { ...providerData, payment_url: undefined }, payment_url: providerData.payment_url }], ['root', { success: true, ...providerData }] ]) {
  test(`normalizes official ${name} response shape`, () => {
    assert.deepEqual(normalizePayment(body, 'https://www.bayar.gg/pay'), payment);
  });
}
test('rejects missing invoice, invalid amount and unsafe checkout URLs', () => {
  for (const change of [{ invoice_id: '' }, { amount: -1 }, { final_amount: 10 }, { payment_url: 'javascript:alert(1)' }, { payment_url: 'http://www.bayar.gg/pay' }, { payment_url: 'https://attacker.example/pay' }, { payment_url: 'https://user:password@www.bayar.gg/pay' }]) {
    assert.throws(() => normalizePayment({ success: true, data: { ...providerData, ...change } }, 'https://www.bayar.gg/pay'));
  }
});
test('create request includes required checkout URL, server redirects and server price', async () => {
  let sent;
  const gateway = createGateway({ key: env.BAYAR_GG_API_KEY, origin: env.APP_URL, checkout: 'https://www.bayar.gg/pay', method: '' }, async (url, options) => {
    if (url.endsWith('get-payment-methods.php')) return Response.json(availableMethods);
    sent = { url, options, body: JSON.parse(options.body) }; return Response.json({ success: true, data: providerData });
  });
  await gateway.create({ amount: 7500, credits: 10, user });
  assert.equal(sent.options.headers['X-API-Key'], env.BAYAR_GG_API_KEY);
  assert.equal(sent.body.payment_url, 'https://www.bayar.gg/pay');
  assert.equal(sent.body.amount, 7500);
  assert.equal(sent.body.callback_url, `${env.APP_URL}/api/payment-webhook`);
  assert.equal(sent.body.redirect_url, `${env.APP_URL}/?payment=return`);
  assert.equal(sent.body.payment_method, 'qris');
});
test('handles provider HTTP errors without exposing provider bodies', async () => {
  for (const status of [400, 401, 429, 500]) {
    const gateway = createGateway({ key: 'secret' }, async () => Response.json({ success: false, message: 'SECRET-UPSTREAM-BODY' }, { status }));
    await assert.rejects(gateway.check(invoice), (error) => error.code === 'GATEWAY_REJECTED' && !error.message.includes('SECRET'));
  }
});
test('handles HTML responses and timeouts, never retries create requests', async () => {
  let calls = 0;
  const html = createGateway({}, async (url) => { if (url.endsWith('get-payment-methods.php')) return Response.json(availableMethods); calls++; return new Response('<html>cloudflare</html>'); });
  await assert.rejects(html.create({ amount: 7500, credits: 10, user }), { code: 'GATEWAY_FORMAT' });
  assert.equal(calls, 1);
  const timeout = createGateway({}, async () => { throw new DOMException('timed out', 'TimeoutError'); });
  await assert.rejects(timeout.check(invoice), { status: 504 });
});
test('accepts valid signed webhook', () => {
  const { body, customHeaders } = signedBody();
  assert.equal(verifyWebhook(body, customHeaders, env.BAYAR_GG_WEBHOOK_SECRET), true);
});
test('rejects forged, missing, stale and mismatched webhook signatures', () => {
  const valid = signedBody();
  assert.throws(() => verifyWebhook(valid.body, {}, env.BAYAR_GG_WEBHOOK_SECRET), { status: 401 });
  assert.throws(() => verifyWebhook({ ...valid.body, final_amount: 7500 }, valid.customHeaders, env.BAYAR_GG_WEBHOOK_SECRET), { status: 401 });
  assert.throws(() => verifyWebhook(valid.body, valid.customHeaders, 'wrong-secret'), { status: 401 });
  const stale = signedBody({}, String(Math.floor(Date.now() / 1000) - 600));
  assert.throws(() => verifyWebhook(stale.body, stale.customHeaders, env.BAYAR_GG_WEBHOOK_SECRET), { status: 401 });
  assert.throws(() => verifyWebhook({ ...valid.body, timestamp: valid.body.timestamp + 1 }, valid.customHeaders, env.BAYAR_GG_WEBHOOK_SECRET), { status: 401 });
});
test('initial profile grant is atomic and preserves existing balances', async () => {
  const db = new MemoryFirestore(); const repo = createRepository(db);
  await Promise.all([repo.ensureProfile(user), repo.ensureProfile(user)]);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  await db.doc(`users/${user.uid}`).update({ credits: 87 });
  assert.equal((await repo.ensureProfile(user)).credits, 87);
});
test('create endpoint authenticates and ignores tampered browser amounts and redirects', async () => {
  const db = new MemoryFirestore(); const repo = createRepository(db); let parameters;
  const handler = makeHandler('createPayment', { env, repo, authenticate: async () => user,
    gateway: { create: async (args) => { parameters = args; return payment; } } });
  const response = await call(handler, { body: { credits: 10, amount: 1, redirect_url: 'https://evil.test', customer_email: 'evil@example.test' } });
  assert.equal(response.statusCode, 201); assert.equal(parameters.amount, 7500); assert.equal(parameters.user.email, user.email);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  assert.equal(response.body.data.uid, undefined);
  const unauthenticated = await call(handler, { customHeaders: { authorization: undefined } });
  assert.equal(unauthenticated.statusCode, 401);
});
test('rejects invalid body, method, missing key, unconfigured gateway, and hostile origins', async () => {
  const { overrides } = await setup();
  const handler = makeHandler('createPayment', overrides);
  assert.equal((await call(handler, { method: 'GET' })).statusCode, 405);
  assert.equal((await call(handler, { body: '{' })).statusCode, 400);
  assert.equal((await call(handler, { body: { credits: 1 } })).statusCode, 400);
  assert.equal((await call(handler, { body: { credits: 10 }, customHeaders: { 'idempotency-key': '' } })).statusCode, 400);
  assert.equal((await call(handler, { body: { credits: 10 }, customHeaders: { origin: 'https://evil.test' } })).statusCode, 403);
  assert.equal((await call(makeHandler('createPayment', { ...overrides, env: { APP_URL: env.APP_URL } }), { body: { credits: 10 }, customHeaders: { 'idempotency-key': 'unconfigured-new-request-001' } })).statusCode, 503);
});
test('retry with the same key returns the same invoice without calling provider', async () => {
  const { overrides } = await setup(); let calls = 0;
  const handler = makeHandler('createPayment', { ...overrides, gateway: { create: async () => { calls++; return payment; } } });
  const response = await call(handler, { body: { credits: 10 } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.data.invoice, invoice); assert.equal(calls, 0);
  assert.equal((await call(handler, { body: { credits: 50 } })).statusCode, 409);
});
test('ambiguous provider failure keeps reservation and blocks duplicate create', async () => {
  const { db } = await setup(); const repo = createRepository(db); let calls = 0;
  const handler = makeHandler('createPayment', { env, repo, authenticate: async () => user, gateway: { create: async () => { calls++; throw new Error('network'); } } });
  const options = { body: { credits: 10 }, customHeaders: { 'idempotency-key': 'different-request-key-0002' } };
  await call(handler, options);
  const retry = await call(handler, options); assert.equal(retry.statusCode, 409); assert.equal(retry.body.error.paymentPending, true); assert.equal(calls, 1);
});
test('concurrent duplicate callbacks credit an invoice exactly once', async () => {
  const { db, overrides } = await setup();
  const handler = makeHandler('webhook', overrides);
  const responses = await Promise.all([call(handler, signedBody()), call(handler, signedBody()), call(handler, signedBody())]);
  assert.ok(responses.every((response) => response.statusCode === 200));
  assert.equal(db.records.get(`users/${user.uid}`).credits, 15);
  assert.equal(db.records.get(`payments/${paymentDocId(invoice)}`).credited, true);
  assert.equal([...db.records.keys()].filter((key) => key.includes('creditLedger')).length, 1);
});
test('mismatched or underpaid callbacks do not increase balance', async () => {
  const { db, overrides } = await setup(); const handler = makeHandler('webhook', overrides);
  assert.equal((await call(handler, signedBody({ final_amount: 7500 }))).statusCode, 409);
  assert.equal((await call(handler, signedBody({ paid_amount: 7000 }))).statusCode, 409);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});
test('unknown webhook invoice returns retryable failure and does not create a balance', async () => {
  const { db, overrides } = await setup();
  const response = await call(makeHandler('webhook', overrides), signedBody({ invoice_id: 'BAYAR-UNKNOWN-123' }));
  assert.equal(response.statusCode, 404); assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});
test('payment lookup enforces ownership before querying provider', async () => {
  const { overrides } = await setup(); let calls = 0;
  const handler = makeHandler('paymentStatus', { ...overrides, authenticate: async () => ({ uid: 'someone-else' }), gateway: { check: async () => { calls++; } } });
  assert.equal((await call(handler, { method: 'GET', query: { invoice } })).statusCode, 404); assert.equal(calls, 0);
});
test('status polling recovers paid credits and subsequent webhook stays idempotent', async () => {
  const { db, overrides } = await setup(); let calls = 0;
  const handler = makeHandler('paymentStatus', { ...overrides, gateway: { check: async () => { calls++; return { ...providerData, status: 'paid' }; } } });
  const response = await call(handler, { method: 'GET', query: { invoice } });
  assert.equal(response.body.data.credited, true);
  await call(makeHandler('webhook', overrides), signedBody());
  await call(handler, { method: 'GET', query: { invoice } });
  assert.equal(db.records.get(`users/${user.uid}`).credits, 15); assert.equal(calls, 1);
});
test('pending payment polling never grants credit', async () => {
  const { db, overrides } = await setup();
  const handler = makeHandler('paymentStatus', { ...overrides, gateway: { check: async () => providerData } });
  const response = await call(handler, { method: 'GET', query: { invoice } });
  assert.equal(response.body.data.credited, false); assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});

test('unsigned legacy callbacks are fulfilled only after authenticated provider verification', async () => {
  const { db, overrides } = await setup(); let checks = 0;
  const handler = makeHandler('webhook', { ...overrides, gateway: { check: async (id) => { checks++; assert.equal(id, invoice); return { ...providerData, status: 'paid' }; } } });
  const response = await call(handler, { body: { invoice_id: invoice, status: 'paid', amount: 7500, final_amount: 7523 } });
  assert.equal(response.statusCode, 200); assert.equal(checks, 1); assert.equal(db.records.get(`users/${user.uid}`).credits, 15);
});
test('forged unsigned callbacks and valid signatures cannot override a pending provider status', async () => {
  const { db, overrides } = await setup();
  const handler = makeHandler('webhook', { ...overrides, gateway: { check: async () => providerData } });
  assert.equal((await call(handler, { body: { invoice_id: invoice, status: 'paid' } })).statusCode, 409);
  assert.equal((await call(handler, signedBody())).statusCode, 409);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});
test('present but invalid webhook signatures are rejected before provider access', async () => {
  const { db, overrides } = await setup(); let checks = 0;
  const handler = makeHandler('webhook', { ...overrides, gateway: { check: async () => { checks++; return { ...providerData, status: 'paid' }; } } });
  const payload = signedBody(); payload.customHeaders['x-webhook-signature'] = '0'.repeat(64);
  assert.equal((await call(handler, payload)).statusCode, 401); assert.equal(checks, 0);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});
