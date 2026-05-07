# Deploy to Cloud Run

## One-time setup

```bash
# replace with your project id
export GCP_PROJECT=your-project-id
export GCP_LOCATION=us-central1
export GCS_BUCKET=find-your-archetype-data

gcloud config set project $GCP_PROJECT

# enable APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com

# create bucket for archetype dataset
gcloud storage buckets create gs://$GCS_BUCKET --location=$GCP_LOCATION
```

## Deploy

From the `server/` directory:

```bash
gcloud run deploy find-your-archetype \
  --source . \
  --region $GCP_LOCATION \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT=$GCP_PROJECT,GCP_LOCATION=$GCP_LOCATION,GCS_BUCKET=$GCS_BUCKET"
```

## Service account permissions

The Cloud Run runtime service account needs:

- `roles/aiplatform.user` (Vertex AI Gemini calls)
- `roles/storage.objectViewer` on the bucket (reading archetypes.json)

```bash
SA=$(gcloud run services describe find-your-archetype --region $GCP_LOCATION --format='value(spec.template.spec.serviceAccountName)')
[ -z "$SA" ] && SA=$(gcloud iam service-accounts list --filter="email~compute@developer" --format='value(email)' | head -1)

gcloud projects add-iam-policy-binding $GCP_PROJECT \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"

gcloud storage buckets add-iam-policy-binding gs://$GCS_BUCKET \
  --member="serviceAccount:$SA" --role="roles/storage.objectViewer"
```
