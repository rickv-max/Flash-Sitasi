import { cleanDOI, isDOI, parseAuthor } from '../shared/citations.js';
import { AppError } from './errors.js';
import { fetchPublicSource, normalizeSourceURL, publicURL } from './safe-fetch.js';
import { parseHTMLMetadata, articleLandingURL, documentLinks } from './html-metadata.js';
import { readPDFMetadata } from './pdf-metadata.js';
import { enrichCity } from './city.js';
import { publicationDate } from '../shared/publication-date.js';
import { plainText as text, completeMetadata, findDOIs, matchingTitles, mergeMetadata, requireUsableMetadata } from './source-metadata.js';

export { parseHTMLMetadata } from './html-metadata.js';
const sourceURL = (value) => { try { return normalizeSourceURL(value).href; } catch { return ''; } };
const authorsOf = (items = []) => (Array.isArray(items) ? items : []).filter((author) => author && typeof author === 'object').slice(0, 100).map((author) => {
  if (author.nameType === 'Personal' && !author.family && !author.given && !author.familyName && !author.givenName && author.name) return parseAuthor(text(author.name));
  if (author.nameType === 'Organizational' || !author.family && !author.given && !author.familyName && !author.givenName && author.name) return { literal: text(author.name) };
  return { given: text(author.given || author.givenName), family: text(author.family || author.familyName) };
}).filter((author) => author.literal || author.given || author.family);
export async function fromDOI(input, fetcher = fetch, { deadline = Date.now() + 14000 } = {}) {
  const doi = cleanDOI(input);
  if (!isDOI(doi) || doi.length > 500) throw new AppError(400, 'INVALID_DOI', 'Format DOI belum valid. Contoh: 10.1038/nature14539.');
  try {
    const remaining = Math.min(8000, deadline - Date.now());
    if (remaining < 100) throw new Error('DOI deadline');
    const response = await fetcher('https://api.crossref.org/works/' + encodeURIComponent(doi), { redirect: 'error', signal: AbortSignal.timeout(remaining), headers: { Accept: 'application/json' } });
    if (response.ok) {
      const { message: item } = await response.json();
      if (!item?.title?.[0] || item.DOI && item.DOI.toLowerCase() !== doi.toLowerCase()) throw new Error('No matching title');
      const date = [item['published-print'], item['published-online'], item.issued]
        .map((value) => publicationDate(value?.['date-parts']?.[0])).find((value) => value.year) || publicationDate('');
      return completeMetadata({
        title: text(item.title[0]), authors: authorsOf(item.author), ...date,
        journal: text(item['container-title']?.[0]), volume: text(item.volume), issue: text(item.issue),
        page: text(item.page), publisher: text(item.publisher), city: text(item['publisher-location'] || item['publisher-place']),
        doi: item.DOI || doi, issn: (Array.isArray(item.ISSN) ? item.ISSN : []).filter((value) => typeof value === 'string').slice(0, 4),
        sourceURL: sourceURL(item.URL), source: 'Crossref',
      });
    }
  } catch { /* Try the other public registration agency without following a DOI redirect. */ }
  try {
    const remaining = Math.min(5000, deadline - Date.now());
    if (remaining < 100) throw new Error('DOI deadline');
    const response = await fetcher('https://api.datacite.org/dois/' + encodeURIComponent(doi), { redirect: 'error', signal: AbortSignal.timeout(remaining), headers: { Accept: 'application/vnd.api+json' } });
    if (response.ok) {
      const { data } = await response.json(), item = data?.attributes;
      const title = item?.titles?.find((entry) => entry.title && entry.titleType !== 'Subtitle')?.title;
      if (!title || item.doi && item.doi.toLowerCase() !== doi.toLowerCase()) throw new Error('No matching DataCite record');
      const issued = item.dates?.find((entry) => /^(?:issued|published)$/i.test(entry.dateType))?.date;
      const published = publicationDate(item.publicationYear), detail = publicationDate(issued);
      const date = { year: published.year || detail.year, month: !published.year || published.year === detail.year ? detail.month : '' };
      const container = item.container || {};
      return completeMetadata({ title: text(title), authors: authorsOf(item.creators), ...date,
        journal: text(container.title), volume: text(container.volume), issue: text(container.issue),
        page: text([container.firstPage, container.lastPage].filter(Boolean).join('-')),
        publisher: text(typeof item.publisher === 'object' ? item.publisher?.name : item.publisher),
        doi: item.doi || doi, issn: container.identifierType === 'ISSN' ? [text(container.identifier)] : [],
        sourceURL: sourceURL(item.url), source: 'DataCite' });
    }
  } catch { /* Provider bodies are never returned to users. */ }
  throw new AppError(422, 'DOI_NOT_FOUND', 'Metadata DOI belum ditemukan di Crossref atau DataCite. Periksa DOI, coba tautan artikel/PDF, atau lengkapi melalui input manual.');
}

