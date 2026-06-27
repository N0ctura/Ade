import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Collection,
  EmbedBuilder,
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
import { fetchPlayerByUsername } from "./wolvesville.js";

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
      logger.info({ playerRaw: JSON.stringify(player) }, "DEBUG risposta API player");

      if (!player) {
        await message.reply({ content: `❌ Nessun giocatore trovato con il nome **${username}**.` });
        return;
      }

      const stats = player.gameStats;

      // Winrate totale
      const winRate =
        stats?.gamesPlayed && stats.gamesPlayed > 0
          ? (((stats.wins ?? 0) / stats.gamesPlayed) * 100).toFixed(1)
          : null;

      // Clan: l'API restituisce player.clan.name, non player.clanName
      const clanName = player.clan?.name ?? player.clanName ?? null;

      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle(`🐺 ${player.username}`)
        .setDescription(player.personalMessage ? `*"${player.personalMessage}"*` : null);

      // Titolo giocatore come author
      if (player.playerTitle?.title) {
        embed.setAuthor({ name: player.playerTitle.title });
      }

      // Icona profilo → in alto a destra (thumbnail)
      if (player.equippedProfileIcon?.imageUrl) {
        embed.setThumbnail(player.equippedProfileIcon.imageUrl);
      }

      // Skin equipaggiata → immagine grande in basso
      if (player.equippedAvatarItem?.imageUrl) {
        embed.setImage(player.equippedAvatarItem.imageUrl);
      }

      // Campi principali
      embed.addFields(
        { name: "⚔️ Livello", value: `${player.level}`, inline: true },
        { name: "🏰 Clan", value: clanName ?? "Nessuno", inline: true },
      );

      // Cornice profilo
      if (player.equippedProfileFrame?.imageUrl) {
        embed.addFields({
          name: "🖼️ Cornice",
          value: `[Visualizza](${player.equippedProfileFrame.imageUrl})`,
          inline: true,
        });
      }

      // Statistiche
      if (stats) {
        const villageWins = stats.survivorWins ?? 0;
        const wolfWins = stats.werewolfWins ?? 0;
        const totalWins = stats.wins ?? (villageWins + wolfWins);

        embed.addFields(
          { name: "🎮 Partite giocate", value: `${stats.gamesPlayed ?? 0}`, inline: true },
          {
            name: "🏆 Vittorie totali",
            value: `${totalWins}${winRate ? ` (${winRate}%)` : ""}`,
            inline: true,
          },
          { name: "🐺 Vittorie lupo", value: `${wolfWins}`, inline: true },
          { name: "🧑 Vittorie villaggio", value: `${villageWins}`, inline: true },
        );
      }

      embed.setFooter({ text: `ID: ${player.id}` });

      await message.reply({ embeds: [embed] });
      logger.info({ username: player.username }, "Scheda giocatore inviata");
    } catch (err) {
      logger.error({ err, username }, "Errore ricerca giocatore");
      await message.reply({ content: "❌ Errore durante la ricerca del giocatore. Riprova più tardi." });
    }
  });

  client.on("error", (err) => { logger.error({ err }, "Errore client Discord"); });

  // Carica config da PostgreSQL prima di connettersi a Discord
  await initStorage();

  await client.login(token);
}
