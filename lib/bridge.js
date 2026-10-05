export async function bridge(action, payload = {}, { timeoutMs = 20000 } = {}) {
  const address = process.env.BOT_DASHBOARD_API_URL;
  if (!address || !process.env.BOT_DASHBOARD_SECRET) { const e = new Error('ยังไม่ได้เชื่อม Bot Dashboard API'); e.status = 503; throw e; }
  const url = new URL(address);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Dashboard API ต้องใช้ HTTPS');
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.BOT_DASHBOARD_SECRET}` }, body: JSON.stringify({ ...payload, action }), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  } catch {
    const error = new Error('เชื่อมต่อ Bot Dashboard API ไม่ได้ ตรวจว่าบอท Public เปิดอยู่และ Caddy ส่งต่อไปพอร์ต Dashboard ถูกต้อง'); error.status = 503; throw error;
  }
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { /* Caddy errors may be plain text or HTML. */ }
  if (response.status === 404) { const error = new Error('Bot Dashboard API ตอบ 404: ตรวจ BOT_DASHBOARD_API_URL ให้ลงท้าย /dashboard และเพิ่มเส้นทาง /dashboard ใน Caddy'); error.status = 502; throw error; }
  if (response.status === 401) { const error = new Error('Bot Dashboard API ไม่ยอมรับ secret: ตั้ง BOT_DASHBOARD_SECRET ใน Vercel และบอทให้ตรงกัน แล้วรีสตาร์ตบอทและ redeploy เว็บ'); error.status = 502; throw error; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { const error = new Error(`Bot Dashboard API ไม่ได้ส่งข้อมูล JSON ที่ถูกต้อง (HTTP ${response.status}) ตรวจ URL และการตั้งค่า Caddy`); error.status = 502; throw error; }
  if (!response.ok) { const error = new Error(data.error || 'บอทไม่พร้อมใช้งาน'); error.status = response.status; throw error; }
  return data;
}
