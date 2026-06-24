import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import { loadConfig } from "../storage.js";
import { fetchAvailableQuests, promoImageHighRes, type WvQuest } from "../wolvesville.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio con le missioni disponibili del clan da Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((opt) =>
    opt
      .setName("data_fine")
      .setDescription("Data fine sondaggio (es: 30 Giugno 2025)")
      .setRequired(false)
  );

const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
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
      content: "❌ Il canale sondaggi non è ancora configurato!\nUsa prima `/impostazioni` per impostare i canali.",
    });
    return;
  }

  const clanId = process.env["WOLVESVILLE_CLAN_ID"] ?? config.clanId ?? "";
  if (!clanId) {
    await interaction.editReply({
      content: "❌ ID clan Wolvesville non configurato.\nUsa `/impostazioni` per impostarlo.",
    });
    return;
  }

  // Fetch quests from Wolvesville
  let quests: WvQuest[];
  try {
    quests = await fetchAvailableQuests(clanId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("401_UNAUTHORIZED")) {
      await interaction.editReply({
        content:
          "❌ **Bot non autorizzato!**\n\n" +
          "Il bot Wolvesville deve essere aggiunto al clan come *clan bot*.\n" +
          "Il leader del clan deve:\n" +
          "1. Aprire il gioco\n" +
          "2. Andare in **Impostazioni clan**\n" +
          "3. Selezionare la sezione **Bot**\n" +
          "4. Aggiungere il bot con il suo ID\n\n" +
          "Dopodiché riprova con questo comando.",
      });
    } else {
      await interaction.editReply({ content: `❌ Errore API Wolvesville: ${msg}` });
    }
    return;
  }

  if (quests.length === 0) {
    await interaction.editReply({ content: "ℹ️ Nessuna missione disponibile al momento per il clan." });
    return;
  }

  const pollChannel = guild.channels.cache.find(
    (c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName
  ) as TextChannel | undefined;

  if (!pollChannel) {
    await interaction.editReply({
      content: `❌ Canale **#${config.pollChannelName}** non trovato. Usa \`/impostazioni\` per aggiornare.`,
    });
    return;
  }

  const dataFine = interaction.options.getString("data_fine") ?? "";
  const today = new Date().toLocaleDateString("it-IT");

  // ── Header ──────────────────────────────────────────────────
  const headerEmbed = new EmbedBuilder()
    .setTitle("🐺 Ecco i nuovi sondaggi di questa settimana!")
    .setDescription(
      [
        `Sono disponibili **${quests.length} mission${quests.length === 1 ? "e" : "i"}** per il clan.`,
        dataFine ? `⏰ Votazione aperta fino al: **${dataFine}**` : "",
        "",
        "Reagisci con il numero corrispondente alla missione che vuoi fare:",
        "✅ = **Partecipo** | ❌ = **Non partecipo** | 🤔 = **Ci penso**",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setColor(0x8b0000)
    .setTimestamp()
    .setFooter({ text: `Wolvesville Mission Poll • ${today}` });

  await pollChannel.send({ embeds: [headerEmbed] });

  // ── Batch: 3 missioni per messaggio ────────────────────────
  for (let batchStart = 0; batchStart < quests.length; batchStart += MISSIONS_PER_MESSAGE) {
    const batch = quests.slice(batchStart, batchStart + MISSIONS_PER_MESSAGE);

    const batchEmbeds = batch.map((quest, idx) => {
      const globalIdx = batchStart + idx;
      const emoji = VOTE_EMOJIS[globalIdx] ?? `${globalIdx + 1}`;
      const imageUrl = promoImageHighRes(quest.promoImageUrl);

      const color = quest.promoImagePrimaryColor
        ? parseInt(quest.promoImagePrimaryColor.replace("#", ""), 16)
        : 0x8b0000;

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} Missione ${globalIdx + 1}`)
        .setImage(imageUrl)
        .setColor(isNaN(color) ? 0x8b0000 : color);

      const rewardLines = quest.rewards.slice(0, 3).map((r) => {
        if (r.type === "AVATAR_ITEM") return `🎽 ${r.amount} item outfit`;
        if (r.type === "GOLD") return `💰 ${r.amount} gold`;
        if (r.type === "GEM") return `💎 ${r.amount} gemme`;
        if (r.type === "XP") return `⭐ ${r.amount} XP`;
        return `${r.type} ×${r.amount}`;
      });

      if (rewardLines.length > 0) {
        embed.setDescription(`**Ricompense:** ${rewardLines.join(" • ")}`);
      }

      return embed;
    });

    // Send all 3 embeds in ONE message → one notification
    const msg = await pollChannel.send({ embeds: batchEmbeds });

    // One reaction set per mission in the batch
    for (let idx = 0; idx < batch.length; idx++) {
      const globalIdx = batchStart + idx;
      const emoji = VOTE_EMOJIS[globalIdx];
      if (emoji) await msg.react(emoji);
    }
    await msg.react("✅");
    await msg.react("❌");
    await msg.react("🤔");
  }

  // ── Footer ──────────────────────────────────────────────────
  const footerEmbed = new EmbedBuilder()
    .setDescription(
      "📢 Reagisci al numero della missione che vuoi fare, poi comunica la tua partecipazione agli altri membri del clan!"
    )
    .setColor(0x8b0000);

  await pollChannel.send({ embeds: [footerEmbed] });

  // ── Notifiche negli altri canali ────────────────────────────
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

    const notifyEmbed = new EmbedBuilder()
      .setTitle("🐺 Nuovi Sondaggi Missione!")
      .setDescription(
        `Sono usciti i nuovi sondaggi per le missioni di questa settimana!\n\n` +
          `📊 **${quests.length} mission${quests.length === 1 ? "e disponibile" : "i disponibili"}**\n\n` +
          `Andate a votare e **comunicate la vostra partecipazione** al clan! 💪\n\n` +
          `👉 Vai al canale **#${config.pollChannelName}**`
      )
      .setColor(0xff6600)
      .setTimestamp();

    await notifyChannel.send({ embeds: [notifyEmbed] });
    notifyResults.push(`✅ Notifica inviata in #${channelName}`);
  }

  // ── Risposta ─────────────────────────────────────────────────
  const totalMessages = Math.ceil(quests.length / MISSIONS_PER_MESSAGE);
  const replyLines = [
    `✅ **Sondaggio pubblicato!**`,
    `📊 Canale: **#${config.pollChannelName}**`,
    `🎯 Missioni: **${quests.length}** in **${totalMessages}** messaggi (3 per messaggio)`,
  ];
  if (notifyResults.length > 0) {
    replyLines.push("", "**Notifiche:**", ...notifyResults);
  }

  await interaction.editReply({ content: replyLines.join("\n") });
}
