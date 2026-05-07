import { useEffect, useRef, useState } from "react";
import { useApp } from "../store.js";
import { captureBiometricsFromVideo } from "../lib/biometrics.js";

export default function Capture() {
  const videoRef = useRef(null);
  const setBiometrics = useApp((s) => s.setBiometrics);
  const setStep = useApp((s) => s.setStep);
  const [status, setStatus] = useState("idle");
  const [heightCm, setHeightCm] = useState("");

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
        setStatus(`error: ${err.message}`);
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function capture() {
    setStatus("capturing");
    try {
      const bio = await captureBiometricsFromVideo(
        videoRef.current,
        heightCm ? Number(heightCm) : null
      );
      setBiometrics(bio);
      setStep("questions");
    } catch (err) {
      setStatus(`error: ${err.message}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-semibold">Stand back, full body visible</h2>
      <p className="text-slate-400 mt-2 text-sm">
        Stand a few steps back from your camera with arms slightly raised. We'll capture proxy
        measurements for the archetype agent.
      </p>
      <div className="mt-6 rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300">
          Your height (cm, optional):
          <input
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            type="number"
            placeholder="170"
            className="ml-2 w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
          />
        </label>
        <button
          disabled={status !== "ready"}
          onClick={capture}
          className="px-5 py-2 rounded-full bg-white text-slate-900 font-semibold disabled:opacity-50"
        >
          Capture
        </button>
        <span className="text-xs text-slate-500">{status}</span>
      </div>
    </div>
  );
}
