import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from 'vite';
import { paymentConfig } from '../server/config.js';
import { env } from './helpers.js';

test('existing Sensitive payment key remains usable server-side during migration', () => {
  const { BAYAR_GG_API_KEY, ...existing } = env;
  const config = paymentConfig({ ...existing, VITE_BAYAR_GG_API_KEY: BAYAR_GG_API_KEY });
  assert.equal(config.key, BAYAR_GG_API_KEY);
  assert.equal(config.secret, env.BAYAR_GG_WEBHOOK_SECRET);
});
test('new server payment key takes priority over the legacy variable', () => {
  assert.equal(paymentConfig({ ...env, VITE_BAYAR_GG_API_KEY: 'old-test-key' }).key, env.BAYAR_GG_API_KEY);
});
test('Vite exposes Firebase client configuration and excludes payment/Admin credentials', async () => {
  const fixture = { VITE_FIREBASE_PROJECT_ID: 'public-test-project', VITE_BAYAR_GG_API_KEY: 'private-test-merchant-key',
    BAYAR_GG_API_KEY: 'private-test-server-key', FIREBASE_PRIVATE_KEY: 'private-test-admin-key' };
  const previous = Object.fromEntries(Object.keys(fixture).map((key) => [key, process.env[key]]));
  Object.assign(process.env, fixture);
  try {
    const config = await resolveConfig({ mode: 'test', logLevel: 'silent' }, 'build');
    assert.equal(config.env.VITE_FIREBASE_PROJECT_ID, fixture.VITE_FIREBASE_PROJECT_ID);
    for (const key of ['VITE_BAYAR_GG_API_KEY', 'BAYAR_GG_API_KEY', 'FIREBASE_PRIVATE_KEY']) assert.equal(config.env[key], undefined);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
