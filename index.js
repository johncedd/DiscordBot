const { Client, GatewayIntentBits, Collection, Partials, REST, Routes, PermissionsBitField } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    const commands = client.commands.map(cmd => cmd.data.toJSON());
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
      body: commands,
    });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

// In-memory emoji-role map
const emojiRoleMap = new Map();
client.emojiRoleMap = emojiRoleMap;

// Slash Command Execution
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: '❌ Command error.', ephemeral: true });
  }
});

// Reaction Role Handler
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  const roleId = emojiRoleMap.get(reaction.emoji.name);
  if (roleId) {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.add(roleId);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  const roleId = emojiRoleMap.get(reaction.emoji.name);
  if (roleId) {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    await member.roles.remove(roleId);
  }
});

// DM-based emoji-role assignment
client.on('messageCreate', async message => {
  if (message.guild || message.author.bot) return;

  const content = message.content.trim();
  const match = content.match(/^\/bindemoji\s+<#(\d+)>\s+(\S+)\s+(.+)$/);
  if (!match) {
    return message.reply('❌ Invalid format.\nUse: `/bindemoji #channel 🤖 RoleName`');
  }

  const [_, channelId, emoji, roleName] = match;
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return message.reply('❌ Channel not found.');

  const channelOwner = (await channel.fetchOwner?.()) ?? (await guild.fetchOwner());
  if (channelOwner.id !== message.author.id) {
    return message.reply('❌ Only the channel owner can assign emojis.');
  }

  if (roleName.toLowerCase() === 'vip') {
    return message.reply('🚫 VIP role cannot be assigned via emoji.');
  }

  let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      color: 'Random',
      reason: 'Auto-created by bot for emoji role.',
    });
  }

  emojiRoleMap.set(emoji, role.id);
  const msg = await channel.send(`React with ${emoji} to get the **${role.name}** role!`);
  await msg.react(emoji);

  return message.reply(`✅ Bound ${emoji} to **${role.name}** in #${channel.name}`);
});

client.login(process.env.TOKEN);
