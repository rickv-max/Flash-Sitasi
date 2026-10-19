// Explicit, one-time setup for the existing Flash Sitasi project. Not an app endpoint.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { getApp, deleteApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { adminServices } from './server/firebase.js';

const emit = (step, result) => console.log('DEPLOY_SETUP ' + JSON.stringify({ step, ...result }));
if (!process.argv.includes('--apply')) throw new Error('EXPLICIT_APPLY_REQUIRED');
const { auth, db } = adminServices();
const project = db.projectId;
if (project !== 'flash-sitasi' || process.env.VITE_FIREBASE_PROJECT_ID !== project) throw new Error('FIREBASE_PROJECT_MISMATCH');
const owners = (process.env.ADMIN_OWNER_UIDS || '').split(',').map(x => x.trim()).filter(Boolean);
if (!owners.length) throw new Error('OWNER_REQUIRED');
for (const uid of owners) if ((await auth.getUser(uid)).disabled) throw new Error('OWNER_DISABLED');
const token = await getApp().options.credential.getAccessToken();
const api = async (url, options = {}) => {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error('SETUP_GOOGLE_API'); error.code = 'HTTP_' + response.status;
    error.providerMessage = String(body.error?.message || '').slice(0, 500); throw error; }
  return body;
};
const requiredPermissions = ['datastore.indexes.list', 'datastore.indexes.create', 'datastore.indexes.update',
  'firebaserules.rulesets.create', 'firebaserules.releases.update'];
const permissionResult = await api('https://cloudresourcemanager.googleapis.com/v1/projects/' + project + ':testIamPermissions',
  { method: 'POST', body: JSON.stringify({ permissions: requiredPermissions }) });
const missingPermissions = requiredPermissions.filter(x => !permissionResult.permissions?.includes(x));
if (missingPermissions.length) { emit('permissions', { ready: false, missingPermissions }); throw new Error('SETUP_PERMISSIONS_MISSING'); }
const source = await readFile('firestore.rules', 'utf8');
const digest = value => createHash('sha256').update(value.replace(/\r\n/g, '\n').trim()).digest('hex');
const rulesService = getSecurityRules();
const currentRules = await rulesService.getFirestoreRuleset();
const currentSource = currentRules.source.length === 1 ? currentRules.source[0].content : '';
const currentHash = digest(currentSource);
const expectedHash = digest(source);
const knownPriorHash = 'd4f052a0d37844a432ccb00af0bf67725bce8d4d91f831fbeb5827ac5f0cfa9e';
if (![knownPriorHash, expectedHash].includes(currentHash)) throw new Error('UNEXPECTED_FIRESTORE_RULES_REVIEW_REQUIRED');
const schema = JSON.parse(await readFile('firestore.indexes.json', 'utf8'));
const base = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/collectionGroups/';
const canonical = item => JSON.stringify({ queryScope: item.queryScope,
  fields: item.fields.filter(x => x.fieldPath !== '__name__').map(({ fieldPath, order, arrayConfig }) => ({ fieldPath, ...(order ? { order } : { arrayConfig }) })) });
const collections = [...new Set(schema.indexes.map(x => x.collectionGroup))];
const listIndexes = async collection => {
  const indexes = []; let pageToken;
  do {
    const url = new URL(base + encodeURIComponent(collection) + '/indexes');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await api(url); indexes.push(...(page.indexes || [])); pageToken = page.nextPageToken;
  } while (pageToken);
  return indexes;
};
let created = 0;
for (const collection of collections) {
  const current = await listIndexes(collection);
  for (const expected of schema.indexes.filter(x => x.collectionGroup === collection)) {
    if (current.some(x => canonical(x) === canonical(expected))) continue;
    const operation = await api(base + encodeURIComponent(collection) + '/indexes', { method: 'POST',
      body: JSON.stringify({ queryScope: expected.queryScope, fields: expected.fields }) });
    created++; emit('indexCreated', { collection, operation: operation.name });
  }
}
emit('indexes', { created, required: schema.indexes.length });
for (const expected of schema.fieldOverrides) {
  const url = base + encodeURIComponent(expected.collectionGroup) + '/fields/' + encodeURIComponent(expected.fieldPath);
  const current = await api(url);
  const currentIndexes = current.indexConfig?.indexes || [];
  if (expected.indexes.length && !expected.indexes.every(index => currentIndexes.some(x => x.queryScope === index.queryScope &&
    x.fields.some(y => y.fieldPath === expected.fieldPath && y.order === index.order)))) {
    const operation = await api(url + '?updateMask=indexConfig', { method: 'PATCH', body: JSON.stringify({
      indexConfig: { indexes: expected.indexes.map(x => ({ queryScope: x.queryScope, fields: [{ fieldPath: expected.fieldPath, order: x.order }] })) } }) });
    emit('fieldIndexCreated', { collection: expected.collectionGroup, field: expected.fieldPath, operation: operation.name });
  }
  if (expected.ttl && !current.ttlConfig) {
    try {
      const operation = await api(url + '?updateMask=ttlConfig', { method: 'PATCH', body: JSON.stringify({ ttlConfig: {} }) });
      emit('ttlRequested', { collection: expected.collectionGroup, operation: operation.name });
    } catch (error) { emit('ttlUnavailable', { collection: expected.collectionGroup, code: error.code,
      providerMessage: error.providerMessage }); }
  }
}
let ready = false;
const deadline = Date.now() + 8 * 60 * 1000;
while (Date.now() < deadline) {
  let compositesReady = 0;
  for (const collection of collections) {
    const indexes = await listIndexes(collection);
    for (const expected of schema.indexes.filter(x => x.collectionGroup === collection)) {
      const match = indexes.find(x => canonical(x) === canonical(expected));
      if (match?.state === 'NEEDS_REPAIR') throw new Error('FIRESTORE_INDEX_NEEDS_REPAIR');
      if (match?.state === 'READY') compositesReady++;
    }
  }
  let fieldsReady = true;
  for (const expected of schema.fieldOverrides.filter(x => x.indexes.length)) {
    const field = await api(base + encodeURIComponent(expected.collectionGroup) + '/fields/' + encodeURIComponent(expected.fieldPath));
    if (!expected.indexes.every(index => field.indexConfig?.indexes?.some(x => x.queryScope === index.queryScope && x.state === 'READY' &&
      x.fields.some(y => y.fieldPath === expected.fieldPath && y.order === index.order)))) fieldsReady = false;
  }
  emit('indexReadiness', { ready: compositesReady, required: schema.indexes.length, fieldIndexesReady: fieldsReady });
  if (compositesReady === schema.indexes.length && fieldsReady) { ready = true; break; }
  await delay(15000);
}
if (!ready) throw new Error('INDEXES_STILL_BUILDING_RETRY_SETUP');
if (currentHash !== expectedHash) {
  const rules = await rulesService.releaseFirestoreRulesetFromSource(source);
  emit('rulesReleased', { previousRelease: currentRules.name, release: rules.name, sha256: expectedHash });
} else { emit('rulesReleased', { unchanged: true, sha256: expectedHash }); }
await import('./scripts/migrate-users.js');
for (const uid of owners) {
  const owner = await db.doc('users/' + uid).get();
  if (!owner.exists || owner.data().role !== 'admin' || owner.data().status !== 'active') throw new Error('OWNER_MIGRATION_FAILED');
}
emit('complete', { project, ownerCount: owners.length, rulesHash: expectedHash });
await deleteApp(getApp());
