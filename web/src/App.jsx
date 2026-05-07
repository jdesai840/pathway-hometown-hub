import { useEffect } from "react";
import { useApp } from "./store.js";
import { fetchArchetypes, fetchSportCatalog } from "./lib/api.js";
import Intro from "./components/Intro.jsx";
import Capture from "./components/Capture.jsx";
import Questions from "./components/Questions.jsx";
import Results from "./components/Results.jsx";
import SpatialScene from "./components/SpatialScene.jsx";
import EnterSpatialButton from "./components/EnterSpatialButton.jsx";

export default function App() {
  const step = useApp((s) => s.step);
  const setArchetypes = useApp((s) => s.setArchetypes);
  const setSportCatalog = useApp((s) => s.setSportCatalog);
  const archetypes = useApp((s) => s.archetypes);
  const sportCatalog = useApp((s) => s.sportCatalog);
  const matches = useApp((s) => s.matches);

  useEffect(() => {
    if (!archetypes) fetchArchetypes().then(setArchetypes).catch(console.error);
    if (!sportCatalog) fetchSportCatalog().then(setSportCatalog).catch(console.error);
  }, [archetypes, sportCatalog, setArchetypes, setSportCatalog]);

  return (
    <div className="min-h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 px-3 py-2 rounded bg-white text-slate-900 z-50"
      >
        Skip to main content
      </a>
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <p className="font-bold tracking-tight">Find Your Archetype</p>
        <p className="text-xs text-slate-400">Olympic &amp; Paralympic — equally</p>
      </header>

      <div id="main">
        {step === "intro" && <Intro />}
        {step === "capture" && <Capture />}
        {step === "questions" && <Questions />}
        {step === "results" && (
          <>
            <Results />
            {matches && (
              <div className="h-[60vh] mt-2" aria-label="3D archetype scene">
                <SpatialScene />
              </div>
            )}
            <EnterSpatialButton />
          </>
        )}
      </div>
    </div>
  );
}
