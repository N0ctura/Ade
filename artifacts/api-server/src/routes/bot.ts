import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig } from "../bot/storage.js";

const router = Router();

// ── In-memory log store ───────────────────────────────────────────────────────

let botLogs: Array<{ timestamp: string; type: string; message: string }> = [
  {
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Dashboard API avviata correttamente.",
  },
];

let deletedModifiedLogs: Array<{
  id: string;
  timestamp: string;
  type: "deleted" | "modified";
  author: { username: string; avatar: string; isBot: boolean };
  channel: string;
  oldContent?: string;
  newContent?: string;
  deletedContent?: string;
}> = [];

// ── Discord OAuth config ──────────────────────────────────────────────────────

/**
 * GET /api/config/discord
 * Returns Discord OAuth client ID and redirect URI so the React SPA can
 * build the authorization URL at runtime without baking env vars into the
 * static bundle.
 */
router.get("/config/discord", (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI ||
    "https://ade-production-d78d.up.railway.app/api/auth/discord/callback";

  if (!clientId) {
    logger.error("GET /api/config/discord called but DISCORD_CLIENT_ID is missing");
    return res.status(503).json({
      error: "Discord OAuth is not configured on this server",
    });
  }

  res.json({ clientId, redirectUri });
});

// ── Bot status ────────────────────────────────────────────────────────────────

/**
 * GET /api/bot/status
 * Returns bot status metrics and recent console logs.
 */
router.get("/bot/status", (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const guildCount = (config.welcomeLeaveConfigs || []).length;

    res.json({
      online: true,
      platform: "Railway",
      uptime: "In esecuzione",
      guildsCount: guildCount,
      membersCount: 0,
      ping: "---",
      logs: botLogs,
      repoUrl: "https://github.com/N0ctura/Ade",
    });
  } catch (err) {
    logger.error({ err }, "Error fetching bot status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot config ────────────────────────────────────────────────────────────────

const DEFAULT_WELCOME_CARD = {
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
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
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
      borderRadius: 50,
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
      textAlign: "center",
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
      textAlign: "center",
    },
  ],
};

const DEFAULT_LEAVE_CARD = {
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
      url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80",
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
      borderRadius: 50,
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
      textAlign: "center",
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
      textAlign: "center",
    },
  ],
};

/**
 * GET /api/bot/config
 * Returns the full module configuration for the dashboard.
 */
