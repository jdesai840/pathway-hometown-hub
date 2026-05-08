import { useEffect, useRef } from "react";
import { useApp } from "../store.js";

// Conversation thread with the geo agent. Glass-morphism, animated.
// Click a past agent message to re-apply its highlights to the map.
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
      <div className="glass rounded-2xl p-3 text-[11px] text-slate-300 leading-relaxed">
        <span className="text-slate-400">Try </span>
        <em className="text-slate-100">"Where does Team USA wrestling come from?"</em>
        <span className="text-slate-400"> · </span>
        <em className="text-slate-100">"Show me a surprising hub."</em>
        <br />
        <span className="text-slate-500">Follow-ups carry context.</span>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col max-h-[40vh]">
      <div className="px-3.5 py-2 border-b border-slate-700/40 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">
          Conversation
        </p>
        <button
          onClick={clearChat}
          aria-label="Clear conversation"
          className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-100 px-2 py-0.5 rounded focus:outline-none focus:ring-2 focus:ring-white/40 transition"
        >
          Clear
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5"
        aria-live="polite"
      >
        {messages.map((m) => (
          <Message
            key={m.id}
            m={m}
            onRehighlight={() => m.highlights && rehighlight(m.highlights)}
          />
        ))}
      </div>
    </div>
  );
}

function Message({ m, onRehighlight }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-slate-700/80 text-slate-50 text-sm px-3 py-2 shadow-sm">
          {m.transcript ? <em className="opacity-80">"{m.transcript}"</em> : m.text}
        </div>
      </div>
    );
  }
  const interactive = Array.isArray(m.highlights) && m.highlights.length > 0;
  return (
    <div className="flex justify-start animate-slide-up">
      <button
        onClick={interactive ? onRehighlight : undefined}
        className={`text-left max-w-[92%] rounded-2xl rounded-bl-md bg-slate-800/70 border border-slate-700/60 text-slate-100 text-sm px-3 py-2 space-y-1.5 transition ${
          interactive
            ? "hover:bg-slate-800 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            : ""
        }`}
      >
        {m.transcript && (
          <p className="text-[10px] text-slate-400 italic">heard: "{m.transcript}"</p>
        )}
        {m.text && <p className="leading-relaxed">{m.text}</p>}
        {Array.isArray(m.facts) && m.facts.length > 0 && (
          <ul className="space-y-0.5 pt-0.5">
            {m.facts.slice(0, 5).map((f, i) => (
              <li key={i} className="text-[11px] text-slate-300">
                <span className="text-slate-500">·</span> {f}
              </li>
            ))}
          </ul>
        )}
        {interactive && (
          <p className="text-[10px] uppercase tracking-widest text-slate-500 pt-0.5">
            {m.highlights.join(" · ")} <span className="text-slate-600">· tap to re-highlight</span>
          </p>
        )}
      </button>
    </div>
  );
}
