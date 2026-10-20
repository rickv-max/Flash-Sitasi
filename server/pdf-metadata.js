import { getResolvedPDFJS } from 'unpdf';
import { parseAuthor } from '../shared/citations.js';
import { publicationDate } from '../shared/publication-date.js';
import { AppError } from './errors.js';
import { completeMetadata, findDOIs, plainText as text } from './source-metadata.js';
import { MAX_PDF_BYTES } from './safe-fetch.js';

const months = ['jan(?:uary|uari)?', 'feb(?:ruary|ruari)?', 'mar(?:ch|et)?', 'apr(?:il)?', 'm[ae][iy]', 'jun[ei]?', 'jul[yi]?', 'aug(?:ust)?|agu(?:stus)?', 'sep(?:tember)?', 'oct(?:ober)?|okt(?:ober)?', 'nov(?:ember)?', 'dec(?:ember)?|des(?:ember)?'];
function labeledDate(value) {
  const direct = publicationDate(value);
  const date = String(value || '');
  if (!direct.year) return direct;
  for (const [index, name] of months.entries()) if (new RegExp('\\b(?:' + name + ')\\b', 'i').test(date)) return { year: direct.year, month: String(index + 1) };
  return direct;
}
function authorList(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const name = text(item).replace(/\s*\([^)]*(?:@|correspond)[^)]*\)/gi, '').replace(/[\d*†‡¹²³⁴⁵⁶⁷⁸⁹]+/g, '').trim();
    let names = name.split(/\s*(?:;|\band\b|\bdan\b|&)\s*/i);
    if (names.length === 1 && name.includes(',') && name.split(',').every((part) => part.trim().split(/\s+/).length >= 2)) names = name.split(',');
    return names.map((part) => part.trim()).filter((part) => part.length >= 3 && part.length <= 150 &&
      /^[\p{L}\p{M}\s,.'’-]+$/u.test(part) && !/\b(?:universit|university|department|fakultas|jurusan|abstract|abstrak|email|issn|microsoft|administrator|user|author|penulis|windows)\b/i.test(part)).map(parseAuthor);
  }).slice(0, 50);
}
export function pdfTextLines(items) {
  const sorted = items.filter((item) => typeof item.str === 'string' && item.str.trim() && Array.isArray(item.transform))
    .slice(0, 12000).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  const lines = [];
  for (const item of sorted) {
    const y = item.transform[5], fontSize = Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
    let line = lines.at(-1);
    if (!line || Math.abs(line.y - y) > 2.5) { line = { text: '', y, fontSize }; lines.push(line); }
    line.text += (line.text && !line.text.endsWith('-') ? ' ' : '') + item.str;
    line.fontSize = Math.max(line.fontSize, fontSize);
  }
  return lines.map((line) => ({ ...line, text: text(line.text) }));
}
export function draftPDFMetadata({ info = {}, xmp = {}, pages = [] }, url) {
  const get = (key) => {
    try { return typeof xmp.get === 'function' ? xmp.get(key) : xmp[key]; } catch { return ''; }
  };
  const value = (item) => Array.isArray(item) ? item.map(text).join('; ') : text(typeof item === 'object' && item ? item['x-default'] || Object.values(item)[0] : item);
  const first = pages.find((page) => page.map((line) => line.text).join(' ').trim().length >= 60) || pages[0] || [], firstText = first.map((line) => line.text).join('\n');
  const articleText = firstText.split(/\n\s*(?:references|bibliography|daftar pustaka|daftar referensi)\s*[:.]?\s*\n/i)[0].slice(0, 16000);
  const usableTitle = (title) => title.length >= 8 && !/^(?:untitled|document\d*|microsoft\s+(?:word|powerpoint)|[^\s]+\.docx?\b)/i.test(title);
  const embeddedTitle = value(get('dc:title')) || text(info.Title);
  const candidates = first.filter((line) => line.text.length >= 12 && line.text.length <= 500 &&
    !/^(?:https?:|doi\b|issn\b|e-?issn\b|vol(?:ume)?[.\s:]|jurnal\b|journal\b|abstract\b|abstrak\b|received\b|accepted\b|published\b|available\b|copyright\b)/i.test(line.text));
  candidates.sort((a, b) => b.fontSize - a.fontSize || b.y - a.y);
  const heading = candidates[0];
  const titleLines = heading ? first.filter((line) => line.y <= heading.y + 3 && line.y >= heading.y - 100 &&
    Math.abs(line.fontSize - heading.fontSize) < 1 && candidates.includes(line)) : [];
  const inferredTitle = titleLines.map((line) => line.text).join(' ');
  const title = usableTitle(embeddedTitle) ? embeddedTitle : inferredTitle;
  let authors = authorList(get('dc:creator') || info.Author || '');
  if (!authors.length && titleLines.length) {
    const lastY = titleLines.at(-1).y;
    const bylines = first.filter((line) => line.y < lastY - 2 && line.y > lastY - 55 && !/\b(?:universitas|university|fakultas|department|abstract|abstrak|journal|jurnal)\b/i.test(line.text));
    authors = bylines.flatMap((line) => authorList(line.text)).slice(0, 25);
  }
  const headerDate = first.slice(0, 12).map((line) => line.text).find((line) => /\b(?:vol(?:ume)?\.?|no\.?|issue|published|publication|terbit|diterbitkan)\b/i.test(line) && /\b(?:19|20)\d{2}\b/.test(line)) || '';
  const date = labeledDate(value(get('prism:publicationdate') || get('prism:coverdate') || get('dc:date') || info.PublicationDate) || headerDate);
  const labeled = articleText.match(/(?:published(?:\s+online)?|tanggal\s+terbit|diterbitkan|terbit)\s*[:.]?\s*([^\n]{0,70})/i)?.[1];
  const publication = date.year ? date : labeledDate(labeled);
  const volume = value(get('prism:volume')) || articleText.match(/\bvol(?:ume|\.)?\s*[:.]?\s*(\d{1,5})\b/i)?.[1] || '';
  const issue = value(get('prism:number')) || articleText.match(/\b(?:no(?:mor|\.)?|issue)\s*[:.]?\s*(\d{1,5})\b/i)?.[1] || '';
  const page = value(get('prism:pagerange')) || articleText.match(/\b(?:pp?\.|pages?|hal\.?)\s*[:.]?\s*(\d+\s*[-–]\s*\d+)/i)?.[1]?.replace(/\s+/g, '') || '';
  const explicitDOI = value(get('prism:doi') || get('dc:identifier') || info.DOI || '');
  const laterText = pages.filter((page) => page !== first).map((page) => page.map((line) => line.text).join('\n').split(/\n\s*(?:references|bibliography|daftar pustaka)\s*[:.]?\s*\n/i)[0]).join('\n').slice(0, 16000);
  const doiCandidates = [...new Set([...findDOIs(explicitDOI), ...findDOIs(articleText), ...findDOIs(laterText)])].slice(0, 3);
  return completeMetadata({ title, authors, ...publication, volume, issue, page,
    journal: value(get('prism:publicationname')), publisher: value(get('dc:publisher')),
    doi: doiCandidates[0] || '', doiCandidates, issn: [value(get('prism:issn'))].filter(Boolean),
    url, sourceURL: url, source: 'Metadata dan teks PDF', titleConfidence: usableTitle(embeddedTitle) ? 'high' : 'inferred',
    hasText: articleText.trim().length >= 30 });
}
export async function readPDFMetadata(data, url, { pdfModule = getResolvedPDFJS, timeoutMs = 8000 } = {}) {
  if (!data?.length || data.length > MAX_PDF_BYTES) throw new AppError(422, 'SOURCE_TOO_LARGE', 'PDF kosong atau melebihi batas 10 MB.');
  let task, timer, closed = false;
  try {
    const work = (async () => {
      const { getDocument } = await pdfModule();
      if (closed) throw new AppError(504, 'PDF_TIMEOUT', 'Pembacaan PDF dibatalkan.');
      task = getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: false, disableFontFace: true,
        enableXfa: false, disableAutoFetch: true, useWorkerFetch: false, maxImageSize: 0, verbosity: 0 });
      const pdf = await task.promise;
      const metadata = await pdf.getMetadata();
      const pages = [];
      // Citation identifiers and bylines live at the start; do not scan reference lists across a whole book.
      for (let number = 1; number <= Math.min(pdf.numPages, 3); number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent({ disableNormalization: true });
        pages.push(pdfTextLines(content.items));
        page.cleanup();
      }
      return draftPDFMetadata({ info: metadata.info, xmp: metadata.metadata || {}, pages }, url);
    })();
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new AppError(504, 'PDF_TIMEOUT', 'Pembacaan PDF terlalu lama. Coba halaman artikel atau DOI.')), Math.max(1, timeoutMs));
    })]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.name === 'PasswordException') throw new AppError(422, 'PDF_PASSWORD', 'PDF dilindungi kata sandi. Gunakan versi PDF publik tanpa sandi, halaman artikel, atau DOI.');
    throw new AppError(422, 'INVALID_PDF', 'PDF rusak atau belum dapat dibaca. Coba halaman artikel, DOI, atau input manual.');
  } finally {
    closed = true;
    clearTimeout(timer);
    if (task) { try { await task.destroy(); } catch { /* Document resources are best-effort after a parser error. */ } }
  }
}
