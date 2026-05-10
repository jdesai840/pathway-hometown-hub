import { VertexAI } from "@google-cloud/vertexai";
import { loadCityHubs } from "../lib/cityHubs.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
// Use Flash for tour generation — much faster than Pro and the task is well-
// structured (just compose narration over data we hand it).
const TOUR_MODEL = process.env.GEMINI_TOUR_MODEL || "gemini-2.5-flash";
// Use Pro for the FREE-FORM "interests" candidate selector — that step needs
// strong semantic reasoning over the full 368-city catalog (e.g. "small towns
// that have contributed to basketball talent" → real small towns, not LA).
// Flash isn't smart enough for this; it falls back to popularity heuristics.
const INTERESTS_SELECTOR_MODEL =
  process.env.GEMINI_INTERESTS_SELECTOR_MODEL || "gemini-2.5-pro";

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

TONE — DECLARATIVE FOR FACTS, CONDITIONAL FOR OUTCOMES:
- ESTABLISHED FACTS get DECLARATIVE language. Use "is", "has", "produces",
  "has produced", "remains". The data is real and verified — don't hedge it.
  Examples (good):
    "Charlotte has produced 14 Olympic and 3 Paralympic athletes."
    "The U.S. National Whitewater Center is a key training facility here."
    "Minnesota leads US curling, with 90 athletes since 2006."
    "Duke University sits at the heart of this hub."
  Examples (BAD — don't write this):
    "Charlotte may have produced 14 athletes."  ← it definitely did
    "The Whitewater Center could be a training facility."  ← it definitely is
- FORWARD-LOOKING claims (predictions, recommendations, future outcomes)
  get CONDITIONAL language ("could", "may", "potentially").
  Examples (good):
    "This region could produce future LA28 medalists."
    "Aspiring athletes may find a clear path here."
    "The pipeline could continue to grow."
- Most sentences are factual — most should be declarative. At most ONE
  forward-looking sentence per stop, and only if it adds something.

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

LANDMARKS (1-3 per stop) — TRAINING PIPELINE FOR THE SPORTS DISCUSSED:
- Pick places where Team USA athletes for the SPORT(S) in this stop's
  highlightSports actually train, develop, or came up through. The goal is to
  show viewers WHERE to go if they wanted to train for the Olympics in this
  city. Choose from, in roughly this priority:
  1) Universities with notable NCAA programs in this sport (and ideally the
     specific facility, not just the school) — e.g. "Stanford_Aquatic_Center"
     for swimming, "Pauley_Pavilion" for basketball, "Bo_Jackson_Indoor_Practice_Facility"
     for track and field.
  2) Official Olympic / Paralympic training facilities — e.g.
     "U.S._Olympic_%26_Paralympic_Training_Center", "Lake_Placid_Olympic_Training_Center",
     "Chula_Vista_Elite_Athlete_Training_Center".
  3) Famous gyms, rinks, pools, tracks, courses, clubs, or stadiums directly
     tied to the sport's pipeline in this region.
- AVOID generic tourist landmarks (Empire State Building, Pikes Peak, the
  local downtown park, famous bridges, museums) UNLESS they are literally a
  training venue for the sport (e.g. an open-water bay for sailing, a famous
  beach for surfing, a public lake known for the regional rowing club).
- 'wikipedia' is the EXACT Wikipedia article title with underscores. Prefer
  landmarks with strong Wikipedia presence so we can fetch thumbnails +
  coordinates. If a specific facility isn't on Wikipedia, fall back to the
  university or training-center it sits within.

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

CITY METRO MODE — when the user prompt says "Tour the metro area around":
- The candidate list below is the COMPLETE universe of cities allowed for
  stops. Pick 4-6 stops, EACH from the candidates. NEVER invent a city or
  pick a famous Team USA hub that isn't in the candidates list — no Park
  City, Colorado Springs, San Diego, etc. unless they literally appear in
  the candidates.
