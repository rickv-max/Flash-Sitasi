// One-time read-only deployment audit. Credentials stay inside the Vercel build.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getApp, deleteApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { adminServices } from './server/firebase.js';
import { paymentConfig } from './server/config.js';

const emit = (check, result) => console.log('DEPLOY_AUDIT ' + JSON.stringify({ check, ...result }));
const fail = (error) => ({ checked: false, code: String(error?.code || error?.name || 'FAILED'), ...(error?.providerMessage ? { providerMessage: error.providerMessage } : {}) });
const { auth, db } = adminServices();
const project = db.projectId;
if (project !== process.env.VITE_FIREBASE_PROJECT_ID) {
  emit('project', { match: false });
  throw new Error('FIREBASE_PROJECT_MISMATCH');
}
emit('project', { project, match: true });
try { paymentConfig({ ...process.env, APP_URL: process.env.APP_URL || 'https://flash-sitasi.vercel.app' }); emit('paymentConfig', { configured: true }); } catch (error) { emit('paymentConfig', fail(error)); }
try {
  const config = paymentConfig({ ...process.env, APP_URL: process.env.APP_URL || 'https://flash-sitasi.vercel.app' });
  const response = await fetch('https://www.bayar.gg/api/get-payment-methods.php', {
    headers: { 'X-API-Key': config.key }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  emit('paymentGateway', { checked: true, status: response.status, authenticated: response.ok && body.success === true,
    methods: (body.data?.payment_methods || []).map(({ id, enabled, available }) => ({ id, enabled, available })) });
} catch (error) { emit('paymentGateway', fail(error)); }
const owners = (process.env.ADMIN_OWNER_UIDS || '').split(',').map(x => x.trim()).filter(Boolean);
emit('ownerConfig', { count: owners.length });
for (const uid of owners) {
  try {
    const user = await auth.getUser(uid);
    const profile = await db.doc('users/' + uid).get();
    emit('ownerAccount', { exists: true, enabled: !user.disabled, profileExists: profile.exists,
      role: profile.data()?.role || 'unset', status: profile.data()?.status || 'unset' });
  } catch (error) { emit('ownerAccount', fail(error)); }
}
try {
  const expected = await readFile('firestore.rules', 'utf8');
  const rules = await getSecurityRules().getFirestoreRuleset();
  const content = rules.source.length === 1 ? rules.source[0].content : '';
  const digest = source => createHash('sha256').update(source.replace(/\r\n/g, '\n').trim()).digest('hex');
  emit('firestoreRules', { checked: true, match: digest(expected) === digest(content),
    currentHash: digest(content), expectedHash: digest(expected), release: rules.name });
} catch (error) { emit('firestoreRules', fail(error)); }
const { access_token } = await getApp().options.credential.getAccessToken();
const google = async (url) => {
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + access_token },
    redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) { const error = new Error('GOOGLE_API'); error.code = 'HTTP_' + response.status; const body = await response.json().catch(() => ({})); error.providerMessage = String(body.error?.message || '').slice(0, 600); throw error; }
  return response.json();
};
try {
  const config = await google('https://identitytoolkit.googleapis.com/admin/v2/projects/' + encodeURIComponent(project) + '/config');
  const host = 'flash-sitasi.vercel.app';
  emit('googleLogin', { checked: true, productionDomainAllowed: config.authorizedDomains?.includes(host) || false });
} catch (error) { emit('googleLogin', fail(error)); }
const permissionsResponse = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects/' + encodeURIComponent(project) + ':testIamPermissions', { method: 'POST', headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: ['datastore.indexes.list', 'datastore.indexes.get', 'datastore.indexes.create', 'datastore.indexes.update', 'firebaserules.rulesets.create', 'firebaserules.releases.update'] }), redirect: 'error', signal: AbortSignal.timeout(15000) });
if (permissionsResponse.ok) { const permissions = await permissionsResponse.json(); emit('deploymentPermissions', { permissions: permissions.permissions || [] }); } else { emit('deploymentPermissions', { checked: false, status: permissionsResponse.status }); }
const schema = JSON.parse(await readFile('firestore.indexes.json', 'utf8'));
const canonical = item => JSON.stringify({ queryScope: item.queryScope,
  fields: item.fields.filter(x => x.fieldPath !== '__name__').map(({ fieldPath, order, arrayConfig }) => ({ fieldPath, ...(order ? { order } : { arrayConfig }) })) });
const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/databases/(default)/collectionGroups/';
for (const collection of [...new Set(schema.indexes.map(x => x.collectionGroup))]) {
  try {
    const indexes = [];
    let nextPageToken;
    do {
      const url = new URL(base + encodeURIComponent(collection) + '/indexes');
      if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);
      const page = await google(url);
      indexes.push(...(page.indexes || [])); nextPageToken = page.nextPageToken;
    } while (nextPageToken);
    const expected = schema.indexes.filter(x => x.collectionGroup === collection);
    const ready = expected.filter(x => indexes.some(y => canonical(x) === canonical(y) && y.state === 'READY')).length;
    const pending = expected.filter(x => indexes.some(y => canonical(x) === canonical(y) && y.state !== 'READY')).length;
    emit('compositeIndexes', { checked: true, collection, required: expected.length, ready, pending, missing: expected.length - ready - pending });
  } catch (error) { emit('compositeIndexes', { collection, ...fail(error) }); }
}
for (const expected of schema.fieldOverrides) {
  try {
    const field = await google(base + encodeURIComponent(expected.collectionGroup) + '/fields/' + encodeURIComponent(expected.fieldPath));
    const current = field.indexConfig?.indexes || [];
    const ready = expected.indexes.filter(index => current.some(x => x.queryScope === index.queryScope && x.state === 'READY' &&
      x.fields.some(y => y.fieldPath === expected.fieldPath && y.order === index.order))).length;
    emit('fieldOverride', { checked: true, collection: expected.collectionGroup, field: expected.fieldPath,
      required: expected.indexes.length, ready, ttlRequired: !!expected.ttl, ttlState: field.ttlConfig?.state || 'UNSET' });
  } catch (error) { emit('fieldOverride', { collection: expected.collectionGroup, ...fail(error) }); }
}
await deleteApp(getApp());
