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

  const audioRef = useRef(null);
  const [audioCache, setAudioCache] = useState({});
  const loadedKeyRef = useRef(null);

  // ── Pre-fetch all narration audio when tour starts ─────────────────────────
  useEffect(() => {
    if (!tour) return;
    // CRITICAL: hard-silence the audio element BEFORE clearing the cache so the
    // pause/play bridge effect can't ask the browser to resume the previous
    // tour's last URL while the new audio is still being fetched.
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    let cancelled = false;
    setAudioCache({});
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
        }
      }
    })();
    return () => {
      cancelled = true;
      Object.values(audioCache).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // ── Pan 2D map when stop changes — jump to city, then slow zoom IN ────────
  // Snap to the city at city-scale zoom, wait for the map's `idle` event
  // (initial pan + tile load complete), then slowly zoom *deeper* into it
  // with throttled setZoom so the raster basemap doesn't flash white tiles.
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

    const target = { lat, lng };
    const jumpZoom = Math.max(11, stop.zoom || 11);
    const finalZoom = jumpZoom + 1.5;
    const durationMs = 5000;
    const ZOOM_EPSILON = 0.05;

    // Snap to the city.
    map.setCenter(target);
    map.setZoom(jumpZoom);

    // Then wait for the map to fully settle (pan complete + tiles arrived)
    // before starting the slow zoom-in. This is the "wait for them to spawn"
    // gate — uses the real Google Maps lifecycle signal instead of a fixed
    // setTimeout so we never start zooming before the camera is in position.
    let cancelled = false;
    let lastApplied = jumpZoom;
    const idleListener = window.google?.maps?.event?.addListenerOnce(
      map,
      "idle",
      () => {
        if (cancelled) return;
        const t0 = performance.now();
        function tick() {
          if (cancelled) return;
          const t = Math.min(1, (performance.now() - t0) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
          const z = jumpZoom + (finalZoom - jumpZoom) * eased;
          if (Math.abs(z - lastApplied) >= ZOOM_EPSILON || t === 1) {
            map.setZoom(z);
            lastApplied = z;
          }
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
    );

    return () => {
      cancelled = true;
      if (idleListener) window.google.maps.event.removeListener(idleListener);
    };
  }, [tour, map, tourIndex, tourState, setTourCinematic]);

  // ── Load + play audio when stop changes ────────────────────────────────────
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
  //    actually pause/play the audio element here ───────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !tour) return;
    if (tourState === "paused") audio.pause();
    else if (tourState === "playing" && audio.src && audio.paused) {
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
