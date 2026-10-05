const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const discordHosts = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const mimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const limit = 3 * 1024 * 1024; // Base64 bridge response stays below hosted API payload limits.
function createPreviewImages(directory) {
  const cached = new Map();
  async function download(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !discordHosts.has(parsed.hostname)) return null;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      const mime = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || !mimeTypes.has(mime) || Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); return null; }
      const chunks = []; let length = 0;
      for await (const chunk of response.body) { length += chunk.length; if (length > limit) return null; chunks.push(chunk); }
      if (!length) return null;
      return { bytes: Buffer.concat(chunks), mime };
    } catch { return null; }
  }
  async function capture(url, { guild, member, source, system, data }) {
    let original; try { original = new URL(url); } catch { return null; }
    if (original.protocol !== 'https:' || !discordHosts.has(original.hostname)) return null;
    const key = original.pathname;
    if (cached.has(key)) return cached.get(key);
    let result = await download(url);
    if (!result) {
      const attachment = original.pathname.match(/^\/attachments\/(\d+)\/(\d+)\//);
      const candidates = [];
      function collect(value, depth = 0) {
        if (!value || depth > 15) return;
        if (typeof value === 'string') {
          try { const candidate = new URL(value); if (discordHosts.has(candidate.hostname) && candidate.pathname === key && !candidates.includes(value)) candidates.push(value); } catch {}
        } else if (Array.isArray(value)) value.forEach(item => collect(item, depth + 1));
        else if (typeof value === 'object') Object.values(value).forEach(item => collect(item, depth + 1));
      }
      const sourceChannel = guild.channels.cache.get(source.channelId);
      const province = data.provinceRolePanels?.[guild.id];
      const records = system === 'verify' ? data.verifyPanels : system === 'ticket' ? data.settings : system === 'shop' ? data.shops?.[guild.id]?.panels : system === 'province' && province?.messageId ? { [province.messageId]: province } : {};
      const ids = Object.entries(records || {}).filter(([, row]) => row?.channelId === source.channelId).map(([id]) => id).slice(-3);
      for (const id of ids) {
        try { const message = await sourceChannel?.messages?.fetch(id); if (message) collect(message.toJSON ? message.toJSON() : message); } catch {}
      }
      // The attachment snowflake is close to its upload message's timestamp.
      // Only inspect attachments in a channel both the Owner and bot can view.
      if (attachment) {
        const channel = guild.channels.cache.get(attachment[1]);
        if (channel?.permissionsFor(member)?.has(1024n) && channel.permissionsFor(guild.members.me)?.has(1024n)) {
          try { const messages = await channel.messages?.fetch({ around: attachment[2], limit: 5 }); if (messages) for (const message of messages.values()) collect(message.toJSON ? message.toJSON() : message); } catch {}
        }
      }
      for (const candidate of candidates) { if (candidate !== url) result = await download(candidate); if (result) break; }
    }
    if (!result) return null;
    const id = createHash('sha256').update(result.bytes).digest('hex');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `${id}.json`), JSON.stringify({ mime: result.mime, base64: result.bytes.toString('base64') }));
    cached.set(key, id); return id;
  }
  function read(id) {
    if (!/^[a-f0-9]{64}$/.test(id || '')) return null;
    try { const image = JSON.parse(fs.readFileSync(path.join(directory, `${id}.json`), 'utf8')); return mimeTypes.has(image.mime) ? image : null; } catch { return null; }
  }
  return { capture, read };
}
module.exports = { createPreviewImages };
