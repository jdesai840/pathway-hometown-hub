// Free Wikipedia REST API for landmark thumbnails + (when available) lat/lng.
// CORS-enabled, no auth. Returns { url, description, title, coordinates }
// where any field may be null. Returns null only on fetch failure or missing
// article. Callers gate on the specific field they need (img.url for side
// cards, img.coordinates for on-map markers).

const cache = new Map();

export async function fetchWikipediaImage(title) {
  if (!title) return null;
  if (cache.has(title)) return cache.get(title);
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) {
      cache.set(title, null);
      return null;
    }
    const data = await res.json();
    const url =
      data.originalimage?.source ||
      data.thumbnail?.source ||
      null;
    const description = data.extract || null;
    const coordinates =
      data.coordinates &&
      typeof data.coordinates.lat === "number" &&
      typeof data.coordinates.lon === "number"
        ? { lat: data.coordinates.lat, lng: data.coordinates.lon }
        : null;
    const result =
      url || coordinates
        ? { url, description, title: data.title || title, coordinates }
        : null;
    cache.set(title, result);
    return result;
  } catch (err) {
    console.warn("wikipedia fetch failed", title, err);
    cache.set(title, null);
    return null;
  }
}
