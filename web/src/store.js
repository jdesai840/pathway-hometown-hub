import { create } from "zustand";

// Single source of truth shared between 2D UI, the spatial scene, and the voice agent.
export const useApp = create((set) => ({
  step: "intro", // intro | explore
  hubsDoc: null, // /api/hubs response
  sportCatalog: null, // /api/sport-catalog response

  // Current map state
  mode: "recency", // "recency" | "all_time"
  sportFilter: null, // string or null
  categoryFilter: null, // "Olympic" | "Paralympic" | null
  highlightedStates: [], // 2-letter codes the agent told us to spotlight
  selectedState: null, // 2-letter code the user clicked on
  intent: null, // last agent intent string ("filter_by_sport", etc.)
  agentNarration: null,
  agentFacts: [],
  agentTranscript: null,

  inXR: false,

  setStep: (step) => set({ step }),
  setHubsDoc: (hubsDoc) => set({ hubsDoc }),
  setSportCatalog: (sportCatalog) => set({ sportCatalog }),
  setMode: (mode) => set({ mode }),
  setSportFilter: (sportFilter) => set({ sportFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSelectedState: (selectedState) => set({ selectedState }),
  applyAgentResponse: (resp) =>
    set({
      highlightedStates: resp?.highlights || [],
      intent: resp?.intent || null,
      agentNarration: resp?.narration || null,
      agentFacts: resp?.facts || [],
      agentTranscript: resp?.transcript || null,
    }),
  setInXR: (inXR) => set({ inXR }),
}));

// Aggregate hubs to state-level intensity for the choropleth, given current filters.
export function computeStateIntensity(hubsDoc, { mode, sportFilter, categoryFilter }) {
  if (!hubsDoc) return new Map();
  const intensity = new Map();
  const matches = (h) => {
    if (sportFilter && !h.sport.toLowerCase().includes(sportFilter.toLowerCase())) return false;
    if (categoryFilter && h.category !== categoryFilter) return false;
    return true;
  };
  for (const h of hubsDoc.hubs) {
    if (!matches(h)) continue;
    const key = mode === "all_time" ? "athleteCount" : "recencyWeight";
    intensity.set(h.state, (intensity.get(h.state) || 0) + h[key]);
  }
  return intensity;
}

// Get every hub for one state, optionally filtered.
export function hubsForState(hubsDoc, state, { sportFilter, categoryFilter } = {}) {
  if (!hubsDoc) return [];
  return hubsDoc.hubs
    .filter((h) => h.state === state)
    .filter((h) => !sportFilter || h.sport.toLowerCase().includes(sportFilter.toLowerCase()))
    .filter((h) => !categoryFilter || h.category === categoryFilter);
}
