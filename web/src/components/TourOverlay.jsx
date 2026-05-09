import { useApp } from "../store.js";
import LiveCaption from "./LiveCaption.jsx";
import LandmarkPopouts from "./LandmarkPopouts.jsx";

// TourOverlay renders all visible tour UI (captions, landmark popouts,
// playback controls). It lives at the MapExplorer top level — OUTSIDE the
// <Map> component — so position:fixed escapes to the viewport rather than
// being trapped in Google Maps' transformed containing block.
//
// Reads tour state + audio progress from the zustand store. Doesn't touch
// the audio element directly: pause/resume buttons toggle tourState, which
// TourController watches and applies to the actual <audio>.
export default function TourOverlay() {
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const cinematic = useApp((s) => s.tourCinematic);
  const setTourIndex = useApp((s) => s.setTourIndex);
  const setTourState = useApp((s) => s.setTourState);
  const endTour = useApp((s) => s.endTour);

  if (!tour) return null;

  const stop = tour.stops[tourIndex];
  const isLast = tourIndex >= tour.stops.length - 1;

  return (
    <>
      <LiveCaption narration={stop?.narration} visible={Boolean(stop) && cinematic} />
      <LandmarkPopouts landmarks={stop?.landmarks} visible={Boolean(stop) && cinematic} />

      <div
        className={`fixed left-1/2 -translate-x-1/2 z-[55] transition-all duration-500 ${
          cinematic ? "bottom-6" : "bottom-4"
        }`}
      >
        <div className="glass-strong rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 min-w-[460px] max-w-[92vw]">
          <button
            onClick={() => setTourIndex(Math.max(0, tourIndex - 1))}
            disabled={tourIndex === 0}
            aria-label="Previous stop"
            className="w-8 h-8 rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 text-sm border border-slate-700/50 disabled:opacity-30 transition flex items-center justify-center"
          >
            ←
          </button>

          {tourState === "playing" ? (
            <button
              onClick={() => setTourState("paused")}
              aria-label="Pause"
              className="w-9 h-9 rounded-full bg-white text-slate-900 transition flex items-center justify-center"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setTourState("playing")}
              aria-label={tourState === "done" ? "Replay" : "Resume"}
              className="w-9 h-9 rounded-full bg-white text-slate-900 transition flex items-center justify-center"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            </button>
          )}

          <button
            onClick={() => {
              if (isLast) endTour();
              else setTourIndex(tourIndex + 1);
            }}
            aria-label={isLast ? "End tour" : "Next stop"}
            className="w-8 h-8 rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 text-sm border border-slate-700/50 transition flex items-center justify-center"
          >
            →
          </button>

          <div className="flex-1 px-2 min-w-0 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
              Stop <span className="num">{tourIndex + 1}</span> / {tour.stops.length}
              {tour.title && <span className="text-slate-500"> · {tour.title}</span>}
            </p>
            <p className="font-display font-bold text-slate-50 text-sm leading-tight tracking-tight truncate">
              {stop ? `${stop.city}, ${stop.state}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {tour.stops.map((_, i) => (
              <button
                key={i}
                onClick={() => setTourIndex(i)}
                aria-label={`Stop ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === tourIndex
                    ? "w-6 bg-white"
                    : i < tourIndex
                    ? "w-1.5 bg-slate-300/70"
                    : "w-1.5 bg-slate-700/70"
                }`}
              />
            ))}
          </div>

          <button
            onClick={endTour}
            aria-label="End tour"
            className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
