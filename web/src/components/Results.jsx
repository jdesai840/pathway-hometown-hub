import { useEffect, useState } from "react";
import { useApp } from "../store.js";
import { fetchArchetypes, postNarrate } from "../lib/api.js";

// Parity-first results card. Olympic + Paralympic are ALWAYS rendered side-by-side,
// equal size, equal narrative depth. The matching layer guarantees one of each in the top two.
export default function Results() {
  const matches = useApp((s) => s.matches);
  const archetypes = useApp((s) => s.archetypes);
  const setArchetypes = useApp((s) => s.setArchetypes);

  useEffect(() => {
    if (!archetypes) fetchArchetypes().then(setArchetypes).catch(console.error);
  }, [archetypes, setArchetypes]);

  if (!matches || !archetypes) return <div className="p-6 text-slate-400">Loading…</div>;

  const top = matches.matches?.slice(0, 2) || [];
  const olympic = top.find((m) => archetypes.find((a) => a.id === m.archetypeId)?.category === "Olympic");
  const paralympic = top.find((m) => archetypes.find((a) => a.id === m.archetypeId)?.category === "Paralympic");

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold tracking-tight text-center">Your archetypes</h2>
      <p className="text-center text-slate-400 mt-2">
        Equal depth. Equal prominence. Olympic and Paralympic, side by side.
      </p>
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <ArchetypeCard match={olympic} archetypes={archetypes} accent="olympic" />
        <ArchetypeCard match={paralympic} archetypes={archetypes} accent="paralympic" />
      </div>
    </div>
  );
}

function ArchetypeCard({ match, archetypes, accent }) {
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

  if (!archetype) {
    return (
      <div className={`rounded-2xl border border-${accent}/40 p-6 bg-slate-900/50`}>
        <p className="text-slate-400">No {accent} archetype available.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-${accent}/50 bg-slate-900/60 p-6`}>
      <div className={`text-xs uppercase tracking-widest text-${accent} font-semibold`}>
        {accent === "olympic" ? "Olympic" : "Paralympic"} archetype
      </div>
      <h3 className="text-2xl font-bold mt-2">{archetype.name}</h3>
      <p className="text-slate-300 mt-3">{archetype.summary}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {(archetype.traits || []).map((t) => (
          <span key={t} className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200">
            {t}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-4 italic">
        Why this could fit: {match.rationale}
      </p>
      <button
        onClick={loadNarration}
        disabled={busy}
        className="mt-5 text-sm px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-100 disabled:opacity-50"
      >
        {busy ? "Narrating…" : narration ? "Refresh narration" : "Hear the story"}
      </button>
      {narration && <p className="mt-4 text-slate-200 leading-relaxed">{narration}</p>}
    </div>
  );
}
