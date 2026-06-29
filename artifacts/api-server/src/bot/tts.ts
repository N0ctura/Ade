import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  VoiceConnection,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { GuildMember, TextChannel, VoiceChannel, Client, VoiceState } from "discord.js";
import { logger } from "../lib/logger.js";
import gTTS from "gtts";
import { Readable } from "node:stream";

// Map per tenere traccia delle connessioni vocali per ogni guild
const connections: Map<string, VoiceConnection> = new Map();
const players: Map<string, AudioPlayer> = new Map();
const queues: Map<string, string[]> = new Map();
const isPlaying: Map<string, boolean> = new Map();
const activeVoiceChannels: Map<string, string> = new Map(); // guildId -> voiceChannelId

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
      // Creiamo un file temporaneo in memoria
      const chunks: Buffer[] = [];
      const gtts = new gTTS(text, lang);

      gtts.on('data', (chunk) => {
        chunks.push(chunk);
      });

      gtts.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const stream = Readable.from(buffer);
        resolve(stream);
      });

      gtts.on('error', (err) => {
        logger.error({ err, text }, "Errore nella generazione audio TTS");
        reject(err);
      });

      gtts.save(); // Avvia la generazione
    } catch (err) {
      logger.error({ err, text }, "Errore nella funzione textToMp3Stream");
      reject(err);
    }
  });
}

/**
 * Riproduce un testo nel canale vocale specificato
 */
export async function playTextInChannel(
  guildId: string,
  voiceChannelId: string,
  text: string,
  lang: string = "it",
  client?: Client
): Promise<void> {
  if (!client) {
    logger.error({ guildId }, "TTS: client Discord non disponibile");
    return;
  }
  
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.warn({ guildId }, "TTS: guild non trovata");
    return;
  }
  
  const voiceChannel = guild.channels.cache.get(voiceChannelId) as VoiceChannel;
  if (!voiceChannel) {
    logger.warn({ guildId, voiceChannelId }, "TTS: canale vocale non trovato");
    return;
  }

  logger.info({ guildId, channelId: voiceChannel.id, text }, "TTS: avvio riproduzione");

  // Ottieni o crea la connessione vocale
  let connection = connections.get(guildId);
  if (!connection) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // Attendi che la connessione sia pronta
    connection.on(VoiceConnectionStatus.Ready, () => {
      logger.info({ guildId }, "TTS: connessione vocale pronta");
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      logger.info({ guildId }, "TTS: connessione vocale disconnessa");
      connections.delete(guildId);
      activeVoiceChannels.delete(guildId);
    });

    connections.set(guildId, connection);
    activeVoiceChannels.set(guildId, voiceChannelId);
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
      logger.info({ guildId }, "TTS: riproduzione terminata (idle)");
      isPlaying.set(guildId, false);
      const queue = queues.get(guildId) || [];
      if (queue.length > 0) {
        const nextText = queue.shift()!;
        queues.set(guildId, queue);
        await playFromQueue(guildId, nextText, lang);
      }
    });

    // Log errori player
    player.on('error', error => {
      logger.error({ error, guildId }, 'TTS: errore nel player audio');
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
    
    // Genera l'audio
    const mp3Stream = await textToMp3Stream(text, lang);
    logger.debug({ guildId, text }, "TTS: stream audio generato");
    
    // Crea la risorsa audio
    const resource = createAudioResource(mp3Stream, {
      inlineVolume: true,
    });
    
    // Ottieni il player
    const player = players.get(guildId);
    if (!player) {
      logger.error({ guildId }, "TTS: nessun player disponibile");
      isPlaying.set(guildId, false);
      return;
    }
    
    // Riproduci
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
    activeVoiceChannels.delete(guildId);
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
 * Gestisce l'arrivo di un nuovo messaggio per il TTS automatico
 */
export async function handleMessageForTTS(message: {
  guildId: string;
  channelId: string;
  content: string;
  member: GuildMember;
  client: Client;
}): Promise<void> {
  // Solo messaggi che iniziano con !
  if (!message.content.startsWith("!")) {
    return;
  }

  // Rimuovi il prefisso
  const textToSpeak = message.content.slice(1).trim();
  if (!textToSpeak) {
    return;
  }

  // Controlla se l'utente è in un canale vocale
  let voiceChannelId = message.member.voice.channelId;
  
  // Se l'utente non è in un canale vocale, controlla se il bot è già in uno
  if (!voiceChannelId) {
    voiceChannelId = activeVoiceChannels.get(message.guildId);
  }

  if (!voiceChannelId) {
    logger.warn({ guildId: message.guildId, userId: message.member.id }, "TTS: nessun canale vocale disponibile");
    return;
  }

  // Pulisci il nome utente dalle emoji
  const cleanUsername = removeEmojis(message.member.displayName || message.member.user.username);

  // Formatta il testo
  const fullText = `${cleanUsername} dice: ${textToSpeak}`;

  logger.debug({ guildId: message.guildId, text: fullText }, "TTS: nuovo messaggio da leggere");
  
  await playTextInChannel(
    message.guildId,
    voiceChannelId,
    fullText,
    "it",
    message.client
  );
}

/**
 * Gestisce i cambi di stato vocale (utenti che entrano/escono da canali vocali)
 */
export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  // Se l'utente è il bot, disconnettiamo se rimane solo
  if (newState.member?.user.id === newState.client.user?.id) {
    if (!newState.channelId && oldState.channelId) {
      // Bot disconnesso
      stopTTS(newState.guild.id);
    }
    return;
  }
}
