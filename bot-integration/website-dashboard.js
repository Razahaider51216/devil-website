const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { timingSafeEqual, createHash } = require('node:crypto');
const { systems, getPath, setPath } = require('./website-settings-schema.cjs');
const { createOwnerTools } = require('./website-owner-tools.cjs');
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ids = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
const ownerIds = () => ids(process.env.OWNER_IDS || process.env.OWNER_ID || process.env.BOT_OWNER_IDS || process.env.BOT_OWNER_ID);
function checkSecret(header, secret) {
  const supplied = Buffer.from(header || ''); const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function validateFields(system, values, guild, member) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail(400, 'ค่าตั้งค่าไม่ถูกต้อง');
  const result = {};
  for (const key of Object.keys(values)) {
    const f = system.fields.find(item => item.key === key);
    if (!f) fail(400, `ไม่อนุญาตให้แก้ไข ${key}`);
    let value = values[key];
    const roleCheck = id => { const role = guild.roles.cache.get(id); if (!role || role.managed || role.id === guild.id || (guild.members.me && role.position >= guild.members.me.roles.highest.position) || role.permissions.has(8n)) fail(400, 'ยศต้องต่ำกว่าบอทและไม่มีสิทธิ์ Administrator'); };
    const channelCheck = id => { const ch = guild.channels.cache.get(id); if (!ch || !f.types.includes(ch.type)) fail(400, `ช่องไม่ถูกต้อง: ${f.label}`); if (!ch.permissionsFor(guild.members.me)?.has(1024n)) fail(400, 'บอทไม่สามารถดูช่องที่เลือก'); if (member && !ch.permissionsFor(member)?.has(1024n)) fail(403, 'คุณไม่มีสิทธิ์ดูช่องที่เลือก'); };
    if (f.type === 'boolean') { if (typeof value !== 'boolean') fail(400, 'ต้องเป็น boolean'); }
    else if (f.type === 'number') { if (typeof value !== 'number' || !Number.isFinite(value) || value < f.min || value > f.max) fail(400, `ตัวเลข ${f.label} ต้องอยู่ระหว่าง ${f.min}–${f.max}`); }
    else if (['channels', 'roles', 'lines'].includes(f.type)) {
      if (!Array.isArray(value) || value.length > 100 || value.some(v => typeof v !== 'string' || v.length > 2000)) fail(400, 'รายการไม่ถูกต้อง');
      if (f.type === 'channels') value.forEach(channelCheck);
      if (f.type === 'roles') { if (value.length > 25) fail(400, 'เลือกยศได้สูงสุด 25'); value.forEach(roleCheck); }
    } else if (f.type === 'responses') {
      if (!Array.isArray(value) || value.length > 50) fail(400, 'คำตอบมากเกินไป');
      value = value.map(v => { if (!v || typeof v.content !== 'string' || !v.content.trim() || v.content.length > 2000 || (v.imageUrl && !/^https:\/\//.test(v.imageUrl))) fail(400, 'คำตอบไม่ถูกต้อง'); return { content: v.content, imageUrl: v.imageUrl || '' }; });
    } else if (f.type === 'rewards') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 100) fail(400, 'รางวัลไม่ถูกต้อง');
      value = Object.fromEntries(Object.entries(value).map(([level, v]) => { if (!/^\d{1,6}$/.test(level) || !v || typeof v !== 'object') fail(400, 'Level / รางวัลไม่ถูกต้อง'); roleCheck(v.roleId); if (!['permanent', 'rental'].includes(v.mode) || !Number.isFinite(v.durationMs || 0) || (v.durationMs || 0) < 0) fail(400, 'โหมดรางวัลไม่ถูกต้อง'); return [level, { roleId: v.roleId, mode: v.mode, durationMs: v.durationMs || 0 }]; }));
    } else if (f.type === 'products') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 100) fail(400, 'สินค้าไม่ถูกต้อง');
      value = Object.fromEntries(Object.entries(value).map(([id, v]) => { if (!/^[a-zA-Z0-9_-]{1,60}$/.test(id) || !v || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 100 || typeof v.price !== 'number' || !Number.isFinite(v.price) || v.price < 0) fail(400, 'ชื่อ / ราคาสินค้าไม่ถูกต้อง'); if (v.roleId) roleCheck(v.roleId); return [id, { id, name: v.name, price: v.price, roleId: v.roleId || null, description: String(v.description || '').slice(0, 2000), imageUrl: /^https:\/\//.test(v.imageUrl || '') ? v.imageUrl : null, durationMonths: Number.isInteger(v.durationMonths) && v.durationMonths > 0 && v.durationMonths <= 120 ? v.durationMonths : null }]; }));
    } else {
      if (typeof value !== 'string' || value.length > (f.max || 2048)) fail(400, `${f.label} ยาวเกินไป`);
      if (f.type === 'channel' && value) channelCheck(value);
      if (f.type === 'role' && value) roleCheck(value);
      if (f.type === 'url' && value) { try { if (new URL(value).protocol !== 'https:') fail(400, 'ลิงก์ต้องใช้ HTTPS'); } catch { fail(400, 'ลิงก์ไม่ถูกต้อง'); } }
      if (f.type === 'color' && value && !/^#[\da-f]{6}$/i.test(value)) fail(400, 'สีไม่ถูกต้อง');
      if (f.type === 'time' && value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(400, 'เวลาไม่ถูกต้อง');
      if (f.type === 'choice' && !f.choices.includes(value)) fail(400, 'ตัวเลือกไม่ถูกต้อง');
    }
    setPath(result, key, value);
  }
  return result;
}
function merge(current, patch) { for (const [key, value] of Object.entries(patch)) { if (value && typeof value === 'object' && !Array.isArray(value) && !['products', 'rewards'].includes(key)) current[key] = merge(current[key] && typeof current[key] === 'object' ? current[key] : {}, value); else current[key] = value; } return current; }
function validateContent(input) {
  const out = {};
  for (const group of ['features', 'updates', 'serverCategories']) {
    const rows = input[group]; if (!Array.isArray(rows) || rows.length > 300) fail(400, 'รายการเนื้อหาไม่ถูกต้อง');
    const seen = new Set();
    out[group] = rows.map(row => {
      if (!row || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id || '') || seen.has(row.id)) fail(400, 'ID เนื้อหาซ้ำหรือไม่ถูกต้อง'); seen.add(row.id);
      if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 256) fail(400, 'กรุณาใส่หัวข้อ');
      const body = String(row.body || ''); if (body.length > 10000) fail(400, 'เนื้อหายาวเกินไป');
      const imageUrl = String(row.imageUrl || ''); if (imageUrl && (!/^https:\/\//.test(imageUrl) || imageUrl.length > 2048)) fail(400, 'รูปภาพต้องใช้ HTTPS');
      const record = { id: row.id, title: row.title, body, imageUrl, published: row.published === true, command: String(row.command || '').slice(0, 100), mode: row.mode === 'VIP' ? 'VIP' : 'Public', date: Number.isFinite(Date.parse(row.date)) ? new Date(row.date).toISOString() : new Date().toISOString() };
      if (group === 'serverCategories') { if (!Array.isArray(row.guildIds) || row.guildIds.some(id => !/^\d{15,22}$/.test(id))) fail(400, 'Guild IDs ไม่ถูกต้อง'); record.guildIds = [...new Set(row.guildIds)]; }
      return record;
    });
  }
  return out;
}
function createDashboardServer({ client, data, saveData, publish, ownerGuildIds, ownerReloadFiles, executeOwner, secret, contentPath = path.join(__dirname, 'website-content.json') }) {
  if (!secret) throw new Error('BOT_DASHBOARD_SECRET is required');
  let content = structuredClone(require('./website-default-content.json'));
  if (fs.existsSync(contentPath)) content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const persist = next => { const tmp = `${contentPath}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(next, null, 2)); fs.renameSync(tmp, contentPath); content = next; };
  const contentRevision = () => hash([content.features, content.updates, content.serverCategories]);
  const premium = id => ids(`${process.env.PREMIUM_GUILD_IDS || ''},${process.env.PREMIUM_SERVER_IDS || ''}`).includes(id);
  const available = (guildId, userId) => systems.filter(s => !s.private && (!s.restricted || ids(s.restricted === 'chat' ? process.env.PUBLIC_CHAT_GUILD_ID || process.env.GUILD_ID : process.env.PUBLIC_MAIN_GUILD_ID || process.env.GUILD_ID_2 || process.env.GUILD_ID).includes(guildId)));
  const config = (s, guildId) => {
    let stored = s.scalar ? { channelId: data[s.store]?.[guildId] || '' } : data[s.store]?.[guildId] || {};
    if (s.id === 'verify' && !data[s.store]?.[guildId]) {
      const panel = Object.values(data.verifyPanels || {}).filter(p => p.guildId === guildId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
      if (panel) stored = { ...panel, roleIds: (panel.roles || []).map(r => r.roleId) };
    }
    const defaults = { spam: { deleteInvites: true, deleteSpam: true, deleteScamImages: true, spamLimit: 5, windowSeconds: 7, cooldownSeconds: 60, timeoutSeconds: 300, 'inviteActions.timeout': true, 'spamActions.timeout': true, 'scamActions.timeout': true }, ticket: { title: 'Ticket', description: 'กดปุ่มด้านล่างเพื่อสร้าง Ticket', buttonLabel: 'Create Ticket', embedColor: '#FF0000', buttonStyle: 'Primary', closeReason: 'inactivity' }, welcome: { welcomeEnabled: Boolean(stored.welcomeChannelId || stored.channelId || data.welcomeChannels?.[guildId]) } };
    const result = {};
    for (const f of s.fields) { let value = getPath(stored, f.key); if (s.id === 'welcome' && f.key === 'welcomeChannelId') value ||= stored.channelId || data.welcomeChannels?.[guildId]; if (s.id === 'shop' && f.key === 'purchaseChannelId') value = data.purchaseChannels?.[guildId]; result[f.key] = value ?? (f.type === 'boolean' ? false : f.type === 'number' ? f.min : ['channels', 'roles', 'lines', 'responses'].includes(f.type) ? [] : ['products', 'rewards'].includes(f.type) ? {} : f.type === 'choice' ? f.choices[0] : ''); }
    for (const [key, value] of Object.entries(defaults[s.id] || {})) if (getPath(stored, key) === undefined) result[key] = value;
    return result;
  };
  const locks = new Set();
  const ownerTools = createOwnerTools({ client, data, saveData, validateFields, isOwner: id => ownerIds().includes(id), ownerGuildIds, ownerReloadFiles, executeOwner,
    audit: record => persist({ ...content, audit: [...content.audit, record].slice(-200) }) });
  async function dispatch(body) {
    if (['owner-read', 'owner-execute'].includes(body.action)) return ownerTools(body);
    if (body.action === 'content') return Object.fromEntries(['features', 'updates', 'serverCategories'].map(k => [k, content[k].filter(v => v.published)]));
    if (body.action === 'guilds') return { guilds: [...client.guilds.cache.values()].map(g => ({ id: g.id, name: g.name, vip: premium(g.id) })) };
    if (['admin-read', 'admin-write'].includes(body.action)) {
      if (!ownerIds().includes(body.userId)) fail(403, 'เฉพาะ Owner เท่านั้น');
      if (body.action === 'admin-write') {
        if (body.content?.revision !== contentRevision()) fail(409, 'เนื้อหาเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดใหม่');
        persist({ ...validateContent(body.content), audit: [...content.audit, { userId: body.userId, action: 'content-update', at: new Date().toISOString() }].slice(-200) });
      }
      return { ...content, revision: contentRevision() };
    }
    if (!['settings-read', 'settings-write'].includes(body.action)) fail(404, 'Unknown action');
    const guild = client.guilds.cache.get(body.guildId); if (!guild) fail(403, 'บอทต้องอยู่ในเซิร์ฟเวอร์');
    const member = await guild.members.fetch({ user: body.userId, force: true }).catch(() => null);
    if (!member || !(member.id === guild.ownerId || member.permissions.has(8n) || member.permissions.has(32n))) fail(403, 'ต้องมีสิทธิ์จัดการเซิร์ฟเวอร์');
    await Promise.all([guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe()]);
    const allowed = available(guild.id, body.userId).filter(s => ['welcome', 'ticket'].includes(s.id) || member.permissions.has(8n));
    if (body.action === 'settings-read') return { guild: { id: guild.id, name: guild.name }, vip: premium(guild.id), systems: allowed.map(s => ({ ...s, locked: Boolean(s.vip && !premium(guild.id)), values: s.vip && !premium(guild.id) ? {} : config(s, guild.id), revision: hash(config(s, guild.id)) })), channels: [...guild.channels.cache.values()].filter(c => c.permissionsFor(member)?.has(1024n) && c.permissionsFor(guild.members.me)?.has(1024n)).map(c => ({ id: c.id, name: c.name, type: c.type })), roles: [...guild.roles.cache.values()].filter(r => !r.managed && r.id !== guild.id && r.position < guild.members.me.roles.highest.position && !r.permissions.has(8n)).map(r => ({ id: r.id, name: r.name })) };
    if (locks.has(guild.id)) fail(409, 'กำลังบันทึก กรุณาลองใหม่');
    locks.add(guild.id);
    try {
      const change = body.change || {}; const s = allowed.find(s => s.id === change.system);
      if (!s) fail(403, 'ไม่อนุญาตให้ตั้งค่าระบบนี้');
      if (s.vip && !premium(guild.id)) fail(403, 'เซิร์ฟเวอร์นี้ไม่มีสิทธิ์ VIP');
      if (change.revision !== hash(config(s, guild.id))) fail(409, 'ค่าถูกแก้ไขจาก Discord หรืออีกหน้าต่าง กรุณาโหลดใหม่');
      const patch = validateFields(s, change.values, guild, member);
      const current = s.scalar ? {} : structuredClone(data[s.store]?.[guild.id] || {});
      if (s.id === 'verify' && !data[s.store]?.[guild.id]) for (const [key, value] of Object.entries(config(s, guild.id))) setPath(current, key, value);
      const next = merge(current, patch); next.guildId = guild.id;
      if (s.id === 'welcome') next.channelId = next.welcomeChannelId;
      if (s.scalar) (data[s.store] ||= {})[guild.id] = next.channelId || '';
      else (data[s.store] ||= {})[guild.id] = next;
      if (s.id === 'welcome') (data.welcomeChannels ||= {})[guild.id] = next.welcomeChannelId || '';
      if (s.id === 'shop') (data.purchaseChannels ||= {})[guild.id] = next.purchaseChannelId || '';
      saveData();
      let publishError = null;
      if (change.publish) {
        if (!s.publish) fail(400, 'ระบบนี้ไม่มีแผงเผยแพร่');
        try { await publish(s.id, guild, member, next); } catch (e) { publishError = e.message; }
      }
      persist({ ...content, audit: [...content.audit, { userId: body.userId, guildId: guild.id, system: s.id, action: change.publish ? 'settings-publish' : 'settings-save', at: new Date().toISOString(), publishError }].slice(-200) });
      return { ok: true, saved: true, publishError, revision: hash(config(s, guild.id)), values: config(s, guild.id) };
    } finally { locks.delete(guild.id); }
  }
  return http.createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    if (req.url !== '/dashboard') return send(404, { error: 'Not found' });
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
    if (!checkSecret(req.headers.authorization, secret)) return send(401, { error: 'Unauthorized' });
    try { let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 200000) fail(413, 'ข้อมูลใหญ่เกินไป'); } return send(200, await dispatch(JSON.parse(raw))); }
    catch (e) { return send(e instanceof SyntaxError ? 400 : e.status || 500, { error: e.status || e instanceof SyntaxError ? e.message : 'ไม่สามารถดำเนินการได้ กรุณาตรวจสอบ log ของบอท' }); }
  });
}
function startDashboardServer(options) {
  if (!process.env.BOT_DASHBOARD_SECRET) return null;
  if (process.env.BOT_DASHBOARD_SECRET.length < 32) throw new Error('BOT_DASHBOARD_SECRET must contain at least 32 characters');
  const port = Number(process.env.BOT_DASHBOARD_PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid BOT_DASHBOARD_PORT');
  const server = createDashboardServer({ ...options, secret: process.env.BOT_DASHBOARD_SECRET });
  server.on('error', e => console.error('Dashboard API error:', e.message));
  server.listen(port, '127.0.0.1', () => console.log(`Dashboard API listening on 127.0.0.1:${port}`));
  return server;
}
module.exports = { createDashboardServer, startDashboardServer, validateFields, validateContent };
