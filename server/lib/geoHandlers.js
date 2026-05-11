import { loadAthleteIndex } from "./athleteIndex.js";
import { queryAthletes } from "./athleteQueries.js";
import {
  filterBySport,
  filterByState,
  topHubs,
  topHubsForSport,
  compareStates,
  surfaceUnderexposedHub,
} from "./hubQueries.js";

// Shared tool-handler factory used by both /api/geo-query and /api/voice-query.
// Keeping a single source means we can never again ship a new tool that one
// route advertises (via geoTools) but doesn't know how to execute.
export async function buildGeoToolHandlers(hubsDoc) {
  const athleteIdx = await loadAthleteIndex();
  return {
    filter_by_sport: (args) => filterBySport(hubsDoc.hubs, args || {}),
    filter_by_state: (args) => filterByState(hubsDoc.hubs, args || {}),
    top_hubs: (args) => topHubs(hubsDoc.hubs, args || {}),
    top_hubs_for_sport: (args) => topHubsForSport(hubsDoc.hubs, args || {}),
    compare_states: (args) => compareStates(hubsDoc.hubs, hubsDoc.stateTotals, args || {}),
    surface_underexposed_hub: (args) =>
      surfaceUnderexposedHub(hubsDoc.hubs, hubsDoc.stateTotals, args || {}),
    query_athletes: (args) => queryAthletes(athleteIdx.records, args || {}),
  };
}
