import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import { loadConfig, saveConfig } from "../storage.js";
import { fetchAvailableQuests, promoImageHighRes, type WvQuest } from "../wolvesville.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio con le missioni disponibili del clan da Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt.setName("data_fine").setDescription("Data fine sondaggio (es: 30 Giugno 2025)").setRequired(false)
  );

export const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const MISSIONS_PER_MESSAGE = 3;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "❌ Questo comando funziona solo in un server." });
    return;
  }

  const config = loadConfig();

  if (!config.pollChannelName) {
    await interaction.editReply({
      content: "❌ Il canale sondaggi non è ancora configurato!\nUsa prima `/impostazioni`.",
    });
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
          "Il leader del clan deve aggiungere il bot in **Impostazioni clan → Bot**.\n" +
          "Dopodiché riprova con questo comando.",
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

  // ── Intro ─────────────────────────────────────────────────
  const intro = [
    `🐺 **Ecco le missioni di questa settimana!**`,
    `Vota il numero della missione che vuoi fare. Puoi votare **una sola missione**.`,
    dataFine ? `⏳ Sondaggio aperto fino al **${dataFine}**` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await pollChannel.send({ content: intro });

  // ── Batch: 3 missioni per messaggio ───────────────────────
  const pollMessageIds: string[] = [];

  for (let batchStart = 0; batchStart < quests.length; batchStart += MISSIONS_PER_MESSAGE) {
    const batch = quests.slice(batchStart, batchStart + MISSIONS_PER_MESSAGE);

    const batchEmbeds = batch.map((quest, idx) => {
      const globalIdx = batchStart + idx;
      const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
      const imageUrl = promoImageHighRes(quest.promoImageUrl);
      const color = quest.promoImagePrimaryColor
        ? parseInt(quest.promoImagePrimaryColor.replace("#", ""), 16)
        : 0x8b0000;

      return new EmbedBuilder()
        .setTitle(`${emoji} Missione ${globalIdx + 1}`)
        .setImage(imageUrl)
        .setColor(isNaN(color) ? 0x8b0000 : color);
    });

    const msg = await pollChannel.send({ embeds: batchEmbeds });
    pollMessageIds.push(msg.id);

    // Add number reactions for each mission in this batch
    for (let idx = 0; idx < batch.length; idx++) {
      const globalIdx = batchStart + idx;
      const emoji = VOTE_EMOJIS[globalIdx];
      if (emoji) await msg.react(emoji);
    }
  }

  // ── Salva il sondaggio attivo per il voto esclusivo ───────
  config.activePoll = {
    channelId: pollChannel.id,
    messageIds: pollMessageIds,
    questCount: quests.length,
    createdAt: new Date().toISOString(),
  };
  saveConfig(config);

  // ── Notifiche ─────────────────────────────────────────────
  const notifyResults: string[] = [];
  for (const channelName of config.notifyChannelNames) {
    if (channelName === config.pollChannelName) continue;
    const notifyChannel = guild.channels.cache.find(
      (c) => c.isTextBased() && !c.isThread() && c.name === channelName
    ) as TextChannel | undefined;

    if (!notifyChannel) {
      notifyResults.push(`⚠️ #${channelName}: non trovato`);
      continue;
    }

    await notifyChannel.send({
      content:
        `🐺 **Sono usciti i nuovi sondaggi missione!**\n` +
        `Vai in **#${config.pollChannelName}**, vota la missione che vuoi fare e comunica la tua partecipazione al clan! 💪`,
    });
    notifyResults.push(`✅ Notifica inviata in #${channelName}`);
  }

  const totalMessages = Math.ceil(quests.length / MISSIONS_PER_MESSAGE);
  const replyLines = [
    `✅ **Sondaggio pubblicato!**`,
    `📊 Canale: **#${config.pollChannelName}**`,
    `🎯 Missioni: **${quests.length}** in **${totalMessages}** messaggi`,
    `🗳️ Voto esclusivo attivo — ogni membro può votare una sola missione`,
  ];
  if (notifyResults.length > 0) replyLines.push("", "**Notifiche:**", ...notifyResults);

  await interaction.editReply({ content: replyLines.join("\n") });
}
