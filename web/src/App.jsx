import { useEffect } from "react";
import { useApp } from "./store.js";
import { fetchHubs, fetchSportCatalog, fetchConfig } from "./lib/api.js";
import Intro from "./components/Intro.jsx";
import MapExplorer from "./components/MapExplorer.jsx";

export default function App() {
  const step = useApp((s) => s.step);
  const hubsDoc = useApp((s) => s.hubsDoc);
  const sportCatalog = useApp((s) => s.sportCatalog);
  const mapsApiKey = useApp((s) => s.mapsApiKey);
  const setHubsDoc = useApp((s) => s.setHubsDoc);
  const setSportCatalog = useApp((s) => s.setSportCatalog);
  const setMapsApiKey = useApp((s) => s.setMapsApiKey);

  useEffect(() => {
    if (!hubsDoc) fetchHubs().then(setHubsDoc).catch(console.error);
    if (!sportCatalog) fetchSportCatalog().then(setSportCatalog).catch(console.error);
    if (mapsApiKey == null) {
      fetchConfig()
        .then((c) => setMapsApiKey(c.mapsApiKey))
        .catch(console.error);
    }
  }, [hubsDoc, sportCatalog, mapsApiKey, setHubsDoc, setSportCatalog, setMapsApiKey]);

  return (
    <div className="min-h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 px-3 py-2 rounded bg-white text-slate-900 z-50"
      >
        Skip to main content
      </a>
      <header className="px-6 py-3 flex items-center justify-between border-b border-slate-800 h-14">
        <p className="font-bold tracking-tight">Hometown Hubs · Team USA</p>
        <p className="text-xs text-slate-400">Olympic &amp; Paralympic — equally · Powered by Gemini</p>
      </header>

      <div id="main">
        {step === "intro" && <Intro />}
        {step === "explore" && <MapExplorer />}
      </div>
    </div>
  );
}
