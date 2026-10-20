import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCitations, DEMO_METADATA, isDOI, cleanDOI, plainCitation, safeCitationHTML, parseAuthor, getCitationResults } from '../shared/citations.js';
import { fromDOI, fromManual, parseHTMLMetadata } from '../server/metadata.js';
import { publicURL } from '../server/safe-fetch.js';
import { makeHandler } from '../server/handlers.js';
import { createRepository } from '../server/repository.js';
import { AppError } from '../server/errors.js';
import { MemoryFirestore, call, env, user } from './helpers.js';
import { publicationDate } from '../shared/publication-date.js';

test('custom footnote and bibliography match the requested publication format and capitalization', () => {
  const title = 'Analisis Peraturan Pemerintah Nomor 28 Tahun 2024 Tentang Peraturan Pelaksanaan Undang-undang Nomor 17 Tahun 2023 Tentang Kesehatan Terkait Pemberian Alat Kontrasepsi Bagi Siswa Dan Remaja';
  const results = buildCitations({ title, authors: [{ given: 'Pardi', family: 'Hilala' }], year: '2025', month: '3',
    journal: 'Ganec Swara', publisher: 'Yayasan Al-amin Qalbu', volume: '19', issue: '1', page: '49-55', doi: '10.59896/gara.v19i1.175' }, 'Gorontalo');
  assert.equal(results.footnote, `Pardi Hilala (2025) “${title}.” <i>Ganec Swara</i>. Gorontalo, Vol. 19 No. 1, Mar 2025. hal. 49-55. https://doi.org/10.59896/gara.v19i1.175.`);
  assert.equal(plainCitation(results.bibliography), `Hilala, Pardi. (2025) "${title}". Ganec Swara, Yayasan Al-amin Qalbu, Gorontalo, Vol. 19 No. 1, Mar 2025.`);
  assert.ok(!results.bibliography.includes('<i>'));
});
test('custom output preserves mixed case, avoids duplicate title periods and omits unavailable details', () => {
  const r = buildCitations({ title: 'eDNA, AI dan COVID-19.', authors: [{ given: 'Ana', family: 'de la Cruz' }], year: '2024', journal: 'eLife' });
  assert.equal(r.footnote, 'Ana de la Cruz (2024) “eDNA, AI dan COVID-19.” <i>eLife</i>.');
  assert.equal(r.bibliography, 'de la Cruz, Ana. (2024) "eDNA, AI dan COVID-19". eLife.');
  assert.ok(!r.footnote.includes('Jan'));
  assert.ok(!r.footnote.includes('undefined'));
});
test('publication months come from explicit source dates and invalid months are never fabricated', async () => {
  assert.deepEqual(publicationDate('2025/03/01'), { year: '2025', month: '3' });
  assert.deepEqual(publicationDate('2025'), { year: '2025', month: '' });
  for (const month of [0, 13, 'abc']) assert.equal(publicationDate([2025, month]).month, '');
  const m = await fromDOI('10.59896/gara.v19i1.175', async () => Response.json({ message: {
    title: ['Judul Asli eDNA'], author: [{ given: 'Pardi', family: 'Hilala' }], 'published-print': {},
    'published-online': { 'date-parts': [[2025, 3, 1]] }, 'container-title': ['Ganec Swara'], DOI: '10.59896/gara.v19i1.175',
  } }));
  assert.equal(m.month, '3'); assert.equal(m.year, '2025'); assert.equal(m.title, 'Judul Asli eDNA');
  const html = parseHTMLMetadata('<meta name="citation_title" content="eDNA"><meta name="citation_publication_date" content="2025/03/01">', 'https://example.test/article');
  assert.equal(html.month, '3');
  assert.equal(fromManual({ author: 'Pardi Hilala', title: 'Judul', year: '2025', month: '03' }).month, '3');
  for (const month of ['0', '13', '123']) assert.throws(() => fromManual({ author: 'Pardi Hilala', title: 'Judul', year: '2025', month }), { code: 'INVALID_MONTH' });
});

