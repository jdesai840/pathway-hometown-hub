import { useState, useRef } from "react";
import { useApp } from "../store.js";
import { postVoiceQuery, postGeoQuery } from "../lib/api.js";
import { AudioCapture } from "../lib/audioCapture.js";

export default function VoiceMic() {
  const messages = useApp((s) => s.chatMessages);
  const addChatMessage = useApp((s) => s.addChatMessage);
  const rehighlight = useApp((s) => s.rehighlight);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [textInput, setTextInput] = useState("");
  const captureRef = useRef(null);

  function buildHistory() {
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

  function pushAgentResponse(resp) {
    rehighlight(resp.highlights || []);
    addChatMessage({
      role: "model",
      text: resp.narration || "",
      intent: resp.intent || null,
      highlights: resp.highlights || [],
      facts: resp.facts || [],
      transcript: resp.transcript || null,
    });
  }

  async function startRecord() {
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
    try {
      const { audioBase64, mimeType } = await captureRef.current.stop();
      addChatMessage({ role: "user", text: "🎙️ (transcribing…)" });
      const history = buildHistory();
      const resp = await postVoiceQuery({ audioBase64, mimeType, history });
      pushAgentResponse(resp);
    } catch (err) {
      setError(`voice query failed: ${err.message}`);
    } finally {
      captureRef.current = null;
      setBusy(false);
    }
  }

  async function submitText(e) {
    e?.preventDefault?.();
    const q = textInput.trim();
    if (!q) return;
    addChatMessage({ role: "user", text: q });
    setTextInput("");
    setBusy(true);
    setError(null);
    try {
      const history = buildHistory();
      const resp = await postGeoQuery({ question: q, history });
      pushAgentResponse(resp);
    } catch (err) {
      setError(`query failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-3.5 space-y-2.5 animate-slide-up">
      <div className="flex items-center gap-2.5">
        <button
          onMouseDown={startRecord}
          onMouseUp={stopRecord}
          onTouchStart={startRecord}
          onTouchEnd={stopRecord}
          disabled={busy}
          aria-label={recording ? "Recording — release to send" : "Hold to ask the agent"}
          aria-pressed={recording}
          className={`relative inline-flex items-center justify-center w-11 h-11 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50 shrink-0 ${
            recording
              ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/40"
              : "bg-gradient-to-br from-olympic to-paralympic shadow-lg shadow-blue-500/30"
          }`}
        >
          <span className="sr-only">{recording ? "Recording" : "Hold to talk"}</span>
          <MicIcon />
        </button>
        <form onSubmit={submitText} className="flex-1 flex items-center gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={messages.length === 0 ? "ask the agent…" : "follow-up…"}
            className="flex-1 bg-slate-950/60 border border-slate-700/60 rounded-full px-3.5 py-1.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40 placeholder:text-slate-500 transition"
            aria-label="Type your question"
          />
          <button
            type="submit"
            disabled={busy || !textInput.trim()}
            className="px-3.5 py-1.5 rounded-full bg-white text-slate-900 text-sm font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/60 transition hover:bg-slate-100"
          >
            {busy ? "…" : "Ask"}
          </button>
        </form>
      </div>
      <p className="text-[11px] text-slate-400 leading-snug">
        {recording ? (
          <span className="text-red-300 font-semibold">● Listening — release to send</span>
        ) : busy ? (
          <span className="text-slate-200">Thinking…</span>
        ) : (
          "Hold the mic, or type. Multi-turn — agent remembers context."
        )}
      </p>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
