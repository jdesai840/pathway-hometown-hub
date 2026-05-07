import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import { useEffect } from "react";
import { useApp } from "../store.js";

export const xrStore = createXRStore({
  hand: true,
  controller: true,
  // immersive-ar gives Quest 3 mixed-reality passthrough
});

// 3D scene: same content renders inside WebXR session AND on desktop fallback.
// On WebXR, panels float in your room (mixed reality). On desktop, OrbitControls let you spin around.
export default function SpatialScene() {
  const setInXR = useApp((s) => s.setInXR);
  const matches = useApp((s) => s.matches);
  const archetypes = useApp((s) => s.archetypes);

  useEffect(() => {
    return xrStore.subscribe((state) => setInXR(state.session != null));
  }, [setInXR]);

  return (
    <Canvas camera={{ position: [0, 1.4, 2.5], fov: 50 }} shadows>
      <XR store={xrStore}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <OrbitControls enablePan={false} target={[0, 1.4, 0]} />
        <ParityPanels matches={matches} archetypes={archetypes} />
      </XR>
    </Canvas>
  );
}

function ParityPanels({ matches, archetypes }) {
  if (!matches || !archetypes) return null;
  const top = matches.matches?.slice(0, 2) || [];
  const olympic = top.find(
    (m) => archetypes.find((a) => a.id === m.archetypeId)?.category === "Olympic"
  );
  const paralympic = top.find(
    (m) => archetypes.find((a) => a.id === m.archetypeId)?.category === "Paralympic"
  );

  return (
    <>
      {olympic && (
        <Panel position={[-0.9, 1.4, 0]} color="#3b82f6" match={olympic} archetypes={archetypes} />
      )}
      {paralympic && (
        <Panel position={[0.9, 1.4, 0]} color="#f59e0b" match={paralympic} archetypes={archetypes} />
      )}
    </>
  );
}

function Panel({ position, color, match, archetypes }) {
  const archetype = archetypes.find((a) => a.id === match.archetypeId);
  if (!archetype) return null;
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[1.5, 1.0]} />
        <meshStandardMaterial color={color} opacity={0.15} transparent />
      </mesh>
      <Html
        transform
        distanceFactor={1.4}
        position={[0, 0, 0.01]}
        style={{ width: 380, pointerEvents: "auto" }}
      >
        <div className="rounded-xl bg-slate-900/90 text-slate-100 p-4 border" style={{ borderColor: color }}>
          <div className="text-xs uppercase tracking-widest font-semibold" style={{ color }}>
            {archetype.category} archetype
          </div>
          <div className="text-xl font-bold mt-1">{archetype.name}</div>
          <div className="text-sm mt-2 text-slate-300">{archetype.summary}</div>
        </div>
      </Html>
    </group>
  );
}
