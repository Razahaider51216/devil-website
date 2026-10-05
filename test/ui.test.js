import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
const { commands: ownerCommands } = createRequire(import.meta.url)('../bot-integration/website-owner-tools.cjs');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/portal-app.js', import.meta.url), 'utf8');
const icons = await readFile(new URL('../public/icons.js', import.meta.url), 'utf8');
const account = await readFile(new URL('../public/account.js', import.meta.url), 'utf8');
const tour = await readFile(new URL('../public/tour.js', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../public/navigation.js', import.meta.url), 'utf8');
const information = await readFile(new URL('../public/information.js', import.meta.url), 'utf8');
const featureDemos = await readFile(new URL('../public/feature-demos.js', import.meta.url), 'utf8');
const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const flush = () => new Promise(resolve => setImmediate(resolve));
async function page(route, fixtures = {}) {
  const dom = new JSDOM(html, { url: `https://devil.example${route}`, runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.structuredClone = structuredClone;
  dom.window.fetch = async (url, options) => {
    const action = new URL(url, dom.window.location.href).searchParams.get('action');
    const fallback = action === 'catalog' ? catalog : action === 'session' ? { user: null } : action === 'owners' ? { owners: [] } : action === 'content' ? { features: [], updates: [], serverCategories: [] } : { servers: [], online: false };
    const result = fixtures[action] || fallback;
    return { ok: true, json: async () => typeof result === 'function' ? result(url, options) : result };
  };
  dom.window.eval(icons); dom.window.eval(account); dom.window.eval(navigation); dom.window.eval(information); dom.window.eval(featureDemos); dom.window.eval(script); await flush(); await flush(); return dom;
}
test('footer information links open their own content in the shared portal without waiting for Discord or CMS', async () => {
  const rewrites = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).rewrites;
  const { server } = await import('../local-server.js');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const [route, title, section] of [['/support', 'ช่วยเหลือ', '.faq-list'], ['/privacy', 'นโยบายความเป็นส่วนตัว', '#information'], ['/terms', 'ข้อกำหนดการให้บริการ', '#acceptance']]) {
      assert.equal(rewrites.find(row => row.source === route).destination, '/index.html');
      const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), html);
      for (const suffix of ['', '/']) {
        const dom = await page(route + suffix, { session: new Promise(() => {}), content: new Promise(() => {}) });
        try {
          const doc = dom.window.document;
          assert.ok(doc.querySelector('.topbar'));
          assert.ok(doc.querySelector('footer a[href="' + route + '"]'));
          assert.ok(doc.querySelector('.information-page ' + section));
          assert.ok(doc.title.startsWith(title));
          assert.equal(doc.querySelector('.hero'), null);
          assert.equal(doc.querySelector('.site-header'), null);
          assert.equal(doc.querySelector('.loading'), null);
        } finally { dom.window.close(); }
      }
    }
    const asset = await fetch(`http://127.0.0.1:${server.address().port}/information.js`);
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), information);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('feature demos work without login or CMS and simulate Welcome, Ticket and Verify locally', async () => {
  const dom = await page('/features', { session: new Promise(() => {}), content: new Promise(() => {}) });
  try {
    const win = dom.window, doc = win.document;
    const playground = doc.createElement('div'); doc.querySelector('#app').append(playground); win.DevilFeatureDemos.mount(playground);
    let requests = 0; win.fetch = async () => { requests++; throw new Error('Demo must not contact Discord'); };
    const selectTab = id => doc.querySelector(`[data-demo-tab="${id}"]`).click();
    const action = id => doc.querySelector(`[data-demo-action="${id}"]`).click();
    const setField = (id, value) => { const field = doc.querySelector(`[data-demo-field="${id}"]`); if (field.type === 'checkbox') field.checked = value; else field.value = value; field.dispatchEvent(new win.Event('input', { bubbles: true })); };
    const stage = () => doc.querySelector('[data-demo-stage]');
    assert.ok(stage().textContent.includes('ยินดีต้อนรับ'));
    setField('welcomeEvent', 'leave'); assert.ok(stage().textContent.includes('แล้วพบกันใหม่'));
    setField('enabled', false); assert.ok(stage().textContent.includes('ปิดระบบแล้ว'));
    action('reset'); assert.ok(stage().textContent.includes('ยินดีต้อนรับ'));
    selectTab('ticket');
    setField('title', '<img src=x onerror=alert(1)>');
    assert.ok(stage().textContent.includes('<img src=x onerror=alert(1)>')); assert.equal(stage().querySelector('img[src=x]'), null);
    setField('buttonEmoji', '<a:demo:1538599895093747792>');
    assert.ok(stage().querySelector('.demo-emoji').src.includes('1538599895093747792.gif'));
    action('ticket-open'); assert.equal(doc.querySelector('[data-demo-channel]').textContent, 'ticket-demo-001');
    action('ticket-close'); assert.ok(stage().textContent.includes('ต้องการปิด Ticket'));
    action('ticket-cancel'); assert.equal(doc.querySelector('[data-demo-action="ticket-confirm"]'), null);
    action('ticket-close'); action('ticket-confirm'); assert.equal(doc.querySelector('[data-demo-channel]').textContent, 'support');
    selectTab('verify'); doc.querySelector('[data-role="Member"]').click();
    assert.ok(stage().querySelector('.demo-result').textContent.includes('@Member'));
    doc.querySelector('[data-role="Member"]').click(); assert.equal(stage().querySelectorAll('.demo-result .demo-mention').length, 1);
    setField('verifyMode', 'emoji');
    assert.equal(stage().querySelector('[data-role="Member"]').getAttribute('aria-pressed'), 'true');
    stage().querySelector('[data-role="Member"]').click(); assert.equal(stage().querySelector('[data-role="Member"]').getAttribute('aria-pressed'), 'false');
    assert.equal(stage().querySelector('.demo-result'), null);
    action('reset'); assert.equal(doc.querySelector('[data-demo-field="verifyMode"]').value, 'button');
    assert.equal(requests, 0);
  } finally { dom.window.close(); }
});

