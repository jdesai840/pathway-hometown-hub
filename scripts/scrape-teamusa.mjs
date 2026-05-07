// Scrape teamusa.com /all-time-medals page.
// Extracts medal aggregates by category (Winter/Summer × Olympic/Paralympic).
//
// Compliance:
// - Public source: teamusa.com (allowed by hackathon rules).
// - We only consume *aggregated* data — per-Games totals and per-sport counts.
// - No athlete names, images, or likenesses are pulled or stored.
// - No timing data is fetched.
//
// Output: data/teamusa-aggregates.json

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "teamusa-aggregates.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";

// Try to fetch each filter combination separately so we get larger pages per category.
// teamusa.com /all-time-medals supports filter query params via Vike pageContext.
const URLS = [
  { url: "https://www.teamusa.com/all-time-medals", label: "default" },
];

function extractVikeJSON(html) {
  const m = html.match(
    /<script id="vike_pageContext" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) throw new Error("vike_pageContext not found");
  return JSON.parse(m[1]);
}

function extractMedalsTables(ctx) {
  const content = ctx?.props?.pageData?.content || [];
  return content
    .filter((b) => b && typeof b === "object" && b.medals_table)
    .map((b) => b.medals_table);
}

function projectTable(t) {
  return {
    title: t.title, // e.g. "Summer Olympics"
    isSummer: t.medals?.[0]?.isSummer ?? null,
    isParalympic: t.medals?.[0]?.isParalympic ?? null,
    overallMedals: t.overall_medals,
    totalGames: t.total,
    sports: (t.aggregated_filters?.sports || []).map((s) => ({
      name: s.name,
      medalCount: s.count,
    })),
    games: (t.medals || []).map((g) => ({
      eventId: g.eventId,
      city: g.city,
      year: g.year,
      gold: g.gold_medals,
      silver: g.silver_medals,
      bronze: g.bronze_medals,
      isSummer: g.isSummer,
      isParalympic: g.isParalympic,
    })),
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function main() {
  const out = { fetchedAt: new Date().toISOString(), source: URLS[0].url, categories: [] };

  for (const { url } of URLS) {
    console.log(`fetching ${url} ...`);
    const html = await fetchHtml(url);
    const ctx = extractVikeJSON(html);
    const tables = extractMedalsTables(ctx);
    console.log(`  found ${tables.length} medals_table blocks`);
    for (const t of tables) {
      const proj = projectTable(t);
      console.log(`    - ${proj.title}: ${proj.sports.length} sports, ${proj.totalGames} Games total`);
      out.categories.push(proj);
    }
  }

  // sanity: confirm no athlete-name-shaped strings leaked into our output
  const json = JSON.stringify(out);
  // crude check — no field labeled name/athlete other than sport names + city + Games name
  // (we already projected to a strict whitelist above, so this is belt + braces)
  if (/("first_?name"|"last_?name"|"athlete_?name")/i.test(json)) {
    throw new Error("possible NIL leak detected in output — aborting");
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}`);
  console.log(`total categories: ${out.categories.length}`);
  console.log(`total sports across all categories: ${out.categories.reduce((s, c) => s + c.sports.length, 0)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
