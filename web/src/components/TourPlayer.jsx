import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { useApp } from "../store.js";
import { postTts } from "../lib/api.js";
import LiveCaption from "./LiveCaption.jsx";
import LandmarkPopouts from "./LandmarkPopouts.jsx";

// Two-phase per stop:
//   Phase A — 2D map: pan/zoom to the city, narration starts on the basemap.
//   Phase B — Cinematic: ~35% into the audio, fade to photorealistic 3D
//             flyover of the city while narration finishes.
// On audio end, fade back to 2D and advance to next stop.

const CINEMATIC_TRIGGER_FRACTION = 0.18; // ~end of first sentence
const CINEMATIC_MIN_DELAY_MS = 1800;     // never sooner than this

export default function TourPlayer() {
  const map = useMap();
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const setTourIndex = useApp((s) => s.setTourIndex);
  const setTourState = useApp((s) => s.setTourState);
  const setTourCinematic = useApp((s) => s.setTourCinematic);
  const endTour = useApp((s) => s.endTour);

  const audioRef = useRef(null);
  const [audioCache, setAudioCache] = useState({});
  const [synthErr, setSynthErr] = useState(null);
  const cinematicTimerRef = useRef(null);

  // Tracks which (tour, index) we have currently loaded into the <audio> element.
  // Used to avoid restarting audio when audioCache updates for OTHER stops
  // (background pre-fetch). Without this guard, every cached stop's TTS arriving
  // re-triggers the play effect → audio restarts → first word repeats.
  const loadedKeyRef = useRef(null);

  // Pre-fetch all narration audio when tour starts
  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    setAudioCache({});
    setSynthErr(null);
    loadedKeyRef.current = null;
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
          setSynthErr("Voice narration unavailable — text only.");
        }
      }
    })();
    return () => {
      cancelled = true;
      Object.values(audioCache).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // Effect A: when stop changes, pan map + reset cinematic flag.
  // Does NOT touch audio — that's effect B's job.
  useEffect(() => {
    if (!tour || !map || tourState !== "playing") return;
    const stop = tour.stops[tourIndex];
    if (!stop) return;
    setTourCinematic(false);
    map.panTo({ lat: stop.lat, lng: stop.lng });
    map.setZoom(stop.zoom || 8);
    return () => {
      if (cinematicTimerRef.current) {
        clearTimeout(cinematicTimerRef.current);
        cinematicTimerRef.current = null;
      }
    };
  }, [tour, map, tourIndex, tourState, setTourCinematic]);

  // Effect B: load + play audio for the current stop.
  // Guarded by loadedKeyRef so audioCache updates for OTHER stops don't restart
  // the currently-playing audio.
  useEffect(() => {
    if (!tour || tourState !== "playing") return;
    const url = audioCache[tourIndex];
    const audio = audioRef.current;
    if (!url || !audio) return;

    const key = `${tour.title}|${tourIndex}`;
    if (loadedKeyRef.current === key) return; // already loaded for this stop

    loadedKeyRef.current = key;
    audio.pause();
    audio.currentTime = 0;
    audio.src = url;
    audio.play().catch(() => {});

    // Schedule cinematic switch using the audio's actual duration
    function scheduleCinematic() {
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
      const dur = audio.duration;
      let triggerMs;
      if (Number.isFinite(dur) && dur > 0) {
        triggerMs = Math.max(CINEMATIC_MIN_DELAY_MS, dur * 1000 * CINEMATIC_TRIGGER_FRACTION);
      } else {
        triggerMs = 3500;
      }
      cinematicTimerRef.current = setTimeout(() => {
        setTourCinematic(true);
      }, triggerMs);
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0) scheduleCinematic();
    else audio.addEventListener("loadedmetadata", scheduleCinematic, { once: true });
  }, [tour, tourState, tourIndex, audioCache, setTourCinematic]);

  // Reset loaded key when tour ends so the next tour starts fresh
  useEffect(() => {
    if (!tour) loadedKeyRef.current = null;
  }, [tour]);

  function onAudioEnded() {
    if (!tour) return;
    setTourCinematic(false);
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
      <LiveCaption
        audioRef={audioRef}
        narration={stop?.narration}
        visible={Boolean(stop) && tourState !== "idle"}
      />
      <LandmarkPopouts landmarks={stop?.landmarks} visible={Boolean(stop)} />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(620px,94vw)] glass-strong rounded-2xl p-4 shadow-2xl animate-slide-up">
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
          <p className="text-[13px] text-slate-100 leading-relaxed mb-3">
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
