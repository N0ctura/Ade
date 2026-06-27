const WV_BASE = "https://api.wolvesville.com";
const CDN_BASE = "https://cdn.wolvesville.com";

function headers() {
  return {
    Authorization: `Bot ${process.env["WOLVESVILLE_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function personalHeaders() {
  return {
    Authorization: `Bot ${process.env["WOLVESVILLE_PERSONAL_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface WvQuest {
  id: string;
  promoImageUrl: string;
  promoImagePrimaryColor?: string;
  purchasableWithGems: boolean;
  rewards: Array<{
    type: string;
    amount: number;
    avatarItemId?: string;
    displayType?: string;
  }>;
}

export interface WvAvatarItem {
  id: string;
  imageUrl: string;
  type: string;
  rarity: string;
  costInGold?: number;
  name?: string;
}

export async function fetchAvailableQuests(clanId: string): Promise<WvQuest[]> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/quests/available`, {
    headers: headers(),
  });

  if (resp.status === 401) {
    throw new Error(
      "401_UNAUTHORIZED: Il bot Wolvesville non è stato aggiunto come clan bot. Il leader del clan deve andare in Impostazioni clan → Bot e aggiungere questo bot."
    );
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }

  return resp.json() as Promise<WvQuest[]>;
}

export async function fetchAllQuests(): Promise<WvQuest[]> {
  const resp = await fetch(`${WV_BASE}/clans/quests/all`, {
    headers: headers(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<WvQuest[]>;
}

export async function fetchAvatarItems(): Promise<WvAvatarItem[]> {
  const resp = await fetch(`${WV_BASE}/items/avatarItems`, {
    headers: headers(),
  });
  if (!resp.ok) throw new Error(`Wolvesville API error ${resp.status}`);
  return resp.json() as Promise<WvAvatarItem[]>;
}

export interface WvPlayer {
  id: string;
  username: string;
  level: number;
  personalMessage?: string;
  status?: string;
  gameStats?: {
    gamesPlayed?: number;
    wins?: number;
    survivorWins?: number;
    werewolfWins?: number;
    minigameWins?: number;
  };
  rankedSeasonSkill?: number;
  rankedSeasonBestSkill?: number;
  rankedSeasonHighestLeague?: number;
  clanName?: string;
  equippedAvatarItem?: { imageUrl?: string };
  equippedProfileIcon?: { imageUrl?: string };
  playerTitle?: { title?: string };
  lastOnline?: string;
  createdAt?: string;
}

export async function fetchPlayerByUsername(username: string): Promise<WvPlayer | null> {
  const resp = await fetch(`${WV_BASE}/players/search?username=${encodeURIComponent(username)}`, {
    headers: personalHeaders(),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Wolvesville API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<WvPlayer>;
}

export async function shuffleQuests(clanId: string): Promise<void> {
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/quests/available/shuffle`, {
    method: "POST",
    headers: headers(),
  });
  if (resp.status === 401) {
    throw new Error("401_UNAUTHORIZED: Bot non autorizzato come clan bot.");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Shuffle error ${resp.status}: ${text}`);
  }
}