test('Shop demo supports keyboard selection, payment simulation, reset and Discord emoji fallback', async () => {
  const dom = await page('/features');
  try {
    const win = dom.window, doc = win.document;
    const playground = doc.createElement('div'); doc.querySelector('#app').append(playground); win.DevilFeatureDemos.mount(playground);
    let requests = 0; win.fetch = async () => { requests++; throw new Error('Demo must not create purchases'); };
    const action = id => doc.querySelector(`[data-demo-action="${id}"]`).click();
    const ticketTab = doc.querySelector('[data-demo-tab="ticket"]');
    ticketTab.focus(); ticketTab.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    assert.equal(doc.activeElement.dataset.demoTab, 'shop');
    assert.ok(doc.querySelector('.demo-workspace').getAttribute('aria-labelledby').endsWith('demo-tab-shop'));
    action('shop-menu'); assert.equal(doc.querySelector('.demo-select-trigger').getAttribute('aria-expanded'), 'true');
    doc.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.equal(doc.activeElement.dataset.product, 'vip'); doc.activeElement.click();
    assert.equal(doc.activeElement.className, 'demo-select-trigger');
    assert.ok(doc.querySelector('.demo-product').textContent.includes('199.00'));
    action('pay-promptpay'); assert.ok(doc.querySelector('.demo-result').textContent.includes('พร้อมเพย์'));
    action('pay-complete'); assert.ok(doc.querySelector('.demo-result').textContent.includes('ชำระเงินตัวอย่างสำเร็จ'));
    action('pay-truemoney'); assert.ok(doc.querySelector('.demo-result').textContent.includes('TrueMoney'));
    action('pay-cancel'); assert.equal(doc.querySelector('.demo-result'), null);
    action('shop-menu');
    doc.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(doc.querySelector('.demo-select-options').hidden, true); assert.equal(doc.activeElement.className, 'demo-select-trigger');
    const emojiImage = doc.querySelector('.demo-emoji'); emojiImage.dispatchEvent(new win.Event('error'));
    assert.equal(emojiImage.hidden, true); assert.equal(emojiImage.nextElementSibling.hidden, false);
    action('reset'); assert.equal(doc.querySelector('.demo-product'), null); assert.equal(doc.querySelector('.demo-result'), null);
    assert.equal(requests, 0);
    // A published CMS feature stays visible under the interactive examples.
    assert.ok(doc.querySelector('#published-features'));
  } finally { dom.window.close(); }
});

