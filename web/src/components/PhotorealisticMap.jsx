import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { TilesRenderer, TilesPlugin, GlobeControls } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { latLngToECEF, CONUS_CENTER_LAT, CONUS_CENTER_LNG } from "../lib/ecef.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// CONUS-centered photorealistic Earth viewer. Camera starts high over the
// continental US looking down. GlobeControls orbit around the surface point;
// damping makes panning + zooming feel like Google Earth.
//
// We don't HARD-lock to CONUS-only (the Earth is a sphere, restricting
// orbiting requires per-frame angle clamping which fights GlobeControls).
// Instead we pin the initial state and let the user orbit naturally. If they
// drift off the US, the "Reset view" button snaps them back.
export default function PhotorealisticMap({ apiKey }) {
  return (
    <TilesRenderer url={TILESET_URL}>
      <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken: apiKey, autoRefreshToken: true }} />
      <GlobeControls enableDamping minDistance={500_000} maxDistance={20_000_000} />
      <CameraInitializer />
    </TilesRenderer>
  );
}

// One-shot initializer: positions the camera high above CONUS and looks down.
// Also handles "map:reset-view" events from the HUD.
function CameraInitializer() {
  const { camera } = useThree();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    snapToConus(camera);
  }, [camera]);

  useEffect(() => {
    function onReset() {
      snapToConus(camera);
    }
    window.addEventListener("map:reset-view", onReset);
    return () => window.removeEventListener("map:reset-view", onReset);
  }, [camera]);

  return null;
}

function snapToConus(camera) {
  // Camera at ~3000 km altitude over CONUS, looking down.
  const surfacePt = latLngToECEF(CONUS_CENTER_LAT, CONUS_CENTER_LNG, 0);
  const cameraPt = latLngToECEF(CONUS_CENTER_LAT, CONUS_CENTER_LNG, 3_000_000);
  camera.position.copy(cameraPt);
  camera.up.copy(surfacePt).normalize(); // surface normal = up
  camera.lookAt(surfacePt);
  camera.near = 1;
  camera.far = 5e7;
  camera.updateProjectionMatrix();
}
