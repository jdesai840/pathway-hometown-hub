import { create } from "zustand";

function cryptoRandom() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

// Single source of truth shared between 2D UI, the spatial scene, and the voice agent.
export const useApp = create((set) => ({
  step: "intro", // intro | choose | explore
  viewMode: "explore", // "tour" | "explore" — set by ModeChoice, controls overlay UI
  hubsDoc: null, // /api/hubs response
  cityHubsDoc: null, // /api/city-hubs response
  sportCatalog: null, // /api/sport-catalog response
  mapsApiKey: null, // /api/config — public, restricted by HTTP referrer in GCP

  // Current map state
  mode: "recency", // "recency" | "all_time"
  sportFilter: null, // string or null
  categoryFilter: null, // "Olympic" | "Paralympic" | null
  highlightedStates: [], // 2-letter codes currently emphasized on the map
  selectedState: null, // 2-letter code the user clicked on
  selectedCityKey: null, // "STATE|cityKey" for pin click
  climateOverlay: false, // when true, pins recolor by NOAA climate region
  tour: null, // { title, summary, stops: [...] }
  tourState: "idle", // idle | loading | playing | paused | done
  tourIndex: 0,
  tourCinematic: false, // when true, the photorealistic 3D city viewport is active
  audioCurrentTime: 0, // synced from <audio> element in TourController
  audioDuration: 0,    // ditto
  // Per-stop caption data emitted by Cloud TTS SSML timepointing — used by
  // LiveCaption to swap sentences exactly on each audio boundary.
  currentSentences: [],
  currentTimepoints: [], // seconds, parallel to currentSentences

  // Multi-turn chat with the geo agent.
  // Each message: {id, role: 'user'|'model', text, ts, intent?, highlights?, facts?, transcript?}
  chatMessages: [],

  // In-flight streaming response from the agent. Rendered by AgentStreamPanel
  // (top-right of Map Explorer). When done, the result is also pushed into
  // chatMessages so the history persists across closes.
  agentStream: {
    active: false,
    query: "",
    toolEvents: [], // [{name, brief, doneAt?}]
    narration: "", // accumulating from streamed tokens
    intent: null,
    highlights: [],
    facts: [],
    error: null,
    done: false,
  },

  inXR: false,

  setStep: (step) => set({ step }),
  setViewMode: (viewMode) => set({ viewMode }),
  setHubsDoc: (hubsDoc) => set({ hubsDoc }),
  setCityHubsDoc: (cityHubsDoc) => set({ cityHubsDoc }),
  setSportCatalog: (sportCatalog) => set({ sportCatalog }),
  setMapsApiKey: (mapsApiKey) => set({ mapsApiKey }),
  setMode: (mode) => set({ mode }),
  setSportFilter: (sportFilter) => set({ sportFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSelectedState: (selectedState) => set({ selectedState }),
  setSelectedCityKey: (selectedCityKey) => set({ selectedCityKey }),
  setClimateOverlay: (climateOverlay) => set({ climateOverlay }),
  setTour: (tour) =>
    set({
      tour,
      tourIndex: 0,
      tourState: tour ? "playing" : "idle",
      tourCinematic: false,
      // Clear stale city selection — CityMarkers' pan-on-selection effect
      // would otherwise fight the tour's panning logic.
      selectedCityKey: null,
      audioCurrentTime: 0,
      audioDuration: 0,
      currentSentences: [],
      currentTimepoints: [],
    }),
  setTourState: (tourState) => set({ tourState }),
  setTourIndex: (tourIndex) =>
    set({
      tourIndex,
      tourCinematic: false,
      audioCurrentTime: 0,
      audioDuration: 0,
      currentSentences: [],
      currentTimepoints: [],
    }),
  setTourCinematic: (tourCinematic) => set({ tourCinematic }),
  setAudioProgress: (audioCurrentTime, audioDuration) =>
    set({ audioCurrentTime, audioDuration }),
  setCurrentCaption: (currentSentences, currentTimepoints) =>
    set({ currentSentences, currentTimepoints }),
  endTour: () =>
    set({
      tour: null,
      tourState: "idle",
      tourIndex: 0,
      tourCinematic: false,
      audioCurrentTime: 0,
      audioDuration: 0,
      currentSentences: [],
      currentTimepoints: [],
    }),
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, { id: cryptoRandom(), ts: Date.now(), ...msg }] })),
  rehighlight: (highlights) => set({ highlightedStates: highlights || [] }),
  clearChat: () => set({ chatMessages: [], highlightedStates: [] }),
  setInXR: (inXR) => set({ inXR }),

  // ─── Streaming agent ────────────────────────────────────────────────────
  startAgentStream: (query) =>
    set(() => ({
      agentStream: {
        active: true,
        query,
        toolEvents: [],
        narration: "",
        intent: null,
        highlights: [],
        facts: [],
        error: null,
        done: false,
      },
    })),
  appendToolEvent: (ev) =>
    set((s) => ({
      agentStream: {
        ...s.agentStream,
        toolEvents: [...s.agentStream.toolEvents, ev],
      },
    })),
  appendNarrationToken: (text) =>
    set((s) => ({
      agentStream: { ...s.agentStream, narration: s.agentStream.narration + text },
    })),
  completeStream: ({ intent, highlights, facts, narration }) =>
    set((s) => {
      const finalNarration = narration ?? s.agentStream.narration;
      const finalHighlights = Array.isArray(highlights) ? highlights : [];
      const finalFacts = Array.isArray(facts) ? facts : [];
      return {
        agentStream: {
          ...s.agentStream,
          narration: finalNarration,
          intent: intent || s.agentStream.intent,
          highlights: finalHighlights,
          facts: finalFacts,
          done: true,
        },
        highlightedStates: finalHighlights,
        chatMessages: [
          ...s.chatMessages,
          {
            id: cryptoRandom(),
            ts: Date.now(),
            role: "model",
            text: finalNarration,
            intent: intent || null,
            highlights: finalHighlights,
            facts: finalFacts,
          },
        ],
      };
    }),
  closeStream: () =>
    set((s) => ({ agentStream: { ...s.agentStream, active: false } })),
  streamError: (message) =>
    set((s) => ({
      agentStream: { ...s.agentStream, error: message, done: true },
    })),
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