test('feature demo serves original bot artwork and keeps published CMS features escaped and visible', async () => {
  const dom = await page('/features', { content: { features: [{ title: 'My feature <script>', body: 'Details', mode: 'Public', command: 'set-ticket' }, { title: 'Private only', mode: 'Private' }], updates: [] } });
  try {
    assert.ok(dom.window.document.querySelector('#published-features').textContent.includes('My feature <script>'));
    assert.equal(dom.window.document.querySelector('#published-features script'), null);
    assert.ok(!dom.window.document.querySelector('#published-features').textContent.includes('Private only'));
  } finally { dom.window.close(); }
  const { server } = await import('../local-server.js');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const asset of ['feature-demos.js', 'feature-demos.css', 'demo-assets/welcome-embed-image.png', 'demo-assets/ticket-card-v2.png', 'demo-assets/devil-shop-banner.png']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/${asset}`, { method: 'HEAD' });
      assert.equal(response.status, 200, asset);
      assert.ok(response.headers.get('content-type').includes(asset.endsWith('.png') ? 'image/png' : asset.endsWith('.css') ? 'text/css' : 'text/javascript'));
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('published feature cards use independent configured previews instead of a visitor configuration playground', async () => {
  const previews = [
    { system: 'ticket', title: 'Real support panel', description: 'Configured text', label: 'Contact us', buttonStyle: 'success', channelName: 'help-desk', color: '#12ab34', imageUrl: 'https://example.com/configured.png', autoReplies: ['Configured reply'] },
    { system: 'verify', title: 'Our roles', description: 'Pick a role', label: 'Claim', channelName: 'roles', roles: [{ name: 'Actual role <script>', emoji: '✅' }], color: '#000000' },
    { system: 'shop', title: 'Our shop', description: 'Select', channelName: 'store', products: [{ id: 'custom', name: 'Actual product <script>', price: 321, role: 'Actual VIP', duration: '4 เดือน' }], color: '#167aca' },
    { system: 'shop', title: 'Second shop', description: 'Select', channelName: 'store-2', products: [{ id: 'custom', name: 'Second product', price: 10, role: 'Member', duration: 'ถาวร' }], color: '#167aca' }
  ];
  const dom = await page('/features', { content: { features: previews.map((preview, i) => ({ id: `f${i}`, title: `Feature ${i}`, body: 'Description', preview, imageUrl: 'https://example.com/old-photo.png' })), updates: [] } });
  try {
    const doc = dom.window.document, roots = [...doc.querySelectorAll('[data-feature-preview]')];
    assert.equal(roots.length, 4); assert.equal(doc.querySelector('#feature-demo-root'), null);
    assert.equal(doc.querySelector('img[src="https://example.com/old-photo.png"]'), null);
    roots.forEach(root => { assert.equal(root.querySelector('.demo-settings').hidden, true); assert.equal(root.querySelector('.demo-tabs').hidden, true); });
    const allIds = [...doc.querySelectorAll('[id]')].map(el => el.id); assert.equal(new Set(allIds).size, allIds.length);
    assert.equal(roots[0].querySelector('[data-demo-channel]').textContent, 'help-desk');
    assert.ok(roots[0].querySelector('[data-demo-action="ticket-open"]').classList.contains('success'));
    roots[0].querySelector('[data-demo-action="ticket-open"]').click();
    assert.ok(roots[0].textContent.includes('Configured reply'));
    roots[1].querySelector('[data-demo-action="verify-role"]').click();
    assert.ok(roots[1].querySelector('.demo-result').textContent.includes('Actual role <script>'));
    assert.equal(roots[1].querySelector('script'), null);
    roots[2].querySelector('[data-demo-action="shop-menu"]').click();
    roots[2].querySelector('[data-product="custom"]').click();
    assert.ok(roots[2].querySelector('.demo-product').textContent.includes('321.00'));
    assert.ok(roots[2].querySelector('.demo-product').textContent.includes('Actual product <script>'));
    assert.equal(roots[3].querySelector('.demo-product'), null);
    const trigger = roots[2].querySelector('.demo-select-trigger');
    assert.ok(doc.getElementById(trigger.getAttribute('aria-controls')));
  } finally { dom.window.close(); }
});

test('Owner CMS chooses configured source channels, loads a preview and saves its source with CSRF', async () => {
  const guildId = '123456789012345678', channelId = '333333333333333333', changes = [];
  const preview = { system: 'ticket', title: 'Source ticket', description: 'Help', label: 'Open source ticket', channelName: 'support', color: '#123456' };
  const cms = { features: [{ id: 'feature', title: 'Our support', body: 'Description', mode: 'Public', command: 'set-ticket', imageUrl: '', published: true }], updates: [], serverCategories: [], audit: [], revision: 'current' };
  const dom = await page('/admin', {
    session: { user: { name: 'Owner' }, owner: true, csrf: 'source-csrf' },
    admin: cms,
    'admin-item': (url, options) => { const body = JSON.parse(options.body); changes.push({ body, csrf: options.headers['X-CSRF-Token'] }); return { row: { ...body.row, preview }, revision: 'saved', audit: [] }; },
    'feature-preview': url => { const query = new URL(url, 'https://devil.example').searchParams; return query.get('system') ? { preview } : query.get('guildId') ? { systems: [{ id: 'ticket', channels: [{ id: channelId, name: 'support' }] }, { id: 'verify', channels: [] }] } : { guilds: [{ id: guildId, name: 'My guild' }] }; }
  });
  try {
    const doc = dom.window.document;
    const select = (selector, value) => { const element = doc.querySelector(selector); element.value = value; element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
    select('[data-source-kind]', 'discord');
    select('[data-source-guild]', guildId); await flush(); await flush();
    select('[data-source-system]', 'ticket');
    assert.ok(doc.querySelector('[data-source-channel]').textContent.includes('#support'));
    select('[data-source-channel]', channelId);
    doc.querySelector('[data-source-load]').click(); await flush(); await flush();
    assert.ok(doc.querySelector('[data-source-preview]').textContent.includes('Open source ticket'));
    assert.equal(doc.querySelector('[data-key="imageUrl"]').closest('label').hidden, true);
    doc.querySelector('[data-source-hide-images]').click();
    doc.querySelector('[data-save-row]').click(); await flush(); await flush();
    assert.equal(changes.length, 1); assert.equal(changes[0].csrf, 'source-csrf');
    assert.deepEqual(changes[0].body.row.previewSource, { guildId, channelId, system: 'ticket' });
    assert.equal(changes[0].body.row.preview, undefined);
    assert.equal(changes[0].body.row.hidePreviewImages, true);
    assert.equal(doc.querySelector('[data-source-hide-images]').checked, true);
    assert.ok(doc.querySelector('[data-row-status]').textContent.includes('บันทึก'));
  } finally { dom.window.close(); }
});

test('Discord text, source message layout and image hiding render safely; original buttons remain interactive', async () => {
  const dom = await page('/features');
  try {
    const root = dom.window.document.createElement('div'); dom.window.document.body.append(root);
    dom.window.DevilFeatureDemos.mount(root, { card: true, preview: { system: 'verify', title: 'Verify', description: '## Heading\n-# Small', roles: [{ name: 'Member' }], message: { content: '## Heading\n-# Small\n**Bold** and [site](https://example.com)\n||hidden||\n<script>alert(1)</script>', embeds: [{ title: 'Embed', description: '### Details', color: '#123456', fields: [{ name: 'Field', value: '`## literal`', inline: false }], image: { url: 'https://example.com/image.png' } }], components: [{ type: 1, components: [{ type: 2, label: 'Verify now', style: 3, action: 'verify-role', role: 'Member' }] }] } } });
    assert.ok(root.querySelector('.demo-md-heading.level-2'));
    assert.equal(root.querySelector('.demo-md-subtext').textContent, 'Small');
    assert.equal(root.querySelector('.demo-inline-code').textContent, '## literal');
    assert.equal(root.querySelector('script'), null);
    root.querySelector('.demo-spoiler').click(); assert.equal(root.querySelector('.demo-spoiler').getAttribute('aria-expanded'), 'true');
    assert.ok(root.querySelector('[data-demo-action="verify-role"]').classList.contains('success'));
    root.querySelector('[data-demo-action="verify-role"]').click(); assert.ok(root.textContent.includes('ได้รับยศ'));
    root.querySelector('.demo-banner').dispatchEvent(new dom.window.Event('error')); assert.ok(root.querySelector('.demo-image-unavailable'));
    dom.window.DevilFeatureDemos.mount(root, { card: true, preview: { system: 'ticket', title: 'No picture', description: 'Saved', hideImages: true, message: { embeds: [{ title: 'No picture', fields: [], image: { url: 'https://example.com/image.png' } }], components: [] } } });
    assert.equal(root.querySelector('.demo-banner'), null);
  } finally { dom.window.close(); }
});

