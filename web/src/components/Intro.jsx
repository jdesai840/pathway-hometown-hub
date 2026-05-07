import { useApp } from "../store.js";

export default function Intro() {
  const setStep = useApp((s) => s.setStep);
  const hubsDoc = useApp((s) => s.hubsDoc);
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-center" aria-labelledby="intro-heading">
      <p className="uppercase tracking-widest text-xs text-slate-400 font-semibold">
        Powered by Gemini · Built on Google Cloud · Road to LA28
      </p>
      <h1 id="intro-heading" className="mt-3 text-4xl md:text-6xl font-bold tracking-tight">
        See where <span className="text-olympic">Olympic</span> &{" "}
        <span className="text-paralympic">Paralympic</span> Team USA grows.
      </h1>
      <p className="mt-6 text-lg text-slate-200">
        A 3D map of the United States with every Team USA athlete's hometown — Olympic and
        Paralympic, equal prominence, since 1900. Ask the agent where wrestling, sled hockey, or
        any sport finds its hubs. Surface the small-state stories that punch above their weight
        on the road to LA28.
      </p>
      {hubsDoc && (
        <p className="mt-4 text-sm text-slate-400">
          {hubsDoc.totals.athleteCount.toLocaleString()} athletes · {hubsDoc.hubs.length} hubs ·{" "}
          {hubsDoc.reference.allTimeRange[0]}–{hubsDoc.reference.allTimeRange[1]}
        </p>
      )}
      <button
        onClick={() => setStep("explore")}
        className="mt-10 inline-flex items-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/60 transition"
      >
        Open the map
      </button>
    </main>
  );
}
