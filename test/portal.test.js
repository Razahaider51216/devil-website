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
  const tampered = `${encoded.slice(0, 8)}${encoded[8] === 'A' ? 'B' : 'A'}${encoded.slice(9)}`;
  assert.equal(unseal(tampered, secret), null);
  assert.equal(unseal(seal({ ...data, exp: Date.now() - 1 }, secret), secret), null);
});
test('dashboard and CMS reject unauthenticated, non-owner, cross-origin and CSRF requests', async () => {
  const session = { userId: '111111111111111111', token: 'test', csrf: 'expected-csrf', exp: Date.now() + 60000 };
  assert.equal((await request('admin')).code, 401);
  assert.equal((await request('admin-item', { method: 'POST' })).code, 401);
  assert.equal((await request('owner')).code, 401);
  assert.equal((await request('feature-preview')).code, 401);
  assert.equal((await request('settings&guildId=123456789012345678')).code, 401);
  assert.equal((await request('admin', { session })).code, 403);
  assert.equal((await request('admin-item', { method: 'POST', session, origin: 'https://devil.example', csrf: session.csrf })).code, 403);
  assert.equal((await request('admin-item', { method: 'POST', session, origin: 'https://evil.example', csrf: session.csrf })).code, 403);
  assert.equal((await request('feature-image&id=../secret')).code, 400);
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

test('bot invitation redirects guests to Discord using only public application settings', async () => {
  const previous = process.env.DISCORD_CLIENT_ID;
  delete process.env.DISCORD_CLIENT_ID;
  assert.equal((await request('invite')).code, 503);
  process.env.DISCORD_CLIENT_ID = '123456789012345678';
  try {
    const result = await request('invite');
    assert.equal(result.code, 302);
    const target = new URL(result.headers.Location);
    assert.equal(target.origin, 'https://discord.com');
    assert.equal(target.searchParams.get('scope'), 'bot applications.commands');
    assert.equal(target.searchParams.get('client_id'), process.env.DISCORD_CLIENT_ID);
    assert.equal(target.searchParams.has('client_secret'), false);
  } finally { if (previous === undefined) delete process.env.DISCORD_CLIENT_ID; else process.env.DISCORD_CLIENT_ID = previous; }
});
test('OAuth login exchanges a matching state, encrypts the session and clears the state cookie', async () => {
  process.env.DISCORD_CLIENT_ID = '123456789012345678'; process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
  const login = await request('login'); const authorize = new URL(login.headers.Location);
  assert.equal(authorize.searchParams.get('scope'), 'identify guilds');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('/oauth2/token') ? { access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 1000 } : { id: '222222222222222222', username: 'Owner' } });
  try {
    const result = await request(`callback&state=${authorize.searchParams.get('state')}&code=test-code`, { cookieHeader: login.headers['Set-Cookie'][0].split(';')[0] });
    assert.equal(result.code, 302); assert.equal(result.headers.Location, '/dashboard');
    assert.match(result.headers['Set-Cookie'][0], /Max-Age=0/);
    const cookie = result.headers['Set-Cookie'][1]; assert.ok(!cookie.includes('private-access-token')); assert.match(cookie, /HttpOnly.*SameSite=Lax.*Secure/);
    assert.equal(unseal(cookie.split(';')[0].split('=')[1]).userId, '222222222222222222');
    assert.equal(unseal(cookie.split(';')[0].split('=')[1]).refreshToken, 'private-refresh-token');
    assert.match(cookie, /Max-Age=34560000/);
    assert.ok(!cookie.includes('private-refresh-token'));
  } finally { globalThis.fetch = originalFetch; delete process.env.DISCORD_CLIENT_ID; delete process.env.DISCORD_CLIENT_SECRET; }
});
test('returning after token expiry refreshes login, rotates tokens, preserves CSRF and extends the browser cookie', async () => {
  const originalFetch = globalThis.fetch;
  const session = { userId: '222222222222222222', token: 'expired-access', refreshToken: 'returning-refresh', tokenExpiresAt: Date.now() - 14 * 86400000, csrf: 'stable-csrf', exp: Date.now() + 86400000 };
  let refreshCount = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/oauth2/token')) {
      refreshCount++; assert.equal(options.body.get('grant_type'), 'refresh_token'); assert.equal(options.body.get('refresh_token'), 'returning-refresh');
      await new Promise(resolve => setImmediate(resolve));
      return { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 604800 }) };
    }
    assert.equal(options.headers.Authorization, 'Bearer new-access'); return { ok: true, json: async () => ({ id: session.userId, username: 'Returning member' }) };
  };
  try {
    const [first, concurrent] = await Promise.all([request('session', { session }), request('session', { session })]);
    assert.equal(first.code, 200); assert.equal(concurrent.code, 200); assert.equal(refreshCount, 1);
    assert.equal(first.body.csrf, session.csrf); assert.equal(first.body.user.name, 'Returning member');
    const next = unseal(first.headers['Set-Cookie'].split(';')[0].split('=')[1]);
    assert.equal(next.refreshToken, 'rotated-refresh'); assert.equal(next.token, 'new-access');
    assert.ok(next.exp > Date.now() + 399 * 86400000);
    assert.ok(next.tokenExpiresAt < next.exp); assert.ok(!JSON.stringify(first.body).includes('rotated-refresh'));
  } finally { globalThis.fetch = originalFetch; }
});

test('temporary refresh failure keeps the existing account and cookie; revoked authorization requires login', async () => {
  const originalFetch = globalThis.fetch;
  const session = { userId: '222222222222222222', token: 'expired', refreshToken: 'retry-refresh', tokenExpiresAt: 1, csrf: 'csrf', userProfile: { id: '222222222222222222', name: 'Member' }, exp: Date.now() + 86400000 };
  try {
    globalThis.fetch = async () => { throw new Error('offline'); };
    const temporary = await request('session', { session });
    assert.equal(temporary.code, 200); assert.equal(temporary.body.user.name, 'Member'); assert.equal(temporary.body.connectionUnavailable, true);
    assert.ok(!temporary.headers['Set-Cookie'].includes('Max-Age=0'));
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
    const revoked = await request('session', { session: { ...session, refreshToken: 'revoked-refresh' } });
    assert.equal(revoked.code, 401); assert.match(revoked.headers['Set-Cookie'], /Max-Age=0/);
  } finally { globalThis.fetch = originalFetch; }
});

test('logout works after access-token expiry without refreshing, revokes Discord and rejects CSRF first', async () => {
  const originalFetch = globalThis.fetch;
  const session = { userId: '222222222222222222', token: 'expired', refreshToken: 'logout-refresh', tokenExpiresAt: 1, csrf: 'logout-csrf', exp: Date.now() + 86400000 };
  let calls = 0;
  globalThis.fetch = async (url, options) => { calls++; assert.ok(String(url).endsWith('/oauth2/token/revoke')); assert.equal(options.body.get('token'), 'logout-refresh'); return { ok: true }; };
  try {
    assert.equal((await request('logout', { method: 'POST', session, origin: 'https://devil.example', csrf: 'wrong' })).code, 403); assert.equal(calls, 0);
    const result = await request('logout', { method: 'POST', session, origin: 'https://devil.example', csrf: session.csrf });
    assert.equal(result.code, 200); assert.equal(calls, 1); assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
  } finally { globalThis.fetch = originalFetch; }
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
