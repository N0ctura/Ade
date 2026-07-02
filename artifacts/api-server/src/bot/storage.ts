import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Priorità: DATA_DIR → RAILWAY_VOLUME_MOUNT_PATH (letto automaticamente) → path locale
const DATA_DIR =
  process.env["DATA_DIR"] ??
  process.env["RAILWAY_VOLUME_MOUNT_PATH"] ??
  join(__dirname, "../../data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");

// ── Tipi ────────────────────────────────────────────────────────────────────

export interface ActivePoll {
  channelId: string;
  introMessageId: string;
  messageIds: string[];
  questCount: number;
  questLabels: string[];
  /** URL immagine promo per ogni missione (stesso ordine di questLabels) */
  questImageUrls?: string[];
  createdAt: string;
  closesAt?: string;
  /** userId → quest index (0-based), o -1 per rimescolo */
  votes?: { [userId: string]: number };
}

export interface BotMessages {
  missioneVinta: string;
  nessunVoto: string;
  pareggio: string;
  rimescolo: string;
}

export const DEFAULT_MESSAGES: BotMessages = {
  missioneVinta:
    'La missione di questa settimana è **"{missione}"** — se non lo avete già fatto potete andare a comunicare la vostra partecipazione nel tempio! 🏛️',
  nessunVoto:
    "Non ci sono voti registrati — decidete insieme al clan quale missione fare!",
  pareggio:
    "**Pareggio!** Le missioni {missioni} hanno la stessa quantità di voti — decidete insieme al clan quale fare! 🤝",
  rimescolo:
    "🔀 **Le missioni sono state rimescolate!** Nuove missioni disponibili nel canale sondaggi.",
};

/** Un livello soglia XP con i relativi ruoli Discord (uno per tempio). */
export interface ThresholdTier {
  name: string;
  xpRequired: number;
  roleIds: string[];
}

export const DEFAULT_THRESHOLD_TIERS: ThresholdTier[] = [
  { name: "Semidio", xpRequired: 6_000_000, roleIds: ["1218697126926749737", "1218900052588630026", "1218900180628279326", "1218900125775302696"] },
  { name: "Gigante/Ninfa", xpRequired: 2_000_000, roleIds: ["1218697050544148480", "1218696998249562182", "1218900685224153129", "1218900357225386034", "1218900822360985671", "1218900471364845619", "1218900756942426233", "1218900418197979286"] },
  { name: "Eroe", xpRequired: 1_000_000, roleIds: ["1218696854276018380", "1218899640729075803", "1218899814914199562", "1218899758236565627"] },
  { name: "Polemarchos", xpRequired: 700_000, roleIds: ["1128736377664720896", "1128819275931598938", "1128732867447508992", "1128813555416826017"] },
  { name: "Combattente", xpRequired: 500_000, roleIds: ["1128735744995885116", "1128819152119943239", "1128732753651839046", "1128813312654704742"] },
  { name: "Misthios", xpRequired: 350_000, roleIds: ["1128735127439151154", "1128819040006176840", "1128732635947094191", "1128812621144002580"] },
  { name: "Profeta", xpRequired: 250_000, roleIds: ["1128734867971133491", "1128818907696873593", "1128732549011746967", "1128812135821094932"] },
  { name: "Oracolo", xpRequired: 150_000, roleIds: ["1128734659778465832", "1128818676016087072", "1128732407776936076", "1128811906090676344"] },
  { name: "Sacerdote", xpRequired: 50_000, roleIds: ["1128734192327471144", "1128818545116065903", "1128732279435436102", "1128811659016810546"] },
];

export const THRESHOLD_ROLE_ID_SET = new Set<string>(
  DEFAULT_THRESHOLD_TIERS.flatMap((t) => t.roleIds)
);

export interface CardLayer {
  id: string;
  type: 'background' | 'image' | 'avatar' | 'text';
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  // For image/background
  url?: string;
  // For text
  text?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  // For avatar
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number; // percentage 0-100
  // For grayscale (leave card)
  grayscale?: boolean;
}

export interface CardConfig {
  width: number;
  height: number;
  layers: CardLayer[];
}

export interface GuildWelcomeLeaveConfig {
  guildId: string;
  guildName: string;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  welcomeEnabled?: boolean;
  welcomeCard?: CardConfig;
  leaveChannelId?: string;
  leaveMessage?: string;
  leaveEnabled?: boolean;
  leaveCard?: CardConfig;
  autoroleEnabled?: boolean;
  autoroleRoleIds?: string[];
}

export interface GuildTTSConfig {
  guildId: string;
  guildName: string;
  ttsSourceChannelId?: string; // Canale testuale da monitorare
  ttsVoiceChannelId?: string; // Canale vocale dove il bot deve entrare
  ttsEnabled?: boolean;
  ttsLanguage?: string; // Default: 'it'
  ttsPrefixes?: string[]; // Prefissi che attivano il TTS (es: [".", ",", ";", "!"])
}

