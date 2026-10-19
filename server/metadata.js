import { load } from 'cheerio';
import { cleanDOI, isDOI, parseAuthor } from '../shared/citations.js';
import { AppError } from './errors.js';
import { fetchPublicHTML, publicURL } from './safe-fetch.js';
import { cityFromHTML, enrichCity } from './city.js';

const text = (value = '') => load(String(value), null, false).text().replace(/\s+/g, ' ').trim().slice(0, 3000);

function completeMetadata(data) {
  const warnings = [];
  if (!data.authors?.length) warnings.push('Penulis tidak tercantum di metadata.');
  if (!data.year) warnings.push('Tahun terbit tidak tercantum.');
  return { ...data, warnings };
}

export async function fromDOI(input, fetcher = fetch) {
  const doi = cleanDOI(input);
  if (!isDOI(doi) || doi.length > 500) throw new AppError(400, 'INVALID_DOI', 'Format DOI belum valid. Contoh: 10.1038/nature14539.');
  try {
    const response = await fetcher(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const { message: item } = await response.json();
      if (!item?.title?.[0]) throw new Error('No title');
      const date = item['published-print'] || item['published-online'] || item.issued;
      return completeMetadata({
        title: text(item.title[0]), authors: (item.author || []).map((a) => ({ given: text(a.given), family: text(a.family), ...(a.name ? { literal: text(a.name) } : {}) })),
        year: String(date?.['date-parts']?.[0]?.[0] || ''),
        journal: text(item['container-title']?.[0]), volume: text(item.volume), issue: text(item.issue),
        page: text(item.page), publisher: text(item.publisher), city: text(item['publisher-location'] || item['publisher-place']),
        doi: item.DOI || doi, issn: (item.ISSN || []).filter((value) => typeof value === 'string').slice(0, 4),
        sourceURL: typeof item.URL === 'string' ? item.URL.replace(/^http:/, 'https:') : '', source: 'Crossref',
      });
    }
    if (response.status !== 404) throw new Error('Crossref unavailable');
  } catch { /* Return a useful, non-billable error; never follow an unvalidated DOI redirect. */ }
  throw new AppError(422, 'DOI_NOT_FOUND', 'Metadata DOI belum ditemukan. Periksa DOI, coba lagi, atau lengkapi melalui input manual.');
}

export function parseHTMLMetadata(html, url) {
  const $ = load(html);
  const meta = {};
  $('meta').each((_, node) => {
    const name = ($(node).attr('name') || $(node).attr('property') || '').toLowerCase();
    const content = text($(node).attr('content'));
    if (name && content) (meta[name] ||= []).push(content);
  });
  const get = (...keys) => keys.map((key) => meta[key]?.[0]).find(Boolean) || '';
  const title = get('citation_title', 'dc.title', 'og:title') || text($('title').text());
  if (!title || /^(just a moment|attention required|access denied|security check|robot or human)/i.test(title)) {
    throw new AppError(422, 'SOURCE_BLOCKED', 'Metadata halaman tidak tersedia. Coba DOI artikel atau input manual.');
  }
  const doi = get('citation_doi', 'dc.identifier.doi', 'prism.doi');
  const first = get('citation_firstpage', 'prism.startingpage');
  const last = get('citation_lastpage', 'prism.endingpage');
  const names = meta.citation_author || meta['dc.creator.personalname'] || meta['dc.creator'] || meta.author || [];
  return completeMetadata({ title, authors: [...new Set(names)].map(parseAuthor),
    year: get('citation_publication_date', 'citation_date', 'dc.date.issued', 'dc.date', 'article:published_time').match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[0] || '',
    journal: get('citation_journal_title', 'dc.source', 'og:site_name'),
    volume: get('citation_volume', 'prism.volume'), issue: get('citation_issue', 'prism.number'),
    page: first && last && first !== last ? `${first}-${last}` : first,
    publisher: get('citation_publisher', 'dc.publisher'), doi: isDOI(doi) ? cleanDOI(doi) : '',
    url, sourceURL: url, issn: [...new Set([get('citation_issn'), get('citation_eissn')].filter(Boolean))],
    ...(cityFromHTML(html, url) || {}), source: 'Metadata penerbit' });
}

export async function fromURL(input) {
  const url = publicURL(input);
  const doi = decodeURIComponent(url.href).match(/10\.\d{4,9}\/[^\s?#]+/i)?.[0]?.replace(/\.pdf$/i, '');
  if (doi && isDOI(doi)) return fromDOI(doi);
  // OJS download URLs are normalized to the article metadata page, avoiding raw PDFs.
  url.pathname = url.pathname.replace(/\/article\/(?:download|viewFile)\/(\d+)(?:\/.*)?$/i, '/article/view/$1');
  const source = await fetchPublicHTML(url.href);
  const metadata = parseHTMLMetadata(source.html, source.url);
  if (metadata.doi) {
    try {
      const crossref = await fromDOI(metadata.doi);
      return { ...crossref, sourceURL: source.url, url: source.url,
        ...(!crossref.city && metadata.city ? { city: metadata.city, citySource: metadata.citySource } : {}) };
    } catch { /* Retain publisher metadata. */ }
  }
  return metadata;
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
  return completeMetadata({ title, year, authors,
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
          sourceURL: reference.sourceURL, issn: reference.issn };
      } catch { /* Manual input remains usable when its optional DOI is unavailable. */ }
    }
  } else throw new AppError(400, 'INVALID_MODE', 'Pilih sumber referensi yang tersedia.');
  return enrichCity(metadata, options);
}
