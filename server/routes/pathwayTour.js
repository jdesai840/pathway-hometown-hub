import { geocode } from "../lib/geocoder.js";
import { redactNames } from "../lib/nilGuard.js";

// Compose a photoreal cinematic tour from a /api/pathway response. Output
// shape matches /api/tour exactly so the frontend's TourController +
// CityCinematic + LiveCaption pipeline picks it up with zero changes.
//
// Stop 0: the user's hometown coords (anchors the cinematic personally).
// Stops 1..N: each non-Category facility, geocoded via Maps API.
// Fallback: top nearbyHubs if we have <3 stops.
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

  const recommendedSportNames = Array.isArray(r.recommendedSports)
    ? r.recommendedSports.map((s) => s.sport).filter(Boolean)
    : [];

  const stops = [];

  // Stop 0 — the user's hometown.
  stops.push({
    city: u.city,
    state: u.state,
    lat: u.lat,
    lng: u.lng,
    narration: await redactNames(
      `Your pathway begins here in ${u.city}, ${u.state}. From this corner of the map, ` +
        `Team USA's hometown pipeline branches out in directions you may not have realized.`
    ),
    highlightSports: recommendedSportNames.slice(0, 3),
    landmarks: [],
    viewpoint: { lat: u.lat, lng: u.lng, name: `${u.city}, ${u.state}` },
  });

  // Stops 1..N — geocoded facilities.
  for (const f of r.facilities || []) {
    if (stops.length >= 5) break;
    if (!f?.name || f.type === "Category") continue;
    const query = `${f.name}, ${f.city || ""}`.trim().replace(/,\s*$/, "");
    const geo = await geocode(query);
    if (!geo) continue;
    const facilityCity = (f.city || "").split(",")[0].trim() || u.city;
    const facilityState =
      (f.city || "").split(",")[1]?.trim() || u.state;
    const noteText = f.note ? ` ${f.note}` : "";
    const narration = await redactNames(
      `${f.name} in ${f.city || facilityCity} could be a starting point — a ${f.type.toLowerCase()} ` +
        `worth exploring for visits, programs, or events.${noteText}`
    );
    stops.push({
      city: facilityCity,
      state: facilityState,
      lat: geo.lat,
      lng: geo.lng,
      narration,
      highlightSports: recommendedSportNames.slice(0, 2),
      landmarks: [{ name: f.name, wikipedia: null }],
      viewpoint: { lat: geo.lat, lng: geo.lng, name: f.name },
    });
  }

  // Fallback — pad with top nearbyHubs (skip the user's own hometown).
  if (stops.length < 3 && Array.isArray(r.nearbyHubs)) {
    for (const h of r.nearbyHubs) {
      if (stops.length >= 4) break;
      if (
        h?.city === u.city &&
        h?.state === u.state
      )
        continue;
      if (typeof h?.lat !== "number" || typeof h?.lng !== "number") continue;
      const topSport = Array.isArray(h.topSports) ? h.topSports[0] : null;
      const sportLine = topSport
        ? `, with notable strength in ${topSport.sport} (${topSport.count} ${topSport.category} ${topSport.count === 1 ? "athlete" : "athletes"})`
        : "";
      const narration = await redactNames(
        `${h.city}, ${h.state} sits ${h.distMi || "near"} miles away with ${h.athleteCount} ` +
          `Team USA ${h.athleteCount === 1 ? "athlete" : "athletes"}${sportLine}. ` +
          "It's a hub worth tracking from your area."
      );
      stops.push({
        city: h.city,
        state: h.state,
        lat: h.lat,
        lng: h.lng,
        narration,
        highlightSports: topSport ? [topSport.sport] : [],
        landmarks: [],
        viewpoint: { lat: h.lat, lng: h.lng, name: `${h.city}, ${h.state}` },
      });
    }
  }

  if (stops.length < 2) {
    return res
      .status(422)
      .json({ error: "Not enough geocodable stops to compose a tour." });
  }

  res.json({
    title: `Your Pathway from ${u.city}, ${u.state}`,
    summary:
      "A personalized cinematic flight through the Team USA hubs and facilities near you. " +
      "Each stop could be a starting point for exploration.",
    stops,
  });
}
