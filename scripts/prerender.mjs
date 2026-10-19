import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { load } from 'cheerio';
import { pageSEO } from '../shared/seo.js';
import { PUBLIC_PAGES, SITE_URL, CREATOR } from '../shared/site-content.js';

// Compile React in memory. No HTTP server, live database, or Admin credentials are used.
const compiler = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: Site } = await compiler.ssrLoadModule('/src/Site.jsx');
  const template = await readFile('dist/index.html', 'utf8');
  const preview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production';
  for (const path of ['/', ...Object.keys(PUBLIC_PAGES)]) {
    const seo = pageSEO(path, { preview });
    const $ = load(template);
    $('title').text(seo.title);
    $('meta[name="description"],meta[name="robots"],meta[name="author"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[type="application/ld+json"]').remove();
    const metas = [
      ['name', 'description', seo.description], ['name', 'author', CREATOR.name], ['name', 'robots', seo.robots],
      ['property', 'og:type', 'website'], ['property', 'og:title', seo.title], ['property', 'og:description', seo.description],
      ['property', 'og:url', seo.canonical], ['property', 'og:site_name', 'Flash Sitasi'], ['property', 'og:locale', 'id_ID'],
      ['property', 'og:image', `${SITE_URL}/social-card.png`], ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'],
      ['property', 'og:image:alt', 'Flash Sitasi — Generator sitasi oleh Ricky Maulana'],
      ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', seo.title],
      ['name', 'twitter:description', seo.description], ['name', 'twitter:image', `${SITE_URL}/social-card.png`],
      ['name', 'twitter:image:alt', 'Flash Sitasi — Generator sitasi oleh Ricky Maulana'],
    ];
    for (const [attribute, key, content] of metas) $('<meta>').attr(attribute, key).attr('content', content).appendTo('head');
    $('<link>').attr('rel', 'canonical').attr('href', seo.canonical).appendTo('head');
    $('<script>').attr('type', 'application/ld+json').text(JSON.stringify(seo.structuredData).replace(/</g, '\\u003c')).appendTo('head');
    $('#root').html(renderToString(React.createElement(Site, { path })));
    // Information pages are complete static documents. They do not need Firebase or app JS.
    if (path !== '/') $('script[type="module"],link[rel="modulepreload"]').remove();
    const filename = path === '/' ? 'index' : path.slice(1);
    await writeFile(`dist/${filename}.html`, $.html());
  }
  await writeFile('dist/robots.txt', preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const urls = ['/', ...Object.keys(PUBLIC_PAGES)].map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log(`Prerendered 4 public pages; ${preview ? 'preview indexing disabled' : 'production sitemap ready'}.`);
} finally { await compiler.close(); }
