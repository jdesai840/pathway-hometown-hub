// Cluster Team USA sports into archetypes using Gemini via Vertex AI.
//
// Compliance:
// - All Team USA data processing here goes through Gemini on Vertex AI (the only
//   GenAI tool permitted by hackathon rules for this purpose). No external LLMs.
// - Input is sport-level aggregates only. No athlete names or NIL.
// - Output is archetype-level only — never references individual athletes.
// - Olympic and Paralympic categories must each receive 5 archetypes (equal coverage).
//
// Usage:
//   GCP_PROJECT=your-project GCP_LOCATION=us-central1 npm run cluster
//
// Output: data/archetypes.json (the production dataset uploaded to GCS).

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VertexAI } from "@google-cloud/vertexai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, "data", "sport-profiles.json");
const OUT = join(ROOT, "data", "archetypes.json");

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

if (!PROJECT) {
  console.error("GCP_PROJECT env var is required");
  process.exit(1);
}

const SYSTEM_PROMPT = [
  "You are a sports-science taxonomist clustering Team USA sports into ARCHETYPES.",
  "An archetype groups sports that share a dominant physical/cognitive profile so a fan",
  "can find which Team USA sports their body type and preferences could align with.",
  "",
  "HARD RULES (failure to follow these is disqualifying):",
  "1. Output exactly 5 Olympic archetypes AND exactly 5 Paralympic archetypes — equal depth.",
  "2. Olympic and Paralympic archetypes must be defined with the SAME analytical rigor.",
  '3. Use sport names exactly as provided. Never use NGB names. Strip the "PARA - " prefix from Paralympic sport names when displaying, but keep category=Paralympic.',
  "4. Never reference individual athletes — archetype level only.",
  "5. Use conditional language in summaries ('could', 'may'). No guarantees.",
  "6. No timing data references.",
  '7. Never use "former" or "past" Olympian/Paralympian.',
  "",
  "For each archetype produce:",
  "- id (slug, prefix oly- or para-)",
  "- category (Olympic | Paralympic)",
  "- name (evocative archetype name, no athlete names)",
  "- summary (2 sentences, conditional language)",
  "- traits (4-7 short trait tags)",
  "- exemplarSports (3-6 sport names from the catalog that best fit)",
  "- biometricProfile {armSpanToHeight, legToHeight, torsoToHeight} as approximate ratios (numbers).",
  "  Use sports-science conventions; these are PROXIES used to score user matches.",
  "",
  "Return STRICT JSON: {olympic: [...5], paralympic: [...5]}",
].join("\n");

function buildUserMessage(profilesDoc) {
  const profiles = profilesDoc.profiles || [];
  const olympic = profiles.filter((p) => p.category === "Olympic");
  const paralympic = profiles.filter((p) => p.category === "Paralympic");
  return [
    "OLYMPIC sport profiles (Gemini-distilled):",
    JSON.stringify(olympic, null, 2),
    "",
    "PARALYMPIC sport profiles (Gemini-distilled):",
    JSON.stringify(paralympic, null, 2),
    "",
    "Cluster the OLYMPIC sports into exactly 5 archetypes, and the PARALYMPIC sports into exactly 5 archetypes.",
    "Apply identical analytical depth to both. Use the biometricProfile from sport profiles to set",
    "each archetype's biometricProfile (averaged across exemplar sports).",
    "Return JSON only.",
  ].join("\n");
}

async function main() {
  const aggregates = JSON.parse(await readFile(IN, "utf8"));
  console.log(`loaded ${aggregates.categories.length} categories`);

  const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  const model = vertex.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  console.log(`calling Gemini ${MODEL} via Vertex AI in ${LOCATION}...`);
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: buildUserMessage(aggregates) }] }],
  });

  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty response from Gemini");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("response was not valid JSON:");
    console.error(text);
    throw err;
  }

  const olympic = parsed.olympic || [];
  const paralympic = parsed.paralympic || [];
  if (olympic.length !== 5 || paralympic.length !== 5) {
    throw new Error(
      `parity check failed: got ${olympic.length} Olympic and ${paralympic.length} Paralympic archetypes (need 5 of each)`
    );
  }

  // Normalize to a flat array (matches the shape served by /api/archetypes)
  const flat = [...olympic, ...paralympic].map((a) => ({
    id: a.id,
    category: a.category,
    name: a.name,
    summary: a.summary,
    traits: a.traits || [],
    exemplarSports: a.exemplarSports || [],
    biometricProfile: a.biometricProfile || null,
  }));

  // Sanity check: NIL leak guard
  const json = JSON.stringify(flat);
  if (/("first_?name"|"last_?name"|"athlete_?name"|"former Olympian"|"former Paralympian")/i.test(json)) {
    throw new Error("compliance check failed — possible NIL or prohibited terminology in output");
  }

  await writeFile(OUT, JSON.stringify(flat, null, 2));
  console.log(`\nwrote ${flat.length} archetypes (${olympic.length} Olympic + ${paralympic.length} Paralympic) to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
