import { useEffect, useRef } from "react";
import { useApp } from "../store.js";

// Animated landing-page backdrop — DOT-FIRST design (Round 3).
// Layers (back-to-front):
//   1. Aurora ribbons      — slow sine-wave gradient sweeps for atmospheric depth
//   2. Star field          — 150 random twinkling points to fill ocean / off-CONUS
//   3. Pulse rings         — emitted from a deterministic spotlight rotation of top hubs
//   4. City dots           — every athlete-hometown, modulated by:
//        • per-dot pulse (alpha + size)
//        • rolling longitude wave (E↔W sweep)
//        • region cycling (5 US regions take turns)
//        • top-hub spotlight flash (1.6× size for 250ms when its turn comes)
//
// NIL-compliant: dots only — no names, no images.

const LNG_MIN = -125;
const LNG_MAX = -66;
const LAT_MIN = 24;
const LAT_MAX = 50;

// Wave constants
const WAVE_CYCLE_SEC = 9;
const WAVE_SIGMA_LNG = 6;

// Region cycling
const REGION_SLOT_SEC = 3.2;
const REGION_EASE_IN = 0.6;
const REGION_HOLD = 1.4;
const REGION_EASE_OUT = 1.2;

// Spotlight rotation
const SPOTLIGHT_INTERVAL_MS = 2500;
const SPOTLIGHT_FLASH_MS = 250;

function project(lng, lat, w, h) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * w;
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * h;
  return [x, y];
}

function blendColor(paraRatio) {
  const r = Math.round(0x3b + (0xf5 - 0x3b) * paraRatio);
  const g = Math.round(0x82 + (0x9e - 0x82) * paraRatio);
  const b = Math.round(0xf6 + (0x0b - 0xf6) * paraRatio);
  return [r, g, b];
}

// 5 US regions. Index returned: 0=West, 1=Mountain, 2=Midwest, 3=Southeast, 4=Northeast.
function regionIndex(lng, lat) {
  if (lng <= -114) return 0;
  if (lng <= -103) return 1;
  if (lng <= -88) return 2;
  if (lat <= 38) return 3;
  return 4;
}

