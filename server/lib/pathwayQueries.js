import { loadCityHubs } from "./cityHubs.js";
import { loadAthleteIndex } from "./athleteIndex.js";

const MI_PER_DEG_LAT = 69.0;

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

// Derive a city×sport×category breakdown over the full athleteIndex.
// Memoized once per server boot (athleteIndex itself has 5-min cache).
let _citySportCache = null;
function buildCitySportBreakdown(records) {
  if (_citySportCache) return _citySportCache;
  const map = new Map();
  for (const r of records) {
    if (!r.homeCity || !r.homeState) continue;
    const key = `${r.homeCity}|${r.homeState}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { city: r.homeCity, state: r.homeState, sports: new Map() };
      map.set(key, entry);
    }
    for (const sp of r.sports) {
      if (!sp.name) continue;
      const skey = `${sp.name}|${sp.type || "Olympic"}`;
      let sport = entry.sports.get(skey);
      if (!sport) {
        sport = { sport: sp.name, category: sp.type || "Olympic", count: 0 };
        entry.sports.set(skey, sport);
      }
      sport.count += 1;
    }
  }
  _citySportCache = map;
  return map;
}

function topSportsForCity(citySportMap, city, state, limit = 5) {
  const entry = citySportMap.get(`${city}|${state}`);
  if (!entry) return [];
  return [...entry.sports.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Case-insensitive fuzzy match against the cityHubsDoc. Returns a hit or null.
export async function resolveUserCity({ city, state }) {
  const doc = await loadCityHubs();
  const wantCity = city.trim().toLowerCase();
  const wantState = (state || "").trim().toUpperCase();
  // Exact match on city+state (preferred).
  let hit = doc.cities.find(
    (c) =>
      c.city.toLowerCase() === wantCity &&
      (!wantState || c.state.toUpperCase() === wantState)
  );
  if (hit) return hit;
  // Substring match within the same state.
  hit = doc.cities.find(
    (c) =>
      c.city.toLowerCase().includes(wantCity) &&
      (!wantState || c.state.toUpperCase() === wantState)
  );
  if (hit) return hit;
  // Last resort: substring match across all states.
  hit = doc.cities.find((c) => c.city.toLowerCase().includes(wantCity));
  return hit || null;
}

// Returns the top N nearest cities (within radiusMi) plus per-city sport
// breakdown filtered by the requested category.
export async function findNearbyHubs({
  lat,
  lng,
  radiusMi = 150,
  category = "Both",
  limit = 12,
}) {
  const doc = await loadCityHubs();
  const idx = await loadAthleteIndex();
  const citySport = buildCitySportBreakdown(idx.records);

  // Coarse pre-filter by lat/lng box to avoid haversine on 368 cities.
  const dLat = radiusMi / MI_PER_DEG_LAT;
  const dLng = radiusMi / (MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

  const candidates = doc.cities.filter(
    (c) =>
      Math.abs(c.lat - lat) <= dLat && Math.abs(c.lng - lng) <= dLng
  );

  const ranked = candidates
    .map((c) => ({
      ...c,
      distMi: haversineMi({ lat, lng }, { lat: c.lat, lng: c.lng }),
    }))
    .filter((c) => c.distMi <= radiusMi);

  // Apply category filter by looking at the city's own olympic/paralympic
  // counts; cities with zero in the requested category get pruned.
  const filtered = ranked.filter((c) => {
    if (category === "Olympic") return c.olympicAthletes > 0;
    if (category === "Paralympic") return c.paralympicAthletes > 0;
    return c.athleteCount > 0;
  });

  filtered.sort(
    (a, b) =>
      // Closer first, but weight by athleteCount within ~30mi tiers.
      Math.floor(a.distMi / 30) - Math.floor(b.distMi / 30) ||
      b.athleteCount - a.athleteCount
  );

  const top = filtered.slice(0, limit).map((c) => ({
    city: c.city,
    state: c.state,
    distMi: Math.round(c.distMi),
    athleteCount: c.athleteCount,
    olympic: c.olympicAthletes,
    paralympic: c.paralympicAthletes,
    topSports: topSportsForCity(citySport, c.city, c.state, 5).filter((s) => {
      if (category === "Olympic") return s.category === "Olympic";
      if (category === "Paralympic") return s.category === "Paralympic";
      return true;
    }),
  }));

  return top;
}
