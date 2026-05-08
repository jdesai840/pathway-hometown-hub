import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store.js";
import { postNarrate } from "../lib/api.js";

// Side panel detail for a clicked city pin. Olympic + Paralympic side-by-side,
// per-sport breakdown, era range, "How to start" links, on-demand Gemini story.
//
// NIL-compliant: aggregate counts only. NO names, NO photos.
export default function CityDetail() {
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const selectedCityKey = useApp((s) => s.selectedCityKey);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);
  const [narration, setNarration] = useState(null);
  const [loadingNarr, setLoadingNarr] = useState(false);

  useEffect(() => {
    setNarration(null);
  }, [selectedCityKey]);

  const { city, hubs } = useMemo(() => {
    if (!cityHubsDoc || !selectedCityKey) return { city: null, hubs: [] };
    const city = cityHubsDoc.cities.find(
      (c) => `${c.state}|${c.cityKey}` === selectedCityKey
    );
    if (!city) return { city: null, hubs: [] };
    const hubs = cityHubsDoc.hubs.filter(
      (h) => h.state === city.state && h.cityKey === city.cityKey
    );
    return { city, hubs };
  }, [cityHubsDoc, selectedCityKey]);

  if (!city) return null;

  const olympicHubs = hubs
    .filter((h) => h.category === "Olympic")
    .sort((a, b) => b.athleteCount - a.athleteCount);
  const paralympicHubs = hubs
    .filter((h) => h.category === "Paralympic")
    .sort((a, b) => b.athleteCount - a.athleteCount);
  const total = city.olympicAthletes + city.paralympicAthletes;
  const olyPct = total ? Math.round((city.olympicAthletes / total) * 100) : 50;

  async function loadNarration() {
    if (loadingNarr) return;
    setLoadingNarr(true);
    try {
      // Reuse the state-level narrate endpoint with the city's state for now.
      const r = await postNarrate({ state: city.state });
      setNarration(r.narration);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNarr(false);
    }
  }

  return (
    <aside
      role="complementary"
      aria-labelledby="city-detail-heading"
      className="fixed top-16 right-4 bottom-4 w-[380px] max-w-[40vw] rounded-2xl bg-slate-900/95 border border-slate-700 backdrop-blur p-5 overflow-y-auto z-30 shadow-2xl"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Hometown hub</p>
          <h2 id="city-detail-heading" className="text-2xl font-bold mt-1">
            {city.city}, {city.state}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {city.athleteCount} Team USA athletes ·{" "}
            {city.earliestYear && city.latestYear
              ? `${city.earliestYear}–${city.latestYear}`
              : "—"}
          </p>
        </div>
        <button
          onClick={() => setSelectedCityKey(null)}
          aria-label="Close city detail"
          className="text-slate-300 hover:text-white px-2 focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
        >
          ✕
        </button>
      </div>

      {/* Olympic / Paralympic parity bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-300 mb-1">
          <span className="text-olympic font-semibold">Olympic {city.olympicAthletes}</span>
          <span className="text-paralympic font-semibold">{city.paralympicAthletes} Paralympic</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
          <div className="bg-olympic" style={{ width: `${olyPct}%` }} />
          <div className="bg-paralympic" style={{ width: `${100 - olyPct}%` }} />
        </div>
      </div>

      <button
        onClick={loadNarration}
        disabled={loadingNarr}
        className="mt-4 text-sm px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        {loadingNarr ? "Narrating…" : narration ? "Refresh story" : "Hear the story"}
      </button>
      {narration && (
        <p className="mt-3 text-sm text-slate-100 leading-relaxed" aria-live="polite">
          {narration}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <CategoryColumn title="Olympic" hubs={olympicHubs} accent="olympic" />
        <CategoryColumn title="Paralympic" hubs={paralympicHubs} accent="paralympic" />
      </div>
    </aside>
  );
}

function CategoryColumn({ title, hubs, accent }) {
  const accentBorder = accent === "olympic" ? "border-olympic/50" : "border-paralympic/50";
  const accentText = accent === "olympic" ? "text-olympic" : "text-paralympic";
  return (
    <section aria-labelledby={`citycol-${accent}`} className={`rounded-xl border ${accentBorder} p-3`}>
      <p id={`citycol-${accent}`} className={`text-xs uppercase tracking-widest font-semibold ${accentText}`}>
        {title} <span className="text-slate-300">({hubs.length})</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {hubs.length === 0 && (
          <li className="text-xs text-slate-400 italic">none from this city</li>
        )}
        {hubs.slice(0, 8).map((h) => (
          <li key={h.sport}>
            {h.url ? (
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-slate-100 hover:text-white underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
              >
                {h.sport}
                <span className="text-slate-400 text-xs">
                  {" "}— {h.athleteCount}
                  {h.earliestYear && h.latestYear ? ` · ${h.earliestYear}–${h.latestYear}` : ""}
                </span>
              </a>
            ) : (
              <p className="text-sm text-slate-100">
                {h.sport} <span className="text-slate-400 text-xs">— {h.athleteCount}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
