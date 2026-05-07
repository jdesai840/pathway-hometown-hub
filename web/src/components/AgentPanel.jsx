import { useApp } from "../store.js";

// Surface the agent's last response: transcript (if voice), narration, supporting facts.
export default function AgentPanel() {
  const intent = useApp((s) => s.intent);
  const narration = useApp((s) => s.agentNarration);
  const facts = useApp((s) => s.agentFacts);
  const transcript = useApp((s) => s.agentTranscript);

  if (!narration && !transcript) return null;

  return (
    <div
      role="region"
      aria-label="Agent response"
      aria-live="polite"
      className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4"
    >
      {transcript && (
        <p className="text-xs text-slate-400 italic mb-2">"{transcript}"</p>
      )}
      {narration && <p className="text-sm text-slate-100 leading-relaxed">{narration}</p>}
      {facts && facts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {facts.slice(0, 6).map((f, i) => (
            <li key={i} className="text-xs text-slate-300">
              • {f}
            </li>
          ))}
        </ul>
      )}
      {intent && (
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-3">{intent}</p>
      )}
    </div>
  );
}
