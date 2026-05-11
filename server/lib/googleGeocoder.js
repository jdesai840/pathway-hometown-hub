// Google Maps Geocoding API client. Uses the same MAPS_API_KEY the rest of
// the app uses for Photoreal Tiles + Maps JS — the project's
// "hometown-hubs-maps" key has been granted Geocoding API access and works
// server-side, so the coord stack stays end-to-end Google: Geocoding →
// Photoreal Tiles. Falls back gracefully if the API returns denied / no
// result (the higher-level geocoder then tries Nominatim → Gemini coords).

// Prefer the dedicated unrestricted server-side key (created via gcloud,
// restricted to Geocoding API only). Fall back to MAPS_API_KEY in case
// it's been opened up — though that's referrer-restricted by default
// and Google's Geocoding API explicitly refuses referrer-restricted keys.
const KEY = process.env.GOOGLE_GEOCODING_KEY || process.env.MAPS_API_KEY;
const cache = new Map();

export async function googleGeocode(query) {
  if (!KEY || !query) return null;
  const key = query.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("region", "us");
  url.searchParams.set("key", KEY);

  let out = null;
  try {
    const res = await fetch(url.toString());
    if (res.ok) {
      const j = await res.json();
      if (j.status === "OK" && j.results?.[0]?.geometry?.location) {
        const loc = j.results[0].geometry.location;
        out = {
          lat: loc.lat,
          lng: loc.lng,
          formattedAddress: j.results[0].formatted_address || query,
          types: Array.isArray(j.results[0].types) ? j.results[0].types : [],
          source: "google",
        };
      } else if (j.status === "REQUEST_DENIED") {
        console.warn(
          "google geocode denied:",
          (j.error_message || "").slice(0, 120)
        );
      } else if (j.status !== "ZERO_RESULTS") {
        console.warn("google geocode status:", j.status);
      }
    } else {
      console.warn(`google geocode HTTP ${res.status}`, query);
    }
  } catch (err) {
    console.warn("google geocode error", query, err?.message);
  }

  cache.set(key, out);
  return out;
}
