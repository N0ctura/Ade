import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

const ASSETS_DIR = join(__dirname, "assets");
const GEMME_PATH = join(ASSETS_DIR, "gemme.png");
const MONETA_PATH = join(ASSETS_DIR, "moneta.png");

function questLabel(quest: WvQuest, globalIdx: number): string {
  const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
  return `${emoji} — ${quest.purchasableWithGems ? "Gemme" : "Monete"}`;
}

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

  // ── Intro message with Rimescolo button ──────────────────
  const rimescoloBtn = new ButtonBuilder()
    .setCustomId("rimescolo")
    .setLabel("🔀 Rimescolo")
    .setStyle(ButtonStyle.Secondary);
  const rimescoloRow = new ActionRowBuilder<ButtonBuilder>().addComponents(rimescoloBtn);

  const introLines = [
    `🐺 **Ecco le missioni di questa settimana!**`,
    `Usa il menu qui sotto per votare. Puoi votare **una sola missione** (o chiedere il rimescolo).`,
    dataFine ? `⏳ Sondaggio aperto fino al **${dataFine}**` : "",
  ].filter(Boolean);

  const introMsg: Message = await pollChannel.send({
    content: introLines.join("\n"),
    components: [rimescoloRow],
  });

  // ── Generate numbered badge images ──────────────────────
  const badgeBuffers = await Promise.all(
    sorted.map((quest, idx) => addNumberBadge(quest.promoImageUrl, idx + 1))
  );

  // Plain file attachments → Discord renders them as a photo grid
  const imageFiles = badgeBuffers.map((buf, idx) =>
    new AttachmentBuilder(buf, { name: `mission_${idx + 1}.png` })
  );

  // Caption line: e.g. "💎 1️⃣ Gemme  |  🪙 2️⃣ Monete  |  ..."
  const captionParts = sorted.map((q, i) => {
    const icon = q.purchasableWithGems ? "💎" : "🪙";
    const emoji = VOTE_EMOJIS[i] ?? `${i + 1}`;
    return `${icon} ${emoji} ${q.purchasableWithGems ? "Gemme" : "Monete"}`;
  });
  const caption = captionParts.join("  ·  ");

  // ── Select menu for voting ("la lista") ──────────────────
  const options = sorted.map((quest, idx) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${quest.purchasableWithGems ? "Gemme" : "Monete"} — Missione ${idx + 1}`)
      .setEmoji(VOTE_EMOJIS[idx] ?? `${idx + 1}`)
      .setValue(String(idx))
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("vote_mission")
    .setPlaceholder("Seleziona la missione che vuoi fare...")
    .addOptions(options);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // ── Send single mission message ──────────────────────────
  const missionMsg: Message = await pollChannel.send({
    content: caption,
    files: imageFiles,
    components: [selectRow],
  });

  return {
    introMessageId: introMsg.id,
    messageIds: [missionMsg.id],
    questLabels: labels,
  };
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
    votes: {},
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
