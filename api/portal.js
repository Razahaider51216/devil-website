import { readFile } from 'node:fs/promises';
import { seal, unseal, cookies, cookie, nonce, owners, discord, guilds, profile } from '../lib/auth.js';
import { bridge } from '../lib/bridge.js';
import { createSession, restoreSession, revokeSession, sessionCookie, SESSION_AGE } from '../lib/session.js';

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
    let session = unseal(cookies(req).devil_session);
    if (action === 'feature-image' && req.method === 'GET') {
      const imageId = url.searchParams.get('id');
      if (!/^[a-f0-9]{64}$/.test(imageId || '')) return send(res, 400, { error: 'ID รูปภาพไม่ถูกต้อง' });
      const owner = session && owners().includes(session.userId);
      const image = await bridge('feature-image-read', { imageId, ...(owner ? { userId: session.userId } : {}) });
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(image.mime) || typeof image.base64 !== 'string') return send(res, 502, { error: 'รูปภาพไม่ถูกต้อง' });
      const bytes = Buffer.from(image.base64, 'base64');
      res.writeHead(200, { 'Content-Type': image.mime, 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': owner ? 'private, max-age=300' : 'public, max-age=3600' });
      return res.end(bytes);
    }
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
      return redirect(res, '/dashboard', [cookie('devil_oauth', '', 0), sessionCookie(createSession(token, user.id, profile(user)))]);
    }
    if (action === 'catalog' && req.method === 'GET') return send(res, 200, JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8')));
    if (action === 'owners' && req.method === 'GET') {
      const results = await Promise.allSettled(owners().map(id => discord(`/users/${id}`, process.env.DISCORD_BOT_TOKEN, true).then(profile)));
      return send(res, 200, { owners: results.filter(r => r.status === 'fulfilled').map(r => r.value), unavailable: results.filter(r => r.status === 'rejected').length, configured: owners().length > 0 });
    }
    if (action === 'content' && req.method === 'GET') return send(res, 200, await bridge('content'));
    if (action === 'session' && req.method === 'GET') {
      if (!session) return send(res, 200, { user: null, loginConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.SESSION_SECRET) });
      try { session = await restoreSession(session); }
      catch (error) {
        if (error.status >= 500 && session.userProfile) {
          res.setHeader('Set-Cookie', sessionCookie({ ...session, exp: Date.now() + SESSION_AGE * 1000 }));
          return send(res, 200, { user: session.userProfile, owner: owners().includes(session.userId), csrf: session.csrf, connectionUnavailable: true });
        }
        throw error;
      }
      let user;
      try { user = profile(await discord('/users/@me', session.token)); }
      catch (error) {
        if (error.status === 401 && session.refreshToken) {
          session = await restoreSession(session, true);
          user = profile(await discord('/users/@me', session.token));
        } else if (error.status !== 401 && session.userProfile) user = session.userProfile;
        else throw error;
      }
      if (session.refreshToken) res.setHeader('Set-Cookie', sessionCookie({ ...session, userProfile: user }));
      return send(res, 200, { user, owner: owners().includes(session.userId), csrf: session.csrf });
    }
    if (!session) return send(res, 401, { error: 'กรุณาเข้าสู่ระบบด้วย Discord' });
    if (req.method !== 'GET') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
      if (req.headers.origin !== new URL(appUrl).origin || req.headers['x-csrf-token'] !== session.csrf) return send(res, 403, { error: 'คำขอไม่ผ่านการตรวจสอบความปลอดภัย' });
    }
    if (action === 'logout' && req.method === 'POST') { await revokeSession(session); res.setHeader('Set-Cookie', cookie('devil_session', '', 0)); return send(res, 200, { ok: true }); }
    session = await restoreSession(session);
    if (session.refreshToken) res.setHeader('Set-Cookie', sessionCookie(session));
    if (action === 'admin' && ['GET', 'POST'].includes(req.method)) {
      if (!owners().includes(session.userId)) return send(res, 403, { error: 'เฉพาะ Owner เท่านั้น' });
      return send(res, 200, await bridge(req.method === 'GET' ? 'admin-read' : 'admin-write', { userId: session.userId, ...(req.method === 'POST' ? { content: await readBody(req) } : {}) }));
    }
    if (action === 'admin-item' && req.method === 'POST') {
      if (!owners().includes(session.userId)) return send(res, 403, { error: 'เฉพาะ Owner เท่านั้น' });
      return send(res, 200, await bridge('admin-item-write', { userId: session.userId, change: await readBody(req) }));
    }
    if (action === 'feature-preview' && req.method === 'GET') {
      if (!owners().includes(session.userId)) return send(res, 403, { error: 'เฉพาะ Owner เท่านั้น' });
      const guildId = url.searchParams.get('guildId'), channelId = url.searchParams.get('channelId'), system = url.searchParams.get('system');
      if ([guildId, channelId].some(id => id && !/^\d{15,22}$/.test(id))) return send(res, 400, { error: 'ID เซิร์ฟเวอร์หรือช่องไม่ถูกต้อง' });
      if (!guildId) {
        const [mine, joined] = await Promise.all([guilds(session.token), bridge('guilds')]);
        const botIds = new Set(joined.guilds.map(g => g.id));
        return send(res, 200, { guilds: mine.filter(g => botIds.has(g.id) && (g.owner || (BigInt(g.permissions || 0) & 40n) !== 0n)).map(g => ({ id: g.id, name: g.name })) });
      }
      return send(res, 200, await bridge('feature-preview-read', { userId: session.userId, guildId, channelId, system }));
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
  } catch (error) { if (error.invalidateSession) res.setHeader('Set-Cookie', cookie('devil_session', '', 0)); return send(res, error instanceof SyntaxError ? 400 : error.status || 502, { error: error instanceof SyntaxError ? 'ข้อมูล JSON ไม่ถูกต้อง' : error.message }); }
}
