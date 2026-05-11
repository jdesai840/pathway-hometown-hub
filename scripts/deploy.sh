#!/usr/bin/env bash
# One-shot deploy of the Hometown Hubs combined Cloud Run service.
#
# Required env vars (export before running):
#   GCP_PROJECT     — your GCP project id
#   GCP_LOCATION    — Vertex AI region (e.g. us-central1)
#   GCS_BUCKET      — bucket holding hubs.json + sport-catalog.json
#   MAPS_API_KEY    — Maps Platform API key (HTTP-referrer-restricted)
#
# Optional:
#   GEMINI_MODEL    — default gemini-2.5-pro
#   SERVICE_NAME    — default hometown-hubs

set -euo pipefail

: "${GCP_PROJECT:?GCP_PROJECT not set}"
: "${GCP_LOCATION:?GCP_LOCATION not set}"
: "${GCS_BUCKET:?GCS_BUCKET not set}"
: "${MAPS_API_KEY:?MAPS_API_KEY not set}"

GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-pro}"
SERVICE_NAME="${SERVICE_NAME:-hometown-hubs}"

# Run from the repo root regardless of where the user invoked the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Repo: $ROOT_DIR"
echo "==> Project: $GCP_PROJECT  Region: $GCP_LOCATION  Bucket: $GCS_BUCKET"
echo

# 1. Upload data files (idempotent — re-runs overwrite)
echo "==> Uploading data files to gs://$GCS_BUCKET/"
gcloud storage cp data/hubs.json "gs://$GCS_BUCKET/hubs.json"
gcloud storage cp data/sport-catalog.json "gs://$GCS_BUCKET/sport-catalog.json"
gcloud storage cp data/city-hubs.json "gs://$GCS_BUCKET/city-hubs.json"
gcloud storage cp data/athletes.raw.json "gs://$GCS_BUCKET/athletes.raw.json"
echo

# 2. Deploy the combined service
echo "==> Deploying Cloud Run service '$SERVICE_NAME'..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$GCP_PROJECT" \
  --region "$GCP_LOCATION" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --set-env-vars "GCP_PROJECT=$GCP_PROJECT,GCP_LOCATION=$GCP_LOCATION,GCS_BUCKET=$GCS_BUCKET,MAPS_API_KEY=$MAPS_API_KEY,GOOGLE_GEOCODING_KEY=${GOOGLE_GEOCODING_KEY:-},GEMINI_MODEL=$GEMINI_MODEL"

# 3. Resolve the runtime service account and grant required IAM (idempotent)
echo
echo "==> Granting runtime service account permissions..."
SA=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$GCP_PROJECT" --region "$GCP_LOCATION" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)

if [ -z "$SA" ]; then
  # Default Compute Engine SA is the Cloud Run default when no custom SA is set
  SA=$(gcloud iam service-accounts list \
    --project "$GCP_PROJECT" \
    --filter="email~compute@developer" \
    --format='value(email)' | head -1)
fi
echo "    runtime SA: $SA"

gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user" \
  --condition=None >/dev/null

gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectViewer" >/dev/null

# 4. Print the deployed URL
URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$GCP_PROJECT" --region "$GCP_LOCATION" \
  --format='value(status.url)')

echo
echo "================================================================"
echo "Deployed: $URL"
echo "================================================================"
echo
echo "Smoke test:"
echo "  curl -s $URL/health"
echo "  curl -s $URL/api/config"
echo "  curl -s $URL/api/hubs | jq '.totals'"
echo "  curl -s -X POST $URL/api/geo-query -H 'Content-Type: application/json' \\"
echo "    -d '{\"question\":\"Where does Team USA curling come from?\"}' | jq"
echo
echo "Don't forget: in the GCP Console, add $URL/* to the Maps API key's"
echo "HTTP referrer restrictions, or the photorealistic map will be blocked."
