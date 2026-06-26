import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Collection,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type TextChannel,
} from "discord.js";
import { logger } from "../lib/logger.js";
import * as sondaggioCommand from "./commands/sondaggio.js";
import * as impostazioniCommand from "./commands/impostazioni.js";
import { BOT_CONFIG } from "./config.js";
import { loadConfig, saveConfig, getMessages } from "./storage.js";
import { publishPoll } from "./commands/sondaggio.js";
import { shuffleQuests, fetchAvailableQuests } from "./wolvesville.js";
import { schedulePollClose, cancelPollTimer } from "./poll-timer.js";

type BotCommand = typeof sondaggioCommand | typeof impostazioniCommand;

const commands = new Collection<string, BotCommand>();
commands.set(sondaggioCommand.data.name, sondaggioCommand);
commands.set(impostazioniCommand.data.name, impostazioniCommand);

export async function startBot(): Promise<void> {
  const token = BOT_CONFIG.token;
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN non impostato — bot Discord non avviato");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Bot Discord connesso");

    const rest = new REST().setToken(token);
    const commandsData = [
      sondaggioCommand.data.toJSON(),
      impostazioniCommand.data.toJSON(),
    ];

    try {
      await rest.put(Routes.applicationCommands(c.application.id), { body: [] });
      logger.info("Comandi globali rimossi");
    } catch (err) {
      logger.warn({ err }, "Impossibile rimuovere comandi globali");
    }

    const guilds = c.guilds.cache;
    logger.info({ guildCount: guilds.size }, "Registrazione comandi per server...");
    for (const [guildId] of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(c.application.id, guildId), { body: commandsData });
        logger.info({ guildId }, "Comandi slash registrati nel server");
      } catch (err) {
        logger.error({ err, guildId }, "Errore registrazione comandi nel server");
      }
    }

    const config = loadConfig();
    if (config.activePoll?.closesAt) {
      logger.info({ closesAt: config.activePoll.closesAt }, "Ripristino timer sondaggio dopo riavvio");
      schedulePollClose(client, config.activePoll.closesAt);
    }
  });

  // ── Interazioni ──────────────────────────────────────────
  client.on("interactionCreate", async (interaction: Interaction) => {

    // ── Select menu: voto missione ─────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "vote_mission") {
      const selectedIdx = parseInt(interaction.values[0] ?? "0", 10);
      const config = loadConfig();
      const poll = config.activePoll;

      if (!poll || !poll.messageIds.includes(interaction.message.id)) {
        await interaction.reply({ content: "❌ Questo sondaggio non è più attivo.", ephemeral: true });
        return;
      }

      if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= poll.questCount) {
        await interaction.reply({ content: "❌ Scelta non valida.", ephemeral: true });
        return;
      }

      poll.votes = poll.votes ?? {};
      const isChange = interaction.user.id in poll.votes;
      poll.votes[interaction.user.id] = selectedIdx;
      saveConfig(config);

      const label = poll.questLabels[selectedIdx] ?? `Missione ${selectedIdx + 1}`;
      const msg = isChange
        ? `🔄 **Voto aggiornato!** Hai cambiato voto: **${label}**`
        : `✅ **Voto registrato!** Hai votato: **${label}**`;
      await interaction.reply({ content: msg, ephemeral: true });
      logger.info({ userId: interaction.user.id, selectedIdx, label, isChange }, "Voto registrato");
      return;
    }

    // ── Button: Rimescolo ──────────────────────────────────
    if (interaction.isButton() && interaction.customId === "rimescolo") {
      await interaction.deferReply({ ephemeral: true });

      const config = loadConfig();
      const poll = config.activePoll;
      const clanId = process.env["WOLVESVILLE_CLAN_ID"] ?? config.clanId ?? "";

      if (!clanId) { await interaction.editReply({ content: "❌ ID clan non configurato." }); return; }

      try { await shuffleQuests(clanId); } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.editReply({ content: `❌ Errore rimescolo: ${msg}` });
        return;
      }

      if (poll && interaction.guild) {
        const pollChannel = interaction.guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
        if (pollChannel) {
          const toDelete = [poll.introMessageId, ...poll.messageIds];
          for (const msgId of toDelete) await pollChannel.messages.delete(msgId).catch(() => null);
        }
      }

      let quests;
      try { quests = await fetchAvailableQuests(clanId); } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.editReply({ content: `❌ Errore recupero missioni: ${msg}` });
        return;
      }

      if (!config.pollChannelName || !interaction.guild) {
        await interaction.editReply({ content: "❌ Configurazione mancante." });
        return;
      }

      const pollChannel = interaction.guild.channels.cache.find(
        (c) => c.isTextBased() && !c.isThread() && c.name === config.pollChannelName
      ) as TextChannel | undefined;

      if (!pollChannel) {
        await interaction.editReply({ content: `❌ Canale **#${config.pollChannelName}** non trovato.` });
        return;
      }

      const { introMessageId, messageIds, questLabels } = await publishPoll(pollChannel, quests, "");
      const closesAt = poll?.closesAt;
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

      if (closesAt) { cancelPollTimer(); schedulePollClose(interaction.client, closesAt); }

      const messages = getMessages(config);
      for (const channelName of config.notifyChannelNames) {
        if (channelName === config.pollChannelName) continue;
        const notifyChannel = interaction.guild.channels.cache.find(
          (c) => c.isTextBased() && !c.isThread() && c.name === channelName
        ) as TextChannel | undefined;
        if (notifyChannel) await notifyChannel.send({ content: messages.rimescolo }).catch(() => null);
      }

      logger.info({ questCount: quests.length }, "Sondaggio rimescolato e ripubblicato");
      await interaction.editReply({ content: `✅ **Missioni rimescolate!** Nuovo sondaggio pubblicato con **${quests.length}** missioni.` });
      return;
    }

    // ── Slash commands ──────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Errore nell'esecuzione del comando");
      const errorMsg = { content: "❌ Si è verificato un errore. Riprova più tardi.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errorMsg);
      else await interaction.reply(errorMsg);
    }
  });

  client.on("error", (err) => { logger.error({ err }, "Errore client Discord"); });

  await client.login(token);
}