test('Owner saves a cleared image without relying on input events or another unfinished draft', async () => {
  const changes = [], cms = { features: [{ id: 'one', title: 'One', imageUrl: 'https://example.com/old.png', published: true }, { id: 'draft', title: '', published: false }], updates: [], serverCategories: [], audit: [], revision: 'before' };
  const dom = await page('/admin', { session: { user: { name: 'Owner' }, owner: true, csrf: 'token' }, admin: cms, 'admin-item': (_, options) => { const body = JSON.parse(options.body); changes.push(body); return { row: body.row, revision: 'after', audit: [] }; } });
  try {
    const doc = dom.window.document; doc.querySelector('[data-key="imageUrl"]').value = '';
    doc.querySelector('[data-save-row="0"]').click(); await flush(); await flush();
    assert.equal(changes.length, 1); assert.equal(changes[0].row.imageUrl, ''); assert.equal(changes[0].group, 'features');
    assert.equal(doc.querySelector('[data-index="1"] [data-key="title"]').value, '');
    assert.ok(doc.querySelector('[data-row-status]').textContent.includes('บันทึก'));
  } finally { dom.window.close(); }
});

test('Public and VIP tabs filter the real catalog without exposing Private', async () => {
  const dom = await page('/commands');
  try {
    const doc = dom.window.document;
    assert.ok(doc.querySelector('#command-list').textContent.includes('/set-welcom'));
    assert.ok(!doc.querySelector('#command-list').textContent.includes('/set-shop'));
    doc.querySelector('[data-mode=VIP]').click();
    assert.equal(doc.querySelectorAll('#command-list article').length, 3);
    assert.ok(doc.querySelector('#command-list').textContent.includes('/set-shop'));
    assert.ok(!doc.querySelector('#command-list').textContent.includes('/set-welcom'));
    const search = doc.querySelector('#command-search'); search.value = 'setbuy'; search.dispatchEvent(new dom.window.Event('input'));
    assert.equal(doc.querySelectorAll('#command-list article').length, 1);
  } finally { dom.window.close(); }
});

