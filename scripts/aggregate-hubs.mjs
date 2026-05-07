// Aggregate 8525 Team USA athletes into state × sport × category "hubs".
//
// Mechanical projection — NO generative AI. Pure JS group-by + math.
// Output is sport-level aggregates, no athlete names.
//
// Recency weighting: each Olympic/Paralympic year an athlete competed contributes
// w = exp((year - REFERENCE_YEAR) / DECAY)
// REFERENCE_YEAR = 2026 (LA28 prep horizon), DECAY = 12 years
//   2024 athletes count weight ≈ 0.85   (current momentum)
//   2014 athletes count weight ≈ 0.37   (recent legacy)
//   2000 athletes count weight ≈ 0.11
//   1980 athletes count weight ≈ 0.02
// This emphasizes momentum heading into LA28 while still surfacing the 120-year arc.
//
// Output: data/hubs.json
//   {
//     generatedAt, source,
//     reference: {year, decay, allTimeRange: [earliest, latest]},
//     totals: { athleteCount, recencyWeight, medalCount, byCategory: {Olympic, Paralympic} },
//     hubs: [ {state, sport, category, season, slug, url, athleteCount, recencyWeight,
//              medalCount, gold, silver, bronze, earliestYear, latestYear, decadeBuckets} ],
//     stateTotals: { ST: { athleteCount, recencyWeight, byCategory } }
//   }

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, "data", "athletes.raw.json");
const OUT = join(ROOT, "data", "hubs.json");

const REFERENCE_YEAR = 2026;
const DECAY = 12;

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

const raw = JSON.parse(await readFile(IN, "utf8"));
console.log(`loaded ${raw.total} athletes`);

const hubKey = (state, sport, category) => `${state}|${sport}|${category}`;
const hubs = new Map();
const stateTotals = new Map();
const totals = {
  athleteCount: 0,
  recencyWeight: 0,
  medalCount: 0,
  byCategory: { Olympic: { athleteCount: 0, recencyWeight: 0 }, Paralympic: { athleteCount: 0, recencyWeight: 0 } },
};
let allTimeEarliest = Infinity;
let allTimeLatest = -Infinity;

for (const a of raw.athletes) {
  const state = a.quick_facts?.hometown_state;
  if (!state) continue; // Hub aggregation requires a state. Skip athletes without one.
  if (!a.sports?.length) continue;

  const athletePara = isParalympic(a);
  const years = a.years || [];
  const athleteWeight = years.length
    ? years.reduce((sum, y) => sum + recencyWeight(y), 0)
    : recencyWeight(REFERENCE_YEAR - 25); // unknown era → assume mid-career legacy
  const goldCount = a.medal_breakdown?.gold || 0;
  const silverCount = a.medal_breakdown?.silver || 0;
  const bronzeCount = a.medal_breakdown?.bronze || 0;
  const medalTotal = goldCount + silverCount + bronzeCount;

  for (const y of years) {
    if (Number.isFinite(y)) {
      if (y < allTimeEarliest) allTimeEarliest = y;
      if (y > allTimeLatest) allTimeLatest = y;
    }
  }

  // Update overall totals (count each athlete once, regardless of how many sports)
  totals.athleteCount += 1;
  totals.recencyWeight += athleteWeight;
  totals.medalCount += medalTotal;
  const catKey = athletePara ? "Paralympic" : "Olympic";
  totals.byCategory[catKey].athleteCount += 1;
  totals.byCategory[catKey].recencyWeight += athleteWeight;

  // Per-state totals (also once per athlete)
  if (!stateTotals.has(state)) {
    stateTotals.set(state, {
      athleteCount: 0,
      recencyWeight: 0,
      medalCount: 0,
      byCategory: { Olympic: 0, Paralympic: 0 },
    });
  }
  const st = stateTotals.get(state);
  st.athleteCount += 1;
  st.recencyWeight += athleteWeight;
  st.medalCount += medalTotal;
  st.byCategory[catKey] += 1;

  // Per-(state,sport) hubs (once per sport an athlete plays)
  for (const sportObj of a.sports) {
    const sportName = typeof sportObj === "string" ? sportObj : sportObj.name;
    if (!sportName) continue;
    const sportMeta = typeof sportObj === "object" ? sportObj : null;
    const sportPara = sportMeta?.type === "Paralympic" || (sportMeta?.type == null && athletePara);
    const category = sportPara ? "Paralympic" : "Olympic";
    const key = hubKey(state, sportName, category);
    let h = hubs.get(key);
    if (!h) {
      h = {
        state,
        sport: sportName,
        category,
        season: sportMeta?.season || null,
        slug: sportMeta?.slug || null,
        url: sportMeta?.url ? `https://www.teamusa.com${sportMeta.url}` : null,
        athleteCount: 0,
        recencyWeight: 0,
        medalCount: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        earliestYear: null,
        latestYear: null,
        decadeBuckets: {},
      };
      hubs.set(key, h);
    }
    h.athleteCount += 1;
    h.recencyWeight += athleteWeight;
    h.medalCount += medalTotal;
    h.gold += goldCount;
    h.silver += silverCount;
    h.bronze += bronzeCount;
    if (!h.url && sportMeta?.url) h.url = `https://www.teamusa.com${sportMeta.url}`;
    if (!h.slug && sportMeta?.slug) h.slug = sportMeta.slug;
    if (!h.season && sportMeta?.season) h.season = sportMeta.season;
    for (const y of years) {
      if (!Number.isFinite(y)) continue;
      if (h.earliestYear == null || y < h.earliestYear) h.earliestYear = y;
      if (h.latestYear == null || y > h.latestYear) h.latestYear = y;
      const decade = Math.floor(y / 10) * 10;
      h.decadeBuckets[decade] = (h.decadeBuckets[decade] || 0) + 1;
    }
  }
}

