// This file is injected into the bot's index.js by scripts/install-bot.js.
// Functions here deliberately use the bot's existing handlers and live data.
if (IS_PUBLIC_BOT) {
  const { startDashboardServer } = require('./website-dashboard');
  startDashboardServer({ client, data, saveData, async publish(system, guild, member, config) {
    let replyError = null;
    const interaction = {
      guild, guildId: guild.id, member, memberPermissions: member.permissions, user: member.user,
      channelId: config.panelChannelId || config.channelId || config.publishChannelId, commandName: '', inGuild: () => true,
      channel: guild.channels.cache.get(config.panelChannelId || config.channelId),
      options: { getChannel: () => guild.channels.cache.get(config.publishChannelId || config.channelId), getString: name => name === 'image_url' ? config.imageUrl || null : config[name] ?? null, getAttachment: () => null, getInteger: name => config[name] ?? null, getRole: () => guild.roles.cache.get(config.roleId) || null, getSubcommand: () => 'start' },
      async deferReply() {}, async reply(payload) { replyError = payload.content || 'ไม่สามารถเผยแพร่แผงได้'; }, async editReply(payload) { if (payload.content && /❌|ไม่สำเร็จ|ไม่สามารถ/.test(payload.content)) replyError = payload.content; }, async followUp() {}
    };
    if (system === 'ticket') {
      ticketSetupDrafts.set(ticketSetupKey(interaction), normalizeTicketSetupDraft(config, guild.id));
      const result = await publishTicketSetup(interaction); if (result.error) throw new Error(result.error);
    } else if (system === 'verify') {
      const channel = guild.channels.cache.get(config.channelId);
      const roles = (config.roleIds || []).map(id => guild.roles.cache.get(id)).filter(Boolean);
      if (!channel || !roles.length) throw new Error('กรุณาเลือกช่องและอย่างน้อยหนึ่งยศ');
      await verifySystem.createPanel(interaction, channel, 'button', roles, config);
    } else if (system === 'shop') {
      interaction.commandName = 'shop'; await shopSystem.handleCommand(interaction);
    } else if (system === 'province') {
      interaction.commandName = 'set-province'; await provinceRoleSystem.handleCommand(interaction);
    } else if (system === 'chat') {
      interaction.commandName = 'setpanel-chat'; await chatSystem.handleCommand(interaction);
    } else if (system === 'giveaway') {
      interaction.commandName = 'giveaway'; await giveawaySystem.handleCommand(interaction);
    } else if (system === 'safe') {
      interaction.commandName = 'safeserver'; await handleSafeServerCommand(interaction);
    } else if (system === 'announce') {
      const channel = guild.channels.cache.get(config.channelId);
      if (!channel?.isTextBased()) throw new Error('กรุณาเลือกช่องประกาศ');
      const { buildAnnouncementPayload } = require('./announce-system');
      await channel.send(buildAnnouncementPayload(config));
    } else throw new Error('ยังไม่มีตัวเผยแพร่สำหรับระบบนี้');
    if (replyError) throw new Error(replyError);
  }});
}
