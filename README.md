# Pathway — Hometown Hub

> *AI cinematic tour of your local Olympic + Paralympic hubs.*

🏅 **Built to win Challenge 2: Hometown Success Engine** — the Team USA × Google Cloud "Vibe Code for Gold" hackathon.

🔗 **Live:** https://hometown-hubs-z4qmmgrqoq-uc.a.run.app

---

## The idea

Team USA athletes come from somewhere specific. Every gold medalist, every Paralympian, every Winter Games rookie started in a particular town, on a particular street, at a particular local club, pool, or rink. That geographic story is one of the most powerful narratives in American sport — and almost nobody has access to it.

We wanted to fix that. Not with a dashboard. Not with a static infographic.

We wanted to build something that **engages** every Team USA fan, **educates** them about where Team USA actually comes from, and **inspires** the next generation by showing them the local hubs and facilities they could leverage to take their own first step toward LA28. Any American should be able to type their hometown and see — for themselves, on a map — the Olympic and Paralympic pipeline running through their backyard.

And we didn't want it to feel like a research tool. We wanted it to **pop**.

That meant going all-in on what makes Google Cloud and Gemini special. The streaming agent that thinks visibly. The Photorealistic 3D Tiles that fly you over real buildings. Cloud Text-to-Speech with sentence-exact timepoints so the captions land on every word. Multimodal voice in. Google Search grounding so every facility recommendation cites a real source. The deepest reasoning model on the fullest dataset, paired with a cinematic frame the average hackathon project wouldn't dare attempt.

**That's why we built Pathway.**

---

## How we built it

### Architecture

```
[ 8,525 athletes scraped from teamusa.com ]
            │
            ▼
   Aggregation pipeline
   → hubs.json       (4,718 state × sport hubs)
   → city-hubs.json  (368 cities with sport breakdowns)
   → athletes.raw.json (NAMES stripped at server load — NIL guard layer 1)
            │
            ▼
┌─────────── Cloud Run server ──────────────┐
│ /api/geo-query    ← streaming AI agent    │
│ /api/voice-query  ← multimodal audio in   │
│ /api/pathway      ← personalized engine   │
│ /api/pathway-tour ← cinematic builder     │
│ /api/tour         ← AI Tour generator     │
└───────────────────────────────────────────┘
            │
            ▼
   Frontend (React + Vite, served by same Cloud Run)
   Map Explorer · AI Agent Dock · Pathway · Cinematic Player
```

Pathway is four product surfaces stitched into one continuous experience — discover, ask, personalize, fly.

| Surface | What it does | Gemini usage |
|---|---|---|
| 🗺 **Map Explorer** | 2D Google Maps with hub pins, climate overlay, 91-sport autocomplete, LA28-pipeline toggle | Streaming SSE agent with visible tool calls |
| 💬 **AI Agent Dock** | Top-right console with voice + text input, token streaming, history | Gemini 2.5 Pro + 7 function-calling tools, including `query_athletes` over the full 8,525-record dataset |
| 🛣 **Find Your Pathway** | Hometown → sport-paired facility recommendations, grounded with Google Search | Gemini 2.5 Pro with `tools: [{ googleSearch: {} }]` + citation pass-through to the UI |
| 🎬 **Cinematic Tour** | Photoreal 3D flight through each facility, narrated, captioned | Gemini 2.5 Flash composes narration; Cloud TTS renders SSML with sentence-exact timepoints |

A few design moves we haven't seen elsewhere in this space:

- **Sport-paired tour structure.** Stop 0 is the user's hometown overview with the local sport mix; every subsequent stop is one recommended sport paired with a Google Search-verified facility for that sport.
- **4-tier geocoder cascade.** Google POI → Google address → OpenStreetMap Nominatim → Gemini approximation. Sanity-checked against the state code so the camera never lands in the wrong building.
- **Ground-elevation anchoring.** Open-Meteo elevation per stop, so the photoreal camera and 3D pins anchor on actual terrain instead of WGS84 sea level (which would put Las Vegas at 619m underground).
- **NIL-safe by architecture.** Three layers: names stripped at data load; every system prompt enforces "speak at hub level only"; a server-side regex over all 8,499 name pairs scrubs every narration string before it leaves the server.
- **Adaptive cinematic orbit.** Hometown stops use a wide skyline orbit (1100m); facility stops tighten to 320m at `errorTarget: 6` so suburban buildings render crisp instead of smeared.
- **Olympic / Paralympic parity, mandated by prompt.** Every Pathway plan returns a counterpart sport from the other category. Tour stops carry color-coded sport pills.

---

## Tech stack

### Google Cloud
- **Vertex AI** with **Gemini 2.5 Pro** (agent + Pathway) and **Gemini 2.5 Flash** (tour narration)
- **Google Search grounding** via Vertex (facility verification + citation pass-through)
- **Cloud Run** for the combined frontend / backend service
- **Cloud Storage** for the data bucket
- **Cloud Text-to-Speech** with SSML `<mark>` timepointing
- **Maps JavaScript API** for the 2D Map Explorer
- **Photorealistic 3D Tiles** for the cinematic tour
- **Geocoding API** for facility-level POI lookups
- **Cloud Build** via `gcloud run deploy --source .`

### Frontend
React 18 · Vite · Tailwind CSS · Zustand · Three.js · @react-three/fiber · @react-three/drei · 3d-tiles-renderer · @vis.gl/react-google-maps · @googlemaps/markerclusterer · Server-Sent Events

### Backend
Node.js · Express · ES modules · @google-cloud/vertexai · @google-cloud/storage

### Other APIs
OpenStreetMap Nominatim (geocoding fallback) · Open-Meteo (terrain elevation) · Wikipedia REST API (legacy AI Tour landmark images)

---

