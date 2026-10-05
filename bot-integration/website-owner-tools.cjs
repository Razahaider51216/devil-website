const { createHash } = require('node:crypto');
const { systems } = require('./website-settings-schema.cjs');
const announce = systems.find(system => system.id === 'announce');
const commands = [
  { id: 'announe-panel', label: 'ประกาศใน Discord', description: 'ส่งประกาศใหม่หรือแก้ไขประกาศล่าสุดของบอท', icon: 'bell', fields: [...announce.fields.map(f => f.key === 'mentionType' ? { ...f, choices: ['none', 'everyone', 'role'] } : f.key === 'changelog' ? { ...f, max: 1000 } : f.key === 'version' ? { ...f, max: 120 } : f), { key: 'sendMode', label: 'การเผยแพร่', type: 'choice', choices: ['new', 'edit'] }] },
  { id: 'setstaus', label: 'สถานะบอท', description: 'แสดงจำนวนเซิร์ฟเวอร์และสมาชิก หรือข้อความที่กำหนดเอง', icon: 'activity', fields: [{ key: 'mode', label: 'รูปแบบสถานะ', type: 'choice', choices: ['stats', 'custom'] }, { key: 'custom', label: 'ข้อความสถานะ', type: 'text', max: 128 }] },
  { id: 'reload', label: 'Reload บอท', description: 'โหลดระบบและ .env ใหม่ตามคำสั่งเดิมของบอท', icon: 'update', fields: [{ key: 'file', label: 'ระบบที่ต้องการ Reload', type: 'choice', choices: [] }] }
];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function createOwnerTools({ client, data, saveData, validateFields, isOwner, ownerGuildIds = () => [], ownerReloadFiles = () => [], executeOwner, audit }) {
  const requests = new Map();
  let busy = false;
  const allowedGuilds = () => [...new Set(ownerGuildIds())].map(id => client.guilds.cache.get(id)).filter(Boolean);
  const metadata = () => commands.map(command => command.id === 'reload' ? { ...command, fields: [{ ...command.fields[0], choices: ['', '.env', ...ownerReloadFiles()] }] } : command);
  return async body => {
    if (!isOwner(body.userId)) fail(403, 'เฉพาะ Owner เท่านั้น');
    if (!executeOwner) fail(503, 'กรุณาอัปเดตและรีสตาร์ต Bot Dashboard API');
    const guilds = allowedGuilds();
    const base = { commands: metadata(), guilds: guilds.map(g => ({ id: g.id, name: g.name })) };
    if (body.action === 'owner-read' && !body.guildId) return base;
    const guild = guilds.find(g => g.id === body.guildId);
    if (!guild) fail(403, 'คำสั่งนี้ใช้ได้เฉพาะเซิร์ฟเวอร์หลักที่บอทอยู่');
    const member = await guild.members.fetch({ user: body.userId, force: true }).catch(() => null);
    if (!member || !member.permissions.has(8n)) fail(403, 'บัญชี Owner ต้องอยู่ในเซิร์ฟเวอร์และมีสิทธิ์ Administrator');
    await Promise.all([guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe()]);
    if (body.action === 'owner-read') {
      const stored = data.announceConfigs?.[guild.id] || {};
      return { ...base, guild: { id: guild.id, name: guild.name }, values: {
        'announe-panel': Object.fromEntries(commands[0].fields.map(f => [f.key, stored[f.key] ?? (f.key === 'sendMode' ? 'new' : f.key === 'mentionType' ? 'none' : '')])),
        setstaus: { mode: data.botProfile?.activityMode === 'stats' ? 'stats' : 'custom', custom: data.botProfile?.activityText || '' }, reload: { file: '' }
      }, channels: [...guild.channels.cache.values()].filter(c => [0, 5].includes(c.type) && c.permissionsFor(member)?.has(1024n) && c.permissionsFor(guild.members.me)?.has(1024n)).map(c => ({ id: c.id, name: c.name, type: c.type })),
      roles: [...guild.roles.cache.values()].filter(r => !r.managed && r.id !== guild.id && r.position < guild.members.me.roles.highest.position && !r.permissions.has(8n)).map(r => ({ id: r.id, name: r.name })),
      revision: createHash('sha256').update(JSON.stringify([stored, data.botProfile || {}])).digest('hex') };
    }
    const change = body.change || {};
    const command = metadata().find(c => c.id === change.command);
    if (!command) fail(400, 'ไม่อนุญาตให้ใช้คำสั่งนี้');
    if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(change.requestId || '')) fail(400, 'Request ID ไม่ถูกต้อง');
    const key = `${body.userId}:${change.requestId}`;
    const fingerprint = createHash('sha256').update(JSON.stringify([body.guildId, change.command, change.values, change.revision])).digest('hex');
    const previous = requests.get(key);
    if (previous) { if (previous.fingerprint !== fingerprint) fail(409, 'Request ID นี้ใช้กับคำขออื่นแล้ว'); if (previous.error) fail(previous.error.status, previous.error.message); if (!previous.result) fail(409, 'คำสั่งเดิมยังทำงานอยู่ กรุณารอสักครู่'); return previous.result; }
    if (busy) fail(409, 'กำลังดำเนินคำสั่ง Owner กรุณารอสักครู่');
    const revision = createHash('sha256').update(JSON.stringify([data.announceConfigs?.[guild.id] || {}, data.botProfile || {}])).digest('hex');
    if (change.revision !== revision) fail(409, 'ค่าถูกแก้ไขจาก Discord หรืออีกหน้าต่าง กรุณาโหลดใหม่');
    const values = validateFields(command, change.values, guild, member);
    if (command.id === 'announe-panel') {
      if (!values.channelId || !values.title?.trim() || !values.changelog?.trim()) fail(400, 'กรุณาเลือกช่องและใส่หัวข้อกับรายละเอียดประกาศ');
      if (Boolean(values.buttonLabel) !== Boolean(values.buttonUrl)) fail(400, 'กรุณาใส่ทั้งข้อความและลิงก์ปุ่ม หรือเว้นว่างทั้งคู่');
      if (values.mentionType === 'role' && !values.roleId) fail(400, 'กรุณาเลือกยศที่ต้องการแจ้งเตือน');
      const channel = guild.channels.cache.get(values.channelId);
      if (!channel.permissionsFor(guild.members.me)?.has(2048n)) fail(403, 'บอทไม่มีสิทธิ์ส่งข้อความในช่องประกาศ');
      if (['everyone', 'here'].includes(values.mentionType) && !channel.permissionsFor(guild.members.me)?.has(131072n)) fail(403, 'บอทไม่มีสิทธิ์ Mention Everyone ในช่องนี้');
      if (!['new', 'edit'].includes(values.sendMode)) fail(400, 'กรุณาเลือกส่งประกาศใหม่หรือแก้ไขประกาศเดิม');
      const stored = data.announceConfigs?.[guild.id] || {};
      if (values.sendMode === 'edit' && (stored.lastChannelId !== values.channelId || !stored.lastMessageId)) fail(400, 'ยังไม่มีประกาศล่าสุดของบอทในช่องที่เลือก');
    }
    if (command.id === 'setstaus' && !['stats', 'custom'].includes(values.mode)) fail(400, 'กรุณาเลือกรูปแบบสถานะ');
    if (command.id === 'setstaus' && (values.mode === 'custom' && !values.custom?.trim())) fail(400, 'กรุณาใส่ข้อความสถานะ');
    busy = true;
    requests.set(key, { fingerprint });
    try {
      const result = await executeOwner(command.id, guild, member, values);
      const response = { ok: true, message: result?.message || 'ดำเนินคำสั่งเรียบร้อยแล้ว' };
      requests.set(key, { fingerprint, result: response });
      await audit({ userId: body.userId, guildId: guild.id, action: 'owner-command', command: command.id, at: new Date().toISOString() });
      // Keep completed request IDs for this bot session to prevent accidental re-sends.
      if (requests.size > 1000) requests.delete(requests.keys().next().value);
      return response;
    } catch (error) { if (!requests.get(key)?.result) requests.set(key, { fingerprint, error: { status: error.status || 500, message: error.status ? error.message : 'ไม่สามารถดำเนินคำสั่งได้ กรุณาโหลดการตั้งค่าใหม่ก่อนลองอีกครั้ง' } }); throw error; }
    finally { busy = false; }
  };
}
module.exports = { createOwnerTools, commands };
