import { useEffect, useState } from "react";
import { useApp } from "../store.js";
import { postPathway } from "../lib/api.js";

const LOADING_STAGES = [
  "📍 Locating your hometown…",
  "🗺  Scanning Team USA hubs within 150 miles…",
  "🏛  Mapping your local Olympic & Paralympic pipeline…",
  "🏊 Cross-referencing the nearby sport hubs…",
  "✦ Asking Gemini to ground recommendations in Google Search…",
  "🏗  Verifying facilities and university programs…",
  "🎯 Pairing each sport with a real local facility…",
  "🪶 Composing your pathway…",
];

// Modal launcher for the Pathway feature. City + state + category → calls
// /api/pathway, results land in store.pathway.result and PathwayResult
// takes over the screen.
export default function PathwayLauncher() {
  const open = useApp((s) => s.pathway.launcherOpen);
  const loading = useApp((s) => s.pathway.loading);
  const error = useApp((s) => s.pathway.error);
  const closeLauncher = useApp((s) => s.closePathwayLauncher);
  const startPathway = useApp((s) => s.startPathway);
  const completePathway = useApp((s) => s.completePathway);
  const pathwayError = useApp((s) => s.pathwayError);

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("Both");
  const [stageIndex, setStageIndex] = useState(0);

  const cityOk = city.trim().length >= 2;
  const stateOk = /^[A-Za-z]{2}$/.test(state.trim());
  const canSubmit = cityOk && stateOk && !loading;

  // Cycle through loading stages every 1.8s while the request is in flight.
  useEffect(() => {
    if (!loading) {
      setStageIndex(0);
      return;
    }
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 2800);
    return () => clearInterval(id);
  }, [loading]);

  if (!open) return null;

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;
    startPathway();
    try {
      const result = await postPathway({
        city: city.trim(),
        state: state.trim(),
        category,
      });
      if (result?.error) {
        pathwayError(result.error);
        return;
      }
      completePathway(result);
    } catch (err) {
      pathwayError(err.message || "Pathway request failed");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      style={{ background: "rgba(2, 6, 14, 0.78)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pathway-launcher-heading"
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 animate-slide-up"
        style={{
          background: "rgba(8, 12, 22, 0.92)",
          backdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <button
          type="button"
          onClick={closeLauncher}
          aria-label="Close"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-100 text-xl leading-none px-2"
        >
          ×
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30"
            style={{ background: "linear-gradient(135deg, #3b82f6, #f59e0b)" }}
          >
            <span className="text-lg leading-none">✦</span>
          </div>
          <div>
            <h2
              id="pathway-launcher-heading"
              className="font-display text-xl font-extrabold tracking-tight text-slate-50"
            >
              Find your pathway
            </h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
              Hometown → hub plan
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Enter your hometown. We&apos;ll surface the Team USA hubs within 150
          miles, the sports your area produces, and real local facilities or
          programs you could explore.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. Cleveland)"
              disabled={loading}
              className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-full px-3.5 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500 disabled:opacity-60"
              aria-label="City"
              autoFocus
            />
            <input
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="ST"
              maxLength={2}
              disabled={loading}
              className="w-16 bg-slate-950/60 border border-slate-700/60 rounded-full px-3 py-2 text-sm text-slate-50 text-center uppercase focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500 disabled:opacity-60"
              aria-label="State (2 letters)"
            />
          </div>

          <fieldset aria-label="Category preference">
            <div className="inline-flex rounded-full bg-slate-950/60 p-0.5 text-[11px] border border-slate-700/40 w-full">
              <CatBtn active={category === "Both"} onClick={() => setCategory("Both")}>
                Both
              </CatBtn>
              <CatBtn
                active={category === "Olympic"}
                onClick={() => setCategory("Olympic")}
                accent="olympic"
              >
                Olympic
              </CatBtn>
              <CatBtn
                active={category === "Paralympic"}
                onClick={() => setCategory("Paralympic")}
                accent="paralympic"
              >
                Paralympic
              </CatBtn>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white text-sm font-semibold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/60 transition hover:shadow-[0_0_24px_rgba(147,197,253,0.45)]"
          >
            <span aria-hidden="true">✦</span>
            {loading ? "Finding your pathway…" : "Show my pathway"}
          </button>

          {/* Validation hint OR loading stage — single status slot. */}
          <div className="min-h-[18px] text-center">
            {loading ? (
              <p
                key={stageIndex}
                className="text-[11px] text-slate-200 font-mono animate-fade-in"
              >
                {LOADING_STAGES[stageIndex]}
              </p>
            ) : !cityOk || !stateOk ? (
              <p className="text-[10px] text-slate-500 italic">
                Enter a city and a 2-letter state code (e.g. OH, CA, MN).
              </p>
            ) : null}
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-300 leading-snug">
              {error}
            </p>
          )}
        </form>

        <p className="mt-4 text-[10px] text-slate-500 leading-snug italic">
          Recommendations are AI-generated starting points grounded in Google
          Search. Verify details directly with each program.
        </p>
      </div>
    </div>
  );
}

function CatBtn({ active, onClick, children, accent }) {
  const accentCls =
    accent === "olympic"
      ? active
        ? "bg-olympic text-white"
        : "text-olympic"
      : accent === "paralympic"
      ? active
        ? "bg-paralympic text-white"
        : "text-paralympic"
      : active
      ? "bg-slate-50 text-slate-900"
      : "text-slate-300";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 px-3 py-1 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/40 font-medium ${accentCls}`}
    >
      {children}
    </button>
  );
}
