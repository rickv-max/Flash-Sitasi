// Small, real PDF documents generated from the PDF object/xref format, without network access.
export function makePDF({ title = '', author = '', lines = [], creationDate = 'D:20261021000000Z', xmp = '' } = {}) {
  const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]/g, ' ');
  const stream = 'BT\n' + lines.map((line, index) => '/F1 ' + (line.size || 12) + ' Tf\n1 0 0 1 60 ' + (line.y ?? 760 - index * 24) + ' Tm\n(' + escape(line.text) + ') Tj').join('\n') + '\nET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R' + (xmp ? ' /Metadata 7 0 R' : '') + ' >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream',
    '<< /Title (' + escape(title) + ') /Author (' + escape(author) + ') /CreationDate (' + escape(creationDate) + ') >>',
  ];
  if (xmp) objects.push('<< /Type /Metadata /Subtype /XML /Length ' + Buffer.byteLength(xmp) + ' >>\nstream\n' + xmp + '\nendstream');
  let pdf = '%PDF-1.4\n', offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  }
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  pdf += offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(pdf);
}
export const article = { title: 'Analisis eDNA dan Kebijakan Kesehatan', authors: [{ given: 'Pardi', family: 'Hilala' }], year: '2025', month: '3',
  journal: 'Ganec Swara', publisher: 'Yayasan Al-amin Qalbu', volume: '19', issue: '1', page: '49-55',
  doi: '10.59896/gara.v19i1.175', source: 'Crossref', sourceURL: 'https://jurnal.example/article/view/175', issn: [], warnings: [] };
export const articleHTML = '<title>' + article.title + '</title><meta name="citation_title" content="' + article.title + '"><meta name="citation_author" content="Pardi Hilala"><meta name="citation_publication_date" content="2025/03/01"><meta name="citation_journal_title" content="Ganec Swara">';
export const articlePDF = () => makePDF({ title: article.title, author: 'Pardi Hilala', lines: [
  { text: 'Ganec Swara', size: 12, y: 800 }, { text: 'Vol. 19 No. 1, Mar 2025, hal. 49-55', size: 10, y: 780 },
  { text: article.title, size: 18, y: 730 }, { text: 'Pardi Hilala', size: 11, y: 700 },
  { text: 'Abstract', size: 12, y: 660 }, { text: 'Research and publication metadata.', size: 10, y: 635 },
  { text: 'https://doi.org/' + article.doi, size: 9, y: 50 },
] });
