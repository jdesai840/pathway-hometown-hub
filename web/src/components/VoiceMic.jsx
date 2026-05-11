import { useRef, useState } from "react";
import { useApp } from "../store.js";
import { postVoiceQuery } from "../lib/api.js";
import { streamGeoQuery } from "../lib/streamGeoQuery.js";
import { AudioCapture } from "../lib/audioCapture.js";

// AskBar for the top-right agent dock — multimodal Gemini input:
// • Text input → /api/geo-query?stream=1 (SSE token streaming)
// • Hold-to-record mic → /api/voice-query (Gemini Pro multimodal audio →
//   transcribe + answer in one call; result pushed into the same
//   agentStream slice so the dock UI is shape-identical).

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

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [textInput, setTextInput] = useState("");
  const captureRef = useRef(null);

  const isStreaming = streamActive && !streamDone;

  async function startRecord() {
    if (busy || isStreaming) return;
    setError(null);
    try {
      const cap = new AudioCapture();
      await cap.start();
      captureRef.current = cap;
      setRecording(true);
    } catch (err) {
      setError(`mic unavailable: ${err.message}. Use the text fallback.`);
    }
  }

  async function stopRecord() {
    if (!captureRef.current) return;
    setRecording(false);
    setBusy(true);
    setError(null);
    try {
      const { audioBase64, mimeType } = await captureRef.current.stop();
      const history = buildHistory(messages);
      // Open the dock with a placeholder header; we'll swap in the real
      // transcript once Gemini returns it.
      startAgentStream("🎙️ transcribing…");
      const resp = await postVoiceQuery({ audioBase64, mimeType, history });
      if (resp.transcript) {
        addChatMessage({ role: "user", text: resp.transcript });
        useApp.setState((s) => ({
          agentStream: { ...s.agentStream, query: resp.transcript },
        }));
      }
      // Surface the whole narration as a single token-event so the dock
      // body renders identically to the streamed text path.
      appendNarrationToken(resp.narration || "");
      completeStream({
        intent: resp.intent || "answered",
        highlights: resp.highlights || [],
        facts: resp.facts || [],
        narration: resp.narration || "",
      });
    } catch (err) {
      streamError(`voice query failed: ${err.message}`);
      setError(`voice query failed: ${err.message}`);
    } finally {
      captureRef.current = null;
      setBusy(false);
    }
  }

  async function submitText(e) {
    e?.preventDefault?.();
    const q = textInput.trim();
    if (!q || isStreaming || recording) return;
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
        {/* Mic button (hold-to-record). Conic AI ring decorates the outside
            and speeds up while a stream is in flight. */}
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className={`hh-ai-ring ${isStreaming || recording ? "hh-ai-ring-fast" : ""}`}
          />
          <button
            type="button"
            onMouseDown={startRecord}
            onMouseUp={stopRecord}
            onTouchStart={(e) => { e.preventDefault(); startRecord(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecord(); }}
            disabled={busy || isStreaming}
            aria-label={recording ? "Recording — release to send" : "Hold to ask the agent"}
            aria-pressed={recording}
            className={`relative z-10 inline-flex items-center justify-center w-11 h-11 rounded-full shadow-lg transition focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50 ${
              recording
                ? "bg-red-500 animate-pulse shadow-red-500/40"
                : "bg-gradient-to-br from-olympic via-slate-900 to-paralympic shadow-blue-500/30"
            }`}
          >
            <span className="sr-only">
              {recording ? "Recording" : "Hold to talk"}
            </span>
            <MicIcon />
          </button>
        </div>

        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={messages.length === 0 ? "ask the agent…" : "follow-up…"}
          disabled={isStreaming || recording}
          className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-full px-3.5 py-1.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/30 placeholder:text-slate-500 transition min-w-0 disabled:opacity-60"
          aria-label="Type your question"
        />

        <button
          type="submit"
          disabled={busy || isStreaming || recording || !textInput.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-olympic to-paralympic text-white text-xs font-semibold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white/60 transition hover:shadow-[0_0_18px_rgba(147,197,253,0.45)] shrink-0"
        >
          <span aria-hidden="true">✦</span>
          {isStreaming ? "…" : "Ask"}
        </button>
      </form>

      <p className="text-[11px] text-slate-400 leading-snug">
        {recording ? (
          <span className="text-red-300 font-semibold">● Listening — release to send</span>
        ) : isStreaming ? (
          <span className="text-slate-200 font-mono">
            {latestToolBrief ? `● ${latestToolBrief}` : "● Thinking…"}
          </span>
        ) : (
          "Hold the mic, or type. Multimodal — voice or text."
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

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
