import { create } from "zustand";

// Single source of truth shared between 2D UI and the spatial scene.
export const useApp = create((set) => ({
  step: "intro", // intro | capture | questions | matching | results
  biometrics: null, // { heightCm, armSpanCm, reachCm }
  transcript: "",
  matches: null, // {matches: [{archetypeId, score, rationale}]}
  archetypes: null, // catalog from /api/archetypes
  sportCatalog: null, // { catalog: { "ice hockey|olympic": {sport, url, earliestYear, ...}, ... } }
  inXR: false,

  setStep: (step) => set({ step }),
  setBiometrics: (biometrics) => set({ biometrics }),
  setTranscript: (transcript) => set({ transcript }),
  setMatches: (matches) => set({ matches }),
  setArchetypes: (archetypes) => set({ archetypes }),
  setSportCatalog: (sportCatalog) => set({ sportCatalog }),
  setInXR: (inXR) => set({ inXR }),
}));

// Resolve a sport+category to its catalog entry. Robust to case variations.
export function lookupSport(sportCatalog, sport, category) {
  if (!sportCatalog?.catalog || !sport) return null;
  const key = `${sport.toLowerCase()}|${(category || "").toLowerCase()}`;
  return sportCatalog.catalog[key] || null;
}
