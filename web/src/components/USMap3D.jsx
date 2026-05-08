import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useApp, computeStateIntensity } from "../store.js";
import { loadUsStates, featureToShapes, featureCenter } from "../lib/usMap.js";

// Stylized 3D US map — extruded states from Albers-projected TopoJSON.
// Replaces the photorealistic globe. US-only by design, locked camera.

const BASE_DEPTH = 0.01;
const MAX_HEIGHT = 0.18;
const STATE_PULSE_HZ = 4;

export default function USMap3D() {
  const [features, setFeatures] = useState(null);
  const hubsDoc = useApp((s) => s.hubsDoc);
  const mode = useApp((s) => s.mode);
  const sportFilter = useApp((s) => s.sportFilter);
  const categoryFilter = useApp((s) => s.categoryFilter);
  const highlightedStates = useApp((s) => s.highlightedStates);
  const selectedState = useApp((s) => s.selectedState);
  const setSelectedState = useApp((s) => s.setSelectedState);

  useEffect(() => {
    let cancelled = false;
    loadUsStates().then((f) => {
      if (!cancelled) setFeatures(f);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!features) return null;
  const max = Math.max(...intensities.values(), 1);

  return (
    <group>
      {features.map((f) => (
        <StateMesh
          key={f.id}
          feature={f}
          intensity={(intensities.get(f.stateCode) || 0) / max}
          split={splitByState.get(f.stateCode) || { Olympic: 0, Paralympic: 0 }}
          highlighted={highlightedStates.includes(f.stateCode)}
          selected={selectedState === f.stateCode}
          onSelect={() => f.stateCode && setSelectedState(f.stateCode)}
        />
      ))}
    </group>
  );
}

function StateMesh({ feature, intensity, split, highlighted, selected, onSelect }) {
  const { extrudeGeom, color } = useMemo(() => {
    const shapes = featureToShapes(feature);
    const total = split.Olympic + split.Paralympic;
    const paraRatio = total > 0 ? split.Paralympic / total : 0;
    const norm = Math.pow(intensity, 0.55);
    const depth = BASE_DEPTH + norm * MAX_HEIGHT;
    const geom = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: false,
      curveSegments: 4,
    });
    // Lay flat: rotate the XY-projected geometry onto the XZ ground plane.
    geom.rotateX(-Math.PI / 2);
    return {
      extrudeGeom: geom,
      color: blend("#3b82f6", "#f59e0b", paraRatio),
    };
  }, [feature, intensity, split.Olympic, split.Paralympic]);

  // Cleanup geometry on unmount/recompute
  useEffect(() => () => extrudeGeom.dispose(), [extrudeGeom]);

  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (highlighted || selected) {
      const k = 1 + Math.sin(clock.getElapsedTime() * STATE_PULSE_HZ) * 0.06;
      ref.current.scale.y = k;
    } else if (ref.current.scale.y !== 1) {
      ref.current.scale.y = 1;
    }
  });

  const baseEmissive = highlighted
    ? new THREE.Color(color).multiplyScalar(0.35)
    : selected
    ? new THREE.Color(color).multiplyScalar(0.18)
    : new THREE.Color("#000000");

  return (
    <mesh
      ref={ref}
      geometry={extrudeGeom}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        emissive={baseEmissive}
        emissiveIntensity={highlighted ? 1.0 : selected ? 0.5 : 0}
        metalness={0.05}
        roughness={0.7}
        transparent
        opacity={intensity > 0 ? 1 : 0.55}
      />
    </mesh>
  );
}

function blend(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return "#" + a.lerp(b, t).getHexString();
}
