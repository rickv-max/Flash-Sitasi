import { AppError } from './errors.js';

export function validUID(uid) {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[\s/\\]/u.test(uid) && ![...uid].some((char) => char.codePointAt(0) < 32) && !['.', '..'].includes(uid);
}
export function ownerUIDs(env = process.env) {
  return (env.ADMIN_OWNER_UIDS || '').split(',').map((id) => id.trim()).filter(validUID);
}
export const isOwner = (uid, env = process.env) => ownerUIDs(env).includes(uid);
export function assertActive(profile) {
  if (profile?.status === 'blocked' || profile?.archived) throw new AppError(403, 'ACCOUNT_BLOCKED', 'Akun dinonaktifkan oleh admin. Hubungi pengelola aplikasi.');
}
export function assertSession(user, profile) {
  if (profile?.sessionRevokedAt && (!user.auth_time || user.auth_time <= profile.sessionRevokedAt / 1000)) throw new AppError(401, 'SESSION_REVOKED', 'Sesi dicabut oleh admin. Keluar lalu masuk kembali.');
}
export function assertAdmin(profile) {
  assertActive(profile);
  if (profile?.role !== 'admin') throw new AppError(403, 'ADMIN_REQUIRED', 'Akses ini hanya tersedia untuk admin.');
}
export function protectAdminTarget(actor, targetUID, env = process.env) {
  if (!validUID(targetUID)) throw new AppError(400, 'INVALID_UID', 'UID pengguna tidak valid.');
  if (targetUID === actor.uid) throw new AppError(403, 'SELF_PROTECTED', 'Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.');
  if (isOwner(targetUID, env)) throw new AppError(403, 'OWNER_PROTECTED', 'Akun pemilik utama dilindungi oleh konfigurasi server.');
}
export function allowOperation(settings, profile, type) {
  if (profile?.role === 'admin') return;
  if (settings.maintenance) throw new AppError(503, 'MAINTENANCE', settings.maintenanceMessage);
  if (type === 'payment' && !settings.paymentEnabled) throw new AppError(503, 'PAYMENTS_PAUSED', 'Top up sedang dinonaktifkan pengelola.');
}
