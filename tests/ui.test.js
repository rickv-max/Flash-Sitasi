import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import postcss from 'postcss';

// In-memory compilation and CSS cascade checks. No listening server or browser.
const compiler = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { RichCitation } = await compiler.ssrLoadModule('/src/components/Primitives.jsx');
const { default: App } = await compiler.ssrLoadModule('/src/App.jsx');
const { default: PaymentModal } = await compiler.ssrLoadModule('/src/components/PaymentModal.jsx');
const { default: AdminPanel, AdminOverview, AdminActionDialog } = await compiler.ssrLoadModule('/src/components/AdminPanel.jsx');
const { default: CityField, CitySource } = await compiler.ssrLoadModule('/src/components/CityField.jsx');
const css = postcss.parse((await Promise.all(['src/index.css', 'src/App.css', 'src/responsive.css', 'src/components/admin.css'].map((path) => readFile(path, 'utf8')))).join('\n'));
const $workspace = load(renderToStaticMarkup(React.createElement(App, { initialView: 'tool', initialDemo: true })));

function mediaApplies(query, width, height = 900) {
  if (query.includes('prefers-reduced-motion')) return false;
  for (const [, direction, dimension, value] of query.matchAll(/(min|max)-(width|height):\s*([\d.]+)px/g)) {
    const actual = dimension === 'width' ? width : height;
    if (direction === 'max' ? actual > Number(value) : actual < Number(value)) return false;
  }
  return true;
}
function styleOf($, selector, width, height = 900) {
  const element = $(selector).first();
  const result = {};
  css.walkRules((rule) => {
    let parent = rule.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule' && ((parent.name === 'media' && !mediaApplies(parent.params, width, height)) || /keyframes$/.test(parent.name))) return;
      parent = parent.parent;
    }
    if (rule.selector.includes('::')) return;
    let matches = false;
    try { matches = element.is(rule.selector); } catch { return; }
    if (!matches) return;
    rule.walkDecls((decl) => {
      if (result[decl.prop]?.important && !decl.important) return;
      result[decl.prop] = { value: decl.value, important: !!decl.important };
    });
  });
  return Object.fromEntries(Object.entries(result).map(([key, { value }]) => [key, value]));
}