## 🔬 Reproducible testing

### Prerequisites

- Node.js 20+ and npm
- A Google Cloud project with these APIs enabled:
  - Vertex AI
  - Cloud Storage
  - Cloud Run
  - Cloud Text-to-Speech
  - Maps JavaScript API
  - Map Tiles API (Photorealistic 3D Tiles)
  - Geocoding API
- `gcloud` CLI authenticated against the project: `gcloud auth login && gcloud config set project YOUR_PROJECT_ID`
- Two Google Maps API keys:
  - **Browser key** — HTTP-referrer-restricted, enabled for Maps JavaScript + Map Tiles
  - **Server key** — no application restrictions, restricted to Geocoding API only:
    ```bash
    gcloud services api-keys create \
      --display-name=hometown-hubs-geocoding \
      --api-target=service=geocoding-backend.googleapis.com
    ```
- A GCS bucket for the aggregated data files (`hubs.json`, `city-hubs.json`, `sport-catalog.json`, `athletes.raw.json`)

### Environment variables

```bash
export GCP_PROJECT=your-project-id
export GCP_LOCATION=us-central1
export GCS_BUCKET=your-bucket-name
export MAPS_API_KEY=AIza...           # browser key (referrer-restricted)
export GOOGLE_GEOCODING_KEY=AIza...   # server key (no app restrictions)
export GEMINI_MODEL=gemini-2.5-pro    # default
```

### Local development

```bash
# 1. Install dependencies
cd server && npm install
cd ../web && npm install

# 2. Seed data once (or pull pre-aggregated files from your GCS bucket)
cd ../scripts && node aggregate-hubs.mjs && node aggregate-cities.mjs

# 3. Run the backend (port 8080)
cd ../server && npm run dev

# 4. In a second terminal, run the frontend (Vite on 5173, proxies /api → :8080)
cd ../web && npm run dev
```

Open http://localhost:5173.

### Smoke tests (against the live server or local)

```bash
URL=https://hometown-hubs-z4qmmgrqoq-uc.a.run.app   # or http://localhost:8080

# Health
curl -s $URL/health

# Hubs aggregate
curl -s $URL/api/hubs | jq '.totals'

# AI Agent (streaming SSE)
curl -sN -X POST "$URL/api/geo-query?stream=1" \
  -H 'content-type: application/json' \
  -d '{"question":"top swimming hubs by state"}'

# Pathway → cinematic chain
PW=$(curl -s -X POST $URL/api/pathway \
  -H 'content-type: application/json' \
  -d '{"city":"Las Vegas","state":"NV","category":"Both"}')
echo "$PW" | jq '.recommendedSports, .paralympicCounterpart, .facilities'

echo "$PW" | curl -s -X POST $URL/api/pathway-tour \
  -H 'content-type: application/json' --data-binary @- | \
  jq '.stops[] | {type, landmark: .landmarks[0].name, lat, lng}'

# AI Tour for a state
curl -s -X POST $URL/api/tour -d '{"state":"CO"}' \
  -H 'content-type: application/json' | jq '.stops[] | {city, lat, lng}'
```

### Deploy to Cloud Run

```bash
bash scripts/deploy.sh
```

The script (one-shot, idempotent):

1. Uploads `data/*.json` to your GCS bucket
2. Builds + deploys the combined frontend / backend service via `gcloud run deploy --source .` (uses Cloud Build automatically)
3. Grants the Cloud Run runtime SA `roles/aiplatform.user` + `roles/storage.objectViewer`
4. Prints the deployed URL

After first deploy, also add the Cloud Run URL pattern to your **browser** Maps API key's HTTP-referrer allowlist.

### Verification matrix

| Check | Expected |
|---|---|
| `GET /health` | `{ ok: true }` |
| `GET /api/hubs` → `.totals.athleteCount` | 4,718 (Olympic + Paralympic) |
| `POST /api/geo-query?stream=1` | SSE events: `started → tool_use → tool_done → token → done` |
| `POST /api/pathway` (Las Vegas / Both) | 3+ recommended sports, ≥2 facilities with `address` + `lat`/`lng`, `paralympicCounterpart` non-null |
| `POST /api/pathway-tour` (piped from above) | 3+ stops with `type: "hometown" \| "facility"`, every facility stop's `landmarks[0].lat/lng` ≈ Google Maps for the address |
| `POST /api/tour` (state=CO) | Stops with landmark coords matching Google POI (e.g. US Olympic & Paralympic Training Center ≈ 38.84, -104.80) |

---

## How it aligns with the judging criteria

The Challenge 2 brief asked for a tool that *"identifies Hubs by correlating geography with the sports Team USA is present in"* with conditional phrasing like *"could help find."* Here's how each rubric beat maps to a concrete Pathway feature:

| Rubric beat | Pathway answer |
|---|---|
| Identifies hubs | Every Team USA hometown across 50 states; AI agent answers per-sport, per-state, per-decade |
| Tangible potential for positive change | Real local facilities the user could visit, grounded in Google Search, plus a cinematic flight through each |
| Conditional language | Every prompt enforces "could / may / potentially"; never "guarantees" |
| Equal Paralympic representation | Every plan mandates a Paralympic counterpart; tour stops color-code by category; sport pills surface category prominently |
| No individual athlete names | Three-layer architectural NIL guard (data strip + prompt rules + regex redactor) |
| Gemini in new ways | Multimodal voice + streaming SSE with visible tool calls + Google Search grounding + Photorealistic 3D Tiles cinematic — all in one product |

---

## 🚀 Try it

**Live:** https://hometown-hubs-z4qmmgrqoq-uc.a.run.app

Type your hometown. Find your pathway. Fly through it in photoreal 3D.

---

## License

Apache License 2.0. See [LICENSE](./LICENSE).
