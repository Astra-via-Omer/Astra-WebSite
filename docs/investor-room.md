# Investor Room

The public navigation links to `/investors`. A separate Cloud Run service,
`astra-investors`, serves `/investors`, `/investors/*`, `/api/investors`, and
`/api/investors/*` through the existing HTTPS load balancer. The marketing runtime
does not have document or Supabase administration access. Both services use the
same website image, including identical static asset hashes.

## Database and access

Apply `database/006_investor_room.sql` in the existing Supabase project after the
shared system approvals migration. It is repeatable, defaults every existing
account to no investor access, and retains existing application approvals. Its
AFTER trigger preserves the investor metadata mirror even when an older shared
BEFORE trigger rebuilds the other application approvals.

`public.astra_user_system_access.investor_room` approves entry. The investor member
row supplies the separate room role and optional expiry. Every API request
verifies the bearer token through Supabase, reads the current Auth account,
membership, and approval, and rejects suspended or expired accounts. Watermarks
use the fresh verified Auth email. Administrative actions require `aal2` from a
verified token; the UI supports authenticator enrollment and verification.

The first administrator must be an existing verified Astra owner account. Create
its member row with role `admin`, then enable its investor approval through a
trusted administrator. No other existing account inherits access. Investor
administrators cannot change their own approval, role or expiry through the app.

All seven investor tables have RLS enabled and no privileges for `anon` or
`authenticated`. The server service role is used only in the dedicated runtime.
Application roles cannot update or delete audit rows. A database owner can still
change the schema; this is not an externally immutable compliance archive.

## Using the room

1. Sign in at `/investors` and complete authenticator verification as an admin.
2. Open **Manage room → Confidentiality** and publish your approved agreement.
   No agreement is invented or accepted on your behalf. Investor document access
   remains blocked until the current agreement has been accepted.
3. Upload approved PDFs under **Documents**. Uploads are drafts. Publish them,
   then assign preview/download grants to individual investors in **Permissions**.
4. Add investors under **Investors**. A new account gets a single-use invitation
   link to copy and share privately. Creating the link does not send email.
   The link carries the hashed verification token in a fragment; the browser
   removes it before exchanging it with Supabase. Existing accounts sign in using
   their own password. Investor access does not approve Workspace or other apps.
5. Questions are private between the investor and room admins. Sharing requests
   record the sender and proposed recipient; admins first add the recipient, then
   approve that document's preview. Download access remains a separate grant.
6. Audit shows server requests, document delivery, copy IDs, NDA acceptance,
   questions and permission changes. A delivered copy is not proof of reading or
   saving. External forwarding and screenshots cannot be reliably tracked.

Auth sessions stay in browser memory. The room rechecks access on focus and every
15 seconds while visible. Sensitive responses use private/no-store headers.
No original object URLs or signed URLs are sent to investors. Access revocation
blocks future requests and clears active portal views on the next check, but
cannot revoke files already saved outside the portal.

## Files and retention

Only unencrypted PDFs up to 25 MB and 200 pages are accepted. Page content is
copied into a fresh PDF catalog; attachments, source catalog actions, page
annotations and page actions are omitted. This is not malware scanning or a
complete content-disarm service. New immutable object names and upload
preconditions prevent replacement. Uploads preserve document-version history.

The dedicated bucket uses uniform access, public access prevention, versioning
and seven-day soft deletion. Its runtime gets Object Creator and Object Viewer,
not delete or bucket administration. Server-side SHA-256 integrity verification
precedes watermarking. Every delivered PDF page receives repeated email/copy-ID
marks and an email/time/version/copy-ID footer. A second live access check runs
after generation. An audit insert must succeed before the PDF is returned.

Use PDF exports for financial models. Editable spreadsheets, electronic
signatures, automatic email campaigns, file-level DRM, malware scanning and
external-forward tracking are not implemented. No real investor documents are
automatically imported from local folders or Google Drive.

Database investor records and immutable object versions require periodic owner
retention review. Cloud Storage Data Access logs must be explicitly enabled at
project level. They identify the runtime identity; application audit events supply
the investor identity and copy ID. The public investor privacy screen describes
the records and contact route. Additional retention requirements should be set
before a regulated or contract-specific rollout.

## Deployment

`scripts/deploy-investors.mjs` provisions the isolated runtime/bucket, deploys the
checked image, and adds investor path routing while preserving other host rules.
Run `npm test`, `npm run build`, and the production dependency audit first. Keep
the marketing and investor services on the same image. Supabase credentials
remain in Secret Manager; no service key is written to source or browser output.

### Password recovery through Astra Microsoft 365

Apply `database/007_investor_recovery.sql` after migration 006. Add the exact
`https://astra-via.com/investors` and `https://www.astra-via.com/investors` return
URLs in Supabase Auth while preserving the shared default Site URL and all other
applications' entries. The reset endpoint generates a Supabase recovery link and
sends it using Astra's existing Microsoft Graph mail application. Shared Supabase
SMTP and email templates are unaffected. Invitation links remain manually shared.

The existing Secret Manager JSON uses `tenantId`, `clientId`, `clientSecret` and
`sender`. Pin its enabled version with repository variable
`ASTRA_MICROSOFT_MAIL_SECRET_VERSION`, grant only the investor runtime accessor
on `astra-microsoft-mail`, and set `ASTRA_INVESTOR_PASSWORD_RESET_ENABLED=on`.
The workflow preserves both settings on redeployment. The flag defaults off;
the reset UI also requires valid mail configuration. Retain the existing sender
restriction in Exchange; this feature does not add Microsoft permissions.

The origin-checked, 1 KB endpoint returns the same success body for eligible,
unknown, blocked and throttled emails. Atomic database reservations limit requests
to three per email per hour with a 90-second cooldown, 20 per network per hour,
and 120 globally per hour. Limit keys are HMACs, not raw IPs or unknown emails;
rows older than two hours are removed on subsequent requests. Global limits also
bound abuse if proxy network attribution is unavailable. Only service_role can
execute the RPC; browser roles cannot read the rate table.

Only confirmed, approved, active and unexpired investor members get a reset email.
Audit records mark the target account and explicitly label the unauthenticated
request source. Provider acceptance is recorded separately from confirmed inbox
delivery. Tokens and credentials never enter application logs or audit records.
The email uses a fixed HTTPS investor URL and a single-use token in the fragment,
removed before Supabase verification. The recovery screen opens the password form;
Supabase MFA and all live investor permissions still apply. Changing a password
changes that account's shared Supabase password for its other Astra applications.

### Test-account archival

Apply `database/008_investor_directory.sql` with the Workspace directory-archive migration. Protected `app_metadata.directory_archived=true` omits archived synthetic members from normal investor administration while preserving memberships and audit identities. Keep those accounts disabled, banned, expired and unapproved. Ordinary disabled people remain visible. The fixture-creating `tests/live-investors.mjs` requires a separate staging Supabase project/service/bucket and refuses the production project. Read-only/unknown-account `tests/live-recovery.mjs` creates no accounts.
