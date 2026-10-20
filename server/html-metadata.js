import { load } from 'cheerio';
import { parseAuthor } from '../shared/citations.js';
import { publicationDate } from '../shared/publication-date.js';
import { AppError } from './errors.js';
import { cityFromHTML } from './city.js';
import { publicURL } from './safe-fetch.js';
import { plainText as text, completeMetadata, findDOIs } from './source-metadata.js';

const array = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const nodeName = (value) => text(typeof value === 'string' ? value : value?.name || value?.headline || value?.['@value'] || '');
function structuredArticle($, url) {
  const nodes = [];
  $('script[type="application/ld+json"]').slice(0, 8).each((_, element) => {
    const source = $(element).text();
    if (source.length > 250000) return;
    try {
      const visit = (value, depth = 0) => {
        if (depth > 5 || nodes.length >= 160) return;
        for (const node of array(value)) if (node && typeof node === 'object') {
          nodes.push(node);
          if (node['@graph']) visit(node['@graph'], depth + 1);
          if (node.mainEntity && typeof node.mainEntity === 'object') visit(node.mainEntity, depth + 1);
        }
      };
      visit(JSON.parse(source));
    } catch { /* Broken JSON-LD must not hide valid citation meta tags. */ }
  });
  const ids = new Map(nodes.filter((node) => typeof node['@id'] === 'string').map((node) => [node['@id'], node]));
  const resolve = (node) => node && typeof node === 'object' && node['@id'] && ids.has(node['@id']) ? { ...ids.get(node['@id']), ...node } : node;
  const types = (node) => array(node?.['@type']).map((type) => String(type).split('/').at(-1).toLowerCase());
  const candidates = nodes.filter((node) => types(node).some((type) => /^(?:scholarlyarticle|article|newsarticle|blogposting|report|book|chapter|thesis|creativework)$/.test(type)) && nodeName(node));
  const exactURL = (node) => {
    try { return new URL(node.url || node.mainEntityOfPage?.['@id'] || node['@id'], url).href.split('#')[0] === url.split('#')[0]; }
    catch { return false; }
  };
  candidates.sort((a, b) => Number(exactURL(b)) - Number(exactURL(a)) || Number(types(b).includes('scholarlyarticle')) - Number(types(a).includes('scholarlyarticle')));
  const article = candidates[0] || {};
  const authors = array(article.author || article.creator).map(resolve).flatMap((author) => {
    if (typeof author === 'string') return text(author) ? [parseAuthor(text(author))] : [];
    if (!author || typeof author !== 'object') return [];
    if (types(author).includes('organization')) return nodeName(author) ? [{ literal: nodeName(author) }] : [];
    if (author.familyName || author.givenName) return [{ family: text(author.familyName), given: text(author.givenName) }];
    return nodeName(author) ? [parseAuthor(nodeName(author))] : [];
  });
  const chain = [];
  let parent = resolve(article.isPartOf);
  for (let depth = 0; parent && depth < 4; depth++) {
    if (typeof parent === 'string') { chain.push({ name: parent }); break; }
    chain.push(parent); parent = resolve(parent.isPartOf);
  }
  const journal = chain.find((node) => types(node).some((type) => /periodical|journal/.test(type))) ||
    chain.find((node) => node.name && !types(node).some((type) => /issue|volume/.test(type)));
  const identifiers = [article.doi, ...array(article.identifier).flatMap((value) => typeof value === 'object' ? [value?.propertyID?.toLowerCase?.() === 'doi' ? value.value : '', value?.['@id']] : [value]), article.sameAs];
  return { title: nodeName(article), authors, ...publicationDate(article.datePublished || article.publication?.startDate),
    journal: nodeName(journal), publisher: nodeName(resolve(article.publisher)),
    volume: text(article.volumeNumber || chain.find((node) => node.volumeNumber)?.volumeNumber || ''),
    issue: text(article.issueNumber || chain.find((node) => node.issueNumber)?.issueNumber || ''),
    page: text(article.pagination || [article.pageStart, article.pageEnd].filter(Boolean).join('-')),
    doi: findDOIs(identifiers.flat().filter(Boolean).join(' '))[0] || '',
    issn: array(journal?.issn || article.issn).map(text).filter(Boolean) };
}
export function parseHTMLMetadata(html, url) {
  const $ = load(html), meta = {};
  $('meta').each((_, node) => {
    const name = ($(node).attr('name') || $(node).attr('property') || '').toLowerCase().trim();
    const content = text($(node).attr('content'));
    if (name && content) (meta[name] ||= []).push(content);
  });
  const get = (...keys) => keys.map((key) => meta[key]?.[0]).find(Boolean) || '';
  const json = structuredArticle($, url);
  const browserTitle = text($('title').first().text());
  const title = get('citation_title') || json.title || get('dc.title', 'dc:title', 'dcterms.title', 'og:title', 'twitter:title') ||
    text($('h1.article-title, h1.page_title, h1.entry-title, article h1, main h1, h1').first().text()) || browserTitle;
  if (!title || /^(just a moment|attention required|access denied|security check|robot or human|verify (?:you|your)|checking your browser|enable javascript|log in|sign in|page not found|404\b)/i.test(title) ||
      /^(just a moment|attention required|access denied|security check|robot or human)/i.test(browserTitle)) {
    throw new AppError(422, 'SOURCE_BLOCKED', 'Halaman dibatasi, memerlukan login, atau tidak memuat artikel. Coba tautan PDF publik, DOI, atau input manual.');
  }
  const first = get('citation_firstpage', 'prism.startingpage', 'prism:startingpage');
  const last = get('citation_lastpage', 'prism.endingpage', 'prism:endingpage');
  const names = meta.citation_author || meta['dc.creator.personalname'] || meta['dc.creator'] || meta['dc:creator'] || meta['dcterms.creator'] || meta.author;
  const byline = $('[rel="author"], .item.authors .name, [itemprop="author"] [itemprop="name"]').map((_, node) => text($(node).text())).get().filter(Boolean);
  const authors = names?.length ? [...new Set(names.flatMap((value) => value.split(/\s*;\s*/)).filter(Boolean))].map(parseAuthor) :
    json.authors.length ? json.authors : [...new Set(byline)].slice(0, 50).map(parseAuthor);
  const date = publicationDate(get('citation_publication_date', 'citation_date', 'dc.date.issued', 'dcterms.issued', 'dc.date', 'dc:date', 'article:published_time', 'date'));
  const doi = findDOIs(get('citation_doi', 'dc.identifier.doi', 'prism.doi', 'prism:doi', 'dc.identifier', 'dc:identifier') || json.doi)[0] || '';
  return completeMetadata({ title, authors,
    year: date.year || json.year, month: date.year ? date.month : json.month,
    journal: get('citation_journal_title') || json.journal || get('dc.source', 'dc:source', 'prism.publicationname', 'prism:publicationname', 'og:site_name'),
    volume: get('citation_volume', 'prism.volume', 'prism:volume') || json.volume,
    issue: get('citation_issue', 'prism.number', 'prism:number') || json.issue,
    page: get('citation_pages') || (first && last && first !== last ? first + '-' + last : first) || json.page,
    publisher: get('citation_publisher', 'dc.publisher', 'dc:publisher', 'dcterms.publisher') || json.publisher, doi,
    url, sourceURL: url, issn: [...new Set([get('citation_issn', 'prism.issn', 'prism:issn'), get('citation_eissn'), ...json.issn].filter(Boolean))].slice(0, 4),
    ...(cityFromHTML(html, url) || {}), source: json.title ? 'Metadata terstruktur penerbit' : 'Metadata penerbit' });
}
export function articleLandingURL(input) {
  const url = new URL(input);
  url.pathname = url.pathname.replace(/\/article\/(?:download|viewFile|view)\/([^/]+)\/[^/]+(?:\/.*)?$/i, '/article/view/$1')
    .replace(/\/article\/(?:download|viewFile)\/([^/]+)\/?$/i, '/article/view/$1');
  return url.href;
}
export function documentLinks(html, sourceURL) {
  const $ = load(html), links = [];
  const add = (input) => {
    if (!input || links.length >= 8) return;
    try {
      const url = publicURL(new URL(input, sourceURL).href);
      if (url.href !== sourceURL && !links.includes(url.href)) links.push(url.href);
    } catch { /* Linked files use exactly the same public HTTPS validation as pasted URLs. */ }
  };
  $('meta[name="citation_pdf_url"], meta[name="DC.Identifier.URI"]').each((_, node) => {
    const value = $(node).attr('content');
    if ($(node).attr('name') === 'citation_pdf_url' || /\.pdf(?:[?#]|$)/i.test(value || '')) add(value);
  });
  $('iframe[src], embed[src], object[data]').each((_, node) => {
    const target = $(node).attr('src') || $(node).attr('data') || '';
    if (/pdf/i.test($(node).attr('type') || '') || /\.pdf(?:[?#]|$)|\/article\/(?:download|viewFile)\/|\/bitstream(?:s)?\/|(?:pdf|download|file|reader|viewer)[/?=]/i.test(target)) add(target);
  });
  $('a[href]').each((_, node) => {
    const href = $(node).attr('href') || '', label = text($(node).text());
    if (/\.pdf(?:[?#]|$)|\/article\/(?:download|viewFile)\//i.test(href) || /^(?:download(?:\s+pdf)?|unduh(?:\s+pdf)?|pdf)$/i.test(label)) add(href);
  });
  return links.slice(0, 3);
}
