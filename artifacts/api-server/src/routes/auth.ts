import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/auth/callback";

/**
 * GET /api/auth/discord/callback
 * Handle Discord OAuth redirect — exchange code for access token and
 * return an HTML page that stores the token in localStorage then
 * redirects the user to /dashboard.
 */
router.get("/discord/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string | undefined;

    if (!code) {
      return res.status(400).send("<p>Missing OAuth code. Please try logging in again.</p>");
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      logger.error("Discord OAuth credentials not configured");
      return res.status(500).send("<p>Server not configured for Discord OAuth.</p>");
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
      return res.status(400).send("<p>Failed to authenticate with Discord. Please try again.</p>");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token as string;

    // Return an HTML page that persists the token and redirects to the dashboard
    res.setHeader("Content-Type", "text/html");
    return res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Authenticating…</title>
  </head>
  <body>
    <p>Authenticating, please wait…</p>
    <script>
      try {
        localStorage.setItem("discord_access_token", ${JSON.stringify(accessToken)});
      } catch (e) {
        console.error("Failed to store access token", e);
      }
      window.location.replace("/dashboard");
    </script>
  </body>
</html>`);
  } catch (err) {
    logger.error({ err }, "Error in Discord GET callback");
    res.status(500).send("<p>Internal server error. Please try again.</p>");
  }
});

/**
 * POST /api/auth/discord/callback
 * Exchange Discord OAuth code for access token (kept for backward compatibility)
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

