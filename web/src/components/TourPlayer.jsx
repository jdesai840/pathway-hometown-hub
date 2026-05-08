import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { useApp } from "../store.js";
import { postTts } from "../lib/api.js";

// Drives a tour: glides the map between stops, plays Cloud TTS audio for each
// stop's narration, advances on audio-end or manual skip. Visual: bottom panel
// showing current stop + progress + controls.
export default function TourPlayer() {
  const map = useMap();
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const setTourIndex = useApp((s) => s.setTourIndex);
  const setTourState = useApp((s) => s.setTourState);
  const endTour = useApp((s) => s.endTour);
  const setSelectedCityKey = useApp((s) => s.setSelectedCityKey);

  const audioRef = useRef(null);
  const [audioCache, setAudioCache] = useState({}); // idx -> objectURL
  const [synthErr, setSynthErr] = useState(null);

  // Pre-fetch all narration audio when tour starts
  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    setAudioCache({});
    setSynthErr(null);
    (async () => {
      const results = {};
      for (let i = 0; i < tour.stops.length; i++) {
        if (cancelled) return;
        const stop = tour.stops[i];
        try {
          const r = await postTts({ text: stop.narration });
          if (cancelled) return;
          if (r.audioBase64) {
            const blob = base64ToBlob(r.audioBase64, r.mimeType || "audio/mpeg");
            results[i] = URL.createObjectURL(blob);
            setAudioCache({ ...results });
          }
        } catch (err) {
          console.error(`tts failed for stop ${i}`, err);
          setSynthErr("Voice narration unavailable — falling back to text only.");
        }
      }
    })();
    return () => {
      cancelled = true;
      // revoke object URLs to free memory
      Object.values(audioCache).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // When the active stop changes, pan the map and play audio for that stop
  useEffect(() => {
    if (!tour || !map || tourState !== "playing") return;
    const stop = tour.stops[tourIndex];
    if (!stop) return;

    map.panTo({ lat: stop.lat, lng: stop.lng });
    map.setZoom(stop.zoom || 8);

    // Play audio if cached
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      const url = audioCache[tourIndex];
      if (url) {
        audio.src = url;
        audio.play().catch(() => {});
      }
    }
  }, [tour, map, tourIndex, tourState, audioCache]);

  // When audio ends, advance
  function onAudioEnded() {
    if (!tour) return;
    if (tourIndex < tour.stops.length - 1) {
      setTourIndex(tourIndex + 1);
    } else {
      setTourState("done");
    }
  }

  if (!tour) return null;

  const stop = tour.stops[tourIndex];
  const isLast = tourIndex >= tour.stops.length - 1;

  return (
    <>
      <audio ref={audioRef} onEnded={onAudioEnded} />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(560px,92vw)] glass-strong rounded-2xl p-4 shadow-2xl animate-slide-up">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              {tour.title}
            </p>
            <h3 className="font-display font-extrabold text-slate-50 text-lg leading-tight tracking-tight mt-0.5">
              {stop ? `${stop.city}, ${stop.state}` : ""}
            </h3>
          </div>
          <button
            onClick={endTour}
            aria-label="End tour"
            className="text-slate-400 hover:text-white px-2 focus:outline-none focus:ring-2 focus:ring-white/40 rounded transition shrink-0"
          >
            ✕
          </button>
        </div>

        {stop && (
          <p className="text-sm text-slate-100 leading-relaxed mb-3">
            {stop.narration}
          </p>
        )}

        {Array.isArray(stop?.highlightSports) && stop.highlightSports.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {stop.highlightSports.map((s) => (
              <span
                key={s}
                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-200 border border-slate-700/50"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-3">
          {tour.stops.map((s, i) => (
            <button
              key={i}
              onClick={() => setTourIndex(i)}
              aria-label={`Stop ${i + 1}`}
              className={`h-1 rounded-full transition-all ${
                i === tourIndex
                  ? "flex-[2] bg-white"
                  : i < tourIndex
                  ? "flex-1 bg-slate-300/70"
                  : "flex-1 bg-slate-700/70"
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="num">
              Stop {tourIndex + 1} / {tour.stops.length}
            </span>
            {synthErr && <span className="text-amber-300">· {synthErr}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTourIndex(Math.max(0, tourIndex - 1))}
              disabled={tourIndex === 0}
              aria-label="Previous stop"
              className="px-3 py-1.5 rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-[11px] text-slate-100 border border-slate-700/50 disabled:opacity-40 transition"
            >
              ←
            </button>
            {tourState === "playing" ? (
              <button
                onClick={() => {
                  audioRef.current?.pause();
                  setTourState("paused");
                }}
                className="px-3.5 py-1.5 rounded-full bg-white text-slate-900 text-[11px] font-semibold transition"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => {
                  audioRef.current?.play().catch(() => {});
                  setTourState("playing");
                }}
                className="px-3.5 py-1.5 rounded-full bg-white text-slate-900 text-[11px] font-semibold transition"
              >
                {tourState === "done" ? "Replay" : "Resume"}
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) endTour();
                else setTourIndex(tourIndex + 1);
              }}
              aria-label={isLast ? "End tour" : "Next stop"}
              className="px-3 py-1.5 rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-[11px] text-slate-100 border border-slate-700/50 transition"
            >
              {isLast ? "Finish" : "→"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function base64ToBlob(b64, mimeType) {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}
