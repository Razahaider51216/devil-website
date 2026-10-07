import { createHash } from 'node:crypto';
import { cookie, seal, nonce } from './auth.js';

// Browsers cap persistent cookies; renew the longest supported duration on use.
export const SESSION_AGE = 400 * 24 * 60 * 60;
const refreshes = new Map();
const keyFor = token => createHash('sha256').update(token).digest('hex');
const expiry = tokens => {
  const seconds = Number(tokens.expires_in);
  if (!tokens.access_token || !Number.isFinite(seconds) || seconds <= 0) { const error = new Error('Discord ส่งข้อมูลการเข้าสู่ระบบไม่ครบ'); error.status = 502; throw error; }
  return Date.now() + seconds * 1000;
};
export function createSession(tokens, userId, userProfile) {
  if (!tokens.refresh_token) { const error = new Error('Discord ไม่ได้ส่ง Refresh Token กรุณาเข้าสู่ระบบใหม่'); error.status = 502; throw error; }
  return { token: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: expiry(tokens), userId, userProfile, csrf: nonce(), exp: Date.now() + SESSION_AGE * 1000 };
}
export function sessionCookie(session) { return cookie('devil_session', seal(session), SESSION_AGE); }
export async function restoreSession(session, force = false) {
  if (!session?.refreshToken) return session; // Legacy sessions need one new OAuth login.
  let result = session;
  if (force || !session.tokenExpiresAt || session.tokenExpiresAt <= Date.now() + 60000) {
    const key = keyFor(session.refreshToken);
    let entry = refreshes.get(key);
    if (!entry || entry.until <= Date.now()) {
      const promise = (async () => {
        let response;
        try {
          response = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken, client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET }), signal: AbortSignal.timeout(10000) });
        } catch { const error = new Error('Discord ไม่พร้อมต่ออายุการเข้าสู่ระบบ กรุณาลองอีกครั้ง'); error.status = 503; throw error; }
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const revoked = body.error === 'invalid_grant';
          const error = new Error(revoked ? 'สิทธิ์เข้าสู่ระบบ Discord ถูกยกเลิก กรุณาเข้าสู่ระบบใหม่' : 'Discord ไม่พร้อมต่ออายุการเข้าสู่ระบบ กรุณาลองอีกครั้ง');
          error.status = revoked ? 401 : 503; error.invalidateSession = revoked; throw error;
        }
        const tokens = await response.json();
        return { token: tokens.access_token, refreshToken: tokens.refresh_token || session.refreshToken, tokenExpiresAt: expiry(tokens) };
      })();
      entry = { promise, until: Date.now() + 30000 }; refreshes.set(key, entry);
      // Coalesce concurrent requests and late requests carrying a rotated token.
      promise.catch(() => { if (refreshes.get(key) === entry) refreshes.delete(key); });
      if (refreshes.size > 128) for (const old of refreshes.keys()) { if (old !== key) { refreshes.delete(old); break; } }
    }
    result = { ...session, ...await entry.promise };
  }
  return { ...result, exp: Date.now() + SESSION_AGE * 1000 };
}
export async function revokeSession(session) {
  if (!session.refreshToken) return;
  refreshes.delete(keyFor(session.refreshToken));
  try {
    await fetch('https://discord.com/api/v10/oauth2/token/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: session.refreshToken, token_type_hint: 'refresh_token', client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET }), signal: AbortSignal.timeout(3000) });
  } catch { /* Browser logout still succeeds when Discord is unreachable. */ }
}
