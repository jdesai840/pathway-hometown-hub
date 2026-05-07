import { useEffect, useState } from "react";
import { xrStore } from "./SpatialScene.jsx";

export default function EnterSpatialButton() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!navigator.xr) return;
    navigator.xr.isSessionSupported("immersive-ar").then(setSupported).catch(() => setSupported(false));
  }, []);

  if (!supported) return null;

  return (
    <button
      onClick={() => xrStore.enterAR()}
      className="fixed bottom-6 right-6 z-20 px-5 py-3 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white font-semibold shadow-lg"
    >
      Enter Spatial Mode
    </button>
  );
}
