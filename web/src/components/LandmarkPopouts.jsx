import { useEffect, useState } from "react";
import { fetchWikipediaImage } from "../lib/wikipediaImages.js";

// Floating landmark cards on the right side during cinematic mode.
// Each card shows a Wikipedia thumbnail + landmark name, fading in
// staggered so they don't all appear at once.
//
// Skips landmarks with no Wikipedia image rather than rendering a placeholder.

export default function LandmarkPopouts({ landmarks, visible }) {
  const [resolved, setResolved] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      setResolved([]);
      return;
    }
    setResolved([]);
    (async () => {
      const out = [];
      for (const lm of landmarks) {
        if (!lm?.wikipedia) continue;
        const img = await fetchWikipediaImage(lm.wikipedia);
        if (cancelled) return;
        if (img?.url) {
          out.push({ name: lm.name || img.title, ...img });
          // progressive reveal
          setResolved([...out]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [landmarks]);

  if (!visible || resolved.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-1/2 -translate-y-1/2 right-6 z-50 flex flex-col gap-3 max-w-[260px]">
      {resolved.map((lm, i) => (
        <a
          key={lm.url}
          href={`https://www.google.com/search?q=${encodeURIComponent(lm.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Search Google for ${lm.name}`}
          className="pointer-events-auto glass-strong rounded-2xl overflow-hidden shadow-2xl animate-slide-in-right block hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(147,197,253,0.35)] transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-white/40"
          style={{
            animationDelay: `${i * 200}ms`,
            animationFillMode: "both",
          }}
        >
          <div className="relative h-32 overflow-hidden">
            <img
              src={lm.url}
              alt={lm.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(11,18,32,0.95) 0%, transparent 60%)",
              }}
            />
          </div>
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Landmark
            </p>
            <p className="text-sm font-display font-bold text-slate-50 leading-tight tracking-tight mt-0.5">
              {lm.name}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
