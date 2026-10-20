import test from 'node:test';
import assert from 'node:assert/strict';
import { fromURL, fromDOI, parseHTMLMetadata } from '../server/metadata.js';
import { articleLandingURL, documentLinks } from '../server/html-metadata.js';
import { readPDFMetadata, draftPDFMetadata } from '../server/pdf-metadata.js';
import { findDOIs, matchingTitles, mergeMetadata } from '../server/source-metadata.js';
import { normalizeSourceURL } from '../server/safe-fetch.js';
import { buildCitations, plainCitation } from '../shared/citations.js';
import { createRepository } from '../server/repository.js';
import { makeHandler } from '../server/handlers.js';
import { AppError } from '../server/errors.js';
import { MemoryFirestore, call, env, user } from './helpers.js';
import { makePDF, article, articleHTML, articlePDF } from './metadata-fixtures.js';

const url = 'https://jurnal.example/article/view/175';
const htmlSource = (html, source = url) => ({ type: 'html', html, url: source });
const pdfSource = (data = articlePDF(), source = 'https://jurnal.example/paper.pdf') => ({ type: 'pdf', data, url: source });
const noDOI = async () => { throw new AppError(422, 'DOI_NOT_FOUND', 'Not found'); };

test('JSON-LD graph resolves authors, organisation, journal, issue, volume and publisher without changing case', () => {
  const html = '<script type="application/ld+json">' + JSON.stringify({ '@graph': [
    { '@type': 'WebSite', name: 'Generic website' },
    { '@type': 'ScholarlyArticle', '@id': url + '#article', headline: 'Analisis eDNA dan UU Kesehatan', datePublished: '2025-03-12', dateModified: '2026-10-21',
      author: [{ '@id': '#pardi' }, { '@type': 'Organization', name: 'Tim Riset eDNA' }], publisher: { name: 'Yayasan Al-amin Qalbu' }, isPartOf: { '@id': '#issue' }, pageStart: '49', pageEnd: '55', identifier: { propertyID: 'DOI', value: article.doi } },
    { '@id': '#pardi', '@type': 'Person', givenName: 'Pardi', familyName: 'Hilala' },
    { '@id': '#issue', '@type': 'PublicationIssue', issueNumber: '1', isPartOf: { '@id': '#volume' } },
    { '@id': '#volume', '@type': 'PublicationVolume', volumeNumber: '19', isPartOf: { '@type': 'Periodical', name: 'Ganec Swara', issn: '1412-671X' } },
  ] }) + '</script>';
  const result = parseHTMLMetadata(html, url);
  assert.equal(result.title, 'Analisis eDNA dan UU Kesehatan');
  assert.deepEqual(result.authors, [{ given: 'Pardi', family: 'Hilala' }, { literal: 'Tim Riset eDNA' }]);
  assert.equal(result.year, '2025'); assert.equal(result.month, '3');
  assert.equal(result.journal, 'Ganec Swara'); assert.equal(result.publisher, article.publisher);
  assert.equal(result.volume, '19'); assert.equal(result.issue, '1'); assert.equal(result.page, '49-55');
  assert.equal(result.doi, article.doi); assert.deepEqual(result.issn, ['1412-671X']);
});

