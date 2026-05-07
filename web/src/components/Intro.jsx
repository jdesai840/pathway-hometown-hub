import { useApp } from "../store.js";

export default function Intro() {
  const setStep = useApp((s) => s.setStep);
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-center" aria-labelledby="intro-heading">
      <h1 id="intro-heading" className="text-4xl md:text-6xl font-bold tracking-tight">
        Find Your <span className="text-olympic">Olympic</span> &{" "}
        <span className="text-paralympic">Paralympic</span> Archetypes
      </h1>
      <p className="mt-6 text-lg text-slate-200">
        Discover the Team USA athlete archetypes you align with — Olympic and Paralympic, side
        by side, equally. Powered by Gemini reasoning over 120 years of public placement data.
      </p>
      <button
        onClick={() => setStep("capture")}
        className="mt-10 inline-flex items-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/60 transition"
        aria-label="Start finding your archetypes"
      >
        Start
      </button>
      <p className="mt-4 text-xs text-slate-400">
        Webcam is processed entirely on your device. No images leave your browser.
      </p>
    </main>
  );
}
