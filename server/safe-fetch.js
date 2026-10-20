import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import { AppError } from './errors.js';

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export function publicURL(input) {
  let url;
  try { url = new URL(input); } catch { throw new AppError(400, 'INVALID_URL', 'Masukkan tautan artikel atau PDF publik yang valid.'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      hostname === 'localhost' || hostname.endsWith('.localhost') || !hostname.includes('.') && !hostname.includes(':')) {
    throw new AppError(400, 'INVALID_URL', 'Gunakan tautan HTTPS publik ke halaman artikel atau PDF.');
  }
  if (ipaddr.isValid(hostname) && ipaddr.process(hostname).range() !== 'unicast') {
    throw new AppError(400, 'PRIVATE_URL', 'Tautan ke jaringan lokal tidak didukung.');
  }
  return url;
}
export function normalizeSourceURL(input) {
  let url;
  try { url = new URL(String(input).trim()); } catch { return publicURL(input); }
  if (url.protocol === 'http:') url.protocol = 'https:';
  url.hash = '';
  return publicURL(url.href);
}
const timeoutError = () => new AppError(504, 'SOURCE_TIMEOUT', 'Sumber terlalu lama merespons. Coba lagi, gunakan DOI, atau lengkapi melalui input manual.');
const unavailableError = () => new AppError(422, 'SOURCE_UNAVAILABLE', 'Sumber membatasi akses atau tidak dapat dihubungi. Gunakan tautan publik, DOI, atau input manual.');
const tooLargeError = () => new AppError(422, 'SOURCE_TOO_LARGE', 'Sumber terlalu besar. Batas PDF 10 MB dan halaman web 2 MB. Coba halaman artikel atau DOI.');
export function decodeHTML(data, contentType = '') {
  const prefix = data.subarray(0, 4096).toString('latin1');
  const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] || prefix.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8';
  try { return new TextDecoder(charset).decode(data); } catch { return data.toString('utf8'); }
}
export function identifySource(data, contentType = '', allowPDF = true) {
  const prefix = data.subarray(0, 1024).toString('latin1');
  if (prefix.includes('%PDF-')) {
    if (!allowPDF) throw new AppError(422, 'PDF_METADATA', 'Sumber ini adalah PDF, bukan halaman artikel.');
    return 'pdf';
  }
  if (/pdf/i.test(contentType)) throw new AppError(422, 'INVALID_PDF', 'Tautan PDF tidak berisi file PDF yang dapat dibaca. Coba halaman artikel atau DOI.');
  if (/html/i.test(contentType) || /^\s*(?:<!doctype\s+html|<html\b|<head\b|<meta\b|<title\b)/i.test(prefix)) return 'html';
  throw new AppError(422, 'SOURCE_UNSUPPORTED', 'Tautan harus menuju halaman artikel atau PDF publik, bukan gambar, arsip, atau file lain.');
}
export function createPublicFetcher({ resolveDNS = lookup, request = https.get } = {}) {
  async function fetchSource(input, { redirects = 0, deadline = Date.now() + 12000, allowPDF = true } = {}) {
    const remaining = deadline - Date.now();
    if (remaining < 100) throw timeoutError();
    const url = publicURL(input), hostname = url.hostname.replace(/^\[|\]$/g, '');
    let addresses, dnsTimer;
    try {
      addresses = await Promise.race([resolveDNS(hostname, { all: true }), new Promise((_, reject) => {
        dnsTimer = setTimeout(() => reject(timeoutError()), Math.min(3000, remaining));
      })]);
    } catch (error) {
      throw error instanceof AppError ? error : unavailableError();
    } finally { clearTimeout(dnsTimer); }
    if (!addresses.length || addresses.some(({ address }) => !ipaddr.isValid(address) || ipaddr.process(address).range() !== 'unicast')) {
      throw new AppError(400, 'PRIVATE_URL', 'Tautan ini tidak dapat diakses sebagai sumber publik.');
    }
    const pinned = addresses[0];
    const response = await new Promise((resolve, reject) => {
      const req = request(url, {
        agent: false, signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
        headers: { 'User-Agent': 'FlashCite/2.2 (academic citation metadata)', Accept: allowPDF ? 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.1' : 'text/html,application/xhtml+xml', 'Accept-Encoding': 'gzip, deflate, br' },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.destroy();
          try { resolve({ redirect: new URL(res.headers.location, url).href }); } catch { reject(unavailableError()); }
          return;
        }
        if (res.statusCode !== 200) { res.destroy(); reject(unavailableError()); return; }
        const contentType = String(res.headers['content-type'] || '').toLowerCase();
        if (!allowPDF && /pdf/i.test(contentType)) { res.destroy(); reject(new AppError(422, 'PDF_METADATA', 'Sumber ini adalah PDF, bukan halaman artikel.')); return; }
        const limit = !allowPDF || /html/.test(contentType) ? MAX_HTML_BYTES : MAX_PDF_BYTES;
        if (Number(res.headers['content-length']) > limit) { res.destroy(); reject(tooLargeError()); return; }
        const encoding = String(res.headers['content-encoding'] || 'identity').toLowerCase();
        const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : null;
        if (!decoder && encoding !== 'identity') { res.destroy(); reject(unavailableError()); return; }
        const stream = decoder || res, chunks = [];
        let size = 0, wireSize = 0;
        const fail = (error) => { reject(error); req.destroy(error); decoder?.destroy(); res.destroy(); };
        res.on('error', reject); res.on('aborted', () => reject(unavailableError()));
        res.on('data', (chunk) => { wireSize += chunk.length; if (wireSize > MAX_PDF_BYTES) fail(tooLargeError()); });
        stream.on('data', (chunk) => {
          size += chunk.length;
          if (size > limit) fail(tooLargeError());
          else chunks.push(chunk);
        });
        stream.on('error', reject);
        stream.on('end', () => {
          try {
            const data = Buffer.concat(chunks), type = identifySource(data, contentType, allowPDF);
            if (type === 'html' && data.length > MAX_HTML_BYTES) throw tooLargeError();
            resolve(type === 'pdf' ? { type, data, url: url.href, contentType } : { type, html: decodeHTML(data, contentType), url: url.href, contentType });
          } catch (error) { reject(error); }
        });
        if (decoder) res.pipe(decoder);
      });
      req.setTimeout(Math.min(10000, Math.max(1, deadline - Date.now())), () => req.destroy(timeoutError()));
      req.on('error', (error) => reject(error instanceof AppError ? error : error?.name === 'AbortError' || error?.code === 'ABORT_ERR' ? timeoutError() : unavailableError()));
    }).catch((error) => { throw error instanceof AppError ? error : unavailableError(); });
    if (response.redirect) {
      if (redirects >= 4) throw new AppError(422, 'TOO_MANY_REDIRECTS', 'Tautan terlalu banyak mengalihkan halaman. Gunakan halaman artikel atau DOI.');
      return fetchSource(response.redirect, { redirects: redirects + 1, deadline, allowPDF });
    }
    return response;
  }
  return fetchSource;
}
export const fetchPublicSource = createPublicFetcher();
export async function fetchPublicHTML(input, redirects = 0, deadline = Date.now() + 10000) {
  return fetchPublicSource(input, { redirects, deadline, allowPDF: false });
}
