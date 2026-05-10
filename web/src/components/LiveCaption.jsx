import { useMemo } from "react";
import { useApp } from "../store.js";

// Single-sentence subtitle panel during the tour. Reads progress + per-stop
// caption data from the store. When the server provides SSML timepoints we
// use them for exact audio-boundary sync; otherwise we fall back to the
// previous character-weighted estimation off the narration prop.
export default function LiveCaption({ narration, visible }) {
  const audioCurrentTime = useApp((s) => s.audioCurrentTime);
  const audioDuration = useApp((s) => s.audioDuration);
  const currentSentences = useApp((s) => s.currentSentences);
  const currentTimepoints = useApp((s) => s.currentTimepoints);

  // Prefer server-provided segmentation + timepoints. Fall back to client-side
  // splitting + char weighting if either is missing OR the timepoint array
  // looks degenerate (all-zeros, non-monotonic). The latter case is what
  // happens when Cloud TTS's v1 client silently ignores enableTimePointing.
  const useServer = (() => {
    if (currentSentences.length === 0) return false;
    if (currentTimepoints.length !== currentSentences.length) return false;
    // Need at least one non-zero (timepoints[0] can legitimately be 0).
    let hasNonZero = false;
    for (let i = 0; i < currentTimepoints.length; i++) {
      if (currentTimepoints[i] > 0) {
        hasNonZero = true;
        break;
      }
    }
    if (!hasNonZero) return false;
    // Monotonic non-decreasing.
    for (let i = 1; i < currentTimepoints.length; i++) {
      if (currentTimepoints[i] < currentTimepoints[i - 1]) return false;
    }
    return true;
  })();

  const fallbackSentences = useMemo(
    () => (useServer ? [] : splitSentences(narration || "")),
    [useServer, narration]
  );

  const sentences = useServer ? currentSentences : fallbackSentences;

  let activeIdx = 0;
  if (useServer) {
    // Exact: largest i where timepoints[i] <= audioCurrentTime.
    for (let i = currentTimepoints.length - 1; i >= 0; i--) {
      if (currentTimepoints[i] <= audioCurrentTime) {
        activeIdx = i;
        break;
      }
    }
  } else {
    // Char-weighted fallback (existing logic).
    const totalChars = fallbackSentences.reduce((n, s) => n + s.length, 0) || 1;
    const progress =
      audioDuration > 0 ? Math.min(1, audioCurrentTime / audioDuration) : 0;
    let acc = 0;
    for (let i = 0; i < fallbackSentences.length; i++) {
      acc += fallbackSentences[i].length;
      if (progress * totalChars <= acc + 1) {
        activeIdx = i;
        break;
      }
      activeIdx = i;
    }
  }

  const activeText = sentences[activeIdx] || "";
  const showPanel = visible && activeText.length > 0;

  return (
    <div
      aria-hidden={!showPanel}
      className={`pointer-events-none fixed inset-x-0 bottom-[88px] z-[60] flex justify-center px-6 transition-opacity duration-700 ${
        showPanel ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="max-w-3xl w-fit mx-auto">
        <div
          className="rounded-2xl border border-white/10 px-5 py-3 shadow-2xl"
          style={{
            background: "rgba(2, 6, 14, 0.85)",
            backdropFilter: "blur(20px) saturate(140%)",
            WebkitBackdropFilter: "blur(20px) saturate(140%)",
          }}
          role="status"
          aria-live="polite"
        >
          {/* Crossfade between sentences via key — old span unmounts, new
              span mounts with the existing fade-in animation. */}
          <span
            key={activeIdx}
            className="block font-display font-semibold text-white text-center tracking-tight leading-snug animate-fade-in"
            style={{
              fontSize: "clamp(16px, 1.8vw, 22px)",
              textShadow: "0 2px 12px rgba(0,0,0,0.85)",
              animationDuration: "700ms",
            }}
          >
            {activeText}
          </span>
        </div>
      </div>
    </div>
  );
}

function splitSentences(text) {
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text];
}
