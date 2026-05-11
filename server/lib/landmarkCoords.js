import { geocode } from "./geocoder.js";

// Shared coord resolver — used by both /api/pathway-tour and /api/tour
// to pin landmark / facility positions on the photoreal cinematic with
// Google-Maps-level precision.
//
// Cascade:
//   (a) POI-name lookup — Google's POI index pinpoints the actual
//       building (e.g. "Pavilion Center Dr Pool" for the Mermaids
//       or "Olympic and Paralympic Training Center" for Colorado
//       Springs). Only trusted when result types confirm
//       establishment / point_of_interest.
//   (b) Address geocode — reliable parcel centroid when caller has
//       a real street address (Pathway facilities do; AI Tour
//       landmarks usually don't).
//   (c) Non-POI result from (a) — broad area / locality match.
//   (d) Caller-supplied approximate coord (Gemini's lat/lng for
//       Pathway facilities, or the stop's city center for AI Tour
//       landmarks) — last resort.

export const STATE_NAMES = {
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

export function haversineMi(a, b) {
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

// Catch geocoder hits that landed at the wrong building (different
// state, or way too far from the caller's approximation).
export function passesSanityCheck(geo, f, label = "") {
  // Within 100mi of caller's approximation, when we have one.
  if (typeof f.lat === "number" && typeof f.lng === "number") {
    const d = haversineMi(
      { lat: f.lat, lng: f.lng },
      { lat: geo.lat, lng: geo.lng }
    );
    if (d > 100) {
      console.warn(
        `geocode rejected ${label} — too far from anchor (${d.toFixed(0)}mi):`,
        f.name,
        "→",
        geo.formattedAddress
      );
      return false;
    }
  }
  // State token must appear in the formatted address. Google writes
  // 2-letter codes ("Las Vegas, NV 89144"); Nominatim writes full
  // names ("Las Vegas, Clark County, Nevada"). Accept either.
  const stateMatch = (f.city || "").match(/,\s*([A-Z]{2})\s*$/);
  if (stateMatch && geo.formattedAddress) {
    const stateCode = stateMatch[1].toUpperCase();
    const fullName = STATE_NAMES[stateCode];
    const addrLower = geo.formattedAddress.toLowerCase();
    const codeMatch = new RegExp(`\\b${stateCode}\\b`).test(geo.formattedAddress);
    const nameMatch = fullName && addrLower.includes(fullName);
    if (!codeMatch && !nameMatch) {
      console.warn(
        `geocode rejected ${label} — state mismatch (expected ${stateCode}):`,
        f.name,
        "→",
        geo.formattedAddress
      );
      return false;
    }
  }
  return true;
}

// Resolve an item ({ name, city, address?, lat?, lng? }) to precise
// coords. See the cascade comment at the top of this file. Returns
// { lat, lng, source } on success; null if no path resolved AND the
// caller provided no fallback coords.
export async function bestCoords(f, fallbackCity) {
  const nameQuery = `${f.name}, ${f.city || fallbackCity}`
    .trim()
    .replace(/,\s*$/, "");

  // (a) POI-name lookup; only trust when types confirm establishment / POI.
  const geoPoi = await geocode(nameQuery);
  if (
    geoPoi &&
    passesSanityCheck(geoPoi, f, "poi") &&
    Array.isArray(geoPoi.types) &&
    geoPoi.types.some(
      (t) => t === "establishment" || t === "point_of_interest"
    )
  ) {
    return { lat: geoPoi.lat, lng: geoPoi.lng, source: "google-poi" };
  }

  // (b) Address geocode (precise parcel centroid).
  if (typeof f.address === "string" && f.address.trim()) {
    const geoAddr = await geocode(f.address.trim());
    if (geoAddr && passesSanityCheck(geoAddr, f, "address")) {
      return { lat: geoAddr.lat, lng: geoAddr.lng, source: "google-address" };
    }
  }

  // (c) Non-POI result from (a) — still better than nothing.
  if (geoPoi && passesSanityCheck(geoPoi, f, "fallback-poi")) {
    return { lat: geoPoi.lat, lng: geoPoi.lng, source: "geocoder-fallback" };
  }

  // (d) Caller's approximate coord (Gemini / stop center).
  if (typeof f.lat === "number" && typeof f.lng === "number") {
    return { lat: f.lat, lng: f.lng, source: "gemini" };
  }
  return null;
}
