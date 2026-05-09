import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { useApp } from "../store.js";
import { postTts } from "../lib/api.js";
import LiveCaption from "./LiveCaption.jsx";
import LandmarkPopouts from "./LandmarkPopouts.jsx";

// Cinematic kicks in when audio crosses this fraction of its total duration.
// 0.20 = end of first sentence (roughly).
const CINEMATIC_FRACTION = 0.20;
// And never sooner than this even on very short clips.
const CINEMATIC_MIN_SECONDS = 1.8;

export default function TourPlayer() {
  const map = useMap();
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const cinematic = useApp((s) => s.tourCinematic);
  const setTourIndex = useApp((s) => s.setTourIndex);
  const setTourState = useApp((s) => s.setTourState);
  const setTourCinematic = useApp((s) => s.setTourCinematic);
  const endTour = useApp((s) => s.endTour);

  const audioRef = useRef(null);
  const [audioCache, setAudioCache] = useState({});
  const [synthErr, setSynthErr] = useState(null);
  const loadedKeyRef = useRef(null);

  // ── Pre-fetch all narration audio when tour starts ─────────────────────────
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
          setSynthErr("Voice narration unavailable.");
        }
      }
    })();
    return () => {
      cancelled = true;
      Object.values(audioCache).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // ── Pan 2D map when stop changes ───────────────────────────────────────────
  // We use setCenter (synchronous jump) + setZoom rather than panTo (animated)
  // because animated pan + setZoom firing back-to-back at low zooms causes the
  // camera to interpolate to a weird midpoint (was reliably landing in
  // McLean, TX from the default US-zoom-4 view).
  useEffect(() => {
    if (!tour || !map || tourState !== "playing") return;
    const stop = tour.stops[tourIndex];
    if (!stop) return;
    setTourCinematic(false);
    const target = { lat: stop.lat, lng: stop.lng };
    map.setCenter(target);
    map.setZoom(Math.max(11, stop.zoom || 11));
  }, [tour, map, tourIndex, tourState, setTourCinematic]);

  // ── Load + play audio when stop changes (guarded against audioCache churn) ─
  useEffect(() => {
    if (!tour || tourState !== "playing") return;
    const url = audioCache[tourIndex];
    const audio = audioRef.current;
    if (!url || !audio) return;
    const key = `${tour.title}|${tourIndex}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    audio.pause();
    audio.currentTime = 0;
    audio.src = url;
    audio.play().catch(() => {});
  }, [tour, tourState, tourIndex, audioCache]);

  // ── DERIVE cinematic flag from audio time on every timeupdate ──────────────
  // No setTimeout: previous architecture had effect-cleanup races that were
  // canceling the cinematic timer before it fired. This is bulletproof:
  // every audio frame we check whether we should be in cinematic mode.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onTime() {
      const dur = audio.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const t = audio.currentTime;
      const wantCinematic =
        t >= CINEMATIC_MIN_SECONDS && t / dur >= CINEMATIC_FRACTION;
      // Only flip if state actually differs — avoids re-render storms
      const current = useApp.getState().tourCinematic;
      if (wantCinematic !== current) setTourCinematic(wantCinematic);
    }
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
    };
  }, [setTourCinematic]);

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

  // The audio element is ALWAYS mounted while TourPlayer itself is mounted.
  // (We used to early-return null when !tour, which meant audioRef was null
  // on first mount and the timeupdate listener never attached.) The conditional
  // gating below hides the visible UI when there's no tour.
  const stop = tour?.stops?.[tourIndex];
  const isLast = tour ? tourIndex >= tour.stops.length - 1 : false;

  return (
    <>
      <audio ref={audioRef} onEnded={onAudioEnded} />
      {tour && (<>
      <LiveCaption
        audioRef={audioRef}
        narration={stop?.narration}
        visible={Boolean(stop) && cinematic}
      />
      <LandmarkPopouts
        landmarks={stop?.landmarks}
        visible={Boolean(stop) && cinematic}
      />

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
              onClick={() => {
                audioRef.current?.pause();
                setTourState("paused");
              }}
              aria-label="Pause"
              className="w-9 h-9 rounded-full bg-white text-slate-900 transition flex items-center justify-center"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            </button>
          ) : (
            <button
              onClick={() => {
                audioRef.current?.play().catch(() => {});
                setTourState("playing");
              }}
              aria-label={tourState === "done" ? "Replay" : "Resume"}
              className="w-9 h-9 rounded-full bg-white text-slate-900 transition flex items-center justify-center"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
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
        {synthErr && (
          <p className="text-center text-[10px] text-amber-300 mt-1.5">{synthErr}</p>
        )}
      </div>
      </>)}
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
