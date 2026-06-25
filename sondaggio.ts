import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type TextChannel,
  type Message,
} from "discord.js";
import { loadConfig, saveConfig } from "../storage.js";
import { fetchAvailableQuests, type WvQuest } from "../wolvesville.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio con le missioni disponibili del clan da Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt.setName("data_fine").setDescription("Data fine sondaggio (es: 30 Giugno 2025)").setRequired(false)
  );

export const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function questLabel(quest: WvQuest, globalIdx: number): string {
  const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
  return `${emoji} — ${quest.purchasableWithGems ? "Gemme" : "Monete"}`;
}

export async function publishPoll(
  pollChannel: TextChannel,
  quests: WvQuest[],
  dataFine: string
): Promise<{ introMessageId: string; messageIds: string[]; questLabels: string[] }> {
  const sorted = [
    ...quests.filter((q) => q.purchasableWithGems),
    ...quests.filter((q) => !q.purchasableWithGems),
  ];

  const labels = sorted.map((q, i) => questLabel(q, i));

  // Rimescolo button on intro
  const rimescoloBtn = new ButtonBuilder()
    .setCustomId("rimescolo")
    .setLabel("🔀 Rimescolo")
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rimescoloBtn);

  const introContent = [
    `🐺 **Ecco le missioni di questa settimana!**`,
    `Usa il menu qui sotto per votare. Puoi votare **una sola missione** (o chiedere il rimescolo).`,
    dataFine ? `⏳ Sondaggio aperto fino al **${dataFine}**` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const introMsg: Message = await pollChannel.send({ content: introContent, components: [row] });

  // All embeds use remote URLs — no attachments, so Discord keeps them in ONE message
  const embeds = sorted.map((quest, idx) => {
    const emoji = VOTE_EMOJIS[idx] ?? `${idx + 1}`;
    const isGems = quest.purchasableWithGems;
    const color = quest.promoImagePrimaryColor
      ? parseInt(quest.promoImagePrimaryColor.replace("#", ""), 16)
      : 0x8b0000;

    return new EmbedBuilder()
      .setTitle(`${emoji} — ${isGems ? "Gemme 💎" : "Monete 🪙"}`)
      .setImage(quest.promoImageUrl)
      .setColor(isNaN(color) ? 0x8b0000 : color);
  });

  // ONE message with all embeds (Discord supports up to 10)
  const msg = await pollChannel.send({ embeds });

  for (let idx = 0; idx < sorted.length; idx++) {
    const emoji = VOTE_EMOJIS[idx];
    if (emoji) await msg.react(emoji);
  }

  return { introMessageId: introMsg.id, messageIds: [msg.id], questLabels: labels };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "❌ Questo comando funziona solo in un server." });
    return;
  }

  const config = loadConfig();

  if (!config.pollChannelName) {
    await interaction.editReply({ content: "❌ Il canale sondaggi non è configurato. Usa `/impostazioni`." });
    return;
  }

  const clanId = process.env["WOLVESVILLE_CLAN_ID"] ?? config.clanId ?? "";
  if (!clanId) {
    await interaction.editReply({ content: "❌ ID clan Wolvesville non configurato." });
    return;
  }

  let quests: WvQuest[];
  try {
    quests = await fetchAvailableQuests(clanId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("401_UNAUTHORIZED")) {
      await interaction.editReply({
        content:
          "❌ **Bot non autorizzato!**\n\n" +
          "Il leader del clan deve aggiungere il bot in **Impostazioni clan → Bot**.",
      });
    } else {
      await interaction.editReply({ content: `❌ Errore API Wolvesville: ${msg}` });
    }
    return;
  }

  if (quests.length === 0) {
    await interaction.editReply({ content: "ℹ️ Nessuna missione disponibile al momento." });
    return;
  }

  const pollChannel = guild.channels.cache.find(
    (c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName
  ) as TextChannel | undefined;

  if (!pollChannel) {
    await interaction.editReply({
      content: `❌ Canale **#${config.pollChannelName}** non trovato. Usa \`/impostazioni\`.`,
    });
    return;
  }

  const dataFine = interaction.options.getString("data_fine") ?? "";
  const { introMessageId, messageIds, questLabels } = await publishPoll(pollChannel, quests, dataFine);

  const durationHours = config.pollDurationHours ?? 0;
  const closesAt =
    durationHours > 0
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      : undefined;

  config.activePoll = {
    channelId: pollChannel.id,
    introMessageId,
    messageIds,
    questCount: quests.length,
    questLabels,
    createdAt: new Date().toISOString(),
    closesAt,
  };
  saveConfig(config);

  if (closesAt) {
    const { schedulePollClose } = await import("../poll-timer.js");
    schedulePollClose(interaction.client, closesAt);
  }

  const notifyResults: string[] = [];
  for (const channelName of config.notifyChannelNames) {
    if (channelName === config.pollChannelName) continue;
    const notifyChannel = guild.channels.cache.find(
      (c) => c.isTextBased() && !c.isThread() && c.name === channelName
    ) as TextChannel | undefined;
    if (!notifyChannel) { notifyResults.push(`⚠️ #${channelName}: non trovato`); continue; }
    await notifyChannel.send({
      content:
        `🐺 **Sono usciti i nuovi sondaggi missione!**\n` +
        `Vai in **#${config.pollChannelName}**, vota la missione che vuoi fare e comunicalo al clan! 💪`,
    });
    notifyResults.push(`✅ Notifica inviata in #${channelName}`);
  }

  const replyLines = [
    `✅ **Sondaggio pubblicato!**`,
    `📊 Canale: **#${config.pollChannelName}**`,
    `🎯 Missioni: **${quests.length}**`,
    closesAt
      ? `⏱️ Chiusura automatica: **${new Date(closesAt).toLocaleString("it-IT")}**`
      : `⏱️ Nessun timer impostato`,
  ];
  if (notifyResults.length > 0) replyLines.push("", "**Notifiche:**", ...notifyResults);
  await interaction.editReply({ content: replyLines.join("\n") });
}
