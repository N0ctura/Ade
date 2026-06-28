// Discord OAuth2 Configuration
const DISCORD_CLIENT_ID = process.env.REACT_APP_DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI = process.env.REACT_APP_DISCORD_REDIRECT_URI || `${window.location.origin}/auth/callback`;

export const getDiscordAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
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

