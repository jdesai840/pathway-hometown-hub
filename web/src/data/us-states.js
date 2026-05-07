// Approximate centroid coordinates per US state (lat, lng) for placing markers
// on the map. From Google's public placefinder data (state capitals/centroids).
// Includes DC and US Virgin Islands (VI) since both appear in the dataset.

export const STATE_INFO = {
  AL: { name: "Alabama",       lat: 32.806671, lng: -86.791130 },
  AK: { name: "Alaska",        lat: 61.370716, lng: -152.404419 },
  AZ: { name: "Arizona",       lat: 33.729759, lng: -111.431221 },
  AR: { name: "Arkansas",      lat: 34.969704, lng: -92.373123 },
  CA: { name: "California",    lat: 36.116203, lng: -119.681564 },
  CO: { name: "Colorado",      lat: 39.059811, lng: -105.311104 },
  CT: { name: "Connecticut",   lat: 41.597782, lng: -72.755371 },
  DE: { name: "Delaware",      lat: 39.318523, lng: -75.507141 },
  DC: { name: "Washington DC", lat: 38.897438, lng: -77.026817 },
  FL: { name: "Florida",       lat: 27.766279, lng: -81.686783 },
  GA: { name: "Georgia",       lat: 33.040619, lng: -83.643074 },
  HI: { name: "Hawaii",        lat: 21.094318, lng: -157.498337 },
  ID: { name: "Idaho",         lat: 44.240459, lng: -114.478828 },
  IL: { name: "Illinois",      lat: 40.349457, lng: -88.986137 },
  IN: { name: "Indiana",       lat: 39.849426, lng: -86.258278 },
  IA: { name: "Iowa",          lat: 42.011539, lng: -93.210526 },
  KS: { name: "Kansas",        lat: 38.526600, lng: -96.726486 },
  KY: { name: "Kentucky",      lat: 37.668140, lng: -84.670067 },
  LA: { name: "Louisiana",     lat: 31.169546, lng: -91.867805 },
  ME: { name: "Maine",         lat: 44.693947, lng: -69.381927 },
  MD: { name: "Maryland",      lat: 39.063946, lng: -76.802101 },
  MA: { name: "Massachusetts", lat: 42.230171, lng: -71.530106 },
  MI: { name: "Michigan",      lat: 43.326618, lng: -84.536095 },
  MN: { name: "Minnesota",     lat: 45.694454, lng: -93.900192 },
  MS: { name: "Mississippi",   lat: 32.741646, lng: -89.678696 },
  MO: { name: "Missouri",      lat: 38.456085, lng: -92.288368 },
  MT: { name: "Montana",       lat: 46.921925, lng: -110.454353 },
  NE: { name: "Nebraska",      lat: 41.125370, lng: -98.268082 },
  NV: { name: "Nevada",        lat: 38.313515, lng: -117.055374 },
  NH: { name: "New Hampshire", lat: 43.452492, lng: -71.563896 },
  NJ: { name: "New Jersey",    lat: 40.298904, lng: -74.521011 },
  NM: { name: "New Mexico",    lat: 34.840515, lng: -106.248482 },
  NY: { name: "New York",      lat: 42.165726, lng: -74.948051 },
  NC: { name: "North Carolina",lat: 35.630066, lng: -79.806419 },
  ND: { name: "North Dakota",  lat: 47.528912, lng: -99.784012 },
  OH: { name: "Ohio",          lat: 40.388783, lng: -82.764915 },
  OK: { name: "Oklahoma",      lat: 35.565342, lng: -96.928917 },
  OR: { name: "Oregon",        lat: 44.572021, lng: -122.070938 },
  PA: { name: "Pennsylvania",  lat: 40.590752, lng: -77.209755 },
  RI: { name: "Rhode Island",  lat: 41.680893, lng: -71.511780 },
  SC: { name: "South Carolina",lat: 33.856892, lng: -80.945007 },
  SD: { name: "South Dakota",  lat: 44.299782, lng: -99.438828 },
  TN: { name: "Tennessee",     lat: 35.747845, lng: -86.692345 },
  TX: { name: "Texas",         lat: 31.054487, lng: -97.563461 },
  UT: { name: "Utah",          lat: 40.150032, lng: -111.862434 },
  VT: { name: "Vermont",       lat: 44.045876, lng: -72.710686 },
  VA: { name: "Virginia",      lat: 37.769337, lng: -78.169968 },
  WA: { name: "Washington",    lat: 47.400902, lng: -121.490494 },
  WV: { name: "West Virginia", lat: 38.491226, lng: -80.954456 },
  WI: { name: "Wisconsin",     lat: 44.268543, lng: -89.616508 },
  WY: { name: "Wyoming",       lat: 42.755966, lng: -107.302490 },
  VI: { name: "U.S. Virgin Islands", lat: 18.335765, lng: -64.896335 },
};

// Convert lat/lng to a Three.js scene position assuming an equirectangular
// US-bounded plane (-125 to -65 lng, 24 to 50 lat) mapped to a 1.6 × 1.0 unit plane
// centered at origin. Good enough for a stylized choropleth.
const LNG_MIN = -130, LNG_MAX = -65;
const LAT_MIN = 22,   LAT_MAX = 51;
const PLANE_W = 1.6, PLANE_H = 1.0;

export function lngLatToPlane(lng, lat) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * PLANE_W - PLANE_W / 2;
  const z = -(((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * PLANE_H - PLANE_H / 2);
  return [x, 0, z];
}

export function statePosition(stateCode) {
  const info = STATE_INFO[stateCode];
  if (!info) return null;
  // Special-case Alaska + Hawaii + VI to render in inset rather than off-map.
  if (stateCode === "AK") return [-0.7, 0, 0.45];
  if (stateCode === "HI") return [-0.55, 0, 0.45];
  if (stateCode === "VI") return [0.6, 0, 0.45];
  return lngLatToPlane(info.lng, info.lat);
}

export const PLANE_SIZE = { w: PLANE_W, h: PLANE_H };
