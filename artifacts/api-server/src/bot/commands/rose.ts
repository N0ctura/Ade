import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
  type Message,
  type ButtonInteraction,
} from "discord.js";
import { loadConfig, saveConfig, type RoseLobby, type RoseLobbyParticipant } from "../storage.js";

function generateLobbyMessage(lobby: RoseLobby): { content: string; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const participantsList = lobby.participants.length > 0
    ? lobby.participants.map((p, i) => `${i + 1}. <@${p.userId}>`).join("\n")
    : "Nessun partecipante ancora";

  const reservesList = lobby.reserves.length > 0
    ? lobby.reserves.map((p, i) => `${i + 1}. <@${p.userId}>`).join("\n")
    : "Nessuna riserva ancora";

  const removedList = lobby.removedParticipants.length > 0
    ? lobby.removedParticipants.map((p, i) => `• <@${p.userId}>`).join("\n")
    : "Nessun partecipante rimosso";

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle(`🌹 ${lobby.title}`)
    .addFields(
      { name: `✅ Partecipanti (${lobby.participants.length})`, value: participantsList, inline: false },
      { name: `📋 Riserve (${lobby.reserves.length})`, value: reservesList, inline: false },
      { name: `❌ Rimossi (${lobby.removedParticipants.length})`, value: removedList, inline: false }
    )
    .setTimestamp(new Date(lobby.createdAt));

  const joinButton = new ButtonBuilder()
    .setCustomId("rose_join")
    .setLabel("🌹 Partecipa")
    .setStyle(ButtonStyle.Success);

  const reserveButton = new ButtonBuilder()
    .setCustomId("rose_reserve")
    .setLabel("📋 Riserva")
    .setStyle(ButtonStyle.Primary);

  const leaveButton = new ButtonBuilder()
    .setCustomId("rose_leave")
    .setLabel("❌ Togli partecipazione")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, reserveButton, leaveButton);

  return {
    content: "",
    embeds: [embed],
    components: [row],
  };
}

export const data = new SlashCommandBuilder()
  .setName("rose")
  .setDescription("Crea una nuova lobby rose")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("titolo").setDescription("Titolo della lobby rose").setRequired(true)
  )
  .addChannelOption((opt) =>
    opt.setName("canale").setDescription("Canale dove mandare il messaggio (solo la prima volta)").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "❌ Questo comando funziona solo in un server." });
    return;
  }

  const config = loadConfig();
  const title = interaction.options.getString("titolo", true);
  const channelOption = interaction.options.getChannel("canale");

  let targetChannel: TextChannel | undefined;

  if (channelOption) {
    const channelType = channelOption.type;
    if (channelType !== 0 && channelType !== 5) { // 0 = GuildText, 5 = GuildAnnouncement
      await interaction.editReply({ content: "❌ Devi selezionare un canale testuale valido." });
      return;
    }
    targetChannel = channelOption as TextChannel;
    config.roseLobbyChannelId = targetChannel.id;
    saveConfig(config);
  } else if (config.roseLobbyChannelId) {
    targetChannel = guild.channels.cache.get(config.roseLobbyChannelId) as TextChannel | undefined;
  }

  if (!targetChannel) {
    await interaction.editReply({
      content: "❌ Canale non configurato! Specifica il canale usando l'opzione `canale` la prima volta.",
    });
    return;
  }

  const lobby: RoseLobby = {
    id: `lobby-${Date.now()}`,
    guildId: guild.id,
    channelId: targetChannel.id,
    messageId: "",
    title,
    participants: [],
    reserves: [],
    removedParticipants: [],
    createdAt: new Date().toISOString(),
  };

  const messageData = generateLobbyMessage(lobby);
  const lobbyMessage: Message = await targetChannel.send(messageData);

  lobby.messageId = lobbyMessage.id;
  config.activeRoseLobby = lobby;
  saveConfig(config);

  await interaction.editReply({
    content: `✅ Lobby rose creata con successo in <#${targetChannel.id}>!`,
  });
}

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const config = loadConfig();
  const lobby = config.activeRoseLobby;

  if (!lobby || lobby.messageId !== interaction.message.id) {
    await interaction.reply({ content: "❌ Questa lobby non è più attiva.", ephemeral: true });
    return;
  }

  const userId = interaction.user.id;
  const username = interaction.user.tag;
  const now = new Date().toISOString();

  const participant: RoseLobbyParticipant = { userId, username, joinedAt: now };

  if (interaction.customId === "rose_join") {
    const existingParticipantIdx = lobby.participants.findIndex((p) => p.userId === userId);
    const existingReserveIdx = lobby.reserves.findIndex((p) => p.userId === userId);
    const existingRemovedIdx = lobby.removedParticipants.findIndex((p) => p.userId === userId);

    if (existingParticipantIdx !== -1) {
      await interaction.reply({ content: "❌ Sei già tra i partecipanti!", ephemeral: true });
      return;
    }

    if (existingReserveIdx !== -1) lobby.reserves.splice(existingReserveIdx, 1);
    if (existingRemovedIdx !== -1) lobby.removedParticipants.splice(existingRemovedIdx, 1);

    lobby.participants.push(participant);
    await interaction.reply({ content: "✅ Ti sei aggiunto ai partecipanti!", ephemeral: true });
  } else if (interaction.customId === "rose_reserve") {
    const existingParticipantIdx = lobby.participants.findIndex((p) => p.userId === userId);
    const existingReserveIdx = lobby.reserves.findIndex((p) => p.userId === userId);
    const existingRemovedIdx = lobby.removedParticipants.findIndex((p) => p.userId === userId);

    if (existingReserveIdx !== -1) {
      await interaction.reply({ content: "❌ Sei già tra le riserve!", ephemeral: true });
      return;
    }

    if (existingParticipantIdx !== -1) lobby.participants.splice(existingParticipantIdx, 1);
    if (existingRemovedIdx !== -1) lobby.removedParticipants.splice(existingRemovedIdx, 1);

    lobby.reserves.push(participant);
    await interaction.reply({ content: "✅ Ti sei aggiunto alle riserve!", ephemeral: true });
  } else if (interaction.customId === "rose_leave") {
    const existingParticipantIdx = lobby.participants.findIndex((p) => p.userId === userId);
    const existingReserveIdx = lobby.reserves.findIndex((p) => p.userId === userId);
    const existingRemovedIdx = lobby.removedParticipants.findIndex((p) => p.userId === userId);

    if (existingParticipantIdx === -1 && existingReserveIdx === -1 && existingRemovedIdx === -1) {
      await interaction.reply({ content: "❌ Non sei nella lista dei partecipanti o delle riserve!", ephemeral: true });
      return;
    }

    if (existingParticipantIdx !== -1) lobby.participants.splice(existingParticipantIdx, 1);
    if (existingReserveIdx !== -1) lobby.reserves.splice(existingReserveIdx, 1);
    if (existingRemovedIdx === -1) lobby.removedParticipants.push(participant);

    await interaction.reply({ content: "❌ Ti sei rimosso dalla partecipazione!", ephemeral: true });
  }

  config.activeRoseLobby = lobby;
  saveConfig(config);

  const messageData = generateLobbyMessage(lobby);
  await interaction.message.edit(messageData);
}
