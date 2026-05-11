# Pathway — Hometown Hub

> *AI cinematic tour of your local Olympic + Paralympic hubs.*

🏅 **Built to win Challenge 2: Hometown Success Engine.**

Pathway is the personalized engine that answers two questions for every American:

1. **Where does Team USA come from?** Every Olympic and Paralympic athlete's hometown mapped to a single 50-state hub graph.
2. **What could that mean for me?** Type your hometown → get a sport-by-sport plan with real local facilities → fly through them in a photoreal 3D cinematic.

Two missions, equal weight:

| Goal | What it looks like in Pathway |
|---|---|
| 📚 **Educate** | Map Explorer surfaces all **8,525** Team USA athletes across **368** cities, with category / sport filters and a streaming AI agent that answers fine-grained questions over the full dataset. |
| 🚀 **Inspire** | "Find Your Pathway" takes any hometown and surfaces real local facilities (universities, training centers, clubs) the next generation could actually visit — then flies the user through them in a photoreal 3D cinematic. |

---

## 💡 What inspired us

Team USA athletes don't appear from nowhere. They come from **specific places** — Cleveland's diving belt, Iowa's wrestling rooms, Hawaii's surf breaks, Alaska's biathlon trails, Minnesota's curling stones. But until now there was no way to see that pipeline laid out alongside the **real facilities** that could help a kid in those towns take their first step.

We wanted to build the bridge: turn the country's geography into a **living engine** of Olympic and Paralympic possibility, then let it answer "what could I do about it?" — for fans AND aspiring athletes.

The Challenge 2 prompt asked for *"a tool that identifies Hubs by correlating geography with the sports Team USA is present in… avoid implying that geography guarantees results; use conditional phrasing like 'could help find.'"* That's exactly the spirit we built around — **discovery, then conditional, inspiring action**.

---

## 🏗 How we built it

Pathway sits on a deeply integrated Google Cloud stack with **Gemini at the center** for reasoning, multimodal input, and grounded recommendations.

### Core data flow

