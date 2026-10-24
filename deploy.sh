#!/usr/bin/env bash
set -euo pipefail
# Production releases are executed only by the checked main-branch CI workflow.
ASTRA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ASTRA_ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Commit or stash local changes before requesting a release." >&2; exit 1; }
git fetch origin main --quiet
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || { echo "Use the current origin/main commit for a production release." >&2; exit 1; }
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run build
gh workflow run deploy.yml --ref main --repo https://github.com/Astra-via-Omer/Astra-WebSite
echo "Checked main-branch release requested in GitHub Actions."
