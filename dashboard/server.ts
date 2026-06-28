import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dns from "dns";
import fs from "fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Enable dns mapping if needed
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Storage setup
const DATA_DIR = process.env["DATA_DIR"] ?? path.join(__dirname, "../data");
const CONFIG_FILE = path.join(DATA_DIR, "bot-config.json");

interface CardLayer {
  id: string;
  type: "background" | "image" | "avatar" | "text";
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  text?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;
  textAlign?: "left" | "center" | "right";
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
}

interface CardConfig {
  width: number;
  height: number;
  layers: CardLayer[];
}

interface GuildWelcomeLeaveConfig {
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

interface BotConfig {
  welcomeLeaveConfigs?: GuildWelcomeLeaveConfig[];
}

const DEFAULT_WELCOME_CARD: CardConfig = {
  width: 800,
  height: 400,
  layers: [
    {
      id: "bg",
      type: "background",
      visible: true,
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "avatar",
      type: "avatar",
      visible: true,
      x: 320,
      y: 50,
      width: 160,
      height: 160,
      borderWidth: 4,
      borderColor: "#5865F2",
      borderRadius: 50
    },
    {
      id: "title",
      type: "text",
      visible: true,
      x: 400,
      y: 250,
      width: 800,
      height: 50,
      text: "BENVENUTO {username}!",
      fontSize: 32,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center"
    },
    {
      id: "subtitle",
      type: "text",
      visible: true,
      x: 400,
      y: 310,
      width: 800,
      height: 400,
      text: "Sei il membro #{memberCount} di {guild}",
      fontSize: 20,
      fontWeight: "normal",
      color: "#b9bbbe",
      textAlign: "center"
    }
  ]
};

const DEFAULT_LEAVE_CARD: CardConfig = {
  width: 800,
  height: 400,
  layers: [
    {
      id: "bg",
      type: "background",
      visible: true,
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80"
    },
    {
      id: "avatar",
      type: "avatar",
      visible: true,
      x: 320,
      y: 50,
      width: 160,
      height: 160,
      borderWidth: 4,
      borderColor: "#ED4245",
      borderRadius: 50
    },
    {
      id: "title",
      type: "text",
      visible: true,
      x: 400,
      y: 250,
      width: 800,
      height: 50,
      text: "ARRIVEDERCI {username}!",
      fontSize: 32,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center"
    },
    {
      id: "subtitle",
      type: "text",
      visible: true,
      x: 400,
      y: 310,
      width: 800,
      height: 400,
      text: "Ci mancherai tantissimo!",
      fontSize: 20,
      fontWeight: "normal",
      color: "#f43f5e",
      textAlign: "center"
    }
  ]
};

let cache: BotConfig = {};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConfig(): BotConfig {
  ensureDataDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, "utf8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Errore nel caricamento della config:", e);
    }
  }
  return {};
}

function saveConfig(config: BotConfig) {
  ensureDataDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    cache = config;
  } catch (e) {
    console.error("Errore nel salvataggio della config:", e);
  }
}

cache = loadConfig();

// Mock logs (for now)
let botLogs = [
  { timestamp: new Date().toISOString(), type: "info", message: "Dashboard avviata correttamente." }
];

// GitHub Proxy (still useful)
app.get("/api/github/contents", async (req, res) => {
  const repoPath = (req.query.path as string) || "";
  try {
    const url = `https://api.github.com/repos/N0ctura/Ade/contents/${repoPath}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Ade-Bot-Dashboard-Proxy",
        "Accept": "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) throw new Error(`GitHub API returned status ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Error proxying GitHub contents:", error.message);
    res.status(500).json({ error: "Impossibile recuperare i contenuti dal repository" });
  }
});

