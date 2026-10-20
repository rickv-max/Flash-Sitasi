import { load } from 'cheerio';
import { isDOI, cleanDOI } from '../shared/citations.js';

export const plainText = (value = '') => load(String(value ?? ''), null, false).text().replace(/\s+/g, ' ').trim().slice(0, 3000);
export function completeMetadata(data) {
  const warnings = [...(data.warnings || [])];
  if (!data.authors?.length) warnings.push('Penulis tidak tercantum di metadata.');
  if (!data.year) warnings.push('Tahun terbit tidak tercantum.');
  return { ...data, warnings: [...new Set(warnings)].slice(0, 8) };
}
export function findDOIs(value, { path = false } = {}) {
  let input = String(value || '');
  try { input = decodeURIComponent(input); } catch { /* Keep a usable URL with malformed escapes. */ }
  const found = [];
  for (const match of input.matchAll(/10\.\d{4,9}\/[^\s<>"?#]+/gi)) {
    let doi = cleanDOI(match[0]).replace(/[.,;:]+$/, '');
    if (path) doi = doi.replace(/\.pdf$/i, '').replace(/\/(?:full|fulltext|pdf|epdf)$/i, '');
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (doi.endsWith(close) && doi.split(close).length > doi.split(open).length) doi = doi.slice(0, -1);
    }
    if (isDOI(doi) && doi.length <= 500 && !found.some((item) => item.toLowerCase() === doi.toLowerCase())) found.push(doi);
  }
  return found.slice(0, 4);
}
export function matchingTitles(first, second) {
  const normalize = (title) => plainText(title).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const a = normalize(first), b = normalize(second);
  if (!a || !b) return false;
  if (a === b) return true;
  const left = new Set(a.split(' ').filter((word) => word.length > 2));
  const right = new Set(b.split(' ').filter((word) => word.length > 2));
  const common = [...left].filter((word) => right.has(word)).length;
  return common >= 2 && common / Math.max(left.size, right.size) >= .65;
}
export function mergeMetadata(primary, secondary) {
  const data = { ...secondary, ...primary };
  for (const field of ['title', 'year', 'journal', 'volume', 'issue', 'page', 'publisher', 'city', 'doi', 'url', 'sourceURL']) {
    data[field] = primary[field] || secondary[field] || '';
  }
  // A month must belong to the selected publication year.
  data.month = primary.month || ((!primary.year || primary.year === secondary.year) ? secondary.month || '' : '');
  data.authors = primary.authors?.length ? primary.authors : secondary.authors || [];
  data.issn = [...new Set([...(primary.issn || []), ...(secondary.issn || [])])].slice(0, 4);
  data.citySource = primary.city ? primary.citySource || null : secondary.citySource || null;
  // Recompute missing-field warnings after filling gaps.
  data.warnings = [...(primary.warnings || []), ...(secondary.warnings || [])]
    .filter((warning) => !/^(Penulis tidak tercantum|Tahun terbit tidak tercantum)/.test(warning));
  return completeMetadata(data);
}
export function requireUsableMetadata(data) {
  if (!data.title || /^(?:untitled|document\d*|pdf(?:\s+viewer)?|download|loading|please wait|404|not found|page not found|login|log in|sign in|masuk)(?:[.!:\s]|$)/i.test(data.title)) return false;
  return !!(data.authors?.length || data.year);
}
