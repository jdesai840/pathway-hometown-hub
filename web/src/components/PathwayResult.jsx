import { useApp } from "../store.js";

// Full-screen modal that renders the Pathway plan result.
export default function PathwayResult() {
  const result = useApp((s) => s.pathway.result);
  const closePathwayResult = useApp((s) => s.closePathwayResult);

  if (!result) return null;

  const {
    userLocation,
    nearbyHubs = [],
    recommendedSports = [],
    paralympicCounterpart,
    facilities = [],
    narration,
    disclaimer,
    citations = [],
  } = result;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-8 animate-fade-in"
      style={{ background: "rgba(2, 6, 14, 0.86)", backdropFilter: "blur(10px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pathway-result-heading"
    >
      <div
        className="relative max-w-3xl mx-auto rounded-2xl p-7 animate-slide-up"
        style={{
          background: "rgba(8, 12, 22, 0.92)",
          backdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <button
          type="button"
          onClick={closePathwayResult}
          aria-label="Close pathway result"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-100 text-2xl leading-none px-2"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30"
            style={{ background: "linear-gradient(135deg, #3b82f6, #f59e0b)" }}
          >
            <span className="text-xl leading-none">✦</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
              Your local pathway
            </div>
            <h2
              id="pathway-result-heading"
              className="font-display text-2xl font-extrabold tracking-tight text-slate-50"
            >
              {userLocation?.city}, {userLocation?.state}
            </h2>
          </div>
        </div>

        {/* Narration */}
        {narration && (
          <p className="text-base text-slate-100 leading-relaxed mb-5">
            {narration}
          </p>
        )}

        {/* Nearby hubs strip */}
        {nearbyHubs.length > 0 && (
          <Section title="Hubs within 150 miles">
            <div className="flex flex-wrap gap-1.5">
              {nearbyHubs.slice(0, 8).map((h, i) => (
                <span
                  key={`${h.city}|${h.state}|${i}`}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/70 text-slate-200 border border-slate-700/40"
                >
                  {h.city}, {h.state}{" "}
                  <span className="text-slate-400">
                    · {h.athleteCount} ({h.olympic}/{h.paralympic})
                  </span>
                  {h.distMi > 0 && (
                    <span className="text-slate-500"> · {h.distMi}mi</span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Format: City, ST · total athletes (Olympic/Paralympic) · distance
            </p>
          </Section>
        )}

        {/* Recommended sports */}
        {recommendedSports.length > 0 && (
          <Section title="Sports your area produces">
            <div className="grid sm:grid-cols-2 gap-2.5">
              {recommendedSports.map((s, i) => (
                <SportCard key={i} sport={s} />
              ))}
            </div>
          </Section>
        )}

        {/* Paralympic counterpart */}
        {paralympicCounterpart && (
          <Section title="Paralympic counterpart">
            <SportCard sport={paralympicCounterpart} paralympic />
          </Section>
        )}

        {/* Facilities */}
        {facilities.length > 0 && (
          <Section title="Where to start">
            <ul className="space-y-2">
              {facilities.map((f, i) => (
                <FacilityRow key={i} facility={f} />
              ))}
            </ul>
          </Section>
        )}

        {/* Citations */}
        {citations.length > 0 && (
          <Section title="Sources (Google Search grounding)">
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c, i) => (
                <a
                  key={i}
                  href={c.uri || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 max-w-[280px] truncate transition"
                  title={c.uri || c.title || ""}
                >
                  {c.title || hostname(c.uri)}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Disclaimer */}
        {disclaimer && (
          <p className="mt-5 pt-4 border-t border-white/10 text-[11px] text-slate-400 italic leading-snug">
            {disclaimer}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SportCard({ sport, paralympic }) {
  const isPara =
    paralympic ||
    sport.category === "Paralympic" ||
    (sport.sport || "").toLowerCase().startsWith("para ") ||
    (sport.sport || "").toLowerCase().startsWith("wheelchair ");
  return (
    <div
      className="rounded-xl p-3 border"
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        borderColor: isPara
          ? "rgba(245, 158, 11, 0.35)"
          : "rgba(59, 130, 246, 0.35)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h4
          className={`font-semibold text-sm ${isPara ? "text-paralympic" : "text-olympic"}`}
        >
          {sport.sport}
        </h4>
        <span className="text-[9px] uppercase tracking-wider text-slate-500">
          {sport.category || (isPara ? "Paralympic" : "Olympic")}
        </span>
      </div>
      {sport.why && (
        <p className="text-xs text-slate-300 leading-snug">{sport.why}</p>
      )}
      {Array.isArray(sport.nearbyHubs) && sport.nearbyHubs.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sport.nearbyHubs.map((h, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/70 text-slate-400 border border-slate-700/40"
            >
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FacilityRow({ facility }) {
  const isCategory = facility.type === "Category";
  return (
    <li
      className="rounded-xl p-3 border flex items-start gap-3"
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <span className="text-xs">
          {isCategory ? "·" : facility.type === "Training Center" ? "★" : facility.type === "University Program" ? "U" : "◯"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="font-semibold text-sm text-slate-50 leading-snug">
            {facility.url ? (
              <a
                href={facility.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {facility.name}
              </a>
            ) : (
              facility.name
            )}
          </h4>
          <span className="text-[9px] uppercase tracking-wider text-slate-500 shrink-0">
            {facility.type}
          </span>
        </div>
        {facility.city && (
          <p className="text-[11px] text-slate-400 mt-0.5">{facility.city}</p>
        )}
        {facility.note && (
          <p className="text-xs text-slate-300 mt-1 leading-snug">
            {facility.note}
          </p>
        )}
      </div>
    </li>
  );
}

function hostname(uri) {
  if (!uri) return "source";
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
