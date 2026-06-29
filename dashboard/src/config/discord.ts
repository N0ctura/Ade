// Discord OAuth2 Configuration
let discordConfig = null;

export const fetchDiscordConfig = async () => {
  if (discordConfig) return discordConfig;
  
  try {
    const res = await fetch("/api/dashboard/config/discord");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to load Discord config");
    }
    discordConfig = await res.json();
    return discordConfig;
  } catch (err) {
    console.error("Could not fetch Discord config:", err);
    throw err;
  }
};

export const getDiscordAuthUrl = async () => {
  const config = await fetchDiscordConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
};

export const getAccessToken = () => {
  return localStorage.getItem("discord_access_token");
};

export const setAccessToken = (token) => {
  localStorage.setItem("discord_access_token", token);
};

export const removeAccessToken = () => {
  localStorage.removeItem("discord_access_token");
};

export const isAuthenticated = () => {
  return !!getAccessToken();
};

