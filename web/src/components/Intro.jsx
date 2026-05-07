import { useApp } from "../store.js";

export default function Intro() {
  const setStep = useApp((s) => s.setStep);
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
        Find Your <span className="text-olympic">Olympic</span> &{" "}
        <span className="text-paralympic">Paralympic</span> Archetypes
      </h1>
      <p className="mt-6 text-lg text-slate-300">
        Discover the Team USA athlete archetypes you align with — Olympic and Paralympic, side by side, equally.
        Powered by Gemini reasoning over 120 years of public placement data.
      </p>
      <button
        onClick={() => setStep("capture")}
        className="mt-10 inline-flex items-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200 transition"
      >
        Start
      </button>
      <p className="mt-4 text-xs text-slate-500">
        Webcam is processed entirely on your device. No images leave your browser.
      </p>
    </div>
  );
}