router.get("/bot/config", (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const guilds = config.welcomeLeaveConfigs || [];
    const firstGuild = guilds[0];
    const ttsConfigs = config.ttsConfigs || [];
    const firstTTS = ttsConfigs[0];
    const scheduledMessages = (config.scheduledMessages || []).map((m) => ({
      id: m.id,
      channelId: m.channelId,
      message: m.message,
      isRecurring: m.isRecurring,
      recurrenceInterval: m.recurrenceInterval || "daily",
      enabled: m.enabled,
    }));

    res.json({
      welcome: firstGuild
        ? {
            enabled: firstGuild.welcomeEnabled ?? true,
            channelId: firstGuild.welcomeChannelId || "",
            message: firstGuild.welcomeMessage || "Benvenuto {user}!",
            card: firstGuild.welcomeCard || DEFAULT_WELCOME_CARD,
          }
        : {
            enabled: true,
            channelId: "",
            message: "Benvenuto {user}!",
            card: DEFAULT_WELCOME_CARD,
          },
      leave: firstGuild
        ? {
            enabled: firstGuild.leaveEnabled ?? true,
            channelId: firstGuild.leaveChannelId || "",
            message: firstGuild.leaveMessage || "Arrivederci {username}!",
            card: firstGuild.leaveCard || DEFAULT_LEAVE_CARD,
          }
        : {
            enabled: true,
            channelId: "",
            message: "Arrivederci {username}!",
            card: DEFAULT_LEAVE_CARD,
          },
      autoRole: firstGuild
        ? {
            enabled: firstGuild.autoroleEnabled ?? false,
            roleIds: firstGuild.autoroleRoleIds || [],
            roles: [],
          }
        : { enabled: false, roleIds: [], roles: [] },
      tts: firstTTS
        ? {
            enabled: firstTTS.ttsEnabled ?? false,
            sourceChannelId: firstTTS.ttsSourceChannelId || "",
            voiceChannelId: firstTTS.ttsVoiceChannelId || "",
            language: firstTTS.ttsLanguage || "it",
            prefixes: firstTTS.ttsPrefixes || [",", ";", "!"],
          }
        : {
            enabled: false,
            sourceChannelId: "",
            voiceChannelId: "",
            language: "it",
            prefixes: [",", ";", "!"],
          },
      scheduledMessages,
      logsConfig: {
        enabled: false,
        channelId: "",
        interceptApps: true,
        interceptUsers: true,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error fetching bot config");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/bot/config/:section
 * Saves a specific module section of the bot configuration.
 */
router.post("/bot/config/:section", (req: Request, res: Response) => {
  try {
    const { section } = req.params;
    const config = loadConfig();
    let welcomeLeaveConfigs = config.welcomeLeaveConfigs || [];

    if (welcomeLeaveConfigs.length === 0) {
      welcomeLeaveConfigs.push({
        guildId: "default",
        guildName: "Server Principale",
        welcomeCard: DEFAULT_WELCOME_CARD as any,
        leaveCard: DEFAULT_LEAVE_CARD as any,
      });
    }

    const guildConfig = welcomeLeaveConfigs[0]!;

    if (section === "welcome") {
      welcomeLeaveConfigs[0] = {
        ...guildConfig,
        welcomeEnabled: req.body.enabled,
        welcomeChannelId: req.body.channelId,
        welcomeMessage: req.body.message,
        welcomeCard: req.body.card || guildConfig.welcomeCard,
      };
      saveConfig({ ...config, welcomeLeaveConfigs });
      botLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Configurazione welcome aggiornata via Dashboard.",
      });
      res.json({ success: true, config: welcomeLeaveConfigs[0] });
    } else if (section === "leave") {
      welcomeLeaveConfigs[0] = {
        ...guildConfig,
        leaveEnabled: req.body.enabled,
        leaveChannelId: req.body.channelId,
        leaveMessage: req.body.message,
        leaveCard: req.body.card || guildConfig.leaveCard,
      };
      saveConfig({ ...config, welcomeLeaveConfigs });
      botLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Configurazione leave aggiornata via Dashboard.",
      });
      res.json({ success: true, config: welcomeLeaveConfigs[0] });
    } else if (section === "autoRole") {
      welcomeLeaveConfigs[0] = {
        ...guildConfig,
        autoroleEnabled: req.body.enabled,
        autoroleRoleIds: req.body.roleIds,
      };
      saveConfig({ ...config, welcomeLeaveConfigs });
      botLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Configurazione autoRole aggiornata via Dashboard.",
      });
      res.json({ success: true, config: welcomeLeaveConfigs[0] });
    } else if (section === "tts") {
      const ttsConfigs = config.ttsConfigs || [];
      const ttsIndex = ttsConfigs.length > 0 ? 0 : -1;
      const newTTS = {
        guildId: guildConfig.guildId,
        guildName: guildConfig.guildName,
        ttsEnabled: req.body.enabled,
        ttsSourceChannelId: req.body.sourceChannelId,
        ttsVoiceChannelId: req.body.voiceChannelId,
        ttsLanguage: req.body.language || "it",
        ttsPrefixes: req.body.prefixes || [",", ";", "!"],
      };
      if (ttsIndex !== -1) {
        ttsConfigs[0] = newTTS;
      } else {
        ttsConfigs.push(newTTS);
      }
      saveConfig({ ...config, ttsConfigs });
      botLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Configurazione TTS aggiornata via Dashboard.",
      });
      res.json({ success: true, config: newTTS });
    } else if (section === "scheduledMessages") {
      // req.body is the full array
      const messages = Array.isArray(req.body) ? req.body : [];
      const scheduledMessages = messages.map((m: any) => ({
        id: m.id || Date.now().toString(),
        guildId: guildConfig.guildId,
        channelId: m.channelId,
        message: m.message,
        isRecurring: m.isRecurring ?? true,
        recurrenceInterval: m.recurrenceInterval || "daily",
        scheduledTime: new Date().toISOString(),
        enabled: m.enabled ?? true,
        createdAt: new Date().toISOString(),
      }));
      saveConfig({ ...config, scheduledMessages });
      botLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Messaggi programmati aggiornati via Dashboard.",
      });
      res.json({
        success: true,
        config: messages,
      });
    } else if (section === "logsConfig") {
      botLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Configurazione log aggiornata via Dashboard.",
      });
      res.json({ success: true, config: req.body });
    } else {
      res.status(400).json({ error: `Unknown section: ${section}` });
    }
  } catch (err) {
    logger.error({ err }, "Error saving bot config section");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Logs ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/bot/logs/deleted-modified
 * Returns the list of intercepted deleted/modified message logs.
 */
router.get("/bot/logs/deleted-modified", (req: Request, res: Response) => {
  res.json(deletedModifiedLogs);
});

/**
 * POST /api/bot/logs/deleted-modified/simulate
 * Simulates a deleted or modified message event for testing.
 */
router.post(
  "/bot/logs/deleted-modified/simulate",
  (req: Request, res: Response) => {
    const isDeleted = Math.random() > 0.5;
    const sampleMessages = [
      "Ciao a tutti! Come state?",
      "Qualcuno vuole giocare stasera?",
      "Ho visto un film bellissimo ieri sera",
      "Ricordatevi della riunione domani",
      "Ottimo lavoro a tutti!",
    ];
    const randomMsg =
      sampleMessages[Math.floor(Math.random() * sampleMessages.length)]!;
    const channels = [
      "112233445566778899",
      "112233445566778805",
      "112233445566778810",
    ];
    const randomChannel =
      channels[Math.floor(Math.random() * channels.length)]!;

    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: (isDeleted ? "deleted" : "modified") as "deleted" | "modified",
      author: {
        username: ["N0ctura", "R0ck", "AdeBot", "Utente123"][
          Math.floor(Math.random() * 4)
        ]!,
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        isBot: false,
      },
      channel: randomChannel,
      ...(isDeleted
        ? { deletedContent: randomMsg }
        : {
            oldContent: randomMsg,
            newContent: randomMsg + " (modificato)",
          }),
    };

    deletedModifiedLogs.unshift(newLog);

    botLogs.unshift({
      timestamp: new Date().toISOString(),
      type: "warn",
      message: `Evento simulato: messaggio ${isDeleted ? "eliminato" : "modificato"} da ${newLog.author.username}`,
    });

    res.json({ success: true, log: newLog, logs: deletedModifiedLogs });
  }
);

/**
 * POST /api/bot/logs/deleted-modified/clear
 * Clears all intercepted deleted/modified message logs.
 */
router.post(
  "/bot/logs/deleted-modified/clear",
  (req: Request, res: Response) => {
    deletedModifiedLogs = [];
    botLogs.unshift({
      timestamp: new Date().toISOString(),
      type: "info",
      message: "Log messaggi eliminati/modificati svuotati dall'utente.",
    });
    res.json({ success: true, logs: deletedModifiedLogs });
  }
);

/**
 * POST /api/bot/logs/clear
 * Clears the console log entries.
 */
router.post("/bot/logs/clear", (req: Request, res: Response) => {
  botLogs = [
    {
      timestamp: new Date().toISOString(),
      type: "info",
      message: "Log della console ripuliti dall'utente.",
    },
  ];
  res.json({ success: true, logs: botLogs });
});

export default router;
