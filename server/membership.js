import { createHash } from 'node:crypto';
import { membershipTier } from '../shared/membership.js';
export const publicMemberId = (uid) => createHash('sha256').update('member:' + uid).digest('hex').slice(0, 24);
export function safeAvatar(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && url.hostname.endsWith('.googleusercontent.com')) return url.href; } catch { /* Use initials when no verified provider image is available. */ }
  return '';
}
export function publicMember(profile, id) {
  const tier = membershipTier(profile.membershipTier);
  if (!profile.publicProfile?.visible || tier.rank === 0 || profile.status === 'blocked' || profile.archived) return null;
  return { publicId: id, name: String(profile.publicProfile.name || 'Anggota Flash Sitasi').slice(0, 50),
    bio: String(profile.publicProfile.bio || '').slice(0, 160), tier: tier.id, tierRank: tier.rank,
    photoURL: profile.publicProfile.showPhoto ? safeAvatar(profile.photoURL) : '' };
}
export function writePublicMember(tx, db, uid, profile) {
  const id = publicMemberId(uid), record = publicMember(profile, id), ref = db.doc('publicMembers/' + id);
  if (record) tx.set(ref, record); else tx.delete(ref);
}
