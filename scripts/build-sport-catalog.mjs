// Derive sport-catalog.json from sports.grouped.json.
// Maps sport name (case-insensitive) → metadata for "How to start" links in the UI.
// Mechanical projection — no AI.

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, "data", "sports.grouped.json");
const OUT = join(ROOT, "data", "sport-catalog.json");

const grouped = JSON.parse(await readFile(IN, "utf8"));
const catalog = {};

for (const g of grouped.groups) {
  // The same sport (e.g., "Track and Field") can exist in both Olympic and Paralympic
  // categories. Key by sport+category so each entry is unambiguous.
  const key = `${g.sport.toLowerCase()}|${g.category.toLowerCase()}`;
  catalog[key] = {
    sport: g.sport,
    category: g.category,
    season: g.season,
    slug: g.slug,
    url: g.url, // already absolute teamusa.com URL
    athleteCount: g.athleteCount,
    earliestYear: g.earliestYear,
    latestYear: g.latestYear,
  };
}

await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), catalog }, null, 2));
console.log(`wrote ${Object.keys(catalog).length} sport+category entries to ${OUT}`);