// Round recency weights for compactness
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

const hubsArr = [...hubs.values()].map((h) => ({
  ...h,
  recencyWeight: round3(h.recencyWeight),
}));

const stateTotalsObj = Object.fromEntries(
  [...stateTotals.entries()].map(([k, v]) => [k, { ...v, recencyWeight: round3(v.recencyWeight) }])
);

const out = {
  generatedAt: new Date().toISOString(),
  source: "athletes.raw.json (teamusa.com /api/athletes)",
  note:
    "State × Sport × (Olympic|Paralympic) hubs. Aggregated from 8525 athletes; no individual " +
    "names appear in this output. Recency weighting prioritizes athletes near LA28; raw " +
    "athleteCount preserves the 120-year arc.",
  reference: {
    year: REFERENCE_YEAR,
    decay: DECAY,
    formula: "weight per year = exp((year - 2026) / 12)",
    allTimeRange: [allTimeEarliest === Infinity ? null : allTimeEarliest, allTimeLatest === -Infinity ? null : allTimeLatest],
  },
  totals: {
    ...totals,
    recencyWeight: round3(totals.recencyWeight),
    byCategory: {
      Olympic: { ...totals.byCategory.Olympic, recencyWeight: round3(totals.byCategory.Olympic.recencyWeight) },
      Paralympic: { ...totals.byCategory.Paralympic, recencyWeight: round3(totals.byCategory.Paralympic.recencyWeight) },
    },
  },
  hubs: hubsArr,
  stateTotals: stateTotalsObj,
};

// NIL guard
const json = JSON.stringify(out);
if (/("first_?name"|"last_?name"|"athlete_?name")/i.test(json)) {
  throw new Error("NIL leak detected — aborting");
}

await writeFile(OUT, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}`);
console.log(`  ${hubsArr.length} hubs across ${Object.keys(stateTotalsObj).length} states`);
console.log(`  Olympic athletes: ${out.totals.byCategory.Olympic.athleteCount}`);
console.log(`  Paralympic athletes: ${out.totals.byCategory.Paralympic.athleteCount}`);
console.log(`  Year range: ${out.reference.allTimeRange.join(' – ')}`);