- Vary stops across the metro: aim for distinct cities/suburbs rather than
  4 stops in the same town. (e.g. Raleigh + Durham + Chapel Hill + Cary +
  Holly Springs, not 4× Raleigh.)
- Each stop is a different real city with its own narration, sports
  breakdown, and landmarks per the standard rules above.
- Landmarks at each stop are specific training-pipeline facilities within
  THAT stop's city (the university, training center, club facility, etc.),
  same as state tours.
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

// Great-circle distance in miles between two lat/lng points.
function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius, miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pick top candidate cities for the input + attach each one's full sport
// breakdown so Gemini has everything it needs in a single call.
function buildCandidates(cityHubsDoc, { state, sport, near }) {
  const cities = cityHubsDoc.cities;
  let pool;
  if (
    near &&
    typeof near.lat === "number" &&
    typeof near.lng === "number"
  ) {
    // City tour — gather metro-area cities within ~30 miles of the anchor.
    // 30mi covers most US metros (Raleigh-Durham-Chapel Hill triangle is
    // ~25mi). Auto-expand if too sparse so rural-area users still get a
    // 4-6 stop tour.
    const within = (radius) =>
      cities
        .map((c) => ({
          ...c,
          _miles: haversineMi(near.lat, near.lng, c.lat, c.lng),
        }))
        .filter((c) => c._miles <= radius);
    let scoped = within(30);
    if (scoped.length < 4) scoped = within(60);
    if (scoped.length < 4) scoped = within(100);
    pool = scoped.sort((a, b) => b.athleteCount - a.athleteCount);
  } else if (state) {
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

// Two-stage agentic flow for free-form `interests` queries: Gemini 2.5 Pro
// picks 8-12 cities from the full catalog that semantically match the user's
// intent. The picks are then fed into the regular Flash tour generator as
// candidates. This is what turns "small towns that contributed to basketball
// talent" into Gig Harbor, Lawrenceville, Noblesville etc. — instead of the
// default top-10 hubs LA / Houston / Miami / Chicago.
const INTERESTS_SELECTOR_SYSTEM = `You are a city-selection agent for a Team USA athlete-tour generator.

The user gives a free-form interests query. Pick 8-12 US cities from the catalog whose profile most strongly matches the SEMANTIC INTENT of the query — not just keyword overlap.

Match all of these axes when they appear in the query:
- Geographic intent (region, climate, urban vs. rural, "small towns", coastal, mountain, etc.)
- Sport-specific intent (cities where the named sport actually has a pipeline)
- Narrative angle (small towns punching above their weight, college towns, training centers, hidden hubs, etc.)

You have full knowledge of US geography and population. Use it. If the user says "small towns", pick ACTUAL small towns (low population, not big metros). If the user says "college towns", pick towns whose identity is a university. If the user says a region or climate, respect it.

The catalog contains every US city that has produced 3+ Olympic/Paralympic athletes.
Format per line: city,state,athleteCount,sport1(count);sport2(count);sport3(count)

Output STRICT JSON only:
{ "candidates": [{"city":"City","state":"ST","reason":"<short sentence>"}] }

Rules:
- 8-12 entries. Diverse — don't repeat the same state unless the interest demands it.
- Each city+state MUST be a real entry in the catalog. Use the EXACT city name and 2-letter state code from the catalog line.
- "reason" is a short sentence explaining why this city fits.`;

async function selectInterestsCandidates(interests, cityHubsDoc) {
  // Build a compact CSV-ish catalog of cities with athleteCount >= 3.
  // ~368 cities × ~55 chars/line ≈ 20KB total — small input cost on Pro.
  const catalog = [];
  for (const c of cityHubsDoc.cities) {
    if (c.athleteCount < 3) continue;
    const hubs = cityHubsDoc.hubs
      .filter((h) => h.state === c.state && h.cityKey === c.cityKey)
      .sort((a, b) => b.athleteCount - a.athleteCount);
    const top3 = hubs
      .slice(0, 3)
      .map((h) => `${h.sport}(${h.athleteCount})`)
      .join(";");
    catalog.push(`${c.city},${c.state},${c.athleteCount},${top3}`);
  }

  const userPrompt =
    `USER INTEREST: "${interests}"\n\nCATALOG (${catalog.length} cities):\n` +
    catalog.join("\n");

  const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  const model = vertex.getGenerativeModel({
    model: INTERESTS_SELECTOR_MODEL,
    systemInstruction: {
      role: "system",
      parts: [{ text: INTERESTS_SELECTOR_SYSTEM }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      // Pro's "thinking" tokens count against this budget; 4k was too tight
      // and caused JSON truncation on hard queries (NC-paralympics returned
      // mid-string truncation). 16k matches the Flash tour generator and
      // leaves plenty of room for thinking + the ~3KB JSON output.
      // Note: thinkingBudget: 0 returns 400 from Vertex on 2.5 Pro, so we
      // just budget around it instead of trying to disable it.
      maxOutputTokens: 16384,
      temperature: 0.3,
    },
  });

  const t0 = Date.now();
  const result = await model.generateContent(userPrompt);
  const elapsed = Date.now() - t0;
  const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("interests selector: empty response");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.candidates) || parsed.candidates.length < 4) {
    throw new Error(
      `interests selector: too few candidates (${parsed.candidates?.length ?? 0})`
    );
  }

  // Validate each pick against the real city dataset; drop any that don't
  // match exactly. Then attach the full sport breakdown (same shape as
  // buildCandidates returns).
  const norm = (s) => (s || "").toString().toLowerCase().trim();
  const cityMap = new Map(
    cityHubsDoc.cities.map((c) => [`${c.state}|${norm(c.city)}`, c])
  );
  const picked = [];
  for (const p of parsed.candidates) {
    const key = `${(p.state || "").toUpperCase()}|${norm(p.city)}`;
    const canon = cityMap.get(key);
    if (canon) picked.push(canon);
  }
  if (picked.length < 4) {
    throw new Error(
      `interests selector: only ${picked.length} valid catalog matches`
    );
  }
  console.log(
    `interests selector (${elapsed}ms) picked: ${picked
      .map((c) => `${c.city},${c.state}`)
      .join(" | ")}`
  );

  // Attach full sport breakdowns per city (same shape buildCandidates emits).
  return picked.map((c) => {
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
  const { state, sport, theme, interests, near } = req.body || {};

  let cityHubsDoc;
  try {
    cityHubsDoc = await loadCityHubs();
  } catch (err) {
    console.error("loadCityHubs failed", err);
    return res.status(500).json({ error: "data unavailable" });
  }

  // Per-state bounding boxes computed from the actual city dataset. Used by
  // the post-Gemini sanity clamp to decide whether a stop's lat/lng is
  // plausibly inside its declared state. The previous "first-candidate +/-5°"
  // approach broke for wide states (SD, MT, TX, CA, NY etc.) — Rapid City
  // SD trips a 5°-of-Sioux-Falls test even though it's legit in-state.
  const stateBboxes = new Map();
  for (const c of cityHubsDoc.cities) {
    const cur = stateBboxes.get(c.state) || {
      minLat: c.lat,
      maxLat: c.lat,
      minLng: c.lng,
      maxLng: c.lng,
    };
    cur.minLat = Math.min(cur.minLat, c.lat);
    cur.maxLat = Math.max(cur.maxLat, c.lat);
    cur.minLng = Math.min(cur.minLng, c.lng);
    cur.maxLng = Math.max(cur.maxLng, c.lng);
    stateBboxes.set(c.state, cur);
  }

  // Auto-promote interests like "Raleigh, NC" or "Raleigh" into a `near`
  // city anchor so it routes through the city-tour path instead of the
  // default-branch global top-hubs list. Only fires when no other signal
  // (state/sport/near) is present and the interests text is short enough
  // to plausibly be a place name. Free-form interests ("paralympic athletes
  // in cold-weather states") fall through unchanged.
  let effectiveNear = near;
  if (!state && !sport && !effectiveNear && interests) {
    const trimmed = interests.trim();
    if (trimmed.length > 0 && trimmed.length <= 60) {
      const lower = trimmed.toLowerCase();
      let best = null;
      for (const c of cityHubsDoc.cities) {
        const cityLower = c.city.toLowerCase();
        const safe = cityLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(^|[^a-z])${safe}([^a-z]|$)`);
        if (!re.test(lower)) continue;
        const stateCode = c.state.toLowerCase();
        const stateMentioned =
          new RegExp(`(^|[^a-z])${stateCode}([^a-z]|$)`).test(lower);
        // Lower score = better. Prefer matches where the state is also
        // mentioned, then prefer cities with more athletes (tiebreaker for
        // namesakes like Springfield, IL > Springfield, MO).
        const score = stateMentioned ? 0 : 1;
        if (
          !best ||
          score < best._score ||
          (score === best._score && c.athleteCount > best.athleteCount)
        ) {
          best = { ...c, _score: score };
        }
      }
      if (best) {
        effectiveNear = {
          lat: best.lat,
          lng: best.lng,
          label: `${best.city}, ${best.state}`,
        };
        console.log(
          `interests → auto-detected city anchor: ${effectiveNear.label} (from "${trimmed}")`
        );
      }
    }
  }

  // For pure free-form interests queries (no state/sport/near + no
  // single-city auto-detected anchor), use Gemini 2.5 Pro to pick the
  // candidates that match the SEMANTIC intent. Otherwise the default
  // buildCandidates branch would just return the global top-10 hubs and
  // the user would get LA / Houston / Miami / Chicago for any query.
  let candidates = null;
  const isPureInterests =
    interests && !state && !sport && !effectiveNear;
  if (isPureInterests && PROJECT) {
    try {
      candidates = await selectInterestsCandidates(interests, cityHubsDoc);
    } catch (err) {
      console.warn(
        "interests selector failed, falling back to top-10:",
        err.message
      );
      candidates = null;
    }
  }
  if (!candidates) {
    candidates = buildCandidates(cityHubsDoc, {
      state,
      sport,
      near: effectiveNear,
    });
  }
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
      effectiveNear?.label
        ? `- Tour the metro area around ${effectiveNear.label}. Pick 4-6 stops, EACH from the candidate cities listed below (all within ~30 miles of this anchor). NEVER use cities that aren't in the candidate list — no nationwide hubs like Park City, Colorado Springs, San Diego, etc. unless they literally appear as candidates. See "CITY METRO MODE" in the system prompt.`
        : null,
      sport ? `- Sport of focus: ${sport}` : null,
      theme ? `- Theme: ${theme}` : null,
      isPureInterests
        ? `- The user's free-form interest: "${interests}". The candidate list below was curated specifically to match this intent (an upstream agent picked these cities from the full 1801-city US catalog because they fit the user's angle). Build a tour of 4-6 stops from these candidates that LEANS INTO the angle the user described — small towns, specific sports, regional pipelines, etc. Don't water it down to "Team USA's top hubs"; speak to the user's actual interest in the title, summary, and stop narrations.`
        : interests
        ? `- User interests: ${interests}`
        : null,
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

    // DEFENSIVE: Gemini sometimes invents lat/lng or returns city names that
    // don't exact-match our candidates. Three-stage fallback:
    //   1) exact (state, normalized-city) match → use canonical lat/lng
    //   2) Gemini's viewpoint lat/lng if present (it's the city the cinematic
    //      will fly over, so the 2D map should match)
    //   3) leave Gemini's stop.lat/lng as-is
    const norm = (s) =>
      (s || "")
        .toString()
        .toLowerCase()
        .replace(/[.,'"]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const candidateMap = new Map(
      candidates.map((c) => [`${c.state}|${norm(c.city)}`, c])
    );
    if (Array.isArray(parsed?.stops)) {
      parsed.stops = parsed.stops
        .map((s) => {
          const key = `${(s.state || "").toUpperCase()}|${norm(s.city)}`;
          const canon = candidateMap.get(key);
          if (canon) {
            return { ...s, lat: canon.lat, lng: canon.lng };
          }
          // Fallback to viewpoint coords so the 2D map at least pans to where
          // the cinematic will fly.
          if (
            s.viewpoint &&
            typeof s.viewpoint.lat === "number" &&
            typeof s.viewpoint.lng === "number"
          ) {
            return { ...s, lat: s.viewpoint.lat, lng: s.viewpoint.lng };
          }
          return s;
        })
        // Final guard: any stop without valid lat/lng is unusable. Better to
        // drop it than let the client pass garbage to map.setCenter and ghost
        // a previous viewport (the "McLean" bug).
        .filter((s) => {
          const ok = typeof s.lat === "number" && typeof s.lng === "number";
          if (!ok) console.warn("dropping tour stop with no coords", s);
          return ok;
        });

      // CITY-TOUR DEFENSIVE FILTER: when the user asked for a city/metro
      // tour, stops MUST come from the candidate list. Drop anything Gemini
      // hallucinated from general knowledge (e.g. it picked San Diego or
      // Park City for a Raleigh-metro tour). State/sport tours skip this —
      // they have legitimate canonical-lookup-miss fallback paths.
      if (effectiveNear) {
        parsed.stops = parsed.stops.filter((s) => {
          const key = `${(s.state || "").toUpperCase()}|${norm(s.city)}`;
          if (!candidateMap.has(key)) {
            console.warn(
              `city tour dropped out-of-candidate stop: ${s.city}, ${s.state}`
            );
            return false;
          }
          return true;
        });
        if (parsed.stops.length < 2) {
          return res.status(500).json({
            error:
              "city tour generation off-target — most stops were outside the requested metro",
          });
        }
      }

      // Sanity-clamp: a stop's coords must fall inside its declared state's
      // actual bounding box (computed from real city data). The prior
      // "5° from first candidate" heuristic was wrong for wide states —
      // Rapid City SD is 6.5° west of Sioux Falls (the top SD candidate)
      // but legitimately in-state, so the clamp wrongly snapped it to
      // Sioux Falls and the cinematic flew to the wrong place.
      const candidatesByState = new Map();
      for (const c of candidates) {
        if (!candidatesByState.has(c.state)) candidatesByState.set(c.state, c);
      }
      const BBOX_PAD = 0.5; // half-degree padding for coastline / cell-edges
      parsed.stops = parsed.stops.map((s) => {
        const stateCode = (s.state || "").toUpperCase();
        const bbox = stateBboxes.get(stateCode);
        let next = s;
        if (bbox) {
          const outOfBox =
            s.lat < bbox.minLat - BBOX_PAD ||
            s.lat > bbox.maxLat + BBOX_PAD ||
            s.lng < bbox.minLng - BBOX_PAD ||
            s.lng > bbox.maxLng + BBOX_PAD;
          if (outOfBox) {
            const stateAnchor =
              candidatesByState.get(stateCode) ||
              // Fall back to the bbox centroid if no in-state candidate.
              {
                lat: (bbox.minLat + bbox.maxLat) / 2,
                lng: (bbox.minLng + bbox.maxLng) / 2,
              };
            console.warn(
              `tour stop ${s.city}, ${s.state} coords (${s.lat},${s.lng}) ` +
              `outside ${stateCode} bbox; clamping to (${stateAnchor.lat},${stateAnchor.lng}).`
            );
            next = { ...next, lat: stateAnchor.lat, lng: stateAnchor.lng };
          }
        }
        // Viewpoint sanity: must be close to the (now-clamped) stop coords.
        // Use real miles (50mi cap) instead of degrees so wide-state stops
        // aren't unfairly clamped. The cinematic camera flies to viewpoint;
        // a wonky viewpoint shows the user "wrong tiles."
        const vp = next.viewpoint;
        if (
          vp &&
          typeof vp.lat === "number" &&
          typeof vp.lng === "number"
        ) {
          const milesFromStop = haversineMi(vp.lat, vp.lng, next.lat, next.lng);
          if (milesFromStop > 50) {
            console.warn(
              `tour stop ${next.city}, ${next.state} viewpoint (${vp.lat},${vp.lng}) ` +
              `is ${milesFromStop.toFixed(1)}mi from stop coords; ` +
              `falling viewpoint back to stop.`
            );
            next = {
              ...next,
              viewpoint: {
                ...vp,
                lat: next.lat,
                lng: next.lng,
              },
            };
          }
        } else if (vp) {
          // viewpoint present but non-numeric — drop so the cinematic falls
          // back to stop.lat/lng via its own guard.
          next = { ...next, viewpoint: null };
        }
        return next;
      });
    }
    if (!Array.isArray(parsed?.stops) || parsed.stops.length === 0) {
      return res.status(500).json({ error: "no usable stops in tour" });
    }

    // ── Attach ground elevation to each stop's viewpoint ─────────────────
    // The cinematic camera positions itself relative to frame.center, which
    // we currently build from latLngToECEF(lat, lng, 0) — i.e., the WGS84
    // ellipsoid (~sea level). For high-elevation cities (El Paso 1140m,
    // Denver 1610m, Park City 2100m) the camera ends up underneath the
    // terrain and the photoreal tiles fail. Batch-fetch Google Elevation
    // for all stops in one call (~100ms + ~$0.005/tour) and let the client
    // anchor the camera at ground level. Graceful fallback to no elevation
    // on API failure — server reverts to today's behavior, no regression.
    const MAPS_KEY = process.env.MAPS_API_KEY;
    if (MAPS_KEY) {
      try {
        const locs = parsed.stops
          .map((s) => {
            const v = s.viewpoint;
            const lat =
              v && typeof v.lat === "number" ? v.lat : s.lat;
            const lng =
              v && typeof v.lng === "number" ? v.lng : s.lng;
            return `${lat},${lng}`;
          })
          .join("|");
        const url =
          `https://maps.googleapis.com/maps/api/elevation/json` +
          `?locations=${encodeURIComponent(locs)}` +
          `&key=${MAPS_KEY}`;
        const r = await fetch(url);
        const data = await r.json();
        if (
          data.status === "OK" &&
          Array.isArray(data.results) &&
          data.results.length === parsed.stops.length
        ) {
          parsed.stops.forEach((s, i) => {
            const elev = data.results[i]?.elevation;
            if (typeof elev === "number") {
              if (!s.viewpoint) {
                s.viewpoint = { lat: s.lat, lng: s.lng };
              }
              s.viewpoint.elevation = elev;
            }
          });
          console.log(
            "attached elevations:",
            parsed.stops
              .map((s) =>
                typeof s.viewpoint?.elevation === "number"
                  ? Math.round(s.viewpoint.elevation) + "m"
                  : "?"
              )
              .join(", ")
          );
        } else {
          console.warn(
            "elevation API non-OK or count mismatch (non-fatal):",
            data.status,
            data.error_message || ""
          );
        }
      } catch (err) {
        console.warn("elevation lookup failed (non-fatal):", err.message);
      }
    }

    console.log(
      "tour returning stops:",
      parsed.stops
        .map((s) => {
          const v = s.viewpoint;
          const vlbl =
            v && typeof v.lat === "number" && typeof v.lng === "number"
              ? ` vp(${v.lat.toFixed(3)},${v.lng.toFixed(3)})`
              : "";
          return `${s.city}, ${s.state} @ (${s.lat},${s.lng})${vlbl}`;
        })
        .join(" | ")
    );
    res.json(parsed);
  } catch (err) {
    console.error("tour failed", err);
    res.status(500).json({ error: "tour failed", detail: err?.message });
  }
}