test('first-visit tour supports next, back, completion, skip, replay and saved preference', async () => {
  const dom = await page('/');
  try {
    const doc = dom.window.document;
    dom.window.scrollTo = () => {};
    dom.window.eval(tour);
    assert.ok(doc.querySelector('.tour-panel'));
    assert.equal(doc.querySelector('#app').inert, true);
    assert.equal(doc.querySelector('#tour-title').textContent, 'เข้าสู่ระบบ Discord');
    doc.querySelector('[data-tour-next]').click();
    assert.ok(doc.querySelector('#tour-title').textContent.includes('เชิญ'));
    doc.querySelector('[data-tour-back]').click();
    assert.equal(doc.querySelector('#tour-title').textContent, 'เข้าสู่ระบบ Discord');
    for (let i = 0; i < 20 && doc.querySelector('[data-tour-next]'); i++) doc.querySelector('[data-tour-next]').click();
    assert.equal(doc.querySelector('.tour-overlay'), null);
    assert.equal(dom.window.localStorage.getItem('devil-tour-v1'), 'finished');
    assert.ok(!doc.querySelector('#app').inert);
    assert.ok(doc.querySelector('.owner-section').compareDocumentPosition(doc.querySelector('.toolkit-section')) & 4);
    assert.equal(doc.querySelector('.hero [data-invite-bot]').getAttribute('href'), '/api/portal?action=invite');
    doc.querySelector('[data-start-tour]').click();
    assert.ok(doc.querySelector('.tour-panel'));
    doc.querySelector('[data-tour-skip]').click();
    assert.equal(dom.window.localStorage.getItem('devil-tour-v1'), 'skipped');
    dom.window.eval(tour);
    assert.equal(doc.querySelector('.tour-overlay'), null);
  } finally { dom.window.close(); }
});

test('mobile drawer opens, traps focus, hides Owner tools from guests and closes on Escape, backdrop and desktop resize', async () => {
  const dom = await page('/commands');
  try {
    dom.window.innerWidth = 390;
    const doc = dom.window.document, trigger = doc.querySelector('#menu-toggle'), drawer = doc.querySelector('#mobile-navigation');
    trigger.focus(); trigger.click();
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(drawer.inert, false); assert.equal(doc.querySelector('#app').inert, true);
    assert.equal(doc.body.style.overflow, 'hidden');
    assert.ok([...drawer.querySelectorAll('[data-owner-menu]')].every(link => link.hidden));
    assert.equal(drawer.querySelector('[aria-current=page]').getAttribute('href'), '/commands');
    drawer.querySelector('.drawer-brand').focus();
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assert.equal(doc.activeElement, drawer.querySelector('[data-invite-bot]'));
    doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(trigger.getAttribute('aria-expanded'), 'false'); assert.equal(drawer.inert, true);
    assert.equal(doc.activeElement, trigger); assert.ok(!doc.querySelector('#app').inert);
    trigger.click(); drawer.querySelector('.menu-backdrop').click(); assert.equal(drawer.inert, true);
    trigger.click(); dom.window.innerWidth = 1024; dom.window.dispatchEvent(new dom.window.Event('resize'));
    assert.equal(drawer.inert, true); assert.equal(doc.body.style.overflow, '');
  } finally { dom.window.close(); }
});

