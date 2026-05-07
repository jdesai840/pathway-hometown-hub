import { VertexAI } from "@google-cloud/vertexai";
import { loadArchetypes } from "../lib/archetypes.js";
import { narrateSystemPrompt } from "../lib/prompts.js";
import { mockNarrate } from "../lib/mockMatch.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

export async function narrate(req, res) {
  const { archetypeId, sketchPngBase64 } = req.body || {};
  if (!archetypeId) return res.status(400).json({ error: "archetypeId required" });

  try {
    const archetypes = await loadArchetypes();
    const archetype = archetypes.find((a) => a.id === archetypeId);
    if (!archetype) return res.status(404).json({ error: "archetype not found" });

    if (!PROJECT) {
      return res.json({ ...mockNarrate(archetype), mock: true });
    }

    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: narrateSystemPrompt() }] },
      generationConfig: { temperature: 0.7 },
    });

    const parts = [
      { text: `Archetype context (JSON): ${JSON.stringify(archetype)}` },
      {
        text:
          "Write a 4-sentence narration in second person. " +
          "Use conditional language ('could', 'may'). Mention Olympic and Paralympic context " +
          "with equal weight. Do NOT name any individual athlete.",
      },
    ];

    if (sketchPngBase64) {
      parts.push({
        inlineData: { mimeType: "image/png", data: sketchPngBase64 },
      });
      parts.push({
        text: "Reference the sketch as 'your training journey' and weave it into the narrative.",
      });
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ narration: text });
  } catch (err) {
    console.error("narrate failed", err);
    res.status(500).json({ error: "narrate failed" });
  }
}
