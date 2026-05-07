import { useState } from "react";
import { useApp } from "../store.js";
import { postArchetypeMatch } from "../lib/api.js";

const PROMPTS = [
  "Do you prefer endurance, explosive power, or precision?",
  "Indoors, outdoors, water, or snow?",
  "Solo focus or team chemistry?",
];

export default function Questions() {
  const biometrics = useApp((s) => s.biometrics);
  const setStep = useApp((s) => s.setStep);
  const setMatches = useApp((s) => s.setMatches);
  const setTranscript = useApp((s) => s.setTranscript);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e?.preventDefault?.();
    const transcript = PROMPTS.map((p, i) => `${p} ${answers[i]}`).join(" | ");
    setTranscript(transcript);
    setBusy(true);
    setError(null);
    try {
      const matches = await postArchetypeMatch({ biometrics, transcript });
      setMatches(matches);
      setStep("results");
    } catch (err) {
      setError(`match failed: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8" aria-labelledby="questions-heading">
      <h2 id="questions-heading" className="text-2xl font-semibold">
        A few questions
      </h2>
      <p className="text-sm text-slate-300 mt-2">
        Your answers help the agent reason across both Olympic and Paralympic archetypes.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {PROMPTS.map((p, i) => (
          <div key={i}>
            <label className="block text-sm text-slate-200 mb-1" htmlFor={`q-${i}`}>
              {p}
            </label>
            <input
              id={`q-${i}`}
              value={answers[i]}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="type a short answer"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 px-5 py-2 rounded-full bg-white text-slate-900 font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          {busy ? "Matching…" : "See my archetypes"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-300 mt-2">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
