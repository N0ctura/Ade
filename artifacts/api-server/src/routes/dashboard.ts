import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

// Read env vars at request time so Railway's runtime values are always used
function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/auth/callback";

  if (!clientId) {
    logger.warn(
      "DISCORD_CLIENT_ID is not set — Discord OAuth login will not work"
    );
  }

  return { clientId, redirectUri };
}

// GET /config/discord (mounted at /api/dashboard/config/discord) — returns
// Discord OAuth config as JSON so the browser can fetch it at runtime instead
// of relying on server-side template interpolation (which breaks when env vars
// are undefined at module load time).
router.get("/config/discord", (req: Request, res: Response) => {
  const { clientId, redirectUri } = getDiscordConfig();

  if (!clientId) {
    logger.error(
      "GET /api/config/discord called but DISCORD_CLIENT_ID is missing"
    );
    return res.status(503).json({
      error: "Discord OAuth is not configured on this server",
    });
  }

  res.json({ clientId, redirectUri });
});

// Serve the dashboard HTML
router.get("/", (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 Ade Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #5865F2;
        }
        
        h1 {
            font-size: 2.5em;
            color: #5865F2;
        }
        
        .user-profile {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #5865F2;
        }
        
        .login-btn {
            background: #5865F2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1em;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .login-btn:hover {
            background: #4752C4;
        }
        
        .logout-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .logout-btn:hover {
            background: #c82333;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid;
            border-radius: 12px;
            padding: 25px;
            backdrop-filter: blur(10px);
        }
        
        .card.welcome {
            border-color: #28a745;
        }
        
        .card.leave {
            border-color: #dc3545;
        }
        
        .card.info {
            border-color: #007bff;
        }
        
        .card h2 {
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        
        .card.welcome h2 {
            color: #28a745;
        }
        
        .card.leave h2 {
            color: #dc3545;
        }
        
        .card.info h2 {
            color: #007bff;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 0.95em;
        }
        
        select, textarea {
            width: 100%;
            padding: 10px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: white;
            font-family: inherit;
            font-size: 0.95em;
        }
        
        select:focus, textarea:focus {
            outline: none;
            border-color: #5865F2;
            background: rgba(0, 0, 0, 0.5);
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 6px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-green {
            background: #28a745;
            color: white;
        }
        
        .btn-green:hover {
            background: #218838;
        }
        
        .btn-red {
            background: #dc3545;
            color: white;
        }
        
        .btn-red:hover {
            background: #c82333;
        }
        
        .variables {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .var-item {
            background: rgba(0, 0, 0, 0.3);
            padding: 12px;
            border-radius: 6px;
        }
        
        .var-item code {
            color: #5865F2;
            font-weight: bold;
        }
        
        .configs {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .config-item {
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #5865F2;
        }
        
        .config-item h4 {
            margin-bottom: 8px;
        }
        
        .config-item p {
            font-size: 0.9em;
            color: #aaa;
        }
        
        .hidden {
            display: none;
        }
        
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        
        .toast.success {
            background: #28a745;
        }
        
        .toast.error {
            background: #dc3545;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 Ade Dashboard</h1>
            <div class="user-profile" id="userProfile">
                <button class="login-btn" onclick="loginDiscord()">Login with Discord</button>
            </div>
        </header>
        
        <div id="dashboard" class="hidden">
            <div class="grid">
                <!-- Welcome Card -->
                <div class="card welcome">
                    <h2>👋 Welcome Message</h2>
                    <div class="form-group">
                        <label>Server</label>
                        <select id="welcomeGuild" onchange="loadWelcomeChannels()">
                            <option value="">Select a server...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Channel</label>
                        <select id="welcomeChannel">
                            <option value="">Select a channel...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="welcomeMessage" placeholder="Use {user}, {username}, {guild}, {memberCount}"></textarea>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="welcomeEnabled" checked>
                        <label for="welcomeEnabled" style="margin: 0;">Enabled</label>
                    </div>
                    <button class="btn btn-green" onclick="saveWelcome()">💾 Save Welcome</button>
                </div>
                
                <!-- Leave Card -->
                <div class="card leave">
                    <h2>👋 Leave Message</h2>
                    <div class="form-group">
                        <label>Server</label>
                        <select id="leaveGuild" onchange="loadLeaveChannels()">
                            <option value="">Select a server...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Channel</label>
                        <select id="leaveChannel">
                            <option value="">Select a channel...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="leaveMessage" placeholder="Use {user}, {username}, {guild}, {memberCount}"></textarea>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="leaveEnabled" checked>
                        <label for="leaveEnabled" style="margin: 0;">Enabled</label>
                    </div>
                    <button class="btn btn-red" onclick="saveLeave()">💾 Save Leave</button>
                </div>
            </div>
            
            <!-- Variables Info -->
            <div class="card info">
                <h2>📝 Available Variables</h2>
                <div class="variables">
                    <div class="var-item">
                        <code>{user}</code>
                        <p>User mention</p>
                    </div>
                    <div class="var-item">
                        <code>{username}</code>
                        <p>Username</p>
                    </div>
                    <div class="var-item">
                        <code>{guild}</code>
                        <p>Server name</p>
                    </div>
                    <div class="var-item">
                        <code>{memberCount}</code>
                        <p>Member count</p>
                    </div>
                </div>
            </div>
            
            <!-- Saved Configs -->
            <div class="card info">
                <h2>📊 Saved Configurations</h2>
                <div class="configs" id="configsList">
                    <p>Loading...</p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const BOT_API_URL = window.location.origin;

        // Discord OAuth config is fetched from the server at runtime so that
        // missing or late-bound environment variables never silently produce
        // the literal string "undefined" in the OAuth redirect URL.
        let _discordConfig = null;

        async function getDiscordConfig() {
            if (_discordConfig) return _discordConfig;
            try {
                const res = await fetch("/api/dashboard/config/discord");
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || "Failed to load Discord config");
                }
                _discordConfig = await res.json();
                return _discordConfig;
            } catch (err) {
                console.error("Could not fetch Discord config:", err);
                throw err;
            }
        }
        
        function getAccessToken() {
            return localStorage.getItem("discord_access_token");
        }
        
        function setAccessToken(token) {
            localStorage.setItem("discord_access_token", token);
        }
        
        function removeAccessToken() {
            localStorage.removeItem("discord_access_token");
        }
        
        function isAuthenticated() {
            return !!getAccessToken();
        }
        
        async function loginDiscord() {
            try {
                const config = await getDiscordConfig();
                const params = new URLSearchParams({
                    client_id: config.clientId,
                    redirect_uri: config.redirectUri,
                    response_type: "code",
                    scope: "identify guilds"
                });
                window.location.href = \`https://discord.com/api/oauth2/authorize?\${params.toString()}\`;
            } catch (err) {
                showToast("Discord login is not available right now. Please try again later.", "error");
            }
        }
        
        function logout() {
            removeAccessToken();
            location.reload();
        }
        
        function showToast(message, type = "success") {
            const toast = document.createElement("div");
            toast.className = \`toast \${type}\`;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        
        async function handleCallback() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");
            
            if (code) {
                try {
                    const res = await fetch("/api/auth/discord/callback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code })
                    });
                    
                    if (!res.ok) throw new Error("Auth failed");
                    const data = await res.json();
                    setAccessToken(data.access_token);
                    window.history.replaceState({}, document.title, "/api/dashboard");
                    location.reload();

                } catch (err) {
                    showToast("Authentication failed", "error");
                }
            }
        }
        
        async function loadGuilds() {
            try {
                const res = await fetch("/api/discord/guilds");
                if (!res.ok) throw new Error("Failed to load guilds");
                const guilds = await res.json();
                
                const wGuild = document.getElementById("welcomeGuild");
                const lGuild = document.getElementById("leaveGuild");
                
                wGuild.innerHTML = '<option value="">Select a server...</option>';
                lGuild.innerHTML = '<option value="">Select a server...</option>';
                
                guilds.forEach(guild => {
                    const opt1 = document.createElement("option");
                    opt1.value = guild.id;
                    opt1.textContent = guild.name;
                    wGuild.appendChild(opt1);
                    
                    const opt2 = document.createElement("option");
                    opt2.value = guild.id;
                    opt2.textContent = guild.name;
                    lGuild.appendChild(opt2);
                });
            } catch (err) {
                showToast("Could not load guilds", "error");
            }
        }
        
        async function loadWelcomeChannels() {
            const guildId = document.getElementById("welcomeGuild").value;
            if (!guildId) return;
            
            try {
                const res = await fetch(\`/api/discord/guilds/\${guildId}/channels\`);
                if (!res.ok) throw new Error("Failed to load channels");
                const channels = await res.json();
                
                const select = document.getElementById("welcomeChannel");
                select.innerHTML = '<option value="">Select a channel...</option>';
                
                channels.forEach(ch => {
                    const opt = document.createElement("option");
                    opt.value = ch.id;
                    opt.textContent = "#" + ch.name;
                    select.appendChild(opt);
                });
            } catch (err) {
                showToast("Could not load channels", "error");
            }
        }
        
        async function loadLeaveChannels() {
            const guildId = document.getElementById("leaveGuild").value;
            if (!guildId) return;
            
            try {
                const res = await fetch(\`/api/discord/guilds/\${guildId}/channels\`);
                if (!res.ok) throw new Error("Failed to load channels");
                const channels = await res.json();
                
                const select = document.getElementById("leaveChannel");
                select.innerHTML = '<option value="">Select a channel...</option>';
                
                channels.forEach(ch => {
                    const opt = document.createElement("option");
                    opt.value = ch.id;
                    opt.textContent = "#" + ch.name;
                    select.appendChild(opt);
                });
            } catch (err) {
                showToast("Could not load channels", "error");
            }
        }
        
        async function saveWelcome() {
            const guildId = document.getElementById("welcomeGuild").value;
            const channelId = document.getElementById("welcomeChannel").value;
            const message = document.getElementById("welcomeMessage").value;
            const enabled = document.getElementById("welcomeEnabled").checked;
            const guildName = document.getElementById("welcomeGuild").selectedOptions[0]?.text || guildId;
            
            if (!guildId || !channelId || !message) {
                showToast("Please fill all fields", "error");
                return;
            }
            
            try {
                // Fetch existing config for this guild so we preserve leave settings
                const existingRes = await fetch("/api/discord/config");
                const allConfigs = existingRes.ok ? await existingRes.json() : [];
                const existing = allConfigs.find(c => c.guildId === guildId) || {};

                const res = await fetch("/api/discord/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        guildId,
                        guildName,
                        welcomeChannelId: channelId,
                        welcomeMessage: message,
                        welcomeEnabled: enabled,
                        leaveChannelId: existing.leaveChannelId || "",
                        leaveMessage: existing.leaveMessage || "",
                        leaveEnabled: existing.leaveEnabled || false
                    })
                });
                
                if (res.ok) {
                    showToast("Welcome message saved!", "success");
                    loadConfigs();
                } else {
                    showToast("Failed to save", "error");
                }
            } catch (err) {
                showToast("Failed to save", "error");
            }
        }
        
        async function saveLeave() {
            const guildId = document.getElementById("leaveGuild").value;
            const channelId = document.getElementById("leaveChannel").value;
            const message = document.getElementById("leaveMessage").value;
            const enabled = document.getElementById("leaveEnabled").checked;
            const guildName = document.getElementById("leaveGuild").selectedOptions[0]?.text || guildId;
            
            if (!guildId || !channelId || !message) {
                showToast("Please fill all fields", "error");
                return;
            }
            
            try {
                // Fetch existing config for this guild so we preserve welcome settings
                const existingRes = await fetch("/api/discord/config");
                const allConfigs = existingRes.ok ? await existingRes.json() : [];
                const existing = allConfigs.find(c => c.guildId === guildId) || {};

                const res = await fetch("/api/discord/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        guildId,
                        guildName,
                        welcomeChannelId: existing.welcomeChannelId || "",
                        welcomeMessage: existing.welcomeMessage || "",
                        welcomeEnabled: existing.welcomeEnabled || false,
                        leaveChannelId: channelId,
                        leaveMessage: message,
                        leaveEnabled: enabled
                    })
                });
                
                if (res.ok) {
                    showToast("Leave message saved!", "success");
                    loadConfigs();
                } else {
                    showToast("Failed to save", "error");
                }
            } catch (err) {
                showToast("Failed to save", "error");
            }
        }
        
        async function loadConfigs() {
            try {
                const res = await fetch("/api/discord/config");
                if (!res.ok) throw new Error("Failed to load configs");
                const configs = await res.json();
                
                const list = document.getElementById("configsList");

                if (configs.length === 0) {
                    list.innerHTML = "<p>No configurations saved yet</p>";
                    return;
                }
                
                list.innerHTML = configs.map(cfg => \`
                    <div class="config-item">
                        <h4>\${cfg.guildName}</h4>
                        <p>Welcome: \${cfg.welcomeEnabled ? "✅" : "❌"} | Leave: \${cfg.leaveEnabled ? "✅" : "❌"}</p>
                    </div>
                \`).join("");
            } catch (err) {
                console.error("Error loading configs:", err);
            }
        }
        
        // Initialize
        handleCallback();
        
        if (isAuthenticated()) {
            document.getElementById("dashboard").classList.remove("hidden");
            document.getElementById("userProfile").innerHTML = '<button class="logout-btn" onclick="logout()">Logout</button>';
            loadGuilds();
            loadConfigs();
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

export default router;

