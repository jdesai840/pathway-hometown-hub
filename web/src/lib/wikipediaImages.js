// Free Wikipedia REST API for landmark thumbnails. CORS-enabled, no auth.
// Returns the article's lead image URL or null if missing.

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
    const result = url ? { url, description, title: data.title || title } : null;
    cache.set(title, result);
    return result;
  } catch (err) {
    console.warn("wikipedia fetch failed", title, err);
    cache.set(title, null);
    return null;
  }
}
