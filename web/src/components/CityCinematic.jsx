import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TilesRenderer, TilesPlugin } from "3d-tiles-renderer/r3f";
import { GoogleCloudAuthPlugin } from "3d-tiles-renderer/plugins";
import * as THREE from "three";
import { useApp } from "../store.js";
import { latLngToECEF, localUp, localEast } from "../lib/ecef.js";
import { fetchWikipediaImage } from "../lib/wikipediaImages.js";

const TILESET_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";

// Photorealistic 3D city flyover — used INSIDE a tour stop.
//
// Mounted for the entire tour duration; only opacity toggles. The camera
// targets the stop's `viewpoint` (Gemini-suggested iconic spot — downtown
// plaza, university campus, training facility) when available, falling back
// to the city's geocoded center.
export default function CityCinematic() {
  const tour = useApp((s) => s.tour);
  const tourIndex = useApp((s) => s.tourIndex);
  const tourState = useApp((s) => s.tourState);
  const cinematic = useApp((s) => s.tourCinematic);
  const mapsApiKey = useApp((s) => s.mapsApiKey);

  const stop = tour?.stops?.[tourIndex];
  const mounted = Boolean(tour && stop && mapsApiKey);

  // Resolve target lat/lng — prefer Gemini's chosen viewpoint over the city's
  // generic Census centroid. Elevation comes from the server's batched
  // Google Elevation lookup (falls back to 0 if unavailable).
  const target = stop
    ? {
        lat:
          typeof stop.viewpoint?.lat === "number" ? stop.viewpoint.lat : stop.lat,
        lng:
          typeof stop.viewpoint?.lng === "number" ? stop.viewpoint.lng : stop.lng,
        elevation:
          typeof stop.viewpoint?.elevation === "number"
            ? stop.viewpoint.elevation
            : 0,
        name: stop.viewpoint?.name || `${stop.city}, ${stop.state}`,
      }
    : null;

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!cinematic}
      className={`fixed inset-0 z-40 transition-opacity duration-700 ease-out ${
        cinematic ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ background: "radial-gradient(ellipse at center, #0a0e16 0%, #04060a 100%)" }}
    >
      <Canvas
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 50, near: 1, far: 5e7 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={1.0} />
        <directionalLight position={[1, 0.6, 0.5]} intensity={1.4} />
        <Scene
          apiKey={mapsApiKey}
          lat={target.lat}
          lng={target.lng}
          elevation={target.elevation}
          playing={tourState === "playing" && cinematic}
          landmarks={stop?.landmarks}
        />
      </Canvas>
      {/* Vignette */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(4,6,10,0.78) 100%)",
        }}
      />
      {/* Subtle title — top-left, no kitschy "Flyover" label */}
      {cinematic && stop && target && (
        <div className="pointer-events-none absolute top-6 left-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300/80 font-semibold">
            {stop.city} · {stop.state}
          </p>
          {stop.viewpoint?.name && (
            <p className="font-display font-bold text-xl text-white tracking-tight mt-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
              {stop.viewpoint.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Scene({ apiKey, lat, lng, elevation, playing, landmarks }) {
  return (
    <TilesRenderer url={TILESET_URL}>
      <TilesPlugin
        plugin={GoogleCloudAuthPlugin}
        args={{ apiToken: apiKey, autoRefreshToken: true }}
      />
      <CinematicCamera
        lat={lat}
        lng={lng}
        elevation={elevation}
        playing={playing}
      />
      <LandmarkMarkers landmarks={landmarks} groundElevation={elevation} />
    </TilesRenderer>
  );
}

// Closer, more cinematic orbit. Camera is ~700-1100m altitude / 1500-2400m
// radius — close enough to read individual buildings and street layout.
// `elevation` is the GROUND ELEVATION (meters above WGS84) at this lat/lng,
// supplied by the server's Elevation API lookup. Without it, frame.center
// sits at sea level and high-elevation cities (Denver, El Paso, Park City,
// etc.) end up with the camera underneath the actual terrain — photoreal
// tiles fail. With elevation, the 370-630m orbit is above-ground at every
// city regardless of how high the surrounding terrain is.
function CinematicCamera({ lat, lng, elevation = 0, playing }) {
  const { camera } = useThree();
  const t0 = useRef(performance.now());

  const frame = useMemo(() => {
    const center = latLngToECEF(lat, lng, elevation);
    const upVec = localUp(lat, lng);
    const eastVec = localEast(lat, lng);
    const northVec = new THREE.Vector3().crossVectors(upVec, eastVec).normalize();
    return { center, upVec, eastVec, northVec };
  }, [lat, lng, elevation]);

  useLayoutEffect(() => {
    t0.current = performance.now();
    // Initial position so tile renderer can pre-load while user is still on 2D
    const startPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(frame.eastVec, 1100)
      .addScaledVector(frame.upVec, 500);
    camera.position.copy(startPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  }, [camera, frame]);

  useFrame(() => {
    const elapsed = (performance.now() - t0.current) / 1000;
    // Tight orbit at building-skyline altitude. Smaller frustum = fewer tiles
    // to stream + much more detail per tile.
    const angle = (playing ? elapsed * 0.05 : 0) + Math.PI / 5;
    const radiusM = 1100 + Math.sin(elapsed * 0.18) * 250; // 850–1350m
    const altitudeM = 500 + Math.sin(elapsed * 0.13) * 130; // 370–630m

    const tangent = new THREE.Vector3()
      .copy(frame.eastVec).multiplyScalar(Math.cos(angle))
      .addScaledVector(frame.northVec, Math.sin(angle));

    const camPos = new THREE.Vector3()
      .copy(frame.center)
      .addScaledVector(tangent, radiusM)
      .addScaledVector(frame.upVec, altitudeM);

    camera.position.copy(camPos);
    camera.up.copy(frame.upVec);
    camera.lookAt(frame.center);
    camera.updateProjectionMatrix();
  });

  return null;
}

// Premium on-map landmark markers — one pin + label per landmark whose
// Wikipedia article carries lat/lng coordinates. Renders via drei's
// <Html transform={false}> so the labels live in a CSS-transform-free layer
// (no perspective transform chain — much lighter on the compositor and
// proven safe for the photoreal tile renderer).
function LandmarkMarkers({ landmarks, groundElevation = 0 }) {
  const [resolved, setResolved] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setResolved([]);
    if (!Array.isArray(landmarks) || landmarks.length === 0) return;
    (async () => {
      const out = [];
      for (const lm of landmarks) {
        // Path A — landmark already carries coords (Pathway tours).
        if (typeof lm?.lat === "number" && typeof lm?.lng === "number") {
          out.push({
            name: lm.name || "Landmark",
            url: null,
            lat: lm.lat,
            lng: lm.lng,
          });
          setResolved([...out]);
          continue;
        }
        // Path B — resolve from Wikipedia (existing AI Tour landmarks).
        if (!lm?.wikipedia) continue;
        const info = await fetchWikipediaImage(lm.wikipedia);
        if (cancelled) return;
        if (info?.coordinates) {
          out.push({
            name: lm.name || info.title,
            url: info.url || null,
            lat: info.coordinates.lat,
            lng: info.coordinates.lng,
          });
          setResolved([...out]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [landmarks]);

  if (resolved.length === 0) return null;

  return (
    <>
      {resolved.map((lm, i) => {
        // Anchor the pin's bottom-center dot ~2 meters above the GROUND
        // elevation, NOT above WGS84 sea level (that would put pins
        // hundreds of meters underground in high-elevation cities).
        // Why +2 (not +30)? Under the cinematic's oblique camera tilt,
        // a 30m vertical offset projects to ~30m of HORIZONTAL screen
        // offset from the true GPS point (offset ≈ 30·tan(camera tilt)).
        // That makes the pin appear "across the parking lot" from the
        // actual building Google Maps shows for the same lat/lng.
        // +2m keeps the dot flush with the photoreal tile surface
        // (covers Open-Meteo vs Google-tile elevation disagreement of
        // 1-3m) so the pin lands exactly on the right building.
        const pos = latLngToECEF(lm.lat, lm.lng, groundElevation + 2);
        return (
          <Html
            key={`${lm.name}-${i}`}
            transform={false}
            position={[pos.x, pos.y, pos.z]}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              className="animate-fade-in"
              style={{
                animationDelay: `${i * 180}ms`,
                animationFillMode: "both",
                transform: "translate(-50%, -100%)",
                width: 220,
              }}
            >
              {/* Pin — anchored at the GPS point (bottom-center of container) */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 30% 30%, #ffffff, #93c5fd 35%, #fcd34d 100%)",
                  boxShadow:
                    "0 0 16px rgba(147,197,253,0.95), 0 0 5px rgba(255,255,255,0.85)",
                  pointerEvents: "none",
                }}
              />

              {/* Label card with speech-bubble tail pointing down to the pin */}
              <div
                style={{
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 11px 8px 7px",
                  borderRadius: 12,
                  background: "rgba(8,12,22,0.94)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                  color: "rgb(241,245,249)",
                  position: "relative",
                }}
              >
                {/* Speech-bubble tail — a downward-pointing triangle bridging
                    card and pin. Two stacked borders give a 1px outline that
                    matches the card. */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -7,
                    marginLeft: -7,
                    width: 0,
                    height: 0,
                    borderLeft: "7px solid transparent",
                    borderRight: "7px solid transparent",
                    borderTop: "7px solid rgba(255,255,255,0.12)",
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -5,
                    marginLeft: -6,
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "6px solid rgba(8,12,22,0.94)",
                  }}
                />
                {lm.url ? (
                  <img
                    src={lm.url}
                    alt=""
                    width={30}
                    height={30}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      background:
                        "linear-gradient(135deg, rgba(59,130,246,0.6), rgba(245,158,11,0.6))",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                    // Allow up to two lines — no nowrap/ellipsis truncation.
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {lm.name}
                </div>
              </div>
            </div>
          </Html>
        );
      })}
    </>
  );
}
