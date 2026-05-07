import { loadHubs } from "../lib/hubs.js";

export async function getHubs(_req, res) {
  try {
    const data = await loadHubs();
    res.json(data);
  } catch (err) {
    console.error("getHubs failed", err);
    res.status(500).json({ error: "failed to load hubs" });
  }
}
