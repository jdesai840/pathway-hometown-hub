// NOAA NCEI US Climate Regions (9 regions covering the lower 48).
// Source: https://www.ncei.noaa.gov/access/monitoring/reference-maps/us-climate-regions
// Public-domain US federal data — allowed under hackathon "public weather data" rule.

export const CLIMATE_REGIONS = {
  northeast: {
    id: "northeast",
    name: "Northeast",
    color: "#60a5fa", // sky blue — cool, maritime
    description:
      "Cold winters, mild humid summers. Strong tradition in winter sports, ice hockey, and indoor disciplines.",
  },
  upper_midwest: {
    id: "upper_midwest",
    name: "Upper Midwest",
    color: "#a78bfa", // violet — continental cold
    description:
      "Long, harsh winters and short summers. Ice hockey, curling, speed skating, Nordic skiing belt.",
  },
  ohio_valley: {
    id: "ohio_valley",
    name: "Ohio Valley",
    color: "#34d399", // emerald — temperate humid
    description:
      "Humid continental → humid subtropical. Broad sport mix; strong basketball, track and field, wrestling pipelines.",
  },
  southeast: {
    id: "southeast",
    name: "Southeast",
    color: "#fbbf24", // amber — warm humid
    description:
      "Hot, humid summers; mild winters. Year-round outdoor training; track and field, swimming, gymnastics powerhouses.",
  },
  south: {
    id: "south",
    name: "South",
    color: "#f97316", // orange — hot
    description:
      "Hot summers, mild winters. Football culture overlap; strong track and field, boxing, wrestling.",
  },
  northern_rockies_plains: {
    id: "northern_rockies_plains",
    name: "Northern Rockies and Plains",
    color: "#f87171", // soft red — extreme/dry
    description:
      "Continental climate with cold winters and high elevation. Skiing, snowboarding, biathlon, rodeo.",
  },
  northwest: {
    id: "northwest",
    name: "Northwest",
    color: "#22d3ee", // cyan — wet temperate
    description:
      "Mild, wet, long outdoor seasons. Rowing, sailing, water polo, distance running, snowboarding.",
  },
  southwest: {
    id: "southwest",
    name: "Southwest",
    color: "#fb7185", // rose — arid/elevated
    description:
      "Arid with high elevation. Olympic Training Center sits here (Colorado Springs). Mountain sports + altitude training hub.",
  },
  west: {
    id: "west",
    name: "West",
    color: "#a3e635", // lime — Mediterranean/diverse
    description:
      "Mediterranean coastal + arid interior. Year-round training; surfing, water polo, beach volleyball, athletics.",
  },
  noncontig: {
    id: "noncontig",
    name: "Non-Contiguous",
    color: "#94a3b8", // slate — placeholder for AK, HI, VI
    description:
      "Alaska, Hawaii, and US territories — distinct climate stories outside the NOAA 9-region framework.",
  },
};

export const STATE_TO_CLIMATE = {
  CT: "northeast", DE: "northeast", ME: "northeast", MD: "northeast",
  MA: "northeast", NH: "northeast", NJ: "northeast", NY: "northeast",
  PA: "northeast", RI: "northeast", VT: "northeast", DC: "northeast",

  IA: "upper_midwest", MI: "upper_midwest", MN: "upper_midwest", WI: "upper_midwest",

  IL: "ohio_valley", IN: "ohio_valley", KY: "ohio_valley", MO: "ohio_valley",
  OH: "ohio_valley", TN: "ohio_valley", WV: "ohio_valley",

  AL: "southeast", FL: "southeast", GA: "southeast", NC: "southeast",
  SC: "southeast", VA: "southeast",

  AR: "south", KS: "south", LA: "south", MS: "south",
  OK: "south", TX: "south",

  MT: "northern_rockies_plains", NE: "northern_rockies_plains",
  ND: "northern_rockies_plains", SD: "northern_rockies_plains",
  WY: "northern_rockies_plains",

  ID: "northwest", OR: "northwest", WA: "northwest",

  AZ: "southwest", CO: "southwest", NM: "southwest", UT: "southwest",

  CA: "west", NV: "west",

  AK: "noncontig", HI: "noncontig", VI: "noncontig", PR: "noncontig",
};

export function getClimateForState(stateCode) {
  return CLIMATE_REGIONS[STATE_TO_CLIMATE[stateCode] || "noncontig"];
}
