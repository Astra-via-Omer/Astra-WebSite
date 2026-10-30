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
use the fresh verified Auth email. Approved administrators sign in with their shared
account email and password, without an OTP or phone challenge.

The first administrator must be an existing verified Astra owner account. Create
its member row with role `admin`, then enable its investor approval through a
trusted administrator. No other existing account inherits access. Investor
administrators cannot change their own approval, role or expiry through the app.

All seven investor tables have RLS enabled and no privileges for `anon` or
`authenticated`. The server service role is used only in the dedicated runtime.
Application roles cannot update or delete audit rows. A database owner can still
change the schema; this is not an externally immutable compliance archive.

## Using the room

The room uses larger reading text and touch controls on the same `/investors`
address for desktop and mobile. Signed-in members get a compact welcome and
persistent section navigation; on phones, **Go to** selects the section. The
overview links directly to documents and questions. The Astra background material
is available in an expandable section below the signed-in room.

**Documents** supports title/description search, category filtering and clearing
filters. The document reader provides page navigation, fit-to-width and zoom,
plus a **Text view** that reflows the current page's existing PDF text for smaller
screens and assistive readers. Image-only PDF content remains available in page
view; text view does not perform OCR. The reader continues to use personalized
copies from the existing authenticated delivery endpoint.

Before sign-in, the desktop room opens with the Astra observatory: a gravity-well illustration, a personal
welcome, and chapters about connections, traceability and the philosophy already
published on the Astra website. The fingerprint is a visual metaphor; the page
does not collect biometric information.

After sign-in, **Overview** shows the investor's available published materials,
their personal signature card, and **The Astra Dispatch**. The Dispatch combines
an investor-only progress timeline, dated aggregate activity snapshots, and the
existing **Investor updates** PDFs. Timeline content is read server-side from
`investor-dispatch/current.json` in the existing private document bucket only
after the current room agreement permits reading. Internal evidence URLs and
collection details are removed from the response. Content and measurements must
never be committed to this public repository or placed in `public/`.

PDF briefings retain their individual document grants, publication controls and
personalized delivery. Company timeline summaries are shared with all currently
approved room readers under the room agreement. The daily publishing scope,
source rules, metric definitions, recovery steps and schedule are documented in
[the dispatch runbook](investor-dispatch/README.md). No new database, service,
credential or investor permission is required.

The welcome uses the current account's `astra_investor_name`, `full_name`, `name`
or `display_name`, falling back to a readable email username. **Your account**
lets a member save their preferred welcome in `user_metadata.astra_investor_name`.
This is presentation only: access and document watermarks still use the verified
account email and the existing live permission checks. No database migration is
needed for the new presentation. Names and private views clear on sign-out or
access loss. Administrator MFA remains required for management actions; its
verification form is now in an expandable panel.

1. Sign in at `/investors` with your administrator email and password.
2. Open **Manage room → Confidentiality** and publish your approved agreement.
   No agreement is invented or accepted on your behalf. Investor document access
   remains blocked until the current agreement has been accepted.
3. Upload approved PDFs under **Documents**. Uploads are drafts. Publish them,
   then assign preview/download grants to individual investors in **Permissions**.
   In **Publication**, hover over or focus a document title to preview its first
   PDF page. Select the title or **Open full preview** for the larger viewer;
   tapping the title also works on touch screens. Drafts can be previewed by room
   administrators. Previews use the existing personalized, audited PDF delivery
   and do not publish the document or change investor grants.
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

The load balancer routes `/_next/static/*` to the marketing runtime, including
requests made by investor pages. Deploying only one runtime can leave investor
HTML pointing at missing script hashes and cause a client-side application error.
Both the GitHub workflow and `deploy.sh` update the two services together. The
manual script updates only the investor image, preserving its private settings.
Both deployment paths run `node scripts/check-public-assets.mjs` after the paired
update. This checks `/` and `/investors` on both public hostnames, including the
status, MIME type and content of their referenced Next.js scripts and styles.
A runtime `/health` response alone does not verify this cross-service routing.

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
All live investor permissions still apply. Changing a password
changes that account's shared Supabase password for its other Astra applications.

### Test-account archival

Apply `database/008_investor_directory.sql` with the Workspace directory-archive migration. Protected `app_metadata.directory_archived=true` omits archived synthetic members from normal investor administration while preserving memberships and audit identities. Keep those accounts disabled, banned, expired and unapproved. Ordinary disabled people remain visible. The fixture-creating `tests/live-investors.mjs` requires a separate staging Supabase project/service/bucket and refuses the production project. Read-only/unknown-account `tests/live-recovery.mjs` creates no accounts.

### Customer-review security release (24 October 2026)

Apply `database/009_investor_integrity.sql` before enabling the repository variable
and investor runtime environment `ASTRA_INVESTOR_INTEGRITY=on`. The SQL is additive
and compatible with the previous runtime. It freezes the current NDA as a labeled
legacy snapshot, preserves existing acceptance evidence unchanged, and captures
hashes for fresh acceptances. Once enforcement is on, existing investors accept
the frozen current text once before reading documents. Future publications must
use a new version. Do not edit or backdate prior acceptance records.

The same migration deduplicates room-open events per verified session and removes
ordinary product-admin writes to the investor approval column. Investor access
is still individually approved; legal recipient qualification is a separate
owner/counsel process and is not established by an approval checkbox.


Preview sign-in accepts the existing account email and password for every approved role. No authenticator enrollment, OTP or phone challenge is required. Current account, role, approval, membership, NDA integrity and document grants remain enforced. Complete the shared Workspace migration and old-factor cleanup when deploying.

### Room roles and approved tabs

Apply `database/010_investor_roles_and_tabs.sql` to the Investor Room's configured
Supabase project before deploying this release. It preserves all existing content
tabs for existing memberships. New investors start with Overview only. Repeating
the migration preserves subsequent tab selections. Shared Astra identity roles,
investor approval, expiry, confidentiality records and document grants are unchanged.

In **Manage room → User control**, administrators can change
another member's room role and approve Overview, Documents, Astra updates and
Questions individually. Your account is always available. Administrators cannot
change their own role or tabs through these controls.

User control opens first in Manage room. Search by name, email or organization,
or filter by access level, then expand a user to edit their role and tabs. Each
entry shows current room approval, expiry and effective visible tabs. Use
**Invitations & access dates** to add people, approve/block room access or adjust
expiry in Investors. Individual PDF preview/download grants remain in
**Permissions**, which also links back to User control. These settings apply only
to the Investor Room.

- **Investor:** only the selected content tabs; document previews and downloads
  still require individual document grants.
- **Astra power user:** every investor-facing tab and previews of every published
  document. Downloads still require separate approval. Drafts, Manage room,
  permission changes and other members' private conversations remain restricted.
- **Investor administrator:** all content and Manage room, including draft
  document previews and the existing administrative controls.

The server filters state and enforces the same rules on direct document requests
and question submissions. An Updates-only investor can preview a granted PDF in
the Investor updates category without receiving unrelated document metadata.
Power users and investors see only their own questions. Verified account,
individual approval, expiry and confidentiality checks apply to every role.

Role/tab changes are audited. Live refresh closes open previews when permissions
are reduced, clears management data after administrator access is removed, and
moves the reader to an available tab. Desktop and mobile navigation both use the
server's allowed-tab list. Account-specific settings and rollout receipts stay
private and must not be committed to this public repository.
