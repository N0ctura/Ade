import React, { useEffect, useState } from "react";
import { getDiscordAuthUrl, setAccessToken, isAuthenticated } from "../config/discord";

export default function LoginTailwind() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if we're in the callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      handleCallback(code);
    }
  }, []);

  const handleCallback = async (code: string) => {
    setIsLoading(true);
    setError("");
    try {
      // Exchange code for token via backend
      const res = await fetch("/api/auth/discord/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error("Failed to authenticate");

      const data = await res.json();
      setAccessToken(data.access_token);

      // Redirect to dashboard
      window.location.href = "/";
    } catch (err) {
      console.error("Auth error:", err);
      setError("Could not authenticate with Discord");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const url = await getDiscordAuthUrl();
      window.location.href = url;
    } catch (err) {
      console.error("Login error:", err);
      setError("Could not load Discord login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#111214] min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="flex items-center justify-center">
          <div className="space-y-8 text-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                🤖 Ade Dashboard
              </h1>
              <p className="text-gray-400 text-lg">
                Manage your Discord bot settings
              </p>
            </div>

            <div className="bg-[#2b2d31] p-8 rounded-lg w-full border border-neutral-800">
              <div className="space-y-6">
                <div>
                  <p className="text-gray-300 mb-4">
                    Sign in with your Discord account to get started
                  </p>
                </div>

                {error && (
                  <div className="bg-rose-900/30 border border-rose-700/50 text-rose-300 px-4 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#5865F2]/50 text-white py-4 rounded-lg font-bold transition-colors"
                >
                  {isLoading ? "Loading..." : "Login with Discord"}
                </button>

                <p className="text-gray-500 text-sm">
                  We only access your basic info and server list
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
