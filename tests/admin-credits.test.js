import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../server/repository.js';
import { makeHandler } from '../server/handlers.js';
import { DEMO_METADATA } from '../shared/citations.js';
import { hasUnlimitedCredits, canGenerateWithCredits } from '../shared/credits.js';
import { AppError } from '../server/errors.js';
import { MemoryFirestore, call, env, user } from './helpers.js';

const request = { mode: 'doi', input: '10.1038/nature14539' };
async function setup(credits = 0, patch = {}) {
  const db = new MemoryFirestore(), repo = createRepository(db);
  await repo.ensureProfile(user);
  await db.doc('users/' + user.uid).update({ role: 'admin', credits, ...patch });
  const overrides = { env, repo, authenticate: async () => user, resolveMetadata: async () => DEMO_METADATA };
  const profile = () => db.records.get('users/' + user.uid);
  const history = () => [...db.records.entries()].filter(([path]) => path.includes('/history/'));
  const ledger = () => [...db.records.entries()].filter(([path]) => path.includes('/creditLedger/'));
  return { db, repo, overrides, profile, history, ledger, handler: makeHandler('citations', overrides) };
}

test('unlimited credit access requires an active admin role and is independent of membership', () => {
  assert.equal(hasUnlimitedCredits({ role: 'admin', credits: 0, membershipTier: 'regular' }), true);
  for (const profile of [undefined, { role: 'user', membershipTier: 'sultan', credits: 0 }, { role: 'admin', status: 'blocked', credits: 50 }, { role: 'admin', archived: true, credits: 50 }]) {
    assert.equal(hasUnlimitedCredits(profile), false);
    assert.equal(canGenerateWithCredits(profile), false);
  }
  assert.equal(canGenerateWithCredits({ role: 'user', credits: 1 }), true);
  for (const credits of [NaN, Infinity, -1, '10', 0.5]) assert.equal(canGenerateWithCredits({ role: 'user', credits }), false);
});

test('admins with zero credits can generate DOI, URL and manual citations without a deduction', async () => {
  const { handler, profile, history, ledger } = await setup();
  for (const [index, mode] of ['doi', 'url', 'manual'].entries()) {
    const response = await call(handler, { body: { mode, input: mode === 'manual' ? { title: 'Referensi' } : mode === 'url' ? 'https://example.org/article' : request.input }, customHeaders: { 'idempotency-key': 'admin-free-request-000' + index } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.creditsSpent, 0);
    assert.equal(response.body.data.unlimitedCredits, true);
    assert.equal(profile().credits, 0);
  }
  assert.equal(history().length, 3);
  assert.equal(ledger().length, 3);
  for (const [, entry] of ledger()) {
    assert.equal(entry.credits, 0);
    assert.equal(entry.balanceAfter, 0);
    assert.equal(entry.unlimitedCredits, true);
  }
  assert.ok(!JSON.stringify([...history(), ...ledger()]).includes('Infinity'));
});

test('admin generation preserves the stored balance and duplicate concurrent requests write once', async () => {
  const { handler, profile, history, ledger } = await setup(27);
  const results = await Promise.all([call(handler, { body: request }), call(handler, { body: request })]);
  assert.ok(results.every((result) => result.statusCode === 200));
  assert.equal(profile().credits, 27);
  assert.equal(history().length, 1);
  assert.equal(ledger().length, 1);
  assert.equal(ledger()[0][1].balanceAfter, 27);
});

test('Sultan membership and forged client role flags cannot bypass the credit balance', async () => {
  const { overrides, history, profile } = await setup(0, { role: 'user', membershipTier: 'sultan' });
  let lookups = 0;
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => { lookups++; return DEMO_METADATA; } });
  const response = await call(handler, { body: { ...request, role: 'admin', unlimitedCredits: true, credits: 999999 } });
  assert.equal(response.statusCode, 402);
  assert.equal(lookups, 0);
  assert.equal(history().length, 0);
  assert.equal(profile().role, 'user');
});

test('revoking an admin role during metadata lookup denies a zero-balance save atomically', async () => {
  const { db, overrides, history, ledger, profile } = await setup();
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => {
    await db.doc('users/' + user.uid).update({ role: 'user' });
    return DEMO_METADATA;
  } });
  const response = await call(handler, { body: request });
  assert.equal(response.statusCode, 402);
  assert.equal(profile().credits, 0);
  assert.equal(history().length, 0);
  assert.equal(ledger().length, 0);
});

test('a demoted admin immediately uses the finite stored balance', async () => {
  const { db, overrides, profile, ledger } = await setup(1);
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => {
    await db.doc('users/' + user.uid).update({ role: 'user' });
    return DEMO_METADATA;
  } });
  const response = await call(handler, { body: request });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.creditsSpent, 1);
  assert.equal(response.body.data.unlimitedCredits, false);
  assert.equal(profile().credits, 0);
  assert.equal(ledger()[0][1].credits, -1);
  const next = await call(handler, { body: request, customHeaders: { 'idempotency-key': 'admin-demotion-next-002' } });
  assert.equal(next.statusCode, 402);
});

test('a promotion during metadata lookup grants unlimited access from the current transaction role', async () => {
  const { db, overrides, profile } = await setup(1, { role: 'user' });
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => {
    await db.doc('users/' + user.uid).update({ role: 'admin' });
    return DEMO_METADATA;
  } });
  const response = await call(handler, { body: request });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.creditsSpent, 0);
  assert.equal(profile().credits, 1);
});

test('blocked and archived admins cannot generate even with unlimited credit access', async () => {
  for (const patch of [{ status: 'blocked' }, { archived: true }]) {
    const { handler, history, ledger } = await setup(100, patch);
    assert.equal((await call(handler, { body: request })).statusCode, 403);
    assert.equal(history().length, 0);
    assert.equal(ledger().length, 0);
  }
});

test('blocking an admin during metadata lookup also prevents the final transaction', async () => {
  const { db, overrides, history, ledger } = await setup(10);
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => {
    await db.doc('users/' + user.uid).update({ status: 'blocked' });
    return DEMO_METADATA;
  } });
  assert.equal((await call(handler, { body: request })).statusCode, 403);
  assert.equal(history().length, 0);
  assert.equal(ledger().length, 0);
});

test('failed admin metadata lookup creates neither history nor ledger entries', async () => {
  const { overrides, profile, history, ledger } = await setup(12);
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => { throw new AppError(422, 'NOT_FOUND', 'Referensi tidak ditemukan'); } });
  assert.equal((await call(handler, { body: request })).statusCode, 422);
  assert.equal(profile().credits, 12);
  assert.equal(history().length, 0);
  assert.equal(ledger().length, 0);
});
