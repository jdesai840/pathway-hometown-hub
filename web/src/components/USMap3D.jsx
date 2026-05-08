import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useApp, computeStateIntensity } from "../store.js";
import { loadUsStates, featureToShapes } from "../lib/usMap.js";

// Stylized 3D US map — extruded states from Albers-projected TopoJSON.
// Each state has a colored fill (intensity-driven) plus a crisp outline so
// the borders read clearly even at low contrast.

const BASE_DEPTH = 0.005;
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
  const { extrudeGeom, edgeGeom, color, depth } = useMemo(() => {
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
    geom.rotateX(-Math.PI / 2);
    const edgeGeom = new THREE.EdgesGeometry(geom, 1);
    return {
      extrudeGeom: geom,
      edgeGeom,
      color: blend("#3b82f6", "#f59e0b", paraRatio),
      depth,
    };
  }, [feature, intensity, split.Olympic, split.Paralympic]);

  useEffect(() => {
    return () => {
      extrudeGeom.dispose();
      edgeGeom.dispose();
    };
  }, [extrudeGeom, edgeGeom]);

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
    ? new THREE.Color(color).multiplyScalar(0.4)
    : selected
    ? new THREE.Color(color).multiplyScalar(0.2)
    : new THREE.Color("#000000");

  // Edge color brightens for highlighted/selected; otherwise a soft white-ish
  // line that reads against the dark background and contrasts state fills.
  const edgeColor = highlighted
    ? "#ffffff"
    : selected
    ? "#e5e7eb"
    : "#1f2937"; // slate-800 — visible but not loud

  return (
    <group ref={ref}>
      <mesh
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
          emissiveIntensity={highlighted ? 1.0 : selected ? 0.55 : 0}
          metalness={0.05}
          roughness={0.65}
          transparent
          opacity={intensity > 0 ? 1 : 0.6}
        />
      </mesh>
      <lineSegments geometry={edgeGeom}>
        <lineBasicMaterial
          color={edgeColor}
          transparent
          opacity={highlighted || selected ? 0.95 : 0.55}
          linewidth={1}
        />
      </lineSegments>
    </group>
  );
}

function blend(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return "#" + a.lerp(b, t).getHexString();
}
