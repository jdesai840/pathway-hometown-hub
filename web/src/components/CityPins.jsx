import { useMemo, useRef } from "react";
import { EastNorthUpFrame } from "3d-tiles-renderer/r3f";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF } from "../lib/ecef.js";

const DEG2RAD = Math.PI / 180;

// How many cities (by athlete count) get a visible HTML label by default.
const TOP_LABEL_COUNT = 40;

// Reference camera-to-pin distance at which the pin renders at "scale 1".
// Smaller distances → smaller scale (so pins shrink as you zoom in).
const PIN_REFERENCE_DIST = 9_000_000;
const PIN_MIN_SCALE = 0.18;
const PIN_MAX_SCALE = 3.0;

export default function CityPins() {
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);
  const selectedCityKey = useApp((s) => s.selectedCityKey);

  const cities = cityHubsDoc?.cities || [];
  const max = useMemo(
    () => Math.max(1, ...cities.map((c) => c.athleteCount)),
    [cities]
  );
  // Cities with always-on labels: top N by athlete count.
  const labelSet = useMemo(() => {
    const sorted = [...cities].sort((a, b) => b.athleteCount - a.athleteCount);
    return new Set(sorted.slice(0, TOP_LABEL_COUNT).map((c) => `${c.state}|${c.cityKey}`));
  }, [cities]);

  if (!cities.length) return null;

  return (
    <>
      {cities.map((c) => {
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
