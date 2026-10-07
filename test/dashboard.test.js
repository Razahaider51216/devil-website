import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { createDashboardServer } = createRequire(import.meta.url)('../bot-integration/website-dashboard.js');
const guildId = '123456789012345678', userId = '222222222222222222', channelId = '333333333333333333';
const admin = { id: userId, permissions: { has: flag => [8n, 32n, 1024n].includes(flag) } };
const bot = { roles: { highest: { position: 10 } } };
const channel = { id: channelId, name: 'welcome', type: 0, permissionsFor: () => ({ has: () => true }) };
const guild = { id: guildId, name: 'Test community', ownerId: userId, members: { me: bot, fetch: async ({ user }) => user === userId ? admin : null, fetchMe: async () => bot }, channels: { cache: new Map([[channelId, channel]]), fetch: async () => {} }, roles: { cache: new Map(), fetch: async () => {} } };

test('QR dashboard persists timer and styling, rejects invalid values and passes saved values to publish', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'devil-qr-dashboard-'));
  const data = {}; let published;
  const server = createDashboardServer({ client: { guilds: { cache: new Map([[guildId, guild]]) } }, data, saveData: () => {}, secret: 'test', contentPath: path.join(dir, 'content.json'), publish: async (system, g, m, config) => { published = { system, config }; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const call = async body => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/dashboard`, { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, userId, ...body }) });
    return { status: response.status, body: await response.json() };
  };
  try {
    const qr = (await call({ action: 'settings-read' })).body.systems.find(s => s.id === 'qr');
    assert.equal(qr.command, 'set-qr');
    assert.equal(qr.values.autoDeleteMinutes, 0);
    assert.equal(qr.values.title, 'สแกน QR Code');
    const write = values => call({ action: 'settings-write', change: { system: 'qr', revision: qr.revision, values } });
    for (const autoDeleteMinutes of [-1, 1.5, 1441]) assert.equal((await write({ autoDeleteMinutes })).status, 400);
    assert.equal((await write({ buttonEmoji: 'not-emoji' })).status, 400);
    assert.equal((await write({ imageUrl: 'https://user:pass@example.com/qr.png' })).status, 400);
    assert.equal(data.qrConfigs, undefined);
    const saved = await call({ action: 'settings-write', change: { system: 'qr', revision: qr.revision, publish: true, values: { channelId, autoDeleteMinutes: 5, content: '## ชำระเงิน 💸', imageUrl: 'https://example.com/qr.png', buttonEmoji: '📱' } } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.publishError, null);
    assert.equal(data.qrConfigs[guildId].autoDeleteMinutes, 5);
    assert.equal(data.qrConfigs[guildId].content, '## ชำระเงิน 💸');
    assert.equal(published.system, 'qr');
    assert.equal(published.config.channelId, channelId);
    assert.equal(published.config.autoDeleteMinutes, 5);
    assert.equal((await write({ autoDeleteMinutes: 0 })).status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
test('live bot bridge enforces membership, permissions, VIP, channel ownership and revisions; persists CMS', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'devil-dashboard-')); const contentPath = path.join(dir, 'content.json');
  const data = {}; let saves = 0;
  process.env.OWNER_IDS = userId;
  const options = { client: { guilds: { cache: new Map([[guildId, guild]]) } }, data, saveData: () => saves++, publish: async () => { throw new Error('Missing Send Messages'); }, secret: 'bridge-secret', contentPath };
  let server = createDashboardServer(options); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const call = async (body, secret = 'bridge-secret') => { const r = await fetch(`http://127.0.0.1:${server.address().port}/dashboard`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  try {
    assert.equal((await call({ action: 'guilds' }, 'wrong')).status, 401);
    assert.equal((await call({ action: 'settings-read', guildId: 'other', userId })).status, 403);
    assert.equal((await call({ action: 'settings-read', guildId, userId: 'outsider' })).status, 403);
    const settings = (await call({ action: 'settings-read', guildId, userId })).body;
    assert.ok(!settings.systems.some(s => s.private));
    const welcome = settings.systems.find(s => s.id === 'welcome'), shop = settings.systems.find(s => s.id === 'shop'), ticket = settings.systems.find(s => s.id === 'ticket');
    assert.equal(shop.locked, true);
    assert.equal((await call({ action: 'settings-write', guildId, userId, change: { system: 'shop', revision: shop.revision, values: {} } })).status, 403);
    assert.equal((await call({ action: 'settings-write', guildId, userId, change: { system: 'welcome', revision: welcome.revision, values: { welcomeChannelId: 'foreign' } } })).status, 400);
    assert.equal((await call({ action: 'settings-write', guildId, userId, change: { system: 'welcome', revision: welcome.revision, values: { __proto__: true, unknownField: 'bad' } } })).status, 400);
    const saved = await call({ action: 'settings-write', guildId, userId, change: { system: 'welcome', revision: welcome.revision, values: { welcomeChannelId: channelId, welcomeEnabled: true } } });
    assert.equal(saved.status, 200); assert.equal(data.welcomeChannels[guildId], channelId); assert.equal(data.welcomeSettings[guildId].welcomeEnabled, true); assert.equal(saves, 1);
    assert.equal((await call({ action: 'settings-write', guildId, userId, change: { system: 'welcome', revision: welcome.revision, values: {} } })).status, 409);
    const partial = await call({ action: 'settings-write', guildId, userId, change: { system: 'ticket', revision: ticket.revision, values: { channelId }, publish: true } });
    assert.equal(partial.body.saved, true); assert.match(partial.body.publishError, /Missing Send Messages/);
    const input = { features: [{ id: 'feature', title: 'Welcome', body: '<script>alert(1)</script>', imageUrl: '', published: true }, { id: 'draft', title: 'Draft', published: false }], updates: [], serverCategories: [] };
    input.revision = (await call({ action: 'admin-read', userId })).body.revision;
    assert.equal((await call({ action: 'admin-write', userId: 'outsider', content: input })).status, 403);
    assert.equal((await call({ action: 'admin-write', userId, content: input })).status, 200);
    assert.equal((await call({ action: 'admin-write', userId, content: input })).status, 409);
    assert.equal((await call({ action: 'content' })).body.features.length, 1);
    await new Promise(resolve => server.close(resolve));
    server = createDashboardServer(options); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    assert.equal((await call({ action: 'content' })).body.features[0].title, 'Welcome');
    assert.ok((await call({ action: 'admin-read', userId })).body.audit.length >= 3);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); delete process.env.OWNER_IDS; }
});
