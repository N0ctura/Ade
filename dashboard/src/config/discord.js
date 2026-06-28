// Discord OAuth2 Configuration
// Config is fetched at runtime from /api/config/discord so that env vars
// are never baked into the static bundle.

let _cachedConfig = null;

export async function fetchDiscordConfig() {
  if (_cachedConfig) return _cachedConfig;
  const res = await fetch("/api/config/discord");
  if (!res.ok) {
    throw new Error("Discord OAuth is not configured on this server");
  }
  _cachedConfig = await res.json();
  return _cachedConfig;
}

export async function getDiscordAuthUrl() {
  const { clientId, redirectUri } = await fetchDiscordConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

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

