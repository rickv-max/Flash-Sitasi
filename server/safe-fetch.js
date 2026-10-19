import https from 'node:https';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { AppError } from './errors.js';

export function publicURL(input) {
  let url;
  try { url = new URL(input); } catch { throw new AppError(400, 'INVALID_URL', 'Masukkan tautan artikel HTTPS yang valid.'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      hostname === 'localhost' || hostname.endsWith('.localhost') || !hostname.includes('.') && !hostname.includes(':')) {
    throw new AppError(400, 'INVALID_URL', 'Gunakan tautan HTTPS publik ke halaman artikel.');
  }
  if (ipaddr.isValid(hostname) && ipaddr.process(hostname).range() !== 'unicast') {
    throw new AppError(400, 'PRIVATE_URL', 'Tautan ke jaringan lokal tidak didukung.');
  }
  return url;
}

export async function fetchPublicHTML(input, redirects = 0, deadline = Date.now() + 10000) {
  const remaining = deadline - Date.now();
  if (remaining < 100) throw new AppError(504, 'SOURCE_TIMEOUT', 'Penerbit terlalu lama merespons. Silakan gunakan DOI atau coba lagi.');
  const url = publicURL(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  let dnsTimer;
  try {
    addresses = await Promise.race([lookup(hostname, { all: true }), new Promise((_, reject) => {
      dnsTimer = setTimeout(() => reject(new Error('DNS timeout')), Math.min(3000, remaining));
    })]);
  } catch {
    throw new AppError(422, 'SOURCE_UNAVAILABLE', 'Alamat penerbit tidak dapat dihubungi. Coba DOI atau input manual.');
  } finally { clearTimeout(dnsTimer); }
  if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== 'unicast')) {
    throw new AppError(400, 'PRIVATE_URL', 'Tautan ini tidak dapat diakses sebagai sumber publik.');
  }
  const pinned = addresses[0];
  // Pin the validated address in the actual socket lookup, including every redirect.
  const response = await new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: false,
      signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [pinned]);
        else callback(null, pinned.address, pinned.family);
      },
      headers: { 'User-Agent': 'FlashCite/2.2 (academic citation metadata)', Accept: 'text/html', 'Accept-Encoding': 'identity' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve({ redirect: new URL(res.headers.location, url).href });
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new AppError(422, 'SOURCE_UNAVAILABLE', 'Penerbit membatasi akses. Gunakan DOI atau input manual.')); return; }
      if (!String(res.headers['content-type']).includes('html')) {
        res.resume(); reject(new AppError(422, 'PDF_METADATA', 'Gunakan halaman artikel atau DOI. PDF langsung belum selalu memiliki metadata yang dapat dibaca.')); return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) req.destroy(new AppError(422, 'SOURCE_TOO_LARGE', 'Halaman terlalu besar. Coba menggunakan DOI.'));
        else chunks.push(chunk);
      });
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), url: url.href }));
      res.on('error', reject);
    });
    req.setTimeout(8000, () => req.destroy(new AppError(504, 'SOURCE_TIMEOUT', 'Penerbit terlalu lama merespons. Silakan gunakan DOI atau coba lagi.')));
    req.on('error', reject);
  });
  if (response.redirect) {
    if (redirects >= 3) throw new AppError(422, 'TOO_MANY_REDIRECTS', 'Tautan terlalu banyak mengalihkan halaman. Gunakan DOI.');
    return fetchPublicHTML(response.redirect, redirects + 1, deadline);
  }
  return response;
}
