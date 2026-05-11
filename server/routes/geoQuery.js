import { VertexAI, FunctionCallingMode } from "@google-cloud/vertexai";
import { loadHubs } from "../lib/hubs.js";
import {
  geoSystemPrompt,
  geoStreamingSystemPrompt,
  geoTools,
} from "../lib/geoPrompts.js";
import { buildGeoToolHandlers } from "../lib/geoHandlers.js";
import { redactNames, redactNamesArr } from "../lib/nilGuard.js";
import { mockGeoQuery } from "./mockGeo.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

// One-line human label for each tool call. Surfaces in the streaming UI's
// activity log ("● query_athletes — Found 47 swimmers grouped by city").
function makeBrief(name, args, result) {
  const a = args || {};
  switch (name) {
    case "filter_by_sport": {
      const cat = a.category ? ` (${a.category})` : "";
      const n = Array.isArray(result?.hubs) ? result.hubs.length : (Array.isArray(result) ? result.length : 0);
      return `filter_by_sport · ${a.sport || "?"}${cat} → ${n} hubs`;
    }
    case "filter_by_state": {
      const n = Array.isArray(result?.hubs) ? result.hubs.length : (Array.isArray(result) ? result.length : 0);
      return `filter_by_state · ${a.state || "?"} → ${n} hubs`;
    }
    case "top_hubs": {
      const n = Array.isArray(result?.hubs) ? result.hubs.length : (Array.isArray(result) ? result.length : 0);
      const cat = a.category ? ` (${a.category})` : "";
      return `top_hubs${cat} → ${n}`;
    }
    case "top_hubs_for_sport": {
      const n = Array.isArray(result?.hubs) ? result.hubs.length : (Array.isArray(result) ? result.length : 0);
      return `top_hubs_for_sport · ${a.sport || "?"} → ${n}`;
    }
    case "compare_states":
      return `compare_states · ${a.stateA || "?"} vs ${a.stateB || "?"}`;
    case "surface_underexposed_hub":
      return `surface_underexposed_hub${a.excludeStates?.length ? ` (excl. ${a.excludeStates.join(", ")})` : ""}`;
    case "query_athletes": {
      const f = a.filters || {};
      const filterParts = [];
      if (f.sport) filterParts.push(f.sport);
      if (f.category) filterParts.push(f.category);
      if (f.state) filterParts.push(f.state);
      if (f.city) filterParts.push(`city:${f.city}`);
      if (f.medalist) filterParts.push("medalists");
      if (typeof f.yearMin === "number" || typeof f.yearMax === "number") {
        filterParts.push(`${f.yearMin ?? "·"}–${f.yearMax ?? "·"}`);
      }
      const filt = filterParts.length ? filterParts.join(" / ") : "all athletes";
      const grp = a.group_by ? ` by ${a.group_by}` : "";
      const n = result?.total ?? 0;
      return `query_athletes · ${filt}${grp} → ${n} matched`;
    }
    default:
      return name;
  }
}

// Convert a frontend chatMessages-style history into Gemini contents.
function historyToContents(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

export async function geoQuery(req, res) {
  const streaming = req.query?.stream === "1";
  const { question, transcript, history } = req.body || {};
  const text = (question || transcript || "").toString().trim();
  if (!text) return res.status(400).json({ error: "question is required" });

  // Local dev fallback when Vertex AI isn't configured.
  if (!PROJECT) {
    try {
      const hubsDoc = await loadHubs();
      const result = { ...mockGeoQuery(hubsDoc, text), mock: true };
      if (streaming) {
        setSSEHeaders(res);
        sse(res, { type: "done", ...result });
        return res.end();
      }
      return res.json(result);
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

  let handlers;
  try {
    handlers = await buildGeoToolHandlers(hubsDoc);
  } catch (err) {
    console.error("buildToolHandlers failed", err);
    return res.status(500).json({ error: "athlete index unavailable" });
  }

  if (streaming) {
    return geoQueryStream({ req, res, text, history, hubsDoc, handlers });
  }
  return geoQuerySync({ res, text, history, hubsDoc, handlers });
}

// ─── Non-streaming (legacy) ────────────────────────────────────────────────

async function geoQuerySync({ res, text, history, hubsDoc, handlers }) {
  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: geoSystemPrompt(hubsDoc) }] },
      tools: geoTools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode?.AUTO || "AUTO" } },
      generationConfig: { temperature: 0.3 },
    });

    const contents = [...historyToContents(history), { role: "user", parts: [{ text }] }];

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
      parsed.narration = await redactNames(parsed.narration);
      parsed.facts = await redactNamesArr(parsed.facts);
      return res.json(parsed);
    }
    res.status(500).json({ error: "agent loop exceeded depth" });
  } catch (err) {
    console.error("geoQuery failed", err);
    res.status(500).json({ error: "geo query failed" });
  }
}

// ─── Streaming (SSE) ───────────────────────────────────────────────────────

function setSSEHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // some proxies buffer SSE without this
  if (typeof res.flushHeaders === "function") res.flushHeaders();
}

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

