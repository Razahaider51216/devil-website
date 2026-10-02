const offline = { online: false, status: 'offline', ping: null };

export async function getBotStatus() {
  const address = process.env.BOT_STATUS_API_URL || 'https://82-26-104-147.sslip.io/health';
  const secret = process.env.BOT_STATUS_SECRET;

  let url;
  try {
    url = new URL(address);
    if (url.protocol !== 'https:' || url.username || url.password) return offline;
  } catch {
    return offline;
  }

  try {
    const response = await fetch(url, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return offline;
    const data = await response.json();
    if (data?.online !== true || data.status !== 'online') return offline;
    return {
      online: true,
      status: 'online',
      ping: Number.isFinite(data.ping) && data.ping >= 0 ? Math.round(data.ping) : null
    };
  } catch {
    return offline;
  }
}
