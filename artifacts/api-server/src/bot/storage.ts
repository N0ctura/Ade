import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");

export interface ActivePoll {
  channelId: string;
  introMessageId: string;
  messageIds: string[];
  questCount: number;
  questLabels: string[];
  createdAt: string;
  closesAt?: string;
  /** userId → quest index (0-based) — populated by select-menu votes */
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

export interface BotConfig {
  pollChannelName: string | null;
  notifyChannelNames: string[];
  pollDurationHours?: number;
  pingRoleName?: string;
  clanId?: string;
  activePoll?: ActivePoll;
  messages?: Partial<BotMessages>;
}

const DEFAULT_CONFIG: BotConfig = {
  pollChannelName: null,
  notifyChannelNames: [],
};

export function loadConfig(): BotConfig {
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as BotConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: BotConfig): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getMessages(config: BotConfig): BotMessages {
  return { ...DEFAULT_MESSAGES, ...config.messages };
}
