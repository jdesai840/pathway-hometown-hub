// Wrap MediaRecorder to capture short audio clips (≤10s) and return base64.
// Browser support: Safari 14.1+, Firefox, Chrome — all OK for this hackathon.

export class AudioCapture {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.mimeType = null;
  }

  async start() {
    if (this.recorder) throw new Error("already recording");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Prefer audio/webm;opus (Chrome/Firefox), fall back to audio/mp4 (Safari).
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    this.mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start();
  }

  async stop() {
    if (!this.recorder) throw new Error("not recording");
    return new Promise((resolve, reject) => {
      this.recorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mimeType || "audio/webm" });
          const audioBase64 = await blobToBase64(blob);
          this.cleanup();
          resolve({ audioBase64, mimeType: this.mimeType || "audio/webm" });
        } catch (err) {
          reject(err);
        }
      };
      this.recorder.stop();
    });
  }

  cancel() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.cleanup();
  }

  cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; // "data:audio/webm;base64,...."
      const idx = dataUrl.indexOf(",");
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
