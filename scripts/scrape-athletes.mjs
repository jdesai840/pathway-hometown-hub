// Scrape teamusa.com /api/athletes endpoint.
//
// Compliance:
// - Source: teamusa.com public JSON API (/api/athletes). No auth, no scraping circumvention.
// - Tool: Node's built-in fetch (HTTP). NO generative AI, no third-party APIs.
// - Athlete names ARE pulled here — the rules permit processing data with names,
//   they only forbid OUTPUT at the individual level. This raw file is pipeline-only
//   and never deployed or returned by any user-facing endpoint.
// - We do NOT pull or store: finish times, scoring data, images.
//
// Output: data/athletes.raw.json (8525 records as of scrape time)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "athletes.raw.json");
const ENDPOINT = "https://www.teamusa.com/api/athletes";
const PAGE_SIZE = 200;
const DELAY_MS = 150; // be polite

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(skip) {
  const url = `${ENDPOINT}?skip=${skip}&limit=${PAGE_SIZE}`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// Extract 4-digit Olympic-era years from a string like "Olympian 2008, 2012, 2016".
function extractYears(s) {
  if (!s || typeof s !== "string") return [];
  const matches = s.match(/(?:19|20)\d{2}/g) || [];
  return [...new Set(matches.map((y) => Number(y)))];
}

// Strict whitelist of fields we keep from each entry.
// Anything not in this list gets dropped — including images, banners, content_tags blobs etc.
function projectEntry(e) {
  const qf = e.bio?.quick_facts || {};
  const m = e.medals || {};
  const gold = Number(m.gold) || 0;
  const silver = Number(m.silver) || 0;
  const bronze = Number(m.bronze) || 0;
  return {
    uid: e.uid,
    first_name: (e.first_name || "").trim(),
    last_name: (e.last_name || "").trim(),
    sports: Array.isArray(e.sport)
      ? e.sport.map((s) => (typeof s === "object" ? s.title || s.name : s)).filter(Boolean).map((x) => x.trim())
      : [],
    olympic_paralympic: e.olympic_paralympic, // "Olympian" | "Paralympian" | array
    years: extractYears(e.olympian_paralympian_years),
    qualified_years: extractYears(e.olympian_paralympian_qualified),
    world_championship_years: extractYears(e.world_championship_years),
    para_classification: e.para_classification || null,
    medal_count: gold + silver + bronze,
    medal_breakdown: { gold, silver, bronze },
    quick_facts: {
      height: qf.height || null, // raw string, e.g. "5'8\""
      birth_year: qf.birthday ? new Date(qf.birthday).getFullYear() : null,
      hometown_city: qf.hometown?.city || null,
      hometown_state: qf.hometown?.state || null,
    },
  };
}

async function main() {
  console.log(`fetching first page to determine total...`);
  const first = await fetchPage(0);
  const total = first.total;
  console.log(`total athletes: ${total}`);

  const all = first.entries.map(projectEntry);
  let skip = first.entries.length;

  while (skip < total) {
    process.stdout.write(`\r  fetched ${all.length}/${total}...`);
    const batch = await fetchPage(skip);
    if (!batch.entries?.length) break;
    all.push(...batch.entries.map(projectEntry));
    skip += batch.entries.length;
    await sleep(DELAY_MS);
  }
  console.log(`\nfetched ${all.length} athletes`);

  await mkdir(dirname(OUT), { recursive: true });
  const out = {
    fetchedAt: new Date().toISOString(),
    source: ENDPOINT,
    total: all.length,
    note:
      "Athlete names are present in this PIPELINE-ONLY file. Per hackathon rules, names " +
      "must NOT appear in the deployed app's output. Subsequent steps aggregate to sport level.",
    athletes: all,
  };
  await writeFile(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