test('mobile tour reveals the drawer for navigation steps and cleans it up on skip', async () => {
  const dom = await page('/');
  try {
    dom.window.innerWidth = 390; dom.window.scrollTo = () => {};
    dom.window.eval(tour);
    const doc = dom.window.document;
    for (let i = 0; i < 4; i++) doc.querySelector('[data-tour-next]').click();
    assert.ok(doc.querySelector('#tour-title').textContent.includes('คำสั่ง Public'));
    assert.equal(dom.window.DevilNavigation.isOpen, true);
    assert.ok(doc.querySelector('#mobile-navigation').classList.contains('is-guided'));
    assert.equal(doc.querySelector('#mobile-navigation').inert, true);
    doc.querySelector('[data-tour-skip]').click();
    assert.equal(dom.window.DevilNavigation.isOpen, false);
    assert.equal(doc.querySelector('#menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.ok(!doc.querySelector('#app').inert);
  } finally { dom.window.close(); }
});

test('Owner tour targets the Owner card or section heading, never the earlier header logo', async () => {
  for (const owners of [[], [{ id: '123', name: 'Owner', username: 'owner', avatarUrl: 'https://cdn.discordapp.com/avatar.png' }]]) {
    const dom = await page('/', { owners: { owners } });
    try {
      const doc = dom.window.document;
      dom.window.scrollTo = () => {}; dom.window.scrollBy = () => {};
      const target = doc.querySelector('.owner-home-card') || doc.querySelector('.owner-section .section-heading');
      let targetScrolls = 0, brandScrolls = 0;
      target.scrollIntoView = () => targetScrolls++;
      doc.querySelector('.topbar .brand').scrollIntoView = () => brandScrolls++;
      dom.window.eval(tour);
      doc.querySelector('[data-tour-next]').click(); doc.querySelector('[data-tour-next]').click();
      assert.ok(doc.querySelector('#tour-title').textContent.includes('Owner'));
      assert.equal(targetScrolls, 1); assert.equal(brandScrolls, 0);
    } finally { dom.window.close(); }
  }
});

test('tour placement keeps targets separate from the guide on phones, visual viewport changes and tight desktop layouts', async () => {
  const cases = [{ width: 390, height: 640, targetHeight: 80 }, { width: 390, height: 800, targetHeight: 80, visual: { offsetTop: 40, offsetLeft: 0, width: 390, height: 500 } }, { width: 1280, height: 800, targetHeight: 600 }];
  for (const fixture of cases) {
    const dom = await page('/');
    try {
      dom.window.innerWidth = fixture.width; dom.window.innerHeight = fixture.height;
      if (fixture.visual) dom.window.visualViewport = { ...fixture.visual, addEventListener() {}, removeEventListener() {} };
      dom.window.scrollTo = () => {};
      let targetTop = fixture.width < 761 ? 320 : 100;
      const left = fixture.width < 761 ? 20 : 450, width = fixture.width < 761 ? 350 : 550;
      dom.window.scrollBy = ({ top }) => { targetTop -= top; };
      const doc = dom.window.document, target = doc.querySelector('.toolkit-section .feature-card h3');
      target.getBoundingClientRect = () => ({ left, right: left + width, top: targetTop, bottom: targetTop + fixture.targetHeight, width, height: fixture.targetHeight });
      dom.window.eval(tour);
      const panel = doc.querySelector('.tour-panel');
      Object.defineProperty(panel, 'offsetHeight', { get: () => 240 });
      for (let i = 0; i < 3; i++) doc.querySelector('[data-tour-next]').click();
      const panelLeft = parseFloat(panel.style.left), panelTop = parseFloat(panel.style.top), panelWidth = parseFloat(panel.style.width);
      const rect = target.getBoundingClientRect();
      const separate = panelLeft + panelWidth <= rect.left || panelLeft >= rect.right || panelTop + 240 <= rect.top || panelTop >= rect.bottom;
      assert.equal(separate, true, `Guide overlaps target at viewport width ${fixture.width}`);
      assert.ok(panelTop >= (fixture.visual?.offsetTop || 0));
      assert.ok(panelTop + 240 <= (fixture.visual?.offsetTop || 0) + (fixture.visual?.height || fixture.height));
      if (fixture.width < 761) assert.ok(rect.top >= (fixture.visual?.offsetTop || 0) + 16);
    } finally { dom.window.close(); }
  }
});

test('login tour spotlight uses overlay coordinates and follows mobile viewport changes without scrolling a visible login button', async () => {
  const dom = await page('/');
  try {
    const win = dom.window, doc = win.document;
    win.innerWidth = 390; win.innerHeight = 700;
    const visual = new win.EventTarget();
    Object.assign(visual, { offsetTop: 0, offsetLeft: 0, width: 390, height: 700 });
    win.visualViewport = visual;
    let scrolls = 0, origin = { left: 12, top: -110 }, targetTop = 85;
    win.scrollTo = () => {}; win.scrollBy = () => { scrolls++; };
    const target = doc.querySelector('#account-link');
    target.getBoundingClientRect = () => ({ left: 65, right: 370, top: targetTop, bottom: targetTop + 40, width: 305, height: 40 });
    const originalRect = win.HTMLElement.prototype.getBoundingClientRect;
    win.HTMLElement.prototype.getBoundingClientRect = function () {
      return this.classList.contains('tour-overlay') ? { ...origin, width: 390, height: 700 } : originalRect.call(this);
    };
    win.eval(tour);
    const spotlight = doc.querySelector('.tour-spotlight');
    const assertAligned = () => {
      assert.equal(spotlight.hidden, false);
      assert.equal(parseFloat(spotlight.style.left) + origin.left, 58);
      assert.equal(parseFloat(spotlight.style.top) + origin.top, targetTop - 7);
      assert.equal(parseFloat(spotlight.style.width), 319);
      assert.equal(parseFloat(spotlight.style.height), 54);
    };
    assert.equal(doc.querySelector('#tour-title').textContent, 'เข้าสู่ระบบ Discord');
    assertAligned();
    origin = { left: 0, top: 60 }; targetTop = 115;
    visual.offsetTop = 40; visual.height = 600;
    visual.dispatchEvent(new win.Event('scroll'));
    await new Promise(resolve => setTimeout(resolve, 40));
    assertAligned();
    assert.equal(scrolls, 0);
  } finally { dom.window.close(); }
});

test('tour introduces login once and points server management to its own desktop button or mobile menu', async () => {
  for (const width of [390, 1280]) {
    const dom = await page('/');
    try {
      const win = dom.window, doc = win.document;
      win.innerWidth = width; win.scrollTo = () => {}; win.scrollBy = () => {};
      const account = doc.querySelector('#account-link');
      const management = doc.querySelector(width <= 760 ? '#mobile-navigation a[href="/dashboard"]' : '.hero a[href="/dashboard"]');
      let loginTargets = 0, managementTargets = 0;
      account.scrollIntoView = () => loginTargets++;
      management.scrollIntoView = () => managementTargets++;
      win.eval(tour);
      for (let i = 0; i < 6; i++) doc.querySelector('[data-tour-next]').click();
      assert.equal(doc.querySelector('#tour-title').textContent, 'จัดการเซิร์ฟเวอร์จากเว็บ');
      assert.ok(!doc.querySelector('#tour-description').textContent.includes('เข้าสู่ระบบ'));
      assert.equal(loginTargets, 1);
      assert.equal(managementTargets, 1);
      assert.equal(win.DevilNavigation.isOpen, width <= 760);
      doc.querySelector('[data-tour-next]').click();
      assert.ok(doc.querySelector('#tour-title').textContent.includes('พร้อมเริ่ม'));
      assert.equal(loginTargets, 1);
    } finally { dom.window.close(); }
  }
});

test('Owner command page requires an Owner and submits selected channel/form values with CSRF', async () => {
  const denied = await page('/owner', { session: { user: { name: 'Member' }, owner: false } });
  assert.equal(denied.window.document.querySelector('#owner-guild'), null); denied.window.close();
  const changes = [];
  const fixture = { commands: ownerCommands, guilds: [{ id: '123', name: 'Main server' }], values: { 'announe-panel': { channelId: '456', mentionType: 'none', sendMode: 'new' } }, channels: [{ id: '456', name: 'announcements', type: 0 }], roles: [], revision: 'revision' };
  const dom = await page('/owner', { session: { user: { name: 'Owner' }, owner: true, csrf: 'owner-csrf' }, owner: (url, options) => {
    if (options?.method === 'POST') { changes.push({ body: JSON.parse(options.body), csrf: options.headers['X-CSRF-Token'] }); return { ok: true, message: 'ส่งประกาศแล้ว' }; }
    return fixture;
  } });
  try {
    const doc = dom.window.document, select = doc.querySelector('#owner-guild');
    select.value = '123'; select.dispatchEvent(new dom.window.Event('change')); await flush(); await flush();
    const form = doc.querySelector('#owner-command-form');
    assert.equal(form.elements.channelId.value, '456');
    form.elements.title.value = 'Release'; form.elements.changelog.value = 'New feature';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await flush(); await flush();
    assert.equal(changes.length, 1); assert.equal(changes[0].body.command, 'announe-panel');
    assert.equal(changes[0].body.values.channelId, '456'); assert.equal(changes[0].csrf, 'owner-csrf');
    assert.equal(doc.querySelector('#owner-result').textContent, 'ส่งประกาศแล้ว');
  } finally { dom.window.close(); }
});
test('server directory displays Discord guilds while the CMS is unavailable', async () => {
  const dom = await page('/servers', { content: new Promise(() => {}), null: { servers: [{ id: '123', name: 'Live community', members: 42, online: 8 }] } });
  try { assert.ok(dom.window.document.querySelector('#server-groups').textContent.includes('Live community')); } finally { dom.window.close(); }
});
test('server directory displays the featured guild when the full list is unavailable', async () => {
  const dom = await page('/servers', { null: { servers: null, server: { id: '123', name: 'Featured community', members: 42, online: 8 } } });
  try { assert.ok(dom.window.document.querySelector('#server-groups').textContent.includes('Featured community')); } finally { dom.window.close(); }
});
test('Dashboard and CMS require login; server content is safely escaped', async () => {
  const login = await page('/dashboard');
  assert.ok(login.window.document.querySelector('.login-card')); login.window.close();
  const cms = await page('/admin', { session: { user: { name: 'Member' }, owner: false } });
  assert.ok(cms.window.document.querySelector('#app').textContent.includes('ไม่มีสิทธิ์')); cms.window.close();
  const servers = await page('/servers', { content: { features: [], updates: [], serverCategories: [{ id: 'gaming', title: 'เกม <img src=x>', body: 'ชุมชนเกม', guildIds: ['123'] }] }, null: { servers: [{ id: '123', name: '<script>alert(1)</script>', members: 10, online: 2 }] } });
  try { const app = servers.window.document.querySelector('#app'); assert.ok(app.textContent.includes('เกม <img src=x>')); assert.equal(app.querySelectorAll('script').length, 0); } finally { servers.window.close(); }
});
test('Owner CMS can add, edit and remove a draft; dashboard uses actual channel selects', async () => {
  const session = { user: { name: 'Owner' }, owner: true, csrf: 'test-csrf' };
  const cms = await page('/admin', { session, admin: { features: [], updates: [], serverCategories: [], audit: [] } });
  try { const doc = cms.window.document; doc.querySelector('#add-content').click(); assert.equal(doc.querySelectorAll('.cms-item').length, 1); const title = doc.querySelector('[data-key=title]'); title.value = 'New feature'; title.dispatchEvent(new cms.window.Event('input')); doc.querySelector('[data-delete]').click(); assert.equal(doc.querySelectorAll('.cms-item').length, 0); } finally { cms.window.close(); }
  const dashboard = await page('/dashboard', { session, guilds: { guilds: [{ id: '123', name: 'Test community', botPresent: true }] }, settings: { systems: [{ id: 'welcome', label: 'Welcome', command: 'set-welcom', revision: 'test', values: { welcomeChannelId: '456' }, fields: [{ key: 'welcomeChannelId', label: 'ช่องต้อนรับ', type: 'channel', types: [0, 5] }] }], channels: [{ id: '456', name: 'welcome', type: 0 }, { id: '789', name: 'voice', type: 2 }], roles: [] } });
  try { const doc = dashboard.window.document; const select = doc.querySelector('#guild-select'); select.value = '123'; select.dispatchEvent(new dashboard.window.Event('change')); await flush(); await flush(); const channel = doc.querySelector('[name=welcomeChannelId]'); assert.equal(channel.value, '456'); assert.equal(channel.options.length, 2); } finally { dashboard.window.close(); }
});