async function geoQueryStream({ req, res, text, history, hubsDoc, handlers }) {
  setSSEHeaders(res);

  // Heartbeat every 15s so intermediate proxies don't kill the connection.
  const hb = setInterval(() => res.write(": hb\n\n"), 15000);
  req.on("close", () => clearInterval(hb));

  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: geoStreamingSystemPrompt(hubsDoc) }] },
      tools: geoTools,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode?.AUTO || "AUTO" } },
      generationConfig: { temperature: 0.3 },
    });

    const contents = [...historyToContents(history), { role: "user", parts: [{ text }] }];
    sse(res, { type: "started", query: text });

    // Step 1..N: function-calling loop (sync, atomic — function calls aren't
    // really streamable since the model returns the whole call in one chunk).
    let lastPart = null;
    for (let step = 0; step < 4; step++) {
      const result = await model.generateContent({ contents });
      const candidate = result.response.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      lastPart = part;
      const fnCall = part?.functionCall;
      if (!fnCall) break;

      sse(res, { type: "tool_use", name: fnCall.name, args: fnCall.args || {} });
      const handler = handlers[fnCall.name];
      const fnResult = handler ? handler(fnCall.args) : { error: `unknown tool ${fnCall.name}` };
      sse(res, { type: "tool_done", name: fnCall.name, brief: makeBrief(fnCall.name, fnCall.args, fnResult) });

      contents.push({ role: "model", parts: [{ functionCall: fnCall }] });
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: fnCall.name, response: { result: fnResult } } }],
      });
    }

    // If the loop ended because the last response was already text, we still
    // want to stream that text. So push it through the parser path below.
    // Otherwise, kick off the final streaming call.
    let narrationOut = "";
    let metaJson = null;

    if (lastPart?.functionCall) {
      // Hit the 4-step ceiling. Force one more non-function-call generation,
      // streamed.
      await streamFinalText({ model, contents, res, onText: (t) => { narrationOut += t; } })
        .then((meta) => { metaJson = meta; });
    } else if (lastPart?.text) {
      // The non-streaming step produced text; run a streamed re-generation so
      // the UI gets token-flow UX. (Same contents — Gemini will produce a
      // very similar narration; deterministic temperature 0.3 keeps it stable.)
      const meta = await streamFinalText({
        model,
        contents,
        res,
        onText: (t) => { narrationOut += t; },
      });
      metaJson = meta;
    } else {
      sse(res, { type: "error", message: "no narration produced" });
      clearInterval(hb);
      return res.end();
    }

    // Parse trailing meta block from accumulated narration if streamFinalText
    // didn't already extract it.
    if (!metaJson) {
      metaJson = extractMeta(narrationOut);
    }

    const narrationOnly = stripMetaTail(narrationOut);
    // Final defense-in-depth: scrub any athlete name the model may have
    // produced. The streamed `token` events upstream are prompt-constrained;
    // this guarantees the persisted (history-stored) narration is name-free.
    const cleanNarration = await redactNames(narrationOnly);
    const cleanFacts = await redactNamesArr(
      Array.isArray(metaJson?.facts) ? metaJson.facts : []
    );
    sse(res, {
      type: "done",
      narration: cleanNarration,
      intent: metaJson?.intent || "answered",
      highlights: Array.isArray(metaJson?.highlights) ? metaJson.highlights : [],
      facts: cleanFacts,
    });
  } catch (err) {
    console.error("geoQueryStream failed", err);
    try {
      sse(res, { type: "error", message: err?.message || "geo query stream failed" });
    } catch {}
  } finally {
    clearInterval(hb);
    res.end();
  }
}

// Calls model.generateContentStream and emits {type:"token", text} for each
// chunk's text. Splits narration vs trailing <<META>>…<<END>> block; only the
// narration part is streamed as tokens. Returns parsed meta JSON (or null).
async function streamFinalText({ model, contents, res, onText }) {
  const META_OPEN = "<<META>>";
  const META_CLOSE = "<<END>>";
  let buf = "";
  let inMeta = false;
  let metaBuf = "";
  let pendingNarration = "";

  const streamResult = await model.generateContentStream({ contents });

  for await (const chunk of streamResult.stream) {
    const part = chunk?.candidates?.[0]?.content?.parts?.[0];
    const t = part?.text;
    if (!t) continue;
    buf += t;

    if (!inMeta) {
      const idx = buf.indexOf(META_OPEN);
      if (idx === -1) {
        // Hold back the last (META_OPEN.length - 1) chars in case META_OPEN
        // straddles chunk boundaries.
        const safeEmit = buf.length > META_OPEN.length
          ? buf.slice(0, buf.length - (META_OPEN.length - 1))
          : "";
        if (safeEmit) {
          pendingNarration += safeEmit;
          onText(safeEmit);
          sse(res, { type: "token", text: safeEmit });
          buf = buf.slice(safeEmit.length);
        }
      } else {
        const before = buf.slice(0, idx);
        if (before) {
          pendingNarration += before;
          onText(before);
          sse(res, { type: "token", text: before });
        }
        metaBuf = buf.slice(idx + META_OPEN.length);
        buf = "";
        inMeta = true;
      }
    } else {
      metaBuf += t;
    }
  }

  // Flush whatever's left in buf if we never saw <<META>>.
  if (!inMeta && buf) {
    pendingNarration += buf;
    onText(buf);
    sse(res, { type: "token", text: buf });
  }

  if (inMeta) {
    const endIdx = metaBuf.indexOf(META_CLOSE);
    const jsonText = endIdx === -1 ? metaBuf : metaBuf.slice(0, endIdx);
    return safeJSON(jsonText);
  }
  return null;
}

function extractMeta(s) {
  const open = s.indexOf("<<META>>");
  if (open === -1) return null;
  const close = s.indexOf("<<END>>", open);
  const body = close === -1 ? s.slice(open + 8) : s.slice(open + 8, close);
  return safeJSON(body);
}

function stripMetaTail(s) {
  const open = s.indexOf("<<META>>");
  return open === -1 ? s.trim() : s.slice(0, open).trim();
}

function safeJSON(s) {
  if (typeof s !== "string") return null;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
