// Build a (state, city) -> {lat, lng} lookup from the US Census Gazetteer.
//
// Source: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
// Public domain US Census data (allowed by hackathon rules — public US
// government data, similar to the NOAA / weather data exemption).
//
// Output: data/city-coords.json with shape:
//   { "CA|los angeles": {lat, lng, name}, "MN|saint paul": {...}, ... }

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "city-coords.json");
// Census Gazetteer ships as a .zip containing one .txt; we unzip in memory.
const URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip";

// Strip LSAD type suffixes that Census appends to place names.
const SUFFIX_RE =
  /\s+(city|town|village|borough|township|CDP|municipality|consolidated government|metro government|metropolitan government|unified government|corporation|plantation|gore|reservation|comunidad|zona urbana)$/i;

function normalize(s) {
  return s
    .toLowerCase()
    .replace(SUFFIX_RE, "")
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^st\s+/, "saint ") // "St. Paul" → "saint paul"
    .replace(/^st\.\s+/, "saint ")
    .replace(/\s+(?=ft\b|fort\b)/g, " ") // hairline normalize
    .trim();
}

async function main() {
  console.log(`fetching Census Gazetteer (${URL})...`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const txtName = Object.keys(zip.files).find((n) => /\.txt$/i.test(n));
  if (!txtName) throw new Error("no .txt found in zip");
  console.log(`extracted ${txtName} from zip`);
  const text = await zip.file(txtName).async("string");
  const lines = text.split(/\r?\n/);
  // 2024 used tabs; 2025 uses '|'. Auto-detect.
  const sep = lines[0].includes("|") ? "|" : "\t";
  const header = lines[0].split(sep).map((s) => s.trim());
  const idx = {
    state: header.indexOf("USPS"),
    name: header.indexOf("NAME"),
    lat: header.indexOf("INTPTLAT"),
    lng: header.indexOf("INTPTLONG"),
  };
  if (Object.values(idx).some((i) => i === -1)) {
    throw new Error(`Gazetteer header missing fields: ${JSON.stringify(header)}`);
  }
  console.log(`parsing ${lines.length - 1} rows...`);

  const lookup = {};
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(sep);
    if (row.length < header.length) continue;
    const state = row[idx.state]?.trim();
    const name = row[idx.name]?.trim();
    const lat = parseFloat(row[idx.lat]);
    const lng = parseFloat(row[idx.lng]);
    if (!state || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const norm = normalize(name);
    const key = `${state}|${norm}`;
    // First entry wins (Gazetteer order is generally consistent)
    if (!lookup[key]) {
      lookup[key] = { lat, lng, name: name.replace(SUFFIX_RE, "") };
    }
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(lookup));
  console.log(`wrote ${Object.keys(lookup).length} (state, city) entries to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
