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
  .setDescription("Configura il bot: canale sondaggi, notifiche, durata e ruolo")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const DURATION_OPTIONS = [
  { label: "12 ore", value: "12" },
  { label: "24 ore (1 giorno)", value: "24" },
  { label: "36 ore", value: "36" },
  { label: "48 ore (2 giorni)", value: "48" },
  { label: "72 ore (3 giorni)", value: "72" },
  { label: "96 ore (4 giorni)", value: "96" },
  { label: "120 ore (5 giorni)", value: "120" },
  { label: "168 ore (7 giorni)", value: "168" },
  { label: "Nessun timer", value: "0" },
];

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
    const durLabel =
      config.pollDurationHours && config.pollDurationHours > 0
        ? `${config.pollDurationHours} ore`
        : "Nessun timer";
    return [
      `📊 **Canale sondaggi:** ${config.pollChannelName ? `#${config.pollChannelName}` : "❌ non impostato"}`,
      `🔔 **Canali notifica:** ${config.notifyChannelNames.length > 0 ? config.notifyChannelNames.map((n) => `#${n}`).join(", ") : "❌ nessuno"}`,
      `⏱️ **Durata sondaggio:** ${durLabel}`,
      `🔔 **Ruolo da pingare:** ${config.pingRoleName ? `@${config.pingRoleName}` : "❌ non impostato"}`,
    ].join("\n");
  };

  const channelOptions = textChannels
    .slice(0, 25)
    .map((c) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`#${c.name}`)
        .setValue(c.name)
        .setDescription(c.topic?.slice(0, 50) ?? "Canale testuale")
    );

  const guildRoles = guild.roles.cache
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => b.position - a.position)
    .first(25);

  const roleOptions = guildRoles.map((r) =>
    new StringSelectMenuOptionBuilder().setLabel(`@${r.name}`).setValue(r.name)
  );

  // ── Row builders ───────────────────────────────────────
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

  const durationSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_duration")
      .setPlaceholder("Scegli la durata del sondaggio…")
      .addOptions(
        DURATION_OPTIONS.map((o) =>
          new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value)
        )
      )
  );

  const roleSelectRow = roleOptions.length > 0
    ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select_role")
          .setPlaceholder("Scegli il ruolo da pingare alla chiusura…")
          .addOptions(roleOptions)
      )
    : null;

  // ── Initial reply ──────────────────────────────────────
  const embed = new EmbedBuilder()
    .setTitle("⚙️ Impostazioni Bot Wolvesville")
    .setDescription(
      `**Configurazione attuale:**\n${showCurrentConfig()}\n\n` +
        "**Passo 1/4:** Scegli il canale dove appariranno i sondaggi.\n\n" +
        "⏳ Hai 2 minuti per completare ogni passaggio."
    )
    .setColor(0x8b0000)
    .setFooter({ text: "Solo gli admin possono usare questo comando" });

  await interaction.reply({ embeds: [embed], components: [pollSelectRow], ephemeral: true });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i) => i.user.id === interaction.user.id,
    time: 120_000,
  });

  let step = 1;

  collector?.on("collect", async (i) => {
    // Step 1 — Poll channel
    if (i.customId === "select_poll_channel" && step === 1) {
      config.pollChannelName = i.values[0] ?? null;
      step = 2;
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚙️ Impostazioni — Passo 2/4")
            .setDescription(
              `✅ Canale sondaggi: **#${config.pollChannelName}**\n\n` +
                "Scegli i canali dove mandare la notifica quando escono nuovi sondaggi.\n" +
                "Puoi selezionarne più d'uno."
            )
            .setColor(0x8b0000),
        ],
        components: [notifySelectRow],
      });

    // Step 2 — Notify channels
    } else if (i.customId === "select_notify_channels" && step === 2) {
      config.notifyChannelNames = i.values;
      step = 3;
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚙️ Impostazioni — Passo 3/4")
            .setDescription(
              `✅ Canali notifica: **${config.notifyChannelNames.map((n) => `#${n}`).join(", ")}**\n\n` +
                "Per quanto tempo deve restare aperto il sondaggio prima di chiudersi automaticamente?\n" +
                "Scegli **Nessun timer** per disabilitare la chiusura automatica."
            )
            .setColor(0x8b0000),
        ],
        components: [durationSelectRow],
      });

    // Step 3 — Duration
    } else if (i.customId === "select_duration" && step === 3) {
      config.pollDurationHours = parseInt(i.values[0] ?? "0", 10);
      step = 4;

      if (!roleSelectRow) {
        // No roles available — skip and save
        saveConfig(config);
        collector.stop("done");
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Impostazioni salvate!")
              .setDescription(`**Configurazione aggiornata:**\n${showCurrentConfig()}`)
              .setColor(0x00aa44),
          ],
          components: [],
        });
        return;
      }

      const durLabel = config.pollDurationHours > 0 ? `${config.pollDurationHours} ore` : "Nessun timer";
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚙️ Impostazioni — Passo 4/4")
            .setDescription(
              `✅ Durata sondaggio: **${durLabel}**\n\n` +
                "Quale ruolo deve essere menzionato quando i sondaggi si chiudono?\n" +
                "(es: @tutti, @clan, @membri)"
            )
            .setColor(0x8b0000),
        ],
        components: [roleSelectRow],
      });

    // Step 4 — Role
    } else if (i.customId === "select_role" && step === 4) {
      config.pingRoleName = i.values[0];
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
              .setDescription("Le impostazioni non sono state salvate completamente. Usa `/impostazioni` per riprovare.")
              .setColor(0xffaa00),
          ],
          components: [],
        });
      } catch { /* message might be gone */ }
    }
  });
}
