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
} from "discord.js";
import { logger } from "../lib/logger.js";
import * as sondaggioCommand from "./commands/sondaggio.js";
import * as impostazioniCommand from "./commands/impostazioni.js";
import { BOT_CONFIG } from "./config.js";
import { loadConfig } from "./storage.js";
import { VOTE_EMOJIS } from "./commands/sondaggio.js";

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
    // Partials needed to receive reactions on messages not in cache
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Bot Discord connesso");

    const rest = new REST().setToken(token);
    const commandsData = [
      sondaggioCommand.data.toJSON(),
      impostazioniCommand.data.toJSON(),
    ];

    // Clear old global commands
    try {
      await rest.put(Routes.applicationCommands(c.application.id), { body: [] });
      logger.info("Comandi globali rimossi");
    } catch (err) {
      logger.warn({ err }, "Impossibile rimuovere comandi globali");
    }

    // Register per-guild for instant propagation
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
  });

  // ── Voto esclusivo ──────────────────────────────────────────
  client.on("messageReactionAdd", async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;

    // Fetch partial reaction/message if needed
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const emoji = reaction.emoji.name;
    if (!emoji || !VOTE_EMOJIS.includes(emoji)) return;

    const config = loadConfig();
    const poll = config.activePoll;
    if (!poll) return;

    const messageId = reaction.message.id;
    if (!poll.messageIds.includes(messageId)) return;

    // Remove user's other number-emoji reactions from ALL poll messages
    for (const pollMsgId of poll.messageIds) {
      const targetMsg = pollMsgId === messageId
        ? reaction.message
        : await reaction.message.channel.messages.fetch(pollMsgId).catch(() => null);

      if (!targetMsg) continue;

      for (const [, msgReaction] of targetMsg.reactions.cache) {
        const rEmoji = msgReaction.emoji.name;
        if (!rEmoji || !VOTE_EMOJIS.includes(rEmoji)) continue;
        // Skip the reaction the user just added
        if (pollMsgId === messageId && rEmoji === emoji) continue;

        // Check if this user reacted here and remove it
        const users = await msgReaction.users.fetch();
        if (users.has(user.id)) {
          await msgReaction.users.remove(user.id).catch(() => null);
          logger.info({ userId: user.id, removed: rEmoji, msgId: pollMsgId }, "Voto precedente rimosso");
        }
      }
    }
  });

  // ── Comandi slash ───────────────────────────────────────────
  client.on("interactionCreate", async (interaction: Interaction) => {
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
