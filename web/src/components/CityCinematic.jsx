import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF, localNorth, localEast } from "../lib/ecef.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// Photorealistic 3D city flyover — used INSIDE a tour stop. The camera
// auto-orbits the city at low altitude so the photogrammetry comes alive.
//
// Renders only when a tour is active and we're past the cinematic threshold
// of the current stop. Outside of tours this component is unmounted.
export default function CityCinematic() {
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const cinematic = useApp((s) => s.tourCinematic);
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  const stop = tour?.stops?.[tourIndex];
  const visible = Boolean(tour && stop && cinematic && mapsApiKey);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ background: "radial-gradient(ellipse at center, #0a0e16 0%, #04060a 100%)" }}
    >
      {visible && stop && (
        <Canvas
          gl={{ logarithmicDepthBuffer: true, antialias: true }}
          camera={{ fov: 55, near: 1, far: 5e7 }}
          style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
        >
          <ambientLight intensity={1.0} />
          <directionalLight position={[1, 0.6, 0.5]} intensity={1.4} />
          <Scene
            apiKey={mapsApiKey}
            lat={stop.lat}
            lng={stop.lng}
            playing={tourState === "playing"}
          />
        </Canvas>
      )}
      {/* gradient vignette over the canvas for film feel */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(4,6,10,0.85) 100%)",
        }}
      />
    </div>
  );
}

function Scene({ apiKey, lat, lng, playing }) {
  return (
    <TilesRenderer url={TILESET_URL}>
      <TilesPlugin
        plugin={GoogleCloudAuthPlugin}
        args={{ apiToken: apiKey, autoRefreshToken: true }}
      />
      <CinematicCamera lat={lat} lng={lng} playing={playing} />
    </TilesRenderer>
  );
}

// Auto-orbits the city center at low altitude. Re-initializes whenever lat/lng
// changes so each new stop gets a fresh angle.
function CinematicCamera({ lat, lng, playing }) {
  const { camera } = useThree();
  const t0 = useRef(performance.now());
  const frame = useMemo(() => {
    const center = latLngToECEF(lat, lng, 0);
    const upVec = localNorth(lat, lng);
    const eastVec = localEast(lat, lng);
    return { center, upVec, eastVec };
  }, [lat, lng]);

  useLayoutEffect(() => {
    t0.current = performance.now();
  }, [lat, lng]);

  useFrame(() => {
    const elapsed = (performance.now() - t0.current) / 1000;
    // Slow gentle orbit — full revolution every ~60s, with subtle altitude breathing
    const angle = (playing ? elapsed * 0.06 : 0) + Math.PI / 6;
    const radiusM = 3500 + Math.sin(elapsed * 0.2) * 600; // 2.9–4.1 km out from center
    const altitudeM = 1600 + Math.sin(elapsed * 0.15) * 250; // 1.35–1.85 km up

    const radial = new THREE.Vector3()
      .copy(frame.eastVec).multiplyScalar(Math.cos(angle))
      .addScaledVector(new THREE.Vector3().crossVectors(frame.upVec, frame.eastVec).normalize(), Math.sin(angle));

    const camPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(radial, radiusM)
      .addScaledVector(frame.upVec, altitudeM);

    camera.position.copy(camPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  });

  return null;
}
