import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import {
  latLngToECEF,
  localNorth,
  CONUS_CENTER_LAT,
  CONUS_CENTER_LNG,
} from "../lib/ecef.js";
import { useApp } from "../store.js";
import CityPins from "./CityPins.jsx";
import StateBorders from "./StateBorders.jsx";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// Photorealistic Earth, camera locked to orbit around CONUS center.
//
// Why OrbitControls (not the library's GlobeControls): GlobeControls re-orients
// the camera up vector to the local surface normal during interaction, which
// makes "north" rotate as the user drags. We want north to STAY up. OrbitControls
// preserves whatever camera.up we set, so the orientation stays stable.
//
// Camera position + up are computed in ECEF (Earth-Centered, Earth-Fixed)
// coordinates so they line up with the photorealistic tile geometry.
export default function PhotorealisticMap({ apiKey }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);

  // Pre-compute the CONUS frame (target on the surface, north vector for camera up)
  const conus = useMemo(() => {
    const target = latLngToECEF(CONUS_CENTER_LAT, CONUS_CENTER_LNG, 0);
    const cameraStart = latLngToECEF(CONUS_CENTER_LAT, CONUS_CENTER_LNG, 3_000_000);
    const up = localNorth(CONUS_CENTER_LAT, CONUS_CENTER_LNG);
    return { target, cameraStart, up };
  }, []);

  // useLayoutEffect runs synchronously before paint — sets up the camera in
  // ECEF space before OrbitControls latches onto whatever R3F initialized.
  useLayoutEffect(() => {
    camera.up.copy(conus.up);
    camera.position.copy(conus.cameraStart);
    camera.lookAt(conus.target);
    camera.near = 1;
    camera.far = 5e7;
    camera.updateProjectionMatrix();
  }, [camera, conus]);

  // Listen for the HUD reset button — snap back to CONUS.
  useEffect(() => {
    function onReset() {
      camera.up.copy(conus.up);
      camera.position.copy(conus.cameraStart);
      camera.lookAt(conus.target);
      camera.updateProjectionMatrix();
    }
    window.addEventListener("map:reset-view", onReset);
    return () => window.removeEventListener("map:reset-view", onReset);
  }, [camera, conus]);

  return (
    <>
      <TilesRenderer url={TILESET_URL}>
        <TilesPlugin
          plugin={GoogleCloudAuthPlugin}
          args={{ apiToken: apiKey, autoRefreshToken: true }}
        />
        {/* City pins + state borders live INSIDE the TilesRenderer so they
            inherit the same ellipsoid frame the photorealistic tiles use. */}
        <CityPins />
        <StateBorders />
      </TilesRenderer>
      <OrbitControls
        ref={controlsRef}
        target={conus.target.toArray()}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={1.0}
        // Pan IS enabled — moves both camera + target tangent to the camera direction.
        // At planetary scale this drags the focus across the surface.
        enablePan
        screenSpacePanning
        panSpeed={1.0}
        keyPanSpeed={20_000}
        // Globe scale: target ECEF magnitude is ~6.4 million m (Earth radius).
        // Camera should be 0.5–25 million meters from target.
        minDistance={500_000}
        maxDistance={25_000_000}
        // Allow tilt: nearly top-down to nearly horizontal, but never below horizon.
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2 - 0.05}
        makeDefault
      />
      <CityFocus controlsRef={controlsRef} />
    </>
  );
}

// Smoothly fly the camera target to the selected city when one is clicked.
function CityFocus({ controlsRef }) {
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const selectedCityKey = useApp((s) => s.selectedCityKey);
  const { camera } = useThree();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (!selectedCityKey || !cityHubsDoc) {
      setTarget(null);
      return;
    }
    const c = cityHubsDoc.cities.find(
      (x) => `${x.state}|${x.cityKey}` === selectedCityKey
    );
    if (!c) return;
    setTarget({ pos: latLngToECEF(c.lat, c.lng, 0), lat: c.lat, lng: c.lng });
  }, [selectedCityKey, cityHubsDoc]);

  useFrame(() => {
    if (!target || !controlsRef.current) return;
    const ctl = controlsRef.current;
    // Lerp the target toward the city's ECEF surface point
    ctl.target.lerp(target.pos, 0.1);
    // Pull camera in if it's far away — keep current view direction relative to target
    const desiredDist = 1_500_000; // 1500 km altitude focus
    const dir = camera.position.clone().sub(ctl.target);
    if (dir.length() > desiredDist + 100_000) {
      dir.setLength(desiredDist);
      camera.position.copy(ctl.target).add(dir);
    }
    // Update the camera's "up" to local north at the new target so north stays up
    camera.up.copy(localNorth(target.lat, target.lng));
    ctl.update();
    // Settle
    if (ctl.target.distanceTo(target.pos) < 1000) {
      setTarget(null);
    }
  });

  return null;
}
