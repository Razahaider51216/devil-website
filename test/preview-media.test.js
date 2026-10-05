import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { createPreviewImages } = require('../bot-integration/website-preview-images.cjs');
const { captureMessage } = require('../bot-integration/website-feature-message.cjs');
const { createDashboardServer } = require('../bot-integration/website-dashboard.js');

test('Expired Discord image refreshes from the accessible upload message, persists and rejects arbitrary hosts', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'devil-media-')), originalFetch = globalThis.fetch;
  let requests = 0;
  const expired = 'https://cdn.discordapp.com/attachments/123/456/image.png?ex=old', fresh = expired.replace('old', 'fresh');
  globalThis.fetch = async url => { requests++; return String(url).endsWith('old') ? new Response('', { status: 404 }) : new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }); };
  const channel = { permissionsFor: () => ({ has: () => true }), messages: { fetch: async () => new Map([['message', { toJSON: () => ({ attachments: [{ url: fresh }] }) }]]) } };
  const context = { guild: { id: 'guild', channels: { cache: new Map([['123', channel]]) }, members: { me: {} } }, member: {}, source: { channelId: '123' }, system: 'welcome', data: {} };
  try {
    const images = createPreviewImages(dir);
    assert.equal(await images.capture('https://example.com/private.png', context), null); assert.equal(requests, 0);
    const id = await images.capture(expired, context); assert.match(id, /^[a-f0-9]{64}$/);
    assert.equal(requests, 2); assert.equal(images.read(id).mime, 'image/png');
    assert.equal(createPreviewImages(dir).read(id).base64, Buffer.from([137, 80, 78, 71]).toString('base64'));
    assert.equal(images.read('../secret'), null);
    await images.capture(expired, context); assert.equal(requests, 2);
  } finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
});

test('Source messages retain Discord V2 layout and embed fields while replacing private interaction values', async () => {
  const roleId = '444444444444444444', botId = '222222222222222222';
  const raw = { content: '## Test', embeds: [{ title: 'Title', fields: [{ name: 'Field', value: '**Value**', inline: true }], footer: { text: 'Footer' }, thumbnail: { url: 'https://example.com/thumb.png' } }], components: [{ type: 17, accent_color: 65280, components: [{ type: 10, content: `-# Description <@&${roleId}>` }, { type: 12, items: [{ media: { url: 'https://example.com/banner.png' } }] }, { type: 1, components: [{ type: 2, style: 3, label: 'Claim', custom_id: `verify:claim:${roleId}`, emoji: { name: 'shield', id: '1549887042752614561' } }, { type: 3, custom_id: 'secret-select-id', placeholder: 'Menu', options: [{ label: 'First', value: 'private-option-id', description: 'Details' }] }] }] }], attachments: [{ filename: 'image.png', url: 'https://example.com/attachment.png' }] };
  const guild = { id: 'guild', roles: { cache: new Map([[roleId, { name: 'Member' }]]) }, channels: { cache: new Map([['channel', { id: 'channel', messages: { fetch: async () => ({ author: { id: botId }, toJSON: () => raw }) } }]]) } };
  const result = await captureMessage({ client: { user: { id: botId } }, guild, source: { channelId: 'channel' }, system: 'verify', data: { verifyPanels: { message: { guildId: 'guild', channelId: 'channel' } } }, preview: { color: '#000000' } });
  assert.equal(result.components[0].color, '#00ff00'); assert.equal(result.embeds[0].fields[0].value, '**Value**');
  assert.equal(result.attachments.length, 1);
  assert.equal(result.components[0].components[2].components[0].role, 'Member');
  assert.ok(!JSON.stringify(result).includes(roleId)); assert.ok(!JSON.stringify(result).includes('private-option-id')); assert.ok(!JSON.stringify(result).includes('secret-select-id'));
});

test('Only images referenced by published visible previews are public, including nested V2 media', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'devil-published-media-')), id = 'a'.repeat(64);
  const images = createPreviewImages(path.join(dir, 'website-preview-images'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
  let stored;
  try { stored = await images.capture('https://cdn.discordapp.com/emojis/123.png', {}); } finally { globalThis.fetch = originalFetch; }
  const contentPath = path.join(dir, 'content.json');
  const content = { features: [{ id: 'one', title: 'One', published: true, preview: { message: { components: [{ type: 12, items: [{ media: { imageId: stored } }] }] } } }, { id: 'draft', title: 'Draft', published: false, preview: { imageId: id } }], updates: [], serverCategories: [], audit: [] };
  await writeFile(contentPath, JSON.stringify(content));
  const server = createDashboardServer({ client: { guilds: { cache: new Map() } }, data: {}, saveData() {}, publish() {}, secret: 'image-test', contentPath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const read = async imageId => fetch(`http://127.0.0.1:${server.address().port}/dashboard`, { method: 'POST', headers: { Authorization: 'Bearer image-test', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'feature-image-read', imageId }) });
  try { assert.equal((await read(stored)).status, 200); assert.equal((await read(id)).status, 404); } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
