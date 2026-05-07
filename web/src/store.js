import { create } from "zustand";

// Single source of truth shared between 2D UI and the spatial scene.
export const useApp = create((set) => ({
  step: "intro", // intro | capture | questions | matching | results
  biometrics: null, // { heightCm, armSpanCm, reachCm }
  transcript: "",
  matches: null, // {matches: [{archetypeId, score, rationale}]}
  archetypes: null, // catalog from /api/archetypes
  inXR: false,

  setStep: (step) => set({ step }),
  setBiometrics: (biometrics) => set({ biometrics }),
  setTranscript: (transcript) => set({ transcript }),
  setMatches: (matches) => set({ matches }),
  setArchetypes: (archetypes) => set({ archetypes }),
  setInXR: (inXR) => set({ inXR }),
}));
