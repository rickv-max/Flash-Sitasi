// Only these formatting tags are generated. Every external value is escaped.
export const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const decodeEntities = (value = '') => String(value).replace(/&(amp|lt|gt|quot|#39|nbsp);/g,
  (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }[entity]));

export function citationParts(html = '') {
  let italic = false;
  return String(html).split(/(<\/?i>)/g).flatMap((text) => {
    if (text === '<i>') { italic = true; return []; }
    if (text === '</i>') { italic = false; return []; }
    return text ? [{ text: decodeEntities(text), italic }] : [];
  });
}

export const plainCitation = (html) => citationParts(html).map((part) => part.text).join('');
export const safeCitationHTML = (html) => citationParts(html).map(({ text, italic }) =>
  italic ? `<i>${escapeHTML(text)}</i>` : escapeHTML(text)).join('');

export function cleanDOI(value = '') {
  return value.trim().replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
}

export function isDOI(value) {
  return /^10\.\d{4,9}\/\S+$/i.test(cleanDOI(value));
}

export function parseAuthor(name) {
  if (name.includes(',')) {
    const [family, ...given] = name.split(',');
    return { family: family.trim(), given: given.join(',').trim() };
  }
  const words = name.trim().split(/\s+/);
  return { family: words.pop() || '', given: words.join(' ') };
}

const initials = (name = '') => name.split(/[\s-]+/).filter(Boolean).map((word) => `${word[0].toUpperCase()}.`).join(' ');
const fullName = (author) => author.literal || [author.given, author.family].filter(Boolean).join(' ');
const lastName = (author) => author.literal || author.family || author.given || '';
const joinNames = (names, conjunction = 'dan') => names.length < 2 ? names[0] || '' :
  `${names.slice(0, -1).join(', ')} ${conjunction} ${names.at(-1)}`;

export function buildCitations(metadata, city = '') {
  const authors = (metadata.authors || []).filter((a) => fullName(a));
  const year = escapeHTML(metadata.year || 'n.d.');
  const title = escapeHTML(metadata.title || 'Tanpa judul');
  const journal = escapeHTML(metadata.journal || '');
  const volume = escapeHTML(metadata.volume || '');
  const issue = escapeHTML(metadata.issue || '');
  const pages = escapeHTML(metadata.page || '').replace(/(\d)-(\d)/g, '$1–$2');
  const publisher = escapeHTML(metadata.publisher || '');
  const location = escapeHTML(city || metadata.city || '');
  const url = escapeHTML(metadata.doi ? `https://doi.org/${cleanDOI(metadata.doi)}` : metadata.url || '');
  const footAuthors = authors.length > 3 ? `${escapeHTML(fullName(authors[0]))} et al.` :
    joinNames(authors.map((a) => escapeHTML(fullName(a)))) || 'Penulis tidak tercantum';
  const bibAuthors = authors.map((a, index) => escapeHTML(index === 0 && !a.literal && a.given ?
    `${a.family}, ${a.given}` : fullName(a)));
  const journalDetails = [journal ? `<i>${journal}</i>` : publisher, volume,
    issue ? `no. ${issue}` : ''].filter(Boolean).join(', ');
  const footnote = `${footAuthors}, “${title},” ${journalDetails ? `${journalDetails} ` : ''}(${location ? `${location}, ` : ''}${year})${pages ? `: ${pages}` : ''}.${url ? ` ${url}` : ''}`;
  const bibliography = `${joinNames(bibAuthors) || 'Penulis tidak tercantum'}. “${title}.” ${journalDetails}${location ? `, ${location}` : ''}${journalDetails || location ? ', ' : ''}${year}${pages ? `, ${pages}` : ''}.${url ? ` ${url}` : ''}`;
  let apaNames = authors.map((a) => escapeHTML(a.literal || `${a.family}${a.given ? `, ${initials(a.given)}` : ''}`));
  let apaAuthors;
  if (apaNames.length > 20) apaAuthors = `${apaNames.slice(0, 19).join(', ')}, … ${apaNames.at(-1)}`;
  else apaAuthors = apaNames.length > 1 ? `${apaNames.slice(0, -1).join(', ')}, & ${apaNames.at(-1)}` : apaNames[0];
  const apaStart = apaAuthors ? `${apaAuthors} (${year}). ${title}.` : `${journal ? title : `<i>${title}</i>`}. (${year}).`;
  const apaReference = `${apaStart}${journal ? ` <i>${journal}</i>${volume ? `, <i>${volume}</i>` : ''}${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}.` : publisher ? ` ${publisher}.` : ''}${url ? ` ${url}` : ''}`;
  const inTextAuthor = authors.length > 2 ? `${escapeHTML(lastName(authors[0]))} et al.` :
    authors.length === 2 ? authors.map((a) => escapeHTML(lastName(a))).join(' & ') :
      authors.length ? escapeHTML(lastName(authors[0])) : `“${title}”`;
  return { footnote, bibliography, apaInText: `(${inTextAuthor}, ${year})`, apaReference };
}

export function getCitationResults(item) {
  if (item.results) return item.results;
  // Preserve citations saved by the original application.
  return { footnote: item.footnote || '', bibliography: item.dafpus || '',
    apaInText: item.apaInText || '', apaReference: item.apaRef || '' };
}

export const DEMO_DOI = '10.1038/nature14539';
export const DEMO_METADATA = {
  title: 'Deep learning', authors: [{ given: 'Yann', family: 'LeCun' },
    { given: 'Yoshua', family: 'Bengio' }, { given: 'Geoffrey', family: 'Hinton' }],
  year: '2015', journal: 'Nature', volume: '521', issue: '7553', page: '436-444',
  doi: DEMO_DOI, source: 'Data contoh · Nature', warnings: [],
};
