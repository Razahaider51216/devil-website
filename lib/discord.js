import { bridge } from './bridge.js';
const token = process.env.DISCORD_BOT_TOKEN || '';
const guildId = process.env.DISCORD_GUILD_ID || '';
const inviteUrl = process.env.DISCORD_INVITE_URL || '';

let cached = null;
let cachedAt = 0;
let pending = null;
let lastJoinedGuilds = null;
let vipGuildIds = new Set(String(process.env.PREMIUM_GUILD_IDS || process.env.PREMIUM_SERVER_IDS || '').split(',').map(id => id.trim()).filter(Boolean));

function avatarUrl(user) {
  if (!user?.avatar) return null;
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
}

async function discordGet(route) {
  const response = await fetch(`https://discord.com/api/v10${route}`, {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Discord API returned ${response.status}`);
  return response.json();
}

async function getJoinedGuilds() {
  const guilds = [];
  let after = '';
  const seenCursors = new Set();
  while (true) {
    const route = `/users/@me/guilds?with_counts=true&limit=200${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const page = await discordGet(route);
    if (!Array.isArray(page)) throw new Error('Discord returned an invalid guild list');
    guilds.push(...page);
    if (page.length < 200) break;
    const next = page.at(-1)?.id;
    if (!next || seenCursors.has(next)) throw new Error('Discord guild pagination did not advance');
    seenCursors.add(next);
    after = next;
  }
  return guilds;
}

function mapGuild(guild) {
  return {
    id: guild.id,
    name: guild.name,
    vip: vipGuildIds.has(guild.id),
    online: Number.isFinite(guild.approximate_presence_count) ? guild.approximate_presence_count : null,
    members: Number.isFinite(guild.approximate_member_count) ? guild.approximate_member_count : null,
    iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null
  };
}

export async function getBotData() {
  if (!token) {
    return { configured: false, bot: null, server: null, servers: null, inviteUrl: safeInviteUrl() };
  }
  const now = Date.now();
  if (cached && now - cachedAt < 60_000) return cached;
  if (pending) return pending;

  pending = (async () => {
    const [userResult, guildsResult, vipResult] = await Promise.allSettled([
      discordGet('/users/@me'),
      getJoinedGuilds(),
      process.env.BOT_DASHBOARD_API_URL && process.env.BOT_DASHBOARD_SECRET ? bridge('guilds', {}, { timeoutMs: 3000 }) : Promise.resolve(null)
    ]);
    if (vipResult.status === 'fulfilled' && Array.isArray(vipResult.value?.guilds)) vipGuildIds = new Set(vipResult.value.guilds.filter(g => g.vip === true).map(g => g.id));
    const user = userResult.status === 'fulfilled' ? userResult.value : null;
    const guilds = guildsResult.status === 'fulfilled' ? guildsResult.value : lastJoinedGuilds;
    if (guildsResult.status === 'fulfilled') lastJoinedGuilds = guildsResult.value;
    const featured = guilds?.find(guild => guild.id === guildId) || guilds?.[0] || null;
    let fallback = null;
    if (!featured && guildId) {
      try { fallback = await discordGet(`/guilds/${encodeURIComponent(guildId)}?with_counts=true`); }
      catch (error) { console.error('Featured guild lookup failed:', error.message); }
    }
    const result = {
      configured: true,
      bot: user ? { name: user.global_name || user.username, username: user.username, avatarUrl: avatarUrl(user) } : null,
      server: featured || fallback ? mapGuild(featured || fallback) : null,
      servers: guilds ? guilds.map(mapGuild) : fallback ? [mapGuild(fallback)] : null,
      serversStale: guildsResult.status === 'rejected' && Boolean(lastJoinedGuilds),
      inviteUrl: safeInviteUrl()
    };
    cached = result;
    cachedAt = guildsResult.status === 'fulfilled' ? Date.now() : Date.now() - 50_000;
    if (userResult.status === 'rejected') console.error('Bot lookup failed:', userResult.reason.message);
    if (guildsResult.status === 'rejected') console.error('Guild list lookup failed:', guildsResult.reason.message);
    return result;
  })();

  try { return await pending; }
  finally { pending = null; }
}

function safeInviteUrl() {
  try {
    const parsed = new URL(inviteUrl);
    if (parsed.protocol === 'https:' && ['discord.gg', 'discord.com', 'www.discord.com'].includes(parsed.hostname)) return parsed.href;
  } catch { /* No invite configured. */ }
  return null;
}
