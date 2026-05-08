// Aggregate athletes at the (state, city, sport, category) level using the
// city-coords.json lookup built from the US Census Gazetteer.
//
// Each athlete's hometown_city + hometown_state is normalized and matched
// against the lookup; matched cities get a lat/lng. Unmatched cities are
// skipped (logged), they'd appear without a pin on the map.
//
// Mechanical projection — NO generative AI. NO athlete names in the OUTPUT.
//
// Output: data/city-hubs.json

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ATHLETES_IN = join(ROOT, "data", "athletes.raw.json");
const COORDS_IN = join(ROOT, "data", "city-coords.json");
const OUT = join(ROOT, "data", "city-hubs.json");

const REFERENCE_YEAR = 2026;
const DECAY = 12;

// Athlete data uses clean city names (no Census LSAD suffix). DO NOT strip
// "city" — it would mangle "Salt Lake City" → "salt lake".
function normalize(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^st\s+/, "saint ")
    .replace(/^st\.\s+/, "saint ")
    .trim();
}

function recencyWeight(year) {
  if (!Number.isFinite(year)) return 0;
  return Math.exp((year - REFERENCE_YEAR) / DECAY);
}

function isParalympic(athlete) {
  const op = athlete.olympic_paralympic;
  if (Array.isArray(op)) return op.includes("Paralympian");
  if (typeof op === "string") return op === "Paralympian";
  return Boolean(athlete.para_classification);
}

const raw = JSON.parse(await readFile(ATHLETES_IN, "utf8"));
const coords = JSON.parse(await readFile(COORDS_IN, "utf8"));
console.log(`loaded ${raw.total} athletes, ${Object.keys(coords).length} city-coord entries`);

const cityHubs = new Map();
let matched = 0;
let unmatched = 0;
const unmatchedSamples = new Set();

for (const a of raw.athletes) {
  const state = a.quick_facts?.hometown_state;
  const city = a.quick_facts?.hometown_city;
  if (!state || !city) continue;
  if (!a.sports?.length) continue;

  const norm = normalize(city);
  const key = `${state}|${norm}`;
  const coord = coords[key];
  if (!coord) {
    unmatched += 1;
    if (unmatchedSamples.size < 10) unmatchedSamples.add(`${city}, ${state}`);
    continue;
  }
  matched += 1;

  const athletePara = isParalympic(a);
  const years = a.years || [];
  const athleteWeight = years.length
    ? years.reduce((sum, y) => sum + recencyWeight(y), 0)
    : recencyWeight(REFERENCE_YEAR - 25);
  const goldCount = a.medal_breakdown?.gold || 0;
  const silverCount = a.medal_breakdown?.silver || 0;
  const bronzeCount = a.medal_breakdown?.bronze || 0;

  for (const sportObj of a.sports) {
    const sportName = typeof sportObj === "string" ? sportObj : sportObj.name;
    if (!sportName) continue;
    const sportMeta = typeof sportObj === "object" ? sportObj : null;
    const sportPara = sportMeta?.type === "Paralympic" || (sportMeta?.type == null && athletePara);
    const category = sportPara ? "Paralympic" : "Olympic";
    const hubKey = `${state}|${norm}|${sportName}|${category}`;
    let h = cityHubs.get(hubKey);
    if (!h) {
      h = {
        state,
        city: coord.name, // pretty-printed city name from Census
        cityKey: norm,
        lat: coord.lat,
        lng: coord.lng,
        sport: sportName,
        category,
        season: sportMeta?.season || null,
        slug: sportMeta?.slug || null,
        url: sportMeta?.url ? `https://www.teamusa.com${sportMeta.url}` : null,
        athleteCount: 0,
        recencyWeight: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        earliestYear: null,
        latestYear: null,
      };
      cityHubs.set(hubKey, h);
    }
    h.athleteCount += 1;
    h.recencyWeight += athleteWeight;
    h.gold += goldCount;
    h.silver += silverCount;
    h.bronze += bronzeCount;
    for (const y of years) {
      if (!Number.isFinite(y)) continue;
      if (h.earliestYear == null || y < h.earliestYear) h.earliestYear = y;
      if (h.latestYear == null || y > h.latestYear) h.latestYear = y;
    }
  }
}

const round3 = (n) => Math.round(n * 1000) / 1000;
const out = [...cityHubs.values()].map((h) => ({ ...h, recencyWeight: round3(h.recencyWeight) }));

// Per-city totals (for pin sizing without summing every sport client-side)
const cityTotals = new Map();
for (const h of out) {
  const key = `${h.state}|${h.cityKey}`;
  let t = cityTotals.get(key);
  if (!t) {
    t = {
      state: h.state,
      city: h.city,
      cityKey: h.cityKey,
      lat: h.lat,
      lng: h.lng,
      athleteCount: 0,
      recencyWeight: 0,
      olympicAthletes: 0,
      paralympicAthletes: 0,
      sports: 0,
      earliestYear: null,
      latestYear: null,
    };
    cityTotals.set(key, t);
  }
  t.athleteCount += h.athleteCount;
  t.recencyWeight += h.recencyWeight;
  t.sports += 1;
  if (h.category === "Olympic") t.olympicAthletes += h.athleteCount;
  else t.paralympicAthletes += h.athleteCount;
  if (h.earliestYear != null && (t.earliestYear == null || h.earliestYear < t.earliestYear)) {
    t.earliestYear = h.earliestYear;
  }
  if (h.latestYear != null && (t.latestYear == null || h.latestYear > t.latestYear)) {
    t.latestYear = h.latestYear;
  }
}

const cityTotalsArr = [...cityTotals.values()].map((t) => ({
  ...t,
  recencyWeight: round3(t.recencyWeight),
}));

console.log(`matched ${matched}, unmatched ${unmatched}`);
if (unmatched > 0) {
  console.log("sample unmatched:", [...unmatchedSamples]);
}
console.log(`produced ${cityTotalsArr.length} city totals, ${out.length} (city,sport) hubs`);

// NIL guard
const json = JSON.stringify({ hubs: out, totals: cityTotalsArr });
if (/("first_?name"|"last_?name"|"athlete_?name")/i.test(json)) {
  throw new Error("NIL leak detected — aborting");
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      reference: { year: REFERENCE_YEAR, decay: DECAY },
      cities: cityTotalsArr,
      hubs: out,
    },
    null,
    2
  )
);
console.log(`wrote ${OUT}`);