app.get("/api/github/file", async (req, res) => {
  const filePath = (req.query.path as string) || "";
  if (!filePath) {
    return res.status(400).json({ error: "Path del file mancante" });
  }
  try {
    const url = `https://raw.githubusercontent.com/N0ctura/Ade/main/${filePath}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Ade-Bot-Dashboard-Proxy" }
    });
    if (!response.ok) throw new Error(`GitHub returned status ${response.status}`);
    const text = await response.text();
    res.send(text);
  } catch (error: any) {
    console.error("Error proxying GitHub raw file:", error.message);
    res.status(500).json({ error: "Impossibile leggere il file dal repository" });
  }
});

// Status endpoint
app.get("/api/bot/status", (req, res) => {
  const config = loadConfig();
  const guildCount = (config.welcomeLeaveConfigs || []).length;
  res.json({
    online: true,
    platform: "Railway",
    uptime: "In esecuzione",
    guildsCount: guildCount || 0,
    membersCount: 0,
    ping: "---",
    logs: botLogs,
    repoUrl: "https://github.com/N0ctura/Ade"
  });
});

// Config CRUD
app.get("/api/discord/config", (req, res) => {
  const config = loadConfig();
  res.json(config.welcomeLeaveConfigs || []);
});

app.post("/api/discord/config", (req, res) => {
  const config = loadConfig();
  const welcomeLeaveConfigs = config.welcomeLeaveConfigs || [];
  const { guildId, guildName, ...rest } = req.body;

  if (!guildId || !guildName) {
    return res.status(400).json({ error: "Guild ID and name are required" });
  }

  const existingIndex = welcomeLeaveConfigs.findIndex((c: any) => c.guildId === guildId);
  const newConfig: GuildWelcomeLeaveConfig = {
    guildId,
    guildName,
    welcomeCard: DEFAULT_WELCOME_CARD,
    leaveCard: DEFAULT_LEAVE_CARD,
    ...rest
  };

  if (existingIndex !== -1) {
    welcomeLeaveConfigs[existingIndex] = { ...welcomeLeaveConfigs[existingIndex], ...newConfig };
  } else {
    welcomeLeaveConfigs.push(newConfig);
  }

  saveConfig({ ...config, welcomeLeaveConfigs });
  res.json({ success: true, config: welcomeLeaveConfigs[existingIndex !== -1 ? existingIndex : welcomeLeaveConfigs.length - 1] });
});

// Per semplicità, facciamo endpoint per ogni sezione
app.get("/api/bot/config", (req, res) => {
  const config = loadConfig();
  const guilds = config.welcomeLeaveConfigs || [];
  // Per adesso restituiamo il primo server o un default
  const firstGuild = guilds[0];
  res.json({
    welcome: firstGuild ? {
      enabled: firstGuild.welcomeEnabled ?? true,
      channelId: firstGuild.welcomeChannelId || "",
      message: firstGuild.welcomeMessage || "Benvenuto {user}!",
      card: firstGuild.welcomeCard || DEFAULT_WELCOME_CARD
    } : {
      enabled: true,
      channelId: "",
      message: "Benvenuto {user}!",
      card: DEFAULT_WELCOME_CARD
    },
    leave: firstGuild ? {
      enabled: firstGuild.leaveEnabled ?? true,
      channelId: firstGuild.leaveChannelId || "",
      message: firstGuild.leaveMessage || "Arrivederci {username}!",
      card: firstGuild.leaveCard || DEFAULT_LEAVE_CARD
    } : {
      enabled: true,
      channelId: "",
      message: "Arrivederci {username}!",
      card: DEFAULT_LEAVE_CARD
    },
    autoRole: firstGuild ? {
      enabled: firstGuild.autoroleEnabled ?? false,
      roleIds: firstGuild.autoroleRoleIds || [],
      roles: []
    } : { enabled: false, roleIds: [], roles: [] },
    tts: { enabled: false, sourceChannelId: "", voiceChannelId: "", language: "it", prefixes: [",", ";", "!"] },
    scheduledMessages: [],
    logsConfig: { enabled: false, channelId: "", interceptApps: true, interceptUsers: true }
  });
});

app.post("/api/bot/config/:section", (req, res) => {
  const section = req.params.section;
  const config = loadConfig();
  let welcomeLeaveConfigs = config.welcomeLeaveConfigs || [];
  
  if (welcomeLeaveConfigs.length === 0) {
    welcomeLeaveConfigs.push({
      guildId: "default",
      guildName: "Server Principale",
      welcomeCard: DEFAULT_WELCOME_CARD,
      leaveCard: DEFAULT_LEAVE_CARD
    });
  }

  const guildConfig = welcomeLeaveConfigs[0];

  if (section === "welcome") {
    welcomeLeaveConfigs[0] = { ...guildConfig, welcomeEnabled: req.body.enabled, welcomeChannelId: req.body.channelId, welcomeMessage: req.body.message, welcomeCard: req.body.card || guildConfig.welcomeCard };
  } else if (section === "leave") {
    welcomeLeaveConfigs[0] = { ...guildConfig, leaveEnabled: req.body.enabled, leaveChannelId: req.body.channelId, leaveMessage: req.body.message, leaveCard: req.body.card || guildConfig.leaveCard };
  } else if (section === "autorole") {
    welcomeLeaveConfigs[0] = { ...guildConfig, autoroleEnabled: req.body.enabled, autoroleRoleIds: req.body.roleIds };
  }

  saveConfig({ ...config, welcomeLeaveConfigs });
  
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: `Configurazione ${section} aggiornata via Dashboard.`
  });

  if (section === "welcome") {
    res.json({ success: true, config: welcomeLeaveConfigs[0] });
  } else if (section === "leave") {
    res.json({ success: true, config: welcomeLeaveConfigs[0] });
  } else if (section === "autorole") {
    res.json({ success: true, config: welcomeLeaveConfigs[0] });
  }
});

// Clear logs
app.post("/api/bot/logs/clear", (req, res) => {
  botLogs = [{ timestamp: new Date().toISOString(), type: "info", message: "Log della console ripuliti dall'utente." }];
  res.json({ success: true, logs: botLogs });
});

// Image upload
app.post("/api/discord/upload-image", (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image data is required" });
    }
    res.json({ success: true, imageUrl: image, filename: filename || "image.png" });
  } catch (err) {
    console.error("Error uploading image:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
