import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type TextChannel,
  type Message,
} from "discord.js";
import { join } from "node:path";
import { loadConfig, saveConfig } from "../storage.js";
import { fetchAvailableQuests, type WvQuest } from "../wolvesville.js";
import { addNumberBadge } from "../image-badge.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio con le missioni disponibili del clan da Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt.setName("data_fine").setDescription("Data fine sondaggio (es: 30 Giugno 2025)").setRequired(false)
  );

export const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const MISSIONS_PER_MESSAGE = 3;

const ASSETS_DIR = join(__dirname, "assets");
const GEMME_PATH = join(ASSETS_DIR, "gemme.png");
const MONETA_PATH = join(ASSETS_DIR, "moneta.png");

/**
 * Build a human-readable label for a quest (used in the closing message).
 * e.g. "1️⃣ — Gemme" or "3️⃣ — Monete"
 */
function questLabel(quest: WvQuest, globalIdx: number): string {
  const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
  return `${emoji} — ${quest.purchasableWithGems ? "Gemme" : "Monete"}`;
}

/**
 * Publish poll messages and return their IDs.
 * The Rimescolo button is placed on the LAST mission message (not the intro).
 * Exported so the Rimescolo button handler in index.ts can reuse it.
 */
export async function publishPoll(
  pollChannel: TextChannel,
  quests: WvQuest[],
  dataFine: string
): Promise<{ introMessageId: string; messageIds: string[]; questLabels: string[] }> {
  // Sort: gems first, then coins
  const sorted = [
    ...quests.filter((q) => q.purchasableWithGems),
    ...quests.filter((q) => !q.purchasableWithGems),
  ];

  const labels = sorted.map((q, i) => questLabel(q, i));

  const gemmeFile = new AttachmentBuilder(GEMME_PATH, { name: "gemme.png" });
  const monetaFile = new AttachmentBuilder(MONETA_PATH, { name: "moneta.png" });

  // Rimescolo button (will be attached to the LAST mission message)
  const rimescoloBtn = new ButtonBuilder()
    .setCustomId("rimescolo")
    .setLabel("🔀 Rimescolo")
    .setStyle(ButtonStyle.Secondary);
  const rimescoloRow = new ActionRowBuilder<ButtonBuilder>().addComponents(rimescoloBtn);

  // Intro message — NO button here
  const introContent = [
    `🐺 **Ecco le missioni di questa settimana!**`,
    `Usa il menu qui sotto per votare. Puoi votare **una sola missione** (o chiedere il rimescolo).`,
    dataFine ? `⏳ Sondaggio aperto fino al **${dataFine}**` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const introMsg: Message = await pollChannel.send({ content: introContent });
  const pollMessageIds: string[] = [];

  const totalBatches = Math.ceil(sorted.length / MISSIONS_PER_MESSAGE);

  for (let batchStart = 0; batchStart < sorted.length; batchStart += MISSIONS_PER_MESSAGE) {
    const batch = sorted.slice(batchStart, batchStart + MISSIONS_PER_MESSAGE);
    const isLastBatch = batchStart + MISSIONS_PER_MESSAGE >= sorted.length;

    // Generate numbered badge images for each mission in this batch
    const batchImages = await Promise.all(
      batch.map((quest, idx) => addNumberBadge(quest.promoImageUrl, batchStart + idx + 1))
    );

    const batchEmbeds = batch.map((quest, idx) => {
      const globalIdx = batchStart + idx;
      const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
      const isGems = quest.purchasableWithGems;
      const color = quest.promoImagePrimaryColor
        ? parseInt(quest.promoImagePrimaryColor.replace("#", ""), 16)
        : 0x8b0000;
      const imgName = `mission_${globalIdx + 1}.png`;

      return new EmbedBuilder()
        .setTitle(`${emoji} — ${isGems ? "Gemme" : "Monete"}`)
        .setImage(`attachment://${imgName}`)
        .setThumbnail(isGems ? "attachment://gemme.png" : "attachment://moneta.png")
        .setColor(isNaN(color) ? 0x8b0000 : color);
    });

    const batchHasGems = batch.some((q) => q.purchasableWithGems);
    const batchHasCoins = batch.some((q) => !q.purchasableWithGems);
    const files: AttachmentBuilder[] = [];
    if (batchHasGems) files.push(gemmeFile);
    if (batchHasCoins) files.push(monetaFile);
    // Attach numbered mission images
    batchImages.forEach((buf, idx) => {
      const globalIdx = batchStart + idx;
      files.push(new AttachmentBuilder(buf, { name: `mission_${globalIdx + 1}.png` }));
    });

    // Attach Rimescolo button only to the last batch
    const msg = await pollChannel.send({
      embeds: batchEmbeds,
      files,
      components: isLastBatch ? [rimescoloRow] : [],
    });
    pollMessageIds.push(msg.id);

    for (let idx = 0; idx < batch.length; idx++) {
      const emoji = VOTE_EMOJIS[batchStart + idx];
      if (emoji) await msg.react(emoji);
    }
  }

  return { introMessageId: introMsg.id, messageIds: pollMessageIds, questLabels: labels };
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

  // Calculate closesAt if a duration is set
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

  // Schedule auto-close if needed
  if (closesAt) {
    const { schedulePollClose } = await import("../poll-timer.js");
    schedulePollClose(interaction.client, closesAt);
  }

  // Notifications
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
