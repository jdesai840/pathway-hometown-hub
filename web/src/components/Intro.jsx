import { useApp } from "../store.js";

export default function Intro() {
  const setStep = useApp((s) => s.setStep);
  const hubsDoc = useApp((s) => s.hubsDoc);
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);

  const totalAthletes = hubsDoc?.totals.athleteCount;
  const olympic = hubsDoc?.totals.byCategory.Olympic.athleteCount;
  const paralympic = hubsDoc?.totals.byCategory.Paralympic.athleteCount;
  const cityCount = cityHubsDoc?.cities.length;
  const yearRange = hubsDoc?.reference?.allTimeRange;

  return (
    <main
      className="relative max-w-5xl mx-auto px-6 py-16 md:py-24 text-center"
      aria-labelledby="intro-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.55) 0%, rgba(245,158,11,0.35) 50%, transparent 75%)",
          }}
        />
      </div>

      <p className="uppercase tracking-[0.18em] text-[11px] text-slate-400 font-semibold animate-fade-in">
        Powered by Gemini · Built on Google Cloud · Road to LA28
      </p>

      <h1
        id="intro-heading"
        className="mt-4 text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-[1.05] animate-slide-up"
      >
        See where{" "}
        <span className="bg-gradient-to-r from-olympic via-olympic-soft to-paralympic-soft bg-clip-text text-transparent">
          Team USA
        </span>
        <br />
        grows up.
      </h1>

      <p
        className="mt-7 text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed animate-slide-up"
        style={{ animationDelay: "60ms" }}
      >
        A live map of every Team USA Olympic and Paralympic athlete's hometown — equal prominence,
        every era. Ask the AI agent where any sport finds its hubs. Surface the small-state stories
        that punch above their weight on the road to LA28.
      </p>

      {hubsDoc && cityHubsDoc && (
        <div
          className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto animate-slide-up"
          style={{ animationDelay: "120ms" }}
        >
          <Stat label="Athletes" value={totalAthletes?.toLocaleString()} />
          <Stat label="Olympic" value={olympic?.toLocaleString()} accent="olympic" />
          <Stat label="Paralympic" value={paralympic?.toLocaleString()} accent="paralympic" />
          <Stat label="Cities" value={cityCount?.toLocaleString()} />
        </div>
      )}

      <button
        onClick={() => setStep("explore")}
        className="mt-12 inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/60 transition shadow-lg shadow-blue-500/10 animate-slide-up"
        style={{ animationDelay: "160ms" }}
      >
        Open the map
        <span aria-hidden="true">→</span>
      </button>

      {yearRange && (
        <p
          className="mt-6 text-xs text-slate-500 animate-fade-in"
          style={{ animationDelay: "240ms" }}
        >
          {yearRange[0]}–{yearRange[1]} · Olympic and Paralympic data given equal prominence ·
          No athlete names or photos
        </p>
      )}
    </main>
  );
}

function Stat({ label, value, accent }) {
  const accentCls =
    accent === "olympic"
      ? "text-olympic"
      : accent === "paralympic"
      ? "text-paralympic"
      : "text-slate-50";
  return (
    <div className="glass rounded-2xl p-4">
      <div className={`text-2xl md:text-3xl font-display font-extrabold num ${accentCls}`}>
        {value || "—"}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1 font-semibold">
        {label}
      </div>
    </div>
  );
}
