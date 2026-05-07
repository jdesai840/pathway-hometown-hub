// Group raw athlete records by sport + Olympic/Paralympic.
//
// This is mechanical projection — NO generative AI, no inference. We're just
// joining records and computing simple counts/distributions. Names are stripped
// from the OUTPUT here so the file we send to Gemini contains zero NIL.
//
// The aggregation that follows in distill-sports.mjs uses Gemini via Vertex AI
// to produce sport-level biometric/geographic/era profiles.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, "data", "athletes.raw.json");
const OUT = join(ROOT, "data", "sports.grouped.json");

// Convert "5'8\"" or "5'8" to centimeters. Returns null if unparseable.
function heightToCm(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d+)'\s*(\d+)?/);
  if (!m) return null;
  const ft = Number(m[1]);
  const inch = m[2] ? Number(m[2]) : 0;
  return Math.round((ft * 12 + inch) * 2.54);
}

function isParalympic(athlete) {
  // olympic_paralympic can be "Olympian", "Paralympian", or an array combining both
  const op = athlete.olympic_paralympic;
  if (Array.isArray(op)) return op.includes("Paralympian");
  if (typeof op === "string") return op === "Paralympian";
  // Fallback: para_classification means Paralympic
  return Boolean(athlete.para_classification);
}

function era(year) {
  if (!year || !Number.isFinite(year)) return null;
  // Decade buckets, just for distribution stats
  return Math.floor(year / 10) * 10;
}

async function main() {
  const raw = JSON.parse(await readFile(IN, "utf8"));
  console.log(`loaded ${raw.total} raw athletes`);

  // Group by (sport, isParalympic). One athlete in multiple sports → multiple rows.
  const groups = new Map();
  for (const a of raw.athletes) {
    const para = isParalympic(a);
    // Skip athletes with no sport mapping — they pollute the dataset and have no usable signal.
    if (!a.sports || a.sports.length === 0) continue;
    const sports = a.sports;
    const heightCm = heightToCm(a.quick_facts.height);
    const yrs = a.years || []; // already an array of 4-digit numbers

    for (const sport of sports) {
      const key = `${sport}|${para ? "Paralympic" : "Olympic"}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          sport,
          category: para ? "Paralympic" : "Olympic",
          athleteCount: 0,
          medaledAthleteCount: 0,
          heightCmSamples: [],
          hometownStates: {},
          earliestYear: null,
          latestYear: null,
          yearBuckets: {}, // decade -> count
          totalGold: 0,
          totalSilver: 0,
          totalBronze: 0,
        };
        groups.set(key, g);
      }
      g.athleteCount += 1;
      if (a.medal_count > 0) g.medaledAthleteCount += 1;
      if (heightCm) g.heightCmSamples.push(heightCm);
      if (a.quick_facts.hometown_state) {
        g.hometownStates[a.quick_facts.hometown_state] =
          (g.hometownStates[a.quick_facts.hometown_state] || 0) + 1;
      }
      g.totalGold += a.medal_breakdown?.gold || 0;
      g.totalSilver += a.medal_breakdown?.silver || 0;
      g.totalBronze += a.medal_breakdown?.bronze || 0;
      for (const yr of yrs) {
        if (!Number.isFinite(yr)) continue;
        if (g.earliestYear == null || yr < g.earliestYear) g.earliestYear = yr;
        if (g.latestYear == null || yr > g.latestYear) g.latestYear = yr;
        const bucket = era(yr);
        if (bucket != null) g.yearBuckets[bucket] = (g.yearBuckets[bucket] || 0) + 1;
      }
    }
  }

  // Compute height distribution stats for each group (mean, median, p10, p90)
  function stats(samples) {
    if (samples.length === 0) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((s, v) => s + v, 0);
    return {
      n: sorted.length,
      meanCm: Math.round(sum / sorted.length),
      medianCm: sorted[Math.floor(sorted.length / 2)],
      p10Cm: sorted[Math.floor(sorted.length * 0.1)],
      p90Cm: sorted[Math.floor(sorted.length * 0.9)],
      minCm: sorted[0],
      maxCm: sorted[sorted.length - 1],
    };
  }

  const out = {
    generatedAt: new Date().toISOString(),
    sourceFile: "athletes.raw.json",
    note:
      "Sport-level aggregates only. No athlete names. Suitable as input to Gemini for further " +
      "distillation and clustering.",
    groups: [...groups.values()].map((g) => ({
      sport: g.sport,
      category: g.category,
      athleteCount: g.athleteCount,
      medaledAthleteCount: g.medaledAthleteCount,
      totalMedals: g.totalGold + g.totalSilver + g.totalBronze,
      medalBreakdown: { gold: g.totalGold, silver: g.totalSilver, bronze: g.totalBronze },
      heightStats: stats(g.heightCmSamples),
      topHometownStates: Object.entries(g.hometownStates)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([state, count]) => ({ state, count })),
      earliestYear: g.earliestYear,
      latestYear: g.latestYear,
      yearBuckets: g.yearBuckets,
    })),
  };

  // sanity: NIL leak guard
  const json = JSON.stringify(out);
  if (/("first_?name"|"last_?name"|"athlete_?name")/i.test(json)) {
    throw new Error("NIL field detected in grouped output — aborting");
  }

  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`wrote ${OUT}`);
  console.log(`  ${out.groups.length} sport+category groups`);
  console.log(`  Olympic groups: ${out.groups.filter((g) => g.category === "Olympic").length}`);
  console.log(`  Paralympic groups: ${out.groups.filter((g) => g.category === "Paralympic").length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
