import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Home,
  MessageSquare,
  Activity,
  Shield,
  Clock,
  Volume2,
  Settings,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Move,
  ArrowUp,
  ArrowDown,
  Check,
  Server,
  RefreshCw,
  Terminal,
  HelpCircle,
  Sparkles,
  Layers,
  CheckSquare,
  X,
  Play,
  LogOut
} from "lucide-react";
import { BotStatus, CardConfig, CardLayer, LogEntry, ModuleConfig, DeletedModifiedLog } from "./types";
import LoginTailwind from "./pages/LoginTailwind";
import { isAuthenticated, removeAccessToken } from "./config/discord";

// Default local variables for replacing preset text in live preview
const replaceVars = (text: string, mockUsername = "N0ctura", memberCount = 412) => {
  return (text || "")
    .replace(/{user}/g, `<@${mockUsername}>`)
    .replace(/{username}/g, mockUsername)
    .replace(/{guild}/g, "Ade Server")
    .replace(/{memberCount}/g, String(memberCount));
};

// Canvas Preview Component
interface CardCanvasPreviewProps {
  cardConfig: CardConfig;
  isLeave: boolean;
  selectedLayerId: string | null;
  onLayerSelect: (id: string | null) => void;
  onLayerDrag: (id: string, position: { x: number; y: number }) => void;
}

