import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { createDokuGateway, dokuInvoice, dokuSignature, verifyDokuNotification, normalizeDokuStatus, dokuCheckoutURL } from '../server/doku.js';
import { dokuConfig, paymentProvider } from '../server/config.js';
import { gatewayForPayment } from '../server/payment-providers.js';
import { rawBodyOf } from '../server/http.js';
import { makeHandler } from '../server/handlers.js';
import { makeAdminHandler } from '../server/admin-handlers.js';
import { createRepository, paymentDocId } from '../server/repository.js';
import { createAdminRepository } from '../server/admin-repository.js';
import { CREDIT_CATALOG_REVISION } from '../shared/catalog.js';
import { MemoryFirestore, call, env, user } from './helpers.js';

const dokuEnv = { ...env, PAYMENT_PROVIDER: 'doku', DOKU_CLIENT_ID: 'MCH-test-merchant', DOKU_SECRET_KEY: 'test-doku-private-key', DOKU_ENVIRONMENT: 'production' };
const config = dokuConfig(dokuEnv);
const invoice = dokuInvoice(user.uid, 'doku-test-request-0001');
// Independent construction of the documented Non-SNAP signing string.
function sign(clientId, requestId, timestamp, target, raw, response = false) {
  const components = `Client-Id:${clientId}\nRequest-Id:${requestId}\n${response ? 'Response' : 'Request'}-Timestamp:${timestamp}\nRequest-Target:${target}` +
    (raw === undefined ? '' : `\nDigest:${createHash('sha256').update(raw).digest('base64')}`);
  return `HMACSHA256=${createHmac('sha256', dokuEnv.DOKU_SECRET_KEY).update(components).digest('base64')}`;
}
function providerResponse(url, options, body, changes = {}) {
  const raw = JSON.stringify(body), timestamp = '2026-10-26T01:02:03Z';
  return new Response(raw, { headers: { 'Content-Type': 'application/json', 'Response-Timestamp': timestamp,
    Signature: sign(config.clientId, options.headers['Request-Id'], timestamp, new URL(url).pathname,
      options.method === 'POST' ? raw : undefined, true), ...changes } });
}
function checkoutBody(id = invoice, amount = 115000, environment = 'production') {
  return { message: ['SUCCESS'], response: { order: { invoice_number: id, amount: String(amount), currency: 'IDR' },
    payment: { payment_method_types: ['QRIS'], url: `https://${environment === 'sandbox' ? 'sandbox' : 'jokul'}.doku.com/checkout-link-v2/token123` } } };
}
function statusBody(id = invoice, amount = 115000, status = 'SUCCESS') {
  return { service: { id: 'QRIS' }, channel: { id: 'QRIS_DOKU' }, transaction: { status }, order: { invoice_number: id, amount } };
}
function notification(body = statusBody(), overrides = {}) {
  const raw = JSON.stringify(body), timestamp = overrides.timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const requestId = 'notification-test-0001';
  return { body: raw, customHeaders: { 'client-id': config.clientId, 'request-id': requestId, 'request-timestamp': timestamp,
    signature: sign(config.clientId, requestId, timestamp, '/api/doku-webhook', raw), ...overrides.headers } };
}
async function setup(environment = 'production', fetcher) {
  const selectedEnv = { ...dokuEnv, DOKU_ENVIRONMENT: environment }, db = new MemoryFirestore(), repo = createRepository(db);
  const selectedConfig = dokuConfig(selectedEnv);
  const gateway = createDokuGateway(selectedConfig, fetcher || (async (url, options) => {
    const body = options.method === 'POST' ? JSON.parse(options.body) : null;
    return providerResponse(url, options, body ? checkoutBody(body.order.invoice_number, body.order.amount, environment) : statusBody());
  }));
  const overrides = { env: selectedEnv, repo, gateway, authenticate: async () => user };
  return { db, repo, overrides, handler: makeHandler('createPayment', overrides), webhook: makeHandler('dokuWebhook', overrides) };
}
const proRequest = { body: { packageId: 'pro', catalogRevision: CREDIT_CATALOG_REVISION }, customHeaders: { 'idempotency-key': 'doku-test-request-0001' } };

