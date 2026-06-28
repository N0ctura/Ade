import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/auth/callback";

/**
 * POST /api/auth/discord/callback
 * Exchange Discord OAuth code for access token
 */
router.post("/discord/callback", async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      logger.error("Discord OAuth credentials not configured");
      return res.status(500).json({ error: "Server not configured for Discord OAuth" });
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: DISCORD_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      logger.error({ error }, "Failed to exchange Discord code");
      return res.status(400).json({ error: "Failed to authenticate with Discord" });
    }

    const tokenData = await tokenResponse.json();

    res.json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
    });
  } catch (err) {
    logger.error({ err }, "Error in Discord callback");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

