import { AppError } from './errors.js';
import { appURL } from './config.js';

export async function rawBodyOf(req, maxLength = 16000) {
  // Read the stream before Vercel's lazy req.body helper parses/reformats JSON.
  let raw = req.rawBody;
  if (raw === undefined && req[Symbol.asyncIterator] && !req.readableEnded) {
    const chunks = []; let length = 0;
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk); length += buffer.length;
      if (length > maxLength) throw new AppError(413, 'TOO_LARGE', 'Notifikasi terlalu panjang.');
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks);
  }
  if (raw === undefined && (typeof req.body === 'string' || Buffer.isBuffer(req.body))) raw = req.body;
  if (typeof raw === 'string') raw = Buffer.from(raw);
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > maxLength) throw new AppError(400, 'INVALID_BODY', 'Isi notifikasi asli belum tersedia.');
  return raw;
}

export function bodyOf(req, maxLength = 16000) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { throw new AppError(400, 'INVALID_JSON', 'Format permintaan belum valid.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > maxLength) throw new AppError(400, 'INVALID_BODY', 'Permintaan tidak valid atau terlalu panjang.');
  return body;
}
export function requestKey(req) {
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new AppError(400, 'REQUEST_KEY_REQUIRED', 'Identitas permintaan belum valid. Muat ulang halaman dan coba lagi.');
  return key;
}
export function checkOrigin(req, env) {
  if (req.headers.origin && env.APP_URL && req.headers.origin !== appURL(env)) throw new AppError(403, 'ORIGIN_DENIED', 'Asal permintaan tidak diizinkan.');
}
export function queryOf(req) { return req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams); }
export function noCache(res) { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); }
