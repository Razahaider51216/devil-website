// Copy display fields from the bot's published message, never interaction IDs.
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href.slice(0, 2048) : ''; } catch { return ''; } };
async function captureMessage({ client, guild, member, source, system, data, preview, images }) {
  const channel = guild.channels.cache.get(source.channelId);
  if (!channel?.messages?.fetch) return null;
  const entries = system === 'verify' ? data.verifyPanels : system === 'ticket' ? data.settings : system === 'shop' ? data.shops?.[guild.id]?.panels : {};
  const ids = Object.entries(entries || {}).filter(([, row]) => row.channelId === channel.id && (!row.guildId || row.guildId === guild.id)).map(([id]) => id).reverse();
  let message;
  for (const id of ids.slice(0, 5)) {
    const candidate = await channel.messages.fetch(id).catch(() => null);
    if (candidate?.author?.id === client.user?.id) { message = candidate; break; }
  }
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    if (recent?.values) message = [...recent.values()].find(row => row.author?.id === client.user?.id && (row.embeds?.length || row.components?.length));
  }
  if (!message) return null;
  const raw = message.toJSON ? message.toJSON() : message;
  const clean = (value, max = 4000) => String(value || '').slice(0, max).replace(/<@&(\d+)>/g, (_, id) => `@${guild.roles.cache.get(id)?.name || 'ยศตัวอย่าง'}`).replace(/<@!?\d+>/g, '@สมาชิกตัวอย่าง').replace(/<#\d+>/g, '#ช่องตัวอย่าง');
  const emoji = value => value?.id && /^\d{17,20}$/.test(value.id) ? `<${value.animated ? 'a' : ''}:${String(value.name || 'emoji').replace(/\W/g, '')}:${value.id}>` : clean(value?.name, 100);
  const media = async value => {
    const url = safeUrl(value?.url || value?.proxy_url || value);
    if (!url) return null;
    const result = { url };
    if (images) { const id = await images.capture(url, { guild, member, source, system, data }); if (id) result.imageId = id; }
    return result;
  };
  const products = Object.keys(data.shops?.[guild.id]?.products || {});
  let count = 0;
  async function component(c, depth = 0) {
    if (!c || depth > 8 || ++count > 40) return null;
    const type = Number(c.type), out = { type };
    if ([1, 9, 17].includes(type)) {
      out.components = (await Promise.all((c.components || []).slice(0, 40).map(row => component(row, depth + 1)))).filter(Boolean);
      if (type === 17 && Number.isInteger(c.accent_color)) out.color = `#${c.accent_color.toString(16).padStart(6, '0').slice(-6)}`;
      if (type === 9) out.accessory = await component(c.accessory, depth + 1);
    } else if (type === 10) out.content = clean(c.content);
    else if (type === 11) out.media = await media(c.media);
    else if (type === 12) out.items = (await Promise.all((c.items || []).slice(0, 10).map(async row => ({ media: await media(row.media), description: clean(row.description, 200) })))).filter(row => row.media);
    else if (type === 14) { out.divider = c.divider !== false; out.spacing = c.spacing === 2 ? 2 : 1; }
    else if (type === 2) {
      out.label = clean(c.label, 80); out.emoji = emoji(c.emoji); out.style = [1, 2, 3, 4, 5].includes(c.style) ? c.style : 2; out.disabled = !!c.disabled;
      out.action = system === 'ticket' ? 'ticket-open' : system === 'verify' ? 'verify-role' : 'sample-button';
      if (system === 'verify') { const roleId = String(c.custom_id || '').split(':').at(-1); out.role = guild.roles.cache.get(roleId)?.name || preview.roles?.[0]?.name || 'สมาชิก'; }
      if (c.style === 5) out.url = safeUrl(c.url);
    } else if ([3, 5, 6, 7, 8].includes(type)) {
      out.placeholder = clean(c.placeholder || 'เลือกตัวอย่าง', 150); out.disabled = !!c.disabled;
      out.options = (c.options || []).slice(0, 25).map((row, i) => ({ label: clean(row.label, 100), description: clean(row.description, 100), emoji: emoji(row.emoji), value: system === 'shop' && products.includes(row.value) ? `product_${products.indexOf(row.value)}` : `option_${i}` }));
      if (!out.options.length) out.options = [{ label: type === 6 ? 'ยศตัวอย่าง' : type === 8 ? 'ช่องตัวอย่าง' : 'สมาชิกตัวอย่าง', description: 'ตัวอย่างจำลอง', value: 'option_0' }];
      out.action = system === 'shop' ? 'shop-product' : 'sample-select';
    } else return null;
    return out;
  }
  const embeds = await Promise.all((raw.embeds || []).slice(0, 10).map(async e => ({
    title: clean(e.title, 256), description: clean(e.description), url: safeUrl(e.url),
    color: Number.isInteger(e.color) ? `#${e.color.toString(16).padStart(6, '0').slice(-6)}` : preview.color,
    author: e.author ? { name: clean(e.author.name, 256), url: safeUrl(e.author.url), icon: await media(e.author.icon_url) } : null,
    footer: e.footer ? { text: clean(e.footer.text, 2048), icon: await media(e.footer.icon_url) } : null,
    fields: (e.fields || []).slice(0, 25).map(f => ({ name: clean(f.name, 256), value: clean(f.value, 1024), inline: !!f.inline })),
    image: await media(e.image), thumbnail: await media(e.thumbnail), timestamp: e.timestamp || ''
  })));
  const components = (await Promise.all((raw.components || []).slice(0, 40).map(c => component(c)))).filter(Boolean);
  const attachments = (await Promise.all((Array.isArray(raw.attachments) ? raw.attachments : Object.values(raw.attachments || {})).slice(0, 10).filter(a => /^image\//.test(a.content_type || a.contentType || '') || /\.(png|jpe?g|webp|gif)$/i.test(a.filename || a.name || '')).map(a => media(a)))).filter(Boolean);
  return { content: clean(raw.content), embeds, components, attachments };
}
function hasImage(value, id) {
  if (!value || typeof value !== 'object') return false;
  return value.imageId === id || Object.values(value).some(v => typeof v === 'object' && hasImage(v, id));
}
module.exports = { captureMessage, hasImage };
