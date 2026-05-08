import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store.js";
import { postNarrate } from "../lib/api.js";
import { getClimateForState } from "../data/climate-regions.js";

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
  const climate = getClimateForState(city.state);

  async function loadNarration() {
    if (loadingNarr) return;
    setLoadingNarr(true);
    try {
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
      className="fixed top-16 right-4 bottom-4 w-[400px] max-w-[42vw] rounded-2xl glass-strong p-5 overflow-y-auto z-30 shadow-2xl animate-slide-in-right"
      key={selectedCityKey}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Hometown hub
          </p>
          <h2
            id="city-detail-heading"
            className="text-2xl font-display font-extrabold mt-1 leading-tight tracking-tight"
          >
            {city.city}
            <span className="text-slate-400 font-bold ml-1.5">{city.state}</span>
          </h2>
          <p className="text-sm text-slate-300 mt-1.5">
            <span className="num font-semibold text-slate-50">{city.athleteCount}</span>{" "}
            Team USA athletes
            {city.earliestYear && city.latestYear && (
              <>
                {" "}
                · <span className="num">{city.earliestYear}–{city.latestYear}</span>
              </>
            )}
          </p>
          {climate && (
            <div className="mt-2 inline-flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: climate.color }}
                aria-hidden="true"
              />
              <span className="text-[11px] text-slate-300 font-medium">
                {climate.name}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setSelectedCityKey(null)}
          aria-label="Close"
          className="text-slate-400 hover:text-white px-2 focus:outline-none focus:ring-2 focus:ring-white/40 rounded transition shrink-0"
        >
          ✕
        </button>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-olympic font-semibold num">Olympic {city.olympicAthletes}</span>
          <span className="text-paralympic font-semibold num">{city.paralympicAthletes} Paralympic</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-800/60">
          <div
            className="bg-gradient-to-r from-olympic-deep to-olympic transition-all"
            style={{ width: `${olyPct}%` }}
          />
          <div
            className="bg-gradient-to-r from-paralympic to-paralympic-deep transition-all"
            style={{ width: `${100 - olyPct}%` }}
          />
        </div>
      </div>

      <button
        onClick={loadNarration}
        disabled={loadingNarr}
        className="mt-4 text-sm px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/40 border border-white/10 transition"
      >
        {loadingNarr ? "Narrating…" : narration ? "Refresh story" : "Hear the story"}
      </button>
      {narration && (
        <p
          className="mt-3 text-sm text-slate-100 leading-relaxed animate-fade-in"
          aria-live="polite"
        >
          {narration}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 mt-5">
        <CategoryColumn title="Olympic" hubs={olympicHubs} accent="olympic" />
        <CategoryColumn title="Paralympic" hubs={paralympicHubs} accent="paralympic" />
      </div>
    </aside>
  );
}

function CategoryColumn({ title, hubs, accent }) {
  const accentBorder =
    accent === "olympic" ? "border-olympic/40" : "border-paralympic/40";
  const accentText =
    accent === "olympic" ? "text-olympic" : "text-paralympic";
  return (
    <section
      aria-labelledby={`citycol-${accent}`}
      className={`rounded-xl border ${accentBorder} bg-slate-950/30 p-3`}
    >
      <p
        id={`citycol-${accent}`}
        className={`text-[10px] uppercase tracking-widest font-semibold ${accentText}`}
      >
        {title} <span className="text-slate-400 num">({hubs.length})</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {hubs.length === 0 && (
          <li className="text-[11px] text-slate-500 italic">none from this city</li>
        )}
        {hubs.slice(0, 8).map((h) => (
          <li key={h.sport}>
            {h.url ? (
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[12px] text-slate-100 hover:text-white underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-white/40 rounded leading-snug transition"
              >
                {h.sport}
                <span className="text-slate-400 text-[10px] ml-1 num">
                  · {h.athleteCount}
                  {h.earliestYear && h.latestYear ? ` · ${h.earliestYear}–${h.latestYear}` : ""}
                </span>
              </a>
            ) : (
              <p className="text-[12px] text-slate-100 leading-snug">
                {h.sport}{" "}
                <span className="text-slate-400 text-[10px] num">· {h.athleteCount}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
