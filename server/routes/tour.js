import { VertexAI, FunctionCallingMode } from "@google-cloud/vertexai";
import { loadHubs } from "../lib/hubs.js";
import { loadCityHubs } from "../lib/cityHubs.js";
import { geoSystemPrompt, geoTools } from "../lib/geoPrompts.js";
import {
  filterBySport,
  filterByState,
  topHubs,
  topHubsForSport,
  surfaceUnderexposedHub,
} from "../lib/hubQueries.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

const TOUR_SYSTEM_PROMPT_TAIL = `
You are now generating an AI TOUR for the user. A tour is a sequence of 4–6
geographic stops (US cities) that tell a cohesive story about Team USA based
on what the user wants to explore.

Use the geo tools to gather data, then output STRICT JSON only:
{
  "title": "...",                       // short tour title
  "summary": "...",                     // 1-2 sentences setting the stage
  "stops": [
    {
      "city": "...",                    // exact city name from city-hub data
      "state": "..",                    // 2-letter state code
      "lat": <number>,                  // copy from city data
      "lng": <number>,
      "zoom": <integer 6-10>,           // suggested map zoom for this stop
      "narration": "...",               // 2-3 sentences, conversational, second person
      "highlightSports": ["..."]        // 1-3 sport names connected to this stop
    },
    ...
  ]
}

NARRATION RULES:
- Second person, warm, conversational tone (this will be spoken aloud).
- 2-3 sentences per stop. Roughly 25-50 words.
- Olympic and Paralympic context with equal weight when relevant.
- Conditional language ("could", "may"). Never guarantee outcomes.
- Use sport names exactly as in the data. NEVER name individual athletes.
- NEVER use "former" or "past" Olympian/Paralympian.
- NEVER reference timing or scoring data.
- Weave in climate-region context when meaningful (altitude, latitude, etc.).
- Connect stops with smooth narrative transitions ("From here, we head to...").

STOP SELECTION:
- Pick 4-6 cities with real Team USA presence in the relevant data.
- Order them in a sensible geographic or thematic flow.
- Use the city's REAL lat/lng from the tool results — do not invent coords.
`.trim();

function buildToolHandlers(hubsDoc, cityHubsDoc) {
  return {
    filter_by_sport: (args) => filterBySport(hubsDoc.hubs, args || {}),
    filter_by_state: (args) => filterByState(hubsDoc.hubs, args || {}),
    top_hubs: (args) => topHubs(hubsDoc.hubs, args || {}),
    top_hubs_for_sport: (args) => topHubsForSport(hubsDoc.hubs, args || {}),
    surface_underexposed_hub: () =>
      surfaceUnderexposedHub(hubsDoc.hubs, hubsDoc.stateTotals),
    // Bonus tool only available in tour mode: lookup the top cities (with coords)
    // for a given sport or state, so Gemini can pick real geographic stops.
    top_cities_for_state: ({ state, limit = 6 }) => {
      if (!cityHubsDoc) return [];
      return cityHubsDoc.cities
        .filter((c) => c.state === (state || "").toUpperCase())
        .sort((a, b) => b.athleteCount - a.athleteCount)
        .slice(0, limit);
    },
    top_cities_for_sport: ({ sport, limit = 6 }) => {
      if (!cityHubsDoc || !sport) return [];
      const sportLower = sport.toLowerCase();
      const cityScores = new Map();
      for (const h of cityHubsDoc.hubs) {
        if (!h.sport.toLowerCase().includes(sportLower)) continue;
        const key = `${h.state}|${h.cityKey}`;
        const cur = cityScores.get(key) || 0;
        cityScores.set(key, cur + h.athleteCount);
      }
      return cityHubsDoc.cities
        .filter((c) => cityScores.has(`${c.state}|${c.cityKey}`))
        .map((c) => ({ ...c, sportAthletes: cityScores.get(`${c.state}|${c.cityKey}`) }))
        .sort((a, b) => b.sportAthletes - a.sportAthletes)
        .slice(0, limit);
    },
  };
}

const TOUR_EXTRA_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "top_cities_for_state",
        description:
          "Top cities by athlete count for a US state. Returns lat/lng for each, suitable as tour stops.",
        parameters: {
          type: "object",
          properties: {
            state: { type: "string", description: "Two-letter state code" },
            limit: { type: "integer" },
          },
          required: ["state"],
        },
      },
      {
        name: "top_cities_for_sport",
        description:
          "Top cities by athletes-in-this-sport. Returns lat/lng. Use to build sport-themed tours.",
        parameters: {
          type: "object",
          properties: {
            sport: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["sport"],
        },
      },
    ],
  },
];

export async function tour(req, res) {
  const { theme, state, sport, interests } = req.body || {};

  if (!PROJECT) {
    // Without GCP we can't reach Gemini — return a small mock tour so the UI flow works.
    try {
      const cityHubsDoc = await loadCityHubs();
      const stops = cityHubsDoc.cities
        .sort((a, b) => b.athleteCount - a.athleteCount)
        .slice(0, 5)
        .map((c) => ({
          city: c.city,
          state: c.state,
          lat: c.lat,
          lng: c.lng,
          zoom: 8,
          narration: `Here in ${c.city}, ${c.state}, ${c.athleteCount} Team USA athletes have called this hub home — across both Olympic and Paralympic disciplines.`,
          highlightSports: [],
        }));
      return res.json({
        title: "Top Hometown Hubs",
        summary: "A quick sweep through the largest Team USA hometown hubs.",
        stops,
        mock: true,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "mock tour failed" });
    }
  }

  let hubsDoc, cityHubsDoc;
  try {
    [hubsDoc, cityHubsDoc] = await Promise.all([loadHubs(), loadCityHubs()]);
  } catch (err) {
    console.error("loadHubs/loadCityHubs failed", err);
    return res.status(500).json({ error: "data unavailable" });
  }
  const handlers = buildToolHandlers(hubsDoc, cityHubsDoc);

  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const systemPrompt = geoSystemPrompt(hubsDoc) + "\n\n" + TOUR_SYSTEM_PROMPT_TAIL;
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      tools: [...geoTools, ...TOUR_EXTRA_TOOLS],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode?.AUTO || "AUTO" } },
      generationConfig: { temperature: 0.6 },
    });

    const userPrompt = [
      "Build me a Team USA tour with these inputs:",
      state ? `- State of focus: ${state}` : null,
      sport ? `- Sport of focus: ${sport}` : null,
      theme ? `- Theme: ${theme}` : null,
      interests ? `- User's interests / freeform: ${interests}` : null,
      "",
      "Use the tools to fetch real city data with coordinates, then return the tour JSON.",
    ]
      .filter(Boolean)
      .join("\n");

    const contents = [{ role: "user", parts: [{ text: userPrompt }] }];

    for (let step = 0; step < 6; step++) {
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
        return res.status(500).json({ error: "no tour json", raw: textOut });
      }
      const parsed = JSON.parse(textOut.slice(jsonStart, jsonEnd + 1));
      return res.json(parsed);
    }
    res.status(500).json({ error: "tour agent loop exceeded depth" });
  } catch (err) {
    console.error("tour failed", err);
    res.status(500).json({ error: "tour failed" });
  }
}