test.after(async () => { await compiler.close(); });
test('restored landing retains original logo, headline, preview and primary action', () => {
  const $ = load(renderToStaticMarkup(React.createElement(App)));
  assert.equal($('.navbar-wrapper .video-logo-asset[src="/logo.mp4"]').length, 1);
  assert.ok($('.hero-title').text().includes('Ekstrak Referensi Jurnal'));
  assert.ok($('.hero-title').text().includes('Dalam Hitungan Detik.'));
  assert.equal($('.mock-workspace').length, 1);
  assert.ok($('.nav-actions').text().includes('Buka Ruang Kerja'));
  assert.equal($('.hero-copy,.hero-visual,.workspace-shell').length, 0);
});
test('original workspace retains five source tabs, format toggle and labelled input', () => {
  const $ = $workspace;
  assert.equal($('.sidebar-nav .nav-item').length, 5);
  assert.ok($('.sidebar-nav').text().includes('Nomor DOI'));
  assert.ok($('.sidebar-nav').text().includes('Link Web/PDF'));
  assert.ok($('.sidebar-nav').text().includes('Mode Batch'));
  assert.ok($('.section-title').text().includes('Ruang Kerja'));
  assert.equal($('.style-toggle-btn').length, 2);
  assert.equal($('.input-label[for]').length, $('input').length);
  assert.equal($('button[aria-label="Buka menu navigasi"][aria-controls="workspace-sidebar"]').length, 1);
  assert.equal($('.mobile-dashboard-header.sm\\:flex,.sidebar-overlay.sm\\:hidden,.mobile-close.sm\\:hidden').length, 0);
});
for (const width of [320, 360, 390, 640, 700, 768, 769, 1024, 1440]) {
  test(`drawer and menu follow one breakpoint at ${width}px`, () => {
    const header = styleOf($workspace, '.mobile-dashboard-header', width);
    const sidebar = styleOf($workspace, '.dashboard-sidebar', width);
    const main = styleOf($workspace, '.dashboard-main', width);
    if (width <= 768) {
      assert.equal(header.display, 'flex');
      assert.equal(sidebar.transform, 'translateX(-100%)');
      assert.equal(sidebar.visibility, 'hidden');
      assert.equal(main['margin-left'], '0');
      assert.equal(main.width, '100%');
      assert.equal(styleOf($workspace, 'input', width)['font-size'], '16px');
    } else {
      assert.equal(header.display, 'none');
      assert.notEqual(sidebar.visibility, 'hidden');
      assert.equal(main['margin-left'], width <= 1050 ? '240px' : '260px');
    }
  });
}
test('short-screen sidebar keeps a scrollable navigation region', () => {
  const sidebar = styleOf($workspace, '.dashboard-sidebar', 700, 390);
  const nav = styleOf($workspace, '.sidebar-nav', 700, 390);
  assert.equal(sidebar.height, '100dvh');
  assert.equal(nav['min-height'], '0');
  assert.equal(nav['overflow-y'], 'auto');
});
test('root does not introduce nested scrollbars', () => {
  const fixture = load('<html><body><div id="root"></div></body></html>');
  assert.equal(styleOf(fixture, 'html', 390)['overflow-y'], 'auto');
  assert.equal(styleOf(fixture, 'body', 390)['overflow-y'], undefined);
  assert.equal(styleOf(fixture, '#root', 390)['overflow-y'], undefined);
});
test('payment dialog retains original packages, slate action and bounded scroll height', () => {
  const $ = load(renderToStaticMarkup(React.createElement(PaymentModal, { user: { uid: 'test', email: 'writer@test.invalid' }, notify() {}, onClose() {}, onLogin() {} })));
  assert.equal($('.classic-topup-modal h2').text(), 'Top Up Kredit');
  assert.deepEqual($('.btn-package').map((_, node) => $(node).text()).get(), ['50 Kredit', '75 Kredit', '100 Kredit', '125 Kredit']);
  assert.ok($('.btn-primary').text().includes('Bayar via Bayar.gg'));
  assert.equal($('input[type="number"]').attr('min'), '10');
  const dialog = styleOf($, '.modal', 320, 500);
  assert.equal(dialog['max-height'], 'calc(100dvh - 32px)');
  assert.equal(dialog['overflow-y'], 'auto');
});
test('rich citation renderer escapes malicious legacy content and preserves italic text', () => {
  const $ = load(renderToStaticMarkup(React.createElement(RichCitation, { html: '<img src=x onerror=alert(1)><i>Nature</i><script>oops</script>' })));
  assert.equal($('img,script').length, 0); assert.equal($('em').text(), 'Nature');
  assert.ok($('p').text().includes('<img src=x onerror=alert(1)>'));
});

