// Distill per-sport athlete groups into archetype-ready profiles using Gemini
// via Vertex AI. This is the FIRST AI step in the pipeline — every preceding
// step is plain HTTP + JSON projection.
//
// Compliance:
// - Generative AI: Gemini via Vertex AI ONLY. No other GenAI tools touch this data.
// - Input: sports.grouped.json (sport-level aggregates, no NIL)
// - Output: sport-profiles.json (Gemini-distilled biometric/geographic/era profiles)
//
// Usage:
//   GCP_PROJECT=your-project GCP_LOCATION=us-central1 npm run distill

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VertexAI } from "@google-cloud/vertexai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, "data", "sports.grouped.json");
const OUT = join(ROOT, "data", "sport-profiles.json");

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

if (!PROJECT) {
  console.error("GCP_PROJECT env var required");
  process.exit(1);
}

const SYSTEM_PROMPT = `
You are a sports-science analyst producing structured per-sport profiles for Team USA.

For each sport+category group provided, distill the raw aggregates into a profile with:
- athleteCharacterization (1-2 sentence sports-science description of the typical body and skill profile)
- biometricProfile {meanHeightCm, heightSpread (one of: narrow|moderate|wide), armSpanToHeight (number 0.95-1.10), legToHeight (number 0.45-0.55), torsoToHeight (number 0.25-0.35)}
   - Use heightStats when available; otherwise infer from sport norms.
- regionalSignal (1-sentence summary of any geographic concentration suggested by topHometownStates)
- eraSignal (1 sentence about historical longevity and modern presence based on year buckets)

HARD RULES:
- Use sport names exactly as provided. Strip "PARA - " prefix when displaying but keep category=Paralympic.
- Olympic and Paralympic groups get equal analytical depth.
- Conditional language ("could", "may"). No guarantees about outcomes.
- Never reference individual athletes.
- Never use "former" or "past" Olympian/Paralympian.
- No timing data references.

Return STRICT JSON: {profiles: [{sport, category, athleteCount, athleteCharacterization, biometricProfile, regionalSignal, eraSignal}]}.
Process EVERY group in the input. Return one profile per input group.
`.trim();

async function main() {
  const grouped = JSON.parse(await readFile(IN, "utf8"));
  const groups = grouped.groups;
  console.log(`distilling ${groups.length} sport+category groups via Gemini...`);

  const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  const model = vertex.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 65536, // generous; structured per-sport profiles
    },
  });

  // Send all groups in one long-context call for cross-sport consistency
  // (Olympic and Paralympic profiles judged together = better parity).
  const userText = JSON.stringify({ groups }, null, 2);
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
  });
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty response from Gemini");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("response was not JSON:");
    console.error(text);
    throw err;
  }

  const profiles = parsed.profiles || [];
  if (profiles.length === 0) throw new Error("no profiles returned");

  // sanity: NIL guard, terminology guard
  const json = JSON.stringify(profiles);
  if (/("first_?name"|"last_?name"|"athlete_?name"|"former Olympian"|"former Paralympian"|"past Olympian"|"past Paralympian")/i.test(json)) {
    throw new Error("compliance check failed — possible NIL or prohibited terminology in output");
  }

  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), profiles }, null, 2));
  console.log(`wrote ${profiles.length} sport profiles to ${OUT}`);
  console.log(`  Olympic: ${profiles.filter((p) => p.category === "Olympic").length}`);
  console.log(`  Paralympic: ${profiles.filter((p) => p.category === "Paralympic").length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