export interface AutoResponseConfig {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  isRegex: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface ScheduledMessageConfig {
  id: string;
  guildId: string;
  channelId: string;
  message: string;
  isRecurring: boolean;
  recurrenceInterval?: 'daily' | 'weekly' | 'monthly';
  scheduledTime: string; // ISO string per one-time, or cron-like for recurring
  lastSent?: string;
  enabled: boolean;
  createdAt: string;
}

export interface DeletedModifiedLog {
  id: string;
  guildId: string;
  timestamp: string;
  type: "deleted" | "modified";
  author: {
    id: string;
    username: string;
    avatar: string;
    isBot: boolean;
  };
  channelId: string;
  channelName: string;
  oldContent?: string;
  newContent?: string;
  deletedContent?: string;
}

export interface GuildLogsConfig {
  guildId: string;
  guildName: string;
  enabled?: boolean;
  channelId?: string;
  interceptApps?: boolean;
  interceptUsers?: boolean;
}

export interface RoseLobbyParticipant {
  userId: string;
  username: string;
  joinedAt: string;
}

export interface RoseLobby {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  customMessage?: string;
  participants: RoseLobbyParticipant[];
  reserves: RoseLobbyParticipant[];
  removedParticipants: RoseLobbyParticipant[];
  createdAt: string;
}

export interface BotConfig {
  pollChannelName: string | null;
  notifyChannelNames: string[];
  pollDurationHours?: number;
  pingRoleName?: string;
  clanId?: string;
  activePoll?: ActivePoll;
  messages?: Partial<BotMessages>;
  templeRoleNames?: string[];
  leaderRoleNames?: string[];
  thresholdRoleNames?: string[];
  welcomeLeaveConfigs?: GuildWelcomeLeaveConfig[];
  autoResponses?: AutoResponseConfig[];
  scheduledMessages?: ScheduledMessageConfig[];
  ttsConfigs?: GuildTTSConfig[];
  logsConfigs?: GuildLogsConfig[];
  deletedModifiedLogs?: DeletedModifiedLog[];
  roseLobbyChannelId?: string;
  activeRoseLobby?: RoseLobby;
}

const DEFAULT_CONFIG: BotConfig = {
  pollChannelName: null,
  notifyChannelNames: [],
};

// ── Cache in memoria ─────────────────────────────────────────────────────────
// loadConfig() è sincrona — legge sempre dalla cache.
// saveConfig() aggiorna la cache e avvia una scrittura asincrona sul DB.
// initStorage() carica la config da PostgreSQL all'avvio del bot.

let cache: BotConfig = { ...DEFAULT_CONFIG };

// ── PostgreSQL (lazy import per evitare crash se DATABASE_URL non è set) ────

async function dbUpsert(config: BotConfig): Promise<void> {
  try {
    const { db } = await import("@workspace/db");
    const { botConfigTable } = await import("@workspace/db");
    await db
      .insert(botConfigTable)
      .values({ key: "main", data: config as unknown as Record<string, unknown>, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: botConfigTable.key,
        set: { data: config as unknown as Record<string, unknown>, updatedAt: new Date() },
      });
  } catch (err) {
    logger.debug({ err }, "storage: impossibile salvare config su PostgreSQL (DB non configurato)");
  }
}

async function dbEnsureTable(): Promise<void> {
  try {
    const { pool } = await import("@workspace/db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_config (
        key         TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    logger.debug({ err }, "storage: DB non configurato, uso file locale");
  }
}

async function dbLoad(): Promise<BotConfig | null> {
  try {
    const { db, botConfigTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(botConfigTable).where(eq(botConfigTable.key, "main")).limit(1);
    if (rows.length > 0 && rows[0]?.data) {
      return rows[0].data as unknown as BotConfig;
    }
    return null;
  } catch (err) {
    logger.debug({ err }, "storage: DB non configurato, uso file locale");
    return null;
  }
}

// ── File JSON (fallback locale, utile in dev) ─────────────────────────────

function fileLoad(): BotConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as BotConfig;
  } catch {
    return null;
  }
}

function fileSave(config: BotConfig): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    logger.warn({ err }, "storage: impossibile scrivere bot-config.json (non critico)");
  }
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Chiamata UNA SOLA VOLTA all'avvio del bot (prima di client.login).
 * Carica la config da PostgreSQL. Se non trovata, prova il file locale.
 * Popola la cache in memoria.
 */
export async function initStorage(): Promise<void> {
  // Log diagnostico — visibile nei Railway Logs per verificare il percorso usato
  logger.info({
    DATA_DIR,
    CONFIG_FILE,
    RAILWAY_VOLUME_MOUNT_PATH: process.env["RAILWAY_VOLUME_MOUNT_PATH"] ?? "(non impostato)",
    DATA_DIR_ENV: process.env["DATA_DIR"] ?? "(non impostato)",
    fileExists: existsSync(CONFIG_FILE),
  }, "storage: percorso configurazione");

  // Prova PostgreSQL (opzionale — funziona solo se DATABASE_URL è configurato)
  await dbEnsureTable();
  const dbConfig = await dbLoad();
  if (dbConfig) {
    cache = dbConfig;
    logger.info("storage: config caricata da PostgreSQL ✅");
    return;
  }

  const fileConfig = fileLoad();
  if (fileConfig) {
    cache = fileConfig;
    logger.info("storage: config caricata dal file locale (migrazione → PostgreSQL in corso)");
    // Migra subito su DB così i prossimi riavvii usano il DB
    await dbUpsert(cache);
    return;
  }

  cache = { ...DEFAULT_CONFIG };
  logger.info("storage: nessuna config trovata — avvio con valori predefiniti");
}

/** Lettura sincrona dalla cache in memoria. */
export function loadConfig(): BotConfig {
  return cache;
}

/**
 * Aggiorna la cache in memoria e persiste su PostgreSQL + file locale.
 * La scrittura su DB è asincrona (fire-and-forget con log degli errori).
 */
export function saveConfig(config: BotConfig): void {
  cache = config;
  fileSave(config); // backup locale sincrono
  void dbUpsert(config); // persistenza principale asincrona
}

export function getMessages(config: BotConfig): BotMessages {
  return { ...DEFAULT_MESSAGES, ...config.messages };
}

export function getDataDir(): string {
  return DATA_DIR;
}
