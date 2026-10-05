import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { seal, unseal, profile } from '../lib/auth.js';
import handler from '../api/portal.js';
const secret = 'test-session-secret-with-at-least-32-characters';
process.env.SESSION_SECRET = secret;
process.env.APP_URL = 'https://devil.example';
async function request(action, { method = 'GET', session, origin, csrf, body = {}, cookieHeader } = {}) {
  const req = Readable.from([]); req.url = `/api/portal?action=${action}`; req.method = method; req.headers = { cookie: cookieHeader || (session ? `devil_session=${seal(session)}` : ''), origin, 'x-csrf-token': csrf }; req.body = body;
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, writeHead(code, h) { this.code = code; Object.assign(this.headers, h); }, end(body) { this.body = body ? JSON.parse(body) : null; } };
  await handler(req, res); return res;
}
test('session encryption detects tampering, expires and conceals access tokens', () => {
  const data = { token: 'discord-private-token', exp: Date.now() + 60000 };
  const encoded = seal(data, secret); assert.deepEqual(unseal(encoded, secret), data);
  assert.ok(!encoded.includes(data.token)); assert.equal(unseal(encoded, `${secret}x`), null);
  assert.equal(unseal(`${encoded.slice(0, 8)}A${encoded.slice(9)}`, secret), null);
  assert.equal(unseal(seal({ ...data, exp: Date.now() - 1 }, secret), secret), null);
});
test('dashboard and CMS reject unauthenticated, non-owner, cross-origin and CSRF requests', async () => {
  const session = { userId: '111111111111111111', token: 'test', csrf: 'expected-csrf', exp: Date.now() + 60000 };
  assert.equal((await request('admin')).code, 401);
  assert.equal((await request('owner')).code, 401);
  assert.equal((await request('settings&guildId=123456789012345678')).code, 401);
  assert.equal((await request('admin', { session })).code, 403);
  assert.equal((await request('owner', { session })).code, 403);
  assert.equal((await request('owner', { method: 'POST', session, origin: 'https://evil.example', csrf: session.csrf })).code, 403);
  assert.equal((await request('logout', { method: 'POST', session, origin: 'https://evil.example', csrf: session.csrf })).code, 403);
  assert.equal((await request('logout', { method: 'POST', session, origin: 'https://devil.example', csrf: 'wrong' })).code, 403);
  const logout = await request('logout', { method: 'POST', session, origin: 'https://devil.example', csrf: session.csrf });
  assert.equal(logout.code, 200); assert.match(logout.headers['Set-Cookie'], /Max-Age=0/);
});
test('OAuth callback rejects missing or mismatched state without contacting Discord', async () => {
  const response = await request('callback&state=forged&code=fake'); assert.equal(response.code, 302); assert.equal(response.headers.Location, '/dashboard?error=oauth');
});
test('OAuth login exchanges a matching state, encrypts the session and clears the state cookie', async () => {
  process.env.DISCORD_CLIENT_ID = '123456789012345678'; process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
  const login = await request('login'); const authorize = new URL(login.headers.Location);
  assert.equal(authorize.searchParams.get('scope'), 'identify guilds');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('/oauth2/token') ? { access_token: 'private-access-token', expires_in: 1000 } : { id: '222222222222222222', username: 'Owner' } });
  try {
    const result = await request(`callback&state=${authorize.searchParams.get('state')}&code=test-code`, { cookieHeader: login.headers['Set-Cookie'][0].split(';')[0] });
    assert.equal(result.code, 302); assert.equal(result.headers.Location, '/dashboard');
    assert.match(result.headers['Set-Cookie'][0], /Max-Age=0/);
    const cookie = result.headers['Set-Cookie'][1]; assert.ok(!cookie.includes('private-access-token')); assert.match(cookie, /HttpOnly.*SameSite=Lax.*Secure/);
    assert.equal(unseal(cookie.split(';')[0].split('=')[1]).userId, '222222222222222222');
  } finally { globalThis.fetch = originalFetch; delete process.env.DISCORD_CLIENT_ID; delete process.env.DISCORD_CLIENT_SECRET; }
});
test('catalog contains all Public and VIP commands and excludes private-only commands', async () => {
  const response = await request('catalog'); assert.equal(response.code, 200);
  const commands = response.body.commands;
  assert.deepEqual(commands.filter(c => c.mode === 'VIP').map(c => c.name).sort(), ['set-shop', 'setbuy', 'shop']);
  assert.ok(commands.some(c => c.name === 'set-welcom')); assert.ok(!commands.some(c => ['setdonate', 'setreport-channel', 'setboost'].includes(c.name)));
});
test('Discord profile maps animated avatars, banners and actual decorations', () => {
  const p = profile({ id: '123456789012345678', username: 'Owner', avatar: 'a_hash', banner: 'a_banner', avatar_decoration_data: { asset: 'frame' } });
  assert.match(p.avatarUrl, /a_hash.gif/); assert.match(p.bannerUrl, /a_banner.gif/); assert.match(p.decorationUrl, /avatar-decoration-presets\/frame.png/);
  assert.equal(profile({ id: p.id, username: 'Owner' }).decorationUrl, null);
});
