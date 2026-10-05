import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function seal(value, secret = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString('base64url');
}
export function unseal(value, secret = process.env.SESSION_SECRET) {
  try {
    if (!secret || secret.length < 32 || !value) return null;
    const bytes = Buffer.from(value, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(p => p.trim().split(/=(.*)/s)).filter(p => p.length > 1).map(([k, v]) => [k, v]));
}
export function cookie(name, value, maxAge) {
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${new URL(process.env.APP_URL || 'http://localhost:3000').protocol === 'https:' ? '; Secure' : ''}`;
}
export const nonce = () => randomBytes(24).toString('base64url');
export const owners = () => (process.env.OWNER_IDS || process.env.OWNER_ID || '').split(',').map(v => v.trim()).filter(v => /^\d{15,22}$/.test(v));
export async function discord(route, token, bot = false) {
  const response = await fetch(`https://discord.com/api/v10${route}`, { headers: { Authorization: `${bot ? 'Bot' : 'Bearer'} ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const error = new Error(response.status === 401 ? 'เซสชัน Discord หมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'Discord ไม่พร้อมใช้งาน กรุณาลองอีกครั้ง'); error.status = response.status === 401 ? 401 : 502; throw error; }
  return response.json();
}
export async function guilds(token) {
  const result = []; let after = '';
  for (let page = 0; page < 100; page++) {
    const next = await discord(`/users/@me/guilds?limit=200${after ? `&after=${after}` : ''}`, token);
    result.push(...next);
    if (next.length < 200) return result;
    if (after === next.at(-1).id) throw new Error('Discord guild pagination failed');
    after = next.at(-1).id;
  }
  throw new Error('Too many Discord guild pages');
}
export function profile(user) {
  const extension = hash => hash?.startsWith('a_') ? 'gif' : 'png';
  return { id: user.id, name: user.global_name || user.username, username: user.username,
    avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension(user.avatar)}?size=256` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`,
    bannerUrl: user.banner ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${extension(user.banner)}?size=600` : null,
    decorationUrl: user.avatar_decoration_data?.asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=160&passthrough=true` : null,
    accentColor: user.accent_color != null ? `#${user.accent_color.toString(16).padStart(6, '0')}` : null,
    profileUrl: `https://discord.com/users/${user.id}` };
}
