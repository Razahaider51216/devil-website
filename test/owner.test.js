import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { createOwnerTools } = require('../bot-integration/website-owner-tools.cjs');
const { validateFields } = require('../bot-integration/website-dashboard.js');
const guildId = '123456789012345678', ownerId = '222222222222222222', channelId = '333333333333333333';
function fixture() {
  const member = { id: ownerId, user: { id: ownerId }, permissions: { has: flag => flag === 8n } };
  const channel = { id: channelId, name: 'announcements', type: 0, permissionsFor: () => ({ has: () => true }) };
  const guild = { id: guildId, name: 'Main', channels: { cache: new Map([[channelId, channel]]), fetch: async () => {} }, roles: { cache: new Map(), fetch: async () => {} }, members: { me: { roles: { highest: { position: 10 } } }, fetch: async ({ user }) => user === ownerId ? member : null, fetchMe: async () => {} } };
  const data = {}; const executions = []; const audit = [];
  const dispatch = createOwnerTools({ client: { guilds: { cache: new Map([[guildId, guild]]) } }, data, validateFields, isOwner: id => id === ownerId, ownerGuildIds: () => [guildId], ownerReloadFiles: () => ['announce-system.js'], executeOwner: async (...args) => { executions.push(args); return { message: 'Done' }; }, audit: record => audit.push(record) });
  const read = () => dispatch({ action: 'owner-read', userId: ownerId, guildId });
  const execute = (change, userId = ownerId, id = guildId) => dispatch({ action: 'owner-execute', userId, guildId: id, change });
  return { dispatch, read, execute, data, executions, audit, member, channel };
}
test('Owner tools reject non-owners, non-admin members, foreign guilds and arbitrary commands/files', async () => {
  const f = fixture();
  await assert.rejects(f.dispatch({ action: 'owner-read', userId: 'outsider' }), { status: 403 });
  const state = await f.read();
  assert.deepEqual(state.commands.map(c => c.id), ['announe-panel', 'setstaus', 'reload']);
  const change = { command: 'reload', requestId: randomUUID(), revision: state.revision, values: { file: '../index.js' } };
  await assert.rejects(f.execute(change), { status: 400 });
  await assert.rejects(f.execute({ ...change, command: 'ban' }), { status: 400 });
  await assert.rejects(f.execute(change, ownerId, '999999999999999999'), { status: 403 });
  f.member.permissions.has = () => false;
  await assert.rejects(f.read(), { status: 403 });
  assert.equal(f.executions.length, 0);
});
test('Owner publication validates channels, mentions and revisions and replays retries without duplicate sends', async () => {
  const f = fixture(), state = await f.read();
  const values = { channelId, title: 'Release', changelog: 'New feature', sendMode: 'new', mentionType: 'none' };
  const change = { command: 'announe-panel', requestId: randomUUID(), revision: state.revision, values };
  await assert.rejects(f.execute({ ...change, values: { ...values, channelId: 'foreign' } }), { status: 400 });
  await assert.rejects(f.execute({ ...change, values: { ...values, sendMode: 'edit' } }), { status: 400 });
  await assert.rejects(f.execute({ ...change, values: { ...values, mentionType: 'here' } }), { status: 400 });
  f.channel.permissionsFor = () => ({ has: flag => flag !== 131072n });
  await assert.rejects(f.execute({ ...change, values: { ...values, mentionType: 'everyone' } }), { status: 403 });
  const result = await f.execute(change);
  assert.equal(result.message, 'Done');
  assert.deepEqual(await f.execute(change), result);
  assert.equal(f.executions.length, 1); assert.equal(f.audit.length, 1);
  await assert.rejects(f.execute({ ...change, values: { ...values, title: 'Another' } }), { status: 409 });
  f.data.botProfile = { activityText: 'Changed in Discord' };
  await assert.rejects(f.execute({ ...change, requestId: randomUUID() }), { status: 409 });
});
test('Owner hooks reuse the announcement handler and existing status/reload runtime functions', async () => {
  let options, applied = 0, reloaded;
  const data = { announceConfigs: { [guildId]: { lastChannelId: channelId, lastMessageId: '444444444444444444' } } };
  const context = { IS_PUBLIC_BOT: true, client: {}, data, saveData() {}, PUBLIC_MAIN_GUILD_ID_SET: new Set([guildId]), RELOADABLE_MODULES: ['announce-system.js'],
    require: () => ({ startDashboardServer: value => { options = value; } }), applyBotProfile: async () => applied++, buildPublicStatsActivityText: () => '10 servers',
    reloadBotRuntime: async file => { reloaded = file; return { target: file, commandCount: 25, warnings: [] }; },
    announceSystem: { async handleButton(interaction) { assert.equal(interaction.customId, 'announce:send'); assert.ok(interaction.isButton()); assert.ok(interaction.inGuild()); assert.equal(interaction.user.id, ownerId); await interaction.update({}); } }
  };
  vm.runInNewContext(await readFile(new URL('../bot-integration/website-hooks.cjs', import.meta.url), 'utf8'), context);
  const guild = { id: guildId }, member = { user: { id: ownerId }, permissions: {} };
  await options.executeOwner('announe-panel', guild, member, { channelId, sendMode: 'edit' });
  assert.equal(data.announceConfigs[guildId].selectedMessageId, '444444444444444444');
  await options.executeOwner('setstaus', guild, member, { mode: 'stats' });
  assert.equal(applied, 1); assert.equal(data.botProfile.activityMode, 'stats');
  await options.executeOwner('reload', guild, member, { file: 'announce-system.js' });
  assert.equal(reloaded, 'announce-system.js');
  context.announceSystem.handleButton = async interaction => interaction.reply({ content: 'Cannot send' });
  await assert.rejects(options.executeOwner('announe-panel', guild, member, { channelId, sendMode: 'new' }), /Cannot send/);
});
