import { useState } from "react";
import { useApp } from "../store.js";

// Mode-selection screen — sits between the hero and MapExplorer. The Earth
// backdrop (Intro3DMap) and outer chrome are owned by App.jsx, so they
// persist across the intro → choose transition without remounting.
export default function ModeChoice() {
  const setStep = useApp((s) => s.setStep);
  const setViewMode = useApp((s) => s.setViewMode);
  const [exiting, setExiting] = useState(false);

  function pick(mode) {
    if (exiting) return;
    setViewMode(mode);
    setExiting(true);
    setTimeout(() => setStep("explore"), 480);
  }

  return (
    <div
      className={`relative max-w-6xl mx-auto px-6 py-16 md:py-24 text-center transition-all duration-500 ${
        exiting ? "opacity-0 -translate-y-3" : "opacity-100 translate-y-0"
      }`}
    >
      <p className="uppercase tracking-[0.22em] text-[11px] text-slate-300 font-semibold animate-fade-in">
        Pathway · Team USA
      </p>

      <h2
        className="mt-6 font-display font-extrabold text-slate-50 tracking-tight animate-slide-up"
        style={{
          fontSize: "clamp(36px, 5vw, 60px)",
          letterSpacing: "-0.02em",
        }}
      >
        How will you explore?
      </h2>

      <p
        className="mt-4 text-base md:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed animate-slide-up drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]"
        style={{ animationDelay: "60ms" }}
      >
        Choose a guided cinematic tour or free-explore Team USA's hometowns on the live map.
      </p>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        <ModeCard
          glyph="🎬"
          eyebrow="AI-guided"
          title="Interactive Tour"
          body="Pick a state, sport, city, or ask anything. Gemini narrates, the camera flies."
          cta="Begin tour"
          delayMs={120}
          onClick={() => pick("tour")}
          accentFrom="rgba(147,197,253,0.55)"
          accentTo="rgba(147,197,253,0.0)"
        />
        <ModeCard
          glyph="🗺"
          eyebrow="Free explore"
          title="Map Explorer"
          body="Browse every athlete's hometown. Filter by sport, click any city, ask the agent."
          cta="Open map"
          delayMs={220}
          onClick={() => pick("explore")}
          accentFrom="rgba(252,211,77,0.45)"
          accentTo="rgba(252,211,77,0.0)"
        />
      </div>
    </div>
  );
}

function ModeCard({
  glyph,
  eyebrow,
  title,
  body,
  cta,
  delayMs,
  onClick,
  accentFrom,
  accentTo,
}) {
  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl px-7 py-7 border border-white/10 hover:border-white/30 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/40 transition-all duration-300 animate-slide-up overflow-hidden"
      style={{
        animationDelay: `${delayMs}ms`,
        background: "rgba(8, 12, 22, 0.55)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
      }}
    >
      {/* Hover accent glow */}
      <span
        aria-hidden="true"
        className="absolute -top-20 -left-20 w-[260px] h-[260px] rounded-full opacity-0 group-hover:opacity-80 transition-opacity duration-500 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accentFrom}, ${accentTo})` }}
      />

      <div className="relative">
        <span className="text-3xl select-none" aria-hidden="true">
          {glyph}
        </span>
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
          {eyebrow}
        </p>
        <h3
          className="mt-1.5 font-display font-extrabold text-slate-50 tracking-tight"
          style={{ fontSize: "clamp(24px, 3vw, 32px)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h3>
        <p className="mt-3 text-sm md:text-[15px] text-slate-300 leading-relaxed">
          {body}
        </p>
        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-50">
          {cta}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </button>
  );
}
