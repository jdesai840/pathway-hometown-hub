import { useState } from "react";
import { useApp } from "../store.js";
import { postTour } from "../lib/api.js";

const STATE_OPTIONS = [
  ["CA", "California"],
  ["NY", "New York"],
  ["TX", "Texas"],
  ["FL", "Florida"],
  ["MN", "Minnesota"],
  ["CO", "Colorado"],
  ["MA", "Massachusetts"],
  ["IL", "Illinois"],
  ["UT", "Utah"],
  ["WA", "Washington"],
];
const SPORT_OPTIONS = [
  "Curling",
  "Track and Field",
  "Wheelchair Basketball",
  "Snowboarding",
  "Ice Hockey",
  "Para Track and Field",
  "Sled Hockey",
  "Swimming",
];

// Top-right floating "AI Tour" button + slide-out panel.
export default function TourLauncher() {
  const setTour = useApp((s) => s.setTour);
  const tour = useApp((s) => s.tour);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("state");
  const [stateChoice, setStateChoice] = useState("");
  const [sportChoice, setSportChoice] = useState("");
  const [interests, setInterests] = useState("");

  if (tour) return null;

  async function go(payload) {
    setBusy(true);
    setError(null);
    try {
      const t = await postTour(payload);
      if (!t || !t.stops?.length) throw new Error("empty tour");
      setTour(t);
      setOpen(false);
    } catch (err) {
      setError(`tour failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI tour launcher"
        className="absolute top-4 right-4 z-30 inline-flex items-center gap-2 rounded-full px-4 py-2.5 bg-gradient-to-r from-olympic to-paralympic text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 focus:outline-none focus:ring-2 focus:ring-white/60 transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
        AI Tour
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-30 w-[320px] glass-strong rounded-2xl p-4 animate-slide-in-right shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display font-bold text-slate-50 tracking-tight">AI Tour</p>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-white px-1 rounded"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-slate-300 mb-3 leading-relaxed">
        Gemini generates 4–6 stops, the map glides between them, and a Cloud
        TTS voice narrates the story.
      </p>

      <div className="inline-flex rounded-full bg-slate-950/60 p-0.5 mb-3 text-[11px] border border-slate-700/40">
        <Tab active={tab === "state"} onClick={() => setTab("state")}>
          State
        </Tab>
        <Tab active={tab === "sport"} onClick={() => setTab("sport")}>
          Sport
        </Tab>
        <Tab active={tab === "custom"} onClick={() => setTab("custom")}>
          Interests
        </Tab>
      </div>

      {tab === "state" && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Pick a state to tour:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {STATE_OPTIONS.map(([code, name]) => (
              <button
                key={code}
                onClick={() => go({ state: code })}
                disabled={busy}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 text-[12px] text-slate-100 border border-slate-700/40 disabled:opacity-50 transition"
              >
                {name}
              </button>
            ))}
          </div>
          <input
            value={stateChoice}
            onChange={(e) => setStateChoice(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="…or 2-letter code"
            className="w-full bg-slate-950/60 border border-slate-700/60 rounded-full px-3 py-1.5 text-[12px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500"
          />
          <button
            disabled={!stateChoice || busy}
            onClick={() => go({ state: stateChoice })}
            className="w-full px-3 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold disabled:opacity-50 transition"
          >
            Tour {stateChoice || "—"}
          </button>
        </div>
      )}

      {tab === "sport" && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Pick a sport to tour:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {SPORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => go({ sport: s })}
                disabled={busy}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 text-[12px] text-slate-100 border border-slate-700/40 disabled:opacity-50 transition text-left"
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={sportChoice}
            onChange={(e) => setSportChoice(e.target.value)}
            placeholder="…or any sport"
            className="w-full bg-slate-950/60 border border-slate-700/60 rounded-full px-3 py-1.5 text-[12px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500"
          />
          <button
            disabled={!sportChoice || busy}
            onClick={() => go({ sport: sportChoice })}
            className="w-full px-3 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold disabled:opacity-50 transition"
          >
            Tour {sportChoice || "—"}
          </button>
        </div>
      )}

      {tab === "custom" && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">Tell the agent what interests you:</p>
          <textarea
            rows={3}
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g. winter sports in mountain towns, or Paralympic athletes from the Northeast"
            className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[12px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500 resize-none"
          />
          <button
            disabled={!interests.trim() || busy}
            onClick={() => go({ interests: interests.trim() })}
            className="w-full px-3 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold disabled:opacity-50 transition"
          >
            Build my tour
          </button>
        </div>
      )}

      {busy && (
        <p className="text-[11px] text-slate-300 mt-3 italic">
          Generating tour with Gemini…
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-red-300 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-2.5 py-1 rounded-full transition text-center font-medium ${
        active ? "bg-slate-50 text-slate-900" : "text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
