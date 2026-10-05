import { readFile } from 'node:fs/promises';
import { seal, unseal, cookies, cookie, nonce, owners, discord, guilds, profile } from '../lib/auth.js';
import { bridge } from '../lib/bridge.js';

const send = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const redirect = (res, location, values = []) => { res.writeHead(302, { Location: location, 'Set-Cookie': values, 'Cache-Control': 'no-store' }); res.end(); };
export async function readBody(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 200000) { const e = new Error('ข้อมูลใหญ่เกินไป'); e.status = 413; throw e; }
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  let value = ''; for await (const chunk of req) { value += chunk; if (Buffer.byteLength(value) > 200000) { const e = new Error('ข้อมูลใหญ่เกินไป'); e.status = 413; throw e; } }
  return value ? JSON.parse(value) : {};
}
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, process.env.APP_URL || 'http://localhost:3000');
    const action = url.searchParams.get('action') || 'session';
    const session = unseal(cookies(req).devil_session);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const callback = `${appUrl.replace(/\/$/, '')}/api/portal?action=callback`;
    if (action === 'invite' && req.method === 'GET') {
      if (!/^\d{15,22}$/.test(process.env.DISCORD_CLIENT_ID || '')) return send(res, 503, { error: 'ยังไม่ได้ตั้งค่า Discord Client ID สำหรับเชิญบอท' });
      const target = new URL('https://discord.com/oauth2/authorize');
      target.search = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, scope: 'bot applications.commands', permissions: '8' }).toString();
      return redirect(res, target.href);
    }
    if (action === 'login' && req.method === 'GET') {
      if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.SESSION_SECRET) return send(res, 503, { error: 'กรุณาตั้งค่า Discord OAuth ใน .env ก่อน' });
      const state = nonce();
      const target = new URL('https://discord.com/oauth2/authorize');
      target.search = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify guilds', redirect_uri: callback, state }).toString();
      return redirect(res, target.href, [cookie('devil_oauth', seal({ state, exp: Date.now() + 300000 }), 300)]);
    }
    if (action === 'callback' && req.method === 'GET') {
      const state = unseal(cookies(req).devil_oauth);
      if (!state || state.state !== url.searchParams.get('state') || !url.searchParams.get('code')) return redirect(res, '/dashboard?error=oauth', [cookie('devil_oauth', '', 0)]);
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, redirect_uri: callback }), signal: AbortSignal.timeout(10000) });
      if (!tokenResponse.ok) return redirect(res, '/dashboard?error=oauth', [cookie('devil_oauth', '', 0)]);
      const token = await tokenResponse.json(); const user = await discord('/users/@me', token.access_token);
      const age = Math.min(3600, token.expires_in);
      return redirect(res, '/dashboard', [cookie('devil_oauth', '', 0), cookie('devil_session', seal({ token: token.access_token, userId: user.id, csrf: nonce(), exp: Date.now() + age * 1000 }), age)]);
    }
    if (action === 'catalog' && req.method === 'GET') return send(res, 200, JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8')));
    if (action === 'owners' && req.method === 'GET') {
      const results = await Promise.allSettled(owners().map(id => discord(`/users/${id}`, process.env.DISCORD_BOT_TOKEN, true).then(profile)));
      return send(res, 200, { owners: results.filter(r => r.status === 'fulfilled').map(r => r.value), unavailable: results.filter(r => r.status === 'rejected').length, configured: owners().length > 0 });
    }
    if (action === 'content' && req.method === 'GET') return send(res, 200, await bridge('content'));
    if (action === 'session' && req.method === 'GET') {
      if (!session) return send(res, 200, { user: null, loginConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.SESSION_SECRET) });
      return send(res, 200, { user: profile(await discord('/users/@me', session.token)), owner: owners().includes(session.userId), csrf: session.csrf });
    }
    if (!session) return send(res, 401, { error: 'กรุณาเข้าสู่ระบบด้วย Discord' });
    if (req.method !== 'GET') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (req.headers.origin !== new URL(appUrl).origin || req.headers['x-csrf-token'] !== session.csrf) return send(res, 403, { error: 'คำขอไม่ผ่านการตรวจสอบความปลอดภัย' });
    }
    if (action === 'logout' && req.method === 'POST') { res.setHeader('Set-Cookie', cookie('devil_session', '', 0)); return send(res, 200, { ok: true }); }
    if (action === 'admin' && ['GET', 'POST'].includes(req.method)) {
      if (!owners().includes(session.userId)) return send(res, 403, { error: 'เฉพาะ Owner เท่านั้น' });
      return send(res, 200, await bridge(req.method === 'GET' ? 'admin-read' : 'admin-write', { userId: session.userId, ...(req.method === 'POST' ? { content: await readBody(req) } : {}) }));
    }
    if (action === 'owner' && ['GET', 'POST'].includes(req.method)) {
      if (!owners().includes(session.userId)) return send(res, 403, { error: 'เฉพาะ Owner เท่านั้น' });
      const guildId = url.searchParams.get('guildId');
      if (guildId && !/^\d{15,22}$/.test(guildId)) return send(res, 400, { error: 'Guild ID ไม่ถูกต้อง' });
      return send(res, 200, await bridge(req.method === 'GET' ? 'owner-read' : 'owner-execute', { userId: session.userId, guildId, ...(req.method === 'POST' ? { change: await readBody(req) } : {}) }));
    }
    if (action === 'guilds' && req.method === 'GET') {
      const [mine, joined] = await Promise.all([guilds(session.token), bridge('guilds')]);
      const botIds = new Set(joined.guilds.map(g => g.id));
      return send(res, 200, { guilds: mine.filter(g => g.owner || (BigInt(g.permissions || 0) & 40n) !== 0n).map(g => ({ id: g.id, name: g.name, iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null, botPresent: botIds.has(g.id), vip: joined.guilds.find(b => b.id === g.id)?.vip || false })), inviteUrl: process.env.DISCORD_CLIENT_ID ? `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=8` : null });
    }
    if (action === 'settings' && ['GET', 'POST'].includes(req.method)) {
      const guildId = url.searchParams.get('guildId');
      if (!/^\d{15,22}$/.test(guildId || '')) return send(res, 400, { error: 'Guild ID ไม่ถูกต้อง' });
      const mine = await guilds(session.token);
      if (!mine.some(g => g.id === guildId && (g.owner || (BigInt(g.permissions || 0) & 40n) !== 0n))) return send(res, 403, { error: 'ต้องมีสิทธิ์ Manage Server หรือ Administrator' });
      return send(res, 200, await bridge(req.method === 'GET' ? 'settings-read' : 'settings-write', { guildId, userId: session.userId, ...(req.method === 'POST' ? { change: await readBody(req) } : {}) }));
    }
    return send(res, 404, { error: 'ไม่พบ API' });
  } catch (error) { return send(res, error instanceof SyntaxError ? 400 : error.status || 502, { error: error instanceof SyntaxError ? 'ข้อมูล JSON ไม่ถูกต้อง' : error.message }); }
}