test('new purchases default to DOKU without falling back to the old provider', async () => {
  assert.equal(paymentProvider({}), 'doku');
  assert.throws(() => gatewayForPayment({ ...env, PAYMENT_PROVIDER: undefined }), { code: 'PAYMENT_CONFIG' });
  assert.throws(() => paymentProvider({ PAYMENT_PROVIDER: 'arbitrary' }), { code: 'PAYMENT_CONFIG' });
  for (const change of [{ DOKU_CLIENT_ID: '' }, { DOKU_SECRET_KEY: '' }, { DOKU_ENVIRONMENT: 'live' }, { DOKU_CLIENT_ID: 'bad\nheader' }]) {
    assert.throws(() => dokuConfig({ ...dokuEnv, ...change }), { code: 'PAYMENT_CONFIG' });
  }
  const response = await call(makeHandler('paymentOptions', { env: {} }), { method: 'GET', customHeaders: { authorization: undefined } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.data.provider, 'doku');
  assert.equal(response.body.data.availability.state, 'not_configured'); assert.deepEqual(response.body.data.methods, []);
  assert.ok(!JSON.stringify(response.body).includes('SECRET_KEY'));
});
test('configured DOKU options disclose only QRIS application limits, not credentials or an asserted merchant activation', async () => {
  const response = await call(makeHandler('paymentOptions', { env: dokuEnv }), { method: 'GET' });
  assert.equal(response.body.data.availability.state, 'configured'); assert.equal(response.body.data.methods[0].id, 'qris');
  for (const privateValue of [config.clientId, config.secret]) assert.ok(!JSON.stringify(response.body).includes(privateValue));
});
test('Non-SNAP POST and GET signatures use the exact target, timestamp and optional raw-body digest', () => {
  for (const raw of [undefined, '{"order":{"amount":115000}}']) {
    const args = { clientId: config.clientId, requestId: 'request-001', timestamp: '2026-10-26T00:00:00Z', target: '/checkout/v1/payment', body: raw };
    assert.equal(dokuSignature(args, config.secret), sign(args.clientId, args.requestId, args.timestamp, args.target, raw));
  }
});
test('checkout sends signed QRIS-only requests, exact server amount, fixed callbacks and the saved invoice', async () => {
  const { db, handler } = await setup('production', async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(url, 'https://api.doku.com/checkout/v1/payment'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Signature, sign(config.clientId, invoice, options.headers['Request-Timestamp'], '/checkout/v1/payment', options.body));
    assert.deepEqual(body.payment.payment_method_types, ['QRIS']); assert.equal(body.order.invoice_number, invoice);
    assert.equal(body.order.amount, 115000); assert.equal(body.order.line_items[0].price, 115000);
    assert.equal(body.order.callback_url, `${env.APP_URL}/?payment=return`);
    assert.equal(body.additional_info.override_notification_url, `${env.APP_URL}/api/doku-webhook`);
    assert.equal(body.customer.email, user.email);
    return providerResponse(url, options, checkoutBody());
  });
  const response = await call(handler, { ...proRequest, body: { ...proRequest.body, amount: 1, customer_email: 'attacker@test', callback_url: 'https://attacker.test' } });
  assert.equal(response.statusCode, 201); assert.equal(response.body.data.provider, 'doku'); assert.equal(response.body.data.finalAmount, 115000);
  assert.equal(response.body.data.merchantId, undefined); assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  assert.equal(db.records.get(`payments/${paymentDocId(invoice)}`).merchantId, config.clientId);
});
test('single-credit prices still follow admin settings independently of fixed packages', async () => {
  const { db, handler } = await setup('production');
  await db.doc('settings/app').set({ pricePerCredit: 900 });
  const response = await call(handler, { body: { credits: 10, expectedAmount: 9000 }, customHeaders: { 'idempotency-key': 'doku-unit-request-0001' } });
  assert.equal(response.statusCode, 201); assert.equal(response.body.data.amount, 9000); assert.equal(response.body.data.credits, 10);
});
test('all three package amounts and credit quantities reach DOKU unchanged', async () => {
  for (const [packageId, credits, amount] of [['pro', 199, 115000], ['plus', 499, 299000], ['sultan', 999, 500000]]) {
    const { handler } = await setup();
    const response = await call(handler, { body: { packageId, catalogRevision: CREDIT_CATALOG_REVISION } });
    assert.equal(response.statusCode, 201); assert.equal(response.body.data.credits, credits); assert.equal(response.body.data.amount, amount);
  }
});
test('signed responses with altered invoice, amount, currency, channels or unsafe URLs remain unresolved and cannot credit', async () => {
  for (const mutate of [x => { x.response.order.invoice_number = 'OTHER-INVOICE'; }, x => { x.response.order.amount = 1; },
    x => { x.response.order.currency = 'USD'; }, x => { x.response.payment.payment_method_types = ['QRIS', 'CREDIT_CARD']; },
    x => { x.response.payment.url = 'https://attacker.test/checkout/link/x'; }, x => { x.response.payment.url = 'https://sandbox.doku.com/checkout/link/x'; }]) {
    const { db, handler } = await setup('production', async (url, options) => {
      const body = checkoutBody(); mutate(body); return providerResponse(url, options, body);
    });
    const response = await call(handler, proRequest);
    assert.equal(response.statusCode, 502); assert.equal(response.body.error.paymentPending, true);
    assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
    assert.equal([...db.records.values()].find(x => x.state)?.state, 'unknown');
  }
});
test('forged or missing DOKU response signatures fail closed without exposing provider contents', async () => {
  for (const signature of ['', 'HMACSHA256=' + 'A'.repeat(43) + '=']) {
    const gateway = createDokuGateway(config, async (url, options) => providerResponse(url, options, checkoutBody(), { Signature: signature }));
    await assert.rejects(gateway.create({ amount: 115000, credits: 199, user, invoice }), { code: 'INVALID_GATEWAY_SIGNATURE' });
  }
});
test('timeouts and duplicate responses never retry an ambiguous creation; admin retains the deterministic invoice', async () => {
  for (const status of [0, 409]) {
    let calls = 0;
    const { db, handler } = await setup('production', async () => {
      calls++; if (!status) throw new DOMException('network', 'TimeoutError');
      return Response.json({ secret: 'upstream-private-body' }, { status });
    });
    const response = await call(handler, proRequest); assert.equal(response.body.error.paymentPending, true);
    const again = await call(handler, proRequest); assert.equal(again.statusCode, 409); assert.equal(calls, 1);
    const request = [...db.records.values()].find(x => x.state === 'unknown');
    assert.equal(request.providerInvoice, invoice); assert.equal(request.provider, 'doku');
    assert.ok(!JSON.stringify(response.body).includes('upstream-private-body'));
  }
});
test('definitive DOKU rejection clears the reservation for a later deliberate attempt', async () => {
  const { db, handler } = await setup('production', async () => Response.json({ message: 'private account details' }, { status: 403 }));
  const response = await call(handler, proRequest);
  assert.equal(response.body.error.paymentPending, undefined); assert.ok(![...db.records.keys()].some(x => x.startsWith('paymentRequests/')));
});
test('raw webhook bodies preserve whitespace, decimal representation and multibyte text across stream chunks', async () => {
  const raw = Buffer.from('{ "amount": 20000.00, "name": "Penulis é" }');
  const req = Readable.from([raw.subarray(0, raw.length - 5), raw.subarray(raw.length - 5)]);
  assert.deepEqual(await rawBodyOf(req), raw);
  await assert.rejects(rawBodyOf({ body: { amount: 1 } }), { code: 'INVALID_BODY' });
  await assert.rejects(rawBodyOf(Readable.from([Buffer.alloc(16001)])), { status: 413 });
});
test('forged, wrong-merchant, wrong-target, changed-body and future webhook signatures are rejected before settlement', () => {
  const valid = notification(); const headers = valid.customHeaders;
  for (const changed of [{ ...headers, signature: 'HMACSHA256=' + 'A'.repeat(43) + '=' }, { ...headers, 'client-id': 'another-merchant' },
    { ...headers, signature: sign(config.clientId, headers['request-id'], headers['request-timestamp'], '/different-path', valid.body) },
    { ...headers, 'request-timestamp': '2099-01-01T00:00:00Z' }, { ...headers, 'request-id': 'bad\nheader' }, {}]) {
    assert.throws(() => verifyDokuNotification(Buffer.from(valid.body), changed, config), { code: 'INVALID_SIGNATURE' });
  }
  assert.throws(() => verifyDokuNotification(Buffer.from(valid.body + ' '), headers, config), { code: 'INVALID_SIGNATURE' });
  const delayed = notification(statusBody(), { timestamp: '2026-10-20T00:00:00Z' });
  assert.equal(verifyDokuNotification(Buffer.from(delayed.body), delayed.customHeaders, config).status, 'paid');
});
test('signed QRIS notification and a duplicate browser request settle exactly once with the purchased badge', async () => {
  const { db, handler, webhook } = await setup();
  assert.equal((await call(handler, proRequest)).statusCode, 201);
  assert.equal((await call(handler, proRequest)).statusCode, 200);
  const responses = await Promise.all([call(webhook, notification()), call(webhook, notification()), call(webhook, notification())]);
  assert.ok(responses.every(x => x.statusCode === 200));
  const profile = db.records.get(`users/${user.uid}`);
  assert.equal(profile.credits, 204); assert.equal(profile.membershipTier, 'pro');
  assert.equal([...db.records.keys()].filter(x => x.includes('/creditLedger/')).length, 1);
});
test('signature alone cannot credit a mismatched amount, a non-QRIS channel or a different invoice', async () => {
  const { db, handler, webhook } = await setup(); await call(handler, proRequest);
  for (const body of [statusBody(invoice, 1), statusBody('different-invoice'), { ...statusBody(), service: { id: 'CREDIT_CARD' } }]) {
    const response = await call(webhook, notification(body)); assert.ok(response.statusCode >= 400);
  }
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});
test('non-final notifications are acknowledged without granting credits; a later SUCCESS still settles', async () => {
  const { db, handler, webhook } = await setup(); await call(handler, proRequest);
  for (const status of ['PENDING', 'FAILED', 'EXPIRED', 'TIMEOUT', 'REFUNDED']) {
    assert.equal((await call(webhook, notification(statusBody(invoice, 115000, status)))).statusCode, 200);
    assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  }
  assert.equal((await call(webhook, notification())).statusCode, 200); assert.equal(db.records.get(`users/${user.uid}`).credits, 204);
});
test('sandbox payment success never grants production credits, badges or a top-up ledger entry', async () => {
  const { db, handler, webhook } = await setup('sandbox'); await call(handler, proRequest);
  assert.equal((await call(webhook, notification())).statusCode, 200);
  const profile = db.records.get(`users/${user.uid}`), payment = db.records.get(`payments/${paymentDocId(invoice)}`);
  assert.equal(profile.credits, 5); assert.equal(profile.membershipTier, 'regular'); assert.equal(payment.credited, false);
  assert.equal(payment.testPayment, true); assert.equal(payment.status, 'paid');
  assert.equal([...db.records.keys()].filter(x => x.includes('/creditLedger/')).length, 0);
});
test('server-side polling recovers verified DOKU payments and observes a 60-second interval', async () => {
  let checks = 0;
  const { db, repo, handler, overrides } = await setup('production', async (url, options) => {
    if (options.method === 'POST') return providerResponse(url, options, checkoutBody());
    checks++; assert.equal(options.headers.Signature, sign(config.clientId, options.headers['Request-Id'], options.headers['Request-Timestamp'], new URL(url).pathname));
    return providerResponse(url, options, statusBody());
  });
  await call(handler, proRequest); const status = makeHandler('paymentStatus', overrides);
  const args = { method: 'GET', query: { invoice } };
  assert.equal((await call(status, args)).body.data.credited, false); assert.equal(checks, 0);
  await db.doc(`payments/${paymentDocId(invoice)}`).update({ createdAt: Date.now() - 61000 });
  assert.equal((await call(status, args)).body.data.credited, true); assert.equal(checks, 1);
  assert.equal((await repo.getPayment(invoice, user.uid)).credited, true);
  await call(status, args); assert.equal(checks, 1);
});
test('unselected checkout status and expected Not Found remain pending and never imply paid', async () => {
  assert.equal(normalizeDokuStatus({ order: { invoice_number: invoice, amount: 115000, status: 'ORDER_GENERATED' } }, invoice, config).status, 'pending');
  assert.equal(normalizeDokuStatus({ order: { invoice_number: invoice, amount: 115000, status: 'ORDER_EXPIRED' }, transaction: { status: 'PENDING' } }, invoice, config).status, 'expired');
  const gateway = createDokuGateway(config, async () => Response.json({}, { status: 404 }));
  const result = await gateway.check(invoice, { invoice, amount: 115000, finalAmount: 115000, status: 'pending' });
  assert.equal(result.status, 'pending');
  await assert.rejects(gateway.check(invoice), { code: 'GATEWAY_REJECTED' });
});
test('old bayar.gg invoices use their original provider even after the new-purchase provider changes', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.startsWith('https://www.bayar.gg/api/check-payment.php'));
    return Response.json({ success: true, data: { invoice_id: 'BAYAR-old-001', status: 'paid', amount: 7500, final_amount: 7500 } });
  });
  assert.equal((await gatewayForPayment(dokuEnv, {}).check('BAYAR-old-001')).status, 'paid');
  assert.throws(() => gatewayForPayment(dokuEnv, { provider: 'doku', environment: 'sandbox', merchantId: config.clientId }), { code: 'PAYMENT_ACCOUNT_MISMATCH' });
});
test('legacy callback route cannot settle a DOKU invoice', async () => {
  const { db, handler, overrides } = await setup(); await call(handler, proRequest);
  const response = await call(makeHandler('webhook', overrides), { body: { invoice_id: invoice, status: 'paid', amount: 115000, final_amount: 115000 } });
  assert.equal(response.statusCode, 409); assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
});
test('admin recovery binds the original DOKU request to its exact invoice, merchant and environment', async () => {
  const { db, repo, overrides } = await setup(); const adminUser = { uid: 'doku-admin' };
  await repo.ensureProfile(user); await repo.ensureProfile(adminUser, { owner: true });
  const identity = { provider: 'doku', environment: 'production', merchantId: config.clientId, providerInvoice: invoice, packageId: 'pro', packageName: 'Pro' };
  const reservation = await repo.reservePayment(user.uid, 'doku-test-request-0001', 199, 115000, identity);
  await repo.failPayment(reservation.ref, false); await reservation.ref.update({ createdAt: Date.now() - 180000 });
  const admin = createAdminRepository(db, dokuEnv);
  const verified = normalizeDokuStatus(statusBody(), invoice, config);
  const input = { action: 'recoverPayment', requestID: reservation.ref.id, invoice, reason: 'Rekonsiliasi tagihan DOKU terverifikasi' };
  await assert.rejects(admin.recoverPayment(adminUser, 'recovery-wrong-key-001', input, { ...verified, merchantId: 'other' }, ''), { code: 'PAYMENT_ACCOUNT_MISMATCH' });
  const handler = makeAdminHandler({ ...overrides, admin, services: { db, auth: {} }, authenticate: async () => adminUser,
    gateway: { check: async () => verified } });
  assert.equal((await call(handler, { body: { ...input, invoice: 'OTHER-INVOICE' } })).statusCode, 409);
  const result = await call(handler, { body: input }); assert.equal(result.statusCode, 200); assert.equal(result.body.data.credited, true);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 204);
  const recovered = await repo.getPayment(invoice); assert.equal(recovered.provider, 'doku'); assert.equal(recovered.paymentURL, '');
});
test('checkout URL validation rejects credentials, other origins, mixed environments and arbitrary DOKU paths', () => {
  for (const value of ['http://jokul.doku.com/checkout/link/x', 'https://jokul.doku.com.attacker.test/checkout/link/x',
    'https://user:pass@jokul.doku.com/checkout/link/x', 'https://jokul.doku.com:444/checkout/link/x', 'https://jokul.doku.com/admin']) {
    assert.throws(() => dokuCheckoutURL(value, 'production'), { code: 'INVALID_CHECKOUT' });
  }
  assert.equal(dokuCheckoutURL('https://sandbox.doku.com/checkout/link/x', 'sandbox'), 'https://sandbox.doku.com/checkout/link/x');
});
