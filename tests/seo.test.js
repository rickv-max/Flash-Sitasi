import test from 'node:test';
import assert from 'node:assert/strict';
import { pageSEO } from '../shared/seo.js';
import { PUBLIC_PAGES, SITE_URL } from '../shared/site-content.js';

test('every public page has a unique canonical, title, description and creator identity', () => {
  const titles = new Set(); const canonicals = new Set();
  for (const path of ['/', ...Object.keys(PUBLIC_PAGES)]) {
    const seo = pageSEO(path);
    assert.equal(seo.canonical, `${SITE_URL}${path}`); assert.ok(seo.robots.startsWith('index, follow'));
    assert.ok(seo.description.length >= 90); titles.add(seo.title); canonicals.add(seo.canonical);
    const person = seo.structuredData['@graph'].find((entry) => entry['@type'] === 'Person');
    assert.equal(person.name, 'Ricky Maulana'); assert.equal(person.alternateName, undefined); assert.equal(person.url, 'https://rickymaulana.page.gd/');
    assert.ok(!JSON.stringify(seo).includes('Lumajang')); assert.ok(!JSON.stringify(seo).includes('github.com'));
    assert.equal(seo.structuredData['@graph'].find((entry) => /Page$/.test(entry['@type'])).author['@id'], person['@id']);
  }
  assert.equal(titles.size, 4); assert.equal(canonicals.size, 4);
});
test('preview pages are not indexable and use the public production canonical', () => {
  const seo = pageSEO('/kebijakan-privasi/', { preview: true });
  assert.equal(seo.robots, 'noindex, nofollow');
  assert.equal(seo.canonical, `${SITE_URL}/kebijakan-privasi`);
});