```
[ 8,525 athletes scraped from teamusa.com ]
            │
            ▼
   Aggregation pipeline
   → hubs.json       (4,718 state × sport hubs)
   → city-hubs.json  (368 cities with sport breakdowns)
   → athletes.raw.json (NAMES stripped at server load time)
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
| 💬 **AI Agent Dock** | Top-right "Pathway console" with voice + text input, token streaming, history | Gemini 2.5 Pro + 7 function-calling tools, including `query_athletes` over the full 8,525-record dataset |
| 🛣 **Find Your Pathway** | Hometown → sport-paired facility recommendations, grounded with Google Search | Gemini 2.5 Pro with `tools: [{ googleSearch: {} }]` + citation pass-through to the UI |
| 🎬 **Cinematic Tour** | Photoreal 3D flight through each facility, narrated, captioned | Gemini 2.5 Flash composes narration; Cloud TTS renders SSML with sentence-exact timepoints |

### Architectural moves we haven't seen elsewhere

- **Sport-paired tour structure.** Stop 0 = your hometown overview with the local sport mix. Stops 1..N = one stop per recommended sport, each centered on a Google Search–verified facility.
- **4-tier geocoder cascade.** Google POI → Google address → OpenStreetMap Nominatim → Gemini-approximation. Sanity-checked against the state code so the camera never lands in the wrong building (caught a Nevada → Texas geocode bug in testing).
- **Ground-elevation anchoring.** Open-Meteo elevation per stop, so the photoreal camera and 3D pins anchor on the actual terrain instead of WGS84 sea level (which would put Las Vegas at 619m underground).
- **NIL-safe by architecture.** Athlete names stripped at data load, every prompt enforces "speak at hub level only," and a server-side regex over **all 8,499** name pairs runs as a final scrubber on every narration string before it leaves the server.
- **Adaptive cinematic orbit.** Hometown stops use a wide skyline orbit (1100m radius); facility stops tighten to 320m at `errorTarget: 6`, so individual suburban buildings render crisp instead of smeared.
- **Olympic / Paralympic parity, mandated by prompt.** Every Pathway plan returns a counterpart sport from the other category. Tour stops carry color-coded sport pills. Both categories get equal screen time.

---

## 🧰 Tech stack

### Google Cloud
- **Vertex AI** with **Gemini 2.5 Pro** (agent + Pathway) and **Gemini 2.5 Flash** (tour narration)
- **Google Search grounding** via Vertex (facility verification + citation pass-through)
- **Cloud Run** for the combined frontend / backend service
- **Cloud Storage** for the data bucket
- **Cloud Text-to-Speech** with SSML `<mark>` timepointing for sentence-exact captions
- **Maps JavaScript API** for the 2D Map Explorer
- **Photorealistic 3D Tiles** for the cinematic tour
- **Geocoding API** for facility-level POI lookups
- **Cloud Build** via `gcloud run deploy --source .`

### Frontend
React 18 · Vite · Tailwind CSS · Zustand · Three.js · @react-three/fiber · @react-three/drei · 3d-tiles-renderer · @vis.gl/react-google-maps · @googlemaps/markerclusterer · Server-Sent Events

### Backend
Node.js · Express · ES modules · @google-cloud/vertexai · @google-cloud/storage

### Other APIs
OpenStreetMap Nominatim (geocoding fallback) · Open-Meteo (terrain elevation) · Wikipedia REST API (landmark images)

---

## 🤔 What we learned

A few things really crystallized during this build:

**1. Geometry beats numerics for "is the pin in the right place."** We spent hours debugging "the pin is off by 30 meters" before realizing the coordinate pipeline was already pixel-accurate. The pin's bottom-anchor was 30m *above* the GPS point, which under the cinematic's oblique camera tilt projects to a horizontal screen offset:

$$\Delta x_{screen} \approx h_{above\,ground} \cdot \tan(\theta_{tilt})$$

At a 45° tilt that's a 30m horizontal shift — exactly "across the parking lot." Drop the anchor from \\(h = 30\\,m\\) to \\(h = 2\\,m\\), and the offset collapses to sub-meter. The fix was geometric, not numerical.

**2. POI geocoding > address geocoding for buildings.** Nominatim resolves street addresses cleanly, but Google's POI database directly maps `"Southern Nevada Desert Mermaids"` to `"Pavilion Center Dr Pool"` with a *building-centroid* coordinate (more precise than the parcel centroid an address returns). We trust the POI hit only when Google tags it `point_of_interest` or `establishment`, otherwise we fall through.

**3. Grounding turns Gemini from "knows about" to "verified."** Adding `tools: [{ googleSearch: {} }]` made the Pathway agent's facility recommendations cite real-world sources, which we surface as clickable citation chips in the result UI. The difference between "the model may know" and "the model just looked it up" is the difference between *demo* and *product*.

**4. Streaming visibility wins demos.** Once we surfaced tool calls live (`🔍 query_athletes · curling / MN → 91 matched`), the agent stopped feeling like a magic box and started feeling like a research assistant. Watching the model think is a feature.

**5. API keys can be referrer-trapped.** Our Maps key has HTTP-referrer restrictions for browser-side use (Photoreal Tiles, Maps JS). Google's Geocoding API explicitly rejects any referrer-restricted key for server-side calls. Fix: a separate server-only key created via `gcloud services api-keys create` with no application restrictions, scoped to Geocoding API only.

---

## 😅 Challenges we faced

| Challenge | What broke | How we fixed it |
|---|---|---|
| **Pin drift over Vegas** | Camera + pin anchored at WGS84 sea level → 619m under the Strip → photoreal tiles failed | Open-Meteo elevation lookup per stop, plus +2m pin offset that survives Open-Meteo / Google-tile elevation disagreement |
| **Mermaids in a parking lot** | Camera 1100m from a suburban swim club; tile detail at cost-optimized LOD | Adaptive orbit (240–400m for facility stops) + `useRecommendedSettings: false` with manual `errorTarget = 6` |
| **NIL drift risk** | Gemini's training data knows famous Team USA athletes — one slip = disqualification | Three-layer defense: data stripping at load, prompt rules in every system prompt, server-side regex over **all 8,499 name pairs** scrubbing every narration |
| **Citations read aloud** | Cloud TTS was speaking `"(per cleveland.edu)"` in the cinematic | `stripCitations()` regex kills URLs, `[N]` markers, and parenthetical domains before narration ships |
| **Alaska + Hawaii clipped** | Map restriction capped at `north: 60, west: -135` — Fairbanks (64.8°N) and Honolulu (-157°W) unreachable | Widened to `{ north: 72, south: 18, west: -170, east: -60 }` — all 50 states |
| **Sandpipers in Texas** | Nominatim's suffix-strip retry matched "Robert F" in San Angelo when the facility was in Cleveland, OH | Sanity check: reject hits >100 mi from the Gemini-approx coord OR with state code missing from formatted address |
| **Counterpart mislabel** | Selecting Paralympic + getting Boxing as counterpart still rendered as "Paralympic Counterpart" with amber styling | Server echoes `category`; UI flips title to "Olympic counterpart" and auto-detects sport color from the name prefix |
| **Voice-query 500** | New `query_athletes` tool advertised via `geoTools` but the handler was only wired in `geoQuery.js`, not `voiceQuery.js` | Extracted `buildGeoToolHandlers()` into a shared module — both routes use the same 7-tool factory |

---

## 🎬 What you'll see in the demo

1. Open with the **Map Explorer** showing all 8,525 Team USA athletes mapped across 50 states — Olympic blue, Paralympic amber, equal billing throughout.
2. Ask the **agent**: *"What small towns in North Carolina have the most Olympic representation?"* Watch tool calls stream in live, then a grounded answer naming Huntersville (3), Holly Springs (2), Davidson (2) with climate-region context.
3. Click **Find Your Pathway**, type `Las Vegas, NV` + select Paralympic. Multi-stage loading animation runs while Gemini composes with Google Search grounding.
4. The Pathway plan returns: **Wheelchair Basketball** + **Para Swimming** with real Las Vegas-area facilities. **Boxing** appears as the *Olympic* counterpart (the parity rule mandates it). Every facility has a verified Google Maps address — click to open in Maps directly.
5. Click **🎬 Take the cinematic tour.** The photoreal 3D camera flies from your hometown to each real facility — Pavilion Center Pool, UNLV Swimming & Diving, Barry's Boxing Center — with sport pills in the top-left, captions streaming sentence-by-sentence with Cloud TTS, and labeled pins anchored exactly on each building.

---

## 🏆 Why this wins Challenge 2

The challenge brief asked for a tool that *"identifies Hubs by correlating geography with the sports Team USA is present in"* and uses conditional phrasing like *"could help find."*

Pathway IS that tool — and then it goes one step further:

| Rubric beat | Pathway answer |
|---|---|
| ✅ **Identifies hubs** | Every Team USA hometown across 50 states; AI agent answers per-sport, per-state, per-decade |
| ✅ **Tangible potential for positive change** | Real local facilities the user could visit, grounded in Google Search, plus a cinematic flight through each |
| ✅ **Conditional language** | Every prompt enforces "could / may / potentially"; never "guarantees" |
| ✅ **Equal Paralympic representation** | Every plan mandates a Paralympic counterpart; tour stops color-code by category; sport pills surface category prominently |
| ✅ **No individual athlete names** | Three-layer architectural NIL guard (data strip + prompt rules + regex redactor) |
| ✅ **Gemini in new ways** | Multimodal voice + streaming SSE with visible tool calls + Google Search grounding + Photoreal 3D Tiles cinematic — all in one product |
| ✅ **Fan-centric question** | "What does Team USA mean for ME?" answered in two acts: discover, then experience |

This is the **Hometown Success Engine**, built end-to-end on Google Cloud. The challenge phrasing called for *"could help find."* We built the engine that **finds**.

---

## 🚀 Try it

**Live:** https://hometown-hubs-z4qmmgrqoq-uc.a.run.app

Type your hometown. Find your pathway. Fly through it in photoreal 3D.
