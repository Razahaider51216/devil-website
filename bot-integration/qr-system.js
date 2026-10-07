const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  PermissionsBitField, TextInputBuilder, TextInputStyle
} = require('discord.js');

const { DEFAULTS, validateQrConfig, imageUrl, buttonEmoji } = require('./qr-config.cjs');

function buildQrPayload(config, expiresAt) {
  const embed = new EmbedBuilder().setColor(config.color);
  if (config.title) embed.setTitle(config.title);
  if (config.description) embed.setDescription(config.description);
  if (config.footer) embed.setFooter({ text: config.footer });
  if (config.imageUrl) embed.setImage(config.imageUrl);
  if (expiresAt) embed.addFields({ name: '⏳ หมดเวลาชำระเงิน', value: `<t:${Math.floor(expiresAt / 1000)}:R> • ลบการ์ดอัตโนมัติเมื่อหมดเวลา` });
  const components = [];
  if (config.imageUrl && config.buttonLabel) {
    const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(config.buttonLabel).setURL(config.imageUrl);
    const emoji = buttonEmoji(config.buttonEmoji);
    if (emoji) button.setEmoji(emoji);
    components.push(new ActionRowBuilder().addComponents(button));
  }
  return { content: config.content, embeds: [embed], components, allowedMentions: { parse: [] } };
}

