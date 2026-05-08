import { useMemo, useRef } from "react";
import { EastNorthUpFrame } from "3d-tiles-renderer/r3f";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF } from "../lib/ecef.js";

const DEG2RAD = Math.PI / 180;

// When NO sport filter is active, label this many top cities by athlete count.
// When a sport IS filtered, every visible city gets a label (usually < 50).
const NO_FILTER_LABEL_COUNT = 60;

// Reference camera-to-pin distance at which the pin renders at "scale 1".
// Smaller distances → smaller scale (so pins shrink as you zoom in).
const PIN_REFERENCE_DIST = 9_000_000;
const PIN_MIN_SCALE = 0.18;
const PIN_MAX_SCALE = 3.0;

export default function CityPins() {
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);
  const selectedCityKey = useApp((s) => s.selectedCityKey);
  const sportFilter = useApp((s) => s.sportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);

  const cities = cityHubsDoc?.cities || [];

  // Per-city filter mask: which cities have at least one hub matching the
  // current sport + category filter? When filters are off, every city qualifies.
  const filteredCityKeys = useMemo(() => {
    if (!cityHubsDoc) return null;
    if (!sportFilter && !categoryFilter) return null; // null = no filter, show all
    const set = new Set();
    const sportLower = sportFilter?.toLowerCase();
    for (const h of cityHubsDoc.hubs) {
      if (sportLower && !h.sport.toLowerCase().includes(sportLower)) continue;
      if (categoryFilter && h.category !== categoryFilter) continue;
      set.add(`${h.state}|${h.cityKey}`);
    }
    return set;
  }, [cityHubsDoc, sportFilter, categoryFilter]);

  const visibleCities = useMemo(
    () => (filteredCityKeys ? cities.filter((c) => filteredCityKeys.has(`${c.state}|${c.cityKey}`)) : cities),
    [cities, filteredCityKeys]
  );

  const max = useMemo(
    () => Math.max(1, ...visibleCities.map((c) => c.athleteCount)),
    [visibleCities]
  );

  // Label visibility:
  // - Filter active: every visible city gets a label (set is small).
  // - No filter: top N cities by overall athlete count.
  // - Selected city always gets a label regardless.
  const labelSet = useMemo(() => {
    if (filteredCityKeys) {
      // every visible city is "interesting" because the user opted in via filter
      return new Set(visibleCities.map((c) => `${c.state}|${c.cityKey}`));
    }
    const sorted = [...visibleCities].sort((a, b) => b.athleteCount - a.athleteCount);
    return new Set(sorted.slice(0, NO_FILTER_LABEL_COUNT).map((c) => `${c.state}|${c.cityKey}`));
  }, [visibleCities, filteredCityKeys]);

  if (!visibleCities.length) return null;

  return (
    <>
      {visibleCities.map((c) => {
        const key = `${c.state}|${c.cityKey}`;
        const isSelected = selectedCityKey === key;
        const showLabel = isSelected || labelSet.has(key);
        return (
          <CityPin
            key={key}
            city={c}
            intensity={c.athleteCount / max}
            selected={isSelected}
            showLabel={showLabel}
            onSelect={() => setSelectedCityKey(key)}
          />
        );
      })}
    </>
  );
}

function CityPin({ city, intensity, selected, showLabel, onSelect }) {
  const groupRef = useRef();

  // Real-world (ECEF, meters) sizing — these are full-size dimensions at scale=1.
  // The group is then scaled per-frame to maintain constant screen size.
  const norm = Math.pow(intensity, 0.4);
  const heightM = 80_000 + norm * 350_000;
  const radiusM = 12_000 + norm * 22_000;

  const total = city.olympicAthletes + city.paralympicAthletes;
  const paraRatio = total > 0 ? city.paralympicAthletes / total : 0;
  const color = useMemo(() => blend("#3b82f6", "#f59e0b", paraRatio), [paraRatio]);

  // Pre-compute ECEF position so the per-frame scale calc is cheap.
  const cityPos = useMemo(() => latLngToECEF(city.lat, city.lng, 0), [city.lat, city.lng]);

  // Constant-screen-size: scale proportional to camera distance from the pin.
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const dist = camera.position.distanceTo(cityPos);
    let scale = dist / PIN_REFERENCE_DIST;
    if (scale < PIN_MIN_SCALE) scale = PIN_MIN_SCALE;
    if (scale > PIN_MAX_SCALE) scale = PIN_MAX_SCALE;
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <EastNorthUpFrame lat={city.lat * DEG2RAD} lon={city.lng * DEG2RAD} height={0}>
      <group ref={groupRef}>
        {/* Vertical pin body — rotated so cylinder long axis = +Z up */}
        <mesh
          position={[0, 0, heightM / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "default")}
        >
          <cylinderGeometry args={[radiusM * 0.6, radiusM, heightM, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={new THREE.Color(color)}
            emissiveIntensity={selected ? 1.4 : 0.5}
            metalness={0.25}
            roughness={0.4}
            transparent
            opacity={selected ? 1 : 0.95}
          />
        </mesh>
        {/* Sphere head on top so pins read at any zoom */}
        <mesh
          position={[0, 0, heightM]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <sphereGeometry args={[radiusM * 1.4, 16, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={new THREE.Color(color)}
            emissiveIntensity={selected ? 1.6 : 0.7}
            metalness={0.3}
            roughness={0.35}
          />
        </mesh>
        {/* Ground ring */}
        <mesh position={[0, 0, 500]}>
          <ringGeometry args={[radiusM * 1.0, radiusM * 2.4, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* HTML overlay label — only for top hubs and the selected city */}
        {showLabel && (
          <Html
            position={[0, 0, heightM * 1.35]}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
            distanceFactor={1_500_000}
          >
            <div
              className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                selected
                  ? "bg-white text-slate-900 border-white shadow-lg"
                  : "bg-slate-950/80 text-slate-50 border-slate-700/60"
              }`}
            >
              {city.city}, {city.state}
              <span className="text-slate-300 font-normal ml-1.5">{city.athleteCount}</span>
            </div>
          </Html>
        )}
      </group>
    </EastNorthUpFrame>
  );
}

function blend(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return "#" + a.lerp(b, t).getHexString();
}
