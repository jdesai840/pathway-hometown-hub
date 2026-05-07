import { loadSportCatalog } from "../lib/sportCatalog.js";

export async function getSportCatalog(_req, res) {
  try {
    const data = await loadSportCatalog();
    res.json(data);
  } catch (err) {
    console.error("getSportCatalog failed", err);
    res.status(500).json({ error: "failed to load sport catalog" });
  }
}
