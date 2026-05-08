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
  // Pin sizing in METERS. Bigger than before so they read at typical altitudes.
  // EastNorthUpFrame: +X east, +Y north, +Z up (away from Earth center).
  // Three.js cylinderGeometry defaults its axis to +Y, so we rotate 90° around
  // X to align the cylinder's axis with +Z (vertical / up).
  const norm = Math.pow(intensity, 0.4);
  const heightM = 80_000 + norm * 350_000; // 80–430 km tall
  const radiusM = 12_000 + norm * 22_000; // 12–34 km radius
  const total = city.olympicAthletes + city.paralympicAthletes;
  const paraRatio = total > 0 ? city.paralympicAthletes / total : 0;
  const color = blend("#3b82f6", "#f59e0b", paraRatio);

  return (
    <EastNorthUpFrame
      lat={city.lat * DEG2RAD}
      lon={city.lng * DEG2RAD}
      height={0}
    >
      {/* Vertical pin — rotated so cylinder long axis = +Z up */}
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
          emissiveIntensity={selected ? 1.2 : 0.45}
          metalness={0.25}
          roughness={0.4}
          transparent
          opacity={selected ? 1 : 0.95}
        />
      </mesh>
      {/* Sphere head on top so the pin reads from far away */}
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
          emissiveIntensity={selected ? 1.4 : 0.6}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
      {/* Ground ring for additional visibility — flat on surface (XY plane in ENU) */}
      <mesh position={[0, 0, 500]}>
        <ringGeometry args={[radiusM * 1.0, radiusM * 2.4, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </EastNorthUpFrame>
  );
}

function blend(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return "#" + a.lerp(b, t).getHexString();
}
