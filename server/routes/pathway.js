import { VertexAI } from "@google-cloud/vertexai";
import { resolveUserCity, findNearbyHubs } from "../lib/pathwayQueries.js";
import {
  pathwaySystemPrompt,
  buildPathwayUserPrompt,
} from "../lib/pathwayPrompts.js";
import { redactNames } from "../lib/nilGuard.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

export async function pathway(req, res) {
  const { city, state, category } = req.body || {};
  if (!city || typeof city !== "string") {
    return res.status(400).json({ error: "city is required" });
  }
  const cat =
    category === "Olympic" || category === "Paralympic" || category === "Both"
      ? category
      : "Both";

  // Resolve city → lat/lng via our 368-city catalog.
  let userLocation;
  try {
    const hit = await resolveUserCity({ city, state });
    if (!hit) {
      return res.status(404).json({
        error:
          "City not found in our hub catalog. Try a nearby larger town or pass a 2-letter state code.",
      });
    }
    userLocation = {
      city: hit.city,
      state: hit.state,
      lat: hit.lat,
      lng: hit.lng,
    };
  } catch (err) {
    console.error("resolveUserCity failed", err);
    return res.status(500).json({ error: "city resolution failed" });
  }

  // Pull the per-city sport-graded neighborhood within 150mi.
  let nearbyHubs;
  try {
    nearbyHubs = await findNearbyHubs({
      lat: userLocation.lat,
      lng: userLocation.lng,
      radiusMi: 150,
      category: cat,
      limit: 12,
    });
  } catch (err) {
    console.error("findNearbyHubs failed", err);
    return res.status(500).json({ error: "neighborhood lookup failed" });
  }

  if (nearbyHubs.length === 0) {
    return res.status(200).json({
      userLocation,
      nearbyHubs: [],
      recommendedSports: [],
      paralympicCounterpart: null,
      facilities: [],
      narration:
        `No Team USA athletes have been recorded within 150 miles of ${userLocation.city}, ${userLocation.state} in our public dataset. ` +
        "That doesn't mean talent isn't there — it may simply be that public hometown data hasn't surfaced it yet.",
      disclaimer:
        "Verify details with each program directly — recommendations are AI-generated starting points.",
      citations: [],
    });
  }

  // Local dev fallback when Vertex isn't configured.
  if (!PROJECT) {
    return res.json({
      userLocation,
      nearbyHubs,
      recommendedSports: nearbyHubs.slice(0, 2).flatMap((h) =>
        (h.topSports || []).slice(0, 1).map((s) => ({
          sport: s.sport,
          category: s.category,
          why: `${h.city}, ${h.state} has produced ${s.count} ${s.category} athlete${s.count === 1 ? "" : "s"} in ${s.sport}.`,
          nearbyHubs: [`${h.city}, ${h.state}`],
        }))
      ),
      paralympicCounterpart: null,
      facilities: [],
      narration: `${userLocation.city}, ${userLocation.state}'s neighborhood includes hubs like ${nearbyHubs[0].city}, ${nearbyHubs[0].state} (${nearbyHubs[0].athleteCount} athletes). (mock — no Gemini)`,
      disclaimer:
        "Verify details with each program directly — recommendations are AI-generated starting points.",
      citations: [],
      mock: true,
    });
  }

  // Gemini call with Google Search grounding.
  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: {
        role: "system",
        parts: [{ text: pathwaySystemPrompt() }],
      },
      // Gemini 2.5 deprecated googleSearchRetrieval; the live API now accepts
      // googleSearch. The SDK's TS types are stale; we pass the right field
      // raw.
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });

    const userPrompt = buildPathwayUserPrompt({
      userLocation,
      nearbyHubs,
      category: cat,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const candidate = result.response.candidates?.[0];
    const textOut = candidate?.content?.parts?.[0]?.text || "";
    const jsonStart = textOut.indexOf("{");
    const jsonEnd = textOut.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("pathway: no JSON in model output", textOut.slice(0, 400));
      return res.status(500).json({ error: "pathway parse failed" });
    }
    let parsed;
    try {
      parsed = JSON.parse(textOut.slice(jsonStart, jsonEnd + 1));
    } catch (err) {
      console.error("pathway: JSON.parse failed", err, textOut.slice(0, 400));
      return res.status(500).json({ error: "pathway parse failed" });
    }

    // NIL guard on every narration field the model produced.
    if (typeof parsed.narration === "string") {
      parsed.narration = await redactNames(parsed.narration);
    }
    if (Array.isArray(parsed.recommendedSports)) {
      for (const r of parsed.recommendedSports) {
        if (typeof r.why === "string") r.why = await redactNames(r.why);
      }
    }
    if (parsed.paralympicCounterpart?.why) {
      parsed.paralympicCounterpart.why = await redactNames(
        parsed.paralympicCounterpart.why
      );
    }
    if (Array.isArray(parsed.facilities)) {
      for (const f of parsed.facilities) {
        if (typeof f.note === "string") f.note = await redactNames(f.note);
      }
    }

    // Pull citations out of groundingMetadata so the UI can display source links.
    const citations =
      (candidate?.groundingMetadata?.groundingChunks || [])
        .map((c) => c?.web)
        .filter((w) => w && (w.uri || w.title))
        .map((w) => ({ uri: w.uri || null, title: w.title || null }))
        // Dedupe by uri.
        .filter(
          (c, i, arr) =>
            !c.uri || arr.findIndex((x) => x.uri === c.uri) === i
        )
        .slice(0, 8);

    res.json({
      userLocation,
      // Echo the user's category choice so the UI can label the
      // counterpart section correctly (Paralympic / Olympic / Related).
      category: cat,
      nearbyHubs,
      ...parsed,
      citations,
    });
  } catch (err) {
    console.error("pathway failed", err);
    res
      .status(500)
      .json({ error: "pathway failed", detail: err?.message || null });
  }
}
