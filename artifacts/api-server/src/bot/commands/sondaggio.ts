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
      .setName("titolo")
      .setDescription("Titolo del sondaggio (default: 'Nuove Missioni Disponibili!')")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("data_fine")
      .setDescription("Data fine sondaggio (es: 30 Giugno 2025)")
      .setRequired(false)
  );

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
      content:
        "❌ ID clan Wolvesville non configurato.\nUsa `/impostazioni` per impostarlo.",
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
      await interaction.editReply({
        content: `❌ Errore API Wolvesville: ${msg}`,
      });
    }
    return;
  }

  if (quests.length === 0) {
    await interaction.editReply({
      content: "ℹ️ Nessuna missione disponibile al momento per il clan.",
    });
    return;
  }

  // Find poll channel by name
  const pollChannel = guild.channels.cache.find(
    (c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName
  ) as TextChannel | undefined;

  if (!pollChannel) {
    await interaction.editReply({
      content: `❌ Canale **#${config.pollChannelName}** non trovato. Usa \`/impostazioni\` per aggiornare.`,
    });
    return;
  }

  const titolo = interaction.options.getString("titolo") ?? "🐺 Nuove Missioni Disponibili!";
  const dataFine = interaction.options.getString("data_fine") ?? "";

  // Header embed
  const headerEmbed = new EmbedBuilder()
    .setTitle(titolo)
    .setDescription(
      [
        `Sono disponibili **${quests.length} nuove mission${quests.length === 1 ? "e" : "i"}** per il clan!`,
        "",
        dataFine ? `⏰ Sondaggio aperto fino al: **${dataFine}**` : "",
        "",
        "👇 **Reagisci a ogni missione che vuoi fare:**",
        "✅ = Voglio partecipare | ❌ = Non mi interessa | 🤔 = Ci penso",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setColor(0x8b0000)
    .setTimestamp()
    .setFooter({ text: "Wolvesville Mission Poll • " + new Date().toLocaleDateString("it-IT") });

  await pollChannel.send({ embeds: [headerEmbed] });

  const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    if (!quest) continue;
    const emoji = VOTE_EMOJIS[i] ?? `${i + 1}`;
    const imageUrl = promoImageHighRes(quest.promoImageUrl);

    const rewardSummary = quest.rewards
      .slice(0, 3)
      .map((r) => {
        if (r.type === "AVATAR_ITEM") return `🎽 x${r.amount} outfit item`;
        if (r.type === "GOLD") return `💰 ${r.amount} gold`;
        if (r.type === "GEM") return `💎 ${r.amount} gems`;
        if (r.type === "XP") return `⭐ ${r.amount} XP`;
        return `${r.type} x${r.amount}`;
      })
      .join("\n");

    const questEmbed = new EmbedBuilder()
      .setTitle(`${emoji} Missione ${i + 1}`)
      .setImage(imageUrl)
      .setColor(quest.promoImagePrimaryColor ? parseInt(quest.promoImagePrimaryColor.replace("#", ""), 16) : 0x8b0000)
      .setFooter({ text: `Missione ${i + 1} di ${quests.length}${quest.purchasableWithGems ? " • Acquistabile con gemme" : ""}` });

    if (rewardSummary) {
      questEmbed.setDescription(`**Ricompense:**\n${rewardSummary}`);
    }

    const msg = await pollChannel.send({ embeds: [questEmbed] });
    await msg.react("✅");
    await msg.react("❌");
    await msg.react("🤔");
  }

  // Closing embed
  const closingEmbed = new EmbedBuilder()
    .setDescription(
      "✅ = **Voglio partecipare** | ❌ = **Non mi interessa** | 🤔 = **Ci penso**\n\n" +
        "📢 Dopo aver votato, comunica la tua partecipazione agli altri membri del clan!"
    )
    .setColor(0x8b0000);

  await pollChannel.send({ embeds: [closingEmbed] });

  // Send notifications
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
        `Sono usciti i nuovi sondaggi per le missioni di Wolvesville!\n\n` +
          `📊 **${quests.length} mission${quests.length === 1 ? "e disponibile" : "i disponibili"}**\n\n` +
          `Andate a votare e **comunicate la vostra partecipazione** al clan! 💪\n\n` +
          `👉 Vai al canale **#${config.pollChannelName}**`
      )
      .setColor(0xff6600)
      .setTimestamp();

    await notifyChannel.send({ embeds: [notifyEmbed] });
    notifyResults.push(`✅ Notifica inviata in #${channelName}`);
  }

  const replyLines = [
    `✅ **Sondaggio pubblicato con successo!**`,
    `📊 Canale: **#${config.pollChannelName}**`,
    `🎯 Missioni trovate: **${quests.length}**`,
  ];
  if (notifyResults.length > 0) {
    replyLines.push("", "**Notifiche:**", ...notifyResults);
  }

  await interaction.editReply({ content: replyLines.join("\n") });
}
