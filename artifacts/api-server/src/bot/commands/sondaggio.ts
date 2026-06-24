import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import type { MissionSkin } from "../types.js";
import { loadConfig } from "../storage.js";

export const data = new SlashCommandBuilder()
  .setName("sondaggio")
  .setDescription("Crea un sondaggio per le nuove missioni di Wolvesville")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  // required first
  .addStringOption((opt) =>
    opt.setName("titolo").setDescription("Titolo del sondaggio missione").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("skin1_nome").setDescription("Nome della skin 1").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("skin1_url").setDescription("URL immagine skin 1").setRequired(true)
  )
  // optional after
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

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "❌ Questo comando funziona solo in un server." });
    return;
  }

  const config = loadConfig();

  if (!config.pollChannelName) {
    await interaction.editReply({
      content:
        "❌ Il canale sondaggi non è ancora configurato!\nUsa prima `/impostazioni` per impostare i canali.",
    });
    return;
  }

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

  // Trova canale sondaggi per nome
  const pollChannel = guild.channels.cache.find(
    (c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName
  ) as TextChannel | undefined;

  if (!pollChannel) {
    await interaction.editReply({
      content: `❌ Canale **#${config.pollChannelName}** non trovato. Usa \`/impostazioni\` per aggiornare la configurazione.`,
    });
    return;
  }

  // Messaggio header
  const headerEmbed = new EmbedBuilder()
    .setTitle(`🐺 ${titolo}`)
    .setDescription(
      [
        descrizione || "Nuove missioni disponibili su Wolvesville!",
        "",
        `**${skins.length} skin disponibil${skins.length === 1 ? "e" : "i"}**`,
        dataFine ? `⏰ Sondaggio aperto fino al: **${dataFine}**` : "",
        "",
        "👇 **Reagisci con ✅ per partecipare, ❌ per non partecipare, 🤔 se ci stai ancora pensando!**",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setColor(0x8b0000)
    .setTimestamp()
    .setFooter({ text: "Wolvesville Mission Poll • " + new Date().toLocaleDateString("it-IT") });

  await pollChannel.send({ embeds: [headerEmbed] });

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

    if (skin.description) skinEmbed.setDescription(skin.description);

    const msg = await pollChannel.send({ embeds: [skinEmbed] });
    await msg.react("✅");
    await msg.react("❌");
    await msg.react("🤔");
  }

  const closingEmbed = new EmbedBuilder()
    .setDescription(
      "✅ = **Voglio partecipare** | ❌ = **Non mi interessa** | 🤔 = **Ci penso**\n\n" +
        "📢 Dopo aver votato, comunica la tua partecipazione agli altri membri del clan!"
    )
    .setColor(0x8b0000);

  await pollChannel.send({ embeds: [closingEmbed] });

  // Notifiche negli altri canali
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
          `📊 **${titolo}** — ${skins.length} skin disponibil${skins.length === 1 ? "e" : "i"}\n\n` +
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
    `🖼️ Skin inserite: ${skins.length}`,
  ];
  if (notifyResults.length > 0) {
    replyLines.push("", "**Notifiche:**", ...notifyResults);
  }

  await interaction.editReply({ content: replyLines.join("\n") });
}
