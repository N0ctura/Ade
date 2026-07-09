import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
  type Message,
} from "discord.js";
import { join } from "node:path";
import { loadConfig, saveConfig } from "../storage.js";
import { fetchAvailableQuests, type WvQuest } from "../wolvesville.js";
import { addNumberBadge } from "../image-badge.js";
import { normalize } from "../normalize.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio con le missioni disponibili del clan")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("data_fine").setDescription("Data fine sondaggio (es: 30 Giugno 2025) — ignorato se il timer automatico è attivo").setRequired(false)
  );

export const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const ASSETS_DIR = join(__dirname, "assets");

function questLabel(quest: WvQuest, globalIdx: number): string {
  const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
  return `${emoji} — ${quest.purchasableWithGems ? "Gem Quest" : "Gold Quest"}`;
}

export async function publishPoll(
  pollChannel: TextChannel,
  quests: WvQuest[],
  dataFine: string,
  closesAt?: Date,
  hideRimescolo?: boolean
): Promise<{ introMessageId: string; messageIds: string[]; questLabels: string[]; questImageUrls: string[] }> {
  // Sort: gems first, then coins
  const sorted = [
    ...quests.filter((q) => q.purchasableWithGems),
    ...quests.filter((q) => !q.purchasableWithGems),
  ];

  const labels = sorted.map((q, i) => questLabel(q, i));
  const imageUrls = sorted.map((q) => q.promoImageUrl);

  // Generate numbered badge images
  const badgeBuffers = await Promise.all(
    sorted.map((quest, idx) => addNumberBadge(quest.promoImageUrl, idx + 1))
  );

  const imageFiles = badgeBuffers.map((buf, idx) =>
    new AttachmentBuilder(buf, { name: `mission_${idx + 1}.png` })
  );

  // Caption: one line summarising all missions
  const caption = sorted
    .map((q, i) => `${q.purchasableWithGems ? "💎" : "🪙"} ${VOTE_EMOJIS[i] ?? i + 1}`)
    .join("  ·  ");

  // Select menu: mission options + Rimescolo as last choice (if not hidden)
  const missionOptions = sorted.map((quest, idx) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${quest.purchasableWithGems ? "Gemme" : "Monete"} — Missione ${idx + 1}`)
      .setEmoji(VOTE_EMOJIS[idx] ?? `${idx + 1}`)
      .setValue(String(idx))
  );
  const allOptions = [...missionOptions];
  if (!hideRimescolo) {
    const rimescoloOption = new StringSelectMenuOptionBuilder()
      .setLabel("Rimescolo — voglio missioni diverse")
      .setEmoji("🔀")
      .setValue("rimescolo");
    allOptions.push(rimescoloOption);
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("vote_mission")
    .setPlaceholder("Seleziona la missione che vuoi fare...")
    .addOptions(allOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // Timer line — usa timestamp Discord nativo se disponibile (si aggiorna in tempo reale),
  // altrimenti cade su dataFine testuale se fornita.
  let timerLine = "";
  if (closesAt) {
    const unixTs = Math.floor(closesAt.getTime() / 1000);
    timerLine = `⏳ Votazioni aperte — chiudono <t:${unixTs}:R> (<t:${unixTs}:f>)`;
  } else if (dataFine) {
    timerLine = `⏳ Sondaggio aperto fino al **${dataFine}**`;
  }

  // Intro text
  const introLines = [
    `🐺 **Ecco le missioni di questa settimana!**`,
    `Usa il menu qui sotto per votare. Puoi cambiare voto in qualsiasi momento.`,
    timerLine,
    ``,
    caption,
  ].filter((l, i, arr) => l !== `` || arr[i - 1] !== ``);

  const pollMsg: Message = await pollChannel.send({
    content: introLines.filter(Boolean).join("\n"),
    files: imageFiles,
    components: [selectRow],
  });

  const summaryLines = [
    `📊 **Conteggio voti (live)** — votanti: **0**`,
    `ℹ️ Ancora nessun voto registrato.`,
  ];
  const summaryMsg: Message = await pollChannel.send({ content: summaryLines.join("\n") });

  return {
    introMessageId: pollMsg.id,
    messageIds: [pollMsg.id, summaryMsg.id],
    questLabels: labels,
    questImageUrls: imageUrls,
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

  // Backward compatibility: migrate from name to ID if needed
  if (!config.pollChannelId && config.pollChannelName) {
    const oldPollChannel = guild.channels.cache.find(
      (c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName
    );
    if (oldPollChannel) {
      config.pollChannelId = oldPollChannel.id;
    }
  }
  if (!config.notifyChannelIds.length && config.notifyChannelNames?.length) {
    config.notifyChannelIds = config.notifyChannelNames
      .map(name => {
        const ch = guild.channels.cache.find(
          (c) => c.isTextBased() && !c.isThread() && c.name === name
        );
        return ch?.id;
      })
      .filter((id): id is string => !!id);
  }

  if (!config.pollChannelId) {
    await interaction.editReply({ content: "❌ Il canale sondaggi non è configurato. Usa `/impostazioni`." });
    return;
  }

  const clanId = process.env["WOLVESVILLE_CLAN_ID"] ?? config.clanId ?? "";
  if (!clanId) {
    await interaction.editReply({ content: "❌ ID clan Wolvesville non configurato." });
    return;
  }

  let quests;
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

  const pollChannel = guild.channels.cache.get(config.pollChannelId) as TextChannel | undefined;

  if (!pollChannel) {
    await interaction.editReply({
      content: `❌ Canale non trovato. Usa \`/impostazioni\`.`,
    });
    return;
  }

  // Calcola closesAt PRIMA di publishPoll così possiamo passarlo per il timer nel messaggio
  const durationHours = config.pollDurationHours ?? 0;
  const closesAtDate = durationHours > 0
    ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
    : undefined;

  const dataFine = interaction.options.getString("data_fine") ?? "";
  const hideRimescolo = config.lastPollWasShuffled ?? false;

  // Resetta il flag prima di salvare il nuovo sondaggio
  config.lastPollWasShuffled = false;

  const { introMessageId, messageIds, questLabels, questImageUrls } = await publishPoll(
    pollChannel,
    quests,
    dataFine,
    closesAtDate,
    hideRimescolo
  );

  const closesAt = closesAtDate?.toISOString();

  config.activePoll = {
    channelId: pollChannel.id,
    introMessageId,
    messageIds,
    summaryMessageId: messageIds[1],
    questCount: quests.length,
    questLabels,
    questImageUrls,
    createdAt: new Date().toISOString(),
    closesAt,
    votes: {},
  };
  saveConfig(config);

  if (closesAt) {
    const { schedulePollClose } = await import("../poll-timer.js");
    schedulePollClose(interaction.client, closesAt);
  }

  // Mappa normalizzato→role per trovare il ruolo tempio di ogni canale di notifica
  const roleByNorm = new Map(
    guild.roles.cache
      .filter((r) => r.name !== "@everyone")
      .map((r) => [normalize(r.name), r])
  );

  const notifyResults: string[] = [];
  for (const channelId of config.notifyChannelIds) {
    if (channelId === config.pollChannelId) continue;
    const notifyChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!notifyChannel) { notifyResults.push(`⚠️ Canale non trovato`); continue; }

    // Cerca il ruolo corrispondente al canale (es. #tempio-degli-abissi → ruolo Tempio-degli-Abissi)
    const matchingRole = roleByNorm.get(normalize(notifyChannel.name));
    const roleMention = matchingRole ? `<@&${matchingRole.id}>` : undefined;
    const allowedRoles = matchingRole ? [matchingRole.id] : [];

    const embed = new EmbedBuilder()
      .setTitle("🐺 Sono usciti i nuovi sondaggi missione!")
      .setDescription(
        `Vai in <#${config.pollChannelId}>, vota la missione che vuoi fare e comunicalo al clan! 💪`
      )
      .setColor(0x8b0000);

    await notifyChannel.send({
      content: roleMention,
      embeds: [embed],
      allowedMentions: { roles: allowedRoles },
    });
    notifyResults.push(`✅ <#${channelId}>${matchingRole ? ` (ping @${matchingRole.name})` : ""}`);
  }

  const replyLines = [
    `✅ **Sondaggio pubblicato!**`,
    `📊 Canale: <#${config.pollChannelId}>`,
    `🎯 Missioni: **${quests.length}**`,
    closesAt
      ? `⏱️ Chiusura automatica: **${new Date(closesAt).toLocaleString("it-IT")}**`
      : `⏱️ Nessun timer impostato`,
  ];
  if (notifyResults.length > 0) replyLines.push("", "**Notifiche:**", ...notifyResults);
  await interaction.editReply({ content: replyLines.join("\n") });
}
