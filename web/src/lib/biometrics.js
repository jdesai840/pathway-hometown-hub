// Webcam-based biometric capture using MediaPipe Tasks Vision PoseLandmarker.
// All processing is client-side. The user's video frames NEVER leave the device.
// We only emit numeric proxies (height/arm-span/reach in cm) — no images, no NIL.

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

let landmarker = null;

async function ensureLandmarker() {
  if (landmarker) return landmarker;
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    },
    runningMode: "IMAGE",
    numPoses: 1,
  });
  return landmarker;
}

// Capture a single frame, run pose detection, emit proxy biometrics.
// Caller passes a HTMLVideoElement that is already showing the user's webcam feed.
export async function captureBiometricsFromVideo(video, knownHeightCm = null) {
  const lm = await ensureLandmarker();
  const result = lm.detect(video);
  const landmarks = result.landmarks?.[0];
  if (!landmarks) throw new Error("no pose detected — please stand back so your full body is visible");

  // landmark indices (per MediaPipe pose):
  // 11 = left shoulder, 12 = right shoulder, 15 = left wrist, 16 = right wrist,
  // 23 = left hip, 24 = right hip, 27 = left ankle, 28 = right ankle
  const px = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const shoulderToWrist = (px(landmarks[11], landmarks[15]) + px(landmarks[12], landmarks[16])) / 2;
  const shoulderWidth = px(landmarks[11], landmarks[12]);
  const torsoLen = px(
    { x: (landmarks[11].x + landmarks[12].x) / 2, y: (landmarks[11].y + landmarks[12].y) / 2 },
    { x: (landmarks[23].x + landmarks[24].x) / 2, y: (landmarks[23].y + landmarks[24].y) / 2 }
  );
  const legLen = px(
    { x: (landmarks[23].x + landmarks[24].x) / 2, y: (landmarks[23].y + landmarks[24].y) / 2 },
    { x: (landmarks[27].x + landmarks[28].x) / 2, y: (landmarks[27].y + landmarks[28].y) / 2 }
  );

  const totalNorm = torsoLen + legLen;
  if (totalNorm === 0) throw new Error("invalid pose");

  // Calibrate against known height if provided, else assume an average and convert to ratios.
  const height = knownHeightCm ?? 170;
  const cmPerUnit = height / totalNorm;

  return {
    heightCm: Math.round(height),
    armSpanCm: Math.round(shoulderToWrist * 2 * cmPerUnit + shoulderWidth * cmPerUnit),
    reachCm: Math.round(shoulderToWrist * cmPerUnit),
    // ratios are robust to the unknown-height case and are what the agent really needs
    ratios: {
      armSpanToHeight: +(((shoulderToWrist * 2 + shoulderWidth) / totalNorm).toFixed(3)),
      legToHeight: +((legLen / totalNorm).toFixed(3)),
      torsoToHeight: +((torsoLen / totalNorm).toFixed(3)),
    },
  };
}
