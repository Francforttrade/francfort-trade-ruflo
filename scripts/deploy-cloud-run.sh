#!/usr/bin/env bash
# One-off manual deploy to Cloud Run, for the first deploy or a quick fix
# outside of Cloud Build. See DEPLOY.md for the one-time project setup this
# depends on (APIs enabled, secrets created, service account permissions).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"
REGION="${CLOUD_RUN_REGION:-southamerica-east1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-ruflo}"
IMAGE="gcr.io/${PROJECT_ID}/ruflo:$(git rev-parse --short HEAD)"

echo "Building ${IMAGE}"
docker build -t "${IMAGE}" .

echo "Pushing ${IMAGE}"
docker push "${IMAGE}"

echo "Deploying ${SERVICE_NAME} to Cloud Run (${REGION})"
gcloud run deploy "${SERVICE_NAME}" \
	--image="${IMAGE}" \
	--region="${REGION}" \
	--platform=managed \
	--project="${PROJECT_ID}" \
	--allow-unauthenticated \
	--set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID}" \
	--set-secrets="ANTHROPIC_API_KEY=francfort-anthropic-api-key:latest,SUPABASE_URL=francfort-supabase-url:latest,SUPABASE_KEY=francfort-supabase-key:latest,SUPABASE_SERVICE_KEY=francfort-supabase-service-key:latest,WEBHOOK_SHARED_SECRET=francfort-whatsapp-webhook-secret:latest"
