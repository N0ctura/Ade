import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Collection,
  AttachmentBuilder,
  type Interaction,
  type Message,
} from "discord.js";
import { logger } from "../lib/logger.js";
import * as sondaggioCommand from "./commands/sondaggio.js";
import * as impostazioniCommand from "./commands/impostazioni.js";
import * as debugTempliCommand from "./commands/debug-templi.js";
import * as fineCommand from "./commands/fine.js";
import { BOT_CONFIG } from "./config.js";
import { loadConfig, saveConfig, initStorage } from "./storage.js";
import { schedulePollClose } from "./poll-timer.js";
import { fetchPlayerByUsername, fetchClanById } from "./wolvesville.js";
import { generateProfileCard } from "./profile-card.js";

type BotCommand = typeof sondaggioCommand | typeof impostazioniCommand | typeof debugTempliCommand | typeof fineCommand;

const commands = new Collection<string, BotCommand>();
commands.set(sondaggioCommand.data.name, sondaggioCommand);
commands.set(impostazioniCommand.data.name, impostazioniCommand);
commands.set(debugTempliCommand.data.name, debugTempliCommand);
commands.set(fineCommand.data.name, fineCommand);

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
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Bot Discord connesso");

    const rest = new REST().setToken(token);
    const commandsData = [
      sondaggioCommand.data.toJSON(),
      impostazioniCommand.data.toJSON(),
      debugTempliCommand.data.toJSON(),
      fineCommand.data.toJSON(),
    ];

    try {
      await rest.put(Routes.applicationCommands(c.application.id), { body: [] });
    } catch (err) {
      logger.warn({ err }, "Impossibile rimuovere comandi globali");
    }

    for (const [guildId] of c.guilds.cache) {
      try {
        await rest.put(Routes.applicationGuildCommands(c.application.id, guildId), { body: commandsData });
        logger.info({ guildId }, "Comandi slash registrati");
      } catch (err) {
        logger.error({ err, guildId }, "Errore registrazione comandi");
      }
    }

    const config = loadConfig();
    if (config.activePoll?.closesAt) {
      logger.info({ closesAt: config.activePoll.closesAt }, "Ripristino timer sondaggio dopo riavvio");
      schedulePollClose(client, config.activePoll.closesAt);
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {

    // ── Select menu: voto missione o rimescolo ──────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "vote_mission") {
      const value = interaction.values[0] ?? "";
      const config = loadConfig();
      const poll = config.activePoll;

      if (!poll || !poll.messageIds.includes(interaction.message.id)) {
        await interaction.reply({ content: "❌ Questo sondaggio non è più attivo.", ephemeral: true });
        return;
      }

      poll.votes = poll.votes ?? {};
      const isChange = interaction.user.id in poll.votes;

      if (value === "rimescolo") {
        poll.votes[interaction.user.id] = -1;
        saveConfig(config);
        const verb = isChange ? "🔄 **Voto aggiornato!** Hai votato per il" : "🔀 **Voto registrato!** Hai votato per il";
        await interaction.reply({ content: `${verb} **Rimescolo**.`, ephemeral: true });
        logger.info({ userId: interaction.user.id, vote: "rimescolo", isChange }, "Voto rimescolo");
        return;
      }

      const selectedIdx = parseInt(value, 10);
      if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= poll.questCount) {
        await interaction.reply({ content: "❌ Scelta non valida.", ephemeral: true });
        return;
      }

      poll.votes[interaction.user.id] = selectedIdx;
      saveConfig(config);

      const label = poll.questLabels[selectedIdx] ?? `Missione ${selectedIdx + 1}`;
      const msg = isChange
        ? `🔄 **Voto aggiornato!** Hai cambiato voto: **${label}**`
        : `✅ **Voto registrato!** Hai votato: **${label}**`;
      await interaction.reply({ content: msg, ephemeral: true });
      logger.info({ userId: interaction.user.id, selectedIdx, label, isChange }, "Voto missione");
      return;
    }

    // ── Slash commands ──────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Errore comando");
      const errorMsg = { content: "❌ Si è verificato un errore. Riprova più tardi.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errorMsg);
      else await interaction.reply(errorMsg);
    }
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (!content.startsWith(".") || content.length < 2) return;
    if (content.startsWith("./") || content.startsWith("..")) return;

    const username = content.slice(1).trim();
    if (!username) return;

    try {
      await message.channel.sendTyping();
      const player = await fetchPlayerByUsername(username);

      if (!player) {
        await message.reply({ content: `❌ Nessun giocatore trovato con il nome **${username}**.` });
        return;
      }

      const stats = player.gameStats;
      const totalWins   = stats?.totalWinCount ?? 0;
      const totalLosses = stats?.totalLoseCount ?? 0;
      const totalTies   = stats?.totalTieCount ?? 0;
      const gamesPlayed = totalWins + totalLosses + totalTies;
      const villageWins = stats?.villageWinCount ?? 0;
      const wolfWins    = stats?.werewolfWinCount ?? 0;
      const winRate     = gamesPlayed > 0 ? ((totalWins / gamesPlayed) * 100).toFixed(1) : null;

      // Clan name
      let clanName: string | undefined;
      if (player.clanId) {
        const clan = await fetchClanById(player.clanId);
        clanName = clan?.name;
      }

      // Avatar URL — equippedAvatar può essere un oggetto con imageUrl o avere un id CDN
      const avatarRaw = (player as any).equippedAvatar;
      const avatarUrl: string | undefined =
        avatarRaw?.imageUrl ??
        (avatarRaw?.id ? `https://cdn.wolvesville.com/avatarItems/${avatarRaw.id as string}.png` : undefined);

      // Genera la card grafica
      const cardBuffer = await generateProfileCard({
        username: player.username,
        level: player.level,
        personalMessage: player.personalMessage,
        clanName,
        avatarUrl,
        gamesPlayed,
        totalWins,
        villageWins,
        wolfWins,
        winRate,
        rosesReceived: (player as any).receivedRosesCount,
        rosesSent: (player as any).sentRosesCount,
      });

      const attachment = new AttachmentBuilder(cardBuffer, { name: `profilo_${player.username}.png` });
      await message.reply({ files: [attachment] });
      logger.info({ username: player.username, avatarUrl }, "Scheda giocatore inviata");
    } catch (err) {
      logger.error({ err, username }, "Errore ricerca giocatore");
      await message.reply({ content: "❌ Errore durante la ricerca del giocatore. Riprova più tardi." });
    }
  });

  client.on("error", (err) => { logger.error({ err }, "Errore client Discord"); });

  await initStorage();
  await client.login(token);
}
