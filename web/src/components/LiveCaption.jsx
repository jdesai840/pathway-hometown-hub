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
    <div className="pointer-events-none fixed inset-x-0 bottom-[120px] z-50 flex justify-center px-8">
      <div className="max-w-4xl w-full text-center relative">
        {/* Soft gradient backdrop behind the caption for legibility against
            varied photorealistic terrain */}
        <div
          aria-hidden="true"
          className="absolute -inset-x-12 -inset-y-8 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(11,18,32,0.65) 0%, rgba(11,18,32,0.3) 50%, transparent 80%)",
            filter: "blur(8px)",
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
                  ? "text-white opacity-100 scale-100"
                  : isPast
                  ? "text-slate-300 opacity-45 scale-[0.97]"
                  : "text-slate-400 opacity-25 scale-[0.96]"
              } font-display font-bold tracking-tight leading-snug`}
              style={{
                fontSize: isActive ? "clamp(22px, 2.8vw, 36px)" : "clamp(15px, 1.7vw, 22px)",
                textShadow: isActive
                  ? "0 2px 18px rgba(0,0,0,0.95), 0 0 40px rgba(59,130,246,0.35), 0 0 80px rgba(245,158,11,0.15)"
                  : "0 1px 8px rgba(0,0,0,0.85)",
                marginTop: i === 0 ? 0 : "0.4em",
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
