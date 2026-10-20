import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createPublicFetcher, identifySource, decodeHTML, MAX_HTML_BYTES, MAX_PDF_BYTES } from '../server/safe-fetch.js';
import { articlePDF } from './metadata-fixtures.js';

function transport(routes, addresses = () => [{ address: '93.184.216.34', family: 4 }]) {
  const requests = [], pins = [], hosts = [];
  const fetcher = createPublicFetcher({
    resolveDNS: async (host) => { hosts.push(host); return addresses(host); },
    request: (url, options, callback) => {
      const req = new EventEmitter();
      req.setTimeout = () => req;
      req.destroy = (error) => { if (error) queueMicrotask(() => req.emit('error', error)); return req; };
      requests.push(url.href);
      options.lookup(url.hostname, { all: true }, (_error, values) => pins.push(values));
      queueMicrotask(() => {
        const route = routes[url.href] || {};
        const res = Readable.from(route.chunks || [route.data || Buffer.from('<html><title>Article</title></html>')]);
        res.statusCode = route.status || 200; res.headers = route.headers || { 'content-type': 'text/html' };
        callback(res);
      });
      return req;
    },
  });
  return { fetcher, requests, pins, hosts };
}
test('source fetcher pins only a validated public DNS address to the actual request', async () => {
  const { fetcher, requests, pins } = transport({});
  const result = await fetcher('https://journal.example/article');
  assert.equal(result.type, 'html'); assert.match(result.html, /Article/);
  assert.deepEqual(requests, ['https://journal.example/article']);
  assert.deepEqual(pins, [[{ address: '93.184.216.34', family: 4 }]]);
});
test('direct PDFs are fetched by signature even when a server returns a generic binary MIME type', async () => {
  const data = articlePDF();
  const { fetcher } = transport({ 'https://journal.example/download': { data, headers: { 'content-type': 'application/octet-stream' } } });
  const result = await fetcher('https://journal.example/download');
  assert.equal(result.type, 'pdf'); assert.deepEqual(result.data, data);
});
test('HTML-only callers cannot accidentally download and parse a PDF as a contact page', async () => {
  const { fetcher } = transport({ 'https://journal.example/paper.pdf': { data: articlePDF(), headers: { 'content-type': 'application/pdf' } } });
  await assert.rejects(fetcher('https://journal.example/paper.pdf', { allowPDF: false }), { code: 'PDF_METADATA' });
});
test('gzip and Brotli pages are decoded before enforcing the HTML content boundary', async () => {
  for (const [encoding, encode] of [['gzip', gzipSync], ['br', brotliCompressSync]]) {
    const { fetcher } = transport({ 'https://journal.example/article': { data: encode(Buffer.from('<html><title>Riset eDNA</title></html>')), headers: { 'content-type': 'text/html', 'content-encoding': encoding } } });
    assert.match((await fetcher('https://journal.example/article')).html, /Riset eDNA/);
  }
});
test('compressed responses are still bounded by decoded size', async () => {
  const { fetcher } = transport({ 'https://journal.example/large': { data: gzipSync(Buffer.alloc(MAX_HTML_BYTES + 1, 'x')), headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } } });
  await assert.rejects(fetcher('https://journal.example/large'), { code: 'SOURCE_TOO_LARGE' });
});
test('a declared oversized PDF is refused without buffering it', async () => {
  const { fetcher } = transport({ 'https://journal.example/large.pdf': { data: Buffer.from('%PDF-1.7'), headers: { 'content-type': 'application/pdf', 'content-length': String(MAX_PDF_BYTES + 1) } } });
  await assert.rejects(fetcher('https://journal.example/large.pdf'), { code: 'SOURCE_TOO_LARGE' });
});
test('every redirect is DNS-validated and pinned again', async () => {
  const { fetcher, requests, hosts } = transport({ 'https://journal.example/start': { status: 302, headers: { location: 'https://cdn.example/paper.pdf' } }, 'https://cdn.example/paper.pdf': { data: articlePDF(), headers: { 'content-type': 'application/pdf' } } });
  assert.equal((await fetcher('https://journal.example/start')).type, 'pdf');
  assert.deepEqual(hosts, ['journal.example', 'cdn.example']); assert.equal(requests.length, 2);
});
test('redirects into private networks are rejected before opening the second connection', async () => {
  const { fetcher, requests } = transport({ 'https://journal.example/start': { status: 302, headers: { location: 'https://hidden.example/private.pdf' } } },
    (host) => [{ address: host === 'hidden.example' ? '127.0.0.1' : '93.184.216.34', family: 4 }]);
  await assert.rejects(fetcher('https://journal.example/start'), { code: 'PRIVATE_URL' });
  assert.equal(requests.length, 1);
});
test('mixed public/private DNS answers fail closed and do not contact the source', async () => {
  const { fetcher, requests } = transport({}, () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]);
  await assert.rejects(fetcher('https://journal.example/article'), { code: 'PRIVATE_URL' });
  assert.equal(requests.length, 0);
});
test('insecure and credentialed redirect destinations are refused', async () => {
  for (const location of ['http://journal.example/file.pdf', 'https://user:password@journal.example/file.pdf', 'https://[::ffff:127.0.0.1]/file.pdf']) {
    const { fetcher, requests } = transport({ 'https://journal.example/start': { status: 302, headers: { location } } });
    await assert.rejects(fetcher('https://journal.example/start'));
    assert.equal(requests.length, 1);
  }
});
test('redirect loops stop within the total request budget', async () => {
  const { fetcher, requests } = transport({ 'https://journal.example/a': { status: 302, headers: { location: '/b' } }, 'https://journal.example/b': { status: 302, headers: { location: '/a' } } });
  await assert.rejects(fetcher('https://journal.example/a'), { code: 'TOO_MANY_REDIRECTS' });
  assert.equal(requests.length, 5);
});
test('a deadline that has expired never starts DNS or a network request', async () => {
  const { fetcher, requests, hosts } = transport({});
  await assert.rejects(fetcher('https://journal.example/article', { deadline: Date.now() - 1 }), { code: 'SOURCE_TIMEOUT' });
  assert.equal(requests.length, 0); assert.equal(hosts.length, 0);
});
test('file signatures distinguish PDF, HTML, corrupted files and unsupported images', () => {
  assert.equal(identifySource(Buffer.from('%PDF-1.7 abc'), 'application/octet-stream'), 'pdf');
  assert.equal(identifySource(Buffer.from('<!doctype html><title>Test</title>'), ''), 'html');
  assert.throws(() => identifySource(Buffer.from('not a PDF'), 'application/pdf'), { code: 'INVALID_PDF' });
  assert.throws(() => identifySource(Buffer.from('PNG binary'), 'image/png'), { code: 'SOURCE_UNSUPPORTED' });
});
test('legacy HTML character encodings preserve names instead of producing replacement characters', () => {
  assert.match(decodeHTML(Buffer.from('<title>Caf\xe9</title>', 'latin1'), 'text/html; charset=windows-1252'), /Café/);
  assert.match(decodeHTML(Buffer.from('<meta charset="iso-8859-1"><title>Caf\xe9</title>', 'latin1')), /Café/);
});
