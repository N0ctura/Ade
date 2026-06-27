// @ts-nocheck
import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";
import { loadConfig, saveConfig, type GuildWelcomeLeaveConfig, type AutoResponseConfig, type ScheduledMessageConfig } from "./storage.js";

let discordClient: any = null;

export function setDiscordClient(client: any): void {
  discordClient = client;
}

const router = Router();

/**
 * GET /api/discord/guilds
 * Ritorna lista di tutti i server dove il bot è presente
 */
router.get("/guilds", (req: Request, res: Response) => {
  if (!discordClient) {
    return res.status(503).json({ error: "Discord client not initialized" });
  }

  try {
    const guilds = discordClient.guilds.cache.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL(),
    }));

    res.json(guilds);
  } catch (err) {
    logger.error({ err }, "Error fetching guilds");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/discord/guilds/:guildId/channels
 * Ritorna lista di canali di testo per un server specifico
 */
router.get("/guilds/:guildId/channels", (req: Request, res: Response) => {
  if (!discordClient) {
    return res.status(503).json({ error: "Discord client not initialized" });
  }

  try {
    const { guildId } = req.params;
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const channels = guild.channels.cache
      .filter((channel: any) => channel.isTextBased())
      .map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
      }));

    res.json(channels);
  } catch (err) {
    logger.error({ err }, "Error fetching channels");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/discord/guilds/:guildId
 * Ritorna info detagliate di un server
 */
router.get("/guilds/:guildId", (req: Request, res: Response) => {
  if (!discordClient) {
    return res.status(503).json({ error: "Discord client not initialized" });
  }

  try {
    const { guildId } = req.params;
    const guild = discordClient.guilds.cache.get(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    res.json({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL(),
      channels: guild.channels.cache
        .filter((channel: any) => channel.isTextBased())
        .map((channel: any) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        })),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching guild info");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/discord/config
 * Ritorna tutte le configurazioni welcome/leave
 */
router.get("/config", (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    res.json(config.welcomeLeaveConfigs || []);
  } catch (err) {
    logger.error({ err }, "Error fetching configs");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/discord/config
 * Salva una configurazione welcome/leave
 */
router.post("/config", (req: Request, res: Response) => {
  try {
    const { guildId, guildName, welcomeChannelId, welcomeMessage, welcomeEnabled, leaveChannelId, leaveMessage, leaveEnabled } = req.body;

    if (!guildId || !guildName) {
      return res.status(400).json({ error: "Guild ID and name are required" });
    }

    const config = loadConfig();
    const welcomeLeaveConfigs = config.welcomeLeaveConfigs || [];

    const existingIndex = welcomeLeaveConfigs.findIndex(c => c.guildId === guildId);
    const newConfig: GuildWelcomeLeaveConfig = {
      guildId,
      guildName,
      welcomeChannelId,
      welcomeMessage,
      welcomeEnabled,
      leaveChannelId,
      leaveMessage,
      leaveEnabled,
    };

    if (existingIndex !== -1) {
      welcomeLeaveConfigs[existingIndex] = newConfig;
    } else {
      welcomeLeaveConfigs.push(newConfig);
    }

    saveConfig({ ...config, welcomeLeaveConfigs });
    res.json({ success: true, config: newConfig });
  } catch (err) {
    logger.error({ err }, "Error saving config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── AUTO RESPONSES ───────────────────────────────────────────────────────

/**
 * GET /api/discord/auto-responses/:guildId
 * Ottieni tutte le auto risposte per un server
 */
router.get("/auto-responses/:guildId", (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const config = loadConfig();
    const responses = (config.autoResponses || []).filter(r => r.guildId === guildId);
    res.json(responses);
  } catch (err) {
    logger.error({ err }, "Error fetching auto responses");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/discord/auto-responses
 * Crea/aggiorna un auto risposta
 */
router.post("/auto-responses", (req: Request, res: Response) => {
  try {
    const { id, guildId, trigger, response, isRegex, enabled } = req.body;
    if (!guildId || !trigger || !response) {
      return res.status(400).json({ error: "Guild ID, trigger, and response are required" });
    }

    const config = loadConfig();
    const autoResponses = config.autoResponses || [];

    let newResponse: AutoResponseConfig;

    if (id) {
      const existingIndex = autoResponses.findIndex(r => r.id === id && r.guildId === guildId);
      if (existingIndex !== -1) {
        newResponse = { ...autoResponses[existingIndex], trigger, response, isRegex, enabled };
        autoResponses[existingIndex] = newResponse;
      } else {
        return res.status(404).json({ error: "Auto response not found" });
      }
    } else {
      newResponse = {
        id: Date.now().toString(),
        guildId,
        trigger,
        response,
        isRegex,
        enabled,
        createdAt: new Date().toISOString(),
      };
      autoResponses.push(newResponse);
    }

    saveConfig({ ...config, autoResponses });
    res.json({ success: true, response: newResponse });
  } catch (err) {
    logger.error({ err }, "Error saving auto response");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/discord/auto-responses/:id
 * Elimina un auto risposta
 */
router.delete("/auto-responses/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = loadConfig();
    const autoResponses = (config.autoResponses || []).filter(r => r.id !== id);
    saveConfig({ ...config, autoResponses });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting auto response");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── SCHEDULED MESSAGES ────────────────────────────────────────────────────

/**
 * GET /api/discord/scheduled-messages/:guildId
 * Ottieni tutti i messaggi programmati per un server
 */
router.get("/scheduled-messages/:guildId", (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const config = loadConfig();
    const messages = (config.scheduledMessages || []).filter(m => m.guildId === guildId);
    res.json(messages);
  } catch (err) {
    logger.error({ err }, "Error fetching scheduled messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/discord/scheduled-messages
 * Crea/aggiorna un messaggio programmato
 */
router.post("/scheduled-messages", (req: Request, res: Response) => {
  try {
    const { id, guildId, channelId, message, isRecurring, recurrenceInterval, scheduledTime, enabled } = req.body;
    if (!guildId || !channelId || !message || !scheduledTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const config = loadConfig();
    const scheduledMessages = config.scheduledMessages || [];

    let newMessage: ScheduledMessageConfig;

    if (id) {
      const existingIndex = scheduledMessages.findIndex(m => m.id === id && m.guildId === guildId);
      if (existingIndex !== -1) {
        newMessage = { ...scheduledMessages[existingIndex], channelId, message, isRecurring, recurrenceInterval, scheduledTime, enabled };
        scheduledMessages[existingIndex] = newMessage;
      } else {
        return res.status(404).json({ error: "Scheduled message not found" });
      }
    } else {
      newMessage = {
        id: Date.now().toString(),
        guildId,
        channelId,
        message,
        isRecurring,
        recurrenceInterval,
        scheduledTime,
        enabled,
        createdAt: new Date().toISOString(),
      };
      scheduledMessages.push(newMessage);
    }

    saveConfig({ ...config, scheduledMessages });
    res.json({ success: true, message: newMessage });
  } catch (err) {
    logger.error({ err }, "Error saving scheduled message");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/discord/scheduled-messages/:id
 * Elimina un messaggio programmato
 */
router.delete("/scheduled-messages/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = loadConfig();
    const scheduledMessages = (config.scheduledMessages || []).filter(m => m.id !== id);
    saveConfig({ ...config, scheduledMessages });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting scheduled message");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
