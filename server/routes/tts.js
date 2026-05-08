import { TextToSpeechClient } from "@google-cloud/text-to-speech";

let cachedClient = null;
function getClient() {
  if (!cachedClient) cachedClient = new TextToSpeechClient();
  return cachedClient;
}

// Synthesize speech from text via Cloud Text-to-Speech.
// Returns base64-encoded MP3 audio. Frontend decodes to a Blob and plays it.
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

  // Without GCP we can't synthesize — fall back to a 204-style response so the
  // frontend can fall back to browser SpeechSynthesis.
  if (!process.env.GCP_PROJECT) {
    return res.json({ audioBase64: null, mock: true });
  }

  try {
    const client = getClient();
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "en-US", name: voice },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
        pitch: 0,
        sampleRateHertz: 24000,
      },
    });
    const buf = response.audioContent;
    const audioBase64 = Buffer.isBuffer(buf) ? buf.toString("base64") : buf;
    res.json({ audioBase64, mimeType: "audio/mpeg" });
  } catch (err) {
    console.error("tts failed", err);
    res.status(500).json({ error: "tts failed" });
  }
}
