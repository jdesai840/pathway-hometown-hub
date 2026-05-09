import { useEffect, useMemo, useState } from "react";

// Big, elegant real-time caption overlay. As the audio plays, the active
// sentence fades in and grows slightly while previous sentences fade back.
// Linear-by-character interpolation against audio.currentTime / duration.
//
// Renders only while a tour is playing AND the cinematic is up. Sits in front
// of the photorealistic flyover.

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

  // Reset progress when narration changes (new stop)
  useEffect(() => {
    setProgress(0);
  }, [narration]);

  const sentences = useMemo(() => splitSentences(narration || ""), [narration]);
  const totalChars = sentences.reduce((n, s) => n + s.length, 0) || 1;

  // Compute current sentence index by linear-by-character interpolation
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

  if (!visible || sentences.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[150px] z-50 flex justify-center px-6">
      <div className="max-w-3xl w-full text-center">
        {sentences.map((s, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          return (
            <span
              key={i}
              className={`block transition-all duration-500 ${
                isActive
                  ? "text-white opacity-100 scale-100"
                  : isPast
                  ? "text-slate-400 opacity-50 scale-[0.98]"
                  : "text-slate-500 opacity-30 scale-[0.97]"
              } font-display font-bold tracking-tight leading-snug`}
              style={{
                fontSize: isActive ? "clamp(20px, 2.6vw, 32px)" : "clamp(16px, 1.8vw, 22px)",
                textShadow: isActive
                  ? "0 2px 14px rgba(0,0,0,0.85), 0 0 32px rgba(59,130,246,0.25)"
                  : "0 1px 6px rgba(0,0,0,0.7)",
                marginTop: i === 0 ? 0 : "0.35em",
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

// Split into sentences while keeping ! ? . delimiters with the sentence.
function splitSentences(text) {
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text];
}
