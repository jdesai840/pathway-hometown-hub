import { VertexAI } from "@google-cloud/vertexai";
import { loadCityHubs } from "../lib/cityHubs.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
// Use Flash for tour generation — much faster than Pro and the task is well-
// structured (just compose narration over data we hand it).
const TOUR_MODEL = process.env.GEMINI_TOUR_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `
You are an AI tour guide for Team USA fans. Given a CANDIDATE list of US
cities (each with full per-sport athlete breakdowns), pick 4-6 stops and
output a STRICT JSON tour script:

{
  "title": "...",
  "summary": "1-2 sentences setting the stage",
  "stops": [
    {
      "city": "...", "state": "..", "lat": <num>, "lng": <num>,
      "zoom": <int 6-10>,
      "narration": "...",
      "highlightSports": ["..."],
      "viewpoint": { "lat": <num>, "lng": <num>, "name": "..." },
      "landmarks": [
        { "name": "...", "wikipedia": "Article_Title" }
      ]
    }
  ]
}

NARRATION REQUIREMENTS — these are STRICT, not suggestions:
- 3-5 sentences, ~50-90 words. Concrete, not generic.
- MUST cite at least 2 specific sports with athlete counts (e.g., "23 athletes
  in Track and Field, 18 in Swimming"). Use real numbers from the city data.
- MUST mention a year range for at least one sport (e.g., "since 2006").
- If the city has both Olympic AND Paralympic athletes, mention both with
  counts. Equal narrative weight.
- Weave in WHY: climate, infrastructure, training centers, geography, culture.
  Use NOAA climate region context when relevant. Mention real things
  ("U.S. Olympic Training Center", "Lake Placid bobsled track", "Twin Cities
  ice culture") when they fit.
- Conversational second person.
- Conditional language only ('could', 'may', 'potentially'). Never guarantee.

NEVER use vague filler like "a range of sports", "across many disciplines",
"may create opportunities". Be specific or don't say it.

VIEWPOINT (cinematic camera target):
- Pick a lat/lng for a SPECIFIC iconic spot in the city — downtown skyline,
  a major university campus, a known athletic facility, a famous park.
- The viewpoint should be visually interesting from above (~1km altitude).
  Avoid pure suburban sprawl or open water.
- Examples: "Charlotte uptown skyline" 35.2271,-80.8431; "Duke University
  campus" 36.0014,-78.9382; "Lake Placid Olympic Center" 44.2795,-73.9799.
- Include a short 'name' label for the viewpoint.

LANDMARKS (1-3 per stop):
- Real, well-known places that match what your narration mentions —
  universities, training centers, stadiums, famous parks.
- 'wikipedia' is the EXACT Wikipedia article title (with underscores), e.g.,
  "Duke_University", "Charlotte,_North_Carolina", "U.S._Olympic_%26_Paralympic_Training_Center".
- Skip obscure landmarks; prefer ones with strong Wikipedia presence.

ABSOLUTE RULES:
- NEVER name an individual athlete.
- NEVER use "former" or "past" Olympian/Paralympian.
- NEVER reference timing or scoring data.
- Use sport names exactly as in the candidate data.

STOP SELECTION:
- 4-6 stops with non-trivial presence (athleteCount >= 4 ideally).
- Order in a sensible geographic flow when possible.
- Use REAL lat/lng from candidate data for the city's main lat/lng.
- 'highlightSports' is 1-3 sport names from the city's actual breakdown.
`.trim();

const NOAA_CLIMATE = `
NOAA US Climate Regions (states → region):
- Northeast: CT,DE,ME,MD,MA,NH,NJ,NY,PA,RI,VT,DC — cold winters, mild humid summers; winter sports + indoor disciplines.
- Upper Midwest: IA,MI,MN,WI — long, harsh winters; ice hockey, curling, speed skating, Nordic skiing.
- Ohio Valley: IL,IN,KY,MO,OH,TN,WV — humid continental → subtropical; broad sport mix.
- Southeast: AL,FL,GA,NC,SC,VA — hot humid summers; year-round outdoor training.
- South: AR,KS,LA,MS,OK,TX — hot summers, mild winters; track and field, boxing, wrestling.
- Northern Rockies and Plains: MT,NE,ND,SD,WY — continental + high elevation; skiing, biathlon.
- Northwest: ID,OR,WA — mild, wet, long outdoor seasons; rowing, sailing, distance running.
- Southwest: AZ,CO,NM,UT — arid, high-elevation; Olympic Training Center is in Colorado Springs.
- West: CA,NV — Mediterranean coastal + arid interior; year-round training.
`.trim();

