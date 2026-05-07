import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import * as THREE from "three";
import { useApp, computeStateIntensity } from "../store.js";
import { STATE_INFO, statePosition, PLANE_SIZE } from "../data/us-states.js";
import PhotorealisticMap from "./PhotorealisticMap.jsx";

export const xrStore = createXRStore({ hand: true, controller: true });

// Top-level scene. When a Maps API key is available we render the Photorealistic
// 3D Tiles globe with state markers on the ellipsoid; otherwise we fall back to
// the simple flat-plane choropleth (still functional, useful for local dev).
export default function MapScene() {
  const setSelectedState = useApp((s) => s.setSelectedState);
  const mapsApiKey = useApp((s) => s.mapsApiKey);
  const hasKey = Boolean(mapsApiKey);

  return (
    <Canvas
      // Globe needs more headroom (large Earth-meter coordinates); flat is small.
      camera={hasKey
        ? { position: [0, 6_000_000, 22_000_000], fov: 45, near: 1, far: 50_000_000 }
        : { position: [0, 1.4, 1.4], fov: 50 }}
      shadows
      onPointerMissed={() => setSelectedState(null)}
    >
      <XR store={xrStore}>
        <ambientLight intensity={hasKey ? 1.0 : 0.55} />
        <directionalLight position={[2, 4, 2]} intensity={1.0} />
        {hasKey ? (
          <PhotorealisticMap apiKey={mapsApiKey} />
        ) : (
          <>
            <OrbitControls enablePan={false} target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.1} />
            <FlatPlane />
            <FlatStateMarkers />
          </>
        )}
      </XR>
    </Canvas>
  );
}

function FlatPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLANE_SIZE.w, PLANE_SIZE.h, 1, 1]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  );
}

function FlatStateMarkers() {
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

  if (!hubsDoc) return null;

  const max = Math.max(...intensities.values(), 1);
  return (
    <>
      {Object.keys(STATE_INFO).map((code) => {
        const intensity = intensities.get(code) || 0;
        const pos = statePosition(code);
        if (!pos) return null;
        const norm = Math.pow(intensity / max, 0.6);
        const height = 0.005 + norm * 0.4;
        const split = splitByState.get(code) || { Olympic: 0, Paralympic: 0 };
        const total = split.Olympic + split.Paralympic;
        const paraRatio = total > 0 ? split.Paralympic / total : 0;
        const color = blendColors("#3b82f6", "#f59e0b", paraRatio);
        const isHighlighted = highlightedStates.includes(code);
        const isSelected = selectedState === code;
        return (
          <FlatStateBar
            key={code}
            position={[pos[0], height / 2, pos[2]]}
            height={height}
            color={color}
            highlighted={isHighlighted}
            selected={isSelected}
            onSelect={() => setSelectedState(code)}
          />
        );
      })}
    </>
  );
}

function FlatStateBar({ position, height, color, highlighted, selected, onSelect }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    if (highlighted || selected) {
      ref.current.scale.x = 1 + Math.sin(t * 4) * 0.08;
      ref.current.scale.z = ref.current.scale.x;
    } else {
      ref.current.scale.x = 1;
      ref.current.scale.z = 1;
    }
  });

  const emissive = highlighted ? new THREE.Color(color).multiplyScalar(0.4) : new THREE.Color("#000000");
  const opacity = highlighted ? 1 : selected ? 1 : 0.85;

  return (
    <mesh
      ref={ref}
      position={position}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
      castShadow
    >
      <boxGeometry args={[0.025, height, 0.025]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={highlighted ? 1.2 : 0}
        transparent
        opacity={opacity}
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
