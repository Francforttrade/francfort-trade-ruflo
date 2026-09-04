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

# PaddleOCR worker (docs/RDIA_PRD.md chunk 2a, services/paddleocr/) is
# deployed separately — see DEPLOY.md item 6. Its URL isn't looked up here
# (unlike cloudbuild.yaml's bash step) since this script has no dependency
# on that service existing yet; export PADDLE_OCR_SERVICE_URL yourself
# before running this once the worker is deployed.
ENV_VARS="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID}"
if [ -n "${PADDLE_OCR_SERVICE_URL:-}" ]; then
	ENV_VARS="${ENV_VARS},PADDLE_OCR_SERVICE_URL=${PADDLE_OCR_SERVICE_URL}"
fi

echo "Deploying ${SERVICE_NAME} to Cloud Run (${REGION})"
gcloud run deploy "${SERVICE_NAME}" \
	--image="${IMAGE}" \
	--region="${REGION}" \
	--platform=managed \
	--project="${PROJECT_ID}" \
	--allow-unauthenticated \
	--set-env-vars="${ENV_VARS}" \
	--set-secrets="ANTHROPIC_API_KEY=francfort-anthropic-api-key:latest,SUPABASE_URL=francfort-supabase-url:latest,SUPABASE_KEY=francfort-supabase-key:latest,SUPABASE_SERVICE_KEY=francfort-supabase-service-key:latest,WEBHOOK_SHARED_SECRET=francfort-whatsapp-webhook-secret:latest"
