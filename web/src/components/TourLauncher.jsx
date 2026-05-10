import { useMemo, useState, useEffect } from "react";
import { useApp } from "../store.js";
import { postTour } from "../lib/api.js";
import { STATE_INFO } from "../data/us-states.js";

// Build a sorted list of {code, name} for the autocomplete — all 50 states +
// DC + VI live in STATE_INFO already.
const STATE_LIST = Object.entries(STATE_INFO)
  .map(([code, info]) => ({ code, name: info.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const POPULAR_STATES = ["CA", "TX", "NY", "FL", "MN", "CO"];

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

function filterStates(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const s of STATE_LIST) {
    const name = s.name.toLowerCase();
    const code = s.code.toLowerCase();
    if (name.startsWith(q) || code === q || code.startsWith(q)) {
      results.push({ ...s, score: 0 });
    } else if (name.includes(q)) {
      results.push({ ...s, score: 1 });
    }
  }
  results.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return results.slice(0, 7);
}

// Bottom-center "Start Tour" CTA + premium popout.
export default function TourLauncher() {
  const setTour = useApp((s) => s.setTour);
  const tour = useApp((s) => s.tour);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("state");

  // State tab
  const [stateQuery, setStateQuery] = useState("");
  const [stateActiveIdx, setStateActiveIdx] = useState(0);
  const stateMatches = useMemo(() => filterStates(stateQuery), [stateQuery]);

  // Sport tab
  const [sportChoice, setSportChoice] = useState("");

  // Interests tab
  const [interests, setInterests] = useState("");

  // Reset autocomplete index whenever the matches change
  useEffect(() => {
    setStateActiveIdx(0);
  }, [stateQuery]);

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

  function onStateKeyDown(e) {
    if (!stateMatches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setStateActiveIdx((i) => Math.min(stateMatches.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setStateActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = stateMatches[stateActiveIdx];
      if (pick) go({ state: pick.code });
    } else if (e.key === "Escape") {
      setStateQuery("");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open tour launcher"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 group inline-flex items-center justify-center gap-2.5 min-w-[280px] px-9 py-4 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white font-display font-bold text-lg tracking-tight shadow-[0_10px_44px_rgba(147,197,253,0.45)] hover:shadow-[0_12px_56px_rgba(147,197,253,0.65)] hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/60 transition-all duration-300"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
        <span>Start Tour</span>
        <span aria-hidden="true" className="text-xl group-hover:translate-x-0.5 transition-transform">→</span>
      </button>
    );
  }

  // Outer div owns the centering transform; inner div owns the slide-up
  // animation. Keeping them on different elements prevents the keyframe's
  // `transform` from clobbering `-translate-x-1/2` (the off-center bug).
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(560px,calc(100vw-32px))]">
    <div
      role="dialog"
      aria-label="Build your tour"
      className="relative max-h-[78vh] overflow-y-auto rounded-3xl animate-slide-up shadow-2xl"
      style={{
        background: "rgba(8, 12, 22, 0.78)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05), 0 0 60px rgba(59,130,246,0.18)",
      }}
    >
      {/* Animated gradient ring accent — subtle 8s loop. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            "linear-gradient(110deg, rgba(59,130,246,0.35), rgba(245,158,11,0.30), rgba(59,130,246,0.35))",
          backgroundSize: "200% 100%",
          padding: "1px",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          animation: "tl-shimmer 8s ease-in-out infinite",
          opacity: 0.65,
        }}
      />
      <style>{`@keyframes tl-shimmer {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }`}</style>

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2
              className="font-display font-extrabold tracking-tight text-2xl"
              style={{
                background:
                  "linear-gradient(110deg, #ffffff 0%, #93c5fd 35%, #fcd34d 75%, #ffffff 100%)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "tl-shimmer 7s ease-in-out infinite",
                letterSpacing: "-0.02em",
              }}
            >
              Build your tour
            </h2>
            <p className="text-[12px] text-slate-400 mt-1">
              Gemini narrates, the camera flies.
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-3 -mr-1 -mt-1 w-9 h-9 inline-flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="mt-5 inline-flex w-full rounded-full bg-slate-950/60 p-1 text-[12px] border border-white/5">
          <Tab active={tab === "state"} onClick={() => setTab("state")}>State</Tab>
          <Tab active={tab === "sport"} onClick={() => setTab("sport")}>Sport</Tab>
          <Tab active={tab === "custom"} onClick={() => setTab("custom")}>Interests</Tab>
        </div>

        {/* Tab content — replaced by the loading view while Gemini generates. */}
        <div className="mt-5">
          {busy ? <PopoutLoading /> : (
          <>
          {tab === "state" && (
            <div className="space-y-4">
              <div className="relative">
                <input
                  value={stateQuery}
                  onChange={(e) => setStateQuery(e.target.value)}
                  onKeyDown={onStateKeyDown}
                  placeholder="Search states — e.g. Minnesota, CA, Texas…"
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-4 py-3 text-[14px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500"
                  aria-autocomplete="list"
                  aria-controls="tl-state-list"
                />
                {stateMatches.length > 0 && (
                  <ul
                    id="tl-state-list"
                    role="listbox"
                    className="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden z-10"
                    style={{
                      background: "rgba(8, 12, 22, 0.92)",
                      backdropFilter: "blur(20px) saturate(160%)",
                      WebkitBackdropFilter: "blur(20px) saturate(160%)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
                    }}
                  >
                    {stateMatches.map((s, i) => (
                      <li
                        key={s.code}
                        role="option"
                        aria-selected={i === stateActiveIdx}
                      >
                        <button
                          onMouseEnter={() => setStateActiveIdx(i)}
                          onClick={() => go({ state: s.code })}
                          disabled={busy}
                          className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition ${
                            i === stateActiveIdx
                              ? "bg-white/10 text-white"
                              : "text-slate-100 hover:bg-white/5"
                          } disabled:opacity-50`}
                        >
                          <span className="text-[14px]">{s.name}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                            {s.code}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-2">
                  Popular
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_STATES.map((code) => (
                    <button
                      key={code}
                      onClick={() => go({ state: code })}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-full text-[12px] text-slate-100 border border-white/10 hover:border-white/30 hover:bg-white/5 disabled:opacity-50 transition"
                    >
                      {STATE_INFO[code]?.name || code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "sport" && (
            <div className="space-y-3">
              <p className="text-[12px] text-slate-400">Pick a sport to tour:</p>
              <div className="grid grid-cols-2 gap-2">
                {SPORT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => go({ sport: s })}
                    disabled={busy}
                    className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[13px] text-slate-100 border border-white/10 hover:border-white/25 disabled:opacity-50 transition text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                value={sportChoice}
                onChange={(e) => setSportChoice(e.target.value)}
                placeholder="…or type any sport"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500"
              />
              <button
                disabled={!sportChoice.trim() || busy}
                onClick={() => go({ sport: sportChoice.trim() })}
                className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_28px_rgba(147,197,253,0.35)] hover:shadow-[0_10px_36px_rgba(147,197,253,0.55)] transition"
              >
                Build {sportChoice.trim() || "—"} tour
              </button>
            </div>
          )}

          {tab === "custom" && (
            <div className="space-y-3">
              <p className="text-[12px] text-slate-400">
                Tell the agent what interests you:
              </p>
              <textarea
                rows={5}
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g. winter sports in mountain towns, or Paralympic athletes from the Northeast"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500 resize-none leading-relaxed"
              />
              <button
                disabled={!interests.trim() || busy}
                onClick={() => go({ interests: interests.trim() })}
                className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_28px_rgba(147,197,253,0.35)] hover:shadow-[0_10px_36px_rgba(147,197,253,0.55)] transition"
              >
                Build my tour
              </button>
            </div>
          )}
          </>
          )}
        </div>

        {/* Error row — busy state is handled by <PopoutLoading /> above. */}
        {error && (
          <p role="alert" className="mt-4 text-[12px] text-red-300 text-center">
            {error}
          </p>
        )}
      </div>
    </div>
    </div>
  );
}

// In-popout loading view — shown while Gemini generates a tour. Strictly
// scoped to the popout's z-30 footprint with NO transform animations
// anywhere (no animate-spin, no rotating SVGs) so the photorealistic 3D
// Tiles cinematic stacking context / WebGL render cycle is never disturbed.
// State cadence uses setInterval (~5fps for progress, every 4.5s for facts)
// instead of an RAF loop, dramatically reducing React re-render pressure.
const TEAM_USA_FACTS = [
  "Team USA has won more Olympic gold medals than any other nation.",
  "Park City, Utah has produced over 200 Winter Olympians and Paralympians.",
  "Wheelchair basketball was invented at U.S. veterans' hospitals in 1944.",
  "Colorado Springs is home to the U.S. Olympic & Paralympic Training Center.",
  "Curling joined the Olympic program in 1998 — the U.S. struck gold in 2018.",
  "Snowboarding made its Olympic debut at Nagano 1998.",
  "Track & field is the most-medaled sport in U.S. Olympic history.",
  "The Paralympic Games trace back to a 1948 wheelchair archery contest in Stoke Mandeville, England.",
];

function PopoutLoading() {
  // Random starting index so each tour shows a different first fact.
  const [factIdx, setFactIdx] = useState(() =>
    Math.floor(Math.random() * TEAM_USA_FACTS.length)
  );
  const [progress, setProgress] = useState(0);

  // Progress bar — asymptotic ease-out toward 0.95, polled at ~5fps. Plenty
  // smooth thanks to the CSS transition-all duration-200, and far gentler
  // on React than a 60Hz RAF loop.
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => {
      const elapsed = (performance.now() - t0) / 1000;
      setProgress(Math.min(0.95, 1 - Math.exp(-elapsed / 6)));
    }, 200);
    return () => clearInterval(id);
  }, []);

  // Rotate facts every 4.5s so each one stays on screen long enough to read.
  useEffect(() => {
    const id = setInterval(() => {
      setFactIdx((i) => (i + 1) % TEAM_USA_FACTS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-center py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-semibold">
        Generating with Gemini
      </p>

      {/* Min-height reserved so the popout doesn't jump as fact length varies.
          Keyed remount + opacity-only animate-fade-in for the rotation. */}
      <div className="mt-5 min-h-[3.5rem] flex items-center justify-center">
        <p
          key={factIdx}
          className="text-[14px] md:text-[15px] text-slate-100 leading-relaxed max-w-[460px] animate-fade-in"
        >
          {TEAM_USA_FACTS[factIdx]}
        </p>
      </div>

      <div className="mt-5 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background:
              "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(245,158,11,0.9))",
            boxShadow: "0 0 12px rgba(147,197,253,0.45)",
            transition: "width 220ms ease-out",
          }}
        />
      </div>

      <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
        Powered by Gemini · Cloud TTS
      </p>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-full text-center font-semibold transition ${
        active
          ? "bg-slate-50 text-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
          : "text-slate-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
