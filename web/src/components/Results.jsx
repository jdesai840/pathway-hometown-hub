import { useEffect, useState } from "react";
import { useApp, lookupSport } from "../store.js";
import { fetchArchetypes, fetchSportCatalog, postNarrate } from "../lib/api.js";
import EraTimeline from "./EraTimeline.jsx";

// Parity-first results card. Olympic + Paralympic are ALWAYS rendered side-by-side,
// equal size, equal narrative depth. The matching layer guarantees one of each in the top two.
export default function Results() {
  const matches = useApp((s) => s.matches);
  const archetypes = useApp((s) => s.archetypes);
  const sportCatalog = useApp((s) => s.sportCatalog);
  const setArchetypes = useApp((s) => s.setArchetypes);
  const setSportCatalog = useApp((s) => s.setSportCatalog);

  useEffect(() => {
    if (!archetypes) fetchArchetypes().then(setArchetypes).catch(console.error);
    if (!sportCatalog) fetchSportCatalog().then(setSportCatalog).catch(console.error);
  }, [archetypes, sportCatalog, setArchetypes, setSportCatalog]);

  if (!matches || !archetypes) return <div className="p-6 text-slate-400">Loading…</div>;

  const top = matches.matches?.slice(0, 2) || [];
  const olympic = top.find((m) => archetypes.find((a) => a.id === m.archetypeId)?.category === "Olympic");
  const paralympic = top.find((m) => archetypes.find((a) => a.id === m.archetypeId)?.category === "Paralympic");

  return (
    <main className="max-w-5xl mx-auto px-6 py-10" aria-labelledby="results-heading">
      <h2 id="results-heading" className="text-3xl font-bold tracking-tight text-center">
        Your archetypes
      </h2>
      <p className="text-center text-slate-300 mt-2">
        Equal depth. Equal prominence. Olympic and Paralympic, side by side.
      </p>
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <ArchetypeCard match={olympic} archetypes={archetypes} sportCatalog={sportCatalog} accent="olympic" />
        <ArchetypeCard match={paralympic} archetypes={archetypes} sportCatalog={sportCatalog} accent="paralympic" />
      </div>
      <p className="text-center text-slate-500 text-xs mt-6">
        Matches reflect public Team USA data aggregated to the archetype level. Outcomes may vary —
        individual paths could differ from any archetype.
      </p>
    </main>
  );
}

function ArchetypeCard({ match, archetypes, sportCatalog, accent }) {
  const [narration, setNarration] = useState(null);
  const [busy, setBusy] = useState(false);
  const archetype = match && archetypes.find((a) => a.id === match.archetypeId);

  async function loadNarration() {
    if (!archetype || busy) return;
    setBusy(true);
    try {
      const r = await postNarrate({ archetypeId: archetype.id });
      setNarration(r.narration);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const accentLabel = accent === "olympic" ? "Olympic" : "Paralympic";
  const accentBorder = accent === "olympic" ? "border-olympic/60" : "border-paralympic/60";
  const accentText = accent === "olympic" ? "text-olympic" : "text-paralympic";

  if (!archetype) {
    return (
      <section
        aria-label={`${accentLabel} archetype not available`}
        className={`rounded-2xl border ${accentBorder} p-6 bg-slate-900/50`}
      >
        <p className="text-slate-300">No {accentLabel} archetype available for this match.</p>
      </section>
    );
  }

  // Resolve era range across exemplar sports — the archetype's "120-year arc"
  const exemplarLookups = (archetype.exemplarSports || []).map((s) =>
    lookupSport(sportCatalog, s, archetype.category)
  );
  const found = exemplarLookups.filter(Boolean);
  const earliest = found.length ? Math.min(...found.map((x) => x.earliestYear).filter(Boolean)) : null;
  const latest = found.length ? Math.max(...found.map((x) => x.latestYear).filter(Boolean)) : null;

  return (
    <section
      aria-labelledby={`archetype-${archetype.id}-name`}
      className={`rounded-2xl border ${accentBorder} bg-slate-900/70 p-6 focus-within:ring-2 focus-within:ring-white/30`}
    >
      <p className={`text-xs uppercase tracking-widest ${accentText} font-semibold`}>
        {accentLabel} archetype
      </p>
      <h3 id={`archetype-${archetype.id}-name`} className="text-2xl font-bold mt-1">
        {archetype.name}
      </h3>
      <p className="text-slate-200 mt-3">{archetype.summary}</p>

      <div className="flex flex-wrap gap-2 mt-4" aria-label="Trait tags">
        {(archetype.traits || []).map((t) => (
          <span key={t} className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-100">
            {t}
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-300 mt-4 italic">
        Why this could fit: {match.rationale}
      </p>

      <EraTimeline earliestYear={earliest} latestYear={latest} accent={accent} />

      <div className="mt-5">
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          How to start
        </p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Pathway links to Team USA sport pages">
          {(archetype.exemplarSports || []).map((sportName, i) => {
            const meta = exemplarLookups[i];
            if (!meta?.url) {
              return (
                <li key={sportName}>
                  <span className="text-sm px-3 py-1 rounded-full bg-slate-800 text-slate-200">
                    {sportName}
                  </span>
                </li>
              );
            }
            return (
              <li key={sportName}>
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-white/40`}
                >
                  {sportName} ↗
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        onClick={loadNarration}
        disabled={busy}
        aria-live="polite"
        className="mt-6 text-sm px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        {busy ? "Narrating…" : narration ? "Refresh narration" : "Hear the story"}
      </button>
      {narration && (
        <p className="mt-4 text-slate-100 leading-relaxed" aria-live="polite">
          {narration}
        </p>
      )}
    </section>
  );
}
