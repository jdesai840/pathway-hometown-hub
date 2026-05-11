import { Storage } from "@google-cloud/storage";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BUCKET = process.env.GCS_BUCKET;
const OBJECT = process.env.GCS_ATHLETES_OBJECT || "athletes.raw.json";
const LOCAL_FALLBACK = process.env.LOCAL_ATHLETES;

let cachedSet = null;
let cachedRegex = null;
let cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

// Defense-in-depth NIL guard. The agent's training data knows famous Team USA
// athletes; the system prompts forbid naming individuals; this redactor is
// the final, deterministic layer. Every "first last" string from the scraped
// teamusa.com dataset becomes a regex alternative — any whole-name match in
// model-generated narration is replaced with "[an athlete]" before the
// response leaves the server.
async function ensureRegex() {
  if (cachedRegex && Date.now() - cacheAt < TTL_MS) return cachedRegex;
  const raw = await loadRaw();
  const set = new Set();
  for (const a of raw.athletes || []) {
    const f = (a.first_name || "").trim().toLowerCase();
    const l = (a.last_name || "").trim().toLowerCase();
    if (!f || !l) continue;
    if (f.length < 2 || l.length < 2) continue;
    set.add(`${f} ${l}`);
  }
  cachedSet = set;
  cachedRegex = buildRegex(set);
  cacheAt = Date.now();
  return cachedRegex;
}

function buildRegex(set) {
  if (set.size === 0) return null;
  const escaped = [...set].map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
}

export async function redactNames(text) {
  if (typeof text !== "string" || !text) return text;
  const re = await ensureRegex();
  if (!re) return text;
  return text.replace(re, "[an athlete]");
}

export async function redactNamesArr(arr) {
  if (!Array.isArray(arr)) return arr;
  return Promise.all(arr.map((s) => redactNames(s)));
}

// Tiny diagnostic for tests/logging.
export async function nilGuardStats() {
  await ensureRegex();
  return { nameCount: cachedSet?.size ?? 0 };
}

async function loadRaw() {
  if (!BUCKET || LOCAL_FALLBACK) {
    const here = dirname(fileURLToPath(import.meta.url));
    const p =
      LOCAL_FALLBACK || join(here, "..", "..", "data", "athletes.raw.json");
    return JSON.parse(await readFile(p, "utf8"));
  }
  const storage = new Storage();
  const [buf] = await storage.bucket(BUCKET).file(OBJECT).download();
  return JSON.parse(buf.toString());
}