const CardCanvasPreview: React.FC<CardCanvasPreviewProps> = ({
  cardConfig,
  isLeave,
  selectedLayerId,
  onLayerSelect,
  onLayerDrag,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Keep track of loaded images to avoid infinite load loops and flickering
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const [, forceUpdate] = useState({});

  const triggerRedraw = useCallback(() => {
    forceUpdate({});
  }, []);

  // Pre-load images
  useEffect(() => {
    if (!cardConfig) return;
    cardConfig.layers.forEach(layer => {
      if (layer.url && !imageCacheRef.current[layer.url]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageCacheRef.current[layer.url!] = img;
          triggerRedraw();
        };
        img.onerror = () => {
          console.warn("Failed to load image layer URL:", layer.url);
        };
        img.src = layer.url;
      }
    });
  }, [cardConfig, triggerRedraw]);

  useEffect(() => {
    if (!canvasRef.current || !cardConfig) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, layers } = cardConfig;
    canvas.width = width;
    canvas.height = height;

    // Clear Canvas with Discord background color
    ctx.fillStyle = "#1e1f22";
    ctx.fillRect(0, 0, width, height);

    // Draw each layer
    layers.forEach(layer => {
      if (!layer.visible) return;

      ctx.save();

      switch (layer.type) {
        case "background":
        case "image":
          if (layer.url && imageCacheRef.current[layer.url]) {
            const cachedImg = imageCacheRef.current[layer.url];
            ctx.drawImage(cachedImg, layer.x, layer.y, layer.width, layer.height);
          } else {
            // Placeholder Gradient if no URL
            const gradient = ctx.createLinearGradient(layer.x, layer.y, layer.x + layer.width, layer.y + layer.height);
            if (isLeave) {
              gradient.addColorStop(0, "#2b2d31");
              gradient.addColorStop(1, "#111214");
            } else {
              gradient.addColorStop(0, "#5865F2");
              gradient.addColorStop(1, "#3f4699");
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
          }
          break;

        case "avatar":
          const avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
          let avatarImg = imageCacheRef.current[avatarUrl];

          if (!avatarImg) {
            avatarImg = new Image();
            avatarImg.crossOrigin = "anonymous";
            avatarImg.onload = () => {
              imageCacheRef.current[avatarUrl] = avatarImg;
              triggerRedraw();
            };
            avatarImg.src = avatarUrl;
          }

          if (avatarImg && avatarImg.complete) {
            const radius = ((layer.borderRadius ?? 50) / 100) * Math.min(layer.width, layer.height);

            // Draw rounded avatar clipping
            ctx.beginPath();
            if (radius === 0) {
              ctx.rect(layer.x, layer.y, layer.width, layer.height);
            } else {
              ctx.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, radius, 0, Math.PI * 2);
            }
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(avatarImg, layer.x, layer.y, layer.width, layer.height);
            ctx.restore();
            ctx.save();

            // Border
            if (layer.borderWidth && layer.borderWidth > 0) {
              ctx.strokeStyle = layer.borderColor || "#ffffff";
              ctx.lineWidth = layer.borderWidth;
              ctx.beginPath();
              if (radius === 0) {
                ctx.rect(layer.x, layer.y, layer.width, layer.height);
              } else {
                ctx.arc(
                  layer.x + layer.width / 2,
                  layer.y + layer.height / 2,
                  radius - layer.borderWidth / 2,
                  0,
                  Math.PI * 2
                );
              }
              ctx.closePath();
              ctx.stroke();
            }
          }
          break;

        case "text":
          ctx.fillStyle = layer.color || "#ffffff";
          ctx.font = `${layer.fontWeight || "normal"} ${layer.fontSize || 24}px Inter, sans-serif`;
          ctx.textAlign = layer.textAlign || "center";
          ctx.textBaseline = "middle";

          const processedText = replaceVars(layer.text || "");

          if (layer.textAlign === "center") {
            ctx.fillText(processedText, layer.x + layer.width / 2, layer.y + layer.height / 2);
          } else if (layer.textAlign === "right") {
            ctx.fillText(processedText, layer.x + layer.width, layer.y + layer.height / 2);
          } else {
            ctx.fillText(processedText, layer.x, layer.y + layer.height / 2);
          }
          break;
      }

      // Selection overlay
      if (layer.id === selectedLayerId) {
        ctx.strokeStyle = "#5865F2";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);

        // Draw little handles
        ctx.fillStyle = "#5865F2";
        ctx.fillRect(layer.x - 4, layer.y - 4, 8, 8);
        ctx.fillRect(layer.x + layer.width - 4, layer.y - 4, 8, 8);
        ctx.fillRect(layer.x - 4, layer.y + layer.height - 4, 8, 8);
        ctx.fillRect(layer.x + layer.width - 4, layer.y + layer.height - 4, 8, 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }, [cardConfig, isLeave, selectedLayerId, triggerRedraw]);

  const getLayerAtPosition = (x: number, y: number) => {
    if (!canvasRef.current || !cardConfig) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Convert click coordinates to canvas logical scale
    const scaledX = ((x - rect.left) / rect.width) * cardConfig.width;
    const scaledY = ((y - rect.top) / rect.height) * cardConfig.height;

    // Traverse layers backwards (top layers first)
    return [...cardConfig.layers].reverse().find(layer => {
      return (
        layer.visible &&
        scaledX >= layer.x &&
        scaledX <= layer.x + layer.width &&
        scaledY >= layer.y &&
        scaledY <= layer.y + layer.height
      );
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const layer = getLayerAtPosition(e.clientX, e.clientY);
    if (layer) {
      setIsDragging(true);
      onLayerSelect(layer.id);

      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaledX = ((e.clientX - rect.left) / rect.width) * cardConfig.width;
      const scaledY = ((e.clientY - rect.top) / rect.height) * cardConfig.height;

      setDragOffset({
        x: scaledX - layer.x,
        y: scaledY - layer.y
      });
    } else {
      onLayerSelect(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedLayerId || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaledX = ((e.clientX - rect.left) / rect.width) * cardConfig.width;
    const scaledY = ((e.clientY - rect.top) / rect.height) * cardConfig.height;

    onLayerDrag(selectedLayerId, {
      x: Math.round(scaledX - dragOffset.x),
      y: Math.round(scaledY - dragOffset.y)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative border border-neutral-700/60 rounded-lg overflow-hidden bg-neutral-900/40 p-2">
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded cursor-crosshair border border-neutral-800"
        style={{ aspectRatio: `${cardConfig?.width || 800} / ${cardConfig?.height || 400}` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute top-4 right-4 bg-black/70 text-[10px] uppercase font-bold text-neutral-400 px-2 py-1 rounded border border-neutral-700 select-none">
        Layer Editor Interattivo
      </div>
    </div>
  );
};


// Main App
export default function App() {
  if (!isAuthenticated()) {
    return <LoginTailwind />;
  }

  const handleLogout = () => {
    removeAccessToken();
    window.location.href = "/";
  };

  const [activeTab, setActiveTab] = useState<"home" | "welcome" | "leave" | "autorole" | "messages" | "voice" | "logs">("home");

  // Server Status & Logs state
  const [botStatus, setBotStatus] = useState<BotStatus>({
    online: true,
    platform: "Railway",
    uptime: "3d 4h 12m",
    guildsCount: 3,
    membersCount: 412,
    ping: "24ms",
    logs: [],
    repoUrl: "https://github.com/N0ctura/Ade"
  });

  // Complete Configuration state
  const [configs, setConfigs] = useState<ModuleConfig>({
    welcome: {
      enabled: true,
      channelId: "112233445566778899",
      message: "Benvenuto {user} nel server! Leggi il regolamento.",
      card: { width: 800, height: 400, layers: [] }
    },
    leave: {
      enabled: true,
      channelId: "112233445566778800",
      message: "Ci mancherai, {username}!",
      card: { width: 800, height: 400, layers: [] }
    },
    autoRole: {
      enabled: true,
      roleIds: ["112233445566778801"],
      roles: []
    },
    tts: {
      enabled: false,
      sourceChannelId: "112233445566778805",
      voiceChannelId: "112233445566778806",
      language: "it",
      prefixes: [",", ";", "!"]
    },
    scheduledMessages: [],
    logsConfig: {
      enabled: true,
      channelId: "112233445566778810",
      interceptApps: true,
      interceptUsers: true
    }
  });

  // Intercepted Deleted/Modified Logs State
  const [deletedModifiedLogs, setDeletedModifiedLogs] = useState<DeletedModifiedLog[]>([]);

  // UI Support States
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState<string>("");

  // Preset Unsplash backgrounds for easy decoration
  const bgPresets = [
    { name: "Neon Synth", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80" },
    { name: "Minimal Dark", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80" },
    { name: "Astral Nebula", url: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&auto=format&fit=crop&q=80" },
    { name: "Cosmic Glow", url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80" },
  ];

  // Forms state for Scheduled Messages
  const [schedChannel, setSchedChannel] = useState("112233445566778805");
  const [schedText, setSchedText] = useState("");
  const [schedInterval, setSchedInterval] = useState("daily");
  const [customInterval, setCustomInterval] = useState("");
  const [schedEnabled, setSchedEnabled] = useState(true);

  // Helper Toast trigger
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Fetch initial data from server
  const loadData = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/bot/status");
      if (statusRes.ok) {
        const data = await statusRes.json();
        setBotStatus(data);
      }

      const configRes = await fetch("/api/bot/config");
      if (configRes.ok) {
        const data = await configRes.json();
        setConfigs(data);
      }

      const logsRes = await fetch("/api/bot/logs/deleted-modified");
      if (logsRes.ok) {
        const data = await logsRes.json();
        setDeletedModifiedLogs(data);
      }
    } catch (err) {
      console.error("Error loading server-side dashboard data:", err);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Set simulated clock for local UTC status
    const updateTime = () => {
      const now = new Date();
      setSimulatedTime(now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [loadData]);

  // General Post Config Saver
  const saveSection = async (section: keyof ModuleConfig, payload: any, message: string) => {
    try {
      const res = await fetch(`/api/bot/config/${section}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(prev => ({
          ...prev,
          [section]: data.config
        }));
        showToast(message, "success");
        // Reload status to fetch fresh log entries
        const statusRes = await fetch("/api/bot/status");
        if (statusRes.ok) {
          const freshStatus = await statusRes.json();
          setBotStatus(prev => ({ ...prev, logs: freshStatus.logs }));
        }
      } else {
        showToast("Errore durante il salvataggio", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Errore di rete", "error");
    }
  };

  // Interactive Layer Modifiers
  const updateActiveCardLayer = (section: "welcome" | "leave", updatedLayer: CardLayer) => {
    const card = configs[section].card;
    const updatedLayers = card.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l);

    setConfigs(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        card: {
          ...card,
          layers: updatedLayers
        }
      }
    }));
  };

  const addCardLayer = (section: "welcome" | "leave", type: "image" | "text" | "avatar") => {
    const card = configs[section].card;
    const id = `${type}-${Date.now()}`;

    let newLayer: CardLayer = {
      id,
      type,
      visible: true,
      x: 150,
      y: 150,
      width: type === "text" ? 400 : 120,
      height: type === "text" ? 40 : 120,
    };

    if (type === "text") {
      newLayer = {
        ...newLayer,
        text: "Nuovo Testo Personalizzato",
        fontSize: 22,
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "center"
      };
    } else if (type === "avatar") {
      newLayer = {
        ...newLayer,
        x: 340,
        y: 60,
        borderWidth: 4,
        borderColor: "#5865f2",
        borderRadius: 50
      };
    } else if (type === "image") {
      newLayer = {
        ...newLayer,
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80"
      };
    }

    setConfigs(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        card: {
          ...card,
          layers: [...card.layers, newLayer]
        }
      }
    }));
    setSelectedLayerId(id);
    showToast(`Layer ${type} aggiunto con successo!`);
  };

  const deleteCardLayer = (section: "welcome" | "leave", layerId: string) => {
    const card = configs[section].card;
    setConfigs(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        card: {
          ...card,
          layers: card.layers.filter(l => l.id !== layerId)
        }
      }
    }));
    setSelectedLayerId(null);
    showToast("Layer eliminato");
  };

  const moveLayerOrder = (section: "welcome" | "leave", index: number, direction: "up" | "down") => {
    const card = configs[section].card;
    const newLayers = [...card.layers];
    const targetIndex = direction === "up" ? index + 1 : index - 1;

    if (targetIndex < 0 || targetIndex >= newLayers.length) return;

    // Swap layers
    const temp = newLayers[index];
    newLayers[index] = newLayers[targetIndex];
    newLayers[targetIndex] = temp;

    setConfigs(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        card: {
          ...card,
          layers: newLayers
        }
      }
    }));
  };

  const handleLayerDrag = (section: "welcome" | "leave", id: string, position: { x: number; y: number }) => {
    const card = configs[section].card;
    const layer = card.layers.find(l => l.id === id);
    if (layer) {
      updateActiveCardLayer(section, { ...layer, ...position });
    }
  };

  // Scheduled Messages operations
  const handleAddScheduledMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedText.trim()) {
      showToast("Il testo del messaggio non può essere vuoto", "error");
      return;
    }

    const interval = schedInterval === "custom" ? (customInterval.trim() || "30m") : schedInterval;

    const newMessage = {
      id: `sched-${Date.now()}`,
      channelId: schedChannel,
      message: schedText,
      isRecurring: true,
      recurrenceInterval: interval,
      enabled: schedEnabled
    };

    const updatedList = [...configs.scheduledMessages, newMessage];
    await saveSection("scheduledMessages", updatedList, "Messaggio automatico salvato correttamente!");
    setSchedText("");
    setCustomInterval("");
  };

  const handleDeleteScheduledMessage = async (id: string) => {
    const updatedList = configs.scheduledMessages.filter(msg => msg.id !== id);
    await saveSection("scheduledMessages", updatedList, "Messaggio automatico eliminato");
  };

  // Restart Bot Action simulation
  const handleRestartBot = () => {
    setIsRestarting(true);
    showToast("Segnale di riavvio inviato a Railway...");
    setTimeout(async () => {
      setIsRestarting(false);
      showToast("AdeBot riavviato e connesso con successo!", "success");

      // Update logs in server
      try {
        await fetch("/api/bot/status");
        await loadData();
      } catch (err) {
        console.error(err);
      }
    }, 2000);
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/bot/logs/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBotStatus(prev => ({ ...prev, logs: data.logs }));
        showToast("Console logs svuotati.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateDeletedModified = async () => {
    try {
      const res = await fetch("/api/bot/logs/deleted-modified/simulate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDeletedModifiedLogs(data.logs);
        showToast(`Simulazione riuscita: Messaggio ${data.log.type === "deleted" ? "Eliminato" : "Modificato"}!`);

        // Refresh console log list as well
        const statusRes = await fetch("/api/bot/status");
        if (statusRes.ok) {
          const freshStatus = await statusRes.json();
          setBotStatus(prev => ({ ...prev, logs: freshStatus.logs }));
        }
      }
    } catch (e) {
      console.error(e);
      showToast("Errore di rete nella simulazione", "error");
    }
  };

  const handleClearDeletedModifiedLogs = async () => {
    try {
      const res = await fetch("/api/bot/logs/deleted-modified/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDeletedModifiedLogs(data.logs);
        showToast("Log dei messaggi svuotati correttamente.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter logs locally based on type
  const filteredLogs = botStatus.logs.filter(log => {
    if (logFilter === "all") return true;
    return log.type === logFilter;
  });

  return (
    <div className="flex h-screen bg-[#111214] text-neutral-200 overflow-hidden font-sans select-none">

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl transition-all duration-300 animate-slide-up ${toastMessage.type === "success"
          ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
          : "bg-rose-950/90 border-rose-500/40 text-rose-300"
          }`}>
          <div className={`w-2 h-2 rounded-full ${toastMessage.type === "success" ? "bg-emerald-400" : "bg-rose-400"}`} />
          <span className="text-sm font-medium">{toastMessage.text}</span>
          <button className="text-neutral-400 hover:text-white ml-2" onClick={() => setToastMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Left Navigation Sidebar */}
      <aside className="w-72 bg-[#1e1f22] flex flex-col justify-between border-r border-[#202225] select-none">
        <div>
          {/* Brand Identity Header */}
          <div className="p-6 border-b border-neutral-900 bg-neutral-950/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img
                src="https://raw.githubusercontent.com/N0ctura/Ade/main/dashboard/public/celestial-logo-slim.png"
                alt="Celestial Logo"
                className="h-9 w-auto object-contain rounded"
                referrerPolicy="no-referrer"
              />
              <div className="h-4 w-px bg-neutral-800" />
              <h1 className="font-bold text-neutral-100 tracking-tight text-base">
                Ade Control
              </h1>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 font-mono">
                <Server className="w-3 h-3 text-emerald-500" />
                <span>Dev By R0ck</span>
              </p>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          {/* Navigation Links List */}
          <div className="p-4 space-y-1 overflow-y-auto">
            <span className="px-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
              Panoramica
            </span>
            <button
              onClick={() => { setActiveTab("home"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "home"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard Casa</span>
            </button>

            <span className="px-3 pt-4 text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
              Moduli Welcome & Leave
            </span>
            <button
              onClick={() => { setActiveTab("welcome"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "welcome"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Messaggio Welcome</span>
            </button>
            <button
              onClick={() => { setActiveTab("leave"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "leave"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Messaggio Leave</span>
            </button>
            <button
              onClick={() => { setActiveTab("autorole"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "autorole"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Auto Ruolo automatico</span>
            </button>

            <span className="px-3 pt-4 text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
              Funzioni Bot
            </span>
            <button
              onClick={() => { setActiveTab("messages"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "messages"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Messaggi Automatici</span>
            </button>
            <button
              onClick={() => { setActiveTab("voice"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "voice"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Lettore Vocale TTS</span>
            </button>
            <button
              onClick={() => { setActiveTab("logs"); setSelectedLayerId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === "logs"
                ? "bg-[#5865F2] text-white font-semibold"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                }`}
            >
              <Activity className="w-4 h-4 text-rose-400" />
              <span>Log Messaggi</span>
            </button>
          </div>
        </div>

        {/* Quick System Action Drawer footer */}
        <div className="p-4 bg-neutral-950/30 border-t border-neutral-900">
          <div className="flex items-center justify-between mb-3 text-xs font-mono text-neutral-500">
            <span>PING: {botStatus.ping}</span>
            <span className="text-neutral-400">{simulatedTime}</span>
          </div>
          <button
            onClick={handleRestartBot}
            disabled={isRestarting}
            className="w-full py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-900/40 text-white rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-2 border border-rose-500/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRestarting ? "animate-spin" : ""}`} />
            <span>{isRestarting ? "RIAVVIO..." : "RIAVVIA BOT SU RAILWAY"}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <main className="flex-1 bg-[#313338] overflow-y-auto flex flex-col">

        {/* Upper Dashboard Sub-Header */}
        <header className="bg-[#313338] px-8 py-5 border-b border-[#202225] flex justify-between items-center shrink-0 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-white">
              {activeTab === "home" && "Ade Bot Control Panel"}
              {activeTab === "welcome" && "Configurazione Welcome Card"}
              {activeTab === "leave" && "Configurazione Leave Card"}
              {activeTab === "autorole" && "Configurazione Auto-Ruolo"}
              {activeTab === "messages" && "Messaggi Ricorrenti Programmati"}
              {activeTab === "voice" && "Configurazione Lettore Vocale TTS"}
              {activeTab === "logs" && "Log dei Messaggi Eliminati & Modificati"}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              {activeTab === "home" && "Stato generale del bot Discord hostato su Railway."}
              {activeTab === "welcome" && "Costruisci o modifica la scheda grafica di benvenuto con il canvas trascinabile."}
              {activeTab === "leave" && "Disegna un cartello di addio interattivo per gli utenti che escono."}
              {activeTab === "autorole" && "Assegna in modo istantaneo uno o più ruoli predefiniti al nuovo iscritto."}
              {activeTab === "messages" && "Invia messaggi in loop o cadenzati ad intervalli regolari sui canali del server."}
              {activeTab === "voice" && "Leggi i testi in canali vocali Discord utilizzando la sintesi vocale multilingua."}
              {activeTab === "logs" && "Intercetta e visualizza i messaggi modificati ed eliminati di qualsiasi utente o bot Discord in tempo reale."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono font-bold text-neutral-300 bg-neutral-950/30 px-3 py-1.5 rounded-lg border border-neutral-800">
              {botStatus.platform} Host
            </span>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-neutral-400 hover:text-rose-400" />
            </button>
          </div>
        </header>

        {/* Inner Content Grid */}
        <div className="p-8 flex-1">

          {/* TAB: HOME */}
          {activeTab === "home" && (
            <div className="space-y-8 animate-fade-in">

              {/* Brand Banner */}
              <div className="relative bg-gradient-to-r from-neutral-900 to-[#1e1f22] border border-neutral-800 rounded-2xl p-8 overflow-hidden shadow-xl flex flex-col md:flex-row items-center gap-6 justify-between">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-5">
                  <div className="bg-neutral-950/40 p-3 rounded-2xl border border-neutral-800">
                    <img
                      src="https://raw.githubusercontent.com/N0ctura/Ade/main/dashboard/public/celestial-logo.png"
                      alt="Celestial Logo"
                      className="w-20 h-20 object-contain rounded-xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Ade Bot Control Panel</h3>
                    <p className="text-sm text-neutral-400 mt-1 max-w-xl">
                      Benvenuto nel pannello di controllo ufficiale di <strong>AdeBot</strong>.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1 font-mono text-xs text-neutral-400">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    SYSTEM STABLE
                  </span>
                  <span>LATENZA GATEWAY: {botStatus.ping}</span>
                </div>
              </div>

              {/* Bot status indicators */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#2b2d31] border border-neutral-800 p-5 rounded-xl shadow-lg">
                  <span className="text-xs text-neutral-400 font-medium block">Membri Totali</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-white">{botStatus.membersCount}</span>
                    <span className="text-xs text-emerald-400 font-semibold font-mono">Pronto</span>
                  </div>
                </div>

                <div className="bg-[#2b2d31] border border-neutral-800 p-5 rounded-xl shadow-lg">
                  <span className="text-xs text-neutral-400 font-medium block">Uptime del Processo</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-white font-mono">{botStatus.uptime}</span>
                  </div>
                </div>

                <div className="bg-[#2b2d31] border border-neutral-800 p-5 rounded-xl shadow-lg">
                  <span className="text-xs text-neutral-400 font-medium block">Server Connessi</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-white">{botStatus.guildsCount}</span>
                    <span className="text-xs text-neutral-400">Server</span>
                  </div>
                </div>

                <div className="bg-[#2b2d31] border border-neutral-800 p-5 rounded-xl shadow-lg">
                  <span className="text-xs text-neutral-400 font-medium block">Velocità Gateway</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-indigo-400 font-mono">{botStatus.ping}</span>
                  </div>
                </div>
              </div>

              {/* Quick Config modules grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Active Modules summary card */}
                <div className="bg-[#2b2d31] border border-neutral-800 rounded-xl overflow-hidden shadow-lg lg:col-span-1">
                  <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/20 flex justify-between items-center">
                    <h3 className="font-bold text-sm text-neutral-200">Stato Moduli</h3>
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-neutral-900/30 rounded-lg border border-neutral-800/40">
                      <span className="text-xs font-semibold text-neutral-300">Modulo Benvenuto</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${configs.welcome.enabled ? "bg-emerald-950 text-emerald-400 border border-emerald-900/50" : "bg-neutral-800 text-neutral-500"}`}>
                        {configs.welcome.enabled ? "ATTIVO" : "DISATTIVATO"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-neutral-900/30 rounded-lg border border-neutral-800/40">
                      <span className="text-xs font-semibold text-neutral-300">Modulo Addio</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${configs.leave.enabled ? "bg-emerald-950 text-emerald-400 border border-emerald-900/50" : "bg-neutral-800 text-neutral-500"}`}>
                        {configs.leave.enabled ? "ATTIVO" : "DISATTIVATO"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-neutral-900/30 rounded-lg border border-neutral-800/40">
                      <span className="text-xs font-semibold text-neutral-300">Assegnazione Ruoli</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${configs.autoRole.enabled ? "bg-emerald-950 text-emerald-400 border border-emerald-900/50" : "bg-neutral-800 text-neutral-500"}`}>
                        {configs.autoRole.enabled ? "ATTIVO" : "DISATTIVATO"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-neutral-900/30 rounded-lg border border-neutral-800/40">
                      <span className="text-xs font-semibold text-neutral-300">Lettore Vocale TTS</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${configs.tts.enabled ? "bg-emerald-950 text-emerald-400 border border-emerald-900/50" : "bg-neutral-800 text-neutral-500"}`}>
                        {configs.tts.enabled ? "ATTIVO" : "DISATTIVATO"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Git Repository Card */}
                <div className="bg-[#2b2d31] border border-neutral-800 rounded-xl overflow-hidden shadow-lg lg:col-span-2">
                  <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/20 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-neutral-200">GitHub Repository & Railway</h3>
                    <span className="text-xs font-mono text-indigo-400 font-semibold select-all">N0ctura/Ade</span>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Il codice è mio! però tieni:
                    </p>
                    <div className="p-4 bg-neutral-950/25 border border-neutral-800/80 rounded-lg space-y-2 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Repository URL:</span>
                        <a href={botStatus.repoUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                          {botStatus.repoUrl}
                        </a>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Branch principale:</span>
                        <span className="text-neutral-300">main</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Stato del Deployment:</span>
                        <span className="text-emerald-400 font-semibold">Deploy riuscito (Railway)</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <a
                        href={botStatus.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-xs rounded-lg transition-colors border border-[#5865F2]/20 text-center flex items-center justify-center gap-1.5 uppercase tracking-wider"
                      >
                        <Server className="w-3.5 h-3.5 text-white/80" />
                        <span>Apri Repository GitHub</span>
                      </a>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}


          {/* TAB: WELCOME & LEAVE LAYERS */}
          {(activeTab === "welcome" || activeTab === "leave") && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-[#2b2d31] border border-neutral-800 rounded-xl p-6 shadow-lg space-y-6">

                {/* Enable module toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-neutral-900/20 border border-neutral-800 rounded-lg">
                  <div>
                    <h3 className="text-sm font-bold text-white capitalize">
                      Stato Modulo Grafico {activeTab}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Abilita o disabilita l'invio della scheda di {activeTab} nei canali Discord.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        const updated = !configs[activeTab].enabled;
                        saveSection(activeTab, { ...configs[activeTab], enabled: updated }, `Modulo grafico ${activeTab} ${updated ? 'abilitato' : 'disattivato'}!`);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${configs[activeTab].enabled ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${configs[activeTab].enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Configuration Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Canale Discord di Inizio</label>
                    <select
                      value={configs[activeTab].channelId}
                      onChange={(e) => {
                        saveSection(activeTab, { ...configs[activeTab], channelId: e.target.value }, "Canale aggiornato!");
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800/80 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="112233445566778899">#generale</option>
                      <option value="112233445566778800">#welcome-log</option>
                      <option value="112233445566778805">#comandi-bot</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Messaggio di accompagnamento</label>
                    <input
                      type="text"
                      value={configs[activeTab].message}
                      onChange={(e) => {
                        setConfigs(prev => ({
                          ...prev,
                          [activeTab]: {
                            ...prev[activeTab],
                            message: e.target.value
                          }
                        }));
                      }}
                      onBlur={() => {
                        saveSection(activeTab, configs[activeTab], "Messaggio testuale salvato!");
                      }}
                      placeholder="Usa {user}, {username}, {guild}, {memberCount}"
                      className="w-full bg-neutral-900 border border-neutral-800/80 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* VISUAL LAYERS EDITOR & PREVIEWER */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pt-4 border-t border-neutral-800/80">

                  {/* Canvas interactive Area */}
                  <div className="xl:col-span-8 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-neutral-400 uppercase flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <span>Anteprima Grafica del Card (800x400)</span>
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">Trascina gli elementi per spostarli</span>
                    </div>

                    <CardCanvasPreview
                      cardConfig={configs[activeTab].card}
                      isLeave={activeTab === "leave"}
                      selectedLayerId={selectedLayerId}
                      onLayerSelect={setSelectedLayerId}
                      onLayerDrag={(id, pos) => handleLayerDrag(activeTab, id, pos)}
                    />

                    {/* Presets Background Chooser */}
                    <div className="bg-neutral-900/35 border border-neutral-800 p-4 rounded-xl space-y-3">
                      <span className="text-xs font-bold text-neutral-400 uppercase block">Seleziona Sfondo Predefinito</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {bgPresets.map((preset, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              const bgLayer = configs[activeTab].card.layers.find(l => l.id === "bg");
                              if (bgLayer) {
                                updateActiveCardLayer(activeTab, { ...bgLayer, url: preset.url });
                                saveSection(activeTab, configs[activeTab], `Sfondo ${preset.name} impostato!`);
                              }
                            }}
                            className="text-left group relative h-16 rounded-lg overflow-hidden border border-neutral-800 hover:border-indigo-500 transition-all focus:outline-none"
                          >
                            <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors" />
                            <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Layers control sidebars */}
                  <div className="xl:col-span-4 space-y-6">

                    {/* Layer List panel */}
                    <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase">Oggetti Grafici</h4>
                        <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-400 font-mono">Render list</span>
                      </div>

                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                        {[...configs[activeTab].card.layers].reverse().map((layer, index) => {
                          const originalIndex = configs[activeTab].card.layers.length - 1 - index;
                          const isSelected = selectedLayerId === layer.id;
                          return (
                            <div
                              key={layer.id}
                              onClick={() => setSelectedLayerId(layer.id)}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${isSelected
                                ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/10"
                                : "bg-[#2b2d31]/80 text-neutral-300 hover:bg-[#2b2d31]"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                {layer.visible ? <Eye className="w-3.5 h-3.5 opacity-80" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                                <span className="text-xs truncate font-mono">{layer.type} ({layer.id})</span>
                              </div>

                              {layer.type !== "background" && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); moveLayerOrder(activeTab, originalIndex, "down"); }}
                                    disabled={originalIndex === 0}
                                    className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 rounded hover:bg-black/10"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); moveLayerOrder(activeTab, originalIndex, "up"); }}
                                    disabled={originalIndex === configs[activeTab].card.layers.length - 1}
                                    className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 rounded hover:bg-black/10"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800/80">
                        <button
                          onClick={() => addCardLayer(activeTab, "text")}
                          className="py-1.5 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded text-[10px] font-bold uppercase transition-colors"
                        >
                          + TESTO
                        </button>
                        <button
                          onClick={() => addCardLayer(activeTab, "avatar")}
                          className="py-1.5 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded text-[10px] font-bold uppercase transition-colors"
                        >
                          + AVATAR
                        </button>
                        <button
                          onClick={() => addCardLayer(activeTab, "image")}
                          className="py-1.5 bg-neutral-800 hover:bg-neutral-700 hover:text-white rounded text-[10px] font-bold uppercase transition-colors"
                        >
                          + IMMAGINE
                        </button>
                      </div>
                    </div>

                    {/* Specific properties editor */}
                    <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl space-y-4">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase">Proprietà Layer Attivo</h4>

                      {selectedLayerId ? (
                        (() => {
                          const layer = configs[activeTab].card.layers.find(l => l.id === selectedLayerId);
                          if (!layer) return null;
                          return (
                            <div className="space-y-4">
                              {/* Position Grid */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Asse X</span>
                                  <input
                                    type="number"
                                    value={layer.x}
                                    onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, x: Number(e.target.value) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-xs text-center font-mono focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Asse Y</span>
                                  <input
                                    type="number"
                                    value={layer.y}
                                    onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, y: Number(e.target.value) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-xs text-center font-mono focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Larghezza</span>
                                  <input
                                    type="number"
                                    value={layer.width}
                                    onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, width: Number(e.target.value) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-xs text-center font-mono focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Altezza</span>
                                  <input
                                    type="number"
                                    value={layer.height}
                                    onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, height: Number(e.target.value) })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-xs text-center font-mono focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Layer Specific fields */}
                              {layer.type === "text" && (
                                <div className="space-y-3 pt-2 border-t border-neutral-800/80">
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Contenuto Testo</span>
                                    <input
                                      type="text"
                                      value={layer.text || ""}
                                      onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, text: e.target.value })}
                                      className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs focus:outline-none"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Dimensione</span>
                                      <input
                                        type="number"
                                        value={layer.fontSize || 20}
                                        onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, fontSize: Number(e.target.value) })}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-xs font-mono focus:outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Colore</span>
                                      <input
                                        type="color"
                                        value={layer.color || "#ffffff"}
                                        onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, color: e.target.value })}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded h-8 p-0.5 cursor-pointer focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {layer.type === "avatar" && (
                                <div className="space-y-3 pt-2 border-t border-neutral-800/80">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Spessore Bordo</span>
                                      <input
                                        type="number"
                                        value={layer.borderWidth || 0}
                                        onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, borderWidth: Number(e.target.value) })}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-xs font-mono focus:outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Colore Bordo</span>
                                      <input
                                        type="color"
                                        value={layer.borderColor || "#ffffff"}
                                        onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, borderColor: e.target.value })}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded h-8 p-0.5 cursor-pointer focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {layer.type === "image" && (
                                <div className="space-y-1 pt-2 border-t border-neutral-800/80">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase">URL Immagine Esterna</span>
                                  <input
                                    type="text"
                                    value={layer.url || ""}
                                    onChange={(e) => updateActiveCardLayer(activeTab, { ...layer, url: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs font-mono focus:outline-none"
                                  />
                                </div>
                              )}

                              <div className="pt-4 flex gap-2">
                                <button
                                  onClick={() => saveSection(activeTab, configs[activeTab], "Modifica layer salvata correttamente!")}
                                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded transition-colors"
                                >
                                  SALVA
                                </button>
                                {layer.type !== "background" && (
                                  <button
                                    onClick={() => deleteCardLayer(activeTab, layer.id)}
                                    className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded transition-colors"
                                    title="Elimina layer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-xs text-neutral-500 italic text-center py-4">Seleziona un oggetto sul canvas o nella lista per personalizzarlo.</div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}


          {/* TAB: AUTOROLE */}
          {activeTab === "autorole" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-[#2b2d31] border border-neutral-800 rounded-xl p-6 shadow-lg space-y-6">

                {/* AutoRole Enabled card */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-neutral-900/20 border border-neutral-800 rounded-lg">
                  <div>
                    <h3 className="text-sm font-bold text-white">Stato Modulo AutoRuolo</h3>
                    <p className="text-xs text-neutral-400">Assegna un ruolo specifico automaticamente all'utente non appena entra nel server.</p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        const updated = !configs.autoRole.enabled;
                        saveSection("autoRole", { ...configs.autoRole, enabled: updated }, `AutoRuolo ${updated ? 'attivato' : 'disattivato'}!`);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${configs.autoRole.enabled ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${configs.autoRole.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Role List Selector */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase">Ruoli del Server Discord</h4>
                  <p className="text-xs text-neutral-500">Seleziona i ruoli che verranno assegnati ai nuovi membri:</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: "112233445566778801", name: "Membro", color: "text-blue-400 bg-blue-950/20 border-blue-900/50" },
                      { id: "112233445566778802", name: "Novizio", color: "text-emerald-400 bg-emerald-950/20 border-emerald-900/50" },
                      { id: "112233445566778803", name: "Adepto", color: "text-purple-400 bg-purple-950/20 border-purple-900/50" },
                      { id: "112233445566778804", name: "Moderatore", color: "text-rose-400 bg-rose-950/20 border-rose-900/50" },
                    ].map((role) => {
                      const isSelected = configs.autoRole.roleIds.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          onClick={() => {
                            if (!configs.autoRole.enabled) return;
                            const updatedList = isSelected
                              ? configs.autoRole.roleIds.filter(id => id !== role.id)
                              : [...configs.autoRole.roleIds, role.id];
                            saveSection("autoRole", { ...configs.autoRole, roleIds: updatedList }, "Ruoli aggiornati!");
                          }}
                          className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                            ? `${role.color} ring-1 ring-indigo-500/20`
                            : "bg-neutral-900/40 border-neutral-800/80 text-neutral-400 hover:bg-neutral-900"
                            } ${!configs.autoRole.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-current" />
                            <span className="text-sm font-semibold text-neutral-200">{role.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* TAB: SCHEDULED MESSAGES */}
          {activeTab === "messages" && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Add/Create loop message */}
                <div className="lg:col-span-5 bg-[#2b2d31] border border-neutral-800 p-6 rounded-xl shadow-lg space-y-6">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    <span>Nuovo Messaggio Automatico</span>
                  </h3>

                  <form onSubmit={handleAddScheduledMessage} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-400 uppercase">Canale Discord di Destinazione</label>
                      <select
                        value={schedChannel === "112233445566778805" || schedChannel === "112233445566778899" || schedChannel === "112233445566778810" ? schedChannel : "custom"}
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            setSchedChannel("");
                          } else {
                            setSchedChannel(e.target.value);
                          }
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                      >
                        <option value="112233445566778805">#comandi-bot</option>
                        <option value="112233445566778899">#generale</option>
                        <option value="112233445566778810">#log-messaggi</option>
                        <option value="custom">✍️ Inserisci ID Canale Personalizzato...</option>
                      </select>

                      {(schedChannel !== "112233445566778805" && schedChannel !== "112233445566778899" && schedChannel !== "112233445566778810") && (
                        <div className="pt-2 animate-fade-in">
                          <input
                            type="text"
                            value={schedChannel}
                            onChange={(e) => setSchedChannel(e.target.value)}
                            placeholder="Esempio: 112233445566778822 o #news"
                            className="w-full bg-[#1e1f22] border border-neutral-800 px-3 py-2 rounded-lg text-xs font-mono text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                          <p className="text-[10px] text-neutral-500 mt-1">Digita l'ID del canale Discord o il nome desiderato.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-400 uppercase">Intervallo di Ripetizione</label>
                      <select
                        value={schedInterval}
                        onChange={(e) => setSchedInterval(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="hourly">Ogni ora</option>
                        <option value="12h">Ogni 12 ore</option>
                        <option value="daily">Ogni giorno (24 ore)</option>
                        <option value="weekly">Ogni settimana</option>
                        <option value="custom">⏱️ Intervallo Personalizzato...</option>
                      </select>

                      {schedInterval === "custom" && (
                        <div className="pt-2 animate-fade-in">
                          <input
                            type="text"
                            value={customInterval}
                            onChange={(e) => setCustomInterval(e.target.value)}
                            placeholder="Esempio: 15m, 45m, 3h, 2d, ecc."
                            className="w-full bg-[#1e1f22] border border-neutral-800 px-3 py-2 rounded-lg text-xs font-mono text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                          <p className="text-[10px] text-neutral-500 mt-1">Specifica un tempo personalizzato (es: 30m = 30 minuti, 6h = 6 ore).</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-400 uppercase">Contenuto Messaggio</label>
                      <textarea
                        value={schedText}
                        onChange={(e) => setSchedText(e.target.value)}
                        placeholder="Esempio: Ricordatevi di iscrivervi al nostro canale Twitch per eventi esclusivi!"
                        rows={4}
                        className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-neutral-900/35 border border-neutral-800/80 rounded-lg">
                      <span className="text-xs font-semibold text-neutral-300">Attiva Messaggio</span>
                      <button
                        type="button"
                        onClick={() => setSchedEnabled(!schedEnabled)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${schedEnabled ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${schedEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs rounded-lg transition-colors text-white uppercase tracking-wider"
                    >
                      Aggiungi alla Coda
                    </button>
                  </form>
                </div>

                {/* Queue / Message List */}
                <div className="lg:col-span-7 bg-[#2b2d31] border border-neutral-800 p-6 rounded-xl shadow-lg space-y-6">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                    <span>Coda Messaggi Attivi ({configs.scheduledMessages.length})</span>
                  </h3>

                  {configs.scheduledMessages.length === 0 ? (
                    <div className="text-sm text-neutral-500 italic py-12 text-center border border-dashed border-neutral-800 rounded-xl bg-neutral-900/10">
                      Nessun messaggio automatico configurato in memoria.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {configs.scheduledMessages.map((msg) => (
                        <div key={msg.id} className="p-4 bg-neutral-900/35 border border-neutral-800/80 rounded-xl space-y-3 shadow-sm hover:border-neutral-700 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-indigo-950 text-indigo-400 font-bold border border-indigo-900/40 px-2 py-0.5 rounded font-mono">
                                {msg.recurrenceInterval}
                              </span>
                              <span className="text-xs text-indigo-400 font-bold font-mono">
                                {msg.channelId === "112233445566778805" ? "#comandi-bot" :
                                  msg.channelId === "112233445566778899" ? "#generale" :
                                    msg.channelId === "112233445566778810" ? "#log-messaggi" :
                                      msg.channelId.startsWith("#") ? msg.channelId : `#canale-${msg.channelId}`}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteScheduledMessage(msg.id)}
                              className="text-neutral-500 hover:text-rose-400 p-1 rounded hover:bg-neutral-800 transition-colors"
                              title="Rimuovi messaggio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-neutral-300 leading-relaxed font-mono whitespace-pre-wrap">
                            {msg.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}


          {/* TAB: VOICE & TTS */}
          {activeTab === "voice" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-[#2b2d31] border border-neutral-800 rounded-xl p-6 shadow-lg space-y-6">

                {/* TTS enabled block */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-neutral-900/20 border border-neutral-800 rounded-lg">
                  <div>
                    <h3 className="text-sm font-bold text-white">Stato Lettore Vocale TTS</h3>
                    <p className="text-xs text-neutral-400">Quando abilitato, il bot entra in canale vocale e legge i messaggi del canale testuale scelto.</p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        const updated = !configs.tts.enabled;
                        saveSection("tts", { ...configs.tts, enabled: updated }, `TTS ${updated ? 'attivato' : 'disattivato'}!`);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${configs.tts.enabled ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${configs.tts.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Configuration controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Canale Testuale (Sorgente)</label>
                    <select
                      value={configs.tts.sourceChannelId}
                      onChange={(e) => {
                        saveSection("tts", { ...configs.tts, sourceChannelId: e.target.value }, "Canale sorgente aggiornato!");
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800/80 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="112233445566778805">#comandi-bot</option>
                      <option value="112233445566778899">#generale</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Canale Vocale (Destinazione)</label>
                    <select
                      value={configs.tts.voiceChannelId}
                      onChange={(e) => {
                        saveSection("tts", { ...configs.tts, voiceChannelId: e.target.value }, "Canale vocale aggiornato!");
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800/80 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="112233445566778806">🔊 Voice Lounge</option>
                      <option value="112233445566778807">🔊 Sala Giochi</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Lingua di sintesi</label>
                    <select
                      value={configs.tts.language}
                      onChange={(e) => {
                        saveSection("tts", { ...configs.tts, language: e.target.value }, "Lingua TTS salvata!");
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800/80 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="it">Italiano (it-IT)</option>
                      <option value="en">Inglese (en-US)</option>
                      <option value="es">Spagnolo (es-ES)</option>
                      <option value="fr">Francese (fr-FR)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Caratteri di Attivazione (separati da virgola)</label>
                    <input
                      type="text"
                      value={configs.tts.prefixes.join(", ")}
                      onChange={(e) => {
                        const arr = e.target.value.split(",").map(p => p.trim()).filter(p => p);
                        setConfigs(prev => ({
                          ...prev,
                          tts: { ...prev.tts, prefixes: arr }
                        }));
                      }}
                      onBlur={() => {
                        saveSection("tts", configs.tts, "Prefissi TTS salvati correttamente!");
                      }}
                      className="w-full bg-neutral-900 border border-neutral-800/80 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Configuration Panel */}
                <div className="lg:col-span-5 bg-[#2b2d31] border border-neutral-800 p-6 rounded-xl shadow-lg space-y-6">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-400" />
                    <span>Configurazione Intercettatore LOG</span>
                  </h3>

                  {/* Toggle system state */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-neutral-900/20 border border-neutral-800 rounded-lg">
                    <div>
                      <h4 className="text-xs font-bold text-white">Stato Modulo Log</h4>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Abilita o disabilita il tracciamento dei messaggi modificati/eliminati.</p>
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          const updated = !configs.logsConfig.enabled;
                          saveSection("logsConfig", { ...configs.logsConfig, enabled: updated }, `Modulo Log ${updated ? 'attivato' : 'disattivato'}!`);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${configs.logsConfig.enabled ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${configs.logsConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Form fields for settings */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-400 uppercase">Invia Log nel Canale</label>
                      <select
                        value={configs.logsConfig.channelId === "112233445566778810" || configs.logsConfig.channelId === "112233445566778805" || configs.logsConfig.channelId === "112233445566778899" ? configs.logsConfig.channelId : "custom"}
                        onChange={(e) => {
                          const val = e.target.value === "custom" ? "" : e.target.value;
                          saveSection("logsConfig", { ...configs.logsConfig, channelId: val }, "Canale log aggiornato!");
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                      >
                        <option value="112233445566778810">#log-messaggi (default)</option>
                        <option value="112233445566778805">#comandi-bot</option>
                        <option value="112233445566778899">#generale</option>
                        <option value="custom">✍️ Inserisci ID Canale Personalizzato...</option>
                      </select>

                      {(configs.logsConfig.channelId !== "112233445566778810" && configs.logsConfig.channelId !== "112233445566778805" && configs.logsConfig.channelId !== "112233445566778899") && (
                        <div className="pt-2">
                          <input
                            type="text"
                            value={configs.logsConfig.channelId}
                            onChange={(e) => {
                              setConfigs(prev => ({
                                ...prev,
                                logsConfig: { ...prev.logsConfig, channelId: e.target.value }
                              }));
                            }}
                            onBlur={() => {
                              saveSection("logsConfig", configs.logsConfig, "ID Canale log salvato!");
                            }}
                            placeholder="Digita l'ID del canale Discord..."
                            className="w-full bg-[#1e1f22] border border-neutral-800 px-3 py-2 rounded-lg text-xs font-mono text-indigo-400 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Filter targets: App / Bots and Users */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-neutral-400 uppercase">Tracciamento Filtri Target</label>

                      <div className="flex items-center justify-between p-3 bg-neutral-900/40 border border-neutral-800/80 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-neutral-300">Intercetta Modifiche/Eliminazioni di Altri Bot</span>
                          <span className="text-[10px] text-neutral-500">Includi bot musicali, moderation bot, ecc.</span>
                        </div>
                        <button
                          onClick={() => {
                            const updated = !configs.logsConfig.interceptApps;
                            saveSection("logsConfig", { ...configs.logsConfig, interceptApps: updated }, "Filtro tracciamento bot aggiornato!");
                          }}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${configs.logsConfig.interceptApps ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${configs.logsConfig.interceptApps ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-neutral-900/40 border border-neutral-800/80 rounded-lg">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-neutral-300">Intercetta Modifiche/Eliminazioni di Utenti</span>
                          <span className="text-[10px] text-neutral-500">Includi normali utenti iscritti al server Discord.</span>
                        </div>
                        <button
                          onClick={() => {
                            const updated = !configs.logsConfig.interceptUsers;
                            saveSection("logsConfig", { ...configs.logsConfig, interceptUsers: updated }, "Filtro tracciamento utenti aggiornato!");
                          }}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${configs.logsConfig.interceptUsers ? 'bg-indigo-600' : 'bg-neutral-800'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${configs.logsConfig.interceptUsers ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Simulations & Testing box */}
                  <div className="pt-4 border-t border-neutral-800 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase">Simulatore Eventi Live</h4>
                    <p className="text-[10px] text-neutral-500">Simula l'intercettazione in background di un evento Discord per vedere l'embed generato in tempo reale.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleSimulateDeletedModified}
                        className="py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Simula Evento</span>
                      </button>
                      <button
                        onClick={handleClearDeletedModifiedLogs}
                        className="py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Svuota Registro</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feed Log Panel (Discord Embed view) */}
                <div className="lg:col-span-7 bg-[#2b2d31] border border-neutral-800 p-6 rounded-xl shadow-lg space-y-6 flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-rose-400" />
                      <span>Registro Intercettazioni ({deletedModifiedLogs.length})</span>
                    </h3>
                    <span className="text-[10px] bg-rose-950/40 text-rose-400 font-mono border border-rose-900/40 px-2 py-1 rounded font-bold">
                      LIVE FEED
                    </span>
                  </div>

                  {deletedModifiedLogs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-800 rounded-xl bg-neutral-900/10 space-y-3">
                      <div className="p-3 bg-neutral-800/60 rounded-full text-neutral-500">
                        <Activity className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm text-neutral-400 font-semibold">Nessun log intercettato al momento.</p>
                        <p className="text-xs text-neutral-500 mt-1">Usa il pulsante "Simula Evento" per generare dei test.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                      {deletedModifiedLogs.map((log) => {
                        const isDeleted = log.type === "deleted";

                        // Parse simple text into words highlight:
                        // Deleted (Red) -> Red tags
                        // Modified -> OLD (Red/strikethrough) vs NEW (Green)
                        return (
                          <div
                            key={log.id}
                            className={`p-4 bg-[#1e1f22] rounded-lg border-l-4 shadow-md ${isDeleted ? "border-l-[#ed4245]" : "border-l-[#57f287]"
                              } space-y-3 hover:bg-[#1e1f22]/80 transition-colors`}
                          >
                            {/* Author & Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={log.author.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                                  alt={log.author.username}
                                  className="w-7 h-7 rounded-full bg-neutral-800"
                                  referrerPolicy="no-referrer"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-neutral-100">{log.author.username}</span>
                                    {log.author.isBot && (
                                      <span className="text-[9px] bg-[#5865f2] text-white font-bold px-1 py-0.2 rounded font-sans uppercase">
                                        BOT
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-neutral-500">
                                    ID Utente: {Math.floor(Math.random() * 900000) + 100000} • {new Date(log.timestamp).toLocaleTimeString("it-IT")}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-indigo-400 bg-neutral-950/40 border border-neutral-800 px-2.5 py-1 rounded">
                                {log.channel === "112233445566778899" ? "#generale" :
                                  log.channel === "112233445566778805" ? "#comandi-bot" :
                                    log.channel === "112233445566778810" ? "#log-messaggi" : `#canale-${log.channel.slice(-4)}`}
                              </span>
                            </div>

                            {/* Embed Box */}
                            <div className="bg-[#2f3136] p-3 rounded border border-neutral-800 space-y-2">
                              <div className="flex items-center justify-between pb-1 border-b border-neutral-800/40">
                                <span className={`text-[10px] font-bold tracking-wider ${isDeleted ? "text-[#ed4245]" : "text-[#57f287]"}`}>
                                  {isDeleted ? "⚠️ MESSAGGIO ELIMINATO" : "✏️ MESSAGGIO MODIFICATO"}
                                </span>
                                <span className="text-[9px] text-neutral-400 font-mono">embed log visualizer</span>
                              </div>

                              {/* Content Rendering based on Type */}
                              {isDeleted ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-tight">Contenuto Intercettato:</span>
                                  <div className="p-2 bg-rose-950/20 border border-rose-900/30 rounded text-xs leading-relaxed">
                                    {log.deletedContent?.split(" ").map((word, i) => (
                                      <span
                                        key={i}
                                        className="inline-block bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1 py-0.5 rounded font-mono text-[11px] mr-1.5 my-0.5"
                                      >
                                        {word}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {/* Old Content */}
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-tight">Prima (Vecchio Messaggio):</span>
                                    <div className="p-2 bg-rose-950/15 border border-rose-900/20 rounded text-xs leading-relaxed">
                                      {log.oldContent?.split(" ").map((word, i) => (
                                        <span
                                          key={i}
                                          className="inline-block bg-rose-500/10 text-rose-400 line-through border border-rose-500/20 px-1 py-0.5 rounded font-mono text-[11px] mr-1.5 my-0.5"
                                        >
                                          {word}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  {/* New Content */}
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-tight">Dopo (Nuovo Messaggio):</span>
                                    <div className="p-2 bg-emerald-950/15 border border-emerald-900/20 rounded text-xs leading-relaxed">
                                      {log.newContent?.split(" ").map((word, i) => {
                                        // Simple comparison check to highlight changed words
                                        const oldWords = log.oldContent?.split(" ") || [];
                                        const isChanged = !oldWords.includes(word);
                                        return (
                                          <span
                                            key={i}
                                            className={`inline-block px-1 py-0.5 rounded font-mono text-[11px] mr-1.5 my-0.5 ${isChanged
                                              ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 scale-105"
                                              : "bg-neutral-800 text-neutral-300 border border-neutral-700/60"
                                              }`}
                                          >
                                            {word}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
