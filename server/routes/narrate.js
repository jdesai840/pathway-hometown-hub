import { VertexAI } from "@google-cloud/vertexai";
import { loadHubs } from "../lib/hubs.js";
import { narrateHubSystemPrompt } from "../lib/geoPrompts.js";
import { redactNames } from "../lib/nilGuard.js";

const PROJECT = process.env.GCP_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

// Generate a narration for a state hub or (state, sport) combo.
// Body: { state, sport? } — at minimum state must be set.
export async function narrate(req, res) {
  const { state, sport } = req.body || {};
  if (!state) return res.status(400).json({ error: "state is required" });

  try {
    const hubsDoc = await loadHubs();
    const stateUpper = state.toUpperCase();
    const stateTotals = hubsDoc.stateTotals?.[stateUpper];
    if (!stateTotals) return res.status(404).json({ error: `no hubs for state ${stateUpper}` });

    const stateHubs = hubsDoc.hubs
      .filter((h) => h.state === stateUpper)
      .sort((a, b) => b.recencyWeight - a.recencyWeight)
      .slice(0, 6);

    const focused = sport
      ? stateHubs.find((h) => h.sport.toLowerCase().includes(sport.toLowerCase()))
      : null;

    if (!PROJECT) {
      // Mock narration for local dev
      const top = stateHubs[0];
      const txt = focused
        ? `${stateUpper} could carry meaningful momentum in ${focused.sport}, with ${focused.athleteCount} athletes spanning ${focused.earliestYear} to ${focused.latestYear}. Olympic and Paralympic athletes from this state alike could shape the LA28 picture.`
        : `${stateUpper} has produced ${stateTotals.athleteCount} Team USA athletes overall (${stateTotals.byCategory.Olympic} Olympic, ${stateTotals.byCategory.Paralympic} Paralympic). The strongest current momentum may be in ${top?.sport}, but the depth here spans many disciplines equally.`;
      return res.json({ narration: txt, mock: true });
    }

    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertex.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: narrateHubSystemPrompt() }] },
      generationConfig: { temperature: 0.7 },
    });

    const context = { state: stateUpper, stateTotals, stateHubs, focused: focused || null };
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: `Hub context (JSON): ${JSON.stringify(context)}` },
            {
              text:
                "Write a 3-4 sentence narration in second person, conditional language, " +
                "Olympic and Paralympic context with equal weight, no individual athletes.",
            },
          ],
        },
      ],
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.json({ narration: await redactNames(text) });
  } catch (err) {
    console.error("narrate failed", err);
    res.status(500).json({ error: "narrate failed" });
  }
}
