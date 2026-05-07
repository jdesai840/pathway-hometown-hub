import { useEffect, useRef, useState } from "react";
import { useApp } from "../store.js";
import { captureBiometricsFromVideo } from "../lib/biometrics.js";

export default function Capture() {
  const videoRef = useRef(null);
  const setBiometrics = useApp((s) => s.setBiometrics);
  const setStep = useApp((s) => s.setStep);
  const [status, setStatus] = useState("idle");
  const [heightCm, setHeightCm] = useState("");
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("ready");
        }
      } catch (err) {
        setStatus(`webcam unavailable: ${err.message}. Use the Skip option below to enter manually.`);
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function capture() {
    setStatus("capturing — hold still");
    try {
      const bio = await captureBiometricsFromVideo(
        videoRef.current,
        heightCm ? Number(heightCm) : null
      );
      setBiometrics(bio);
      setStep("questions");
    } catch (err) {
      setStatus(`couldn't read pose: ${err.message}`);
    }
  }

  function skip() {
    // Accessibility / no-webcam fallback: feed average proxies so the user can still progress.
    setSkipping(true);
    const h = heightCm ? Number(heightCm) : 170;
    setBiometrics({
      heightCm: h,
      armSpanCm: Math.round(h * 1.0),
      reachCm: Math.round(h * 0.4),
      ratios: { armSpanToHeight: 1.0, legToHeight: 0.5, torsoToHeight: 0.3 },
      manuallyEntered: true,
    });
    setStep("questions");
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8" aria-labelledby="capture-heading">
      <h2 id="capture-heading" className="text-2xl font-semibold">
        Stand back, full body visible
      </h2>
      <p className="text-slate-300 mt-2 text-sm">
        Stand a few steps back from your camera with arms slightly raised. We'll capture proxy
        measurements for the archetype agent. Or skip the webcam entirely below.
      </p>

      <div
        className="mt-6 rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video"
        role="region"
        aria-label="Webcam preview"
      >
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-200">
          Your height (cm, optional):
          <input
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            type="number"
            placeholder="170"
            aria-label="Your height in centimeters, optional"
            className="ml-2 w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-50 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </label>
        <button
          disabled={status !== "ready"}
          onClick={capture}
          aria-label="Capture pose from webcam"
          className="px-5 py-2 rounded-full bg-white text-slate-900 font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          Capture
        </button>
        <button
          onClick={skip}
          disabled={skipping}
          aria-label="Skip webcam and continue with manual height"
          className="px-5 py-2 rounded-full bg-slate-800 text-slate-100 hover:bg-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          Skip webcam
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-slate-400">
        {status}
      </p>
    </main>
  );
}
