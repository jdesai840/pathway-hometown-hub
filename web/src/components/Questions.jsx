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

  async function submit() {
    const transcript = PROMPTS.map((p, i) => `${p} ${answers[i]}`).join(" | ");
    setTranscript(transcript);
    setBusy(true);
    try {
      const matches = await postArchetypeMatch({ biometrics, transcript });
      setMatches(matches);
      setStep("results");
    } catch (err) {
      alert(`match failed: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-semibold">A few questions</h2>
      <div className="mt-6 space-y-4">
        {PROMPTS.map((p, i) => (
          <div key={i}>
            <label className="block text-sm text-slate-300 mb-1">{p}</label>
            <input
              value={answers[i]}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"
              placeholder="type a short answer"
            />
          </div>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={submit}
        className="mt-8 px-5 py-2 rounded-full bg-white text-slate-900 font-semibold disabled:opacity-50"
      >
        {busy ? "Matching…" : "See my archetypes"}
      </button>
    </div>
  );
}
