import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");

export interface ActivePoll {
  channelId: string;
  messageIds: string[];
  questCount: number;
  createdAt: string;
}

export interface BotConfig {
  pollChannelName: string | null;
  notifyChannelNames: string[];
  clanId?: string;
  activePoll?: ActivePoll;
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