test('malformed structured data retains Highwire tags and does not override explicit author names', () => {
  const result = parseHTMLMetadata(articleHTML + '<script type="application/ld+json">broken</script>', url);
  assert.equal(result.title, article.title); assert.equal(result.authors[0].family, 'Hilala'); assert.equal(result.month, '3');
});
test('Dublin Core colon tags, semantic headings and visible author bylines provide alternatives', () => {
  const dc = parseHTMLMetadata('<meta property="dc:title" content="Riset eDNA"><meta name="dc:creator" content="Dewi Lestari"><meta name="dc:date" content="2024-07"><meta name="dc:publisher" content="Penerbit Contoh">', url);
  assert.equal(dc.title, 'Riset eDNA'); assert.equal(dc.authors[0].family, 'Lestari'); assert.equal(dc.month, '7'); assert.equal(dc.publisher, 'Penerbit Contoh');
  const semantic = parseHTMLMetadata('<main><h1>Analisis eDNA</h1><a rel="author">Pardi Hilala</a></main><meta property="article:published_time" content="2025-03-01">', url);
  assert.equal(semantic.title, 'Analisis eDNA'); assert.equal(semantic.authors[0].given, 'Pardi');
});
test('dateModified alone is never treated as the article publication date', () => {
  const result = parseHTMLMetadata('<script type="application/ld+json">' + JSON.stringify({ '@type': 'Article', headline: 'Judul Asli', dateModified: '2026-10-21', author: { name: 'Pardi Hilala' } }) + '</script>', url);
  assert.equal(result.year, ''); assert.ok(result.warnings.includes('Tahun terbit tidak tercantum.'));
});
test('the URL route falls back to publisher metadata when an embedded DOI cannot be resolved', async () => {
  let reads = 0;
  const result = await fromURL('https://publisher.example/doi/10.5555/notfound', { lookupDOI: noDOI, fetchSource: async (input) => { reads++; return htmlSource(articleHTML, input); } });
  assert.equal(reads, 1); assert.equal(result.title, article.title); assert.equal(result.year, '2025');
});
test('verified DOI records fill absent publisher fields while preserving the publisher title case', async () => {
  const lower = { ...article, title: 'analisis eDNA dan kebijakan kesehatan' };
  const result = await fromURL(url, { fetchSource: async () => htmlSource(articleHTML + '<meta name="citation_doi" content="' + article.doi + '">'), lookupDOI: async () => lower });
  assert.equal(result.title, article.title); assert.equal(result.publisher, article.publisher); assert.equal(result.volume, '19'); assert.equal(result.page, '49-55');
  assert.deepEqual(result.warnings, []);
});
test('a blocked publisher URL with an explicit DOI can still produce a verified citation', async () => {
  const result = await fromURL('https://publisher.example/doi/pdf/' + article.doi, { fetchSource: async () => { throw new AppError(422, 'SOURCE_BLOCKED', 'Blocked'); }, lookupDOI: async () => article });
  assert.equal(result.doi, article.doi); assert.equal(result.title, article.title);
});
test('DOI resolver URLs use public metadata without needing the publisher to be reachable', async () => {
  let reads = 0;
  const result = await fromURL('http://doi.org/' + article.doi, { fetchSource: async () => { reads++; throw new Error('Not expected'); }, lookupDOI: async () => article });
  assert.equal(result.doi, article.doi); assert.equal(reads, 0);
});
test('OJS download and galley viewer URLs are normalized without losing nonnumeric article identifiers', async () => {
  for (const input of ['https://jurnal.example/index.php/gara/article/download/slug-175/42', 'https://jurnal.example/index.php/gara/article/viewFile/175/42', 'https://jurnal.example/index.php/gara/article/view/175/42']) {
    assert.match(articleLandingURL(input), /\/article\/view\/(?:slug-175|175)$/);
    let fetched;
    const result = await fromURL(input, { fetchSource: async (value) => { fetched = value; return htmlSource(articleHTML, value); }, lookupDOI: noDOI });
    assert.match(fetched, /\/article\/view\/(?:slug-175|175)$/);
    assert.equal(result.title, article.title);
  }
});
test('a PDF viewer follows its relative document link when article metadata is incomplete', async () => {
  const reads = [];
  const result = await fromURL('https://repository.example/viewer', { fetchSource: async (input) => {
    reads.push(input);
    return input.endsWith('/file.pdf') ? pdfSource(articlePDF(), input) : htmlSource('<title>PDF viewer</title><iframe src="/file.pdf"></iframe>', input);
  }, lookupDOI: async () => article });
  assert.deepEqual(reads, ['https://repository.example/viewer', 'https://repository.example/file.pdf']);
  assert.equal(result.doi, article.doi); assert.match(result.source, /PDF/);
});
test('publisher PDF links are bounded and private, credentialed or executable destinations are discarded', () => {
  const links = documentLinks('<meta name="citation_pdf_url" content="https://127.0.0.1/secret.pdf"><iframe src="http://internal.local/file.pdf"></iframe><embed src="javascript:alert(1)"><a href="/download.pdf">PDF</a><object data="https://user:pass@host.example/a.pdf"></object><iframe src="/second.pdf"></iframe><iframe src="/third.pdf"></iframe><iframe src="/fourth.pdf"></iframe>', url);
  assert.deepEqual(links, ['https://jurnal.example/second.pdf', 'https://jurnal.example/third.pdf', 'https://jurnal.example/fourth.pdf']);
  assert.ok(links.length <= 3);
});
test('direct PDFs are really parsed and the article DOI completes the citation metadata', async () => {
  const result = await fromURL('https://repository.example/paper.pdf', { fetchSource: async () => pdfSource(), lookupDOI: async (doi) => { assert.equal(doi, article.doi); return article; } });
  assert.equal(result.title, article.title); assert.equal(result.authors[0].family, 'Hilala');
  assert.equal(result.year, '2025'); assert.equal(result.month, '3'); assert.equal(result.publisher, article.publisher);
  assert.ok(!('doiCandidates' in result)); assert.ok(!('hasText' in result));
  const rendered = plainCitation(buildCitations(result).footnote);
  assert.ok(rendered.includes('Pardi Hilala (2025)')); assert.ok(rendered.includes('Analisis eDNA'));
  assert.ok(rendered.includes('Vol. 19 No. 1, Mar 2025')); assert.ok(rendered.includes(article.doi));
});
test('PDFs without a DOI retain their actual embedded title, author and explicit publication date', async () => {
  const data = makePDF({ title: 'Riset eDNA Tanpa DOI', author: 'Dewi Lestari', lines: [{ text: 'Vol. 8 No. 2, Jul 2024', y: 800 }, { text: 'Riset eDNA Tanpa DOI', size: 18, y: 730 }, { text: 'Dewi Lestari', y: 700 }, { text: 'Abstract', y: 660 }] });
  const result = await fromURL('https://repository.example/no-doi.pdf', { fetchSource: async () => pdfSource(data), lookupDOI: noDOI });
  assert.equal(result.title, 'Riset eDNA Tanpa DOI'); assert.equal(result.authors[0].family, 'Lestari'); assert.equal(result.year, '2024'); assert.equal(result.month, '7'); assert.equal(result.doi, '');
});
test('a real PDF with metadata but no publication date never borrows its creation timestamp', async () => {
  const draft = await readPDFMetadata(makePDF({ title: 'Judul PDF dengan Metadata', author: 'Pardi Hilala' }), 'https://repository.example/a.pdf');
  assert.equal(draft.title, 'Judul PDF dengan Metadata'); assert.equal(draft.year, ''); assert.equal(draft.month, '');
  assert.ok(draft.warnings.includes('Tahun terbit tidak tercantum.'));
});
test('layout text can recover a missing PDF title without changing its capitalization', async () => {
  const data = makePDF({ author: 'Pardi Hilala', lines: [{ text: 'Jurnal Riset', size: 12, y: 800 }, { text: 'Vol. 3 No. 1, Mar 2025', size: 10, y: 780 }, { text: 'Analisis eDNA dan Hukum', size: 18, y: 730 }, { text: 'Pardi Hilala', size: 11, y: 700 }, { text: 'Abstract', y: 660 }] });
  const result = await readPDFMetadata(data, 'https://repository.example/a.pdf');
  assert.equal(result.title, 'Analisis eDNA dan Hukum'); assert.equal(result.year, '2025');
});
test('reference-list DOIs are excluded and a mismatched DOI never replaces the requested title', async () => {
  const draft = draftPDFMetadata({ info: { Title: article.title, Author: 'Pardi Hilala' }, pages: [[
    { text: article.title, y: 700, fontSize: 18 }, { text: 'Pardi Hilala', y: 680, fontSize: 11 },
    { text: 'References', y: 100, fontSize: 12 }, { text: 'A different work https://doi.org/10.5555/unrelated', y: 80, fontSize: 10 },
  ]] }, url);
  assert.deepEqual(draft.doiCandidates, []);
  const result = await fromURL(url, { fetchSource: async () => htmlSource(articleHTML + '<meta name="citation_doi" content="10.5555/unrelated">'), lookupDOI: async () => ({ ...article, title: 'A Completely Different Scientific Paper', doi: '10.5555/unrelated' }) });
  assert.equal(result.title, article.title); assert.equal(result.doi, '');
  assert.ok(result.warnings.some((warning) => warning.includes('tidak cocok')));
});
test('scanned or empty PDFs produce an actionable error instead of fabricated references', async () => {
  await assert.rejects(fromURL('https://repository.example/scan.pdf', { fetchSource: async () => pdfSource(makePDF()), lookupDOI: noDOI }), { code: 'PDF_TEXT_UNAVAILABLE' });
});
test('a page with only a generic title cannot become a billable citation', async () => {
  await assert.rejects(fromURL(url, { fetchSource: async () => htmlSource('<title>Judul tanpa data bibliografi</title>'), lookupDOI: noDOI }), { code: 'METADATA_INCOMPLETE' });
});
test('corrupted PDFs fail clearly and protected documents do not expose parser internals', async () => {
  await assert.rejects(readPDFMetadata(Buffer.from('%PDF-1.7 broken'), url), { code: 'INVALID_PDF' });
  let destroyed = false;
  await assert.rejects(readPDFMetadata(Buffer.from('%PDF-1.7 protected'), url, { pdfModule: async () => ({ getDocument: () => ({
    promise: Promise.reject(Object.assign(new Error('secret parser details'), { name: 'PasswordException' })), destroy: async () => { destroyed = true; },
  }) }) }), { code: 'PDF_PASSWORD' });
  assert.equal(destroyed, true);
});
test('PDF parsing stops at three pages, uses safe text-only options and releases resources', async () => {
  const pages = []; let options, destroyed = false, cleanups = 0;
  const result = await readPDFMetadata(Buffer.from('%PDF-1.7 fake'), url, { pdfModule: async () => ({ getDocument: (input) => {
    options = input;
    return { promise: Promise.resolve({ numPages: 10000, getMetadata: async () => ({ info: { Title: article.title, Author: 'Pardi Hilala' } }),
      getPage: async (number) => { pages.push(number); return { getTextContent: async () => ({ items: [] }), cleanup: () => { cleanups++; } }; } }), destroy: async () => { destroyed = true; } };
  } }) });
  assert.deepEqual(pages, [1, 2, 3]); assert.equal(cleanups, 3); assert.equal(destroyed, true);
  assert.equal(options.isEvalSupported, false); assert.equal(options.enableXfa, false); assert.equal(options.useWorkerFetch, false);
  assert.ok(options.data instanceof Uint8Array); assert.equal(result.title, article.title);
});
test('a PDF parser that stalls is cancelled without keeping a hanging document alive', async () => {
  let destroyed = false;
  await assert.rejects(readPDFMetadata(Buffer.from('%PDF-1.7 fake'), url, { timeoutMs: 10, pdfModule: async () => ({ getDocument: () => ({
    promise: new Promise(() => {}), destroy: async () => { destroyed = true; },
  }) }) }), { code: 'PDF_TIMEOUT' });
  assert.equal(destroyed, true);
});
test('HTTP inputs are upgraded to HTTPS and malformed percent escapes cannot cause a server exception', async () => {
  assert.equal(normalizeSourceURL(' http://jurnal.example/paper.pdf#page=2 ').href, 'https://jurnal.example/paper.pdf');
  const result = await fromURL('https://jurnal.example/article/%zz', { fetchSource: async (input) => htmlSource(articleHTML, input), lookupDOI: noDOI });
  assert.equal(result.title, article.title);
});
test('DOI punctuation handling keeps balanced parentheses and exact encoded identifiers', () => {
  assert.deepEqual(findDOIs('https://doi.org/10.1234/Study(PartA).'), ['10.1234/Study(PartA)']);
  assert.deepEqual(findDOIs('doi:10.1234/Study).'), ['10.1234/Study']);
  assert.deepEqual(findDOIs('/10.1234%2FeDNA.pdf', { path: true }), ['10.1234/eDNA']);
  assert.equal(matchingTitles('Analisis eDNA dan Hukum', 'ANALISIS eDNA DAN HUKUM'), true);
  assert.equal(matchingTitles('Analisis eDNA dan Hukum', 'A different scientific topic'), false);
});
test('metadata merging does not attach a secondary publication month to a different year', () => {
  assert.equal(mergeMetadata({ title: article.title, year: '2024', authors: [] }, article).month, '');
});
test('DataCite resolves repository DOIs when Crossref has no record', async () => {
  const requests = [];
  const result = await fromDOI('10.5281/zenodo.123456', async (input, options) => {
    requests.push(input); assert.equal(options.redirect, 'error');
    return input.includes('crossref') ? new Response(null, { status: 404 }) : Response.json({ data: { attributes: {
      doi: '10.5281/zenodo.123456', titles: [{ title: 'Dataset eDNA Indonesia' }], creators: [{ nameType: 'Personal', givenName: 'Dewi', familyName: 'Lestari' }, { nameType: 'Organizational', name: 'Tim Riset eDNA' }], publicationYear: 2024,
      publisher: { name: 'Zenodo' }, url: 'https://zenodo.org/records/123456',
    } } });
  });
  assert.equal(requests.length, 2); assert.ok(requests[1].includes('10.5281%2Fzenodo.123456'));
  assert.equal(result.source, 'DataCite'); assert.equal(result.year, '2024'); assert.equal(result.month, '');
  assert.equal(result.publisher, 'Zenodo'); assert.deepEqual(result.authors[1], { literal: 'Tim Riset eDNA' });
});
test('end-to-end URL citation stores resolved PDF metadata and charges only once on retries', async () => {
  const db = new MemoryFirestore(), repo = createRepository(db); await repo.ensureProfile(user);
  let reads = 0;
  const handler = makeHandler('citations', { env, repo, authenticate: async () => user,
    resolveMetadata: async (mode, input) => { assert.equal(mode, 'url'); return fromURL(input, { fetchSource: async () => { reads++; return pdfSource(); }, lookupDOI: async () => article }); } });
  const request = { body: { mode: 'url', input: 'https://repository.example/paper.pdf' } };
  const first = await call(handler, request), retry = await call(handler, request);
  assert.equal(first.statusCode, 200); assert.equal(retry.statusCode, 200);
  assert.equal(first.body.data.metadata.publisher, article.publisher);
  assert.equal(db.records.get('users/' + user.uid).credits, 4); assert.equal(reads, 1);
  assert.equal([...db.records.keys()].filter((path) => path.includes('/history/')).length, 1);
  assert.equal([...db.records.keys()].filter((path) => path.includes('/creditLedger/')).length, 1);
});
test('failed PDF extraction cannot create history, ledger entries or deduct credits', async () => {
  for (const data of [makePDF(), Buffer.from('%PDF-1.7 damaged')]) {
    const db = new MemoryFirestore(), repo = createRepository(db); await repo.ensureProfile(user);
    const handler = makeHandler('citations', { env, repo, authenticate: async () => user,
      resolveMetadata: async (_mode, input) => fromURL(input, { fetchSource: async () => pdfSource(data), lookupDOI: noDOI }) });
    const response = await call(handler, { body: { mode: 'url', input: 'https://repository.example/paper.pdf' } });
    assert.equal(response.statusCode, 422); assert.equal(db.records.get('users/' + user.uid).credits, 5);
    assert.equal([...db.records.keys()].filter((path) => /\/(?:history|creditLedger)\//.test(path)).length, 0);
  }
});
