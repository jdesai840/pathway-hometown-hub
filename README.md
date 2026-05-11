# Pathway — Hometown Hub

> *AI cinematic tour of your local Olympic + Paralympic hubs.*

🏅 **Built to win Challenge 2: Hometown Success Engine** — the Team USA × Google Cloud "Vibe Code for Gold" hackathon.

🔗 **Live:** https://hometown-hubs-z4qmmgrqoq-uc.a.run.app

---

## 🎯 What it does

Pathway answers two questions for every American:

1. **Where does Team USA come from?** — Every Olympic and Paralympic athlete's hometown mapped to a single 50-state hub graph.
2. **What could that mean for me?** — Type your hometown → get a sport-by-sport plan with real local facilities → fly through them in a photoreal 3D cinematic.

Two missions, equal weight:

| Goal | What it looks like in Pathway |
|---|---|
| 📚 **Educate** | Map Explorer surfaces all **8,525** Team USA athletes across **368** cities, with category / sport filters and a streaming AI agent over the full dataset. |
| 🚀 **Inspire** | "Find Your Pathway" takes any hometown and surfaces real local facilities (universities, training centers, clubs) the next generation could actually visit — then flies the user through them in a photoreal 3D cinematic. |

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

## 💡 What inspired us

Team USA athletes don't appear from nowhere. They come from **specific places** — Cleveland's diving belt, Iowa's wrestling rooms, Hawaii's surf breaks, Alaska's biathlon trails, Minnesota's curling stones. But until now there was no way to see that pipeline laid out alongside the **real facilities** that could help a kid in those towns take their first step.

We wanted to build the bridge: turn the country's geography into a **living engine** of Olympic and Paralympic possibility, then let it answer "what could I do about it?" — for fans AND aspiring athletes.

The Challenge 2 brief asked for a tool that *"identifies Hubs by correlating geography with the sports Team USA is present in"* and uses conditional phrasing like *"could help find."* That's exactly the spirit we built around — **discovery, then conditional, inspiring action**.

---

## 🏗 How we built it

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

### The four product surfaces

| Surface | What it does | Gemini usage |
|---|---|---|
| 🗺 **Map Explorer** | 2D Google Maps with hub pins, climate overlay, 91-sport autocomplete, LA28-pipeline toggle | Streaming SSE agent with visible tool calls |
| 💬 **AI Agent Dock** | Top-right console with voice + text input, token streaming, history | Gemini 2.5 Pro + 7 function-calling tools, including `query_athletes` over the full 8,525-record dataset |
| 🛣 **Find Your Pathway** | Hometown → sport-paired facility recommendations, grounded with Google Search | Gemini 2.5 Pro with `tools: [{ googleSearch: {} }]` + citation pass-through to the UI |
| 🎬 **Cinematic Tour** | Photoreal 3D flight through each facility, narrated, captioned | Gemini 2.5 Flash composes narration; Cloud TTS renders SSML with sentence-exact timepoints |

### Architectural moves we haven't seen elsewhere

- **Sport-paired tour structure.** Stop 0 = hometown overview with the local sport mix. Stops 1..N = one stop per recommended sport, each centered on a Google Search-verified facility.
- **4-tier geocoder cascade.** Google POI → Google address → OpenStreetMap Nominatim → Gemini approximation. Sanity-checked against the state code so the camera never lands in the wrong building.
- **Ground-elevation anchoring.** Open-Meteo elevation per stop, so the photoreal camera and 3D pins anchor on actual terrain instead of WGS84 sea level (which would put Las Vegas at 619m underground).
- **NIL-safe by architecture.** Three layers: names stripped at data load; every system prompt enforces "speak at hub level only"; a server-side regex over all 8,499 name pairs scrubs every narration string before it leaves the server.
- **Adaptive cinematic orbit.** Hometown stops use a wide skyline orbit (1100m); facility stops tighten to 320m at `errorTarget: 6` so suburban buildings render crisp instead of smeared.
- **Olympic / Paralympic parity, mandated by prompt.** Every Pathway plan returns a counterpart sport from the other category. Tour stops carry color-coded sport pills.

---

## 🧰 Tech stack

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

## 🤔 What we learned

**Geometry beats numerics for "is the pin in the right place."** Spent hours debugging "the pin is off by 30 meters" before realizing the coordinate pipeline was already pixel-accurate. The pin's bottom-anchor was 30m *above* the GPS point, which under the cinematic's oblique camera tilt projects to a horizontal screen offset:

$$\Delta x_{screen} \approx h_{above\,ground} \cdot \tan(\theta_{tilt})$$

At a 45° tilt that's a 30m horizontal shift — "across the parking lot." Drop the anchor from \\(h = 30\\,m\\) to \\(h = 2\\,m\\), and the offset collapses to sub-meter. The fix was geometric, not numerical.

**POI geocoding > address geocoding for buildings.** Google's POI database directly maps `"Southern Nevada Desert Mermaids"` to `"Pavilion Center Dr Pool"` with a building-centroid coordinate (more precise than the parcel centroid an address returns). We trust POI hits only when Google tags them `establishment` / `point_of_interest`; otherwise we fall through to address → Nominatim → Gemini approximation.

**Grounding turns Gemini from "knows about" to "verified."** Adding `tools: [{ googleSearch: {} }]` made the Pathway agent's facility recommendations cite real-world sources, which we surface as clickable citation chips. The difference between "the model may know" and "the model just looked it up" is the difference between *demo* and *product*.

**Streaming visibility wins demos.** Surfacing tool calls live (`🔍 query_athletes · curling / MN → 91 matched`) made the agent stop feeling like a magic box and start feeling like a research assistant. Watching the model think IS a feature.

**API keys can be referrer-trapped.** Our browser Maps key has HTTP-referrer restrictions (for Maps JS + Photoreal Tiles). Google's Geocoding API explicitly rejects any referrer-restricted key for server-side calls. Fix: a separate server-only key via `gcloud services api-keys create` with no application restrictions, scoped to Geocoding API only.

---

## 🏆 Why this wins Challenge 2

The brief asked for a tool that *"identifies Hubs by correlating geography with the sports Team USA is present in"* and uses conditional phrasing like *"could help find."*

| Rubric beat | Pathway answer |
|---|---|
| ✅ Identifies hubs | Every Team USA hometown across 50 states; AI agent answers per-sport, per-state, per-decade |
| ✅ Tangible potential for positive change | Real local facilities the user could visit, grounded in Google Search, plus a cinematic flight through each |
| ✅ Conditional language | Every prompt enforces "could / may / potentially"; never "guarantees" |
| ✅ Equal Paralympic representation | Every plan mandates a Paralympic counterpart; tour stops color-code by category; sport pills surface category prominently |
| ✅ No individual athlete names | Three-layer architectural NIL guard (data strip + prompt rules + regex redactor) |
| ✅ Gemini in new ways | Multimodal voice + streaming SSE with visible tool calls + Google Search grounding + Photoreal 3D Tiles cinematic — all in one product |

This is the **Hometown Success Engine** — built end-to-end on Google Cloud. The brief called for *"could help find."* We built the engine that **finds**.

---

## 🚀 Try it

**Live:** https://hometown-hubs-z4qmmgrqoq-uc.a.run.app

Type your hometown. Find your pathway. Fly through it in photoreal 3D.

---

## License

MIT. See [LICENSE](./LICENSE).
