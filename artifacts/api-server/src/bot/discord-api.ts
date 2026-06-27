import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

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

export default router;