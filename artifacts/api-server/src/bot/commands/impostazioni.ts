import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  type TextChannel,
  ComponentType,
} from "discord.js";
import { loadConfig, saveConfig } from "../storage.js";

export const data = new SlashCommandBuilder()
  .setName("impostazioni")
  .setDescription("Configura il bot: canale sondaggi e canali notifica")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "❌ Questo comando funziona solo in un server.", ephemeral: true });
    return;
  }

  const config = loadConfig();

  const textChannels: TextChannel[] = guild.channels.cache
    .filter((c) => c.isTextBased() && !c.isThread())
    .map((c) => c as TextChannel)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (textChannels.length === 0) {
    await interaction.reply({ content: "❌ Nessun canale testuale trovato nel server.", ephemeral: true });
    return;
  }

  const showCurrentConfig = () => {
    const lines = [
      `📊 **Canale sondaggi:** ${config.pollChannelName ? `#${config.pollChannelName}` : "❌ non impostato"}`,
      `🔔 **Canali notifica:** ${config.notifyChannelNames.length > 0 ? config.notifyChannelNames.map((n) => `#${n}`).join(", ") : "❌ nessuno"}`,
    ];
    return lines.join("\n");
  };

  const channelOptions = textChannels
    .slice(0, 25)
    .map((c) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`#${c.name}`)
        .setValue(c.name)
        .setDescription(c.topic?.slice(0, 50) ?? "Canale testuale")
    );

  const pollSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_poll_channel")
      .setPlaceholder("Scegli il canale per i sondaggi…")
      .addOptions(channelOptions)
  );

  const notifySelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_notify_channels")
      .setPlaceholder("Scegli i canali per le notifiche… (max 10)")
      .setMinValues(1)
      .setMaxValues(Math.min(10, channelOptions.length))
      .addOptions(channelOptions)
  );

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Impostazioni Bot Wolvesville")
    .setDescription(
      `**Configurazione attuale:**\n${showCurrentConfig()}\n\n` +
        "**Passo 1:** Scegli il canale dove appariranno i sondaggi.\n" +
        "**Passo 2:** Scegli i canali dove mandare la notifica.\n\n" +
        "⏳ Hai 2 minuti per completare ogni passaggio."
    )
    .setColor(0x8b0000)
    .setFooter({ text: "Solo gli admin possono usare questo comando" });

  await interaction.reply({
    embeds: [embed],
    components: [pollSelectRow],
    ephemeral: true,
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i) => i.user.id === interaction.user.id,
    time: 120_000,
  });

  let step = 1;

  collector?.on("collect", async (i) => {
    if (i.customId === "select_poll_channel" && step === 1) {
      config.pollChannelName = i.values[0] ?? null;
      step = 2;

      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚙️ Impostazioni — Passo 2/2")
            .setDescription(
              `✅ Canale sondaggi impostato: **#${config.pollChannelName}**\n\n` +
                "Ora scegli i canali dove mandare la notifica quando escono nuovi sondaggi.\n" +
                "Puoi selezionarne più d'uno tenendo il menu aperto."
            )
            .setColor(0x8b0000),
        ],
        components: [notifySelectRow],
      });
    } else if (i.customId === "select_notify_channels" && step === 2) {
      config.notifyChannelNames = i.values;
      saveConfig(config);
      collector.stop("done");

      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Impostazioni salvate!")
            .setDescription(
              `**Configurazione aggiornata:**\n${showCurrentConfig()}\n\n` +
                "Il bot è pronto! Usa `/sondaggio` per creare un nuovo sondaggio missione."
            )
            .setColor(0x00aa44),
        ],
        components: [],
      });
    }
  });

  collector?.on("end", async (_, reason) => {
    if (reason !== "done") {
      try {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("⏰ Tempo scaduto")
              .setDescription("Le impostazioni non sono state salvate. Usa `/impostazioni` per riprovare.")
              .setColor(0xffaa00),
          ],
          components: [],
        });
      } catch {
      }
    }
  });
}
