import { VertexAI, FunctionCallingMode } from "@google-cloud/vertexai";
import { loadHubs } from "../lib/hubs.js";
import { geoSystemPrompt, geoTools } from "../lib/geoPrompts.js";
import { buildGeoToolHandlers } from "../lib/geoHandlers.js";
import { redactNames, redactNamesArr } from "../lib/nilGuard.js";
import { mockGeoQuery } from "./mockGeo.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

function historyToContents(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

// Multimodal Gemini audio input. The browser records audio via MediaRecorder
// and posts {audioBase64, mimeType, history?}. Gemini transcribes + interprets
// in one round trip with multi-turn context.
export async function voiceQuery(req, res) {
  const { audioBase64, mimeType, history } = req.body || {};
  if (!audioBase64) return res.status(400).json({ error: "audioBase64 required" });

  let hubsDoc;
  try {
    hubsDoc = await loadHubs();
  } catch (err) {
    console.error("loadHubs failed", err);
    return res.status(500).json({ error: "hubs unavailable" });
  }

  if (!PROJECT) {
    // Without GCP we can't transcribe — surface a helpful mock so the UI flow works.
    return res.json({
      ...mockGeoQuery(hubsDoc, "show me top hubs"),
      mock: true,
      transcript: "(mock — no Gemini available; showing top hubs)",
    });
  }

  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: geoSystemPrompt(hubsDoc) }] },
      tools: geoTools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode?.AUTO || "AUTO" } },
      generationConfig: { temperature: 0.3 },
    });
    const handlers = await buildGeoToolHandlers(hubsDoc);

    const contents = [
      ...historyToContents(history),
      {
        role: "user",
        parts: [
          {
            text:
              "The user has spoken a question about Team USA hometown hubs. " +
              "Transcribe the audio, then answer using the tools. " +
              "Include the transcribed question as a 'transcript' field in your JSON output.",
          },
          { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } },
        ],
      },
    ];

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

      const textOut = part?.text || "";
      const jsonStart = textOut.indexOf("{");
      const jsonEnd = textOut.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return res.json({
          intent: "raw",
          narration: await redactNames(textOut),
          highlights: [],
          facts: [],
        });
      }
      const parsed = JSON.parse(textOut.slice(jsonStart, jsonEnd + 1));
      // NIL guard: scrub any athlete name from model output. transcript
      // is the user's own utterance and stays as-is.
      parsed.narration = await redactNames(parsed.narration);
      parsed.facts = await redactNamesArr(parsed.facts);
      return res.json(parsed);
    }
    res.status(500).json({ error: "voice agent loop exceeded depth" });
  } catch (err) {
    console.error("voiceQuery failed", err);
    res.status(500).json({ error: "voice query failed" });
  }
}
