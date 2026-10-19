import { existsSync } from 'node:fs';
import { FieldPath } from 'firebase-admin/firestore';
import { adminServices } from '../server/firebase.js';
import { isOwner } from '../server/access.js';

// Idempotent backfill for pre-admin profiles. Read-only unless --apply is explicit.
if (existsSync('.env')) process.loadEnvFile('.env');
const apply = process.argv.includes('--apply');
const { db } = adminServices();
if (process.env.VITE_FIREBASE_PROJECT_ID && db.projectId !== process.env.VITE_FIREBASE_PROJECT_ID) throw new Error('Project server dan client berbeda. Periksa .env sebelum migrasi.');
let cursor = null, scanned = 0, changed = 0;
for (;;) {
  let query = db.collection('users').orderBy(FieldPath.documentId()).limit(200);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (!page.docs.length) break;
  const batch = db.batch();
  for (const document of page.docs) {
    scanned++;
    const value = document.data(); const patch = {};
    if (value.emailLower === undefined) patch.emailLower = String(value.email || '').toLowerCase();
    if (value.nameLower === undefined) patch.nameLower = String(value.name || '').toLowerCase();
    if (!value.role || isOwner(document.id)) patch.role = isOwner(document.id) ? 'admin' : 'user';
    if (!value.status || isOwner(document.id)) patch.status = 'active';
    if (typeof value.createdAt !== 'number') {
      const time = value.createdAt?.toMillis?.() || (value.createdAt ? Date.parse(value.createdAt) : 0);
      patch.createdAt = Number.isFinite(time) ? time : 0;
    }
    if (value.lastSeenAt === undefined) patch.lastSeenAt = 0;
    if (Object.keys(patch).some((key) => patch[key] !== value[key])) { changed++; if (apply) batch.update(document.ref, patch); }
  }
  if (apply) await batch.commit();
  cursor = page.docs.at(-1);
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', scanned, changed, note: 'Saldo kredit dan riwayat tidak diubah.' }));