// Pick top candidate cities for the input + attach each one's full sport
// breakdown so Gemini has everything it needs in a single call.
function buildCandidates(cityHubsDoc, { state, sport }) {
  const cities = cityHubsDoc.cities;
  let pool;
  if (state) {
    pool = cities
      .filter((c) => c.state === state.toUpperCase())
      .sort((a, b) => b.athleteCount - a.athleteCount);
  } else if (sport) {
    const sportLower = sport.toLowerCase();
    const sportScores = new Map();
    for (const h of cityHubsDoc.hubs) {
      if (!h.sport.toLowerCase().includes(sportLower)) continue;
      const key = `${h.state}|${h.cityKey}`;
      sportScores.set(key, (sportScores.get(key) || 0) + h.athleteCount);
    }
    pool = cities
      .filter((c) => sportScores.has(`${c.state}|${c.cityKey}`))
      .map((c) => ({ ...c, sportAthletes: sportScores.get(`${c.state}|${c.cityKey}`) }))
      .sort((a, b) => (b.sportAthletes || 0) - (a.sportAthletes || 0));
  } else {
    pool = [...cities].sort((a, b) => b.athleteCount - a.athleteCount);
  }
  pool = pool.slice(0, 10);

  // Attach per-city sport breakdown
  return pool.map((c) => {
    const breakdown = cityHubsDoc.hubs
      .filter((h) => h.state === c.state && h.cityKey === c.cityKey)
      .sort((a, b) => b.athleteCount - a.athleteCount)
      .map((h) => ({
        sport: h.sport,
        category: h.category,
        athleteCount: h.athleteCount,
        earliestYear: h.earliestYear,
        latestYear: h.latestYear,
      }));
    return {
      city: c.city,
      state: c.state,
      lat: c.lat,
      lng: c.lng,
      totalAthletes: c.athleteCount,
      olympic: c.olympicAthletes,
      paralympic: c.paralympicAthletes,
      sports: breakdown,
    };
  });
}

export async function tour(req, res) {
  const { state, sport, theme, interests } = req.body || {};

  let cityHubsDoc;
  try {
    cityHubsDoc = await loadCityHubs();
  } catch (err) {
    console.error("loadCityHubs failed", err);
    return res.status(500).json({ error: "data unavailable" });
  }

  const candidates = buildCandidates(cityHubsDoc, { state, sport });
  if (candidates.length === 0) {
    return res.status(400).json({ error: "no matching cities" });
  }

  // Mock fallback when GCP isn't configured — return top candidates as a
  // simple tour with templated narrations.
  if (!PROJECT) {
    return res.json({
      title:
        state ? `Touring ${state.toUpperCase()}` :
        sport ? `Touring ${sport}` :
        "Top Hometown Hubs",
      summary: "A quick sweep through Team USA's most active hubs.",
      stops: candidates.slice(0, 5).map((c) => ({
        city: c.city,
        state: c.state,
        lat: c.lat,
        lng: c.lng,
        zoom: 8,
        narration:
          `${c.city}, ${c.state} has produced ${c.totalAthletes} Team USA athletes — ` +
          `${c.olympic} Olympic and ${c.paralympic} Paralympic. ` +
          `Top sports: ${c.sports.slice(0, 3).map((s) => `${s.sport} (${s.athleteCount})`).join(", ")}.`,
        highlightSports: c.sports.slice(0, 3).map((s) => s.sport),
      })),
      mock: true,
    });
  }

  try {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: TOUR_MODEL,
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.6,
        responseMimeType: "application/json",
        // 4-6 stops × ~90-word narration + title/summary + sport tags can
        // easily exceed 4k tokens. 16k gives plenty of headroom; truncation
        // produces invalid JSON and a 500.
        maxOutputTokens: 16384,
      },
    });

    const userPrompt = [
      "Build me a Team USA tour with these inputs:",
      state ? `- State of focus: ${state}` : null,
      sport ? `- Sport of focus: ${sport}` : null,
      theme ? `- Theme: ${theme}` : null,
      interests ? `- User interests: ${interests}` : null,
      "",
      "CLIMATE CONTEXT (use when relevant):",
      NOAA_CLIMATE,
      "",
      "CANDIDATE CITIES (full per-sport breakdowns):",
      JSON.stringify(candidates, null, 2),
      "",
      "Pick 4-6 cities and produce the tour JSON. Use the sport counts and year ranges directly in narration.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return res.status(500).json({ error: "empty tour response" });

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(500).json({ error: "tour json not found", raw: text });
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    res.json(parsed);
  } catch (err) {
    console.error("tour failed", err);
    res.status(500).json({ error: "tour failed", detail: err?.message });
  }
}