const urlMetadataCache = new Map();
const finish = (metadata, url) => {
  const { doiCandidates: _dois, titleConfidence: _confidence, hasText: _hasText, ...data } = metadata;
  return completeMetadata({ ...data, url: data.url || url });
};
async function resolveURL(url, { fetchSource = fetchPublicSource, lookupDOI = fromDOI, readPDF = readPDFMetadata, deadline = Date.now() + 27000 } = {}) {
  const lookedUp = new Map(), errors = [], drafts = [];
  const doiLookup = (doi) => {
    const key = doi.toLowerCase();
    if (!lookedUp.has(key)) lookedUp.set(key, Promise.resolve().then(() => lookupDOI(doi, undefined, { deadline })).catch(() => null));
    return lookedUp.get(key);
  };
  const pathDOIs = findDOIs(url.pathname, { path: true });
  if (/^(?:dx\.)?doi\.org$/i.test(url.hostname) && pathDOIs[0]) {
    const record = await doiLookup(pathDOIs[0]);
    if (record) return finish({ ...record, url: url.href }, url.href);
  }
  const landing = articleLandingURL(url.href);
  const queue = landing === url.href ? [url.href] : [landing, url.href], visited = new Set();
  while (queue.length && visited.size < 3 && deadline - Date.now() >= 100) {
    const next = queue.shift();
    if (visited.has(next)) continue;
    visited.add(next);
    try {
      const source = await fetchSource(publicURL(next).href, { deadline: Math.min(deadline, Date.now() + 11000), allowPDF: true });
      let metadata;
      if (source.type === 'pdf') metadata = await readPDF(source.data, source.url, { timeoutMs: Math.min(8000, Math.max(1, deadline - Date.now())) });
      else {
        metadata = parseHTMLMetadata(source.html, source.url);
        for (const link of documentLinks(source.html, source.url)) if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
      const expected = drafts.find((item) => requireUsableMetadata(item));
      if (expected && !matchingTitles(expected.title, metadata.title)) {
        errors.push(new AppError(422, 'METADATA_CONFLICT', 'Tautan dokumen tidak cocok dengan judul halaman artikel.'));
        continue;
      }
      drafts.push(metadata);
      const candidates = [...new Set([...(metadata.doiCandidates || []), metadata.doi, ...pathDOIs].filter(Boolean))].slice(0, 3);
      for (const doi of candidates) {
        const record = await doiLookup(doi);
        if (!record) continue;
        const titleMatches = matchingTitles(metadata.title, record.title);
        if (titleMatches || !requireUsableMetadata(metadata) && (!metadata.title || /^(?:pdf|download|loading)/i.test(metadata.title))) {
          const merged = source.type === 'pdf' ? mergeMetadata(record, metadata) : mergeMetadata(metadata, record);
          const complete = { ...merged, url: source.url, sourceURL: source.type === 'pdf' ? record.sourceURL || source.url : source.url,
            source: record.source + (source.type === 'pdf' ? ' + PDF' : ' + metadata penerbit') };
          if (requireUsableMetadata(complete)) return finish(complete, url.href);
        } else if (metadata.doi?.toLowerCase() === doi.toLowerCase()) {
          metadata.doi = '';
          metadata.warnings = [...(metadata.warnings || []), 'DOI tidak cocok dengan judul; data diambil dari sumber yang Anda buka.'];
        }
      }
      const useful = requireUsableMetadata(metadata);
      if (useful && (source.type === 'pdf' || metadata.authors?.length && metadata.year && (metadata.journal || metadata.publisher) || !queue.length)) return finish(metadata, url.href);
    } catch (error) {
      if (error instanceof AppError && ['PRIVATE_URL', 'INVALID_URL'].includes(error.code)) throw error;
      errors.push(error);
    }
  }
  const fallback = drafts.find(requireUsableMetadata);
  if (fallback) return finish(fallback, url.href);
  for (const doi of pathDOIs) {
    const record = await doiLookup(doi);
    if (record && !drafts.length) return finish({ ...record, url: url.href }, url.href);
  }
  if (drafts.some((item) => item.source.includes('PDF') && !item.hasText)) throw new AppError(422, 'PDF_TEXT_UNAVAILABLE', 'PDF berupa pindai/gambar atau tidak memiliki teks dan metadata yang cukup. Gunakan DOI, halaman artikel, atau isi data melalui input manual. Kredit tidak dipotong.');
  if (drafts.length) throw new AppError(422, 'METADATA_INCOMPLETE', 'Judul, penulis, atau tahun belum cukup untuk membuat sitasi yang dapat diperiksa. Coba DOI, tautan PDF publik, atau input manual. Kredit tidak dipotong.');
  const known = errors.find((error) => error instanceof AppError);
  if (known) throw known;
  throw new AppError(422, 'SOURCE_UNAVAILABLE', 'Artikel atau PDF belum dapat dibaca. Coba DOI atau input manual. Kredit tidak dipotong.');
}
export async function fromURL(input, options = {}) {
  const url = normalizeSourceURL(input);
  const cacheable = !options.fetchSource && !options.lookupDOI && !options.readPDF;
  if (!cacheable) return resolveURL(url, options);
  const cached = urlMetadataCache.get(url.href);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(await cached.promise);
  const promise = resolveURL(url, options);
  urlMetadataCache.set(url.href, { promise, expiresAt: Date.now() + 60000 });
  if (urlMetadataCache.size > 64) urlMetadataCache.delete(urlMetadataCache.keys().next().value);
  try { return structuredClone(await promise); }
  catch (error) { urlMetadataCache.delete(url.href); throw error; }
}

export function fromManual(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'INVALID_MANUAL', 'Lengkapi formulir referensi.');
  const get = (key, length = 1000) => typeof input[key] === 'string' ? text(input[key]).slice(0, length) : '';
  const title = get('title');
  const author = get('author');
  const year = typeof input.year === 'string' ? input.year.trim() : '';
  const authors = author.split(';').filter((name) => name.trim()).map(parseAuthor);
  if (!title || !authors.length || !/^(1[5-9]\d{2}|20\d{2})$/.test(year)) {
    throw new AppError(400, 'INVALID_MANUAL', 'Isi penulis, judul, dan tahun terbit empat digit.');
  }
  const doi = get('doi', 500);
  if (doi && !isDOI(doi)) throw new AppError(400, 'INVALID_DOI', 'DOI opsional belum valid.');
  const month = get('month', 10);
  if (month && !/^(?:0?[1-9]|1[0-2])$/.test(month)) throw new AppError(400, 'INVALID_MONTH', 'Pilih bulan terbit antara Januari dan Desember.');
  return completeMetadata({ title, year, authors,
    month: month ? String(Number(month)) : '',
    journal: get('journal'), volume: get('volume', 50), issue: get('issue', 50), page: get('page', 100),
    publisher: get('publisher'), doi: cleanDOI(doi), source: 'Input manual' });
}


export async function resolveMetadata(mode, input, options = {}) {
  let metadata;
  if (mode === 'doi') metadata = await fromDOI(input);
  else if (mode === 'url') metadata = await fromURL(input);
  else if (mode === 'manual') {
    metadata = fromManual(input);
    if (metadata.doi && options.enabled !== false) {
      try {
        const reference = await fromDOI(metadata.doi);
        metadata = { ...reference, ...metadata, journal: metadata.journal || reference.journal,
          publisher: metadata.publisher || reference.publisher, city: reference.city,
          month: metadata.month || (metadata.year === reference.year ? reference.month : ''),
          sourceURL: reference.sourceURL, issn: reference.issn };
      } catch { /* Manual input remains usable when its optional DOI is unavailable. */ }
    }
  } else throw new AppError(400, 'INVALID_MODE', 'Pilih sumber referensi yang tersedia.');
  return enrichCity(metadata, options);
}
