import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dns from "dns";

// Enable dns mapping if needed
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = 3000;

app.use(express.json());

// Memory store for bot configurations
let botConfigs = {
  welcome: {
    enabled: true,
    channelId: "112233445566778899",
    message: "Benvenuto {user} su {guild}! Sei il membro numero {memberCount}!",
    card: {
      width: 800,
      height: 400,
      layers: [
        {
          id: "bg",
          type: "background",
          visible: true,
          x: 0,
          y: 0,
          width: 800,
          height: 400,
          url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
        },
        {
          id: "avatar",
          type: "avatar",
          visible: true,
          x: 320,
          y: 50,
          width: 160,
          height: 160,
          borderWidth: 4,
          borderColor: "#5865F2",
          borderRadius: 50
        },
        {
          id: "title",
          type: "text",
          visible: true,
          x: 400,
          y: 250,
          width: 800,
          height: 50,
          text: "BENVENUTO {username}!",
          fontSize: 32,
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center"
        },
        {
          id: "subtitle",
          type: "text",
          visible: true,
          x: 400,
          y: 310,
          width: 800,
          height: 400,
          text: "Sei il membro #{memberCount} di {guild}",
          fontSize: 20,
          fontWeight: "normal",
          color: "#b9bbbe",
          textAlign: "center"
        }
      ]
    }
  },
  leave: {
    enabled: true,
    channelId: "112233445566778800",
    message: "Arrivederci {username}! Ci mancherai su {guild}!",
    card: {
      width: 800,
      height: 400,
      layers: [
        {
          id: "bg",
          type: "background",
          visible: true,
          x: 0,
          y: 0,
          width: 800,
          height: 400,
          url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80"
        },
        {
          id: "avatar",
          type: "avatar",
          visible: true,
          x: 320,
          y: 50,
          width: 160,
          height: 160,
          borderWidth: 4,
          borderColor: "#ED4245",
          borderRadius: 50
        },
        {
          id: "title",
          type: "text",
          visible: true,
          x: 400,
          y: 250,
          width: 800,
          height: 50,
          text: "ARRIVEDERCI {username}!",
          fontSize: 32,
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center"
        },
        {
          id: "subtitle",
          type: "text",
          visible: true,
          x: 400,
          y: 310,
          width: 800,
          height: 400,
          text: "Ci mancherai tantissimo!",
          fontSize: 20,
          fontWeight: "normal",
          color: "#f43f5e",
          textAlign: "center"
        }
      ]
    }
  },
  autoRole: {
    enabled: true,
    roleIds: ["112233445566778801", "112233445566778802"],
    roles: [
      { id: "112233445566778801", name: "Membro", color: "#3498db" },
      { id: "112233445566778802", name: "Novizio", color: "#2ecc71" },
      { id: "112233445566778803", name: "Adepto", color: "#9b59b6" },
      { id: "112233445566778804", name: "Moderatore", color: "#e74c3c" }
    ]
  },
  tts: {
    enabled: false,
    sourceChannelId: "112233445566778805",
    voiceChannelId: "112233445566778806",
    language: "it",
    prefixes: [",", ";", "!"]
  },
  scheduledMessages: [
    {
      id: "sched-1",
      channelId: "112233445566778805",
      message: "Ricordati di votare il server ogni 12 ore digitando /vote !",
      isRecurring: true,
      recurrenceInterval: "12h",
      enabled: true
    },
    {
      id: "sched-2",
      channelId: "112233445566778805",
      message: "Benvenuti nel canale ufficiale di Ade! Digita /help per i comandi disponibili.",
      isRecurring: true,
      recurrenceInterval: "daily",
      enabled: true
    }
  ],
  logsConfig: {
    enabled: true,
    channelId: "112233445566778810",
    interceptApps: true,
    interceptUsers: true
  }
};

