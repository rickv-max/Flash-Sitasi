import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { fetchPublicHTML, publicURL } from './safe-fetch.js';

const plain = (value = '') => load(String(value), null, false).text().replace(/\s+/g, ' ').trim();
export const normalizeName = (value = '') => plain(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const locationKey = (kind, value) => createHash('sha256').update(`${kind}:${normalizeName(value)}`).digest('hex');

// Used only inside labelled address/contact blocks, never to infer from an author affiliation.
const LOCALITIES = [
  'Tangerang Selatan', 'Jakarta Selatan', 'Jakarta Timur', 'Jakarta Barat', 'Jakarta Pusat', 'Jakarta Utara',
  'Banda Aceh', 'Bandar Lampung', 'Pangkal Pinang', 'Pangkalpinang', 'Tanjung Pinang', 'Tanjungpinang',
  'Palangka Raya', 'Palangkaraya', 'Tanjung Selor', 'Bengkulu', 'Pekanbaru', 'Batam', 'Jambi', 'Palembang',
  'Lhokseumawe', 'Langsa', 'Sabang', 'Medan', 'Binjai', 'Pematangsiantar', 'Padang Sidempuan', 'Padangsidimpuan',
  'Padang', 'Bukittinggi', 'Payakumbuh', 'Batusangkar', 'Pariaman', 'Dumai', 'Metro', 'Lubuklinggau',
  'Jakarta', 'Bogor', 'Depok', 'Bekasi', 'Bandung', 'Cimahi', 'Cirebon', 'Tasikmalaya', 'Sukabumi', 'Banjar',
  'Cianjur', 'Sumedang', 'Subang', 'Garut', 'Purwakarta', 'Karawang', 'Indramayu', 'Kuningan', 'Majalengka',
  'Serang', 'Cilegon', 'Tangerang', 'Pandeglang', 'Rangkasbitung', 'Tigaraksa',
  'Yogyakarta', 'Sleman', 'Bantul', 'Wates', 'Gunungkidul', 'Semarang', 'Surakarta', 'Solo', 'Salatiga', 'Magelang',
  'Purwokerto', 'Banyumas', 'Tegal', 'Pekalongan', 'Kudus', 'Jepara', 'Pati', 'Rembang', 'Demak', 'Ungaran',
  'Kendal', 'Temanggung', 'Wonosobo', 'Klaten', 'Sukoharjo', 'Karanganyar', 'Wonogiri', 'Boyolali', 'Sragen',
  'Kebumen', 'Purworejo', 'Cilacap', 'Brebes', 'Pemalang', 'Surabaya', 'Malang', 'Batu', 'Sidoarjo', 'Gresik',
  'Lamongan', 'Mojokerto', 'Jombang', 'Kediri', 'Blitar', 'Tulungagung', 'Trenggalek', 'Ponorogo', 'Madiun',
  'Ngawi', 'Magetan', 'Nganjuk', 'Tuban', 'Bojonegoro', 'Pasuruan', 'Probolinggo', 'Lumajang', 'Jember',
  'Banyuwangi', 'Bondowoso', 'Situbondo', 'Bangkalan', 'Pamekasan', 'Sampang', 'Sumenep',
  'Denpasar', 'Singaraja', 'Badung', 'Tabanan', 'Gianyar', 'Mataram', 'Bima', 'Sumbawa', 'Lombok Timur',
  'Kupang', 'Maumere', 'Ende', 'Ruteng', 'Waingapu', 'Waikabubak', 'Atambua',
  'Pontianak', 'Singkawang', 'Sambas', 'Ketapang', 'Sintang', 'Banjarmasin', 'Banjarbaru', 'Martapura',
  'Samarinda', 'Balikpapan', 'Bontang', 'Tenggarong', 'Tarakan', 'Nunukan',
  'Makassar', 'Gowa', 'Maros', 'Parepare', 'Palopo', 'Watampone', 'Bulukumba', 'Pinrang', 'Sidrap', 'Enrekang',
  'Manado', 'Tomohon', 'Bitung', 'Tondano', 'Gorontalo', 'Palu', 'Poso', 'Luwuk', 'Kendari', 'Baubau',
  'Kolaka', 'Mamuju', 'Majene', 'Polewali', 'Ambon', 'Tual', 'Ternate', 'Tidore', 'Sofifi',
  'Jayapura', 'Manokwari', 'Sorong', 'Merauke', 'Wamena', 'Nabire', 'Timika', 'Biak',
  'New York', 'New Delhi', 'Kuala Lumpur', 'Hong Kong', 'San Francisco', 'Los Angeles', 'Washington',
  'London', 'Oxford', 'Cambridge', 'Amsterdam', 'Berlin', 'Heidelberg', 'Cham', 'Basel', 'Singapore',
  'Paris', 'Tokyo', 'Seoul', 'Beijing', 'Taipei', 'Sydney', 'Melbourne', 'Boston', 'Philadelphia', 'Toronto',
  'Ottawa', 'Vancouver', 'Chicago', 'Baltimore', 'Dubai', 'Dordrecht', 'Boca Raton', 'Hoboken', 'Leiden',
].sort((a, b) => b.length - a.length);
const regexEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cityPattern = new RegExp(`(?<![\\p{L}])(${LOCALITIES.map(regexEscape).join('|')})(?![\\p{L}])`, 'giu');

export function cleanCity(value) {
  const city = plain(value).replace(/^(?:kota|kabupaten|kab\.)\s+/i, '').replace(/^\s*[,;:.-]|[,;:.]\s*$/g, '').trim();
  if (!city || city.length > 100 || /(?:https?:|@|\/|\d{3}|\b(?:jalan|jl\.?|street|road|postal|box)\b)/i.test(city) ||
      /^(indonesia|united states|united kingdom|netherlands|germany|australia|malaysia|singapore republic)$/i.test(city)) return '';
  return city;
}

export function cityFromAddress(value) {
  const text = plain(value);
  const labelled = text.match(/\b(?:kota|kabupaten|kab\.)\s+([\p{L}\s.-]{2,70})/iu)?.[1];
  const matched = [...(labelled || text).matchAll(cityPattern)];
  if (!matched.length) return '';
  const found = matched.at(-1)[1];
  const canonical = LOCALITIES.find((name) => name.toLowerCase() === found.toLowerCase()) || found;
  return /^Jakarta /.test(canonical) ? 'Jakarta' : canonical === 'Solo' ? 'Surakarta' : canonical;
}

function result(city, type, url, confidence = 'high', evidence = '') {
  return { city: cleanCity(city), citySource: { type, url: url || '', confidence,
    label: ({ crossref: 'Metadata Crossref', meta: 'Metadata penerbit', jsonld: 'Alamat penerbit (JSON-LD)',
      microdata: 'Alamat penerbit (microdata)', contact: 'Alamat kontak jurnal', admin: 'Direktori terverifikasi admin' })[type] || type,
    evidence: plain(evidence || city).slice(0, 180), retrievedAt: Date.now() } };
}

export function cityFromHTML(html, url, metadata = {}) {
  const $ = load(html);
  const meta = {};
  $('meta').each((_, el) => { const name = ($(el).attr('name') || $(el).attr('property') || '').toLowerCase(); meta[name] ||= $(el).attr('content') || ''; });
  for (const key of ['citation_publisher_location', 'citation_publisher_place', 'citation_publication_place', 'dc.publisher.location', 'dc.publisher.place', 'publisher-place', 'publisher_location']) {
    const city = cleanCity(meta[key] || '');
    if (city) return result(city, 'meta', url, 'high', `${key}: ${city}`);
  }
  const objects = [];
  const collect = (value, depth = 0) => {
    if (depth > 8 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((item) => collect(item, depth + 1)); return; }
    objects.push(value);
    if (value['@graph']) collect(value['@graph'], depth + 1);
    if (value.isPartOf) collect(value.isPartOf, depth + 1);
  };
  $('script[type="application/ld+json"]').slice(0, 12).each((_, node) => {
    const source = $(node).html() || '';
    if (source.length < 250000) { try { collect(JSON.parse(source)); } catch { /* Ignore invalid publisher markup. */ } }
  });
  const byId = new Map(objects.filter((item) => item['@id']).map((item) => [item['@id'], item]));
  const resolve = (node) => node?.['@id'] ? { ...byId.get(node['@id']), ...node } : node;
  const publishers = objects.flatMap((item) => item.publisher ? Array.isArray(item.publisher) ? item.publisher : [item.publisher] : []);
  const namedPublisher = normalizeName(metadata.publisher);
  for (const item of objects) if (namedPublisher && normalizeName(item.name) === namedPublisher && /Organization|Publisher|CollegeOrUniversity/i.test(String(item['@type']))) publishers.push(item);
  for (const candidate of publishers) {
    const publisher = resolve(candidate);
    const rawAddress = publisher?.address || resolve(publisher?.location)?.address;
    for (const entry of Array.isArray(rawAddress) ? rawAddress : [rawAddress]) {
      const address = resolve(entry);
      const city = cleanCity(address?.addressLocality || '');
      if (city) return result(city, 'jsonld', url, 'high', `${publisher.name || metadata.publisher || 'Publisher'}: ${city}`);
    }
  }
  const microCity = $('[itemprop="publisher"] [itemprop="addressLocality"]').first();
  const city = cleanCity(microCity.attr('content') || microCity.text());
  if (city) return result(city, 'microdata', url);
  const blocks = [];
  for (const selector of ['.publisher-address', '.publisher_address', '#publisherAddress', '[itemprop="publisher"] address', '.journal-address', '.contact .contact-primary', '.contact .address', '.page_contact .address', '.pkp_page_about .contact .contact-primary', '.page_contact .contact-primary']) {
    $(selector).slice(0, 4).each((_, node) => blocks.push($(node).text()));
  }
  const contactPage = /\/(?:about\/contact|contact(?:-us)?)(?:[/.?#]|$)/i.test(url);
  if (contactPage) $('.contact,.page_contact,address').slice(0, 6).each((_, node) => blocks.push($(node).text()));
  for (const block of blocks) {
    const found = cityFromAddress(block);
    if (found) return result(found, 'contact', url, 'medium', `Alamat kontak jurnal menyebut ${found}`);
  }
  return null;
}

export function contactLinks(html, sourceURL) {
  const $ = load(html); const base = publicURL(sourceURL); const links = [];
  $('a[href]').each((_, node) => {
    const href = $(node).attr('href'); const label = $(node).text();
    if (!/about\/contact|\b(?:contact|kontak|alamat penerbit)\b/i.test(`${href} ${label}`)) return;
    try { const url = new URL(href, base); if (url.origin === base.origin && !url.hash && url.protocol === 'https:') links.push(url.href); } catch { /* Ignore malformed navigation. */ }
  });
  const ojs = base.pathname.match(/^(.*?)(?:\/article\/.*|\/about(?:\/.*)?)$/);
  if (ojs) links.push(`${base.origin}${ojs[1]}/about/contact`);
  return [...new Set(links)].slice(0, 2);
}

export function overrideKeys(metadata) {
  const keys = [];
  for (const issn of metadata.issn || []) if (issn) keys.push(locationKey('issn', issn));
  if (metadata.journal) keys.push(locationKey('journal', metadata.journal));
  try {
    const url = new URL(metadata.sourceURL || metadata.url);
    // OJS hosts can serve many journals: match the journal path, not just the host.
    const journalPath = url.pathname.match(/^(.*?)(?:\/article\/|\/about\/)/)?.[1];
    if (journalPath) keys.push(locationKey('journal-url', `${url.origin}${journalPath}`));
  } catch { /* No source URL available. */ }
  if (metadata.publisher) keys.push(locationKey('publisher', metadata.publisher));
  return keys;
}

export async function enrichCity(metadata, { repo, fetchHTML = fetchPublicHTML, enabled = true } = {}) {
  if (!enabled) return { ...metadata, city: '', citySource: null, cityStatus: 'disabled' };
  const cacheKey = createHash('sha256').update(JSON.stringify({ doi: metadata.doi || '', url: metadata.sourceURL || metadata.url || '', journal: metadata.journal || '', publisher: metadata.publisher || '' })).digest('hex');
  if (repo?.getCityOverride) {
    const override = await repo.getCityOverride(overrideKeys(metadata));
    if (override) return { ...metadata, ...result(override.city, 'admin', override.sourceURL, 'high', override.reason || override.matchValue), cityStatus: 'found' };
  }
  if (cleanCity(metadata.city || '')) return { ...metadata, city: cleanCity(metadata.city), citySource: metadata.citySource || result(metadata.city, 'crossref', metadata.sourceURL).citySource, cityStatus: 'found' };
  if (repo?.getCityCache) {
    const cached = await repo.getCityCache(cacheKey);
    if (cached) return { ...metadata, ...cached, cityCached: true };
  }
  let found = null;
  const sourceURL = metadata.sourceURL || metadata.url;
  if (sourceURL) {
    try {
      const source = await fetchHTML(publicURL(sourceURL).href);
      found = cityFromHTML(source.html, source.url || sourceURL, metadata);
      if (!found) {
        const links = contactLinks(source.html, source.url || sourceURL);
        const pages = await Promise.allSettled(links.map((link) => fetchHTML(link)));
        for (const page of pages) if (page.status === 'fulfilled') {
          const candidate = cityFromHTML(page.value.html, page.value.url, metadata);
          if (candidate && (!found || candidate.citySource.confidence === 'high')) found = candidate;
        }
      }
    } catch { /* An unavailable contact page must not make a valid citation fail. */ }
  }
  const cityData = found ? { ...found, cityStatus: 'found' } : { city: '', citySource: null, cityStatus: 'not_found' };
  if (repo?.setCityCache) { try { await repo.setCityCache(cacheKey, cityData); } catch { /* Cache is optional. */ } }
  return { ...metadata, ...cityData };
}
