// Lightweight Google Maps Geocoding wrapper for facility/landmark names.
// Caches in-memory per server boot (queries repeat across pathway tours).

const KEY = process.env.MAPS_API_KEY;
const cache = new Map();

export async function geocode(query) {
  if (!KEY || !query) return null;
  const key = query.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", KEY);
  url.searchParams.set("region", "us");

  let out = null;
  try {
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json();
      const hit = j.results?.[0];
      const loc = hit?.geometry?.location;
      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
        out = {
          lat: loc.lat,
          lng: loc.lng,
          formattedAddress: hit.formatted_address || query,
        };
      }
    }
  } catch (err) {
    console.warn("geocode failed", query, err?.message);
  }

  cache.set(key, out);
  return out;
}
