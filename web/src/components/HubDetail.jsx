import { useEffect, useMemo, useState } from "react";
import { useApp, hubsForState } from "../store.js";
import { STATE_INFO } from "../data/us-states.js";
import { postNarrate } from "../lib/api.js";

// Side panel detailing a selected state. Olympic + Paralympic side-by-side.
export default function HubDetail() {
  const selectedState = useApp((s) => s.selectedState);
  const hubsDoc = useApp((s) => s.hubsDoc);
  const setSelectedState = useApp((s) => s.setSelectedState);
  const sportFilter = useApp((s) => s.sportFilter);
  const [narration, setNarration] = useState(null);
  const [loadingNarr, setLoadingNarr] = useState(false);

  useEffect(() => {
    setNarration(null);
  }, [selectedState]);

  const totals = useMemo(
    () => (selectedState && hubsDoc ? hubsDoc.stateTotals[selectedState] : null),
    [selectedState, hubsDoc]
  );
  const olympic = useMemo(
    () => hubsForState(hubsDoc, selectedState, { categoryFilter: "Olympic", sportFilter }),
    [hubsDoc, selectedState, sportFilter]
  );
  const paralympic = useMemo(
    () => hubsForState(hubsDoc, selectedState, { categoryFilter: "Paralympic", sportFilter }),
    [hubsDoc, selectedState, sportFilter]
  );

  if (!selectedState || !totals) return null;
  const info = STATE_INFO[selectedState];

  async function loadNarration() {
    if (loadingNarr) return;
    setLoadingNarr(true);
    try {
      const r = await postNarrate({ state: selectedState });
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
      aria-labelledby="hub-detail-heading"
      className="fixed top-56 right-4 bottom-4 w-[440px] max-w-[42vw] rounded-2xl bg-slate-900/95 border border-slate-700 backdrop-blur p-5 overflow-y-auto z-30 shadow-2xl"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Hub</p>
          <h2 id="hub-detail-heading" className="text-2xl font-bold mt-1">
            {info?.name || selectedState}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {totals.athleteCount} Team USA athletes ({totals.byCategory.Olympic} Olympic,{" "}
            {totals.byCategory.Paralympic} Paralympic)
          </p>
        </div>
        <button
          onClick={() => setSelectedState(null)}
          aria-label="Close hub detail"
          className="text-slate-300 hover:text-white px-2 focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
        >
          ✕
        </button>
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
        <CategoryColumn title="Olympic" hubs={olympic} accent="olympic" />
        <CategoryColumn title="Paralympic" hubs={paralympic} accent="paralympic" />
      </div>
    </aside>
  );
}

function CategoryColumn({ title, hubs, accent }) {
  const accentBorder = accent === "olympic" ? "border-olympic/50" : "border-paralympic/50";
  const accentText = accent === "olympic" ? "text-olympic" : "text-paralympic";
  return (
    <section aria-labelledby={`col-${accent}`} className={`rounded-xl border ${accentBorder} p-3`}>
      <p id={`col-${accent}`} className={`text-xs uppercase tracking-widest font-semibold ${accentText}`}>
        {title} <span className="text-slate-300">({hubs.length})</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {hubs.length === 0 && (
          <li className="text-xs text-slate-400 italic">No data for current filter.</li>
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
                  {" "}— {h.athleteCount} athletes
                  {h.earliestYear && h.latestYear ? ` (${h.earliestYear}–${h.latestYear})` : ""}
                </span>
              </a>
            ) : (
              <p className="text-sm text-slate-100">
                {h.sport}{" "}
                <span className="text-slate-400 text-xs">— {h.athleteCount} athletes</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
