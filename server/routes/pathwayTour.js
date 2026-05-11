import { geocode } from "../lib/geocoder.js";
import { redactNames } from "../lib/nilGuard.js";
import { attachElevations } from "../lib/elevation.js";

// Strip URLs, [N] markers, and parenthetical domain citations from text
// before it goes into a cinematic narration. Citations live as clickable
// chips in the Pathway Result card — they shouldn't be read aloud by
// Cloud TTS or appear in subtitles.
function stripCitations(text) {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(/\bhttps?:\/\/[^\s)]+/gi, "")
    .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, "")
    .replace(
      /\(\s*(?:per |via |see |source:?\s*)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?\s*\)/gi,
      ""
    )
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Exact match (case-insensitive). Loose substring matching used to make
// "Track and Field" wrongly pair with "Para Track and Field" (one is a
// substring of the other). The pathway prompt requires facility.sport to
// match a recommendedSports[].sport verbatim, so strict equality is
// correct.
function sportMatches(facilitySport, target) {
  if (!facilitySport || !target) return false;
  return String(facilitySport).trim().toLowerCase() ===
    String(target).trim().toLowerCase();
}

// Coarse distance check (haversine) so we can reject geocoder hits that
// land in the wrong region (Nominatim's tiered retry occasionally matches
// "Robert F. X" in Texas when the real facility is in Ohio).
function haversineMi(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Prefer Nominatim (Google-Maps-comparable accuracy) for the facility's
// exact location; fall back to the Gemini-emitted approximate coords;
// give up otherwise. Sanity-checks Nominatim hits against the Gemini
// coord (within 100mi) and the city/state token — rejecting cases where
// the suffix-strip retry matches the wrong place in another state.
async function bestCoords(f, fallbackCity) {
  const query = `${f.name}, ${f.city || fallbackCity}`
    .trim()
    .replace(/,\s*$/, "");
  const geo = await geocode(query);
  if (geo) {
    // Sanity check #1: if Gemini gave us approximate coords, require the
    // Nominatim hit to be within 100mi. Catches Texas-vs-Ohio mismatches.
    if (typeof f.lat === "number" && typeof f.lng === "number") {
      const d = haversineMi({ lat: f.lat, lng: f.lng }, { lat: geo.lat, lng: geo.lng });
      if (d > 100) {
        console.warn(
          `geocode rejected — too far from Gemini coord (${d.toFixed(0)}mi):`,
          f.name,
          "→",
          geo.formattedAddress
        );
        return { lat: f.lat, lng: f.lng, source: "gemini-fallback" };
      }
    }
    // Sanity check #2: the facility's stated state should appear in
    // Nominatim's formatted address (most facilities specify "City, ST").
    const stateMatch = (f.city || "").match(/,\s*([A-Z]{2})\s*$/);
    if (stateMatch && geo.formattedAddress) {
      const stateCode = stateMatch[1].toUpperCase();
      const addrLower = geo.formattedAddress.toLowerCase();
      const STATE_NAMES = {
        AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas",
        CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware",
        FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho",
        IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas",
        KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
        MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi",
        MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada",
        NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york",
        NC: "north carolina", ND: "north dakota", OH: "ohio", OK: "oklahoma",
        OR: "oregon", PA: "pennsylvania", RI: "rhode island", SC: "south carolina",
        SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah",
        VT: "vermont", VA: "virginia", WA: "washington", WV: "west virginia",
        WI: "wisconsin", WY: "wyoming", DC: "district of columbia",
      };
      const fullName = STATE_NAMES[stateCode];
      if (fullName && !addrLower.includes(fullName)) {
        console.warn(
          `geocode rejected — state mismatch (expected ${stateCode}):`,
          f.name,
          "→",
          geo.formattedAddress
        );
        if (typeof f.lat === "number" && typeof f.lng === "number") {
          return { lat: f.lat, lng: f.lng, source: "gemini-fallback" };
        }
        return null;
      }
    }
    return { lat: geo.lat, lng: geo.lng, source: "nominatim" };
  }
  if (typeof f.lat === "number" && typeof f.lng === "number") {
    return { lat: f.lat, lng: f.lng, source: "gemini" };
  }
  return null;
}

// Compose a sport-structured cinematic tour from the pathway response.
// Stop 0: the user's hometown — narrated with the local sport-mix
//   breakdown so the viewer understands the density of their own area.
// Stops 1..N: one stop per recommended sport (and the Paralympic
//   counterpart), each centered on the facility paired with that sport.
//   Falls back to the nearest hub for that sport if no facility is
//   tagged.
//
// Output shape matches /api/tour so the frontend's TourController +
// CityCinematic + LiveCaption pipeline picks it up without changes.
export async function pathwayTour(req, res) {
  const r = req.body || {};
  const u = r.userLocation;
  if (
    !u ||
    typeof u.lat !== "number" ||
    typeof u.lng !== "number" ||
    !u.city ||
    !u.state
  ) {
    return res
      .status(400)
      .json({ error: "userLocation with lat/lng/city/state is required" });
  }

  // Build the ordered list of sports to feature.
  const sports = [
    ...(r.recommendedSports || []).map((s) => ({
      sport: s.sport,
      category: s.category || "Olympic",
      why: s.why || "",
    })),
  ];
  if (r.paralympicCounterpart?.sport) {
    sports.push({
      sport: r.paralympicCounterpart.sport,
      category: "Paralympic",
      why: r.paralympicCounterpart.why || "",
    });
  }

  const stops = [];

  // ── Stop 0 — the user's hometown w/ sport breakdown ────────────────
  const homeHub =
    (r.nearbyHubs || []).find(
      (h) => h.city === u.city && h.state === u.state
    ) || (r.nearbyHubs || [])[0];

  const breakdown = (homeHub?.topSports || [])
    .slice(0, 4)
    .map((s) => `${s.sport} (${s.count})`)
    .join(", ");

  const homeNarrationRaw =
    `Your pathway begins in ${u.city}, ${u.state} — the densest part of your local Team USA pipeline. ` +
    `${u.city} has produced ${homeHub?.athleteCount || "several"} athlete${homeHub?.athleteCount === 1 ? "" : "s"}` +
    (breakdown ? `, with hometown roots in ${breakdown}. ` : ". ") +
    `Over the next few stops, you'll see one facility for each recommended sport that could be a starting point.`;

  stops.push({
    city: u.city,
    state: u.state,
    lat: u.lat,
    lng: u.lng,
    narration: await redactNames(stripCitations(homeNarrationRaw)),
    highlightSports: sports.slice(0, 3).map((s) => s.sport),
    landmarks: [
      {
        name: `${u.city}, ${u.state}`,
        wikipedia: null,
        lat: u.lat,
        lng: u.lng,
      },
    ],
    viewpoint: { lat: u.lat, lng: u.lng, name: `${u.city}, ${u.state}` },
  });

  // ── Stops 1..N — one per sport, paired with its facility ──────────
  const usedFacilityNames = new Set();
  for (const s of sports) {
    if (stops.length >= 6) break;

    // Try to pair this sport with a tagged facility.
    const facility = (r.facilities || []).find(
      (f) =>
        f?.name &&
        f.type !== "Category" &&
        !usedFacilityNames.has(f.name) &&
        sportMatches(f.sport, s.sport)
    );

    if (facility) {
      const coords = await bestCoords(facility, u.city);
      if (coords) {
        const facCity =
          (facility.city || "").split(",")[0].trim() || u.city;
        const facState =
          (facility.city || "").split(",")[1]?.trim() || u.state;
        const noteText = facility.note
          ? ` ${stripCitations(facility.note)}`
          : "";
        const narration = await redactNames(
          stripCitations(
            `For ${s.sport}, ${facility.name} in ${facility.city || facCity} could be a starting point — ` +
              `a ${facility.type.toLowerCase()} worth exploring.${noteText}`
          )
        );
        stops.push({
          city: facCity,
          state: facState,
          lat: coords.lat,
          lng: coords.lng,
          narration,
          highlightSports: [s.sport],
          landmarks: [
            {
              name: facility.name,
              wikipedia: null,
              lat: coords.lat,
              lng: coords.lng,
            },
          ],
          viewpoint: {
            lat: coords.lat,
            lng: coords.lng,
            name: facility.name,
          },
        });
        usedFacilityNames.add(facility.name);
        continue;
      }
    }

    // No facility resolved — fall back to the nearest hub that lists
    // this sport in its topSports, so the cinematic still has a
    // geographic anchor for every recommended sport.
    const fallbackHub = (r.nearbyHubs || []).find(
      (h) =>
        typeof h.lat === "number" &&
        (h.topSports || []).some((ts) => sportMatches(ts.sport, s.sport))
    );
    if (fallbackHub) {
      const ts = (fallbackHub.topSports || []).find((x) =>
        sportMatches(x.sport, s.sport)
      );
      const narrationRaw =
        `For ${s.sport}, the nearest local pipeline runs through ${fallbackHub.city}, ${fallbackHub.state}, ` +
        `which has produced ${ts?.count || fallbackHub.athleteCount} Team USA athlete${(ts?.count || fallbackHub.athleteCount) === 1 ? "" : "s"} in this sport — ` +
        `a hub worth tracking as you explore the path.`;
      stops.push({
        city: fallbackHub.city,
        state: fallbackHub.state,
        lat: fallbackHub.lat,
        lng: fallbackHub.lng,
        narration: await redactNames(stripCitations(narrationRaw)),
        highlightSports: [s.sport],
        landmarks: [
          {
            name: `${fallbackHub.city}, ${fallbackHub.state}`,
            wikipedia: null,
            lat: fallbackHub.lat,
            lng: fallbackHub.lng,
          },
        ],
        viewpoint: {
          lat: fallbackHub.lat,
          lng: fallbackHub.lng,
          name: `${fallbackHub.city}, ${fallbackHub.state}`,
        },
      });
    }
  }

  if (stops.length < 2) {
    return res
      .status(422)
      .json({ error: "Not enough geocodable stops to compose a tour." });
  }

  // Anchor the camera + pins to ground terrain instead of WGS84 sea
  // level so the photoreal tiles render correctly at elevation.
  await attachElevations(stops);

  res.json({
    title: `Your Pathway from ${u.city}, ${u.state}`,
    summary:
      "A personalized cinematic flight — your hometown first, then one stop for " +
      "each sport with a real facility you could explore.",
    stops,
  });
}
