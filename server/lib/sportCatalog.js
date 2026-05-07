import { Storage } from "@google-cloud/storage";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BUCKET = process.env.GCS_BUCKET;
const OBJECT = process.env.GCS_CATALOG_OBJECT || "sport-catalog.json";
const LOCAL_FALLBACK = process.env.LOCAL_SPORT_CATALOG;

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5 * 60 * 1000;

export async function loadSportCatalog() {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

  if (!BUCKET || LOCAL_FALLBACK) {
    const here = dirname(fileURLToPath(import.meta.url));
    const path = LOCAL_FALLBACK || join(here, "..", "..", "data", "sport-catalog.json");
    const buf = await readFile(path, "utf8");
    cache = JSON.parse(buf);
    cacheTime = Date.now();
    return cache;
  }

  const storage = new Storage();
  const [buf] = await storage.bucket(BUCKET).file(OBJECT).download();
  cache = JSON.parse(buf.toString());
  cacheTime = Date.now();
  return cache;
}
