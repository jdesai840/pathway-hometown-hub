import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { useApp } from "../store.js";
import { postTts } from "../lib/api.js";

// Cinematic kicks in when audio crosses this fraction of its total duration.
const CINEMATIC_FRACTION = 0.20;
const CINEMATIC_MIN_SECONDS = 1.8;

// TourController lives INSIDE <Map> so it can call useMap(). It returns null —
// no visible DOM, just orchestration:
//   - <audio> element (kept inside Map's tree but invisible / no-fixed-position)
//   - TTS pre-fetch
//   - map panning on stop change
//   - audio playback driving + cinematic-flag derivation
//   - exposes audioCurrentTime / audioDuration via the store
//
// The visible UI (captions, landmark popouts, control bar) lives in
// TourOverlay at the MapExplorer level, OUTSIDE the Map's transformed
// containing block, so position:fixed works against the viewport.
export default function TourController() {
  const map = useMap();
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const setTourCinematic = useApp((s) => s.setTourCinematic);
  const setTourIndex = useApp((s) => s.setTourIndex);
  const setTourState = useApp((s) => s.setTourState);
  const setAudioProgress = useApp((s) => s.setAudioProgress);
  const setCurrentCaption = useApp((s) => s.setCurrentCaption);

  const audioRef = useRef(null);
  // audioCache[i] = { url, sentences, timepoints } per pre-fetched stop.
  const [audioCache, setAudioCache] = useState({});
  const loadedKeyRef = useRef(null);

  // ── Pre-fetch all narration audio when tour starts ─────────────────────────
  useEffect(() => {
    // ALWAYS silence + reset the audio element on tour change — whether it's
    // a new tour starting, a swap, OR the tour ending (tour=null). This is
    // the single source of truth for "tour-id changed, audio must stop."
    // Previously the audio could keep playing on close, and back-to-back
    // tours could briefly play the prior tour's audio (stale audioCache
    // closure during the React render before setAudioCache applied).
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    loadedKeyRef.current = null;

    // Functional update so we capture the LIVE cache (from whichever tour
    // just ended) and revoke its blob URLs before clearing.
    setAudioCache((prev) => {
      Object.values(prev).forEach((e) => e?.url && URL.revokeObjectURL(e.url));
      return {};
    });

    if (!tour) return; // tour ended — nothing to fetch.

    // New tour: fetch TTS per stop, tag each entry with the tour's title so
    // a stale entry from the previous tour (still in the closure before
    // setAudioCache applies) is filtered out by the audio-play effect.
    let cancelled = false;
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
            results[i] = {
              url: URL.createObjectURL(blob),
              sentences: Array.isArray(r.sentences) ? r.sentences : [],
              timepoints: Array.isArray(r.timepoints) ? r.timepoints : [],
              tourTitle: tour.title, // identity tag — see audio-play guard
            };
            setAudioCache({ ...results });
          }
        } catch (err) {
          console.error(`tts failed for stop ${i}`, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tour]);

  // ── Snap 2D map to the stop's city. No zoom animation — atomic update,
  //    no race window with any other map mover.
  useEffect(() => {
    if (!tour || !map || tourState !== "playing") return;
    const stop = tour.stops[tourIndex];
    if (!stop) return;
    setTourCinematic(false);

    // Server-side override puts the canonical city center on stop.lat/lng;
    // that's the authoritative coord. Viewpoint is only fallback.
    const lat =
      typeof stop.lat === "number"
        ? stop.lat
        : typeof stop.viewpoint?.lat === "number"
        ? stop.viewpoint.lat
        : null;
    const lng =
      typeof stop.lng === "number"
        ? stop.lng
        : typeof stop.viewpoint?.lng === "number"
        ? stop.viewpoint.lng
        : null;
    if (lat == null || lng == null) {
      console.warn("Tour stop missing valid coordinates — not moving map.", stop);
      return;
    }

    const zoom = Math.max(11, stop.zoom || 11);
    if (typeof map.moveCamera === "function") {
      map.moveCamera({ center: { lat, lng }, zoom });
    } else {
      map.setCenter({ lat, lng });
      map.setZoom(zoom);
    }
  }, [tour, map, tourIndex, tourState, setTourCinematic]);

  // ── Load + play audio when stop changes ────────────────────────────────────
  useEffect(() => {
    if (!tour || tourState !== "playing") return;
    const entry = audioCache[tourIndex];
    const audio = audioRef.current;
    if (!entry?.url || !audio) return;
    // Identity guard: skip stale entries from a previous tour that haven't
    // been cleared yet (setAudioCache({}) is async — there's a render window
    // where audioCache still has the prior tour's URLs).
    if (entry.tourTitle && entry.tourTitle !== tour.title) return;
    const key = `${tour.title}|${tourIndex}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    audio.pause();
    audio.currentTime = 0;
    audio.src = entry.url;
    audio.play().catch(() => {});
  }, [tour, tourState, tourIndex, audioCache]);

  // ── Publish current stop's caption sentences + timepoints to the store ─────
  // LiveCaption reads these to swap captions exactly on each audio boundary.
  useEffect(() => {
    const entry = audioCache[tourIndex];
    if (entry?.sentences && entry?.timepoints) {
      setCurrentCaption(entry.sentences, entry.timepoints);
    } else {
      setCurrentCaption([], []);
    }
  }, [tourIndex, audioCache, setCurrentCaption]);

  // ── Audio time → store + cinematic-flag derivation ─────────────────────────
  // audioRef points to a <audio> element that's mounted unconditionally below,
  // so this listener is reliable from the moment the controller mounts.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onTime() {
      const dur = audio.duration;
      const t = audio.currentTime;
      const safeDur = Number.isFinite(dur) && dur > 0 ? dur : 0;
      setAudioProgress(t, safeDur);
      if (safeDur > 0) {
        const wantCinematic =
          t >= CINEMATIC_MIN_SECONDS && t / safeDur >= CINEMATIC_FRACTION;
        const current = useApp.getState().tourCinematic;
        if (wantCinematic !== current) setTourCinematic(wantCinematic);
      }
    }
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
    };
  }, [setTourCinematic, setAudioProgress]);

  // ── Reactive bridge: TourOverlay sets tourState to "paused"/"playing", we
  //    actually pause/play the audio element here. Also pauses on tour=null
  //    (close button) as defense-in-depth — the prefetch effect already
  //    silences on tour change but this guarantees audio stops even if some
  //    later effect re-played it before the prefetch ran.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!tour || tourState === "paused") {
      audio.pause();
      return;
    }
    if (tourState === "playing" && audio.src && audio.paused) {
      audio.play().catch(() => {});
    }
  }, [tour, tourState]);

  function onAudioEnded() {
    if (!tour) return;
    setTourCinematic(false);
    if (tourIndex < tour.stops.length - 1) {
      setTourIndex(tourIndex + 1);
    } else {
      // Last stop: mark done, then auto-exit after a short grace delay so the
      // final caption fades gracefully and the photorealistic view lingers
      // for a beat instead of snapping away.
      setTourState("done");
      setTimeout(() => {
        const s = useApp.getState();
        // Bail if the user already closed or jumped during the delay.
        if (s.tour && s.tourIndex === s.tour.stops.length - 1) {
          s.endTour();
        }
      }, 1500);
    }
  }

  // The audio element MUST be unconditionally mounted so audioRef.current is
  // valid the first time effects run. Visually invisible.
  return (
    <audio
      ref={audioRef}
      onEnded={onAudioEnded}
      style={{ display: "none" }}
    />
  );
}

function base64ToBlob(b64, mimeType) {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}
