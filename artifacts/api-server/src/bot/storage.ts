import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// DATA_DIR can be overridden by env var — point it to a Railway Volume
// (e.g. DATA_DIR=/data in Railway Variables)
const DATA_DIR = process.env["DATA_DIR"] ?? join(__dirname, "../../data");
const CONFIG_FILE = join(DATA_DIR, "bot-config.json");

export interface ActivePoll {
  channelId: string;
  introMessageId: string;
  messageIds: string[];
  questCount: number;
  questLabels: string[];
  createdAt: string;
  closesAt?: string;
  /** userId → quest index (0-based), or -1 for rimescolo vote */
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
  /** Nome visibile della soglia (es: "Semidio", "Eroe") */
  name: string;
  /** XP richiesti per raggiungere questa soglia */
  xpRequired: number;
  /** ID dei ruoli Discord corrispondenti a questa soglia (uno per tempio) */
  roleIds: string[];
}

/**
 * Soglie XP predefinite del server.
 * Populate dalla lista ruoli fornita dagli admin.
 * NON vengono mai usate nei sondaggi missione.
 */
export const DEFAULT_THRESHOLD_TIERS: ThresholdTier[] = [
  {
    name: "Semidio",
    xpRequired: 6_000_000,
    roleIds: ["1218697126926749737", "1218900052588630026", "1218900180628279326", "1218900125775302696"],
  },
  {
    name: "Gigante/Ninfa",
    xpRequired: 2_000_000,
    roleIds: ["1218697050544148480", "1218696998249562182", "1218900685224153129", "1218900357225386034", "1218900822360985671", "1218900471364845619", "1218900756942426233", "1218900418197979286"],
  },
  {
    name: "Eroe",
    xpRequired: 1_000_000,
    roleIds: ["1218696854276018380", "1218899640729075803", "1218899814914199562", "1218899758236565627"],
  },
  {
    name: "Polemarchos",
    xpRequired: 700_000,
    roleIds: ["1128736377664720896", "1128819275931598938", "1128732867447508992", "1128813555416826017"],
  },
  {
    name: "Combattente",
    xpRequired: 500_000,
    roleIds: ["1128735744995885116", "1128819152119943239", "1128732753651839046", "1128813312654704742"],
  },
  {
    name: "Misthios",
    xpRequired: 350_000,
    roleIds: ["1128735127439151154", "1128819040006176840", "1128732635947094191", "1128812621144002580"],
  },
  {
    name: "Profeta",
    xpRequired: 250_000,
    roleIds: ["1128734867971133491", "1128818907696873593", "1128732549011746967", "1128812135821094932"],
  },
  {
    name: "Oracolo",
    xpRequired: 150_000,
    roleIds: ["1128734659778465832", "1128818676016087072", "1128732407776936076", "1128811906090676344"],
  },
  {
    name: "Sacerdote",
    xpRequired: 50_000,
    roleIds: ["1128734192327471144", "1128818545116065903", "1128732279435436102", "1128811659016810546"],
  },
];

/** Set di tutti gli ID ruolo soglia, per lookup O(1). */
export const THRESHOLD_ROLE_ID_SET = new Set<string>(
  DEFAULT_THRESHOLD_TIERS.flatMap((t) => t.roleIds)
);

export interface BotConfig {
  pollChannelName: string | null;
  notifyChannelNames: string[];
  pollDurationHours?: number;
  pingRoleName?: string;
  clanId?: string;
  activePoll?: ActivePoll;
  messages?: Partial<BotMessages>;
  /**
   * Ruoli tempio: hanno un canale Discord corrispondente.
   * Usati per i riepiloghi voti alla chiusura del sondaggio.
   * Popolati automaticamente da /debug-templi.
   */
  templeRoleNames?: string[];
  /**
   * Ruoli co-capi / admin: non hanno canale corrispondente e non sono soglie note.
   * Archiviati per uso futuro — NON usati nei sondaggi.
   * Popolati automaticamente da /debug-templi.
   */
  leaderRoleNames?: string[];
  /**
   * Ruoli soglia XP: identificati tramite ID noti (DEFAULT_THRESHOLD_TIERS).
   * Archiviati per uso futuro — NON usati nei sondaggi.
   * Popolati automaticamente da /debug-templi.
   */
  thresholdRoleNames?: string[];
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

export function getDataDir(): string {
  return DATA_DIR;
}
