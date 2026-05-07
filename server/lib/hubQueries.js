// Pure JS query helpers over the hubs dataset. These are exposed to Gemini as
// callable tools (function calling). Gemini decides which to invoke based on
// the user's question, calls them, then synthesizes a narration over the result.

const NORM = (s) => (s || "").toString().trim().toLowerCase();

// Normalize "track and field" / "Para Track and Field" / "track & field" so user
// phrasing matches dataset names without forcing exact match.
function sportMatches(hubSport, query) {
  const a = NORM(hubSport).replace(/\s*&\s*/g, " and ");
  const b = NORM(query).replace(/\s*&\s*/g, " and ").replace(/^para[\s-]+/i, "");
  return a.includes(b) || b.includes(a.replace(/^para\s+/, ""));
}

export function filterBySport(hubs, { sport, category, season, mode = "recency", limit = 12 }) {
  let out = hubs.filter((h) => sportMatches(h.sport, sport));
  if (category) out = out.filter((h) => NORM(h.category) === NORM(category));
  if (season) out = out.filter((h) => NORM(h.season) === NORM(season));
  out.sort((a, b) =>
    mode === "all_time" ? b.athleteCount - a.athleteCount : b.recencyWeight - a.recencyWeight
  );
  return out.slice(0, limit);
}

export function filterByState(hubs, { state, mode = "recency", limit = 20 }) {
  const out = hubs.filter((h) => NORM(h.state) === NORM(state));
  out.sort((a, b) =>
    mode === "all_time" ? b.athleteCount - a.athleteCount : b.recencyWeight - a.recencyWeight
  );
  return out.slice(0, limit);
}

export function topHubsForSport(hubs, args) {
  // Same as filterBySport but always limited to top hub per state to avoid showing
  // CA Track + CA Diving together when the user asked "top track states."
  const filtered = filterBySport(hubs, { ...args, limit: 200 });
  return filtered.slice(0, args.limit || 8);
}

export function topHubs(hubs, { mode = "recency", category, limit = 12 }) {
  let out = hubs;
  if (category) out = out.filter((h) => NORM(h.category) === NORM(category));
  out = [...out].sort((a, b) =>
    mode === "all_time" ? b.athleteCount - a.athleteCount : b.recencyWeight - a.recencyWeight
  );
  return out.slice(0, limit);
}

export function compareStates(hubs, stateTotals, { stateA, stateB }) {
  const a = stateTotals[stateA?.toUpperCase()];
  const b = stateTotals[stateB?.toUpperCase()];
  const hubsA = filterByState(hubs, { state: stateA, limit: 6 });
  const hubsB = filterByState(hubs, { state: stateB, limit: 6 });
  return {
    [stateA?.toUpperCase()]: { totals: a, topHubs: hubsA },
    [stateB?.toUpperCase()]: { totals: b, topHubs: hubsB },
  };
}

// "Punch above weight" — surface a small-state hub that's disproportionately strong.
// Score: hub.recencyWeight / stateTotals[state].recencyWeight, requiring stateAthleteCount >= 5.
export function surfaceUnderexposedHub(hubs, stateTotals, { excludeStates = [] } = {}) {
  const candidates = hubs.filter((h) => {
    const st = stateTotals[h.state];
    if (!st || st.athleteCount < 5 || st.athleteCount > 80) return false;
    if (excludeStates.includes(h.state)) return false;
    return h.recencyWeight > 0.5;
  });
  candidates.sort((a, b) => {
    const ra = a.recencyWeight / (stateTotals[a.state]?.recencyWeight || 1);
    const rb = b.recencyWeight / (stateTotals[b.state]?.recencyWeight || 1);
    return rb - ra;
  });
  return candidates.slice(0, 5);
}
