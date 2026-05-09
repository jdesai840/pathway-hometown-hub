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

WORKFLOW (MANDATORY):
1. First, call top_cities_for_state OR top_cities_for_sport to pick candidate stops.
2. For EVERY chosen stop, you MUST call city_sport_breakdown(state, city) to
   get the specific sport list with athlete counts and year ranges. Do NOT
   write narration without doing this — generic narration is unacceptable.
3. After all breakdowns are loaded, output the final JSON.

OUTPUT (strict JSON):
{
  "title": "...",
  "summary": "1-2 sentences setting the stage",
  "stops": [
    {
      "city": "...", "state": "..", "lat": <num>, "lng": <num>,
      "zoom": <int 6-10>,
      "narration": "...",
      "highlightSports": ["..."]
    }
  ]
}

NARRATION REQUIREMENTS — these are STRICT:
- 3-5 sentences per stop, ~50-90 words. Concrete and specific, not generic.
- MUST cite at least 2 specific sports with athlete counts (e.g., "23 athletes
  in Track and Field, 18 in Swimming"). Use real numbers from city_sport_breakdown.
- MUST mention the era / year range for at least one notable sport at that city
  (e.g., "Curling has been on the city's roster since 2006").
- If both Olympic AND Paralympic athletes exist at the stop, mention both with
  counts. Equal narrative weight.
- Weave in WHY this place produces these athletes — climate, infrastructure,
  geography, culture (e.g., "high-altitude training near the Olympic Training
  Center", "Lake Placid's bobsled track legacy", "Twin Cities ice culture").
- Conversational second person. Conditional language only ("could", "may").
- NEVER name individual athletes. Sport names exactly as in the data.
- NEVER use "former" or "past" Olympian/Paralympian.
- NEVER reference timing or scoring data.
- Connect stops with smooth narrative transitions.

NEVER use vague filler like "a range of sports", "across many disciplines",
"may create opportunities". Be specific or don't say it.

STOP SELECTION:
- 4-6 cities with real, NON-TRIVIAL Team USA presence (athleteCount >= 4 ideally).
- Order in a geographic or thematic flow.
- Use the REAL lat/lng from tool results — don't invent.
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
    // CRITICAL — this is what gives narration its concreteness.
    // Returns the full per-sport breakdown for a city: every sport with its
    // category, athlete count, year range. Gemini is required (per system
    // prompt) to call this for EVERY stop before writing narration.
    city_sport_breakdown: ({ state, city }) => {
      if (!cityHubsDoc || !state || !city) return [];
      const stateUpper = state.toUpperCase();
      const cityLower = city.toLowerCase();
      const matched = cityHubsDoc.hubs.filter(
        (h) =>
          h.state === stateUpper &&
          (h.city.toLowerCase() === cityLower || h.cityKey === cityLower)
      );
      return matched
        .sort((a, b) => b.athleteCount - a.athleteCount)
        .map((h) => ({
          sport: h.sport,
          category: h.category,
          athleteCount: h.athleteCount,
          earliestYear: h.earliestYear,
          latestYear: h.latestYear,
          medalCount: h.medalCount,
        }));
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
      {
        name: "city_sport_breakdown",
        description:
          "Per-city sport breakdown: every sport at that city with category (Olympic|Paralympic), athlete count, year range. REQUIRED for every tour stop before writing narration.",
        parameters: {
          type: "object",
          properties: {
            state: { type: "string" },
            city: { type: "string" },
          },
          required: ["state", "city"],
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
    // Vertex AI requires all function declarations in a single tool block
    // ("Multiple tools are supported only when they are all search tools").
    const mergedTools = [
      {
        functionDeclarations: [
          ...(geoTools[0]?.functionDeclarations || []),
          ...(TOUR_EXTRA_TOOLS[0]?.functionDeclarations || []),
        ],
      },
    ];
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      tools: mergedTools,
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

    // Bumped to allow more tool calls — each stop needs ≥1 city_sport_breakdown
    for (let step = 0; step < 14; step++) {
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
