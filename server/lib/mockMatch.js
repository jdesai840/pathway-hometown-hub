// Deterministic local-dev fallback when GCP_PROJECT is unset.
// Real matching uses Gemini via Vertex AI in routes/archetypeMatch.js.

import { loadArchetypes } from "./archetypes.js";

// Score an archetype against user biometric ratios. Higher score = better fit.
function scoreArchetype(archetype, ratios) {
  const profile = archetype.biometricProfile;
  if (!profile || !ratios) {
    // No profile available — score by trait-matching a hashed fingerprint instead.
    const traitCount = (archetype.traits || []).length;
    return traitCount + Math.random() * 0.01;
  }
  // Lower distance from profile = higher score.
  const dArm = Math.abs((ratios.armSpanToHeight ?? 1) - (profile.armSpanToHeight ?? 1));
  const dLeg = Math.abs((ratios.legToHeight ?? 0.5) - (profile.legToHeight ?? 0.5));
  const dTorso = Math.abs((ratios.torsoToHeight ?? 0.3) - (profile.torsoToHeight ?? 0.3));
  return -1 * (dArm + dLeg + dTorso);
}

function pickTop(archetypes, ratios) {
  return [...archetypes]
    .map((a) => ({ a, score: scoreArchetype(a, ratios) }))
    .sort((x, y) => y.score - x.score)[0];
}

export async function mockMatch({ biometrics }) {
  const all = await loadArchetypes();
  const olympic = all.filter((a) => a.category === "Olympic");
  const paralympic = all.filter((a) => a.category === "Paralympic");

  const ratios = biometrics?.ratios;
  const olyTop = pickTop(olympic, ratios);
  const paraTop = pickTop(paralympic, ratios);

  return {
    matches: [
      {
        archetypeId: olyTop.a.id,
        score: 0.85,
        rationale: `Your proportions could align with ${olyTop.a.name.toLowerCase()} traits — ${(olyTop.a.traits || []).slice(0, 2).join(", ")}.`,
      },
      {
        archetypeId: paraTop.a.id,
        score: 0.83,
        rationale: `Your proportions could also align with ${paraTop.a.name.toLowerCase()} traits — ${(paraTop.a.traits || []).slice(0, 2).join(", ")}.`,
      },
    ],
  };
}

export function mockNarrate(archetype) {
  const sports = (archetype.exemplarSports || []).slice(0, 3).join(", ");
  const traits = (archetype.traits || []).slice(0, 2).join(" and ");
  return {
    narration:
      `As ${archetype.name}, you could find a home in ${archetype.category} disciplines like ${sports}. ` +
      `${traits ? `These archetypes lean on ${traits},` : ""} and the path may reward patience as much as raw talent. ` +
      `What you bring matters: every athlete on Team USA — Olympic and Paralympic — could shape the next chapter of these sports. ` +
      `Where you take that potential is up to you.`,
  };
}
