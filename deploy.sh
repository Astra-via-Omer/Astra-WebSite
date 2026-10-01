#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 4 ]]; then
  echo "Usage: bash deploy.sh PROJECT_ID REGION ARTIFACT_REPOSITORY RUNTIME_SERVICE_ACCOUNT" >&2
  exit 2
fi
ASTRA_PROJECT="$1"
ASTRA_REGION="$2"
ASTRA_REPOSITORY="$3"
ASTRA_RUNTIME_ACCOUNT="$4"
ASTRA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASTRA_TAG="$(git -C "$ASTRA_ROOT" rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
ASTRA_IMAGE="$ASTRA_REGION-docker.pkg.dev/$ASTRA_PROJECT/$ASTRA_REPOSITORY/astra-website:$ASTRA_TAG"
gcloud auth configure-docker "$ASTRA_REGION-docker.pkg.dev" --quiet
docker build --platform linux/amd64 -t "$ASTRA_IMAGE" "$ASTRA_ROOT"
docker push "$ASTRA_IMAGE"
gcloud run deploy astra-website --project "$ASTRA_PROJECT" --region "$ASTRA_REGION" --image "$ASTRA_IMAGE" --allow-unauthenticated --service-account "$ASTRA_RUNTIME_ACCOUNT" --port 8080 --cpu 1 --memory 512Mi --min-instances 0 --max-instances 3 --concurrency 80 --quiet
ASTRA_URL="$(gcloud run services describe astra-website --project "$ASTRA_PROJECT" --region "$ASTRA_REGION" --format='value(status.url)')"
curl --fail --retry 5 --retry-delay 3 "$ASTRA_URL/health"
echo
echo "Website: $ASTRA_URL"
