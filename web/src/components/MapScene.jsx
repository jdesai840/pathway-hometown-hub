import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import { useApp } from "../store.js";
import USMap3D from "./USMap3D.jsx";

export const xrStore = createXRStore({ hand: true, controller: true });

// Stylized 3D US map — US-only by design, locked CONUS camera.
export default function MapScene() {
  const setSelectedState = useApp((s) => s.setSelectedState);
  const orbitRef = useRef(null);

  return (
    <Canvas
      camera={{ position: [0, 1.2, 0.9], fov: 38, near: 0.05, far: 50 }}
      shadows
      onPointerMissed={() => setSelectedState(null)}
    >
      <XR store={xrStore}>
        <color attach="background" args={["#06080d"]} />
        <fog attach="fog" args={["#06080d", 4, 9]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[1.2, 3.0, 2.0]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <hemisphereLight color="#f59e0b" groundColor="#1e3a8a" intensity={0.18} />
        {/* Subtle ground plane to catch shadows */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
          <planeGeometry args={[6, 4]} />
          <meshStandardMaterial color="#0a0e16" roughness={0.9} metalness={0} />
        </mesh>
        <USMap3D />
        <OrbitControls
          ref={orbitRef}
          target={[0, 0, 0]}
          enablePan={false}
          minDistance={0.7}
          maxDistance={2.2}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.45}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.45}
        />
      </XR>
    </Canvas>
  );
}
