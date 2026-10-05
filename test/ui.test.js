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
  dom.window.eval(icons); dom.window.eval(account); dom.window.eval(navigation); dom.window.eval(script); await flush(); await flush(); return dom;
}
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
    assert.ok(doc.querySelector('#tour-title').textContent.includes('ยินดีต้อนรับ'));
    doc.querySelector('[data-tour-next]').click();
    assert.ok(doc.querySelector('#tour-title').textContent.includes('เชิญ'));
    doc.querySelector('[data-tour-back]').click();
    assert.ok(doc.querySelector('#tour-title').textContent.includes('ยินดีต้อนรับ'));
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
