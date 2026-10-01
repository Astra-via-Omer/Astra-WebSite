# Astra-Via public website

The ten-scene Astra story becomes an immersive, full-screen journey. Scrolling drives camera-like zoom, lateral movement and blended transitions between the original slide environments. Pointer movement adds parallax to the background, artwork, orbital lines and foreground particles. “Look closer” zooms toward the current scene and reveals its supporting explanation.

This standalone website lives in [Astra-WebSite](https://github.com/Astra-via-Omer/Astra-WebSite). Its public Cloud Run service defaults to `astra-website`. The authenticated personal workspace remains a separate repository and service.

## Technology

- Next.js 15, React 19 and TypeScript provide server-rendered page content and client interactions.
- Layered image planes, CSS perspective and transforms create the dimensional background directly from the slide artwork. These are depth effects on raster images, rather than reconstructed 3D meshes.
- A requestAnimationFrame timeline follows native scrolling and updates scale, depth, position and blending without rendering React on every frame.
- Optimized WebP versions of the ten approved concept frames are committed under `public/story/`.
- A multi-stage Node 22 Docker image serves the standalone Next.js output on `0.0.0.0:$PORT`.
- GitHub Actions uses Google Workload Identity Federation rather than a stored service-account key.

The original images contain raster typography. The site uses the visual portion as a full-screen environment and renders accessible HTML copy separately. Mobile places the artwork above the copy in the same immersive viewport. Reduced-motion preferences use static scene changes and disable parallax and zoom. Scene navigation supports buttons and left/right arrow keys.

## Run locally

```sh
npm ci
npm run dev -- --port 3200
```

Open http://localhost:3200. Development uses `.next-dev` so production builds do not disrupt a running preview.

```sh
npm run build
npm audit --omit=dev --audit-level=high
docker build --platform linux/amd64 -t astra-website:preview .
docker run --rm -p 3201:8080 astra-website:preview
```

The root page and `/health` must both respond successfully.

## Deploy from GitHub

The workflow `.github/workflows/check.yml` validates pull requests. Every push to `main` runs `.github/workflows/deploy.yml`: dependency audit, production build, Docker image push, Cloud Run deployment and a health check. Failed validation prevents deployment. Manual deployment is also available from `main`. Production deploys run sequentially to avoid overlapping releases.

Create a GitHub environment named `website-production` without required reviewers for automatic deployment. Restrict it to the `main` branch. Configure these environment variables:

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | Intended Google Cloud project ID |
| `GCP_CLOUD_RUN_SERVICE` | Optional service name; defaults to `astra-website` |
| `GCP_REGION` | Region for Artifact Registry and Cloud Run |
| `GCP_ARTIFACT_REPOSITORY` | Existing Docker Artifact Registry repository |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full Workload Identity provider resource |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | Deployment service account email |
| `GCP_RUNTIME_SERVICE_ACCOUNT` | Dedicated website runtime service account email |

Enable Cloud Run and Artifact Registry APIs. Configure the provider to trust this GitHub repository, with repository and environment restrictions. Grant its GitHub principal Workload Identity User on the deployment service account.

The deployment account has Artifact Registry Writer on the image repository, Cloud Run Developer on the existing `astra-website` service, and Service Account User on the dedicated runtime account. Public invocation is configured during initial provisioning. The workflow updates that existing service without changing its access policy. The website runtime needs no application-data or provider-secret access. Use a dedicated runtime account.

Push or merge changes into `main`, or run **Deploy Astra public website** manually from `main`. It creates or updates `astra-website`, allows public invocation, scales from zero to at most three instances, and verifies `/health`. The workflow summary records the resulting URL.

## Manual deployment

Once the project, region, Artifact Registry repository and runtime account are chosen:

```sh
bash deploy.sh PROJECT_ID REGION ARTIFACT_REPOSITORY RUNTIME_SERVICE_ACCOUNT
```

This builds a Linux AMD64 image, pushes it to Artifact Registry, deploys only the public website and prints its verified URL.

## Positioning

Astra-Via is presented as pioneering **Web3 RaaS — Result as a Service** for the AI era. The story explains the intended outcome: an inspectable review with sources, reasoning and unresolved questions. Blockchain provenance, decentralized evidence storage and portable results are roadmap capabilities, not features implemented by this marketing website or the current document demo. “Pioneering” expresses the ambition; an unverified “world’s first” claim is not published.

## Scope of the example

The experience presents Astra's story; it does not call the analysis API, accept uploads or collect contact information. Current document review and the broader verification-infrastructure vision are described separately in the copy.

## References

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)
- [Google Workload Identity Federation for deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

## Connected production destination

- Project: `astra-via`
- Region: `me-west1`
- Cloud Run service: `astra-website`
- Image repository: `astra-images`
- Runtime account: `astra-site-runtime@astra-via.iam.gserviceaccount.com`
- Deployment account: `astra-site-deploy@astra-via.iam.gserviceaccount.com`
- GitHub authentication: Workload Identity Federation, restricted to repository ID `1400569187`, `main`, and the `website-production` environment. No long-lived Google service-account key is stored in GitHub.
