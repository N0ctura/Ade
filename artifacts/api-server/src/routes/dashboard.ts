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

// GET /config/discord (mounted at /dashboard/config/discord) — returns
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
    <title>🧩 Ade Dashboard</title>
    <style>
        *, *::before, *::after {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #171923; /* gray.900 */
            color: #fff;
            min-height: 100vh;
            padding: 40px 20px;
        }

        .container {
            max-width: 1152px; /* ~6xl */
            margin: 0 auto;
        }

        /* ── Header ── */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
        }

        .header-left h1 {
            font-size: 2.25rem;
            font-weight: 700;
            line-height: 1.2;
            margin-bottom: 6px;
        }

        .header-left p {
            color: #718096; /* gray.400 */
            font-size: 1rem;
        }

        /* ── Auth buttons ── */
        .login-btn {
            background: #5865F2;
            color: #fff;
            border: none;
            padding: 10px 22px;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }

        .login-btn:hover { background: #4752C4; }

        .logout-btn {
            background: #E53E3E;
            color: #fff;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }

        .logout-btn:hover { background: #C53030; }

        /* ── Loading overlay ── */
        .loading-overlay {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 60vh;
        }

        .spinner {
            width: 56px;
            height: 56px;
            border: 5px solid #2D3748;
            border-top-color: #5865F2;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Main grid (2-col desktop, 1-col mobile) ── */
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-bottom: 32px;
        }

        @media (max-width: 900px) {
            .grid-2 { grid-template-columns: 1fr; }
        }

        /* ── Cards ── */
        .card {
            background: #1A202C; /* gray.800 */
            border-radius: 12px;
            padding: 32px;
            border-left: 4px solid transparent;
            margin-bottom: 32px;
        }

        .grid-2 .card { margin-bottom: 0; }

        .card-welcome { border-left-color: #48BB78; } /* green.400 */
        .card-leave   { border-left-color: #FC8181; } /* red.400   */
        .card-vars    { border-left-color: #63B3ED; } /* blue.400  */
        .card-configs { border-left-color: #F6E05E; } /* yellow.400 */

        .card-title {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 24px;
        }

        .card-welcome .card-title { color: #68D391; }
        .card-leave   .card-title { color: #FC8181; }
        .card-vars    .card-title { color: #63B3ED; }
        .card-configs .card-title { color: #F6E05E; }

        /* ── Form elements ── */
        .form-group { margin-bottom: 16px; }

        .form-label {
            display: block;
            margin-bottom: 6px;
            font-size: 0.875rem;
            font-weight: 600;
            color: #E2E8F0;
        }

        select, textarea {
            width: 100%;
            padding: 9px 12px;
            background: #2D3748; /* gray.700 */
            border: 1px solid #4A5568; /* gray.600 */
            border-radius: 6px;
            color: #fff;
            font-family: inherit;
            font-size: 0.95rem;
            transition: border-color 0.2s, box-shadow 0.2s;
            appearance: none;
        }

        select:focus, textarea:focus {
            outline: none;
            border-color: #5865F2;
            box-shadow: 0 0 0 3px rgba(88, 101, 242, 0.35);
        }

        select:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        option { background: #2D3748; color: #fff; }

        textarea {
            resize: vertical;
            min-height: 120px;
            line-height: 1.5;
        }

        /* ── Checkbox row ── */
        .checkbox-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
        }

        .checkbox-row input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: #5865F2;
            cursor: pointer;
            flex-shrink: 0;
        }

        .checkbox-row label {
            font-size: 0.95rem;
            font-weight: 500;
            cursor: pointer;
            user-select: none;
        }

        /* ── Buttons ── */
        .btn {
            width: 100%;
            padding: 11px;
            border: none;
            border-radius: 6px;
            font-size: 0.95rem;
            font-weight: 700;
            cursor: pointer;
            transition: filter 0.2s, transform 0.1s;
            letter-spacing: 0.01em;
        }

        .btn:active { transform: scale(0.98); }

        .btn-green { background: #48BB78; color: #1A202C; }
        .btn-green:hover { filter: brightness(1.1); }

        .btn-red { background: #FC8181; color: #1A202C; }
        .btn-red:hover { filter: brightness(1.1); }

        /* ── Variables grid ── */
        .vars-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        @media (max-width: 600px) {
            .vars-grid { grid-template-columns: 1fr; }
        }

        .var-item code {
            display: block;
            font-size: 0.95rem;
            font-weight: 700;
            color: #fff;
            margin-bottom: 4px;
        }

        .var-item p {
            font-size: 0.85rem;
            color: #718096;
        }

        /* ── Saved configs list ── */
        .configs-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .config-item {
            background: #2D3748; /* gray.700 */
            padding: 16px;
            border-radius: 8px;
        }

        .config-item h4 {
            font-size: 0.95rem;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .config-item p {
            font-size: 0.85rem;
            color: #718096;
        }

        .empty-text {
            color: #718096;
            font-size: 0.95rem;
        }

        /* ── Toast notifications ── */
        .toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 9999;
        }

        .toast {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 18px;
            border-radius: 8px;
            color: #fff;
            font-size: 0.9rem;
            min-width: 260px;
            max-width: 360px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            animation: toastIn 0.3s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
        }

        .toast.hiding {
            animation: toastOut 0.25s ease forwards;
        }

        .toast-icon {
            font-size: 1.1rem;
            flex-shrink: 0;
            margin-top: 1px;
        }

        .toast-body { flex: 1; }
        .toast-title { font-weight: 700; margin-bottom: 2px; }
        .toast-desc  { opacity: 0.88; font-size: 0.85rem; }

        .toast.success { background: #276749; border-left: 4px solid #68D391; }
        .toast.error   { background: #742A2A; border-left: 4px solid #FC8181; }

        @keyframes toastIn {
            from { transform: translateX(120%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }

        @keyframes toastOut {
            from { transform: translateX(0);    opacity: 1; }
            to   { transform: translateX(120%); opacity: 0; }
        }

        /* ── Utility ── */
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div class="container">

        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <h1>🧩 Ade Dashboard</h1>
                <p>Manage your Discord bot settings</p>
            </div>
            <div id="userProfile">
                <button class="login-btn" onclick="loginDiscord()">Login with Discord</button>
            </div>
        </div>

        <!-- Loading state (shown while fetching guilds) -->
        <div id="loadingOverlay" class="loading-overlay hidden">
            <div class="spinner"></div>
        </div>

        <!-- Main dashboard (shown after auth) -->
        <div id="dashboard" class="hidden">

            <!-- Welcome + Leave cards side by side -->
            <div class="grid-2">

                <!-- Welcome Card -->
                <div class="card card-welcome">
                    <h2 class="card-title">👋 Welcome Message</h2>

                    <div class="form-group">
                        <label class="form-label">Server</label>
                        <select id="welcomeGuild" onchange="loadWelcomeChannels()">
                            <option value="">Select a server...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Channel</label>
                        <select id="welcomeChannel" disabled>
                            <option value="">Select a channel...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Message</label>
                        <textarea id="welcomeMessage" placeholder="Use {user}, {username}, {guild}, {memberCount}"></textarea>
                    </div>

                    <div class="checkbox-row">
                        <input type="checkbox" id="welcomeEnabled" checked>
                        <label for="welcomeEnabled">Enabled</label>
                    </div>

                    <button class="btn btn-green" onclick="saveWelcome()">💾 Save Welcome</button>
                </div>

                <!-- Leave Card -->
                <div class="card card-leave">
                    <h2 class="card-title">🚪 Leave Message</h2>

                    <div class="form-group">
                        <label class="form-label">Server</label>
                        <select id="leaveGuild" onchange="loadLeaveChannels()">
                            <option value="">Select a server...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Channel</label>
                        <select id="leaveChannel" disabled>
                            <option value="">Select a channel...</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Message</label>
                        <textarea id="leaveMessage" placeholder="Use {user}, {username}, {guild}, {memberCount}"></textarea>
                    </div>

                    <div class="checkbox-row">
                        <input type="checkbox" id="leaveEnabled" checked>
                        <label for="leaveEnabled">Enabled</label>
                    </div>

                    <button class="btn btn-red" onclick="saveLeave()">💾 Save Leave</button>
                </div>

            </div><!-- /.grid-2 -->

            <!-- Variables Info -->
            <div class="card card-vars">
                <h2 class="card-title">📝 Available Variables</h2>
                <div class="vars-grid">
                    <div class="var-item">
                        <code>{user}</code>
                        <p>User mention (@username)</p>
                    </div>
                    <div class="var-item">
                        <code>{username}</code>
                        <p>Username without mention</p>
                    </div>
                    <div class="var-item">
                        <code>{guild}</code>
                        <p>Server name</p>
                    </div>
                    <div class="var-item">
                        <code>{memberCount}</code>
                        <p>Number of members</p>
                    </div>
                </div>
            </div>

            <!-- Saved Configurations -->
            <div class="card card-configs">
                <h2 class="card-title">📋 Saved Configurations</h2>
                <div class="configs-list" id="configsList">
                    <p class="empty-text">Loading...</p>
                </div>
            </div>

        </div><!-- /#dashboard -->
    </div><!-- /.container -->

    <!-- Toast container -->
    <div class="toast-container" id="toastContainer"></div>

    <script>
        // ── Toast system ─────────────────────────────────────────────────────
        function showToast(title, description, type) {
            if (type === undefined) type = "success";
            var container = document.getElementById("toastContainer");
            var icon = type === "success" ? "✅" : "❌";

            var el = document.createElement("div");
            el.className = "toast " + type;
            el.innerHTML =
                '<span class="toast-icon">' + icon + '</span>' +
                '<div class="toast-body">' +
                    '<div class="toast-title">' + title + '</div>' +
                    (description ? '<div class="toast-desc">' + description + '</div>' : '') +
                '</div>';
            container.appendChild(el);

            setTimeout(function() {
                el.classList.add("hiding");
                el.addEventListener("animationend", function() { el.remove(); }, { once: true });
            }, 4000);
        }

        // ── Discord OAuth ─────────────────────────────────────────────────────
        var _discordConfig = null;

        function getDiscordConfig() {
            if (_discordConfig) return Promise.resolve(_discordConfig);
            return fetch("/dashboard/config/discord")
                .then(function(res) {
                    if (!res.ok) {
                        return res.json().catch(function() { return {}; }).then(function(body) {
                            throw new Error(body.error || "Failed to load Discord config");
                        });
                    }
                    return res.json();
                })
                .then(function(cfg) {
                    _discordConfig = cfg;
                    return cfg;
                });
        }

        function getAccessToken()    { return localStorage.getItem("discord_access_token"); }
        function setAccessToken(t)   { localStorage.setItem("discord_access_token", t); }
        function removeAccessToken() { localStorage.removeItem("discord_access_token"); }
        function isAuthenticated()   { return !!getAccessToken(); }

        function loginDiscord() {
            getDiscordConfig()
                .then(function(config) {
                    var params = new URLSearchParams({
                        client_id:     config.clientId,
                        redirect_uri:  config.redirectUri,
                        response_type: "code",
                        scope:         "identify guilds"
                    });
                    window.location.href = "https://discord.com/api/oauth2/authorize?" + params.toString();
                })
                .catch(function() {
                    showToast("Error", "Discord login is not available right now. Please try again later.", "error");
                });
        }

        function logout() {
            removeAccessToken();
            location.reload();
        }

        // ── OAuth callback handler ────────────────────────────────────────────
        function handleCallback() {
            var params = new URLSearchParams(window.location.search);
            var code = params.get("code");
            if (!code) return Promise.resolve();

            return fetch("/api/auth/discord/callback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: code })
            })
            .then(function(res) {
                if (!res.ok) throw new Error("Auth failed");
                return res.json();
            })
            .then(function(data) {
                setAccessToken(data.access_token);
                window.history.replaceState({}, document.title, "/dashboard");
                location.reload();
            })
            .catch(function() {
                showToast("Error", "Authentication failed. Please try again.", "error");
            });
        }

        // ── Loading helpers ───────────────────────────────────────────────────
        function setLoading(on) {
            document.getElementById("loadingOverlay").classList.toggle("hidden", !on);
            document.getElementById("dashboard").classList.toggle("hidden", on);
        }

        // ── Guild / channel loaders ───────────────────────────────────────────
        function loadGuilds() {
            setLoading(true);
            return fetch("/api/discord/guilds")
                .then(function(res) {
                    if (!res.ok) throw new Error("Failed to load guilds");
                    return res.json();
                })
                .then(function(guilds) {
                    var wGuild = document.getElementById("welcomeGuild");
                    var lGuild = document.getElementById("leaveGuild");

                    wGuild.innerHTML = '<option value="">Select a server...</option>';
                    lGuild.innerHTML = '<option value="">Select a server...</option>';

                    guilds.forEach(function(guild) {
                        var label = guild.name + " (" + guild.id + ")";

                        var o1 = document.createElement("option");
                        o1.value = guild.id;
                        o1.textContent = label;
                        wGuild.appendChild(o1);

                        var o2 = document.createElement("option");
                        o2.value = guild.id;
                        o2.textContent = label;
                        lGuild.appendChild(o2);
                    });
                })
                .catch(function(err) {
                    console.error("Error loading guilds:", err);
                    showToast("Error", "Could not load guilds. Make sure the bot is running.", "error");
                })
                .finally(function() {
                    setLoading(false);
                });
        }

        function loadChannels(guildId, selectId) {
            var select = document.getElementById(selectId);
            select.disabled = true;
            select.innerHTML = '<option value="">Loading channels...</option>';

            return fetch("/api/discord/guilds/" + guildId + "/channels")
                .then(function(res) {
                    if (!res.ok) throw new Error("Failed to load channels");
                    return res.json();
                })
                .then(function(channels) {
                    select.innerHTML = '<option value="">Select a channel...</option>';
                    channels.forEach(function(ch) {
                        var opt = document.createElement("option");
                        opt.value = ch.id;
                        opt.textContent = "#" + ch.name + " (" + ch.id + ")";
                        select.appendChild(opt);
                    });
                    select.disabled = false;
                })
                .catch(function(err) {
                    console.error("Error loading channels:", err);
                    showToast("Error", "Could not load channels.", "error");
                    select.innerHTML = '<option value="">Select a channel...</option>';
                    select.disabled = false;
                });
        }

        function loadWelcomeChannels() {
            var guildId = document.getElementById("welcomeGuild").value;
            if (guildId) {
                loadChannels(guildId, "welcomeChannel");
            } else {
                var sel = document.getElementById("welcomeChannel");
                sel.innerHTML = '<option value="">Select a channel...</option>';
                sel.disabled = true;
            }
        }

        function loadLeaveChannels() {
            var guildId = document.getElementById("leaveGuild").value;
            if (guildId) {
                loadChannels(guildId, "leaveChannel");
            } else {
                var sel = document.getElementById("leaveChannel");
                sel.innerHTML = '<option value="">Select a channel...</option>';
                sel.disabled = true;
            }
        }

        // ── Save helpers ──────────────────────────────────────────────────────
        function getExistingConfig(guildId) {
            return fetch("/api/discord/config")
                .then(function(res) {
                    if (!res.ok) return [];
                    return res.json();
                })
                .then(function(all) {
                    return all.find(function(c) { return c.guildId === guildId; }) || {};
                })
                .catch(function() { return {}; });
        }

        function saveWelcome() {
            var guildId   = document.getElementById("welcomeGuild").value;
            var channelId = document.getElementById("welcomeChannel").value;
            var message   = document.getElementById("welcomeMessage").value.trim();
            var enabled   = document.getElementById("welcomeEnabled").checked;
            var guildName = document.getElementById("welcomeGuild").selectedOptions[0]
                            ? document.getElementById("welcomeGuild").selectedOptions[0].text
                            : guildId;

            if (!guildId || !channelId || !message) {
                showToast("Error", "Please fill all fields", "error");
                return;
            }

            getExistingConfig(guildId).then(function(existing) {
                return fetch("/api/discord/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        guildId:          guildId,
                        guildName:        guildName,
                        welcomeChannelId: channelId,
                        welcomeMessage:   message,
                        welcomeEnabled:   enabled,
                        leaveChannelId:   existing.leaveChannelId || "",
                        leaveMessage:     existing.leaveMessage   || "",
                        leaveEnabled:     existing.leaveEnabled   || false
                    })
                });
            })
            .then(function(res) {
                if (res.ok) {
                    showToast("Success", "Welcome message saved!", "success");
                    loadConfigs();
                } else {
                    showToast("Error", "Failed to save welcome message", "error");
                }
            })
            .catch(function(err) {
                console.error("Error saving welcome:", err);
                showToast("Error", "Failed to save welcome message", "error");
            });
        }

        function saveLeave() {
            var guildId   = document.getElementById("leaveGuild").value;
            var channelId = document.getElementById("leaveChannel").value;
            var message   = document.getElementById("leaveMessage").value.trim();
            var enabled   = document.getElementById("leaveEnabled").checked;
            var guildName = document.getElementById("leaveGuild").selectedOptions[0]
                            ? document.getElementById("leaveGuild").selectedOptions[0].text
                            : guildId;

            if (!guildId || !channelId || !message) {
                showToast("Error", "Please fill all fields", "error");
                return;
            }

            getExistingConfig(guildId).then(function(existing) {
                return fetch("/api/discord/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        guildId:          guildId,
                        guildName:        guildName,
                        welcomeChannelId: existing.welcomeChannelId || "",
                        welcomeMessage:   existing.welcomeMessage   || "",
                        welcomeEnabled:   existing.welcomeEnabled   || false,
                        leaveChannelId:   channelId,
                        leaveMessage:     message,
                        leaveEnabled:     enabled
                    })
                });
            })
            .then(function(res) {
                if (res.ok) {
                    showToast("Success", "Leave message saved!", "success");
                    loadConfigs();
                } else {
                    showToast("Error", "Failed to save leave message", "error");
                }
            })
            .catch(function(err) {
                console.error("Error saving leave:", err);
                showToast("Error", "Failed to save leave message", "error");
            });
        }

        // ── Configs list ──────────────────────────────────────────────────────
        function loadConfigs() {
            return fetch("/api/discord/config")
                .then(function(res) {
                    if (!res.ok) throw new Error("Failed to load configs");
                    return res.json();
                })
                .then(function(configs) {
                    var list = document.getElementById("configsList");

                    if (!configs.length) {
                        list.innerHTML = '<p class="empty-text">No configurations saved yet</p>';
                        return;
                    }

                    list.innerHTML = configs.map(function(cfg) {
                        return '<div class="config-item">' +
                            '<h4>' + cfg.guildName + '</h4>' +
                            '<p>Welcome: ' + (cfg.welcomeEnabled ? "✅" : "❌") +
                            ' | Leave: '   + (cfg.leaveEnabled   ? "✅" : "❌") + '</p>' +
                        '</div>';
                    }).join("");
                })
                .catch(function(err) {
                    console.error("Error loading configs:", err);
                });
        }

        // ── Bootstrap ─────────────────────────────────────────────────────────
        handleCallback().then(function() {
            if (isAuthenticated()) {
                document.getElementById("userProfile").innerHTML =
                    '<button class="logout-btn" onclick="logout()">Logout</button>';
                // Reveal dashboard shell; loadGuilds will toggle the loading overlay
                document.getElementById("dashboard").classList.remove("hidden");
                loadGuilds().then(function() { loadConfigs(); });
            }
        });
    </script>
</body>
</html>
  `;

  res.send(html);
});

export default router;
