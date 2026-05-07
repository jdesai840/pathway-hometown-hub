import { loadArchetypes } from "../lib/archetypes.js";

export async function getArchetypes(_req, res) {
  try {
    const data = await loadArchetypes();
    res.json(data);
  } catch (err) {
    console.error("getArchetypes failed", err);
    res.status(500).json({ error: "failed to load archetypes" });
  }
}
