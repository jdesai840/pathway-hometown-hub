import { useMemo } from "react";
import { EastNorthUpFrame } from "3d-tiles-renderer/r3f";
import * as THREE from "three";
import { useApp } from "../store.js";

const DEG2RAD = Math.PI / 180;

// Pins for every city that has at least one Team USA athlete.
// Pin is a small cylinder anchored at the city's lat/lng on the WGS84
// ellipsoid (via EastNorthUpFrame). Pin size scales with athlete count;
// color blends Olympic blue → Paralympic amber by category mix.
//
// NIL-compliant: shows aggregate counts only. NO names, NO photos.
export default function CityPins() {
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);
  const selectedCityKey = useApp((s) => s.selectedCityKey);

  const cities = cityHubsDoc?.cities || [];
  const max = useMemo(
    () => Math.max(1, ...cities.map((c) => c.athleteCount)),
    [cities]
  );

  if (!cities.length) return null;

  return (
    <>
      {cities.map((c) => (
        <CityPin
          key={`${c.state}|${c.cityKey}`}
          city={c}
          intensity={c.athleteCount / max}
          selected={selectedCityKey === `${c.state}|${c.cityKey}`}
          onSelect={() => setSelectedCityKey(`${c.state}|${c.cityKey}`)}
        />
      ))}
    </>
  );
}

function CityPin({ city, intensity, selected, onSelect }) {
  // Pin geometry: tall cylinder, taller for cities with more athletes.
  // Sized in METERS (ECEF frame); ~50–250km tall so visible from camera at ~3000km altitude.
  const norm = Math.pow(intensity, 0.45);
  const heightM = 50_000 + norm * 250_000;
  const radiusM = 8_000 + norm * 18_000;
  const total = city.olympicAthletes + city.paralympicAthletes;
  const paraRatio = total > 0 ? city.paralympicAthletes / total : 0;
  const color = blend("#3b82f6", "#f59e0b", paraRatio);

  return (
    <EastNorthUpFrame
      lat={city.lat * DEG2RAD}
      lon={city.lng * DEG2RAD}
      height={0}
    >
      <mesh
        position={[0, 0, heightM / 2]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <cylinderGeometry args={[radiusM, radiusM * 0.7, heightM, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? new THREE.Color(color) : new THREE.Color("#000")}
          emissiveIntensity={selected ? 0.8 : 0}
          metalness={0.2}
          roughness={0.4}
          transparent
          opacity={selected ? 1 : 0.9}
        />
      </mesh>
      {/* Glowing base ring at ground level for visibility */}
      <mesh position={[0, 0, 1000]} rotation={[0, 0, 0]}>
        <ringGeometry args={[radiusM * 0.9, radiusM * 1.6, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </EastNorthUpFrame>
  );
}

function blend(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return "#" + a.lerp(b, t).getHexString();
}
