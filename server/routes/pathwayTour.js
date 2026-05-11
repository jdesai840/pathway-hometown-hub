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

function sportMatches(facilitySport, target) {
  if (!facilitySport || !target) return false;
  const a = String(facilitySport).toLowerCase();
  const b = String(target).toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

// Prefer Nominatim (Google-Maps-comparable accuracy) for the facility's
// exact location; fall back to the Gemini-emitted approximate coords;
// give up otherwise.
async function bestCoords(f, fallbackCity) {
  const query = `${f.name}, ${f.city || fallbackCity}`
    .trim()
    .replace(/,\s*$/, "");
  const geo = await geocode(query);
  if (geo) {
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
