import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { MissionSkin } from "../types.js";
import { BOT_CONFIG } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio per le nuove missioni di Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  // --- required prima ---
  .addStringOption((opt) =>
    opt.setName("titolo").setDescription("Titolo del sondaggio missione").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("skin1_nome").setDescription("Nome della skin 1").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("skin1_url").setDescription("URL immagine skin 1").setRequired(true)
  )
  // --- opzionali dopo ---
  .addStringOption((opt) =>
    opt.setName("descrizione").setDescription("Descrizione della missione").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("data_fine").setDescription("Data fine sondaggio (es: 30 Giugno 2025)").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin2_nome").setDescription("Nome della skin 2").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin2_url").setDescription("URL immagine skin 2").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin3_nome").setDescription("Nome della skin 3").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin3_url").setDescription("URL immagine skin 3").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin4_nome").setDescription("Nome della skin 4").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin4_url").setDescription("URL immagine skin 4").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin5_nome").setDescription("Nome della skin 5").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("skin5_url").setDescription("URL immagine skin 5").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const titolo = interaction.options.getString("titolo", true);
  const descrizione = interaction.options.getString("descrizione") ?? "";
  const dataFine = interaction.options.getString("data_fine") ?? "";

  const skins: MissionSkin[] = [];
  for (let i = 1; i <= 5; i++) {
    const nome = interaction.options.getString(`skin${i}_nome`);
    const url = interaction.options.getString(`skin${i}_url`);
    if (nome && url) {
      skins.push({ name: nome, imageUrl: url });
    }
  }

  if (skins.length === 0) {
    await interaction.editReply({
      content: "❌ Devi aggiungere almeno una skin con nome e URL immagine.",
    });
    return;
  }

  const pollChannelId = BOT_CONFIG.pollChannelId;
  if (!pollChannelId) {
    await interaction.editReply({
      content:
        "❌ Il canale sondaggi non è configurato. Imposta `DISCORD_POLL_CHANNEL_ID` nelle variabili d'ambiente.",
    });
    return;
  }

  const channel = interaction.guild?.channels.cache.get(pollChannelId);
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({
      content: `❌ Canale sondaggi non trovato (ID: ${pollChannelId}). Verifica che il bot abbia accesso al canale.`,
    });
    return;
  }

  const headerEmbed = new EmbedBuilder()
    .setTitle(`🐺 ${titolo}`)
    .setDescription(
      [
        descrizione ? descrizione : "Nuove missioni disponibili su Wolvesville!",
        "",
        `**${skins.length} skin disponibil${skins.length === 1 ? "e" : "i"}**`,
        dataFine ? `⏰ Sondaggio aperto fino al: **${dataFine}**` : "",
        "",
        "👇 **Reagisci ai messaggi delle skin che vuoi votare!**",
      ]
        .filter((l) => l !== undefined)
        .join("\n")
    )
    .setColor(0x8b0000)
    .setTimestamp()
    .setFooter({ text: "Wolvesville Mission Poll • " + new Date().toLocaleDateString("it-IT") });

  await channel.send({ embeds: [headerEmbed] });

  const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

  for (let i = 0; i < skins.length; i++) {
    const skin = skins[i];
    if (!skin) continue;
    const emoji = VOTE_EMOJIS[i] ?? `${i + 1}`;

    const skinEmbed = new EmbedBuilder()
      .setTitle(`${emoji} ${skin.name}`)
      .setImage(skin.imageUrl)
      .setColor(0x8b0000)
      .setFooter({ text: `Skin ${i + 1} di ${skins.length}` });

    if (skin.description) {
      skinEmbed.setDescription(skin.description);
    }

    const msg = await channel.send({ embeds: [skinEmbed] });
    await msg.react("✅");
    await msg.react("❌");
    await msg.react("🤔");
  }

  const closingEmbed = new EmbedBuilder()
    .setDescription(
      "✅ = **Voglio partecipare** | ❌ = **Non mi interessa** | 🤔 = **Ci penso**\n\n" +
        "📢 Dopo aver votato, comunica la tua partecipazione agli altri membri!"
    )
    .setColor(0x8b0000);

  await channel.send({ embeds: [closingEmbed] });

  const notifyChannelIds = BOT_CONFIG.notifyChannelIds;
  const notifyResults: string[] = [];

  for (const notifyId of notifyChannelIds) {
    if (notifyId === pollChannelId) continue;
    const notifyChannel = interaction.guild?.channels.cache.get(notifyId);
    if (!notifyChannel || !notifyChannel.isTextBased()) {
      notifyResults.push(`⚠️ Canale ${notifyId}: non trovato o non testuale`);
      continue;
    }

    const notifyEmbed = new EmbedBuilder()
      .setTitle("🐺 Nuovi Sondaggi Missione!")
      .setDescription(
        `Sono usciti i nuovi sondaggi per le missioni di Wolvesville!\n\n` +
          `📊 **${titolo}** — ${skins.length} skin disponibil${skins.length === 1 ? "e" : "i"}\n\n` +
          `Andate a votare e **comunicate la vostra partecipazione** al clan! 💪\n\n` +
          `👉 Vai al canale <#${pollChannelId}>`
      )
      .setColor(0xff6600)
      .setTimestamp();

    await notifyChannel.send({ embeds: [notifyEmbed] });
    notifyResults.push(`✅ Notifica inviata in <#${notifyId}>`);
  }

  const replyLines = [
    `✅ **Sondaggio pubblicato con successo!**`,
    `📊 Canale: <#${pollChannelId}>`,
    `🖼️ Skin inserite: ${skins.length}`,
  ];
  if (notifyResults.length > 0) {
    replyLines.push("", "**Notifiche:**", ...notifyResults);
  }

  await interaction.editReply({ content: replyLines.join("\n") });
}
