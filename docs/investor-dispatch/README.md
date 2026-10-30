# Daily Astra investor dispatch

Requested by Omer on 30 October 2026. Owner: Omer. Delivery record:
[Astra-WebSite #14](https://github.com/Astra-via-Omer/Astra-WebSite/issues/14).
The issue is also in the company system Project,
[@Astra-via work Process](https://github.com/users/Astra-via-Omer/projects/1/views/1?pane=issue&itemId=288565713).
This runbook contains operational rules, not confidential measurements or drafts.

## Purpose and audience

Check once a day at **09:30 Asia/Jerusalem**. Publish only new, meaningful,
source-backed progress to **Astra updates** in the private Investor Room. Small
improvements qualify when their practical value can be explained. A day without
qualifying news needs no announcement. Fresh, valid daily metric observations
can refresh the activity cards without inventing a product milestone.

Omer authorized this recurring publication in the current investor-room chat.
It covers factual, investor-safe product improvements, research progress,
workflow improvements and defined aggregate activity. It does not authorize
customer documents, personal account details, confidential commercial terms,
financial forecasts, claims of independent truth verification, or changing
accounts, permissions, infrastructure, billing or product code. Do not send
emails or messages to other people.

## Sources and editorial rules

Use live source records from these canonical GitHub repositories under
`Astra-via-Omer`, checking dates and actual diffs/release evidence where relevant:

- `Astra-via-Personal-Workspace`: review workflows, Gravity Well, cited answers.
- `astra-colossus`: engine versions, Christopher, evidence/process fingerprints.
- `astra-enigma`: broadcast desk, recorded evidence, temporal workflows.
- `lab.astra-via`: research milestones and manuscript review records.
- `evidence-validation`: evidence workflow progress.
- `Astra-WebSite`: website and Investor Room releases.

The company Project is a discovery index. A card saying Done is not release proof.
Search with an overlap (at least 48 hours before the previous successful run),
then deduplicate against every existing entry's evidence keys. Group related
commits into a user-visible milestone; do not post build churn or the agent's own
routine data refresh as company news. Limit each run to three concise new entries.

Use the Astra reality paper when an accessible, versioned manuscript or its
review record supports a concrete change. A manuscript review can be described
as research work with its implementation limitations. The initial paper entry
uses the dated Lab issue #9 review record; access to the full shared manuscript
was unavailable at setup. Do not claim to have read a paper that could not be
retrieved, or announce a new paper version from a filename alone.

Each entry has its real event date and separate publication timestamp. Earlier
work is visibly marked as an earlier milestone. Use stable, event-specific
`id`/evidence keys, such as a repository + PR number, or manuscript version +
source digest. Preserve historical entries and corrections.

- **Released** requires merge and successful deployment evidence for that change.
- **Merged** means integrated source; it does not establish current live behavior.
- **Research** is a documented research/manuscript result with its limits.
- **Experiment** is a bounded prototype or test, not a general product promise.

Keep summaries in plain English: what changed, why it matters, and what was
actually established. Put a fuller explanation and limitations in `detail`.
Evidence URLs, source checks and private collection metadata stay in the private
stored record; the server sends investors only an explicit safe-field projection.

## Measured activity

Run `node scripts/collect-investor-metrics.mjs`. It uses the existing Astra cloud
identity, seven explicitly listed application services in `me-west1`, and the
last seven complete **UTC** days. It reads Cloud Monitoring only; it does not
start compute, call a model, change settings or read customer documents.

The two current measurements are:

- **Application requests**: `run.googleapis.com/request_count`, summed across
  revisions and the listed services with complete daily alignment. Includes
  internal calls, staff and automated/test traffic. Excludes requests rejected
  before reaching a container. Not unique users, customers, reviews or adoption.
- **Compute allocated**: `run.googleapis.com/container/cpu/allocation_time`,
  summed allocation seconds / 3,600. Not CPU utilization, GPU hours, token usage,
  model cost or completed customer work. Scope excludes other cloud projects,
  VMs, pilot services and external provider compute.

The metric period, collection time, definition, service coverage and daily
observations accompany the value. Missing data stays missing, never zero. A
failed collection preserves the previous dated snapshot and produces an
operator failure notice. Do not make old observations appear current.

Active users remain explicitly unmeasured until an authoritative aggregate
source, deduplication rule, activity window, and staff/test exclusions are
established. Registered-account totals are not active-user counts. Timeline
coverage counts describe documented milestones and areas, not company-wide
completion or commercial traction.

API reference: [Cloud Monitoring filters](https://docs.cloud.google.com/monitoring/api/v3/filters).

## Private storage and publication

This GitHub repository is public. **Never commit investor feed content,
measurements, evidence payloads, drafts or publication receipts here, and never
put them in `public/`.** Keep working files in the ignored `output/` directory.
The existing private investor document bucket holds:

- `investor-dispatch/current.json`: current content and its private evidence.
- `investor-dispatch/history/<timestamp>-<digest>.json`: immutable publication
  snapshots, using generation-zero create preconditions.

No new bucket, credentials, IAM grant, public endpoint, database or secret is
required. The investor runtime reads the object with its existing bucket access.
Live membership, approval, expiry/suspension and current confidentiality checks
run before feed reading. The server cache lasts at most 60 seconds. Sign-out or
lost access clears the client state. PDF updates retain individual document grants.

From the current website checkout:

```sh
node --import tsx scripts/investor-dispatch.ts read > output/dispatch-before.json
node scripts/collect-investor-metrics.mjs > output/dispatch-metrics.json
```

`read` returns `{ generation, content }`. Prepare a private draft from that
content. Preserve existing milestones and their publication dates. Refresh
metrics only from successful collection; do not publish partial output. Change
`publishedAt` only when publishing a real content/observation change.

```sh
node --import tsx scripts/validate-investor-dispatch.ts output/dispatch-draft.json
node --import tsx --test tests/investor-dispatch.test.ts
node --import tsx scripts/investor-dispatch.ts publish output/dispatch-draft.json EXPECTED_GENERATION
node --import tsx scripts/investor-dispatch.ts read > output/dispatch-after.json
```

Use the exact generation from the draft's initial read. A mismatch requires a
fresh read and reconciliation; never override another publisher. Validation
rejects duplicate evidence, future dates, unsupported statuses, unsourced
measurements and invalid periods. The publisher archives first, updates current
with a generation precondition, and reads back the exact resulting generation
to verify its SHA-256. An unchanged document creates no publication. Archive
retries verify the existing digest. An interrupted publication requires checking
current content before retrying.

Record source checks, skipped candidates, before/after generations, digest and
outcome in the private publication snapshot/run receipt. Do not put raw tokens
or account-level records in output. For a correction, preserve the event date,
explain the correction, and publish a new version; do not erase history. To
restore an earlier snapshot, read current generation, validate the earlier
content with an updated feed publication timestamp, and publish normally.

## Daily agent and operation

A Codex chat automation returns to the investor-room chat at 09:30 Jerusalem time.
Its saved prompt follows this runbook and uses the existing local website
checkout. Use current main/runbook/tools; if the checkout is dirty, preserve all
work and use a separate clean checkout rather than resetting files. No product
implementation or PR merge is part of a routine content run.

Check for an existing same-purpose automation before creating another. Stay
quiet when the state is unchanged or non-actionable. Notify Omer in the chat only
on a verified publication, a failed publication/collection, or a required source
or access decision. Do not create additional reminders or schedules.

This is a local desktop automation. The computer must be on, the app running,
and the existing GitHub/cloud sessions usable. It is not an always-on cloud
worker. See [scheduled task operation](https://learn.chatgpt.com/docs/automations?surface=app).
The actual automation ID and setup acceptance are recorded in `schedule.json`.
