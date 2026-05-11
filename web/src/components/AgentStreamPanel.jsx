import { useEffect, useRef } from "react";
import { useApp } from "../store.js";
import VoiceMic from "./VoiceMic.jsx";

// Top-right "agent dock". Always present in Map Explorer mode — the AskBar
// lives at the top of this panel. Stream content (header, activity, narration,
// highlights, facts) only renders below the AskBar while a stream is active
// or has just completed. Closing the stream collapses everything except the
// AskBar.
//
// z-40 keeps the dock above the z-30 detail panels (HubDetail, CityDetail);
// when a detail is open, the dock visually sits in front of it. Acceptable
// for now — both surfaces are dismissable.
export default function AgentStreamPanel() {
  const stream = useApp((s) => s.agentStream);
  const closeStream = useApp((s) => s.closeStream);
  const rehighlight = useApp((s) => s.rehighlight);
  const setSelectedState = useApp((s) => s.setSelectedState);
  const messages = useApp((s) => s.chatMessages);
  const collapsed = useApp((s) => s.agentDockCollapsed);
  const toggleDockCollapsed = useApp((s) => s.toggleDockCollapsed);
  const setDockCollapsed = useApp((s) => s.setDockCollapsed);
  const selectedState = useApp((s) => s.selectedState);
  const selectedCityKey = useApp((s) => s.selectedCityKey);

  // Auto-collapse the dock when the user clicks into a state/city detail so
  // the CityDetail/HubDetail panel below is fully visible. Re-expand stays
  // intentional — user clicks the chevron, or starts a new stream.
  useEffect(() => {
    if (selectedState || selectedCityKey) setDockCollapsed(true);
  }, [selectedState, selectedCityKey, setDockCollapsed]);

  // Auto-scroll narration as tokens arrive.
  const bodyRef = useRef(null);
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [stream.narration, stream.toolEvents.length]);

  const recentQs = messages
    .filter((m) => m.role === "user")
    .slice(stream.active ? -4 : -3, stream.active ? -1 : undefined)
    .reverse();

  // Only show the collapse chevron when there's something hidden by it.
  const hasCollapsibleContent = stream.active || recentQs.length > 0;

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
      aria-label="Agent dock"
    >
      {/* AskBar — always visible. */}
      <VoiceMic />

      {/* Collapse/expand handle — full-width strip that reads as a drawer
          handle. Sits between the AskBar and the stream content. Only
          rendered when there IS something to hide. */}
      {hasCollapsibleContent && (
        <button
          type="button"
          onClick={toggleDockCollapsed}
          aria-label={collapsed ? "Expand agent response" : "Collapse agent response"}
          aria-expanded={!collapsed}
          className="w-full border-t border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-slate-200 hover:text-slate-50 text-[11px] font-semibold tracking-wide px-4 py-2 flex items-center justify-center gap-2 transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/40"
        >
          <span aria-hidden="true" className="text-sm leading-none">
            {collapsed ? "▸" : "▾"}
          </span>
          <span>{collapsed ? "Show response" : "Hide response"}</span>
        </button>
      )}

      {stream.active && !collapsed && (
        <>
          <div className="border-t border-white/10" />

          {/* Header (when a stream is in flight or completed) */}
          <div className="px-4 py-3 flex items-start gap-3 border-b border-white/10">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30"
              style={{ background: "linear-gradient(135deg, #3b82f6, #f59e0b)" }}
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
              aria-label="Close agent response"
              className="text-slate-400 hover:text-slate-100 text-xl leading-none px-1 -mt-1 transition"
            >
              ×
            </button>
          </div>

          {/* Activity log */}
          {stream.toolEvents.length > 0 && (
            <div className="px-4 py-2 border-b border-white/10 space-y-1 max-h-[24vh] overflow-y-auto">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
                Activity
              </div>
              {stream.toolEvents.map((e, i) => (
                <div key={i} className="text-[11px] flex items-center gap-2 animate-slide-up">
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
            style={{ minHeight: "80px", maxHeight: "32vh" }}
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

          {stream.error && (
            <div className="px-4 py-2 border-t border-red-500/30 text-xs text-red-300">
              ⚠ {stream.error}
            </div>
          )}
        </>
      )}

      {/* Recent Qs replay row — shown when there's any history, regardless of
          whether a stream is in flight. Hidden when the dock is collapsed. */}
      {recentQs.length > 0 && !collapsed && (
        <div className="px-4 py-2 border-t border-white/10 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mr-1 self-center">
            Recent:
          </span>
          {recentQs.map((m) => (
            <span
              key={m.id}
              title={m.text}
              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/70 text-slate-300 border border-slate-700/40 max-w-[200px] truncate"
            >
              {m.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
