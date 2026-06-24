import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Collection,
  type Interaction,
  type MessageReaction,
  type User,
  type TextChannel,
} from "discord.js";
import { logger } from "../lib/logger.js";
import * as sondaggioCommand from "./commands/sondaggio.js";
import * as impostazioniCommand from "./commands/impostazioni.js";
import { BOT_CONFIG } from "./config.js";
import { loadConfig, saveConfig } from "./storage.js";
import { VOTE_EMOJIS, publishPoll } from "./commands/sondaggio.js";
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
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
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
        await rest.put(Routes.applicationGuildCommands(c.application.id, guildId), {
          body: commandsData,
        });
        logger.info({ guildId }, "Comandi slash registrati nel server");
      } catch (err) {
        logger.error({ err, guildId }, "Errore registrazione comandi nel server");
      }
    }

    // ── Ripristina timer se c'è un sondaggio attivo persistito ──
    const config = loadConfig();
    if (config.activePoll?.closesAt) {
      logger.info({ closesAt: config.activePoll.closesAt }, "Ripristino timer sondaggio dopo riavvio");
      schedulePollClose(client, config.activePoll.closesAt);
    }
  });

  // ── Voto esclusivo ───────────────────────────────────────
  client.on("messageReactionAdd", async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;
    if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
    if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }

    const emoji = reaction.emoji.name;
    if (!emoji || !VOTE_EMOJIS.includes(emoji)) return;

    const config = loadConfig();
    const poll = config.activePoll;
    if (!poll || !poll.messageIds.includes(reaction.message.id)) return;

    for (const pollMsgId of poll.messageIds) {
      const targetMsg = pollMsgId === reaction.message.id
        ? reaction.message
        : await reaction.message.channel.messages.fetch(pollMsgId).catch(() => null);
      if (!targetMsg) continue;

      for (const [, msgReaction] of targetMsg.reactions.cache) {
        const rEmoji = msgReaction.emoji.name;
        if (!rEmoji || !VOTE_EMOJIS.includes(rEmoji)) continue;
        if (pollMsgId === reaction.message.id && rEmoji === emoji) continue;
        const users = await msgReaction.users.fetch();
        if (users.has(user.id)) {
          await msgReaction.users.remove(user.id).catch(() => null);
          logger.info({ userId: user.id, removed: rEmoji }, "Voto precedente rimosso");
        }
      }
    }
  });

  // ── Interazioni (bottoni + comandi slash) ────────────────
  client.on("interactionCreate", async (interaction: Interaction) => {
    // ── Button: Rimescolo ──────────────────────────────────
    if (interaction.isButton() && interaction.customId === "rimescolo") {
      await interaction.deferReply({ ephemeral: true });

      const config = loadConfig();
      const poll = config.activePoll;
      const clanId = process.env["WOLVESVILLE_CLAN_ID"] ?? config.clanId ?? "";

      if (!clanId) {
        await interaction.editReply({ content: "❌ ID clan non configurato." });
        return;
      }

      try {
        await shuffleQuests(clanId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.editReply({ content: `❌ Errore rimescolo: ${msg}` });
        return;
      }

      // Delete old poll messages
      if (poll && interaction.guild) {
        const pollChannel = interaction.guild.channels.cache.get(poll.channelId) as TextChannel | undefined;
        if (pollChannel) {
          const toDelete = [poll.introMessageId, ...poll.messageIds];
          for (const msgId of toDelete) {
            await pollChannel.messages.delete(msgId).catch(() => null);
          }
        }
      }

      let quests;
      try {
        quests = await fetchAvailableQuests(clanId);
      } catch (err) {
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

      // Preserve the original closesAt so the timer isn't extended by a reshuffle
      const closesAt = poll?.closesAt;
      config.activePoll = {
        channelId: pollChannel.id,
        introMessageId,
        messageIds,
        questCount: quests.length,
        questLabels,
        createdAt: new Date().toISOString(),
        closesAt,
      };
      saveConfig(config);

      // Re-schedule with the same deadline
      if (closesAt) {
        cancelPollTimer();
        schedulePollClose(interaction.client, closesAt);
      }

      logger.info({ questCount: quests.length }, "Sondaggio rimescolato e ripubblicato");
      await interaction.editReply({
        content: `✅ **Missioni rimescolate!** Nuovo sondaggio pubblicato con **${quests.length}** missioni.`,
      });
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
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  });

  client.on("error", (err) => {
    logger.error({ err }, "Errore client Discord");
  });

  await client.login(token);
}
