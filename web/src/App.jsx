import { useEffect } from "react";
import { useApp } from "./store.js";
import { fetchHubs, fetchCityHubs, fetchSportCatalog, fetchConfig } from "./lib/api.js";
import Intro from "./components/Intro.jsx";
import MapExplorer from "./components/MapExplorer.jsx";

export default function App() {
  const step = useApp((s) => s.step);
  const hubsDoc = useApp((s) => s.hubsDoc);
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const sportCatalog = useApp((s) => s.sportCatalog);
  const mapsApiKey = useApp((s) => s.mapsApiKey);
  const setHubsDoc = useApp((s) => s.setHubsDoc);
  const setCityHubsDoc = useApp((s) => s.setCityHubsDoc);
  const setSportCatalog = useApp((s) => s.setSportCatalog);
  const setMapsApiKey = useApp((s) => s.setMapsApiKey);

  useEffect(() => {
    if (!hubsDoc) fetchHubs().then(setHubsDoc).catch(console.error);
    if (!cityHubsDoc) fetchCityHubs().then(setCityHubsDoc).catch(console.error);
    if (!sportCatalog) fetchSportCatalog().then(setSportCatalog).catch(console.error);
    if (mapsApiKey == null) {
      fetchConfig().then((c) => setMapsApiKey(c.mapsApiKey)).catch(console.error);
    }
  }, [hubsDoc, cityHubsDoc, sportCatalog, mapsApiKey, setHubsDoc, setCityHubsDoc, setSportCatalog, setMapsApiKey]);

  return (
    <div className="min-h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 px-3 py-2 rounded bg-white text-slate-900 z-50"
      >
        Skip to main content
      </a>
      <header className="px-5 py-3 flex items-center justify-between border-b border-slate-800/60 h-14 backdrop-blur bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-r from-olympic to-paralympic shadow-md shadow-blue-500/40"
            aria-hidden="true"
          />
          <p className="font-display font-bold tracking-tight text-slate-50">
            Pathway · Team USA
          </p>
        </div>
        <p className="hidden md:block text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
          Powered by Gemini · Google Cloud
        </p>
      </header>

      <div id="main">
        {step === "intro" && <Intro />}
        {step === "explore" && <MapExplorer />}
      </div>
    </div>
  );
}
