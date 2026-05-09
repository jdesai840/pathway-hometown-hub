import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF, localUp, localEast } from "../lib/ecef.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// Photorealistic 3D city flyover — used INSIDE a tour stop.
//
// Mounted for the entire tour duration; only opacity toggles. The camera
// targets the stop's `viewpoint` (Gemini-suggested iconic spot — downtown
// plaza, university campus, training facility) when available, falling back
// to the city's geocoded center.
export default function CityCinematic() {
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const cinematic = useApp((s) => s.tourCinematic);
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  const stop = tour?.stops?.[tourIndex];
  const mounted = Boolean(tour && stop && mapsApiKey);

  // Resolve target lat/lng — prefer Gemini's chosen viewpoint over the city's
  // generic Census centroid.
  const target = stop
    ? {
        lat:
          typeof stop.viewpoint?.lat === "number" ? stop.viewpoint.lat : stop.lat,
        lng:
          typeof stop.viewpoint?.lng === "number" ? stop.viewpoint.lng : stop.lng,
        name: stop.viewpoint?.name || `${stop.city}, ${stop.state}`,
      }
    : null;

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
        camera={{ fov: 50, near: 1, far: 5e7 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={1.0} />
        <directionalLight position={[1, 0.6, 0.5]} intensity={1.4} />
        <Scene
          apiKey={mapsApiKey}
          lat={target.lat}
          lng={target.lng}
          playing={tourState === "playing" && cinematic}
        />
      </Canvas>
      {/* Vignette */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(4,6,10,0.78) 100%)",
        }}
      />
      {/* Subtle title — top-left, no kitschy "Flyover" label */}
      {cinematic && stop && target && (
        <div className="pointer-events-none absolute top-6 left-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300/80 font-semibold">
            {stop.city} · {stop.state}
          </p>
          {stop.viewpoint?.name && (
            <p className="font-display font-bold text-xl text-white tracking-tight mt-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
              {stop.viewpoint.name}
            </p>
          )}
        </div>
      )}
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

// Closer, more cinematic orbit. Camera is ~700-1100m altitude / 1500-2400m
// radius — close enough to read individual buildings and street layout.
function CinematicCamera({ lat, lng, playing }) {
  const { camera } = useThree();
  const t0 = useRef(performance.now());

  const frame = useMemo(() => {
    const center = latLngToECEF(lat, lng, 0);
    const upVec = localUp(lat, lng);
    const eastVec = localEast(lat, lng);
    const northVec = new THREE.Vector3().crossVectors(upVec, eastVec).normalize();
    return { center, upVec, eastVec, northVec };
  }, [lat, lng]);

  useLayoutEffect(() => {
    t0.current = performance.now();
    // Initial position so tile renderer can pre-load while user is still on 2D
    const startPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(frame.eastVec, 1100)
      .addScaledVector(frame.upVec, 500);
    camera.position.copy(startPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  }, [camera, frame]);

  useFrame(() => {
    const elapsed = (performance.now() - t0.current) / 1000;
    // Tight orbit at building-skyline altitude. Smaller frustum = fewer tiles
    // to stream + much more detail per tile.
    const angle = (playing ? elapsed * 0.05 : 0) + Math.PI / 5;
    const radiusM = 1100 + Math.sin(elapsed * 0.18) * 250; // 850–1350m
    const altitudeM = 500 + Math.sin(elapsed * 0.13) * 130; // 370–630m

    const tangent = new THREE.Vector3()
      .copy(frame.eastVec).multiplyScalar(Math.cos(angle))
      .addScaledVector(frame.northVec, Math.sin(angle));

    const camPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(tangent, radiusM)
      .addScaledVector(frame.upVec, altitudeM);

    camera.position.copy(camPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  });

  return null;
}
