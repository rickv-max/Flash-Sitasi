import { CREATOR, PUBLIC_PAGES, SITE_URL, CONTENT_UPDATED } from './site-content.js';

export const HOME_SEO = {
  title: 'Flash Sitasi — Generator Sitasi, Footnote & Daftar Pustaka',
  description: 'Buat sitasi jurnal, footnote, dan daftar pustaka dari DOI atau tautan artikel. Mendukung APA 7 dan kota terbit otomatis. Dibuat oleh Ricky Maulana.',
};

export function pageSEO(path = '/', { preview = false } = {}) {
  const normalized = path.replace(/\/+$/, '') || '/';
  const page = PUBLIC_PAGES[normalized] || HOME_SEO;
  const canonical = `${SITE_URL}${normalized === '/' ? '/' : normalized}`;
  const creatorId = `${SITE_URL}/tentang#ricky-maulana`;
  const graph = [
    { '@type': 'Person', '@id': creatorId, name: CREATOR.name, alternateName: CREATOR.alternateName,
      url: `${SITE_URL}/tentang`, sameAs: [CREATOR.url] },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Flash Sitasi', alternateName: 'FlashCite',
      url: `${SITE_URL}/`, inLanguage: 'id-ID', creator: { '@id': creatorId } },
    { '@type': normalized === '/tentang' ? 'AboutPage' : 'WebPage', '@id': `${canonical}#webpage`,
      url: canonical, name: page.title, description: page.description, inLanguage: 'id-ID',
      isPartOf: { '@id': `${SITE_URL}/#website` }, author: { '@id': creatorId },
      ...(normalized !== '/' ? { dateModified: CONTENT_UPDATED } : {}),
      ...(normalized === '/tentang' ? { about: { '@id': creatorId } } : {}) },
  ];
  if (normalized === '/') graph.push({ '@type': 'WebApplication', '@id': `${SITE_URL}/#app`, name: 'Flash Sitasi', alternateName: 'FlashCite',
    url: `${SITE_URL}/`, description: HOME_SEO.description, applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any', browserRequirements: 'Requires JavaScript for account and citation features.',
    inLanguage: 'id-ID', creator: { '@id': creatorId }, author: { '@id': creatorId },
    featureList: ['Sitasi dari DOI dan tautan artikel', 'Footnote dan daftar pustaka', 'APA 7', 'Kota terbit otomatis', 'Input manual dan batch'] });
  return { ...page, canonical, robots: preview ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    structuredData: { '@context': 'https://schema.org', '@graph': graph } };
}
