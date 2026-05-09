import { useEffect, useRef, useState } from "react";
import { useApp } from "../store.js";
import IntroMap from "./IntroMap.jsx";

export default function Intro() {
  const setStep = useApp((s) => s.setStep);
  const hubsDoc = useApp((s) => s.hubsDoc);
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const [igniting, setIgniting] = useState(false);

  const totalAthletes = hubsDoc?.totals.athleteCount;
  const olympic = hubsDoc?.totals.byCategory.Olympic.athleteCount;
  const paralympic = hubsDoc?.totals.byCategory.Paralympic.athleteCount;
  const cityCount = cityHubsDoc?.cities.length;
  const yearRange = hubsDoc?.reference?.allTimeRange;

  function handleBegin() {
    if (igniting) return;
    setIgniting(true);
    // Coordinated transition: dots flash + hero fades, then we route.
    setTimeout(() => setStep("explore"), 720);
  }

  return (
    <main
      className="relative w-full overflow-hidden"
      style={{ minHeight: "calc(100vh - 3.5rem)" }}
      aria-labelledby="intro-heading"
    >
      {/* Ambient gradient halo */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.55) 0%, rgba(245,158,11,0.30) 50%, transparent 75%)",
          }}
        />
      </div>

      {/* Animated hometown-pin canvas */}
      <IntroMap igniting={igniting} />

      {/* Radial ignite flash */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          igniting ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, rgba(59,130,246,0.18) 30%, transparent 65%)",
        }}
      />

      {/* Hero content */}
      <div
        className={`relative max-w-5xl mx-auto px-6 py-16 md:py-24 text-center transition-all duration-500 ${
          igniting
            ? "opacity-0 -translate-y-5"
            : "opacity-100 translate-y-0"
        }`}
      >
        <p className="uppercase tracking-[0.22em] text-[11px] text-slate-300 font-semibold animate-fade-in">
          Powered by Gemini · Built on Google Cloud · Road to LA28
        </p>

        {/* Brand wordmark */}
        <h1
          id="intro-heading"
          className="mt-5 font-display font-extrabold tracking-tight leading-[0.95] animate-slide-up"
          style={{
            fontSize: "clamp(72px, 12vw, 168px)",
            letterSpacing: "-0.04em",
            background:
              "linear-gradient(110deg, #ffffff 0%, #93c5fd 28%, #ffffff 50%, #fcd34d 72%, #ffffff 100%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animation:
              "fadeIn 600ms ease-out forwards, hh-shimmer 7s ease-in-out infinite",
          }}
        >
          Pathway
        </h1>

        <style>{`@keyframes hh-shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }`}</style>

        <p
          className="mt-3 text-2xl md:text-3xl font-display font-semibold text-slate-100 tracking-tight animate-slide-up"
          style={{ animationDelay: "60ms" }}
        >
          Where Team USA grows up.
        </p>

        <p
          className="mt-6 text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed animate-slide-up"
          style={{ animationDelay: "120ms" }}
        >
          Every Olympic and Paralympic athlete's hometown — equal prominence,
          every era. Ask the AI agent where any sport finds its hubs on the
          road to LA28.
        </p>

        {hubsDoc && cityHubsDoc && (
          <div
            className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto animate-slide-up"
            style={{ animationDelay: "180ms" }}
          >
            <Stat label="Athletes" target={totalAthletes} />
            <Stat label="Olympic" target={olympic} accent="olympic" />
            <Stat label="Paralympic" target={paralympic} accent="paralympic" />
            <Stat label="Cities" target={cityCount} />
          </div>
        )}

        <button
          onClick={handleBegin}
          disabled={igniting}
          className="group mt-12 relative inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-white/60 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_44px_rgba(147,197,253,0.5)] shadow-[0_0_28px_rgba(147,197,253,0.25)] animate-slide-up"
          style={{ animationDelay: "220ms" }}
        >
          <span className="relative z-10">Begin the journey</span>
          <span aria-hidden="true" className="relative z-10 text-lg group-hover:translate-x-0.5 transition-transform">→</span>
          {/* Glow ring */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.6) inset, 0 0 36px rgba(147,197,253,0.45)",
            }}
          />
        </button>

        {yearRange && (
          <p
            className="mt-6 text-[11px] text-slate-500 animate-fade-in"
            style={{ animationDelay: "300ms" }}
          >
            {yearRange[0]}–{yearRange[1]} · Olympic and Paralympic data given equal prominence ·
            No athlete names or photos
          </p>
        )}
      </div>
    </main>
  );
}

// Animated number counter — counts from 0 to target over ~1.6s ease-out
function Stat({ label, target, accent }) {
  const [shown, setShown] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (target == null) return;
    let raf = 0;
    const t0 = performance.now();
    startRef.current = t0;
    const dur = 1600;
    function tick(now) {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const accentCls =
    accent === "olympic"
      ? "text-olympic"
      : accent === "paralympic"
      ? "text-paralympic"
      : "text-slate-50";

  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{
        background: "rgba(8, 12, 22, 0.55)",
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
      }}
    >
      <div
        className={`text-3xl md:text-4xl font-display font-extrabold num ${accentCls}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {target == null ? "—" : shown.toLocaleString()}
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1.5 font-semibold">
        {label}
      </div>
    </div>
  );
}
