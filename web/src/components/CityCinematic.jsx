import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF, localUp, localEast } from "../lib/ecef.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// Photorealistic 3D city flyover — used INSIDE a tour stop.
//
// IMPORTANT: this component stays MOUNTED for the entire tour (not just when
// the cinematic flag is true). The TilesRenderer pre-loads tiles for the
// current stop while the user is still seeing the 2D map. Only the opacity
// is toggled — by the time the fade-in completes, tiles are already on screen
// and we don't see a black void.
export default function CityCinematic() {
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const cinematic = useApp((s) => s.tourCinematic);
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  const stop = tour?.stops?.[tourIndex];
  const mounted = Boolean(tour && stop && mapsApiKey);

  // Track whether the camera has moved to a position where tiles have started
  // arriving — used to fade in the canvas only once, smoothly.
  const [tilesReady, setTilesReady] = useState(false);

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!cinematic}
      className={`fixed inset-0 z-40 transition-opacity duration-700 ease-out ${
        cinematic ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ background: "radial-gradient(ellipse at center, #0a0e16 0%, #04060a 100%)" }}
    >
      <Canvas
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 55, near: 1, far: 5e7 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={1.0} />
        <directionalLight position={[1, 0.6, 0.5]} intensity={1.4} />
        <Scene
          apiKey={mapsApiKey}
          lat={stop.lat}
          lng={stop.lng}
          playing={tourState === "playing" && cinematic}
          onTilesReady={() => setTilesReady(true)}
        />
      </Canvas>
      {/* Vignette over the canvas for film feel */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(4,6,10,0.85) 100%)",
        }}
      />
      {/* Subtle "now playing" caption */}
      {cinematic && stop && (
        <div className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300 font-semibold">
            Photorealistic flyover
          </p>
          <p className="font-display font-extrabold text-3xl text-white tracking-tight mt-1 drop-shadow-lg">
            {stop.city}, {stop.state}
          </p>
        </div>
      )}
    </div>
  );
}

function Scene({ apiKey, lat, lng, playing, onTilesReady }) {
  return (
    <TilesRenderer url={TILESET_URL}>
      <TilesPlugin
        plugin={GoogleCloudAuthPlugin}
        args={{ apiToken: apiKey, autoRefreshToken: true }}
      />
      <CinematicCamera lat={lat} lng={lng} playing={playing} onTilesReady={onTilesReady} />
    </TilesRenderer>
  );
}

// Auto-orbits the city center at low altitude. Re-positions whenever lat/lng
// changes so each new stop gets a fresh angle. Camera is set ON MOUNT so
// tiles for the current city start streaming immediately, even before the
// cinematic fade-in fires.
function CinematicCamera({ lat, lng, playing }) {
  const { camera } = useThree();
  const t0 = useRef(performance.now());

  // Local east-north-up frame at the city.
  // - up = surface NORMAL (radial outward) — used for altitude offsets and
  //   for camera.up so the sky stays at the top of the view.
  // - east + north form the tangent plane (where the orbit sweeps).
  const frame = useMemo(() => {
    const center = latLngToECEF(lat, lng, 0);
    const upVec = localUp(lat, lng); // <-- the actual surface normal
    const eastVec = localEast(lat, lng);
    const northVec = new THREE.Vector3().crossVectors(upVec, eastVec).normalize();
    return { center, upVec, eastVec, northVec };
  }, [lat, lng]);

  useLayoutEffect(() => {
    t0.current = performance.now();
    // Initial camera position: 3.5km east of the city center, 1.6km altitude.
    const startPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(frame.eastVec, 3500)
      .addScaledVector(frame.upVec, 1600);
    camera.position.copy(startPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  }, [camera, frame]);

  useFrame(() => {
    const elapsed = (performance.now() - t0.current) / 1000;
    // Slow gentle orbit — only animates while playing
    const angle = (playing ? elapsed * 0.06 : 0) + Math.PI / 6;
    const radiusM = 3500 + Math.sin(elapsed * 0.2) * 600;
    const altitudeM = 1600 + Math.sin(elapsed * 0.15) * 250;

    // Tangent direction sweeping around the city in the east-north plane.
    const tangent = new THREE.Vector3()
      .copy(frame.eastVec).multiplyScalar(Math.cos(angle))
      .addScaledVector(frame.northVec, Math.sin(angle));

    const camPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(tangent, radiusM)   // horizontal offset (along surface)
      .addScaledVector(frame.upVec, altitudeM); // altitude (radially outward)

    camera.position.copy(camPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  });

  return null;
}
