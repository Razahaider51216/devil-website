import test from 'node:test';
import assert from 'node:assert/strict';

test('uses the featured guild when Discord temporarily rejects the guild list', async () => {
  process.env.DISCORD_BOT_TOKEN = 'test-secret-token'; process.env.DISCORD_GUILD_ID = '123456789';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url.includes('/users/@me/guilds')) return { ok: false, status: 503 };
    if (url.endsWith('/users/@me')) return { ok: true, json: async () => ({ id: '42', username: 'Devil' }) };
    return { ok: true, json: async () => ({ id: '123456789', name: 'Featured community', approximate_member_count: 42 }) };
  };
  try { const { getBotData } = await import('../lib/discord.js?fallback-test'); const result = await getBotData(); assert.equal(result.servers[0].name, 'Featured community'); assert.equal(result.servers[0].members, 42); assert.equal(result.serversStale, false); } finally { globalThis.fetch = originalFetch; }
});

test('maps Discord bot and guild data without exposing the token, then caches it', async () => {
  process.env.DISCORD_BOT_TOKEN = 'test-secret-token';
  process.env.DISCORD_GUILD_ID = '123456789';
  process.env.DISCORD_INVITE_URL = 'https://discord.gg/example';

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/users/@me')) {
      return { ok: true, json: async () => ({ id: '42', username: 'Devil', global_name: 'DEVIL BOT', avatar: 'avatarhash' }) };
    }
    return { ok: true, json: async () => ([
      { id: '123456789', name: 'The Devil Den', approximate_presence_count: 28, approximate_member_count: 240, icon: null },
      { id: '987654321', name: 'Blue Lounge', approximate_presence_count: 12, approximate_member_count: 88, icon: 'iconhash' }
    ]) };
  };

  try {
    const { getBotData } = await import('../lib/discord.js');
    const first = await getBotData();
    const second = await getBotData();
    assert.deepEqual(first, second);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.headers.Authorization, 'Bot test-secret-token');
    assert.equal(first.bot.name, 'DEVIL BOT');
    assert.equal(first.bot.avatarUrl, 'https://cdn.discordapp.com/avatars/42/avatarhash.png?size=256');
    assert.equal(first.server.name, 'The Devil Den');
    assert.equal(first.server.online, 28);
    assert.equal(first.server.members, 240);
    assert.equal(first.servers.length, 2);
    assert.deepEqual(first.servers.map(server => [server.name, server.members]), [['The Devil Den', 240], ['Blue Lounge', 88]]);
    assert.equal(first.servers[1].iconUrl, 'https://cdn.discordapp.com/icons/987654321/iconhash.png?size=128');
    assert.equal(first.inviteUrl, 'https://discord.gg/example');
    assert.ok(!JSON.stringify(first).includes('test-secret-token'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('loads every page when the bot has more than 200 joined servers', async () => {
  process.env.DISCORD_BOT_TOKEN = 'test-secret-token';
  process.env.DISCORD_GUILD_ID = '';
  const originalFetch = globalThis.fetch;
  const routes = [];
  globalThis.fetch = async url => {
    routes.push(url);
    if (url.endsWith('/users/@me')) return { ok: true, json: async () => ({ id: '42', username: 'Devil', avatar: null }) };
    const page = url.includes('after=200')
      ? [{ id: '201', name: 'Server 201', approximate_member_count: 201 }]
      : Array.from({ length: 200 }, (_, index) => ({ id: String(index + 1), name: `Server ${index + 1}`, approximate_member_count: index + 1 }));
    return { ok: true, json: async () => page };
  };

  try {
    const { getBotData } = await import('../lib/discord.js?pagination-test');
    const data = await getBotData();
    assert.equal(data.servers.length, 201);
    assert.equal(data.servers.at(-1).members, 201);
    assert.ok(routes.some(route => route.includes('after=200')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