export default function IntroMap({ igniting }) {
  const cityHubsDoc = useApp((s) => s.cityHubsDoc);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dotsRef = useRef([]);
  const topHubsRef = useRef([]);
  const starsRef = useRef([]);
  const igniteRef = useRef(igniting);

  useEffect(() => {
    igniteRef.current = igniting;
  }, [igniting]);

  // Build dot list when data arrives + identify top hubs + build star field
  useEffect(() => {
    if (!cityHubsDoc?.cities) return;
    const maxAth = Math.max(1, ...cityHubsDoc.cities.map((c) => c.athleteCount));

    // Top 12 hubs get the boost treatment + are the spotlight rotation pool
    const sorted = [...cityHubsDoc.cities].sort(
      (a, b) => b.athleteCount - a.athleteCount
    );
    const topSet = new Set(
      sorted.slice(0, 12).map((c) => `${c.state}|${c.cityKey}`)
    );

    dotsRef.current = cityHubsDoc.cities.map((c) => {
      const total = c.olympicAthletes + c.paralympicAthletes;
      const paraRatio = total > 0 ? c.paralympicAthletes / total : 0;
      const norm = Math.pow(c.athleteCount / maxAth, 0.45);
      const isTop = topSet.has(`${c.state}|${c.cityKey}`);
      return {
        lat: c.lat,
        lng: c.lng,
        region: regionIndex(c.lng, c.lat),
        size: (1.2 + norm * 4.4) * (isTop ? 1.3 : 1),
        rgb: blendColor(paraRatio),
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.7,
        baseAlpha: 0.32 + norm * 0.42,
        amp: 0.28 + Math.random() * 0.18,
        glowMul: isTop ? 1.7 : 1,
        isTop,
      };
    });

    // Build top-hubs list in deterministic order (most athletes first) so the
    // spotlight rotation feels like a deliberate tour, not random.
    const topList = [...dotsRef.current.filter((d) => d.isTop)];
    // Sort by an arbitrary stable order — by latitude then longitude — so the
    // rotation traces a path across the country instead of clustering randomly.
    topList.sort((a, b) => a.lng - b.lng || a.lat - b.lat);
    topHubsRef.current = topList;

    // Star field: 150 dim points at random non-geographic positions (0-1 normalized)
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.4 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
        baseAlpha: 0.08 + Math.random() * 0.18,
      });
    }
    starsRef.current = stars;
  }, [cityHubsDoc]);

  // RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const rings = [];
    let lastSpotlightAt = 0;
    let spotlightIdx = -1;
    let spotlightFlashStart = 0;
    const t0 = performance.now();

    function tick(now) {
      const t = (now - t0) / 1000;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      ctx.clearRect(0, 0, W, H);

      const dx = Math.sin(t * 0.05) * 8;
      const dy = Math.cos(t * 0.04) * 6;
      const igniteBoost = igniteRef.current ? 1 : 0;

      // ─── Wave: rolling E↔W sweep ─────────────────────────────────────
      const dirEven = Math.floor(t / WAVE_CYCLE_SEC) % 2 === 0;
      const wavePhase = (t % WAVE_CYCLE_SEC) / WAVE_CYCLE_SEC;
      const wavePos = dirEven
        ? LNG_MIN + wavePhase * (LNG_MAX - LNG_MIN)
        : LNG_MAX - wavePhase * (LNG_MAX - LNG_MIN);

      // ─── Region cycling envelope ─────────────────────────────────────
      const slotIdx = Math.floor(t / REGION_SLOT_SEC) % 5;
      const slotLocal = (t % REGION_SLOT_SEC); // 0..REGION_SLOT_SEC
      let regionEnv = 0;
      if (slotLocal < REGION_EASE_IN) {
        const k = slotLocal / REGION_EASE_IN;
        regionEnv = 1 - Math.pow(1 - k, 3); // ease-out cubic
      } else if (slotLocal < REGION_EASE_IN + REGION_HOLD) {
        regionEnv = 1;
      } else if (slotLocal < REGION_EASE_IN + REGION_HOLD + REGION_EASE_OUT) {
        const k = (slotLocal - REGION_EASE_IN - REGION_HOLD) / REGION_EASE_OUT;
        regionEnv = 1 - (1 - Math.pow(1 - k, 3));
      } else {
        regionEnv = 0;
      }

      // ─── Spotlight rotation: deterministic next top hub every 2.5s ──
      const topHubs = topHubsRef.current;
      if (
        topHubs.length > 0 &&
        now - lastSpotlightAt > SPOTLIGHT_INTERVAL_MS
      ) {
        spotlightIdx = (spotlightIdx + 1) % topHubs.length;
        const hub = topHubs[spotlightIdx];
        rings.push({ hub, born: now, life: 1400 });
        lastSpotlightAt = now;
        spotlightFlashStart = now;
      }
      const currentSpotlightHub =
        spotlightIdx >= 0 ? topHubs[spotlightIdx] : null;
      const flashElapsed = now - spotlightFlashStart;
      const spotlightFlashEnv =
        flashElapsed < SPOTLIGHT_FLASH_MS
          ? 1 - Math.pow(flashElapsed / SPOTLIGHT_FLASH_MS, 3)
          : 0;

      // 1) Aurora ribbons — drawn first, behind everything
      drawAurora(ctx, W, H, t, igniteBoost);

      // 2) Star field
      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = s.baseAlpha + 0.08 * Math.sin(t * s.speed + s.phase);
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${Math.max(0.04, a)})`;
        ctx.fill();
      }

      // 3) Spotlight pulse rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        const k = (now - r.born) / r.life;
        if (k >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const [hx, hy] = project(r.hub.lng, r.hub.lat, W, H);
        const radius = 6 + k * 120;
        const alpha = (1 - k) * 0.55;
        const [rr, gg, bb] = r.hub.rgb;
        ctx.beginPath();
        ctx.arc(hx + dx, hy + dy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rr},${gg},${bb},${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = `rgba(${rr},${gg},${bb},${alpha * 0.7})`;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 4) City dots — composed pulse + wave + region + spotlight
      const dots = dotsRef.current;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const [px, py] = project(d.lng, d.lat, W, H);

        // Per-dot pulse on both alpha AND size
        const sinPhase = Math.sin(t * d.speed + d.phase);
        const pulseAlpha = d.baseAlpha + d.amp * sinPhase;
        const sizeBeat = 1 + 0.25 * sinPhase;

        // Rolling wave
        const wDelta = (d.lng - wavePos) / WAVE_SIGMA_LNG;
        const wave = Math.exp(-0.5 * wDelta * wDelta);

        // Region envelope (only if this dot is in the active region)
        const region = d.region === slotIdx ? regionEnv : 0;

        // Spotlight flash (only if this dot IS the current spotlight hub)
        const flash = d === currentSpotlightHub ? spotlightFlashEnv : 0;

        const alphaBoost = wave * 0.5 + region * 0.35 + flash * 0.6;
        const sizeBoost = wave * 0.6 + region * 0.4 + flash * 0.6;

        const alpha = Math.min(
          1,
          Math.max(0.05, pulseAlpha + alphaBoost + igniteBoost * 0.4)
        );
        const size =
          d.size * sizeBeat * (1 + sizeBoost) * (1 + igniteBoost * 0.6);

        const [r, g, b] = d.rgb;
        ctx.beginPath();
        ctx.arc(px + dx, py + dy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.shadowColor = `rgba(${r},${g},${b},${0.55 * d.glowMul})`;
        ctx.shadowBlur = (10 + size * 1.5) * d.glowMul;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "screen" }}
    />
  );
}

// Two slow sine-wave gradient ribbons (blue + amber) panning across the canvas
// at low alpha. Builds atmospheric depth without competing with the dots.
function drawAurora(ctx, W, H, t, igniteBoost) {
  const baseAlpha = 0.06 + igniteBoost * 0.08;
  // Blue ribbon
  ctx.save();
  ctx.beginPath();
  const yA = H * 0.32 + Math.sin(t * 0.15) * H * 0.12;
  const amplA = H * 0.18;
  const stepA = W / 60;
  ctx.moveTo(-50, yA);
  for (let x = -50; x <= W + 50; x += stepA) {
    const y =
      yA +
      Math.sin((x / W) * Math.PI * 2.2 + t * 0.4) * amplA +
      Math.sin((x / W) * Math.PI * 5 + t * 0.7) * amplA * 0.25;
    ctx.lineTo(x, y);
  }
  ctx.lineWidth = 90;
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(59,130,246,${baseAlpha})`;
  ctx.shadowColor = "rgba(59,130,246,0.35)";
  ctx.shadowBlur = 60;
  ctx.stroke();
  ctx.restore();

  // Amber ribbon (slower, opposite phase)
  ctx.save();
  ctx.beginPath();
  const yB = H * 0.68 + Math.cos(t * 0.11) * H * 0.1;
  const amplB = H * 0.14;
  const stepB = W / 60;
  ctx.moveTo(-50, yB);
  for (let x = -50; x <= W + 50; x += stepB) {
    const y =
      yB +
      Math.sin((x / W) * Math.PI * 1.8 - t * 0.3) * amplB +
      Math.sin((x / W) * Math.PI * 4 - t * 0.6) * amplB * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.lineWidth = 80;
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(245,158,11,${baseAlpha * 0.9})`;
  ctx.shadowColor = "rgba(245,158,11,0.3)";
  ctx.shadowBlur = 60;
  ctx.stroke();
  ctx.restore();
}
