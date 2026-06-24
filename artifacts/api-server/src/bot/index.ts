import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
  type Interaction,
} from "discord.js";
import { logger } from "../lib/logger.js";
import * as sondaggioCommand from "./commands/sondaggio.js";
import * as impostazioniCommand from "./commands/impostazioni.js";
import { BOT_CONFIG } from "./config.js";

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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Bot Discord connesso");

    const rest = new REST().setToken(token);
    try {
      const commandsData = [
        sondaggioCommand.data.toJSON(),
        impostazioniCommand.data.toJSON(),
      ];
      await rest.put(Routes.applicationCommands(c.application.id), {
        body: commandsData,
      });
      logger.info("Comandi slash registrati globalmente");
    } catch (err) {
      logger.error({ err }, "Errore nella registrazione dei comandi slash");
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Errore nell'esecuzione del comando");
      const errorMsg = {
        content: "❌ Si è verificato un errore. Riprova più tardi.",
        ephemeral: true,
      };
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