// Log store for simulated discord bot activities
let botLogs = [
  { timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), type: "info", message: "Bot avviato correttamente. Connesso a Discord Gateway v10." },
  { timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), type: "info", message: "Caricati 12 comandi Slash." },
  { timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), type: "success", message: "Connessione stabilita con database PostgreSQL di Railway." },
  { timestamp: new Date(Date.now() - 1800000).toISOString(), type: "info", message: "AdeBot è in ascolto sui server di test (Ade Server, Noctura Lab)." },
  { timestamp: new Date(Date.now() - 600000).toISOString(), type: "guild", message: "Nuovo utente registrato nel server: MarioRossi#1234. Assegnato ruolo: Membro." },
  { timestamp: new Date(Date.now() - 300000).toISOString(), type: "tts", message: "Comando TTS eseguito nel canale 'Generale' di Noctura Lab." }
];

let deletedModifiedLogs = [
  {
    id: "dm-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    type: "deleted",
    author: {
      username: "LuigiNeri",
      avatar: "https://cdn.discordapp.com/embed/avatars/1.png",
      isBot: false
    },
    channel: "112233445566778899",
    deletedContent: "Stasera qualcuno c'è per una partita veloce su FIFA?"
  },
  {
    id: "dm-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    type: "modified",
    author: {
      username: "ProGamer99",
      avatar: "https://cdn.discordapp.com/embed/avatars/2.png",
      isBot: false
    },
    channel: "112233445566778805",
    oldContent: "!play song_name_v2 --fast",
    newContent: "!play song_name_v3 --bass-boosted"
  }
];

// GitHub Proxy API endpoints
// To avoid strict CORS, rate limit problems, and handle authentication or formatting
app.get("/api/github/contents", async (req, res) => {
  const repoPath = (req.query.path as string) || "";
  try {
    const url = `https://api.github.com/repos/N0ctura/Ade/contents/${repoPath}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Ade-Bot-Dashboard-Proxy",
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Error proxying GitHub contents:", error.message);
    res.status(500).json({ error: "Impossibile recuperare i contenuti dal repository" });
  }
});

app.get("/api/github/file", async (req, res) => {
  const filePath = (req.query.path as string) || "";
  if (!filePath) {
    return res.status(400).json({ error: "Path del file mancante" });
  }
  try {
    const url = `https://raw.githubusercontent.com/N0ctura/Ade/main/${filePath}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Ade-Bot-Dashboard-Proxy"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub returned status ${response.status} for raw file`);
    }

    const text = await response.text();
    res.send(text);
  } catch (error: any) {
    console.error("Error proxying GitHub raw file:", error.message);
    res.status(500).json({ error: "Impossibile leggere il file dal repository" });
  }
});

// Bot general endpoints
app.get("/api/bot/status", (req, res) => {
  res.json({
    online: true,
    platform: "Railway",
    uptime: "3d 4h 12m",
    guildsCount: 3,
    membersCount: 412,
    ping: "24ms",
    logs: botLogs,
    repoUrl: "https://github.com/N0ctura/Ade"
  });
});

app.post("/api/bot/logs/clear", (req, res) => {
  botLogs = [
    { timestamp: new Date().toISOString(), type: "info", message: "Log della console ripuliti dall'utente." }
  ];
  res.json({ success: true, logs: botLogs });
});

// Bot config endpoints
app.get("/api/bot/config", (req, res) => {
  res.json(botConfigs);
});

app.post("/api/bot/config/welcome", (req, res) => {
  botConfigs.welcome = { ...botConfigs.welcome, ...req.body };
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Configurazione del modulo Welcome aggiornata via Dashboard."
  });
  res.json({ success: true, config: botConfigs.welcome });
});

app.post("/api/bot/config/leave", (req, res) => {
  botConfigs.leave = { ...botConfigs.leave, ...req.body };
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Configurazione del modulo Leave aggiornata via Dashboard."
  });
  res.json({ success: true, config: botConfigs.leave });
});

app.post("/api/bot/config/autorole", (req, res) => {
  botConfigs.autoRole = { ...botConfigs.autoRole, ...req.body };
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Configurazione Auto-Role aggiornata via Dashboard."
  });
  res.json({ success: true, config: botConfigs.autoRole });
});

app.post("/api/bot/config/tts", (req, res) => {
  botConfigs.tts = { ...botConfigs.tts, ...req.body };
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Configurazione Text-to-Speech aggiornata via Dashboard."
  });
  res.json({ success: true, config: botConfigs.tts });
});

