import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/portal-app.js', import.meta.url), 'utf8');
const icons = await readFile(new URL('../public/icons.js', import.meta.url), 'utf8');
const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const flush = () => new Promise(resolve => setImmediate(resolve));
async function page(route, fixtures = {}) {
  const dom = new JSDOM(html, { url: `https://devil.example${route}`, runScripts: 'outside-only' });
  dom.window.structuredClone = structuredClone;
  dom.window.fetch = async url => {
    const action = new URL(url, dom.window.location.href).searchParams.get('action');
    const fallback = action === 'catalog' ? catalog : action === 'session' ? { user: null } : action === 'owners' ? { owners: [] } : action === 'content' ? { features: [], updates: [], serverCategories: [] } : { servers: [], online: false };
    const result = fixtures[action] || fallback;
    return { ok: true, json: async () => result };
  };
  dom.window.eval(icons); dom.window.eval(script); await flush(); await flush(); return dom;
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
