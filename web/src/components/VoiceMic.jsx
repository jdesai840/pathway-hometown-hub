import { useState, useRef } from "react";
import { useApp } from "../store.js";
import { postVoiceQuery, postGeoQuery } from "../lib/api.js";
import { AudioCapture } from "../lib/audioCapture.js";

// Push-to-talk mic for the geo agent. Records audio, posts to /api/voice-query
// (which is multimodal Gemini). Falls back to a text input if the user prefers.

export default function VoiceMic() {
  const applyAgentResponse = useApp((s) => s.applyAgentResponse);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [showText, setShowText] = useState(false);
  const captureRef = useRef(null);

  async function startRecord() {
    setError(null);
    try {
      const cap = new AudioCapture();
      await cap.start();
      captureRef.current = cap;
      setRecording(true);
    } catch (err) {
      setError(`mic unavailable: ${err.message}. Use the text fallback below.`);
      setShowText(true);
    }
  }

  async function stopRecord() {
    if (!captureRef.current) return;
    setRecording(false);
    setBusy(true);
    try {
      const { audioBase64, mimeType } = await captureRef.current.stop();
      const resp = await postVoiceQuery({ audioBase64, mimeType });
      applyAgentResponse(resp);
    } catch (err) {
      setError(`voice query failed: ${err.message}`);
    } finally {
      captureRef.current = null;
      setBusy(false);
    }
  }

  async function submitText(e) {
    e?.preventDefault?.();
    if (!textInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await postGeoQuery({ question: textInput.trim() });
      applyAgentResponse(resp);
    } catch (err) {
      setError(`query failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4">
      <div className="flex items-center gap-3">
        <button
          onMouseDown={startRecord}
          onMouseUp={stopRecord}
          onTouchStart={startRecord}
          onTouchEnd={stopRecord}
          disabled={busy}
          aria-label={recording ? "Recording — release to send" : "Hold to ask the agent"}
          aria-pressed={recording}
          className={`relative inline-flex items-center justify-center w-14 h-14 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50 ${
            recording
              ? "bg-red-500 animate-pulse"
              : "bg-gradient-to-br from-olympic to-paralympic"
          }`}
        >
          <span className="sr-only">{recording ? "Recording" : "Hold to talk"}</span>
          <MicIcon />
        </button>
        <div className="flex-1">
          <p className="text-sm text-slate-100 font-medium">
            {recording ? "Listening — release to send" : busy ? "Thinking…" : "Hold to ask the agent"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Try: <em>"Where does Team USA curling come from?"</em> or <em>"Show me a surprising hub."</em>
          </p>
        </div>
        <button
          onClick={() => setShowText(!showText)}
          aria-label="Toggle text input"
          className="text-xs px-3 py-2 rounded-full bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          Type
        </button>
      </div>
      {showText && (
        <form onSubmit={submitText} className="mt-3 flex gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="ask about a sport, state, or hub…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Type your question for the agent"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded bg-white text-slate-900 font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            Ask
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-red-300 mt-2">{error}</p>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
