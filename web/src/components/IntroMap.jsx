import { useEffect, useRef } from "react";
import { useApp } from "../store.js";

// Animated hometown-pin canvas backdrop. Projects every athlete-hometown city
// onto a CONUS-bounded equirectangular canvas, breathes them in/out with
// per-dot phase, and occasionally draws a fading arc between two hubs.
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
  // olympic #3b82f6 → paralympic #f59e0b
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
  const igniteRef = useRef(igniting);

  // Keep igniteRef in sync without restarting the RAF loop
  useEffect(() => {
    igniteRef.current = igniting;
  }, [igniting]);

  // Build dot list when data arrives
  useEffect(() => {
    if (!cityHubsDoc?.cities) return;
    const maxAth = Math.max(1, ...cityHubsDoc.cities.map((c) => c.athleteCount));
    dotsRef.current = cityHubsDoc.cities.map((c) => {
      const total = c.olympicAthletes + c.paralympicAthletes;
      const paraRatio = total > 0 ? c.paralympicAthletes / total : 0;
      const norm = Math.pow(c.athleteCount / maxAth, 0.45);
      return {
        lat: c.lat,
        lng: c.lng,
        size: 1.2 + norm * 4.4,
        rgb: blendColor(paraRatio),
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.7,
        baseAlpha: 0.32 + norm * 0.42,
        amp: 0.18 + Math.random() * 0.18,
      };
    });
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

    // Connection arcs: small pool reused over time
    const arcs = [];
    let lastArcAt = 0;
    const t0 = performance.now();

    function tick(now) {
      const t = (now - t0) / 1000;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      ctx.clearRect(0, 0, W, H);

      // Subtle drift offset (parallax)
      const dx = Math.sin(t * 0.05) * 8;
      const dy = Math.cos(t * 0.04) * 6;
      const igniteBoost = igniteRef.current ? 1 : 0;

      // Spawn a new arc every ~3.5s
      if (now - lastArcAt > 3500 && dotsRef.current.length > 1) {
        const a = dotsRef.current[Math.floor(Math.random() * dotsRef.current.length)];
        const b = dotsRef.current[Math.floor(Math.random() * dotsRef.current.length)];
        if (a && b && a !== b) {
          arcs.push({ a, b, born: now, life: 1500 });
          lastArcAt = now;
        }
      }

      // Draw arcs first (under dots)
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const k = (now - arc.born) / arc.life;
        if (k >= 1) {
          arcs.splice(i, 1);
          continue;
        }
        const [ax, ay] = project(arc.a.lng, arc.a.lat, W, H);
        const [bx, by] = project(arc.b.lng, arc.b.lat, W, H);
        const drawT = Math.min(1, k * 1.4); // grow first
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

      // Draw dots
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
        ctx.shadowColor = `rgba(${r},${g},${b},0.55)`;
        ctx.shadowBlur = 10 + size * 1.5;
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
