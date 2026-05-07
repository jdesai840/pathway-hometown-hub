import { useEffect } from "react";
import { useApp } from "./store.js";
import { fetchArchetypes } from "./lib/api.js";
import Intro from "./components/Intro.jsx";
import Capture from "./components/Capture.jsx";
import Questions from "./components/Questions.jsx";
import Results from "./components/Results.jsx";
import SpatialScene from "./components/SpatialScene.jsx";
import EnterSpatialButton from "./components/EnterSpatialButton.jsx";

export default function App() {
  const step = useApp((s) => s.step);
  const setArchetypes = useApp((s) => s.setArchetypes);
  const archetypes = useApp((s) => s.archetypes);
  const matches = useApp((s) => s.matches);

  useEffect(() => {
    if (!archetypes) fetchArchetypes().then(setArchetypes).catch(console.error);
  }, [archetypes, setArchetypes]);

  return (
    <div className="min-h-full">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="font-bold tracking-tight">Find Your Archetype</div>
        <div className="text-xs text-slate-500">Olympic & Paralympic — equally</div>
      </header>

      {step === "intro" && <Intro />}
      {step === "capture" && <Capture />}
      {step === "questions" && <Questions />}
      {step === "results" && (
        <>
          <Results />
          {matches && (
            <div className="h-[60vh] mt-2">
              <SpatialScene />
            </div>
          )}
          <EnterSpatialButton />
        </>
      )}
    </div>
  );
}
