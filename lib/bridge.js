export async function bridge(action, payload = {}) {
  const address = process.env.BOT_DASHBOARD_API_URL;
  if (!address || !process.env.BOT_DASHBOARD_SECRET) { const e = new Error('ยังไม่ได้เชื่อม Bot Dashboard API'); e.status = 503; throw e; }
  const url = new URL(address);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Dashboard API ต้องใช้ HTTPS');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.BOT_DASHBOARD_SECRET}` }, body: JSON.stringify({ ...payload, action }), signal: AbortSignal.timeout(20000), redirect: 'error' });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'บอทไม่พร้อมใช้งาน'); error.status = response.status; throw error; }
  return data;
}
