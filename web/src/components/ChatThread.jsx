import { useEffect, useRef } from "react";
import { useApp } from "../store.js";

// Conversation thread with the geo agent. Renders user + agent messages
// chronologically. Clicking an agent message re-applies its highlights to the
// map so users can revisit prior queries visually.
export default function ChatThread() {
  const messages = useApp((s) => s.chatMessages);
  const rehighlight = useApp((s) => s.rehighlight);
  const clearChat = useApp((s) => s.clearChat);
  const scrollerRef = useRef(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 text-xs text-slate-400">
        Try: <em>"Where does Team USA wrestling come from?"</em> · <em>"Show me a surprising hub."</em> · Continue the conversation with follow-ups.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col max-h-[42vh]">
      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-300 font-semibold">
          Conversation
        </p>
        <button
          onClick={clearChat}
          aria-label="Clear conversation"
          className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          Clear
        </button>
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite">
        {messages.map((m) => (
          <Message key={m.id} m={m} onRehighlight={() => m.highlights && rehighlight(m.highlights)} />
        ))}
      </div>
    </div>
  );
}

function Message({ m, onRehighlight }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-700 text-slate-50 text-sm px-3 py-2">
          {m.transcript ? <em className="opacity-80">"{m.transcript}"</em> : m.text}
        </div>
      </div>
    );
  }
  // agent
  const interactive = Array.isArray(m.highlights) && m.highlights.length > 0;
  return (
    <div className="flex justify-start">
      <button
        onClick={interactive ? onRehighlight : undefined}
        className={`text-left max-w-[90%] rounded-2xl rounded-bl-md bg-slate-800/80 border border-slate-700 text-slate-100 text-sm px-3 py-2 space-y-2 ${
          interactive ? "hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer" : ""
        }`}
      >
        {m.transcript && (
          <p className="text-[11px] text-slate-400 italic">heard: "{m.transcript}"</p>
        )}
        {m.text && <p className="leading-relaxed">{m.text}</p>}
        {Array.isArray(m.facts) && m.facts.length > 0 && (
          <ul className="space-y-0.5 pt-1">
            {m.facts.slice(0, 5).map((f, i) => (
              <li key={i} className="text-xs text-slate-300">
                • {f}
              </li>
            ))}
          </ul>
        )}
        {Array.isArray(m.highlights) && m.highlights.length > 0 && (
          <p className="text-[10px] uppercase tracking-widest text-slate-400 pt-1">
            States: {m.highlights.join(", ")} · click to re-highlight
          </p>
        )}
      </button>
    </div>
  );
}
