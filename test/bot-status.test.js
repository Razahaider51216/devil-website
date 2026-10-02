import test from 'node:test';
import assert from 'node:assert/strict';
import { getBotStatus } from '../lib/bot-status.js';

test('bot status proxy only reports online from an authenticated HTTPS health response', async () => {
  const previousUrl = process.env.BOT_STATUS_API_URL;
  const previousSecret = process.env.BOT_STATUS_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.BOT_STATUS_API_URL = 'https://status.example.com/health';
  process.env.BOT_STATUS_SECRET = 'test-secret';

  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.href, 'https://status.example.com/health');
      assert.equal(options.headers.Authorization, 'Bearer test-secret');
      return { ok: true, json: async () => ({ online: true, status: 'online', ping: 40.4 }) };
    };
    assert.deepEqual(await getBotStatus(), { online: true, status: 'online', ping: 40 });

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ online: false, status: 'offline', ping: null }) });
    assert.deepEqual(await getBotStatus(), { online: false, status: 'offline', ping: null });

    globalThis.fetch = async () => { throw new Error('VPS unavailable'); };
    assert.deepEqual(await getBotStatus(), { online: false, status: 'offline', ping: null });

    process.env.BOT_STATUS_API_URL = 'http://82.26.104.147:8787/health';
    assert.deepEqual(await getBotStatus(), { online: false, status: 'offline', ping: null });

    delete process.env.BOT_STATUS_API_URL;
    delete process.env.BOT_STATUS_SECRET;
    globalThis.fetch = async (url, options) => {
      assert.equal(url.href, 'https://82-26-104-147.sslip.io/health');
      assert.deepEqual(options.headers, {});
      return { ok: true, json: async () => ({ online: true, status: 'online', ping: 51 }) };
    };
    assert.deepEqual(await getBotStatus(), { online: true, status: 'online', ping: 51 });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.BOT_STATUS_API_URL;
    else process.env.BOT_STATUS_API_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.BOT_STATUS_SECRET;
    else process.env.BOT_STATUS_SECRET = previousSecret;
  }
});
