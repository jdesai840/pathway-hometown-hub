import { useEffect, useMemo, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { useApp } from "../store.js";
import { STATE_TO_CLIMATE, CLIMATE_REGIONS } from "../data/climate-regions.js";

// LA28 mode = athletes whose latest competition year is >= 2014. 12-year
// window matches the reference.decay constant in the dataset — captures
// the current pipeline + recent past, drops athletes from long-gone eras.
const LA28_CUTOFF = 2014;

// Animated HTML markers via AdvancedMarkerElement. Each pin breathes with a
// CSS pulse, clusters glow and scale up on hover. Hybrid satellite map shows
// through the semi-transparent layouts.
//
// NIL-compliant: aggregate counts only.
export default function CityMarkers() {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const sportFilter = useApp((s) => s.sportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
  const mode = useApp((s) => s.mode);
  const climateOverlay = useApp((s) => s.climateOverlay);
  const selectedCityKey = useApp((s) => s.selectedCityKey);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);
  const tour = useApp((s) => s.tour);
  const tourActive = Boolean(tour);

  // Aggregate filtered hubs per city. The previous logic only hid cities
  // that didn't match — pins still showed each city's UNFILTERED total.
  // Now we sum per-hub athleteCount under the current filters so the pin
  // shows the actual count matching what the user selected.
  const visibleCities = useMemo(() => {
    if (!cityHubsDoc) return [];
    const sportLower = sportFilter ? sportFilter.toLowerCase() : null;
    const useRecency = mode === "recency";
    const noFilters = !sportLower && !categoryFilter && !useRecency;

    // Fast path: no filters at all → use the precomputed city totals.
    if (noFilters) {
      return cityHubsDoc.cities.map((c) => ({
        ...c,
        _count: c.athleteCount,
        _oly: c.olympicAthletes,
        _para: c.paralympicAthletes,
      }));
    }

    // Slow path: walk hubs, apply filters, aggregate by city.
    const byCity = new Map();
    for (const h of cityHubsDoc.hubs) {
      if (sportLower && !h.sport.toLowerCase().includes(sportLower)) continue;
      if (categoryFilter && h.category !== categoryFilter) continue;
      if (useRecency && (h.latestYear ?? 0) < LA28_CUTOFF) continue;
      const key = `${h.state}|${h.cityKey}`;
      const cur = byCity.get(key) || { olympic: 0, paralympic: 0, total: 0 };
      if (h.category === "Olympic") cur.olympic += h.athleteCount;
      else cur.paralympic += h.athleteCount;
      cur.total += h.athleteCount;
      byCity.set(key, cur);
    }
    return cityHubsDoc.cities
      .filter((c) => byCity.has(`${c.state}|${c.cityKey}`))
      .map((c) => {
        const counts = byCity.get(`${c.state}|${c.cityKey}`);
        return {
          ...c,
          _count: counts.total,
          _oly: counts.olympic,
          _para: counts.paralympic,
        };
      });
  }, [cityHubsDoc, sportFilter, categoryFilter, mode]);

  const max = useMemo(
    () => Math.max(1, ...visibleCities.map((c) => c._count)),
    [visibleCities]
  );

  const markersRef = useRef([]);
  const clustererRef = useRef(null);

  useEffect(() => {
    if (!map || !markerLib) return;

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current = [];

    const markers = [];
    for (const c of visibleCities) {
      const intensity = c._count / max;
      const norm = Math.pow(intensity, 0.4);
      const filteredTotal = c._oly + c._para;
      const paraRatio = filteredTotal > 0 ? c._para / filteredTotal : 0;
      const fillColor = climateOverlay
        ? climateColorForState(c.state)
        : blend("#3b82f6", "#f59e0b", paraRatio);
      const key = `${c.state}|${c.cityKey}`;
      const isSelected = key === selectedCityKey;

      const el = buildPinElement({
        count: c._count,
        color: fillColor,
        intensity: norm,
        selected: isSelected,
      });

      const marker = new markerLib.AdvancedMarkerElement({
        map: null, // clusterer manages map attachment
        position: { lat: c.lat, lng: c.lng },
        title: `${c.city}, ${c.state} — ${c._count} Team USA athletes`,
        content: el,
        zIndex: Math.floor(c._count),
      });
      marker.addListener("click", () => setSelectedCityKey(key));
      marker.cityKey = key; // for cluster lookup
      markers.push(marker);
    }
    markersRef.current = markers;

    // Cluster — animated, pulsing, hover-scaling
    clustererRef.current = new MarkerClusterer({
      map,
      markers,
      algorithm: new SuperClusterAlgorithm({
        radius: 80,
        maxZoom: 9,
        minPoints: 3,
      }),
      renderer: {
        render: ({ count, position, markers: clusterMarkers }) => {
          let totalAth = 0;
          for (const m of clusterMarkers) {
            const t = m.title || "";
            const m2 = t.match(/—\s*(\d+)/);
            if (m2) totalAth += Number(m2[1]);
          }
          const el = buildClusterElement(totalAth);
          const cluster = new markerLib.AdvancedMarkerElement({
            position,
            content: el,
            zIndex: 1000 + count,
            title: `${totalAth} athletes here — click to zoom in`,
          });
          // Click cluster: zoom in. Inert during a tour — the tour owns the camera.
          cluster.addListener("click", () => {
            if (useApp.getState().tour) return;
            const z = map.getZoom() ?? 4;
            map.setZoom(Math.min(z + 2, 14));
            map.panTo(position);
          });
          return cluster;
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
  }, [map, markerLib, visibleCities, max, climateOverlay, selectedCityKey, setSelectedCityKey]);

  // Pan + zoom to selected city. Disabled while a tour is active — the tour
  // owns the camera and we don't want a stale selectedCityKey panning the
  // map out from under it.
  useEffect(() => {
    if (!map || !cityHubsDoc || !selectedCityKey) return;
    if (tourActive) return;
    const c = cityHubsDoc.cities.find((x) => `${x.state}|${x.cityKey}` === selectedCityKey);
    if (!c) return;
    map.panTo({ lat: c.lat, lng: c.lng });
    if ((map.getZoom() ?? 0) < 8) map.setZoom(8);
  }, [map, cityHubsDoc, selectedCityKey, tourActive]);

  return null;
}

function climateColorForState(state) {
  const id = STATE_TO_CLIMATE[state] || "noncontig";
  return CLIMATE_REGIONS[id]?.color || "#94a3b8";
}

// Build an HTML element for a city pin. Pulsing ring, count chip, scales on hover.
function buildPinElement({ count, color, intensity, selected }) {
  const size = Math.round(22 + intensity * 28); // 22–50 px
  const fontSize = count >= 100 ? 11 : count >= 10 ? 12 : 13;
  const wrap = document.createElement("div");
  wrap.className = "hh-pin" + (selected ? " hh-pin-selected" : "");
  wrap.style.setProperty("--hh-color", color);
  wrap.style.setProperty("--hh-size", `${size}px`);
  wrap.innerHTML = `
    <span class="hh-pin-pulse" aria-hidden="true"></span>
    <span class="hh-pin-dot">
      <span class="hh-pin-count" style="font-size:${fontSize}px">${count}</span>
    </span>
  `;
  return wrap;
}

// Build an HTML element for a cluster bubble. JUST the count — no "X cities" line.
function buildClusterElement(totalAthletes) {
  const size = Math.min(76, Math.round(34 + Math.sqrt(totalAthletes) * 1.5));
  const fontSize = totalAthletes >= 1000 ? 14 : totalAthletes >= 100 ? 16 : 18;
  const el = document.createElement("div");
  el.className = "hh-cluster";
  el.style.setProperty("--hh-cluster-size", `${size}px`);
  el.innerHTML = `
    <span class="hh-cluster-pulse" aria-hidden="true"></span>
    <span class="hh-cluster-glow" aria-hidden="true"></span>
    <span class="hh-cluster-text" style="font-size:${fontSize}px">${totalAthletes}</span>
  `;
  return el;
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
