import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import { playText, stopTTS, setTTSConfig, getTTSConfig } from "../tts.js";
import { logger } from "../../lib/logger.js";

export const ttsCommands = [
  // /leggi [testo]
  new SlashCommandBuilder()
    .setName("leggi")
    .setDescription("Legge un testo in italiano nel canale vocale")
    .addStringOption((option) =>
      option
        .setName("testo")
        .setDescription("Il testo da leggere")
        .setRequired(true)
    ),

  // /stop-tts
  new SlashCommandBuilder()
    .setName("stop-tts")
    .setDescription("Ferma il TTS e disconnette dal canale vocale"),

  // /canale-tts [canale]
  new SlashCommandBuilder()
    .setName("canale-tts")
    .setDescription("Imposta un canale dove il bot legge automaticamente tutti i messaggi")
    .addChannelOption((option) =>
      option
        .setName("canale")
        .setDescription("Il canale testuale da monitorare")
        .setRequired(false)
    ),

  // /abilita-tts
  new SlashCommandBuilder()
    .setName("abilita-tts")
    .setDescription("Abilita il TTS automatico nel canale impostato"),

  // /disabilita-tts
  new SlashCommandBuilder()
    .setName("disabilita-tts")
    .setDescription("Disabilita il TTS automatico"),
];

export async function handleTTSCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const commandName = interaction.commandName;
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;

  try {
    switch (commandName) {
      case "leggi": {
        const text = interaction.options.getString("testo", true);
        await interaction.deferReply({ ephemeral: true });
        await playText(member, text, "it");
        await interaction.editReply("🎤 Testo in riproduzione!");
        break;
      }

      case "stop-tts": {
        stopTTS(guildId);
        await interaction.reply({
          content: "⏹️ TTS fermato e disconnesso dal canale vocale.",
          ephemeral: true,
        });
        break;
      }

      case "canale-tts": {
        const channel = interaction.options.getChannel("canale");
        const currentConfig = getTTSConfig(guildId) || {
          guildId,
          guildName: interaction.guild?.name || "Unknown",
          ttsEnabled: false,
          ttsLanguage: "it",
        };

        setTTSConfig({
          ...currentConfig,
          ttsSourceChannelId: channel?.id,
        });

        if (channel) {
          await interaction.reply({
            content: `✅ Canale TTS impostato su <#${channel.id}>!`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "✅ Canale TTS rimosso.",
            ephemeral: true,
          });
        }
        break;
      }

      case "abilita-tts": {
        const currentConfig = getTTSConfig(guildId) || {
          guildId,
          guildName: interaction.guild?.name || "Unknown",
          ttsSourceChannelId: undefined,
          ttsLanguage: "it",
        };

        if (!currentConfig.ttsSourceChannelId) {
          await interaction.reply({
            content: "❌ Devi prima impostare un canale con `/canale-tts`!",
            ephemeral: true,
          });
          return;
        }

        setTTSConfig({
          ...currentConfig,
          ttsEnabled: true,
        });

        await interaction.reply({
          content: "✅ TTS automatico abilitato!",
          ephemeral: true,
        });
        break;
      }

      case "disabilita-tts": {
        const currentConfig = getTTSConfig(guildId) || {
          guildId,
          guildName: interaction.guild?.name || "Unknown",
          ttsSourceChannelId: undefined,
          ttsLanguage: "it",
        };

        setTTSConfig({
          ...currentConfig,
          ttsEnabled: false,
        });

        await interaction.reply({
          content: "❌ TTS automatico disabilitato.",
          ephemeral: true,
        });
        break;
      }
    }
  } catch (err) {
    logger.error({ err, commandName, guildId }, "Errore nel comando TTS");
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Si è verificato un errore durante l'esecuzione del comando.",
        ephemeral: true,
      });
    } else if (interaction.deferred) {
      await interaction.editReply(
        "❌ Si è verificato un errore durante l'esecuzione del comando."
      );
    }
  }
}
