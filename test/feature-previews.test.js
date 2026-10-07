import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createFeaturePreviews } = require('../bot-integration/website-feature-previews.cjs');
const { createDashboardServer } = require('../bot-integration/website-dashboard.js');
const guildId = '123456789012345678', userId = '222222222222222222', channelId = '333333333333333333', roleId = '444444444444444444';
function fixture() {
  let visible = true, membership = true;
  const member = { id: userId, permissions: { has: () => true } };
  const channel = { id: channelId, name: 'configured-panel', type: 0, permissionsFor: () => ({ has: () => visible }) };
  const guild = { id: guildId, name: 'Configured community', ownerId: userId, members: { me: {}, fetch: async ({ user }) => membership && user === userId ? member : null, fetchMe: async () => ({}) }, channels: { cache: new Map([[channelId, channel]]), fetch: async () => {} }, roles: { cache: new Map([[roleId, { name: 'Real configured role' }]]), fetch: async () => {} } };
  const data = {
    welcomeSettings: { [guildId]: { welcomeChannelId: channelId, imageUrl: 'https://example.com/welcome.png' } },
    ticketSetupConfigs: { [guildId]: { channelId, title: 'Configured Ticket', description: 'Ask our team', buttonLabel: 'Open support', buttonEmoji: '<:support:1537885070898237450>', buttonStyle: 'Success', autoReplies: ['Hello from configured support'] } },
    verifyPanels: { message: { guildId, channelId, mode: 'emoji', title: 'Configured verification', roles: [{ roleId, emoji: '✅' }] } },
    provinceRolePanels: { [guildId]: { channelId, messageId: '555555555555555555', roleIds: { เชียงใหม่: roleId } } },
    shops: { [guildId]: { storefrontTitle: 'Configured shop', panels: { message: { channelId } }, products: { p: { name: 'Configured product', price: 129, roleId, durationMonths: 2 } }, payment: { accountName: 'PRIVATE BANK ACCOUNT', paymentNumber: 'PRIVATE NUMBER' }, orders: { private: 'PRIVATE CUSTOMER' } } }
  };
  const client = { guilds: { cache: new Map([[guildId, guild]]) } };
  return { data, client, setVisible: value => { visible = value; }, setMember: value => { membership = value; } };
}
test('Owner preview sources require membership and visible configured channels and export display-only snapshots', async () => {
  const f = fixture();
  const api = createFeaturePreviews({ ...f, isOwner: id => id === userId, premium: () => true });
  assert.equal((await api.read({ userId })).guilds[0].id, guildId);
  assert.equal((await api.read({ userId, guildId })).systems.length, 5);
  const read = system => api.read({ userId, guildId, channelId, system });
  assert.equal((await read('ticket')).preview.label, 'Open support');
  assert.equal((await read('verify')).preview.verifyMode, 'emoji');
  assert.equal((await read('verify')).preview.roles[0].name, 'Real configured role');
  const shop = (await read('shop')).preview;
  const province = (await read('province')).preview;
  assert.equal(province.regions.length, 6); assert.equal(province.regions.flatMap(r => r.provinces).length, 77);
  assert.ok(!JSON.stringify(province).includes(roleId));
  assert.equal(shop.products[0].price, 129);
  assert.equal(shop.products[0].duration, '2 เดือน');
  assert.ok(!JSON.stringify(shop).includes('PRIVATE'));
  assert.ok(!JSON.stringify(shop).includes(roleId));
  await assert.rejects(api.read({ userId: 'outsider' }), { status: 403 });
  await assert.rejects(api.read({ userId, guildId, channelId: 'unconfigured', system: 'ticket' }), { status: 400 });
  f.setVisible(false); await assert.rejects(read('ticket'), { status: 400 });
  f.setMember(false); await assert.rejects(read('ticket'), { status: 403 });
  f.setVisible(true); f.setMember(true);
  const nonVip = createFeaturePreviews({ ...f, isOwner: () => true, premium: () => false });
  await assert.rejects(nonVip.read({ userId, guildId, channelId, system: 'shop' }), { status: 400 });
});
test('CMS rebuilds snapshots from the configured source, persists them, strips source IDs publicly and refreshes on save', async () => {
  const f = fixture(), dir = await mkdtemp(path.join(tmpdir(), 'devil-preview-'));
  process.env.OWNER_IDS = userId;
  const options = { ...f, saveData() {}, publish() {}, secret: 'preview-secret', contentPath: path.join(dir, 'content.json') };
  let server = createDashboardServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const call = async body => { const res = await fetch(`http://127.0.0.1:${server.address().port}/dashboard`, { method: 'POST', headers: { Authorization: 'Bearer preview-secret', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: res.status, body: await res.json() }; };
  try {
    let revision = (await call({ action: 'admin-read', userId })).body.revision;
    const feature = { id: 'ticket-demo', title: 'Support feature', published: true, previewSource: { guildId, channelId, system: 'ticket' }, preview: { paymentNumber: 'forged secret', title: 'Forged title' } };
    const content = () => ({ revision, features: [feature], updates: [], serverCategories: [] });
    assert.equal((await call({ action: 'admin-write', userId, content: content() })).status, 200);
    let published = (await call({ action: 'content' })).body.features[0];
    assert.equal(published.preview.title, 'Configured Ticket'); assert.equal(published.previewSource, undefined);
    assert.ok(!JSON.stringify(published).includes('forged secret'));
    f.data.ticketSetupConfigs[guildId].title = 'Updated in Discord';
    // Published examples are stable until the Owner saves again.
    assert.equal((await call({ action: 'content' })).body.features[0].preview.title, 'Configured Ticket');
    revision = (await call({ action: 'admin-read', userId })).body.revision;
    assert.equal((await call({ action: 'admin-write', userId, content: content() })).status, 200);
    assert.equal((await call({ action: 'content' })).body.features[0].preview.title, 'Updated in Discord');
    const notices = (await call({ action: 'notifications' })).body.notifications;
    assert.equal(notices.length, 1); assert.equal(notices[0].title, feature.title);
    // A row save must preserve other content, accept an explicitly empty image,
    // and retain the hide-image override after a restart.
    const before = (await call({ action: 'admin-read', userId })).body;
    const saved = await call({ action: 'admin-item-write', userId, change: { revision: before.revision, group: 'features', row: { ...feature, imageUrl: '', hidePreviewImages: true } } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.row.imageUrl, '');
    assert.equal(saved.body.row.preview.hideImages, true);
    assert.deepEqual((await call({ action: 'admin-read', userId })).body.updates, before.updates);
    assert.equal((await call({ action: 'admin-item-write', userId, change: { revision: before.revision, group: 'features', row: feature } })).status, 409);
    await new Promise(resolve => server.close(resolve)); server = createDashboardServer(options); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    assert.equal((await call({ action: 'content' })).body.features[0].preview.title, 'Updated in Discord');
    assert.equal((await call({ action: 'content' })).body.features[0].preview.hideImages, true);
    assert.ok((await call({ action: 'notifications' })).body.notifications.length >= 1);
    revision = (await call({ action: 'admin-read', userId })).body.revision;
    feature.previewSource.channelId = '555555555555555555';
    assert.equal((await call({ action: 'admin-write', userId, content: content() })).status, 400);
    assert.equal((await call({ action: 'content' })).body.features[0].preview.title, 'Updated in Discord');
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); delete process.env.OWNER_IDS; }
});
