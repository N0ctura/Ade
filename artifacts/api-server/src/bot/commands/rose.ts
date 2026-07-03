import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
  type TextChannel,
  type Message,
  type ButtonInteraction,
} from "discord.js";
import { join } from "node:path";
import { loadConfig, saveConfig, type RoseLobby, type RoseLobbyParticipant } from "../storage.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..", "..");
const LOGO_PATH = join(__dirname, "assets", "wovrose.png");

// Aggiorniamo l'interfaccia RoseLobby per includere il messaggio
declare module "../storage.js" {
  interface RoseLobby {
    customMessage?: string;
  }
}

function formatItalianDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateLobbyMessage(lobby: RoseLobby): { content: string; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; files?: AttachmentBuilder[]; allowedMentions?: { parse: string[] } } {
  const participantsList = lobby.participants.length > 0
    ? lobby.participants.map((p, i) => `${i + 1}. <@${p.userId}> - ${formatItalianDate(p.joinedAt)}`).join("\n")
    : "Nessun partecipante ancora";

  const reservesList = lobby.reserves.length > 0
    ? lobby.reserves.map((p, i) => `${i + 1}. <@${p.userId}> - ${formatItalianDate(p.joinedAt)}`).join("\n")
    : "Nessuna riserva ancora";

  const removedList = lobby.removedParticipants.length > 0
    ? lobby.removedParticipants.map((p, i) => `• <@${p.userId}> - ${formatItalianDate(p.joinedAt)}`).join("\n")
    : "Nessun partecipante rimosso";

  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle("🌹 Lobby Rose")
    .setThumbnail("attachment://wovrose.png")
    .addFields(
      { name: `✅ Partecipanti (${lobby.participants.length})`, value: participantsList, inline: false },
      { name: `📋 Riserve (${lobby.reserves.length})`, value: reservesList, inline: false },
      { name: `❌ Rimossi (${lobby.removedParticipants.length})`, value: removedList, inline: false }
    )
    .setTimestamp(new Date(lobby.createdAt));

  // Pulsanti più piccoli: solo emoji senza testo
  const joinButton = new ButtonBuilder()
    .setCustomId("rose_join")
    .setEmoji("🌹")
    .setStyle(ButtonStyle.Success);

  const reserveButton = new ButtonBuilder()
    .setCustomId("rose_reserve")
    .setEmoji("📋")
    .setStyle(ButtonStyle.Primary);

  const leaveButton = new ButtonBuilder()
    .setCustomId("rose_leave")
    .setEmoji("❌")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, reserveButton, leaveButton);

  const logoAttachment = new AttachmentBuilder(LOGO_PATH, { name: "wovrose.png" });

  return {
    content: lobby.customMessage || "",
    embeds: [embed],
    components: [row],
    files: [logoAttachment],
    allowedMentions: { parse: ["roles", "users"] }, // Permetti menzioni di ruoli e utenti
  };
}

export const data = new SlashCommandBuilder()
  .setName("rose")
  .setDescription("Crea una nuova lobby rose")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("messaggio").setDescription("Messaggio personalizzato da mostrare sopra la lista").setRequired(false)
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
  const customMessage = interaction.options.getString("messaggio");
  const channelOption = interaction.options.getChannel("canale");

  let targetChannel: TextChannel | undefined;

  if (channelOption) {
    if (channelOption.type !== ChannelType.GuildText && channelOption.type !== ChannelType.GuildAnnouncement) {
      await interaction.editReply({ content: "❌ Devi selezionare un canale testuale valido." });
      return;
    }
    targetChannel = channelOption as TextChannel;
    config.roseLobbyChannelId = targetChannel.id;
    saveConfig(config);
  } else if (config.roseLobbyChannelId) {
    const channelFromCache = guild.channels.cache.get(config.roseLobbyChannelId);
    if (channelFromCache && (channelFromCache.type === ChannelType.GuildText || channelFromCache.type === ChannelType.GuildAnnouncement)) {
      targetChannel = channelFromCache as TextChannel;
    }
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
    title: "Lobby Rose",
    customMessage: customMessage || undefined,
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
    const existingRemovedIdx = lobby.removedParticipants.findIndex((p) => p.userId === userId);

    if (existingParticipantIdx !== -1) {
      await interaction.reply({ content: "❌ Sei già tra i partecipanti!", ephemeral: true });
      return;
    }

    if (existingRemovedIdx !== -1) lobby.removedParticipants.splice(existingRemovedIdx, 1);

    lobby.participants.push(participant);
    await interaction.reply({ content: "✅ Ti sei aggiunto ai partecipanti!", ephemeral: true });
  } else if (interaction.customId === "rose_reserve") {
    const existingReserveIdx = lobby.reserves.findIndex((p) => p.userId === userId);
    const existingRemovedIdx = lobby.removedParticipants.findIndex((p) => p.userId === userId);

    if (existingReserveIdx !== -1) {
      await interaction.reply({ content: "❌ Sei già tra le riserve!", ephemeral: true });
      return;
    }

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
  await interaction.message.edit({
    content: messageData.content,
    embeds: messageData.embeds,
    components: messageData.components,
    files: messageData.files,
    attachments: [],
  });
}
