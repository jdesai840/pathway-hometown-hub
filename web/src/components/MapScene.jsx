import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { useApp } from "../store.js";
import PhotorealisticMap from "./PhotorealisticMap.jsx";
import { latLngToECEF, CONUS_CENTER_LAT, CONUS_CENTER_LNG } from "../lib/ecef.js";

export const xrStore = createXRStore({ hand: true, controller: true });

// Photorealistic 3D Earth, camera initialized over CONUS with proper north-up
// orientation. Without a Maps API key the tile renderer can't fetch tiles —
// we show a friendly message instead.
export default function MapScene() {
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  if (!mapsApiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-950">
        <div className="text-center max-w-md p-6">
          <p className="text-sm uppercase tracking-widest text-slate-500 mb-2">map offline</p>
          <p className="text-base">
            Maps API key is missing. The deployed Cloud Run service injects it via
            <code className="px-1 mx-1 bg-slate-800 rounded">/api/config</code>; in
            local dev set <code className="px-1 mx-1 bg-slate-800 rounded">MAPS_API_KEY</code>
            on the server.
          </p>
        </div>
      </div>
    );
  }

  // Pre-compute initial camera position + target in ECEF so the Canvas's
  // initial frame is correct (no flash of mis-oriented Earth).
  const target = latLngToECEF(CONUS_CENTER_LAT, CONUS_CENTER_LNG, 0);
  const cameraStart = latLngToECEF(CONUS_CENTER_LAT, CONUS_CENTER_LNG, 3_000_000);

  return (
    <Canvas
      camera={{
        position: cameraStart.toArray(),
        fov: 45,
        near: 1,
        far: 5e7,
      }}
      shadows={false}
      // logarithmicDepthBuffer is critical at planetary scale — without it the
      // depth buffer can't resolve pin geometry against the photorealistic
      // tiles (near=1m, far=50,000km is a ratio way past 24-bit precision).
      gl={{ logarithmicDepthBuffer: true, antialias: true }}
      onCreated={({ camera }) => {
        camera.lookAt(target);
        camera.updateProjectionMatrix();
      }}
    >
      <XR store={xrStore}>
        <color attach="background" args={["#000814"]} />
        <ambientLight intensity={1.0} />
        <directionalLight position={[1, 0.5, 0.5]} intensity={1.4} />
        <PhotorealisticMap apiKey={mapsApiKey} />
      </XR>
    </Canvas>
  );
}
