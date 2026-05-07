# GCP Setup for Find Your Archetype

You said you have a GCP account already. These steps enable the specific APIs we need and create the Cloud Storage bucket. ~10 minutes total.

> Run these in your terminal, **not** in this Claude session — they need your Google identity.

## 1. Pick (or note) your project

```bash
# list projects
gcloud projects list

# set the project you want to use
gcloud config set project YOUR_PROJECT_ID
```

If you don't have a billing account attached, attach one — Vertex AI + Cloud Run won't work without billing enabled. Free-tier is fine for this hackathon's traffic.

## 2. Enable the APIs we use

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com
```

What each one is for:
- **`aiplatform.googleapis.com`** — Vertex AI (the home of Gemini)
- **`run.googleapis.com`** — Cloud Run (where our backend deploys)
- **`cloudbuild.googleapis.com`** — Cloud Build (used implicitly by `gcloud run deploy --source`)
- **`artifactregistry.googleapis.com`** — Artifact Registry (Cloud Build pushes the Docker image here)
- **`storage.googleapis.com`** — Cloud Storage (holds `archetypes.json`)

## 3. Create the Cloud Storage bucket

```bash
export GCP_LOCATION=us-central1   # any region with Vertex AI; us-central1 is safe
export GCS_BUCKET=find-your-archetype-data-$(gcloud config get-value project)

gcloud storage buckets create gs://$GCS_BUCKET --location=$GCP_LOCATION
```

(Bucket names are globally unique — appending the project id keeps it unique without you thinking.)

## 4. Authenticate the local CLI for Vertex AI calls

For running the build-time Gemini scripts (`distill`, `cluster`) from your laptop:

```bash
gcloud auth application-default login
```

This opens a browser, you approve, and the credentials get cached locally. The `@google-cloud/vertexai` SDK picks them up automatically.

## 5. Tell me your project ID

When you're done, drop me the project id in chat. I'll wire it into env-var examples and we'll run the real Gemini pipeline:

```bash
# what I'll run from /scripts after you confirm
export GCP_PROJECT=your-project-id
export GCP_LOCATION=us-central1
npm run distill   # Gemini distills per-sport profiles (~120KB context, 1-2 min)
npm run cluster   # Gemini clusters into 5 Olympic + 5 Paralympic archetypes
```

Then upload the result to GCS and deploy to Cloud Run:

```bash
gcloud storage cp data/archetypes.json gs://$GCS_BUCKET/archetypes.json

cd server
gcloud run deploy find-your-archetype \
  --source . \
  --region $GCP_LOCATION \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT=$GCP_PROJECT,GCP_LOCATION=$GCP_LOCATION,GCS_BUCKET=$GCS_BUCKET"
```

That's the full deployment. The Cloud Run service hits Vertex AI for matching/narration via its service account — no API keys.

## Free credits

If you haven't claimed the GCP $300 free trial, you can do that in the [Google Cloud Console billing page](https://console.cloud.google.com/billing). For this hackathon's traffic (Vertex AI + Cloud Run), $300 is *way* more than enough.

## Troubleshooting

- **"Vertex AI region not supported"** — use `us-central1`, `us-east4`, or `us-west1`. Avoid `us` (multi-region).
- **"Permission denied calling Vertex AI"** — the Cloud Run service account needs `roles/aiplatform.user`. See `server/DEPLOY.md` for the IAM commands.
- **"Bucket name already taken"** — the bucket name must be globally unique. Append a random suffix.