test('automatic city input is labelled and shows evidence with review status', () => {
  const $ = load(renderToStaticMarkup(React.createElement(CityField, { state: { value: 'Bandung', city: 'Bandung', status: 'found', enabled: true, citySource: { label: 'Alamat kontak jurnal', confidence: 'medium', url: 'https://journal.example/contact' }, change() {}, reset() {} } })));
  assert.equal($('label').attr('for'), $('input').attr('id'));
  assert.ok($('.city-note.needs-review').text().includes('Perlu diperiksa'));
  assert.equal($('a').attr('href'), 'https://journal.example/contact');
  assert.equal($('a').attr('rel'), 'noopener noreferrer');
});
test('manual city correction provides reset and does not replace it with an automatic city', () => {
  const $ = load(renderToStaticMarkup(React.createElement(CityField, { state: { value: 'Malang', city: 'Bandung', status: 'found', manual: true, enabled: true, change() {}, reset() {} } })));
  assert.equal($('input').attr('value'), 'Malang'); assert.equal($('.city-reset').text(), 'Gunakan otomatis');
  assert.ok($.text().includes('Koreksi manual')); assert.ok(!$.text().includes('Bandung'));
});
test('unavailable city remains optional and unsafe provenance cannot become a link', () => {
  const $ = load(renderToStaticMarkup(React.createElement(CitySource, { metadata: { city: 'Bandung', citySource: { url: 'javascript:alert(1)', label: 'Metadata' } } })));
  assert.equal($('a').length, 0);
  const absent = renderToStaticMarkup(React.createElement(CityField, { state: { value: '', status: 'not_found', enabled: true, change() {}, reset() {} } }));
  assert.ok(absent.includes('belum ditemukan')); assert.ok(!absent.includes('required='));
});
test('admin panel has all seven sections, a real loading state and labelled filters', () => {
  const $ = load(renderToStaticMarkup(React.createElement(AdminPanel, { user: { uid: 'test-admin' }, initialTab: 'users' })));
  assert.equal($('.admin-tabs button').length, 7);
  assert.ok($('.admin-tabs').text().includes('Rekonsiliasi'));
  assert.ok($('.admin-tabs').text().includes('Log Audit'));
  assert.equal($('.admin-loading').length, 1);
  assert.equal($('.admin-metric').length, 0);
  assert.equal($('.admin-filters input, .admin-filters select').length, $('.admin-filters label[for]').length);
  assert.equal(styleOf($, '.admin-field input', 320)['font-size'], '16px');
});
test('admin overview uses supplied totals and collapses metrics at narrow widths', () => {
  const $ = load(renderToStaticMarkup(React.createElement(AdminOverview, { data: { users: 123, admins: 2, blocked: 1, citations: 41, paidPayments: 3, pendingPayments: 2, grossRevenue: 22500, outstandingCredits: 19, daily: [{ date: '2026-10-18', citations: 2, payments: 1 }], generatedAt: 1 } })));
  assert.equal($('.admin-metric').length, 8); assert.equal($('.admin-metric strong').first().text(), '123');
  assert.equal(styleOf($, '.admin-metrics', 320)['grid-template-columns'], 'repeat(2, minmax(0, 1fr))');
  assert.equal(styleOf($, '.admin-metrics', 1440)['grid-template-columns'], 'repeat(4, minmax(0, 1fr))');
});
test('admin credit confirmation identifies target, requires reason and fits short screens', () => {
  const $ = load(renderToStaticMarkup(React.createElement(AdminActionDialog, { user: { uid: 'test-admin' }, task: { action: 'adjustCredits', uid: 'writer-one', profile: { credits: 5, name: 'Penulis' } }, onClose() {}, onSuccess() {} })));
  assert.equal($('[role="dialog"]').length, 1); assert.ok($('.admin-action-target').text().includes('writer-one'));
  assert.equal($('textarea[required][minlength="5"]').length, 1);
  assert.equal($('button[type="submit"][disabled]').length, 1);
  assert.equal(styleOf($, '.admin-form-grid', 320)['grid-template-columns'], 'minmax(0, 1fr)');
  assert.equal(styleOf($, '.modal', 320, 390)['max-height'], 'calc(100dvh - 32px)');
});
test('top up reflects admin price and credit limits without changing the classic design', () => {
  const $ = load(renderToStaticMarkup(React.createElement(PaymentModal, { user: { uid: 'test-writer' }, notify() {}, onClose() {}, settings: { pricePerCredit: 1000, minTopup: 75, maxTopup: 100, paymentEnabled: true } })));
  assert.deepEqual($('.btn-package').map((_, node) => $(node).text()).get(), ['75 Kredit', '100 Kredit']);
  assert.equal($('input').attr('min'), '75'); assert.equal($('input').attr('max'), '100');
  assert.ok($.text().includes('1.000'));
});
