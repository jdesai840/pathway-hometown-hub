import { VertexAI, FunctionCallingMode } from "@google-cloud/vertexai";
import { loadHubs } from "../lib/hubs.js";
import { geoSystemPrompt, geoTools } from "../lib/geoPrompts.js";
import {
  filterBySport,
  filterByState,
  topHubs,
  topHubsForSport,
  compareStates,
  surfaceUnderexposedHub,
} from "../lib/hubQueries.js";
import { mockGeoQuery } from "./mockGeo.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

// Map tool-name → handler. Each handler receives the parsed args + the loaded
// hubs document and returns a JSON-serializable result that gets fed back to
// Gemini as the function-call response.
function buildToolHandlers(hubsDoc) {
  return {
    filter_by_sport: (args) => filterBySport(hubsDoc.hubs, args || {}),
    filter_by_state: (args) => filterByState(hubsDoc.hubs, args || {}),
    top_hubs: (args) => topHubs(hubsDoc.hubs, args || {}),
    top_hubs_for_sport: (args) => topHubsForSport(hubsDoc.hubs, args || {}),
    compare_states: (args) => compareStates(hubsDoc.hubs, hubsDoc.stateTotals, args || {}),
    surface_underexposed_hub: (args) =>
      surfaceUnderexposedHub(hubsDoc.hubs, hubsDoc.stateTotals, args || {}),
  };
}

export async function geoQuery(req, res) {
  const { question, transcript } = req.body || {};
  const text = (question || transcript || "").toString().trim();
  if (!text) return res.status(400).json({ error: "question is required" });

  // Local dev fallback when Vertex AI isn't configured.
  if (!PROJECT) {
    try {
      const hubsDoc = await loadHubs();
      return res.json({ ...mockGeoQuery(hubsDoc, text), mock: true });
    } catch (err) {
      console.error("mockGeoQuery failed", err);
      return res.status(500).json({ error: "mock geo query failed" });
    }
  }

  let hubsDoc;
  try {
    hubsDoc = await loadHubs();
  } catch (err) {
    console.error("loadHubs failed", err);
    return res.status(500).json({ error: "hubs unavailable" });
  }
  const handlers = buildToolHandlers(hubsDoc);

  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: geoSystemPrompt(hubsDoc) }] },
      tools: geoTools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode?.AUTO || "AUTO" } },
      generationConfig: { temperature: 0.3 },
    });

    const contents = [{ role: "user", parts: [{ text }] }];

    // Multi-step function-calling loop — Gemini may call multiple tools.
    for (let step = 0; step < 4; step++) {
      const result = await model.generateContent({ contents });
      const candidate = result.response.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const fnCall = part?.functionCall;

      if (fnCall) {
        const handler = handlers[fnCall.name];
        const fnResult = handler ? handler(fnCall.args) : { error: `unknown tool ${fnCall.name}` };
        contents.push({ role: "model", parts: [{ functionCall: fnCall }] });
        contents.push({
          role: "user",
          parts: [{ functionResponse: { name: fnCall.name, response: { result: fnResult } } }],
        });
        continue;
      }

      // Final answer — Gemini returned text. Expect strict JSON shape.
      const textOut = part?.text || "";
      const jsonStart = textOut.indexOf("{");
      const jsonEnd = textOut.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return res.json({ intent: "raw", narration: textOut, highlights: [], facts: [] });
      }
      const parsed = JSON.parse(textOut.slice(jsonStart, jsonEnd + 1));
      return res.json(parsed);
    }
    res.status(500).json({ error: "agent loop exceeded depth" });
  } catch (err) {
    console.error("geoQuery failed", err);
    res.status(500).json({ error: "geo query failed" });
  }
}