app.post("/api/bot/config/schedule", (req, res) => {
  botConfigs.scheduledMessages = req.body;
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Pianificazione dei messaggi ricorrenti aggiornata via Dashboard."
  });
  res.json({ success: true, config: botConfigs.scheduledMessages });
});

// Message Log system configuration & simulation endpoints
app.post("/api/bot/config/logsConfig", (req, res) => {
  botConfigs.logsConfig = { ...botConfigs.logsConfig, ...req.body };
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: `Configurazione del modulo LOG aggiornata via Dashboard. Canale scelto: <#${req.body.channelId}>`
  });
  res.json({ success: true, config: botConfigs.logsConfig });
});

app.get("/api/bot/logs/deleted-modified", (req, res) => {
  res.json(deletedModifiedLogs);
});

app.post("/api/bot/logs/deleted-modified/clear", (req, res) => {
  deletedModifiedLogs = [];
  botLogs.unshift({
    timestamp: new Date().toISOString(),
    type: "info",
    message: "Lista dei messaggi intercettati (eliminati/modificati) ripulita."
  });
  res.json({ success: true, logs: deletedModifiedLogs });
});

app.post("/api/bot/logs/deleted-modified/simulate", (req, res) => {
  const users = [
    { username: "NocturaDev", avatar: "https://cdn.discordapp.com/embed/avatars/3.png", isBot: false },
    { username: "Loris_VR", avatar: "https://cdn.discordapp.com/embed/avatars/4.png", isBot: false },
    { username: "MusicBot", avatar: "https://cdn.discordapp.com/embed/avatars/0.png", isBot: true },
    { username: "GamerGirl94", avatar: "https://cdn.discordapp.com/embed/avatars/5.png", isBot: false }
  ];
  
  const channels = ["112233445566778899", "112233445566778805", "112233445566778810"];
  
  const deletedPhrases = [
    "Sì, d'accordo, ci vediamo tra poco nel server vocale",
    "Qual è il comando per avviare la musica? !play?",
    "Ma chi ha mutato il bot della musica di nuovo??",
    "Ho inserito la password sbagliata, ignorate il messaggio precedente"
  ];

  const modifiedPhrases = [
    { old: "Raga ho un bot pazzesco da aggiungere", new: "Raga ho configurato AdeBot ed è incredibile!" },
    { old: "Faccio schifo a giocare stasera vado offline", new: "Vinte 3 di fila! Chi vuole fare lobby?" },
    { old: "Qualcuno mi dà moderatore per favore?", new: "Qualcuno può controllare il canale #comandi-bot?" },
    { old: "Ho dimenticato di dirvi che domani non ci sono", new: "Ho dimenticato di dirvi che domani facciamo evento alle 21!" }
  ];

  const type = Math.random() > 0.5 ? "deleted" : "modified";
  const randomUser = users[Math.floor(Math.random() * users.length)];
  const randomChannel = channels[Math.floor(Math.random() * channels.length)];
  const timestamp = new Date().toISOString();
  
  let newLog: any = {
    id: `dm-${Date.now()}`,
    timestamp,
    type,
    author: randomUser,
    channel: randomChannel
  };

  if (type === "deleted") {
    newLog.deletedContent = deletedPhrases[Math.floor(Math.random() * deletedPhrases.length)];
    botLogs.unshift({
      timestamp,
      type: "info",
      message: `Intercettato messaggio ELIMINATO da ${randomUser.username} nel canale <#${randomChannel}>`
    });
  } else {
    const phrase = modifiedPhrases[Math.floor(Math.random() * modifiedPhrases.length)];
    newLog.oldContent = phrase.old;
    newLog.newContent = phrase.new;
    botLogs.unshift({
      timestamp,
      type: "info",
      message: `Intercettato messaggio MODIFICATO da ${randomUser.username} nel canale <#${randomChannel}>`
    });
  }

  deletedModifiedLogs.unshift(newLog);
  res.json({ success: true, log: newLog, logs: deletedModifiedLogs });
});

// Start the server with Vite Integration or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
