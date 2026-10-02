# Workspace domain and public demo entry

Requested hostname: `workspace.astra-via.com` (spelling confirmed by the user).

## Routing

- GoDaddy A record: `workspace` → `34.49.17.123`.
- Existing global external Application Load Balancer: `astra-website-lb`.
- Host rule for `workspace.astra-via.com` uses path matcher `astra-workspace`, default backend `astra-workspace-backend`.
- Serverless NEG: `astra-workspace-neg`, me-west1, pointing to the existing Cloud Run service `astra-web`.
- Google-managed certificate: `astra-workspace-cert`, for the workspace hostname only. HTTPS proxy retains `astra-website-cert` for the public website and adds the workspace certificate.
- Existing HTTP-to-HTTPS redirect applies to the new hostname as well.

The public website remains the URL map's default backend. These hostname changes do not change the workspace's authentication or IAM permissions. The Cloud Run service was already publicly reachable before this change.

## Website entry

The shared navigation links to `/demo`, an informational early-preview page. Its launch buttons link to `https://workspace.astra-via.com/` in the same tab. Opening the built-in deck while signed out returned “Sign in with an active demo account to upload PDFs.” The introduction therefore states that source access requires an active demo account and offers a support mailbox access-request link. No authentication controls were changed. The page explains the observed current preview: built-in source deck, PDF reading, saved passages, page references and Gravity Well; temporary PDF/notes session; planned persistent storage; swarm analysis not connected. It does not promise independent verification or a completed AI assessment.

The public site's legal/privacy notices do not establish complete workspace processing terms. The application needs its own applicable product notices and terms before accepting sensitive documents or expanding beyond the preview. No analytics, new cookies, iframe embeds or user data collection were added to the public website.

## Maintenance

- Keep `astra-workspace-cert` attached to `astra-website-lb-target-proxy` alongside the website certificate.
- Cloud Run revisions deployed to `astra-web` automatically serve through this backend; changing the service's name or region requires updating the NEG.
- Preserve the separate website default backend and workspace hostname rule when editing the URL map.
- Domain-level mail records and the root/www website records were not altered by this change.
- The pre-change URL map export is saved locally under ignored `output/cloud-routing/` for recovery.

Reference: Google Cloud's global external Application Load Balancer/serverless NEG guide: https://docs.cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless

## Verification — 2 October 2026

GoDaddy confirmed the record save. Authoritative DNS and public resolvers 1.1.1.1 and 8.8.8.8 returned 34.49.17.123. Google reported the workspace certificate and hostname ACTIVE. HTTPS using the hostname and the load balancer IP passed certificate validation and returned HTTP 200. Host-based routing returned the workspace page title rather than the public website. The public website build passed, and the demo introduction/navigation had no horizontal overflow at 320px and 700px; keyboard focus was visible. Signed-out source-deck access was checked and its account requirement is disclosed.