function createQrSystem({ client, data, saveData, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  data.qrConfigs ||= {};
  data.qrPendingDeletes ||= {};
  const timers = new Map();
  const getConfig = guildId => ({ ...DEFAULTS, ...data.qrConfigs[guildId] });

  function scheduleDelete(messageId, delay) {
    if (timers.has(messageId)) clearTimer(timers.get(messageId));
    const record = data.qrPendingDeletes[messageId];
    if (!record) return;
    const timer = setTimer(async () => {
      timers.delete(messageId);
      try {
        const channel = await client.channels.fetch(record.channelId);
        const message = await channel.messages.fetch(messageId);
        await message.delete();
        delete data.qrPendingDeletes[messageId];
        saveData();
      } catch (error) {
        if ([10008, 10003].includes(error.code)) {
          delete data.qrPendingDeletes[messageId];
          saveData();
        } else {
          console.warn('Failed to delete expired QR card:', error.message);
          scheduleDelete(messageId, 60000);
        }
      }
    }, delay ?? Math.max(0, record.expiresAt - now()));
    timer.unref?.();
    timers.set(messageId, timer);
  }

  function startScheduler() {
    for (const messageId of Object.keys(data.qrPendingDeletes)) scheduleDelete(messageId);
  }

  function stop() {
    for (const timer of timers.values()) clearTimer(timer);
    timers.clear();
  }

  async function sendQr(channel, guildId) {
    const config = validateQrConfig(getConfig(guildId));
    if (!config.imageUrl) throw new Error('กรุณาตั้งค่าลิงก์รูป QR ก่อนส่ง');
    const expiresAt = config.autoDeleteMinutes ? now() + config.autoDeleteMinutes * 60000 : null;
    const message = await channel.send(buildQrPayload(config, expiresAt));
    if (expiresAt) {
      data.qrPendingDeletes[message.id] = { guildId, channelId: channel.id, expiresAt };
      saveData();
      scheduleDelete(message.id);
    }
    return message;
  }

  function panel(guildId, notice = '') {
    const config = getConfig(guildId);
    return {
      embeds: [new EmbedBuilder().setColor(config.color).setTitle('⚙️ ตั้งค่า QR Panel').setDescription([
        notice, 'ตั้งค่าแล้วใช้ `?qr` เพื่อส่งการ์ดในห้องที่ต้องการ',
        'ข้อความรองรับอิโมจิ, **ตัวหนา**, ลิงก์ และบรรทัดใหม่',
        'ใช้ `## หัวข้อ` ในช่องข้อความเหนือ Embed เพื่อแสดงหัวข้อขนาดใหญ่',
        config.imageUrl ? '✅ ตั้งค่ารูป QR แล้ว' : '⚠️ กรุณาตั้งค่าลิงก์รูป QR ก่อนส่ง',
        config.autoDeleteMinutes ? `⏳ ลบการ์ดหลังส่ง ${config.autoDeleteMinutes} นาที` : '⏳ ไม่ลบการ์ดอัตโนมัติ'
      ].filter(Boolean).join('\n\n'))],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qr:text').setLabel('ข้อความ / หัวข้อ').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('qr:image').setLabel('ลิงก์รูป QR').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('qr:button').setLabel('แต่งปุ่ม').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('qr:preview').setLabel('ดูตัวอย่าง').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('qr:send').setLabel('ส่งลงห้องนี้').setStyle(ButtonStyle.Success)
      ), new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qr:timer').setLabel('⏳ ตั้งเวลาลบ (นาที)').setStyle(ButtonStyle.Secondary)
      )], allowedMentions: { parse: [] }
    };
  }

  async function authorize(interaction) {
    if (interaction.inGuild() && interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return true;
    await interaction.reply({ content: 'ตั้งค่า QR ได้เฉพาะผู้ดูแลระบบในเซิร์ฟเวอร์เท่านั้น', flags: 64 });
    return false;
  }

  function modal(kind, config) {
    const fields = {
      text: [
        ['content', 'ข้อความเหนือ Embed (รองรับ ##)', 2000, true],
        ['title', 'หัวข้อ Embed', 256],
        ['description', 'คำอธิบาย (อิโมจิ / Markdown)', 4000, true],
        ['footer', 'ข้อความท้าย Embed', 1000],
        ['color', 'สี HEX เช่น #5865F2', 7]
      ],
      image: [['imageUrl', 'ลิงก์รูป QR (เว้นว่างเพื่อล้าง)', 512]],
      button: [['buttonLabel', 'ข้อความปุ่ม (เว้นว่างเพื่อซ่อนปุ่ม)', 80], ['buttonEmoji', 'อิโมจิปุ่ม (เว้นว่างเพื่อล้าง)', 100]],
      timer: [['autoDeleteMinutes', 'ลบหลังส่งกี่นาที เช่น 5 (0 = ไม่ลบ)', 4]]
    }[kind];
    const result = new ModalBuilder().setCustomId(`qr:modal:${kind}`).setTitle('ตั้งค่าการ์ด QR');
    for (const [key, label, max, paragraph] of fields) {
      const input = new TextInputBuilder().setCustomId(key).setLabel(label).setMaxLength(max)
        .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(false);
      if (config[key] || key === 'autoDeleteMinutes') input.setValue(String(config[key]));
      result.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return result;
  }

  async function handleCommand(interaction) {
    if (interaction.commandName !== 'set-qr') return false;
    if (await authorize(interaction)) await interaction.reply({ ...panel(interaction.guildId), flags: 64 });
    return true;
  }

  async function handleButton(interaction) {
    if (!interaction.customId.startsWith('qr:') || interaction.customId.startsWith('qr:modal:')) return false;
    if (!await authorize(interaction)) return true;
    const kind = interaction.customId.slice(3);
    const config = getConfig(interaction.guildId);
    if (['text', 'image', 'button', 'timer'].includes(kind)) {
      await interaction.showModal(modal(kind, config));
    } else if (['preview', 'send'].includes(kind)) {
      if (kind === 'send' && !config.imageUrl) {
        await interaction.reply({ content: 'กรุณาตั้งค่าลิงก์รูป QR ก่อนส่ง', flags: 64 });
      } else if (kind === 'preview') {
        await interaction.reply({ ...buildQrPayload(config), flags: 64 });
      } else {
        await interaction.deferReply({ flags: 64 });
        try {
          await sendQr(interaction.channel, interaction.guildId);
          await interaction.editReply({ content: 'ส่งการ์ด QR แล้ว ✅' });
        } catch {
          await interaction.editReply({ content: 'ส่ง QR ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ส่งข้อความ / Embed Links ของบอท' });
        }
      }
    }
    return true;
  }

  async function handleModal(interaction) {
    if (!interaction.customId.startsWith('qr:modal:')) return false;
    if (!await authorize(interaction)) return true;
    const kind = interaction.customId.slice('qr:modal:'.length);
    const keys = { text: ['content', 'title', 'description', 'footer', 'color'], image: ['imageUrl'], button: ['buttonLabel', 'buttonEmoji'], timer: ['autoDeleteMinutes'] }[kind];
    if (!keys) return false;
    try {
      const patch = Object.fromEntries(keys.map(key => [key, interaction.fields.getTextInputValue(key)]));
      if (kind === 'text') {
        patch.color = patch.color.trim() || DEFAULTS.color;
        if (!/^#[\da-f]{6}$/i.test(patch.color)) throw new Error('สีต้องเป็น HEX 6 หลัก เช่น #5865F2');
      }
      if (kind === 'image') patch.imageUrl = imageUrl(patch.imageUrl);
      if (kind === 'button') {
        patch.buttonLabel = patch.buttonLabel.trim();
        patch.buttonEmoji = patch.buttonEmoji.trim();
        buttonEmoji(patch.buttonEmoji);
      }
      if (kind === 'timer') {
        const raw = patch.autoDeleteMinutes.trim();
        if (!/^\d{1,4}$/.test(raw)) throw new Error('กรุณาใส่จำนวนนาที เช่น 5 หรือ 0 เพื่อปิดการลบอัตโนมัติ');
        patch.autoDeleteMinutes = Number(raw);
      }
      const config = validateQrConfig({ ...getConfig(interaction.guildId), ...patch });
      data.qrConfigs[interaction.guildId] = config;
      saveData();
    } catch (error) {
      await interaction.reply({ content: error.message, flags: 64 });
      return true;
    }
    const payload = panel(interaction.guildId, 'บันทึกการตั้งค่าแล้ว ✅');
    if (interaction.isFromMessage()) await interaction.update(payload);
    else await interaction.reply({ ...payload, flags: 64 });
    return true;
  }

  async function handleMessage(message) {
    if (!message.guild || message.author.bot || !/^\?qr\s*$/i.test(message.content)) return false;
    const config = getConfig(message.guild.id);
    try {
      if (!config.imageUrl) await message.reply({ content: 'ยังไม่ได้ตั้งค่ารูป QR ให้ผู้ดูแลใช้ `/set-qr panel` ก่อน', allowedMentions: { parse: [], repliedUser: false } });
      else await sendQr(message.channel, message.guild.id);
    } catch (error) {
      console.warn('Failed to send QR card:', error.message);
    }
    return true;
  }

  return { handleCommand, handleButton, handleModal, handleMessage, sendQr, startScheduler, stop };
}

module.exports = { createQrSystem, buildQrPayload, validateQrConfig, DEFAULTS };
