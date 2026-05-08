import { useEffect, useMemo, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { useApp } from "../store.js";
import { STATE_TO_CLIMATE, CLIMATE_REGIONS } from "../data/climate-regions.js";

// City pins on the Google Maps 2D basemap, clustered for performance.
// 1801 individual markers tank pan/zoom; MarkerClusterer + SuperCluster handles
// 10k+ effortlessly and adds the bonus that nearby pins merge into a single
// numeric cluster bubble that expands on zoom.
//
// NIL-compliant: aggregate counts only.
export default function CityMarkers() {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const sportFilter = useApp((s) => s.sportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
  const climateOverlay = useApp((s) => s.climateOverlay);
  const selectedCityKey = useApp((s) => s.selectedCityKey);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);

  const filteredCityKeys = useMemo(() => {
    if (!cityHubsDoc) return null;
    if (!sportFilter && !categoryFilter) return null;
    const set = new Set();
    const sportLower = sportFilter?.toLowerCase();
    for (const h of cityHubsDoc.hubs) {
      if (sportLower && !h.sport.toLowerCase().includes(sportLower)) continue;
      if (categoryFilter && h.category !== categoryFilter) continue;
      set.add(`${h.state}|${h.cityKey}`);
    }
    return set;
  }, [cityHubsDoc, sportFilter, categoryFilter]);

  const visibleCities = useMemo(() => {
    if (!cityHubsDoc) return [];
    return filteredCityKeys
      ? cityHubsDoc.cities.filter((c) => filteredCityKeys.has(`${c.state}|${c.cityKey}`))
      : cityHubsDoc.cities;
  }, [cityHubsDoc, filteredCityKeys]);

  const max = useMemo(
    () => Math.max(1, ...visibleCities.map((c) => c.athleteCount)),
    [visibleCities]
  );

  const markersRef = useRef([]);
  const clustererRef = useRef(null);

  // Build markers + cluster on every visible-set change. Heavy work but bounded
  // by visibleCities (≤1801 worst case; usually much less when filtered).
  useEffect(() => {
    if (!map || !markerLib || !coreLib) return;

    // Tear down previous batch
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current = [];

    const markers = [];
    for (const c of visibleCities) {
      const intensity = c.athleteCount / max;
      const norm = Math.pow(intensity, 0.4);
      const radius = Math.round(8 + norm * 12); // 8–20 px
      const total = c.olympicAthletes + c.paralympicAthletes;
      const paraRatio = total > 0 ? c.paralympicAthletes / total : 0;
      const fillColor = climateOverlay
        ? climateColorForState(c.state)
        : blend("#3b82f6", "#f59e0b", paraRatio);
      const key = `${c.state}|${c.cityKey}`;
      const isSelected = key === selectedCityKey;
      const fontSize = c.athleteCount >= 100 ? 11 : c.athleteCount >= 10 ? 12 : 13;

      const svg = buildPinSvg({
        radius,
        color: fillColor,
        countText: String(c.athleteCount),
        fontSize,
        ringStroke: isSelected ? "#ffffff" : "#0b1220",
        ringWidth: isSelected ? 3 : 2,
      });

      const marker = new markerLib.Marker({
        position: { lat: c.lat, lng: c.lng },
        title: `${c.city}, ${c.state} — ${c.athleteCount} Team USA athletes`,
        icon: {
          url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          size: new coreLib.Size(radius * 2 + 6, radius * 2 + 6),
          anchor: new coreLib.Point(radius + 3, radius + 3),
          scaledSize: new coreLib.Size(radius * 2 + 6, radius * 2 + 6),
        },
        zIndex: Math.floor(c.athleteCount),
      });
      marker.addListener("click", () => setSelectedCityKey(key));
      markers.push(marker);
    }
    markersRef.current = markers;

    // Cluster — SuperCluster algorithm is fast and handles 1800+ markers well
    clustererRef.current = new MarkerClusterer({
      map,
      markers,
      algorithm: new SuperClusterAlgorithm({
        radius: 60, // pixel cluster radius
        maxZoom: 9, // stop clustering past zoom 9
        minPoints: 3,
      }),
      renderer: {
        render: ({ count, position, markers: clusterMarkers }) => {
          // Tally the actual athlete count, not just marker count
          let totalAth = 0;
          let oly = 0;
          let para = 0;
          for (const m of clusterMarkers) {
            const t = m.getTitle();
            const m2 = t.match(/—\s*(\d+)/);
            if (m2) totalAth += Number(m2[1]);
          }
          // We don't have direct para/oly per marker without re-keying — fall back to "blend"
          const size = Math.min(80, 30 + Math.sqrt(totalAth) * 1.6);
          const svg = buildClusterSvg({ size, count: totalAth, label: count });
          return new markerLib.Marker({
            position,
            icon: {
              url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
              size: new coreLib.Size(size + 6, size + 6),
              anchor: new coreLib.Point(size / 2 + 3, size / 2 + 3),
              scaledSize: new coreLib.Size(size + 6, size + 6),
            },
            zIndex: 1000 + count,
            title: `${totalAth} athletes across ${count} cities — click to zoom`,
          });
        },
      },
    });

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current = [];
    };
  }, [map, markerLib, coreLib, visibleCities, max, climateOverlay, selectedCityKey, setSelectedCityKey]);

  // Pan + zoom to selected city
  useEffect(() => {
    if (!map || !cityHubsDoc || !selectedCityKey) return;
    const c = cityHubsDoc.cities.find((x) => `${x.state}|${x.cityKey}` === selectedCityKey);
    if (!c) return;
    map.panTo({ lat: c.lat, lng: c.lng });
    if ((map.getZoom() ?? 0) < 7) map.setZoom(7);
  }, [map, cityHubsDoc, selectedCityKey]);

  return null;
}

function climateColorForState(state) {
  const id = STATE_TO_CLIMATE[state] || "noncontig";
  return CLIMATE_REGIONS[id]?.color || "#94a3b8";
}

function buildPinSvg({ radius, color, countText, fontSize, ringStroke, ringWidth }) {
  const size = radius * 2 + 6;
  const cx = size / 2;
  const cy = size / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${radius + 2}" fill="${color}" opacity="0.32" filter="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="${ringStroke}" stroke-width="${ringWidth}"/>
  <text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-family="ui-sans-serif, system-ui, Inter, sans-serif" font-size="${fontSize}" font-weight="700" fill="#0b1220">${countText}</text>
</svg>`;
}

function buildClusterSvg({ size, count, label }) {
  const r = size / 2;
  const cx = r + 3;
  const cy = r + 3;
  const fontSize = count >= 1000 ? 13 : count >= 100 ? 15 : 17;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size + 6}" height="${size + 6}" viewBox="0 0 ${size + 6} ${size + 6}">
  <defs>
    <radialGradient id="grd" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#475569" stop-opacity="0.95"/>
    </radialGradient>
    <filter id="g2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#3b82f6" opacity="0.25" filter="url(#g2)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#grd)" stroke="#0b1220" stroke-width="2"/>
  <text x="${cx}" y="${cy + 1}" text-anchor="middle" font-family="ui-sans-serif, system-ui, Inter, sans-serif" font-size="${fontSize}" font-weight="800" fill="#0b1220">${count}</text>
  <text x="${cx}" y="${cy + fontSize - 1}" text-anchor="middle" font-family="ui-sans-serif, system-ui, Inter, sans-serif" font-size="9" font-weight="600" fill="#0b1220" opacity="0.7">${label} cities</text>
</svg>`;
}

function blend(hexA, hexB, t) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function parseHex(hex) {
  const s = hex.replace("#", "");
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}
