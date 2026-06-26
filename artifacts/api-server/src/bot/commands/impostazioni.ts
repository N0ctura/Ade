import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ComponentType,
  type TextChannel,
} from "discord.js";
import { loadConfig, saveConfig, DEFAULT_MESSAGES, THRESHOLD_ROLE_ID_SET, type BotMessages } from "../storage.js";

export const data = new SlashCommandBuilder()
  .setName("impostazioni")
  .setDescription("Configura il bot: canale sondaggi, notifiche, durata, ruolo e messaggi")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

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

const MESSAGE_KEYS: Array<{ key: keyof BotMessages; label: string; emoji: string; hint: string }> = [
  {
    key: "missioneVinta",
    label: "Missione vinta",
    emoji: "🏆",
    hint: "Usa {missione} per inserire il nome della missione vincitrice.",
  },
  {
    key: "pareggio",
    label: "Pareggio",
    emoji: "⚖️",
    hint: "Usa {missioni} per elencare le missioni pareggiate.",
  },
  {
    key: "nessunVoto",
    label: "Nessun voto",
    emoji: "🗳️",
    hint: "Messaggio quando il sondaggio finisce senza voti.",
  },
  {
    key: "rimescolo",
    label: "Rimescolo",
    emoji: "🔀",
    hint: "Messaggio inviato nei canali di notifica quando viene usato il rimescolo.",
  },
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

  // Escludi @everyone, bot-managed e ruoli soglia XP (sono 36 e riempirebbero tutti gli slot).
  // Ordina per posizione crescente: i ruoli più bassi (es. @tutti, @membri) vengono prima,
  // così le 25 opzioni disponibili contengono i ruoli effettivamente utili da pingare.
  const guildRoles = guild.roles.cache
    .filter((r) => r.name !== "@everyone" && !r.managed && !THRESHOLD_ROLE_ID_SET.has(r.id))
    .sort((a, b) => a.position - b.position)
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

  // ── Step 5: message buttons ────────────────────────────
  const buildMessageButtons = () =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...MESSAGE_KEYS.map((m) =>
        new ButtonBuilder()
          .setCustomId(`msg_${m.key}`)
          .setLabel(`${m.emoji} ${m.label}`)
          .setStyle(ButtonStyle.Secondary)
      ),
      new ButtonBuilder()
        .setCustomId("msg_done")
        .setLabel("✅ Fine")
        .setStyle(ButtonStyle.Success)
    );

  const buildStep5Embed = () => {
    const msgs = { ...DEFAULT_MESSAGES, ...config.messages };
    const lines = MESSAGE_KEYS.map(
      (m) => `${m.emoji} **${m.label}:**\n> ${msgs[m.key].slice(0, 100)}${msgs[m.key].length > 100 ? "…" : ""}`
    );
    return new EmbedBuilder()
      .setTitle("⚙️ Impostazioni — Passo 5/5: Messaggi")
      .setDescription(
        "Personalizza i messaggi che il bot invia.\n\n" +
          lines.join("\n\n") +
          "\n\nClicca un pulsante per modificare il testo. Premi **Fine** quando hai finito."
      )
      .setColor(0x8b0000);
  };

  // ── Initial reply ──────────────────────────────────────
  const embed = new EmbedBuilder()
    .setTitle("⚙️ Impostazioni Bot Wolvesville")
    .setDescription(
      `**Configurazione attuale:**\n${showCurrentConfig()}\n\n` +
        "**Passo 1/5:** Scegli il canale dove appariranno i sondaggi.\n\n" +
        "⏳ Hai 2 minuti per completare ogni passaggio."
    )
    .setColor(0x8b0000)
    .setFooter({ text: "Solo gli admin possono usare questo comando" });

  await interaction.reply({ embeds: [embed], components: [pollSelectRow], ephemeral: true });

  let step = 1;

  // ── Unified component collector (handles both selects and buttons) ──
  // Use fetchReply() to get the actual ephemeral Message object so the
  // collector is guaranteed to capture its component interactions.
  // interaction.channel?.createMessageComponentCollector() can silently
  // return undefined when the channel is not cached, causing all buttons
  // to time-out with "Questa interazione non è riuscita".
  const reply = await interaction.fetchReply();
  const collector = reply.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 300_000, // 5 min total
  });

  collector.on("collect", async (i) => {
    // ── Steps 1-4: StringSelect ──────────────────────────
    if (i.isStringSelectMenu()) {
      // Step 1 — Poll channel
      if (i.customId === "select_poll_channel" && step === 1) {
        config.pollChannelName = i.values[0] ?? null;
        step = 2;
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚙️ Impostazioni — Passo 2/5")
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
              .setTitle("⚙️ Impostazioni — Passo 3/5")
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
          step = 5;
          saveConfig(config);
          await i.update({ embeds: [buildStep5Embed()], components: [buildMessageButtons()] });
          return;
        }

        const durLabel = config.pollDurationHours > 0 ? `${config.pollDurationHours} ore` : "Nessun timer";
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚙️ Impostazioni — Passo 4/5")
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
        step = 5;
        saveConfig(config);
        await i.update({ embeds: [buildStep5Embed()], components: [buildMessageButtons()] });
      }

    // ── Step 5: Buttons ──────────────────────────────────
    } else if (i.isButton() && step === 5) {
      if (i.customId === "msg_done") {
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
        return;
      }

      const msgKey = i.customId.replace("msg_", "") as keyof BotMessages;
      const msgMeta = MESSAGE_KEYS.find((m) => m.key === msgKey);
      if (!msgMeta) return;

      const currentText = config.messages?.[msgKey] ?? DEFAULT_MESSAGES[msgKey];

      const modal = new ModalBuilder()
        .setCustomId(`modal_${msgKey}`)
        .setTitle(`${msgMeta.emoji} ${msgMeta.label}`);

      const textInput = new TextInputBuilder()
        .setCustomId("message_text")
        .setLabel(msgMeta.hint)
        .setStyle(TextInputStyle.Paragraph)
        .setValue(currentText)
        .setMaxLength(500)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));

      // showModal is the ONLY response we can give here
      await i.showModal(modal);

      // Await modal submit
      try {
        const submitted = await i.awaitModalSubmit({
          filter: (m) => m.user.id === interaction.user.id && m.customId === `modal_${msgKey}`,
          time: 120_000,
        });

        const newText = submitted.fields.getTextInputValue("message_text").trim();
        if (!config.messages) config.messages = {};
        config.messages[msgKey] = newText;
        saveConfig(config);

        // Acknowledge the modal without a visible reply, then update the original message
        await submitted.deferUpdate();
        await interaction.editReply({ embeds: [buildStep5Embed()], components: [buildMessageButtons()] });
      } catch {
        // Modal timed out — just restore the step 5 view
        await interaction.editReply({ embeds: [buildStep5Embed()], components: [buildMessageButtons()] });
      }
    }
  });

  collector.on("end", async (_, reason) => {
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
