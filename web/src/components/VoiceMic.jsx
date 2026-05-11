import { useState } from "react";
import { useApp } from "../store.js";
import { streamGeoQuery } from "../lib/streamGeoQuery.js";

// Text-only AskBar for the top-right agent dock. File kept under the
// historical "VoiceMic" name to avoid an import churn; the mic / audio path
// was removed when voice queries proved unreliable on deadline eve. The
// gradient circle + conic AI ring stays as a decorative anchor so the AskBar
// still reads as the "agent" surface.

function buildHistory(messages) {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", text: m.text };
    const obj = {};
    if (m.intent) obj.intent = m.intent;
    if (m.text) obj.narration = m.text;
    if (m.highlights) obj.highlights = m.highlights;
    if (m.facts) obj.facts = m.facts;
    return { role: "model", text: JSON.stringify(obj) };
  });
}

export default function VoiceMic() {
  const messages = useApp((s) => s.chatMessages);
  const addChatMessage = useApp((s) => s.addChatMessage);

  const startAgentStream = useApp((s) => s.startAgentStream);
  const appendToolEvent = useApp((s) => s.appendToolEvent);
  const appendNarrationToken = useApp((s) => s.appendNarrationToken);
  const completeStream = useApp((s) => s.completeStream);
  const streamError = useApp((s) => s.streamError);
  const streamActive = useApp((s) => s.agentStream.active);
  const streamDone = useApp((s) => s.agentStream.done);
  const latestToolBrief = useApp((s) => {
    const events = s.agentStream.toolEvents;
    return events.length ? events[events.length - 1].brief : null;
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [textInput, setTextInput] = useState("");

  const isStreaming = streamActive && !streamDone;

  async function submitText(e) {
    e?.preventDefault?.();
    const q = textInput.trim();
    if (!q || isStreaming) return;
    addChatMessage({ role: "user", text: q });
    setTextInput("");
    setBusy(true);
    setError(null);
    startAgentStream(q);

    try {
      const history = buildHistory(messages);
      const stream = streamGeoQuery({ question: q, history });
      for await (const ev of stream) {
        switch (ev.type) {
          case "started":
            break;
          case "tool_use":
            appendToolEvent({
              name: ev.name,
              brief: `${ev.name} · running…`,
              args: ev.args,
              status: "running",
            });
            break;
          case "tool_done":
            useApp.setState((s) => {
              const events = [...s.agentStream.toolEvents];
              for (let i = events.length - 1; i >= 0; i--) {
                if (events[i].name === ev.name && events[i].status === "running") {
                  events[i] = { ...events[i], brief: ev.brief, status: "done" };
                  break;
                }
              }
              return { agentStream: { ...s.agentStream, toolEvents: events } };
            });
            break;
          case "token":
            appendNarrationToken(ev.text);
            break;
          case "done":
            completeStream({
              intent: ev.intent,
              highlights: ev.highlights,
              facts: ev.facts,
              narration: ev.narration,
            });
            break;
          case "error":
            streamError(ev.message || "agent error");
            break;
          default:
            break;
        }
      }
    } catch (err) {
      streamError(`query failed: ${err.message}`);
      setError(`query failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-3.5 space-y-2.5">
      <form onSubmit={submitText} className="flex items-center gap-2">
        {/* Decorative AI badge — non-interactive. The conic ring spins to
            signal "agent is thinking" while a stream is in flight. */}
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className={`hh-ai-ring ${isStreaming ? "hh-ai-ring-fast" : ""}`}
          />
          <div
            className="relative z-10 inline-flex items-center justify-center w-11 h-11 rounded-full shadow-lg shadow-blue-500/30"
            style={{ background: "linear-gradient(135deg, #3b82f6, #f59e0b)" }}
            aria-hidden="true"
          >
            <span className="text-base leading-none">✦</span>
          </div>
        </div>

        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={messages.length === 0 ? "ask the agent…" : "follow-up…"}
          disabled={isStreaming}
          className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-full px-3.5 py-1.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/30 placeholder:text-slate-500 transition min-w-0 disabled:opacity-60"
          aria-label="Type your question"
        />

        <button
          type="submit"
          disabled={busy || isStreaming || !textInput.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white text-xs font-semibold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/60 transition hover:shadow-[0_0_18px_rgba(147,197,253,0.45)] shrink-0"
        >
          <span aria-hidden="true">✦</span>
          {isStreaming ? "…" : "Ask"}
        </button>
      </form>

      <p className="text-[11px] text-slate-400 leading-snug">
        {isStreaming ? (
          <span className="text-slate-200 font-mono">
            {latestToolBrief ? `● ${latestToolBrief}` : "● Thinking…"}
          </span>
        ) : (
          "Type to ask the agent. Full athlete dataset — multi-turn."
        )}
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
