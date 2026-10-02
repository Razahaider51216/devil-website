import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const token = process.env.DISCORD_BOT_TOKEN || '';
const guildId = process.env.DISCORD_GUILD_ID || '';
const inviteUrl = process.env.DISCORD_INVITE_URL || '';

let cached = null;
let cachedAt = 0;
let pending = null;

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
    const [userResult, guildsResult] = await Promise.allSettled([
      discordGet('/users/@me'),
      getJoinedGuilds()
    ]);
    const user = userResult.status === 'fulfilled' ? userResult.value : null;
    const guilds = guildsResult.status === 'fulfilled' ? guildsResult.value : null;
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
      servers: guilds ? guilds.map(mapGuild) : null,
      inviteUrl: safeInviteUrl()
    };
    cached = result;
    cachedAt = Date.now();
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

const staticFiles = {
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml']
};

export const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  if (pathname === '/api/status') {
    const body = JSON.stringify(await getBotData());
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }
  if (pathname === '/bot-avatar' || pathname === '/favicon.ico') {
    const data = await getBotData();
    response.writeHead(302, {
      Location: data.bot?.avatarUrl || '/favicon.svg',
      'Cache-Control': 'no-cache'
    });
    response.end();
    return;
  }
  const isPage = ['/', '/privacy', '/terms', '/support'].includes(pathname);
  const file = isPage ? ['index.html', 'text/html; charset=utf-8'] : staticFiles[pathname];
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    let body = await readFile(path.join(publicDir, file[0]));
    if (isPage) {
      const data = await getBotData();
      body = Buffer.from(body.toString('utf8').replaceAll('__BOT_AVATAR_URL__', data.bot?.avatarUrl || '/favicon.svg'));
    }
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500);
    response.end('Unable to load page');
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, () => console.log(`DEVIL BOT website running at http://localhost:${port}`));
}