test('DOI normalization accepts DOI URLs and rejects malformed IDs', () => {
  assert.equal(cleanDOI(' https://doi.org/10.1038/nature14539 '), '10.1038/nature14539');
  assert.equal(cleanDOI('doi: 10.1038/nature14539'), '10.1038/nature14539');
  assert.ok(isDOI('https://dx.doi.org/10.1038/nature14539'));
  for (const value of ['', 'nature14539', '10.1038/', 'https://evil.test/10.1038/x', '10.12/test', '10.1038/with space']) assert.equal(isDOI(value), false);
});
test('APA 7 retains all three authors in reference and et al. only in in-text citation', () => {
  const result = buildCitations(DEMO_METADATA);
  assert.equal(result.apaInText, '(LeCun et al., 2015)');
  assert.equal(plainCitation(result.apaReference), 'LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436–444. https://doi.org/10.1038/nature14539');
  assert.ok(result.apaReference.includes('<i>Nature</i>'));
});
test('APA 7 handles two authors, organisations, missing authors and 21+ authors', () => {
  const two = buildCitations({ ...DEMO_METADATA, authors: DEMO_METADATA.authors.slice(0, 2) });
  assert.equal(two.apaInText, '(LeCun & Bengio, 2015)');
  assert.ok(two.apaReference.startsWith('LeCun, Y., & Bengio, Y.'));
  assert.equal(buildCitations({ ...DEMO_METADATA, authors: [{ literal: 'WHO' }] }).apaInText, '(WHO, 2015)');
  assert.ok(buildCitations({ ...DEMO_METADATA, authors: [] }).apaReference.startsWith('Deep learning. (2015).'));
  const many = buildCitations({ ...DEMO_METADATA, authors: Array.from({ length: 23 }, (_, index) => ({ family: `Author${index}`, given: 'One' })) });
  assert.ok(many.apaReference.includes('Author18, O., … Author22, O.'));
  assert.ok(!many.apaReference.includes('Author19'));
});
test('formatting preserves names, avoids fabricated dates and supports manual city', () => {
  const data = { title: 'Understanding eDNA', authors: [{ given: 'Ana', family: 'de la Cruz' }], journal: 'eLife', year: '', page: '' };
  const result = buildCitations(data, 'Yogyakarta');
  assert.ok(result.apaReference.includes('de la Cruz, A. (n.d.)'));
  assert.ok(result.apaReference.includes('Understanding eDNA'));
  assert.ok(result.bibliography.includes('Yogyakarta'));
});
test('external metadata and legacy HTML cannot inject executable markup', () => {
  const result = buildCitations({ ...DEMO_METADATA, title: '<img src=x onerror=alert(1)>', authors: [{ family: '<script>alert(1)</script>' }] });
  assert.ok(!result.apaReference.includes('<img'));
  assert.ok(!result.apaReference.includes('<script>'));
  const safe = safeCitationHTML('<img src=x onerror=alert(1)><i>Journal</i><script>oops</script>');
  assert.equal(safe, '&lt;img src=x onerror=alert(1)&gt;<i>Journal</i>&lt;script&gt;oops&lt;/script&gt;');
});
test('legacy history fields remain readable', () => {
  assert.deepEqual(getCitationResults({ footnote: 'A', dafpus: 'B', apaInText: 'C', apaRef: 'D' }), {
    footnote: 'A', bibliography: 'B', apaInText: 'C', apaReference: 'D',
  });
});
test('existing metadata-backed history uses the updated custom format without mutating the saved record', () => {
  const saved = { metadata: { ...DEMO_METADATA }, cityUsed: 'Bandung', results: { footnote: 'Old format', bibliography: 'Old bibliography', apaReference: 'Saved APA reference' } };
  const snapshot = structuredClone(saved);
  const result = getCitationResults(saved);
  assert.ok(result.footnote.includes('Bandung, Vol. 521 No. 7553, Mei 2015. hal. 436-444.'));
  assert.equal(result.apaReference, 'Saved APA reference');
  assert.deepEqual(saved, snapshot);
});
test('manual author parsing supports semicolons and family, given forms', () => {
  assert.deepEqual(parseAuthor('LeCun, Yann'), { family: 'LeCun', given: 'Yann' });
  const result = fromManual({ author: 'LeCun, Yann; Yoshua Bengio', title: 'Deep learning', year: '2015' });
  assert.equal(result.authors.length, 2); assert.equal(result.authors[0].family, 'LeCun');
  for (const input of [{ year: '20151' }, { author: '; ;' }, { title: '' }, { year: 'year' }, { doi: 'not-a-doi' }]) {
    assert.throws(() => fromManual({ author: 'Yann LeCun', title: 'Deep learning', year: '2015', ...input }));
  }
});
test('publisher metadata parsing preserves Unicode and reports unavailable fields', () => {
  const html = `<html><head><meta name="citation_title" content="Riset &amp; Pendidikan"><meta name="citation_author" content="Dewi Lestari"><meta name="citation_author" content="Budi Santoso"><meta name="citation_publication_date" content="2024/05/12"><meta name="citation_firstpage" content="12"><meta name="citation_lastpage" content="24"><meta name="citation_volume" content="8"><meta name="citation_journal_title" content="Jurnal Pendidikan"></head></html>`;
  const result = parseHTMLMetadata(html, 'https://jurnal.example/article/1');
  assert.equal(result.title, 'Riset & Pendidikan'); assert.equal(result.authors.length, 2);
  assert.equal(result.year, '2024'); assert.equal(result.page, '12-24'); assert.deepEqual(result.warnings, []);
  assert.equal(parseHTMLMetadata('<title>Artikel Publik</title>', 'https://example.test').warnings.length, 2);
  assert.throws(() => parseHTMLMetadata('<title>Just a moment...</title>', 'https://example.test'), { code: 'SOURCE_BLOCKED' });
});
test('rejects private, loopback, non-HTTPS, credentialed and unusual-port source URLs', () => {
  for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://169.254.169.254', 'https://192.168.1.10', 'https://10.0.0.2', 'https://172.16.0.1', 'https://0x7f000001', 'https://user:pass@example.com', 'https://example.com:8443', 'file:///etc/passwd', 'https://[::ffff:127.0.0.1]']) {
    assert.throws(() => publicURL(url), url);
  }
  assert.equal(publicURL('https://jurnal.example/artikel').hostname, 'jurnal.example');
});
test('Crossref uses encoded DOI and stops safely on lookup failures', async () => {
  let url;
  const metadata = await fromDOI('https://doi.org/10.1038/nature14539', async (input) => {
    url = input; return Response.json({ message: { title: ['Deep learning'], author: DEMO_METADATA.authors, issued: { 'date-parts': [[2015, 5]] }, 'container-title': ['Nature'], DOI: '10.1038/nature14539' } });
  });
  assert.ok(url.includes('10.1038%2Fnature14539')); assert.equal(metadata.year, '2015'); assert.equal(metadata.authors.length, 3);
  let calls = 0;
  await assert.rejects(fromDOI('10.1038/notfound', async () => { calls++; return new Response(null, { status: 404 }); }), { code: 'DOI_NOT_FOUND' });
  assert.equal(calls, 2);
});
async function setup(balance = 5) {
  const db = new MemoryFirestore(); const repo = createRepository(db); await repo.ensureProfile(user);
  await db.doc(`users/${user.uid}`).update({ credits: balance });
  const overrides = { env, repo, authenticate: async () => user, resolveMetadata: async () => DEMO_METADATA };
  return { db, repo, overrides, handler: makeHandler('citations', overrides) };
}
test('a successful citation stores history and deducts one credit atomically', async () => {
  const { db, handler } = await setup();
  const result = await call(handler, { body: { mode: 'doi', input: '10.1038/nature14539' } });
  assert.equal(result.statusCode, 200); assert.equal(result.body.data.title, 'Deep learning');
  assert.equal(db.records.get(`users/${user.uid}`).credits, 4);
  assert.equal([...db.records.keys()].filter((key) => key.includes('/history/')).length, 1);
});
test('citation retry is idempotent and mismatched reuse is rejected', async () => {
  const { db, handler } = await setup(); const body = { mode: 'doi', input: '10.1038/nature14539' };
  await call(handler, { body }); await call(handler, { body });
  assert.equal(db.records.get(`users/${user.uid}`).credits, 4);
  assert.equal((await call(handler, { body: { ...body, input: '10.1038/different' } })).statusCode, 409);
});
test('metadata failures leave balance and history untouched', async () => {
  const { db, overrides } = await setup();
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => { throw new AppError(422, 'NOT_FOUND', 'No metadata'); } });
  assert.equal((await call(handler, { body: { mode: 'doi', input: '10.1038/notfound' } })).statusCode, 422);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5);
  assert.equal([...db.records.keys()].filter((key) => key.includes('/history/')).length, 0);
});
test('concurrent citation requests cannot overdraw a one-credit balance', async () => {
  const { db, handler } = await setup(1);
  const options = { body: { mode: 'doi', input: '10.1038/nature14539' } };
  const responses = await Promise.all([call(handler, options), call(handler, { ...options, customHeaders: { 'idempotency-key': 'test-request-key-0002' } })]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 402]);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 0);
  assert.equal([...db.records.keys()].filter((key) => key.includes('/history/')).length, 1);
});
test('concurrent retries save one citation and prevent request-key collisions', async () => {
  const { db, handler } = await setup(); const options = { body: { mode: 'doi', input: '10.1038/nature14539' } };
  const results = await Promise.all([call(handler, options), call(handler, options)]);
  assert.ok(results.every((result) => result.statusCode === 200));
  assert.equal(db.records.get(`users/${user.uid}`).credits, 4);
  const other = await setup();
  const collisions = await Promise.all([call(other.handler, options), call(other.handler, { body: { mode: 'doi', input: '10.1038/different' } })]);
  assert.deepEqual(collisions.map((response) => response.statusCode).sort(), [200, 409]);
});
test('out-of-credit requests do not contact metadata provider', async () => {
  const { overrides } = await setup(0); let lookups = 0;
  const handler = makeHandler('citations', { ...overrides, resolveMetadata: async () => { lookups++; return DEMO_METADATA; } });
  assert.equal((await call(handler, { body: { mode: 'doi', input: '10.1038/nature14539' } })).statusCode, 402); assert.equal(lookups, 0);
});
