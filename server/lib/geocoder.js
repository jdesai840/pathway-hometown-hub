// Geocoder for facility addresses + POI names. Cascades through:
//   (a) Google Maps Geocoding API (authoritative — same coord stack used by
//       Photoreal Tiles and Google Maps. Keeps lookup vendor consistent.)
//   (b) OpenStreetMap Nominatim — kept as a fallback in case Google denies
//       the request or the API isn't enabled.
//
// Nominatim usage policy compliance:
// - Identify the app via User-Agent (required).
// - At most ~1 request/second across the whole process (we use 1.1s gap).
// - Cache aggressively to avoid re-hitting the same query.

import { googleGeocode } from "./googleGeocoder.js";

const USER_AGENT =
  "Pathway-TeamUSA-Hackathon/1.0 (krisjaybittensor@gmail.com)";
const cache = new Map();
let lastCallAt = 0;
const MIN_GAP_MS = 1100;

async function nominatimOnce(query) {
  // Throttle: ensure at least MIN_GAP_MS between Nominatim hits.
  const now = Date.now();
  const wait = Math.max(0, lastCallAt + MIN_GAP_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`nominatim HTTP ${res.status}`, query);
      return null;
    }
    const arr = await res.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      formattedAddress: hit.display_name || query,
      source: "nominatim",
    };
  } catch (err) {
    console.warn("nominatim error", query, err?.message);
    return null;
  }
}

// Build a small set of progressively-broader variations to try. Nominatim
// can be picky about facility names containing extra qualifiers ("Vikings
// Athletics", "Swimming and Diving"); stripping those often resolves to
// the parent institution. Stop as soon as one variation hits.
function queryVariations(query) {
  const out = [query];
  // 1. Strip common "<Org> <Suffix>" patterns where suffix is athletics-related.
  const stripped = query
    .replace(
      /\s+(Vikings|Athletics|Swimming(?:\s*(?:and|&)\s*Diving)?|Track(?:\s*(?:and|&)\s*Field)?|Boxing|Diving|Club|Gym|Wrestling|Para|Adaptive Sports)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  if (stripped && stripped !== query) out.push(stripped);
  // 2. Use only the first 2-3 tokens before the comma + the city after the comma.
  const [beforeComma, afterComma] = query.split(",");
  if (beforeComma && afterComma) {
    const tokens = beforeComma.trim().split(/\s+/);
    if (tokens.length > 2) {
      const short = `${tokens.slice(0, 2).join(" ")},${afterComma}`;
      if (!out.includes(short)) out.push(short);
    }
  }
  return out;
}

export async function geocode(query) {
  if (!query) return null;
  const key = query.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);

  // (a) Authoritative path: Google Maps Geocoding API.
  let out = await googleGeocode(query);

  // (b) Fallback to Nominatim with tiered retry if Google had no hit.
  if (!out) {
    for (const q of queryVariations(query)) {
      out = await nominatimOnce(q);
      if (out) break;
    }
  }

  cache.set(key, out);
  return out;
}
