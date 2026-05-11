import { Storage } from "@google-cloud/storage";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BUCKET = process.env.GCS_BUCKET;
const OBJECT = process.env.GCS_ATHLETES_OBJECT || "athletes.raw.json";
const LOCAL_FALLBACK = process.env.LOCAL_ATHLETES;

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5 * 60 * 1000;

// Loads the 8,525-record scraped athlete dataset and strips first/last names
// before exposing it. The agent gets aggregates only — names never enter the
// Vertex AI context or any tool return. Matches the NIL hard rule.
export async function loadAthleteIndex() {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

  const raw = await loadRaw();
  const records = raw.athletes.map((a) => ({
    sports: (a.sports || []).map((s) => ({
      name: s.name,
      type: s.type,
      season: s.season,
    })),
    category: a.olympic_paralympic || null,
    years: Array.isArray(a.years) ? a.years : [],
    qualifiedYears: Array.isArray(a.qualified_years) ? a.qualified_years : [],
    birthYear: a.quick_facts?.birth_year ?? null,
    homeCity: a.quick_facts?.hometown_city ?? null,
    homeState: a.quick_facts?.hometown_state ?? null,
    medals: {
      gold: a.medal_breakdown?.gold ?? 0,
      silver: a.medal_breakdown?.silver ?? 0,
      bronze: a.medal_breakdown?.bronze ?? 0,
      total: a.medal_count ?? 0,
    },
    paraClass: a.para_classification || null,
  }));

  cache = {
    fetchedAt: raw.fetchedAt,
    total: records.length,
    records,
  };
  cacheTime = Date.now();
  return cache;
}

async function loadRaw() {
  if (!BUCKET || LOCAL_FALLBACK) {
    const here = dirname(fileURLToPath(import.meta.url));
    const path = LOCAL_FALLBACK || join(here, "..", "..", "data", "athletes.raw.json");
    const buf = await readFile(path, "utf8");
    return JSON.parse(buf);
  }
  const storage = new Storage();
  const [buf] = await storage.bucket(BUCKET).file(OBJECT).download();
  return JSON.parse(buf.toString());
}
