import { useEffect, useRef } from "react";
import { useApp } from "../store.js";

// Animated landing-page backdrop. Layers (back-to-front):
//   1. Aurora ribbons — slow sine-wave gradient sweeps for atmospheric depth
//   2. Star field      — 150 random twinkling points to fill ocean / off-CONUS
//   3. Pulse rings     — expanding rings emitted from top-12 hubs (~3s cadence)
//   4. Connection arcs — gradient arcs between two random hubs (~1.8s cadence)
//   5. Light flares    — vertical streaks from a top hub (~5s cadence)
//   6. City dots       — every athlete-hometown pulses with per-dot phase
//
// NIL-compliant: dots only — no names, no images.

const LNG_MIN = -125;
const LNG_MAX = -66;
const LAT_MIN = 24;
const LAT_MAX = 50;

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

    // Top 12 hubs get the boost treatment + are the source for rings/flares
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
        size: (1.2 + norm * 4.4) * (isTop ? 1.3 : 1),
        rgb: blendColor(paraRatio),
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.7,
        baseAlpha: 0.32 + norm * 0.42,
        amp: 0.18 + Math.random() * 0.18,
        glowMul: isTop ? 1.7 : 1,
        isTop,
      };
    });

    topHubsRef.current = dotsRef.current.filter((d) => d.isTop);

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

    const arcs = [];
    const rings = [];
    const flares = [];
    let lastArcAt = 0;
    let lastRingAt = 0;
    let lastFlareAt = 0;
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

      // 3) Spawn pulse rings every ~3s from a random top hub
      if (now - lastRingAt > 3000 && topHubsRef.current.length > 0) {
        const hub =
          topHubsRef.current[
            Math.floor(Math.random() * topHubsRef.current.length)
          ];
        rings.push({ hub, born: now, life: 1400 });
        lastRingAt = now;
      }
      // Draw + tick rings
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

      // 4) Connection arcs — every ~1.8s
      if (now - lastArcAt > 1800 && dotsRef.current.length > 1) {
        const a =
          dotsRef.current[Math.floor(Math.random() * dotsRef.current.length)];
        const b =
          dotsRef.current[Math.floor(Math.random() * dotsRef.current.length)];
        if (a && b && a !== b) {
          arcs.push({ a, b, born: now, life: 1500 });
          lastArcAt = now;
        }
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const k = (now - arc.born) / arc.life;
        if (k >= 1) {
          arcs.splice(i, 1);
          continue;
        }
        const [ax, ay] = project(arc.a.lng, arc.a.lat, W, H);
        const [bx, by] = project(arc.b.lng, arc.b.lat, W, H);
        const drawT = Math.min(1, k * 1.4);
        const tipX = ax + (bx - ax) * drawT;
        const tipY = ay + (by - ay) * drawT;
        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.18;
        const fade = 1 - Math.max(0, k - 0.65) / 0.35;
        ctx.beginPath();
        ctx.moveTo(ax + dx, ay + dy);
        ctx.quadraticCurveTo(midX + dx, midY + dy, tipX + dx, tipY + dy);
        const grad = ctx.createLinearGradient(ax, ay, bx, by);
        grad.addColorStop(0, `rgba(59,130,246,${0.45 * fade})`);
        grad.addColorStop(1, `rgba(245,158,11,${0.45 * fade})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = "rgba(59,130,246,0.4)";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 5) Light flares — every ~5s, max 1 active
      if (
        now - lastFlareAt > 5000 &&
        flares.length === 0 &&
        topHubsRef.current.length > 0
      ) {
        const hub =
          topHubsRef.current[
            Math.floor(Math.random() * topHubsRef.current.length)
          ];
        flares.push({ hub, born: now, life: 700 });
        lastFlareAt = now;
      }
      for (let i = flares.length - 1; i >= 0; i--) {
        const f = flares[i];
        const k = (now - f.born) / f.life;
        if (k >= 1) {
          flares.splice(i, 1);
          continue;
        }
        const [fx, fy] = project(f.hub.lng, f.hub.lat, W, H);
        const height = 60 + (1 - k) * 40;
        const alpha = Math.sin(k * Math.PI) * 0.6; // ease in & out
        const [rr, gg, bb] = f.hub.rgb;
        const grad = ctx.createLinearGradient(fx, fy, fx, fy - height);
        grad.addColorStop(0, `rgba(${rr},${gg},${bb},${alpha})`);
        grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
        ctx.beginPath();
        ctx.moveTo(fx + dx, fy + dy);
        ctx.lineTo(fx + dx, fy + dy - height);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // 6) City dots
      const dots = dotsRef.current;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const [px, py] = project(d.lng, d.lat, W, H);
        const pulse = d.baseAlpha + d.amp * Math.sin(t * d.speed + d.phase);
        const alpha = Math.min(1, Math.max(0.05, pulse + igniteBoost * 0.4));
        const size = d.size * (1 + igniteBoost * 0.6);
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
