# GCP Setup — Hometown Hubs

You've already done `gcloud init`. These steps enable the rest. ~10 minutes total. Run them in your terminal — they need your Google identity.

## 1. Pick a project + verify

```bash
gcloud projects list
gcloud config set project YOUR_PROJECT_ID
gcloud config get-value project    # should print your project id
gcloud auth list                   # should show your account ACTIVE
```

If billing isn't attached to the project, attach it now (Vertex AI + Cloud Run won't run without). $300 free trial covers this hackathon by orders of magnitude.

## 2. Enable the seven APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  maps-backend.googleapis.com \
  tile.googleapis.com
```

| API | Used for |
|---|---|
| `aiplatform.googleapis.com` | Vertex AI (Gemini) |
| `run.googleapis.com` | Cloud Run (combined frontend + API service) |
| `cloudbuild.googleapis.com` + `artifactregistry.googleapis.com` | Used implicitly by `gcloud run deploy --source .` |
| `storage.googleapis.com` | Cloud Storage (holds `hubs.json` + `sport-catalog.json`) |
| `maps-backend.googleapis.com` | Maps JavaScript API |
| `tile.googleapis.com` | Map Tiles API (Photorealistic 3D Tiles) |

## 3. Create the Cloud Storage bucket

```bash
export GCP_LOCATION=us-central1
export GCS_BUCKET=hometown-hubs-data-$(gcloud config get-value project)

gcloud storage buckets create gs://$GCS_BUCKET --location=$GCP_LOCATION
```

Bucket names are globally unique — appending the project id keeps it unique automatically.

## 4. Authenticate the local SDK

```bash
gcloud auth application-default login
# add --no-launch-browser if port 8085 is taken by GastonScraper
```

The `@google-cloud/vertexai` SDK reads these credentials automatically.

## 5. Create a Maps Platform API key

The Photorealistic 3D Tiles renderer is called from the browser, so the key is **public** in the bundle. We lock it down via HTTP-referrer restrictions in the Console.

```bash
gcloud alpha services api-keys create --display-name="hometown-hubs-maps"
gcloud alpha services api-keys list --format="value(displayName,keyString)"
```

Then in the GCP Console (APIs & Services → Credentials → click the key):

1. **Application restrictions** → HTTP referrers → add:
   - `http://localhost:5173/*` (dev)
   - `https://localhost:5173/*` (dev, both protocols)
   - We'll add the Cloud Run URL after deploy
2. **API restrictions** → Restrict key to: **Map Tiles API** + **Maps JavaScript API**

Save.

## 6. Drop me four values

Paste these back to me in chat and I'll run the deploy:

1. **Project ID** (from `gcloud config get-value project`)
2. **Bucket name** (`$GCS_BUCKET`)
3. **Region** (probably `us-central1`)
4. **Maps API key** (`keyString` from step 5)

## 7. (After deploy) tighten the Maps key restriction

Once we have the live Cloud Run URL, add it to the Maps key's HTTP-referrer restrictions:

```
https://hometown-hubs-XXXX-uc.a.run.app/*
```

You can remove the `localhost:5173/*` entries once you're done with local dev.

## Free credits

If you haven't claimed the GCP $300 free trial:
[console.cloud.google.com/billing](https://console.cloud.google.com/billing)

For this hackathon (Vertex AI + Cloud Run + a few thousand Photorealistic 3D Tiles sessions for judges), $300 is way more than enough.

## Troubleshooting

- **"Vertex AI region not supported"** — use `us-central1`, `us-east4`, or `us-west1`. Avoid `us` (multi-region).
- **"Permission denied calling Vertex AI"** — the Cloud Run service account needs `roles/aiplatform.user`. The deploy script (`scripts/deploy.sh`) grants this automatically; if you ever set `--service-account`, re-grant.
- **"Bucket name already taken"** — append a random suffix.
- **Maps API key error in browser console** — referrer not whitelisted. Add the current origin (`http://localhost:5173/*` for dev, the Cloud Run URL for prod) to the key's HTTP referrer restrictions.
- **`gcloud auth application-default login` port conflict** — use `--no-launch-browser`.
