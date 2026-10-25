import test from 'node:test';
import assert from 'node:assert/strict';
import { creditRangeSupported, paymentAvailability, paymentMethodDiagnostics } from '../shared/payment-methods.js';
import { createGateway } from '../server/gateway.js';

const payload = (payment_methods) => ({ success: true, data: { payment_methods } });
const qris = { id: 'qris', name: 'QRIS', enabled: true, available: true, min_amount: 5000, max_amount: 500000 };

test('provider-disabled methods are reported separately from application top-up settings', () => {
  const result = paymentAvailability(payload([{ ...qris, enabled: false, available: false }]));
  assert.deepEqual(result.methods, []);
  assert.equal(result.availability.state, 'provider_unavailable');
  assert.ok(!result.availability.message.includes('mengaktifkan'));
  assert.equal(paymentAvailability(payload([qris])).availability.state, 'available');
});
test('an explicit method restriction is preserved even if another payment channel is available', () => {
  const body = payload([{ ...qris, available: false }, { id: 'global_card', available: true, max_amount: 5000000 }]);
  const result = paymentAvailability(body, 'qris');
  assert.equal(result.availability.state, 'method_restricted'); assert.deepEqual(result.methods, []);
  assert.equal(paymentAvailability(body, 'all').methods[0].id, 'global_card');
});
test('an unrecognized availability flag cannot silently enable a payment channel', () => {
  for (const available of [undefined, null, 'true', 'false', 1, 0]) {
    assert.deepEqual(paymentAvailability(payload([{ ...qris, available }])).methods, []);
  }
});
test('credit range availability respects live unit prices and integer quantities at both limits', () => {
  const methods = [{ minAmount: 5000, maxAmount: 500000 }];
  const settings = { pricePerCredit: 900, minTopup: 10, maxTopup: 500 };
  assert.equal(creditRangeSupported(methods, settings), true);
  assert.equal(creditRangeSupported([], settings), false);
  assert.equal(creditRangeSupported([{ minAmount: 5000, maxAmount: 8999 }], settings), false);
  assert.equal(creditRangeSupported([{ minAmount: 9000, maxAmount: 9000 }], settings), true);
  assert.equal(creditRangeSupported([{ minAmount: 9001, maxAmount: 17999 }], { ...settings, maxTopup: 10 }), false);
  assert.equal(creditRangeSupported(methods, { ...settings, pricePerCredit: 0 }), false);
});
test('diagnostics expose only allowlisted method IDs and availability flags', () => {
  const body = payload([{ ...qris, available: false, private_key: 'NEVER_LOG_KEY', requirements: ['private@example.test'], account: 'NEVER_LOG_ACCOUNT' },
    { id: 'private-key-secret!', available: true }, { id: 'NEVER_LOG_ACCOUNT', available: false }, { id: 'ovo', enabled: 'true', available: 'false' }]);
  body.data.user_status = { email: 'NEVER_LOG_EMAIL', balance: 1234567 };
  const diagnostics = paymentMethodDiagnostics(body);
  const serialized = JSON.stringify(diagnostics);
  assert.equal(diagnostics.event, 'payment_methods_unavailable');
  assert.deepEqual(diagnostics.methods.map((method) => method.id), ['qris', 'unrecognized', 'ovo']);
  for (const secret of ['NEVER_LOG', 'private@example.test', '1234567', 'private-key-secret']) assert.ok(!serialized.includes(secret));
});
test('gateway options return safe outage status and do not send a create-payment POST', async (t) => {
  const logs = []; t.mock.method(console, 'warn', (message) => logs.push(message));
  const posts = [];
  const gateway = createGateway({ key: 'fixture-key', checkout: 'https://www.bayar.gg/pay', origin: 'https://flash-sitasi.example' }, async (url, options) => {
    if (url.endsWith('get-payment-methods.php')) return Response.json(payload([{ ...qris, enabled: false, available: false, secret: 'NEVER_EXPOSE', requirements: ['NEVER_EXPOSE'] }]));
    posts.push(options); throw new Error('Unexpected payment');
  });
  const options = await gateway.options();
  assert.equal(options.availability.state, 'provider_unavailable'); assert.equal(options.methods.length, 0);
  assert.ok(!JSON.stringify(options).includes('NEVER_EXPOSE')); assert.ok(!logs.join('').includes('NEVER_EXPOSE'));
  await assert.rejects(gateway.create({ amount: 115000, credits: 199, user: { name: 'Fixture' }, packageName: 'Pro' }), { code: 'PAYMENT_METHOD_UNAVAILABLE', definitive: true });
  assert.equal(posts.length, 0);
});
test('negative method cache recovers after 15 seconds while healthy metadata remains cached', async (t) => {
  let now = 1000000, available = false, requests = 0;
  t.mock.method(Date, 'now', () => now); t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => { requests++; return Response.json(payload([{ ...qris, available }])); });
  const gateway = createGateway({ key: 'unique-fixture-cache-key', checkout: 'https://www.bayar.gg/pay', origin: 'https://flash-sitasi.example' });
  assert.equal((await gateway.options()).methods.length, 0);
  available = true; now += 14000;
  assert.equal((await gateway.options()).methods.length, 0); assert.equal(requests, 1);
  now += 1001;
  assert.equal((await gateway.options()).methods.length, 1); assert.equal(requests, 2);
  now += 59000; await gateway.methods(); assert.equal(requests, 2);
  now += 1001; await gateway.methods(); assert.equal(requests, 3);
});
test('invalid provider metadata remains a gateway format error', async () => {
  const gateway = createGateway({ key: 'fixture-key' }, async () => Response.json({ success: true, data: { unexpected: [] } }));
  await assert.rejects(gateway.options(), { code: 'GATEWAY_FORMAT' });
});
