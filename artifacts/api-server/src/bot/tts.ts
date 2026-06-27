import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  VoiceConnection,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import { GuildMember, TextChannel, VoiceChannel, Client } from "discord.js";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig, GuildTTSConfig } from "./storage.js";
import gTTS from "gtts";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Map per tenere traccia delle connessioni vocali per ogni guild
const connections: Map<string, VoiceConnection> = new Map();
const players: Map<string, AudioPlayer> = new Map();
const queues: Map<string, string[]> = new Map();
const isPlaying: Map<string, boolean> = new Map();

/**
 * Rimuove le emoji da una stringa
 */
function removeEmojis(str: string): string {
  const emojiRegex =
    /[\p{Emoji}\p{Emoji_Component}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu;
  return str.replace(emojiRegex, "").trim();
}

/**
 * Converte un testo in audio MP3 usando gTTS in italiano
 */
async function textToMp3Stream(text: string, lang: string = "it"): Promise<Readable> {
  return new Promise((resolve, reject) => {
    try {
      const gtts = new gTTS(text, lang);
      const chunks: Buffer[] = [];
      gtts.on("data", (chunk: Buffer) => chunks.push(chunk));
      gtts.on("end", () => {
        resolve(Readable.from(Buffer.concat(chunks)));
      });
      gtts.on("error", reject);
      gtts.save();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Riproduce un testo nel canale vocale configurato o in quello dell'utente
 */
export async function playText(
  member: GuildMember,
  text: string,
  lang: string = "it",
  forceVoiceChannelId?: string
): Promise<void> {
  const guildId = member.guild.id;

  // Ottieni il canale vocale: prima il configurato, poi quello dell'utente
  let voiceChannel = forceVoiceChannelId
    ? (member.guild.channels.cache.get(forceVoiceChannelId) as VoiceChannel)
    : member.voice.channel;

  if (!voiceChannel) {
    logger.warn({ guildId, userId: member.id }, "TTS: nessun canale vocale disponibile");
    return;
  }

  // Ottieni o crea la connessione vocale
  let connection = connections.get(guildId);
  if (!connection) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: member.guild.voiceAdapterCreator,
    });
    connections.set(guildId, connection);
    logger.info({ guildId, channelId: voiceChannel.id }, "TTS: connessione vocale creata");
  }

  // Ottieni o crea l'audio player
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    players.set(guildId, player);
    connection.subscribe(player);

    // Quando finisce la riproduzione, passa alla prossima in coda
    player.on(AudioPlayerStatus.Idle, async () => {
      isPlaying.set(guildId, false);
      const queue = queues.get(guildId) || [];
      if (queue.length > 0) {
        const nextText = queue.shift()!;
        queues.set(guildId, queue);
        await playFromQueue(guildId, nextText, lang);
      }
    });
  }

  // Aggiungi alla coda se già stiamo suonando
  if (isPlaying.get(guildId)) {
    const queue = queues.get(guildId) || [];
    queue.push(text);
    queues.set(guildId, queue);
    logger.debug({ guildId, text }, "TTS: aggiunto alla coda");
    return;
  }

  await playFromQueue(guildId, text, lang);
}

async function playFromQueue(
  guildId: string,
  text: string,
  lang: string = "it"
): Promise<void> {
  try {
    isPlaying.set(guildId, true);
    const mp3Stream = await textToMp3Stream(text, lang);
    const resource = createAudioResource(mp3Stream);
    const player = players.get(guildId)!;
    player.play(resource);
    logger.info({ guildId, text }, "TTS: riproduzione avviata");
  } catch (err) {
    logger.error({ err, guildId, text }, "TTS: errore durante la riproduzione");
    isPlaying.set(guildId, false);
  }
}

/**
 * Ferma il TTS e disconnette dal canale vocale
 */
export function stopTTS(guildId: string): void {
  const connection = connections.get(guildId);
  if (connection) {
    connection.destroy();
    connections.delete(guildId);
  }
  const player = players.get(guildId);
  if (player) {
    player.stop();
    players.delete(guildId);
  }
  queues.delete(guildId);
  isPlaying.set(guildId, false);
  logger.info({ guildId }, "TTS: fermato e disconnesso");
}

/**
 * Imposta la configurazione TTS per una guild
 */
export function setTTSConfig(config: GuildTTSConfig): void {
  const botConfig = loadConfig();
  const ttsConfigs = botConfig.ttsConfigs || [];
  const existingIndex = ttsConfigs.findIndex((c) => c.guildId === config.guildId);

  if (existingIndex !== -1) {
    ttsConfigs[existingIndex] = config;
  } else {
    ttsConfigs.push(config);
  }

  saveConfig({ ...botConfig, ttsConfigs });
  logger.info({ guildId: config.guildId }, "TTS: configurazione salvata");
}

/**
 * Ottieni la configurazione TTS per una guild
 */
export function getTTSConfig(guildId: string): GuildTTSConfig | undefined {
  const botConfig = loadConfig();
  return botConfig.ttsConfigs?.find((c) => c.guildId === guildId);
}

/**
 * Gestisce l'arrivo di un nuovo messaggio per il TTS automatico
 */
export async function handleMessageForTTS(message: {
  guildId: string;
  channelId: string;
  content: string;
  member: GuildMember;
}): Promise<void> {
  const config = getTTSConfig(message.guildId);
  if (!config?.ttsEnabled || config.ttsSourceChannelId !== message.channelId) {
    return;
  }

  // Non leggere i messaggi del bot stesso
  if (message.member.user.bot) {
    return;
  }

  // Se abbiamo dei prefissi configurati, verifica che il messaggio ne inizi con uno
  let textToSpeak = message.content;
  let hasPrefix = false;

  if (config.ttsPrefixes && config.ttsPrefixes.length > 0) {
    for (const prefix of config.ttsPrefixes) {
      if (message.content.startsWith(prefix)) {
        // Rimuovi il prefisso
        textToSpeak = message.content.slice(prefix.length).trim();
        hasPrefix = true;
        break;
      }
    }
    // Se abbiamo prefissi ma il messaggio non ne ha uno, ignoralo
    if (!hasPrefix) {
      return;
    }
  }

  // Se non c'è testo da leggere, esci
  if (!textToSpeak) {
    return;
  }

  // Pulisci il nome utente dalle emoji
  const cleanUsername = removeEmojis(message.member.displayName || message.member.user.username);

  // Formatta il testo: "[Nome] dice: [Testo]"
  const fullText = `${cleanUsername} dice: ${textToSpeak}`;

  logger.debug({ guildId: message.guildId, text: fullText }, "TTS: nuovo messaggio da leggere");
  await playText(
    message.member,
    fullText,
    config.ttsLanguage || "it",
    config.ttsVoiceChannelId
  );
}
