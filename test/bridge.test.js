import test from 'node:test';
import assert from 'node:assert/strict';
import { bridge } from '../lib/bridge.js';

test('reports upstream routing, secret and invalid-response errors without treating them as client JSON errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.BOT_DASHBOARD_API_URL;
  const originalSecret = process.env.BOT_DASHBOARD_SECRET;
  process.env.BOT_DASHBOARD_API_URL = 'https://bot.example/dashboard';
  process.env.BOT_DASHBOARD_SECRET = 'test-dashboard-secret';
  try {
    globalThis.fetch = async () => new Response('Not found', { status: 404 });
    await assert.rejects(bridge('content'), e => !(e instanceof SyntaxError) && e.status === 502 && /404.*Caddy/.test(e.message));
    globalThis.fetch = async () => new Response('{"error":"Unauthorized"}', { status: 401 });
    await assert.rejects(bridge('content'), e => e.status === 502 && /BOT_DASHBOARD_SECRET/.test(e.message));
    globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
    await assert.rejects(bridge('content'), e => e.status === 502 && /HTTP 502/.test(e.message) && !e.message.includes('<html>'));
    globalThis.fetch = async () => new Response('[]', { status: 200 });
    await assert.rejects(bridge('content'), e => e.status === 502);
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(bridge('content'), e => e.status === 503);
    globalThis.fetch = async () => Response.json({ features: [], updates: [], serverCategories: [] });
    assert.deepEqual(await bridge('content'), { features: [], updates: [], serverCategories: [] });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.BOT_DASHBOARD_API_URL; else process.env.BOT_DASHBOARD_API_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.BOT_DASHBOARD_SECRET; else process.env.BOT_DASHBOARD_SECRET = originalSecret;
  }
});
