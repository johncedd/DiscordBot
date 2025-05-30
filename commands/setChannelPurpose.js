const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannelpurpose')
    .setDescription('Assign a specific purpose to this channel.')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Choose the purpose')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Music', value: 'music' },
          { name: 'General', value: 'general' },
          { name: 'VIP', value: 'vip' },
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const purpose = interaction.options.getString('type');
    const channel = interaction.channel;
    const guild = interaction.guild;

    let topicText = '';
    let permissionUpdates = [];

    switch (purpose) {
      case 'welcome':
        topicText = '🎉 Welcome channel – New members join here.';
        break;
      case 'music':
        topicText = '🎵 Music commands for FlaviBot.';
        break;
      case 'general':
        topicText = '💬 General discussion for members.';
        break;
      case 'vip':
        topicText = '⭐ VIP-only area.';
        const vipRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'vip');
        if (!vipRole) return interaction.reply({ content: '⚠️ VIP role not found.', ephemeral: true });

        permissionUpdates.push(
          { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
          { id: vipRole.id, allow: ['ViewChannel'] }
        );
        break;
    }

    await channel.setTopic(topicText);
    if (permissionUpdates.length > 0) {
      await channel.permissionOverwrites.set(permissionUpdates);
    }

    await interaction.reply({ content: `✅ Channel marked as **${purpose}**.`, ephemeral: true });
  }
};
