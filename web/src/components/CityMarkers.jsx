import { useEffect, useMemo, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useApp } from "../store.js";

// City pins on the Google Maps 2D basemap.
// We use the legacy `google.maps.Marker` (still fully supported) with SVG
// data-URL icons so we keep our custom dark map style — switching to
// AdvancedMarkers would require a cloud-styled Map ID that overrides our
// inline styles[]. NIL-compliant: aggregate counts only.
export default function CityMarkers() {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");

  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const sportFilter = useApp((s) => s.sportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
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

  // (Re)render markers whenever the visible set or selection changes
  useEffect(() => {
    if (!map || !markerLib || !coreLib) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    for (const c of visibleCities) {
      const intensity = c.athleteCount / max;
      const norm = Math.pow(intensity, 0.4);
      const radius = Math.round(8 + norm * 14); // 8–22 px
      const total = c.olympicAthletes + c.paralympicAthletes;
      const paraRatio = total > 0 ? c.paralympicAthletes / total : 0;
      const color = blend("#3b82f6", "#f59e0b", paraRatio);
      const key = `${c.state}|${c.cityKey}`;
      const isSelected = key === selectedCityKey;
      const fontSize = c.athleteCount >= 100 ? 11 : c.athleteCount >= 10 ? 12 : 13;

      const svg = buildPinSvg({
        radius,
        color,
        countText: String(c.athleteCount),
        fontSize,
        ringStroke: isSelected ? "#ffffff" : "#0b1220",
        ringWidth: isSelected ? 3 : 2,
      });

      const marker = new markerLib.Marker({
        map,
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
      markersRef.current.push(marker);
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, markerLib, coreLib, visibleCities, max, selectedCityKey, setSelectedCityKey]);

  // Pan to + zoom in on the selected city
  useEffect(() => {
    if (!map || !cityHubsDoc || !selectedCityKey) return;
    const c = cityHubsDoc.cities.find((x) => `${x.state}|${x.cityKey}` === selectedCityKey);
    if (!c) return;
    map.panTo({ lat: c.lat, lng: c.lng });
    if ((map.getZoom() ?? 0) < 7) map.setZoom(7);
  }, [map, cityHubsDoc, selectedCityKey]);

  return null;
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
  <circle cx="${cx}" cy="${cy}" r="${radius + 2}" fill="${color}" opacity="0.35" filter="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="${ringStroke}" stroke-width="${ringWidth}"/>
  <text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-family="ui-sans-serif, system-ui, Inter, sans-serif" font-size="${fontSize}" font-weight="700" fill="#0b1220">${countText}</text>
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
