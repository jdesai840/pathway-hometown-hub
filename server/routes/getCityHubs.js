import { loadCityHubs } from "../lib/cityHubs.js";

export async function getCityHubs(_req, res) {
  try {
    const data = await loadCityHubs();
    res.json(data);
  } catch (err) {
    console.error("getCityHubs failed", err);
    res.status(500).json({ error: "failed to load city hubs" });
  }
}
