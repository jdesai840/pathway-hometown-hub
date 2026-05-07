import { VertexAI } from "@google-cloud/vertexai";
import { loadArchetypes } from "../lib/archetypes.js";
import { matchSystemPrompt, matchTools } from "../lib/prompts.js";
import { mockMatch } from "../lib/mockMatch.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

export async function archetypeMatch(req, res) {
  const { biometrics, transcript } = req.body || {};
  if (!biometrics) return res.status(400).json({ error: "biometrics required" });

  // Local dev fallback: if no GCP project, return a deterministic mock so the UI flow works.
  if (!PROJECT) {
    try {
      const result = await mockMatch({ biometrics });
      return res.json({ ...result, mock: true });
    } catch (err) {
      console.error("mockMatch failed", err);
      return res.status(500).json({ error: "mock match failed" });
    }
  }

  try {
    const archetypes = await loadArchetypes();
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: matchSystemPrompt(archetypes) }] },
      tools: matchTools,
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    });

    const userMsg = {
      role: "user",
      parts: [
        { text: `Biometrics (proxies): ${JSON.stringify(biometrics)}` },
        { text: `Stated preferences/transcript: ${transcript || "(none)"}` },
        {
          text:
            "Return strict JSON: {matches:[{archetypeId,score,rationale}, ...]} with " +
            "EXACTLY one Olympic and one Paralympic archetype as the top two matches, " +
            "ordered by score. Use only IDs from the provided archetype catalog.",
        },
      ],
    };

    const result = await model.generateContent({ contents: [userMsg] });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    res.json(JSON.parse(text));
  } catch (err) {
    console.error("archetypeMatch failed", err);
    res.status(500).json({ error: "match failed" });
  }
}
