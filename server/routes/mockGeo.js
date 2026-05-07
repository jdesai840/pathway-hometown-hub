// Local-dev mock for /api/geo-query and /api/voice-query when GCP_PROJECT is unset.
// Uses simple keyword matching to pick a plausible filter and stub a narration.

import {
  filterBySport,
  filterByState,
  topHubs,
  surfaceUnderexposedHub,
} from "../lib/hubQueries.js";

const SPORT_KEYWORDS = [
  ["curling"],
  ["ice hockey", "hockey"],
  ["track and field", "track", "athletics"],
  ["swimming", "swim"],
  ["volleyball"],
  ["wrestling"],
  ["wheelchair basketball"],
  ["sled hockey"],
  ["snowboarding", "snowboard"],
  ["alpine skiing", "skiing"],
  ["para track and field", "para track"],
  ["para swimming"],
];

const STATE_NAMES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "washington dc": "DC",
};

export function mockGeoQuery(hubsDoc, question) {
  const q = question.toLowerCase();

  // Surprise / underexposed (stem 'surpris' covers surprise/surprising/surprised)
  if (q.includes("surpris") || q.includes("least expect") || q.includes("hidden") || q.includes("punch above")) {
    const hubs = surfaceUnderexposedHub(hubsDoc.hubs, hubsDoc.stateTotals);
    const states = [...new Set(hubs.map((h) => h.state))].slice(0, 6);
    return {
      intent: "surface_underexposed_hub",
      highlights: states,
      narration:
        "Some of the most striking momentum could be hiding outside the obvious states. " +
        "Look at how these smaller hubs punch above their weight heading into LA28 — equally for Olympic and Paralympic disciplines.",
      facts: hubs.map((h) => `${h.state} ${h.sport}: ${h.athleteCount} athletes (${h.earliestYear}–${h.latestYear})`),
    };
  }

  // Sport keyword
  for (const keys of SPORT_KEYWORDS) {
    if (keys.some((k) => q.includes(k))) {
      const hubs = filterBySport(hubsDoc.hubs, { sport: keys[0], limit: 6 });
      const states = [...new Set(hubs.map((h) => h.state))].slice(0, 6);
      return {
        intent: "filter_by_sport",
        highlights: states,
        narration:
          `${capitalize(keys[0])} momentum could be concentrated where the conditions, culture, and pipelines align. ` +
          `These states are leading into LA28 — Olympic and Paralympic disciplines weighed equally.`,
        facts: hubs.map((h) => `${h.state} ${h.sport}: ${h.athleteCount} athletes`),
      };
    }
  }

  // State keyword (full name or 2-letter)
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (q.includes(name)) {
      const hubs = filterByState(hubsDoc.hubs, { state: code, limit: 8 });
      return {
        intent: "filter_by_state",
        highlights: [code],
        narration:
          `${capitalize(name)} could be a layered hub for Team USA — historic depth in some sports, ` +
          `momentum in others, and Paralympic representation given equal visibility here.`,
        facts: hubs.map((h) => `${h.sport} (${h.category}): ${h.athleteCount} athletes`),
      };
    }
  }
  // 2-letter codes — only when the input is short and looks like a direct state mention.
  // Blacklist common English words that are also state codes (ME, OR, IN, OH, HI, OK, AL).
  const STATE_CODE_BLACKLIST = new Set(["ME", "OR", "IN", "OH", "HI", "OK", "AL", "DE", "ID"]);
  const tokens = question.toUpperCase().split(/\s+/);
  if (tokens.length <= 4) {
    for (const tok of tokens) {
      if (Object.values(STATE_NAMES).includes(tok) && !STATE_CODE_BLACKLIST.has(tok)) {
        const hubs = filterByState(hubsDoc.hubs, { state: tok, limit: 8 });
        return {
          intent: "filter_by_state",
          highlights: [tok],
          narration:
            `${tok} appears as a layered hub — historic depth in some sports, recent momentum in others, ` +
            `with Olympic and Paralympic activity given equal visibility.`,
          facts: hubs.map((h) => `${h.sport} (${h.category}): ${h.athleteCount} athletes`),
        };
      }
    }
  }

  // Fallback — top hubs overall
  const hubs = topHubs(hubsDoc.hubs, { limit: 8 });
  const states = [...new Set(hubs.map((h) => h.state))].slice(0, 6);
  return {
    intent: "top_hubs",
    highlights: states,
    narration:
      "These hubs may carry the strongest momentum into LA28 — Olympic and Paralympic disciplines together. " +
      "Try asking about a specific sport, state, or 'show me a surprising hub.'",
    facts: hubs.map((h) => `${h.state} ${h.sport}: ${h.athleteCount} athletes`),
  };
}

function capitalize(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
