export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Use only an explicitly supplied publication month; never infer January from a year.
export function publicationDate(value) {
  const parts = Array.isArray(value) ? value : String(value || '').match(/\b(1[5-9]\d{2}|20\d{2})(?:[-/](\d{1,2})(?:[-/]\d{1,2})?)?\b/)?.slice(1);
  const year = /^(1[5-9]\d{2}|20\d{2})$/.test(String(parts?.[0] || '')) ? String(parts[0]) : '';
  const month = year && /^(?:0?[1-9]|1[0-2])$/.test(String(parts?.[1] || '')) ? String(Number(parts[1])) : '';
  return { year, month };
}
