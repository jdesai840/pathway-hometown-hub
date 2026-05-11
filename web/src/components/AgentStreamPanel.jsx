import { useEffect, useRef } from "react";
import { useApp } from "../store.js";

// Top-right floating "agent console". Renders the in-flight or completed
// streaming agent response. Mounted by MapExplorer only when in explore mode.
export default function AgentStreamPanel() {
  const stream = useApp((s) => s.agentStream);
  const closeStream = useApp((s) => s.closeStream);
  const rehighlight = useApp((s) => s.rehighlight);
  const setSelectedState = useApp((s) => s.setSelectedState);
  const messages = useApp((s) => s.chatMessages);

  // Auto-scroll narration as tokens arrive.
  const bodyRef = useRef(null);
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [stream.narration, stream.toolEvents.length]);

  if (!stream.active) return null;

  const recentQs = messages
    .filter((m) => m.role === "user")
    .slice(-4, -1) // last 3 prior to the current
    .reverse();

  return (
    <div
      className="fixed top-16 right-4 w-[440px] max-w-[42vw] z-40 rounded-2xl overflow-hidden animate-slide-in-right flex flex-col"
      style={{
        maxHeight: "calc(100vh - 6rem)",
        background: "rgba(8, 12, 22, 0.78)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
      }}
      role="region"
      aria-label="Agent response"
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3 border-b border-white/10">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #f59e0b)",
          }}
        >
          <span className="text-sm leading-none">✦</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
            Agent · {stream.done ? "answered" : "live"}
          </div>
          <div className="text-sm text-slate-50 leading-snug mt-0.5 break-words">
            {stream.query}
          </div>
        </div>
        <button
          onClick={closeStream}
          aria-label="Close agent panel"
          className="text-slate-400 hover:text-slate-100 text-xl leading-none px-1 -mt-1 transition"
        >
          ×
        </button>
      </div>

      {/* Activity log */}
      {stream.toolEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-white/10 space-y-1 max-h-[28vh] overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
            Activity
          </div>
          {stream.toolEvents.map((e, i) => (
            <div
              key={i}
              className="text-[11px] flex items-center gap-2 animate-slide-up"
            >
              <span
                className={
                  e.status === "running"
                    ? "text-amber-400 animate-pulse"
                    : "text-emerald-400"
                }
              >
                {e.status === "running" ? "◐" : "●"}
              </span>
              <span className="font-mono text-slate-300 truncate">{e.brief}</span>
            </div>
          ))}
        </div>
      )}

      {/* Streaming narration */}
      <div
        ref={bodyRef}
        className="px-4 py-3 overflow-y-auto flex-1"
        style={{ minHeight: "80px" }}
      >
        {stream.narration ? (
          <p className="text-sm text-slate-50 leading-relaxed whitespace-pre-wrap">
            {stream.narration}
            {!stream.done && <span className="hh-caret" />}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">
            {stream.toolEvents.length > 0
              ? "Composing your answer…"
              : "Waiting on the agent…"}
            <span className="hh-caret" />
          </p>
        )}
      </div>

      {/* Highlights chips */}
      {stream.highlights.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mr-1 self-center">
            Map:
          </span>
          {stream.highlights.map((s) => (
            <button
              key={s}
              onClick={() => {
                rehighlight([s]);
                setSelectedState(s);
              }}
              className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-50 border border-white/15 transition focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label={`Re-highlight ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Facts bullets */}
      {stream.facts.length > 0 && (
        <ul className="px-4 py-2 border-t border-white/10 space-y-1">
          {stream.facts.map((f, i) => (
            <li key={i} className="text-[11px] text-slate-300 leading-snug flex gap-2">
              <span className="text-slate-500 shrink-0">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Recent Qs replay row */}
      {recentQs.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mr-1 self-center">
            Recent:
          </span>
          {recentQs.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                // Surface the recent message back into the input by dispatching
                // a custom event the SportFilter / VoiceMic can listen for in
                // a future iteration. For now, no-op click that reads as a chip.
              }}
              title={m.text}
              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/70 text-slate-300 border border-slate-700/40 max-w-[200px] truncate hover:border-slate-500 transition"
            >
              {m.text}
            </button>
          ))}
        </div>
      )}

      {stream.error && (
        <div className="px-4 py-2 border-t border-red-500/30 text-xs text-red-300">
          ⚠ {stream.error}
        </div>
      )}
    </div>
  );
}
