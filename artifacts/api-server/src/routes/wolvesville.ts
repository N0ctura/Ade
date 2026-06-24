import { Router } from "express";

const router = Router();

const WV_BASE = "https://api.wolvesville.com";

function wvHeaders() {
  return {
    Authorization: `Bot ${process.env["WOLVESVILLE_API_KEY"] ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

router.get("/wolvesville/clan-search", async (req, res) => {
  const name = req.query["name"] as string;
  const resp = await fetch(`${WV_BASE}/clans/search?name=${encodeURIComponent(name)}`, {
    headers: wvHeaders(),
  });
  const data = await resp.json();
  res.status(resp.status).json(data);
});

router.get("/wolvesville/quests/:clanId", async (req, res) => {
  const { clanId } = req.params;
  const resp = await fetch(`${WV_BASE}/clans/${clanId}/quests/available`, {
    headers: wvHeaders(),
  });
  const data = await resp.json();
  res.status(resp.status).json(data);
});

export default router;
