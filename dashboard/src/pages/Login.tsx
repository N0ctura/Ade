import React, { useState, useEffect } from "react";
import { getDiscordAuthUrl, setAccessToken } from "../config/discord";

interface LoginProps {
  onAuthenticated: () => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHandlingCallback, setIsHandlingCallback] = useState(false);

  // On mount, check if we're returning from the Discord OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setIsHandlingCallback(true);
      handleCallback(code);
    }
  }, []);

  const handleCallback = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/discord/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Authentication failed");
      }

      const data = await res.json();
      setAccessToken(data.access_token);

      // Clean the ?code= from the URL without a page reload
      window.history.replaceState({}, document.title, "/");

      onAuthenticated();
    } catch (err: any) {
      console.error("Auth callback error:", err);
      setError(err.message || "Could not authenticate with Discord. Please try again.");
      setIsHandlingCallback(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = await getDiscordAuthUrl();
      if (typeof url !== "string" || !url.startsWith("https://")) {
        throw new Error("Invalid Discord authorization URL");
      }
      window.location.assign(url);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Discord login is not available right now.");
      setIsLoading(false);
    }
  };

  // While processing the OAuth callback, show a full-screen spinner
  if (isHandlingCallback) {
    return (
      <div className="flex h-screen bg-[#111214] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-neutral-700 border-t-[#5865F2] rounded-full animate-spin mx-auto" />
          <p className="text-neutral-400 text-sm font-medium">
            Autenticazione in corso…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#111214] items-center justify-center font-sans">
      <div className="w-full max-w-md px-6">
        {/* Card */}
        <div className="bg-[#1e1f22] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header band */}
          <div className="bg-gradient-to-r from-[#5865F2]/20 to-[#3f4699]/10 px-8 py-8 border-b border-neutral-800 text-center">
            <img
              src="https://raw.githubusercontent.com/N0ctura/Ade/main/dashboard/public/celestial-logo.png"
              alt="Ade Bot"
              className="w-20 h-20 object-contain rounded-xl mx-auto mb-4"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Ade Control Panel
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Accedi con Discord per gestire il bot
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-6">
            {/* Error banner */}
            {error && (
              <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <p className="text-neutral-400 text-sm text-center leading-relaxed">
              Accedi con il tuo account Discord per visualizzare e modificare
              le impostazioni del bot.
            </p>

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3c45a5] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-[#5865F2]/20"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              )}
              <span>{isLoading ? "Caricamento…" : "Accedi con Discord"}</span>
            </button>

            <p className="text-neutral-600 text-xs text-center">
              Accediamo solo alle informazioni di base del tuo profilo Discord
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-neutral-700 text-xs mt-6">
          Ade Bot Control Panel · Dev by R0ck
        </p>
      </div>
    </div>
  );
}
