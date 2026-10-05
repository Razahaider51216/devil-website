/* Public feature snapshots contain display data only, never payment details or
 * member records. Sources must be configured channels managed by the Owner. */
const { captureMessage } = require('./website-feature-message.cjs');
const types = [
  { id: 'welcome', label: 'Welcome / Goodbye' }, { id: 'ticket', label: 'Ticket' },
  { id: 'verify', label: 'Verify' }, { id: 'shop', label: 'Shop · VIP' }
];
const text = (value, max = 2000) => String(value || '').slice(0, max);
const image = value => { try { const url = new URL(value); return url.protocol === 'https:' && url.href.length <= 2048 ? url.href : ''; } catch { return ''; } };
const color = (value, fallback = '#167aca') => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
function createFeaturePreviews({ client, data, isOwner, premium, images }) {
  async function guildFor(userId, guildId) {
    if (!isOwner(userId)) fail(403, 'เฉพาะ Owner เท่านั้น');
    const guild = client.guilds.cache.get(guildId);
    if (!guild) fail(403, 'บอทต้องอยู่ในเซิร์ฟเวอร์ที่เลือก');
    const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
    if (!member || !(member.id === guild.ownerId || member.permissions.has(8n) || member.permissions.has(32n))) fail(403, 'ต้องมีสิทธิ์จัดการเซิร์ฟเวอร์ต้นทาง');
    await Promise.all([guild.channels.fetch(), guild.roles.fetch(), guild.members.fetchMe()]);
    return { guild, member };
  }
  function sources(guild, system) {
    const id = guild.id;
    if (system === 'welcome') {
      const config = data.welcomeSettings?.[id] || {};
      return [
        { channelId: config.welcomeChannelId || config.channelId || data.welcomeChannels?.[id], event: 'join', config },
        { channelId: config.goodbyeChannelId, event: 'leave', config }
      ];
    }
    if (system === 'ticket') return [data.ticketSetupConfigs?.[id], ...Object.values(data.settings || {}).filter(row => row?.guildId === id)].filter(Boolean).map(config => ({ channelId: config.channelId, config }));
    if (system === 'verify') return [...Object.values(data.verifyPanels || {}).filter(row => row?.guildId === id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), data.webVerifyConfigs?.[id]].filter(Boolean).map(config => ({ channelId: config.channelId, config }));
    if (system === 'shop') {
      if (!premium(id)) return [];
      const config = data.shops?.[id];
      return config ? [...Object.values(config.panels || {}), { channelId: config.publishChannelId }].map(row => ({ channelId: row.channelId, config })) : [];
    }
    fail(400, 'เลือกระบบ Welcome, Ticket, Verify หรือ Shop');
  }
  function visibleSources(guild, member, system) {
    const seen = new Set();
    return sources(guild, system).filter(source => {
      const channel = guild.channels.cache.get(source.channelId);
      if (!channel || ![0, 5].includes(channel.type) || seen.has(channel.id) || !channel.permissionsFor(member)?.has(1024n) || !channel.permissionsFor(guild.members.me)?.has(1024n)) return false;
      seen.add(channel.id); return true;
    });
  }
  function snapshot(guild, source, system) {
    const c = source.config, channel = guild.channels.cache.get(source.channelId);
    const common = { system, channelName: text(channel.name, 100), guildName: text(guild.name, 100), color: color(c.embedColor || c.accentColor, system === 'ticket' ? '#ff0000' : system === 'verify' ? '#000000' : '#167aca'), imageUrl: image(c.imageUrl), capturedAt: new Date().toISOString() };
    if (system === 'welcome') return { ...common, title: source.event === 'leave' ? 'แล้วพบกันใหม่' : `ยินดีต้อนรับสู่ ${text(guild.name, 100)}`, description: source.event === 'leave' ? 'ขอบคุณที่เป็นส่วนหนึ่งของชุมชน' : 'ยินดีต้อนรับสมาชิกตัวอย่างเข้าสู่ชุมชน', welcomeEvent: source.event, enabled: true, websiteUrl: image(c.websiteUrl) };
    if (system === 'ticket') return { ...common, title: text(c.title || 'Ticket', 256), description: text(c.description || 'กดปุ่มด้านล่างเพื่อสร้าง Ticket'), label: text(c.buttonLabel || 'Create Ticket', 80), buttonEmoji: text(c.buttonEmoji, 100), buttonStyle: ['Primary', 'Secondary', 'Success', 'Danger'].includes(c.buttonStyle) ? c.buttonStyle.toLowerCase() : 'primary', autoReplies: (Array.isArray(c.autoReplies) ? c.autoReplies : String(c.autoReplies || '').split('\n')).map(v => text(v)).filter(Boolean).slice(0, 10) };
    const role = id => text(guild.roles.cache.get(id)?.name || 'ยศตัวอย่าง', 100);
    if (system === 'verify') return { ...common, title: text(c.title || 'Verify', 256), description: text(c.description || 'กดปุ่มด้านล่างเพื่อยืนยันรับยศ'), label: text(c.buttonLabel || 'รับยศ', 80), buttonEmoji: text(c.buttonEmoji, 100), verifyMode: c.mode === 'emoji' ? 'emoji' : 'button', roles: (c.roles || (c.roleIds || []).map(roleId => ({ roleId }))).slice(0, 25).map((r, i) => ({ name: role(r.roleId), emoji: text(r.emoji || `${i + 1}️⃣`, 100) })), successMessage: text(c.successMessage).replace(/<@&\d+>/g, '@ยศตัวอย่าง') };
    // Intentionally omit c.payment, orders, customer data and transaction refs.
    return { ...common, title: text(c.storefrontTitle || 'Devil Shop', 256), description: text(c.storefrontDescription || 'เลือกสินค้าที่ต้องการสั่งซื้อจากเมนูด้านล่าง'), imageUrl: image(c.bannerUrl), products: Object.values(c.products || {}).slice(0, 25).map((p, i) => ({ id: `product_${i}`, name: text(p.name, 100), description: text(p.description), price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0, role: p.roleId ? role(p.roleId) : 'สินค้าโดยผู้ดูแล', duration: p.durationMonths ? `${Number(p.durationMonths)} เดือน` : 'ถาวร' })) };
  }
  async function read({ userId, guildId, system, channelId }) {
    if (!isOwner(userId)) fail(403, 'เฉพาะ Owner เท่านั้น');
    if (!guildId) {
      const guilds = [];
      for (const guild of client.guilds.cache.values()) {
        if (guild.ownerId === userId) { guilds.push({ id: guild.id, name: guild.name }); continue; }
        const member = guild.members.cache?.get(userId) || await guild.members.fetch({ user: userId }).catch(() => null);
        if (member && (member.id === guild.ownerId || member.permissions.has(8n) || member.permissions.has(32n))) guilds.push({ id: guild.id, name: guild.name });
      }
      return { guilds };
    }
    const { guild, member } = await guildFor(userId, guildId);
    if (!system) return { systems: types.map(type => ({ ...type, channels: visibleSources(guild, member, type.id).map(s => ({ id: s.channelId, name: guild.channels.cache.get(s.channelId).name })) })) };
    const source = visibleSources(guild, member, system).find(s => s.channelId === channelId);
    if (!source) fail(400, 'ช่องนี้ยังไม่ได้ตั้งค่าระบบที่เลือก หรือคุณไม่มีสิทธิ์ดูช่อง');
    const preview = snapshot(guild, source, system);
    const message = await captureMessage({ client, guild, member, source, system, data, preview, images });
    if (message) preview.message = message;
    if (images && preview.imageUrl) {
      const imageId = await images.capture(preview.imageUrl, { guild, member, source, system, data });
      if (imageId) preview.imageId = imageId;
    }
    return { preview };
  }
  return { read };
}
module.exports = { createFeaturePreviews };
