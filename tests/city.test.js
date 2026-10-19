import test from 'node:test';
import assert from 'node:assert/strict';
import { cityFromHTML, cityFromAddress, cleanCity, contactLinks, enrichCity, locationKey, overrideKeys } from '../server/city.js';
import { createRepository } from '../server/repository.js';
import { makeHandler } from '../server/handlers.js';
import { buildCitations, DEMO_METADATA } from '../shared/citations.js';
import { MemoryFirestore, user, call, env } from './helpers.js';

const sourceURL = 'https://jurnal.example/index.php/pendidikan/article/view/42';
const contactURL = 'https://jurnal.example/index.php/pendidikan/about/contact';
const meta = { ...DEMO_METADATA, journal: 'Jurnal Pendidikan', publisher: 'Universitas Contoh', sourceURL, doi: '10.1234/riset' };
test('city metadata is extracted with a source and HTML is stripped', () => {
  const found = cityFromHTML('<meta name="citation_publisher_location" content="Kota Bandung">', sourceURL);
  assert.equal(found.city, 'Bandung'); assert.equal(found.citySource.type, 'meta'); assert.equal(found.citySource.url, sourceURL);
  assert.equal(found.citySource.confidence, 'high'); assert.ok(found.citySource.retrievedAt > 0);
  assert.equal(cleanCity('<b>Yogyakarta</b>'), 'Yogyakarta');
  for (const value of ['Indonesia', 'Jl. Merdeka No. 123, Bandung', 'https://example.com', 'redaksi@example.test', '12345']) assert.equal(cleanCity(value), '');
});
test('JSON-LD resolves graph publisher addresses, including arrays', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [
    { '@type': 'ScholarlyArticle', publisher: { '@id': '#publisher' }, author: { address: { addressLocality: 'Surabaya' } } },
    { '@id': '#publisher', name: 'Universitas Contoh', address: [{ '@id': '#address' }] },
    { '@id': '#address', '@type': 'PostalAddress', addressLocality: 'Sleman' },
  ] })}</script>`;
  const found = cityFromHTML(html, sourceURL, meta);
  assert.equal(found.city, 'Sleman'); assert.equal(found.citySource.type, 'jsonld');
});
test('author affiliations and arbitrary page text are never treated as publishing city', () => {
  const html = `<p>Universitas Bandung dan Jakarta</p><div class="author-affiliation">Kota Malang</div><script type="application/ld+json">${JSON.stringify({ '@type': 'ScholarlyArticle', author: { address: { addressLocality: 'Bandung' } }, publisher: { name: 'Publisher without address' } })}</script>`;
  assert.equal(cityFromHTML(html, sourceURL, meta), null);
});
test('microdata publisher addresses are accepted and unrelated organizations are ignored', () => {
  assert.equal(cityFromHTML('<div itemprop="publisher"><span itemprop="addressLocality" content="Semarang"></span></div>', sourceURL).city, 'Semarang');
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Organization', name: 'Unrelated', address: { addressLocality: 'Malang' } })}</script>`;
  assert.equal(cityFromHTML(html, sourceURL, meta), null);
});
test('contact address is tentative and Indonesian locality matching respects word boundaries', () => {
  const found = cityFromHTML('<div class="contact"><div class="address">Jl. Pendidikan No 1, Kabupaten Sleman, Yogyakarta 55281</div></div>', contactURL);
  assert.equal(found.city, 'Sleman'); assert.equal(found.citySource.confidence, 'medium'); assert.equal(found.citySource.type, 'contact');
  assert.equal(cityFromAddress('Jl. A No. 1, Jakarta Selatan 12345'), 'Jakarta');
  assert.equal(cityFromAddress('Jalan Raya Solo 10, Kota Surakarta'), 'Surakarta');
  assert.equal(cityFromAddress('Bandungan 12345'), '');
});
test('contact traversal is limited to two same-origin URLs and keeps the OJS journal path', () => {
  const links = contactLinks('<a href="/index.php/pendidikan/about/contact">Kontak</a><a href="https://evil.example/contact">Contact</a><a href="javascript:alert(1)">Contact</a><a href="/contact-us">Contact</a><a href="/other/contact">Contact</a>', sourceURL);
  assert.equal(links.length, 2); assert.equal(links[0], contactURL); assert.ok(links.every((link) => new URL(link).origin === new URL(sourceURL).origin));
  assert.deepEqual(contactLinks('', sourceURL), [contactURL]);
});
test('DOI city wins before network lookups and keeps Crossref provenance', async () => {
  const found = await enrichCity({ ...meta, city: 'Oxford' }, { fetchHTML() { throw new Error('Should not fetch'); } });
  assert.equal(found.city, 'Oxford'); assert.equal(found.citySource.type, 'crossref');
});
test('invalid country-only city falls through to publisher HTML', async () => {
  let fetched = 0;
  const found = await enrichCity({ ...meta, city: 'Indonesia' }, { fetchHTML: async (url) => { fetched++; return { url, html: '<meta name="citation_publication_place" content="Bandung">' }; } });
  assert.equal(found.city, 'Bandung'); assert.equal(fetched, 1);
});
test('OJS contact fallback is cached and errors do not break a valid citation', async () => {
  const db = new MemoryFirestore(); const repo = createRepository(db); const seen = [];
  const fetchHTML = async (url) => { seen.push(url); return { url, html: url.includes('contact') ? '<div class="contact"><div class="address">Jl. Contoh 10, Bandung 40123</div></div>' : '<title>Artikel</title>' }; };
  const found = await enrichCity(meta, { repo, fetchHTML }); assert.equal(found.city, 'Bandung'); assert.equal(found.citySource.confidence, 'medium');
  assert.deepEqual(seen, [sourceURL, contactURL]);
  const cached = await enrichCity(meta, { repo, fetchHTML: async () => { throw new Error('Must use cache'); } });
  assert.equal(cached.city, 'Bandung'); assert.equal(cached.cityCached, true);
  const failed = await enrichCity({ ...meta, doi: '10.1234/other' }, { fetchHTML: async () => { throw new Error('blocked'); } });
  assert.equal(failed.city, ''); assert.equal(failed.cityStatus, 'not_found');
});
test('administrator corrections override cached and Crossref cities immediately, with ISSN priority', async () => {
  const db = new MemoryFirestore(); const repo = createRepository(db);
  const entry = { city: 'Bandung', sourceURL: contactURL, enabled: true, reason: 'Alamat resmi jurnal diverifikasi' };
  await db.doc(`publisherLocations/${locationKey('publisher', meta.publisher)}`).set({ ...entry, city: 'Jakarta' });
  await db.doc(`publisherLocations/${locationKey('issn', '1234-567X')}`).set(entry);
  const found = await enrichCity({ ...meta, city: 'London', issn: ['1234-567X'] }, { repo });
  assert.equal(found.city, 'Bandung'); assert.equal(found.citySource.type, 'admin');
  assert.equal(overrideKeys({ ...meta, issn: ['1234-567X'] })[0], locationKey('issn', '1234-567X'));
  assert.ok(overrideKeys(meta).includes(locationKey('journal-url', 'https://jurnal.example/index.php/pendidikan')));
  await db.doc(`publisherLocations/${locationKey('issn', '1234-567X')}`).update({ enabled: false });
  assert.equal((await enrichCity({ ...meta, issn: ['1234-567X'] }, { repo })).city, 'Jakarta');
});
test('city preview authenticates, is free, rate limits, and never stores a citation', async () => {
  const db = new MemoryFirestore(); const repo = createRepository(db); await repo.ensureProfile(user);
  const handler = makeHandler('city', { repo, env, authenticate: async () => user, resolveMetadata: async () => ({ ...meta, city: 'Bandung' }) });
  const body = { mode: 'doi', input: meta.doi };
  for (let index = 0; index < 12; index++) assert.equal((await call(handler, { body })).statusCode, 200);
  const limited = await call(handler, { body }); assert.equal(limited.statusCode, 429);
  assert.equal(db.records.get(`users/${user.uid}`).credits, 5); assert.equal([...db.records.keys()].filter((key) => key.includes('/history/')).length, 0);
  assert.equal((await call(handler, { body, customHeaders: { authorization: undefined } })).statusCode, 401);
});
test('manual city lookup uses curated journal data without needing paid citation fields', async () => {
  const db = new MemoryFirestore(); const repo = createRepository(db); await repo.ensureProfile(user);
  await db.doc(`publisherLocations/${locationKey('journal', 'Jurnal Pendidikan')}`).set({ city: 'Malang', sourceURL: contactURL, enabled: true });
  const handler = makeHandler('city', { repo, env, authenticate: async () => user });
  const response = await call(handler, { body: { mode: 'manual', input: { journal: 'Jurnal Pendidikan' } } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.data.city, 'Malang');
});
test('city formatting supports manual correction and leaves APA city-free', () => {
  const automatic = buildCitations({ ...meta, city: 'Bandung' }); const manual = buildCitations({ ...meta, city: 'Bandung' }, 'Malang');
  assert.ok(automatic.footnote.includes('Bandung')); assert.ok(automatic.bibliography.includes('Bandung'));
  assert.ok(manual.footnote.includes('Malang')); assert.ok(!manual.footnote.includes('Bandung'));
  assert.equal(automatic.apaReference, manual.apaReference);
});
