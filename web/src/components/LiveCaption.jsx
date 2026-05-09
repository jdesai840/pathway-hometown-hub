import { useEffect, useMemo, useState } from "react";

// Big elegant caption overlay during cinematic. Mounted for the entire tour
// so the audio listener stays stable; visibility is controlled via opacity
// (not conditional return) so we don't drop listeners on phase transitions.
export default function LiveCaption({ audioRef, narration, visible }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    function onTime() {
      const dur = audio.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      setProgress(Math.min(1, audio.currentTime / dur));
    }
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
    };
  }, [audioRef]);

  useEffect(() => {
    setProgress(0);
  }, [narration]);

  const sentences = useMemo(() => splitSentences(narration || ""), [narration]);
  const totalChars = sentences.reduce((n, s) => n + s.length, 0) || 1;

  let activeIdx = 0;
  let acc = 0;
  for (let i = 0; i < sentences.length; i++) {
    acc += sentences[i].length;
    if (progress * totalChars <= acc + 1) {
      activeIdx = i;
      break;
    }
    activeIdx = i;
  }

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-[110px] z-[60] flex justify-center px-8 transition-opacity duration-500 ${
        visible && sentences.length > 0 ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="max-w-4xl w-full text-center relative">
        {/* Soft gradient backdrop for legibility against varied terrain */}
        <div
          aria-hidden="true"
          className="absolute -inset-x-12 -inset-y-10"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(11,18,32,0.85) 0%, rgba(11,18,32,0.5) 40%, rgba(11,18,32,0) 80%)",
            filter: "blur(10px)",
            zIndex: -1,
          }}
        />
        {sentences.map((s, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          return (
            <span
              key={i}
              className={`block transition-all duration-500 ${
                isActive
                  ? "text-white opacity-100"
                  : isPast
                  ? "text-slate-300 opacity-50"
                  : "text-slate-400 opacity-30"
              } font-display font-bold tracking-tight leading-snug`}
              style={{
                fontSize: isActive
                  ? "clamp(22px, 2.8vw, 36px)"
                  : "clamp(15px, 1.7vw, 22px)",
                textShadow: isActive
                  ? "0 2px 18px rgba(0,0,0,0.95), 0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(245,158,11,0.18)"
                  : "0 1px 8px rgba(0,0,0,0.85)",
                marginTop: i === 0 ? 0 : "0.4em",
                transform: isActive ? "scale(1)" : "scale(0.97)",
              }}
            >
              {s}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function splitSentences(text) {
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text];
}
