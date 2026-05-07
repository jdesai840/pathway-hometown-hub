import { useMemo } from "react";
import { TilesRenderer, TilesPlugin, EastNorthUpFrame } from "3d-tiles-renderer/r3f";
import { GlobeControls } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { useApp, computeStateIntensity } from "../store.js";
import { STATE_INFO } from "../data/us-states.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";
const DEG2RAD = Math.PI / 180;

// Renders Google's Photorealistic 3D Tiles with state-marker bars anchored at
// each state's lat/lng on the WGS84 ellipsoid. Globe-frame coordinates throughout —
// sizes/heights are in METERS.
//
// The Maps API key is required. When unavailable (local dev with no key) callers
// should render the FlatMap fallback instead.
export default function PhotorealisticMap({ apiKey }) {
  const hubsDoc = useApp((s) => s.hubsDoc);
  const mode = useApp((s) => s.mode);
  const sportFilter = useApp((s) => s.sportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
  const highlightedStates = useApp((s) => s.highlightedStates);
  const selectedState = useApp((s) => s.selectedState);
  const setSelectedState = useApp((s) => s.setSelectedState);

  const intensities = useMemo(
    () => computeStateIntensity(hubsDoc, { mode, sportFilter, categoryFilter }),
    [hubsDoc, mode, sportFilter, categoryFilter]
  );
  const splitByState = useMemo(() => {
    const out = new Map();
    if (!hubsDoc) return out;
    for (const h of hubsDoc.hubs) {
      if (sportFilter && !h.sport.toLowerCase().includes(sportFilter.toLowerCase())) continue;
      if (categoryFilter && h.category !== categoryFilter) continue;
      const key = mode === "all_time" ? "athleteCount" : "recencyWeight";
      const e = out.get(h.state) || { Olympic: 0, Paralympic: 0 };
      e[h.category] += h[key];
      out.set(h.state, e);
    }
    return out;
  }, [hubsDoc, mode, sportFilter, categoryFilter]);

  const max = Math.max(...intensities.values(), 1);

  return (
    <TilesRenderer url={TILESET_URL}>
      {/* Auth — without this the tile server returns 401 */}
      <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken: apiKey, autoRefreshToken: true }} />
      <GlobeControls enableDamping />

      {/* State markers — positioned at each state's lat/lng on the ellipsoid.
          EastNorthUpFrame's local frame: +X east, +Y north, +Z up (away from Earth center). */}
      {hubsDoc &&
        Object.entries(STATE_INFO).map(([code, info]) => {
          // Off-continental insets don't read well on a real globe; skip for now.
          if (code === "AK" || code === "HI" || code === "VI") return null;
          const intensity = intensities.get(code) || 0;
          const norm = Math.pow(intensity / max, 0.5);
          // height in meters — visible from continental-US altitude
          const height = 30000 + norm * 250000;
          const split = splitByState.get(code) || { Olympic: 0, Paralympic: 0 };
          const total = split.Olympic + split.Paralympic;
          const paraRatio = total > 0 ? split.Paralympic / total : 0;
          const color = blendColors("#3b82f6", "#f59e0b", paraRatio);
          const isHighlighted = highlightedStates.includes(code);
          const isSelected = selectedState === code;
          return (
            <EastNorthUpFrame
              key={code}
              lat={info.lat * DEG2RAD}
              lon={info.lng * DEG2RAD}
              height={0}
            >
              <GlobeStateBar
                code={code}
                height={height}
                color={color}
                highlighted={isHighlighted}
                selected={isSelected}
                onSelect={() => setSelectedState(code)}
              />
            </EastNorthUpFrame>
          );
        })}
    </TilesRenderer>
  );
}

function GlobeStateBar({ code, height, color, highlighted, selected, onSelect }) {
  const emissiveColor = highlighted ? new THREE.Color(color).multiplyScalar(0.6) : new THREE.Color("#000000");
  const widthBase = highlighted || selected ? 32000 : 22000;
  return (
    <mesh
      position={[0, 0, height / 2]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      <boxGeometry args={[widthBase, widthBase, height]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveColor}
        emissiveIntensity={highlighted ? 1.1 : 0}
        transparent
        opacity={highlighted || selected ? 1 : 0.85}
        metalness={0.1}
        roughness={0.5}
      />
    </mesh>
  );
}

function blendColors(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return "#" + a.lerp(b, t).getHexString();
}
