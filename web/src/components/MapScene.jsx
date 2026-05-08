import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import * as THREE from "three";
import { useApp } from "../store.js";
import { loadUsStates, featureCenter } from "../lib/usMap.js";
import USMap3D from "./USMap3D.jsx";

export const xrStore = createXRStore({ hand: true, controller: true });

const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const HOME_POSITION = new THREE.Vector3(0, 1.2, 1.0);

// US-only stylized 3D map. Camera is free to orbit, tilt, zoom — but constrained
// so users can't fall off the world or flip upside down.
export default function MapScene() {
  const setSelectedState = useApp((s) => s.setSelectedState);
  const orbitRef = useRef(null);

  return (
    <Canvas
      camera={{ position: HOME_POSITION.toArray(), fov: 38, near: 0.05, far: 60 }}
      shadows
      onPointerMissed={() => setSelectedState(null)}
    >
      <XR store={xrStore}>
        <color attach="background" args={["#06080d"]} />
        <fog attach="fog" args={["#06080d", 4, 12]} />
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
          <planeGeometry args={[8, 6]} />
          <meshStandardMaterial color="#0a0e16" roughness={0.9} metalness={0} />
        </mesh>
        <USMap3D />
        <CameraDirector controlsRef={orbitRef} />
        <OrbitControls
          ref={orbitRef}
          target={HOME_TARGET.toArray()}
          enablePan
          screenSpacePanning
          minDistance={0.4}
          maxDistance={4.5}
          minPolarAngle={0}                  /* allow true top-down */
          maxPolarAngle={Math.PI / 2 - 0.05} /* prevent going under the map */
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.6}
          zoomSpeed={0.9}
          panSpeed={0.7}
          /* clamp pan so the user can't fly off-map */
          minTargetRadius={0}
          maxTargetRadius={1.0}
        />
      </XR>
    </Canvas>
  );
}

// Listens for state-selection changes and smoothly flies the camera to focus on
// that state. Triggered by clicking a state on the map or by the agent
// highlighting a single state. Also handles "map:reset-view" custom events
// dispatched by the HUD reset button.
function CameraDirector({ controlsRef }) {
  const selectedState = useApp((s) => s.selectedState);
  const { camera } = useThree();
  const [targetCenter, setTargetCenter] = useState(null);
  const [resetting, setResetting] = useState(0);

  useEffect(() => {
    if (!selectedState) {
      setTargetCenter(null);
      return;
    }
    let cancelled = false;
    loadUsStates().then((features) => {
      if (cancelled) return;
      const f = features.find((x) => x.stateCode === selectedState);
      if (!f) return;
      const [cx, cz] = featureCenter(f);
      setTargetCenter(new THREE.Vector3(cx, 0, cz));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  useEffect(() => {
    function onReset() {
      setTargetCenter(null);
      setResetting((n) => n + 1);
    }
    window.addEventListener("map:reset-view", onReset);
    return () => window.removeEventListener("map:reset-view", onReset);
  }, []);

  useFrame(() => {
    const ctl = controlsRef.current;
    if (!ctl) return;
    if (targetCenter) {
      ctl.target.lerp(targetCenter, 0.08);
      // Pull camera in slightly — preserve current view direction
      const desiredDist = 0.7;
      const cur = camera.position.clone().sub(ctl.target);
      if (cur.length() > desiredDist + 0.05) {
        cur.setLength(desiredDist);
        camera.position.copy(ctl.target).add(cur);
      }
      ctl.update();
    } else if (resetting > 0) {
      ctl.target.lerp(HOME_TARGET, 0.12);
      camera.position.lerp(HOME_POSITION, 0.12);
      if (
        ctl.target.distanceTo(HOME_TARGET) < 0.005 &&
        camera.position.distanceTo(HOME_POSITION) < 0.01
      ) {
        ctl.target.copy(HOME_TARGET);
        camera.position.copy(HOME_POSITION);
        setResetting(0);
      }
      ctl.update();
    }
  });
  return null;
}
