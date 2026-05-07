# Find Your Archetype

A spatial-ready web app that helps any fan discover the **Team USA athlete archetypes** — Olympic and Paralympic, side-by-side — they align with most. Powered by Gemini multimodal agents over 120 years of public Team USA placement data, deployed on Google Cloud.

Built for the **Vibe Code for Gold w/ Google Cloud** hackathon, Challenge 4 (Athlete Archetype Agent).

## What it does

- **Capture biometrics** in your browser via webcam pose detection (no image leaves your device).
- **Voice or text questions** about your interests, environment, and training preferences.
- A **Gemini agent** with function-calling reasons over historical archetype data and surfaces the Olympic AND Paralympic archetypes you align with — equal prominence, equal depth.
- **Optional spatial mode** on Quest 3: same experience in WebXR mixed reality, with hand-tracking biometrics.

## Parity by design

Every archetype panel renders Olympic and Paralympic archetypes side-by-side with equal visual weight and equal narrative depth. Matching never routes by ability — a single user can match Olympic and Paralympic archetypes simultaneously.

## Stack

- **Frontend**: React + Vite + Tailwind + Three.js + WebXR
- **Backend**: Node.js + Express on **Google Cloud Run**
- **AI**: **Gemini** (multimodal + function calling + long context) via **Vertex AI**
- **Data**: Public placement records aggregated to archetype level — no athlete names, images, or timing data.

## Run locally

```bash
# backend
cd server && npm install && npm run dev

# frontend (separate terminal)
cd web && npm install && npm run dev
```

Visit http://localhost:5173 (frontend dev server proxies API calls to the backend).

## Deploy to Cloud Run

See [`server/DEPLOY.md`](./server/DEPLOY.md).

## Data sources

- [teamusa.com](https://www.teamusa.com) — placements (1st/2nd/3rd) and medals only
- Public weather and geographic data

No finish times. No athlete names, images, or likenesses in any output. Olympic and Paralympic data given equal prominence throughout.

## License

Apache License 2.0 — see [`LICENSE`](./LICENSE).
