import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF, localUp, localEast } from "../lib/ecef.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// Geographic center of CONUS (Smith County, Kansas).
const US_CENTER_LAT = 39.5;
const US_CENTER_LNG = -98.35;

// Continent-scale aerial dolly over the US — landing-page backdrop.
// Altitude ~5500km gives the iconic "USA from space" framing with subtle
// Earth curvature on the edges. Camera oscillates ±15° in heading and
// breathes ±200km in altitude so the perspective gently drifts without
// ever breaking the framing of the country.
export default function Intro3DMap({ igniting }) {
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  // Until the API key arrives, render nothing — the dark slate body color
  // shows through as a clean loading state.
  if (!mapsApiKey) return null;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 transition-opacity duration-700 ${
        igniting ? "opacity-50" : "opacity-100"
      }`}
    >
      <Canvas
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 45, near: 1, far: 5e7 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={1.0} />
        <directionalLight position={[1, 0.6, 0.5]} intensity={1.4} />
        <Scene apiKey={mapsApiKey} />
      </Canvas>

      {/* Soft radial vignette behind the hero — keeps body text legible
          without looking like a card. Same pattern as CityCinematic. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 45%, rgba(2,6,14,0.62) 0%, rgba(2,6,14,0) 75%)",
        }}
      />
    </div>
  );
}

function Scene({ apiKey }) {
  return (
    <TilesRenderer url={TILESET_URL}>
      <TilesPlugin
        plugin={GoogleCloudAuthPlugin}
        args={{ apiToken: apiKey, autoRefreshToken: true }}
      />
      <ContinentCamera />
    </TilesRenderer>
  );
}

function ContinentCamera() {
  const { camera } = useThree();
  const t0 = useRef(performance.now());

  const frame = useMemo(() => {
    const center = latLngToECEF(US_CENTER_LAT, US_CENTER_LNG, 0);
    const upVec = localUp(US_CENTER_LAT, US_CENTER_LNG);
    const eastVec = localEast(US_CENTER_LAT, US_CENTER_LNG);
    const northVec = new THREE.Vector3()
      .crossVectors(upVec, eastVec)
      .normalize();
    return { center, upVec, eastVec, northVec };
  }, []);

  useLayoutEffect(() => {
    // Initial camera position above the US center, so tiles begin streaming
    // the moment the Canvas mounts.
    const startAlt = 5_500_000;
    const startPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(frame.upVec, startAlt);
    camera.position.copy(startPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  }, [camera, frame]);

  useFrame(() => {
    const elapsed = (performance.now() - t0.current) / 1000;

    // Gentle oscillating heading: ±15° around due-up over a 90s sin period.
    const headingRad = Math.sin(elapsed * (2 * Math.PI / 90)) * (15 * Math.PI / 180);
    // Altitude breathes ±200km over an 80s sin period for parallax.
    const altitudeM = 5_500_000 + Math.sin(elapsed * (2 * Math.PI / 80)) * 200_000;

    // Lateral offset = altitude * tan(heading). Cap heading so this stays sane.
    const lateralOffsetM = altitudeM * Math.tan(headingRad);

    const lateral = new THREE.Vector3()
      .copy(frame.eastVec)
      .multiplyScalar(Math.cos(elapsed * 0.05))
      .addScaledVector(frame.northVec, Math.sin(elapsed * 0.05));

    const camPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(frame.upVec, altitudeM)
      .addScaledVector(lateral, lateralOffsetM);

    camera.position.copy(camPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  });

  return null;
}
