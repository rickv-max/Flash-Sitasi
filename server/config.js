import { AppError } from './errors.js';

export function paymentProvider(env = process.env) {
  const provider = env.PAYMENT_PROVIDER || 'doku';
  if (!['doku', 'bayar_gg'].includes(provider)) throw new AppError(503, 'PAYMENT_CONFIG', 'Konfigurasi pembayaran perlu diperiksa pengelola.');
  return provider;
}

export function dokuConfig(env = process.env, requireOrigin = true) {
  const clientId = env.DOKU_CLIENT_ID?.trim(), secret = env.DOKU_SECRET_KEY?.trim();
  const environment = env.DOKU_ENVIRONMENT || 'production';
  if (!clientId || !/^[A-Za-z0-9_-]{1,128}$/.test(clientId) || !secret || !['production', 'sandbox'].includes(environment)) {
    throw new AppError(503, 'PAYMENT_CONFIG', 'Pembayaran DOKU sedang disiapkan. Silakan coba kembali nanti.');
  }
  return { clientId, secret, environment, ...(requireOrigin ? { origin: appURL(env) } : {}) };
}

export function paymentMethodsConfig(env = process.env) {
  const key = env.BAYAR_GG_API_KEY || env.VITE_BAYAR_GG_API_KEY;
  if (!key) throw new AppError(503, 'PAYMENT_CONFIG', 'Pembayaran belum tersedia. Silakan coba kembali nanti.');
  return { key, method: env.BAYAR_GG_PAYMENT_METHOD || '' };
}

export function appURL(env = process.env) {
  try {
    const url = new URL(env.APP_URL);
    if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.hostname === 'localhost')) throw new Error();
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch {
    throw new AppError(503, 'APP_CONFIG', 'Layanan pembayaran belum siap. Hubungi pengelola aplikasi.');
  }
}

export function paymentConfig(env = process.env) {
  // Legacy Vercel Sensitive variables cannot be renamed without re-entering
  // their value. Keep that existing key server-only during migration.
  const key = env.BAYAR_GG_API_KEY || env.VITE_BAYAR_GG_API_KEY;
  if (!key || !env.BAYAR_GG_WEBHOOK_SECRET) {
    throw new AppError(503, 'PAYMENT_CONFIG', 'Pembayaran belum tersedia. Silakan coba kembali nanti.');
  }
  const origin = appURL(env);
  const checkout = env.BAYAR_GG_CHECKOUT_URL || 'https://www.bayar.gg/pay';
  try {
    const url = new URL(checkout);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    throw new AppError(503, 'PAYMENT_CONFIG', 'Konfigurasi halaman pembayaran perlu diperiksa pengelola.');
  }
  return { key, secret: env.BAYAR_GG_WEBHOOK_SECRET,
    method: env.BAYAR_GG_PAYMENT_METHOD || '', checkout, origin };
}
