import { TextToSpeechClient } from "@google-cloud/text-to-speech";

let cachedClient = null;
function getClient() {
  if (!cachedClient) cachedClient = new TextToSpeechClient();
  return cachedClient;
}

// Same sentence-split regex as the client fallback in LiveCaption.jsx —
// keeps segmentation consistent across both code paths.
function splitSentences(text) {
  if (!text) return [];
  const matches = text.match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [text];
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Synthesize speech from text via Cloud Text-to-Speech.
// Returns base64 MP3 + the canonical sentence segmentation + per-sentence
// audio timepoints (in seconds) for perfect caption sync. The frontend uses
// the timepoints to swap captions exactly on each sentence boundary.
//
// Voice defaults to a warm, neutral US English voice. Caller can override.
export async function tts(req, res) {
  const { text, voice = "en-US-Neural2-J", speakingRate = 1.0 } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text required" });
  }
  if (text.length > 4500) {
    return res.status(400).json({ error: "text too long" });
  }

  const sentences = splitSentences(text);

  // Without GCP we can't synthesize — fall back to a 204-style response so the
  // frontend can fall back to browser SpeechSynthesis.
  if (!process.env.GCP_PROJECT) {
    return res.json({
      audioBase64: null,
      mock: true,
      sentences,
      timepoints: [],
    });
  }

  // Build SSML with a <mark> tag at the start of each sentence — Cloud TTS
  // returns the exact audio offset for every named mark when
  // enableTimePointing is set to ['SSML_MARK'].
  const ssml =
    "<speak>" +
    sentences
      .map((s, i) => `<mark name="s${i}"/>${escapeXml(s)}`)
      .join(" ") +
    "</speak>";

  try {
    const client = getClient();
    const [response] = await client.synthesizeSpeech({
      input: { ssml },
      voice: { languageCode: "en-US", name: voice },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
        pitch: 0,
        sampleRateHertz: 24000,
      },
      enableTimePointing: ["SSML_MARK"],
    });

    const buf = response.audioContent;
    const audioBase64 = Buffer.isBuffer(buf) ? buf.toString("base64") : buf;

    // Convert response.timepoints ([{markName: "s0", timeSeconds: 0.123}, ...])
    // into a flat array indexed by sentence position.
    const timepoints = new Array(sentences.length).fill(0);
    if (Array.isArray(response.timepoints)) {
      for (const tp of response.timepoints) {
        const m = /^s(\d+)$/.exec(tp.markName || "");
        if (!m) continue;
        const idx = Number(m[1]);
        if (idx >= 0 && idx < timepoints.length) {
          timepoints[idx] = Number(tp.timeSeconds) || 0;
        }
      }
    }

    res.json({
      audioBase64,
      mimeType: "audio/mpeg",
      sentences,
      timepoints,
    });
  } catch (err) {
    console.error("tts failed", err);
    res.status(500).json({ error: "tts failed" });
  }
}
