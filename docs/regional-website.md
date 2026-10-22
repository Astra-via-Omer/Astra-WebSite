# Regional website controls

Prepared on 22 October 2026 for astra-via.com. This implements regional presentation and optional website tracking controls. It does not certify legal compliance or relocate customer data. Google Cloud was inspected read-only using the existing `omer@astra-via.com` login. No live infrastructure change was made.

## Website behavior

| Connection estimate | Default regional information | Hebrew legal sections |
| --- | --- | --- |
| Israel (`IL`) | Israel | Included with English |
| EEA countries | EEA | Excluded from server output |
| United Kingdom (`GB`) | UK | Excluded from server output |
| United States (`US`) | US | Excluded from server output |
| Other, unknown or untrusted | International, English | Excluded from server output |

The marketing pages remain English. `/region` lets a visitor choose a legal-information region independently of the connection estimate. This choice never changes the Hebrew gate, account permissions, legal rights or data residence. Required company disclosures and the baseline privacy, accessibility and legal information remain available everywhere. VPN location is not proof of a person's location, identity or nationality. This is not a country-based authorization mechanism.

The six-month `astra-region` cookie is set only on a choice; it is HTTP-only, SameSite=Lax, secure in production. A visitor can return to the connection estimate. Root layout uses dynamic rendering so region-dependent content is not shared through Next's full-route cache. Verify `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` in the deployed response and ensure the load balancer has no cache rule overriding it. Static assets can remain cached.

## Google Cloud activation

The live project is `astra-via`, with public service `astra-website` in `me-west1` and an isolated investor service. The public DNS resolves to `34.49.17.123`. The global external managed load balancer's URL map is `astra-website-lb`; both apex and www use path matcher `astra-site-investors`. It sends marketing traffic to `astra-website-backend`, while `/investors`, `/investors/*`, `/api/investors` and `/api/investors/*` use `astra-investors-backend`. Both inspected backends have CDN disabled and no custom country header. The public Cloud Run service currently permits `all` ingress, so direct internet requests can bypass the load balancer. These are observations from 22 October 2026; refresh before activation.

1. Use the existing Astra account without changing the global Google defaults. Use explicit `--account=omer@astra-via.com --project=astra-via` on project commands; refresh authentication only if it has expired.
2. Inspect the URL map, backend service(s), Cloud Run ingress, custom headers, caching, and both the apex and www host mappings. Preserve investor-specific routing and existing headers.
3. Have the trusted Google load balancer **overwrite** `X-Astra-Client-Country` with `{client_region}` on each applicable backend. Do not derive it from incoming client headers, language, browser timezone, a query parameter or user metadata. Do not collect city, GPS, a device fingerprint or an additional location history for this feature.
4. Restrict the public website Cloud Run service to `internal-and-cloud-load-balancing` ingress and check any alternate ingress paths. Test that a public request to each direct run.app URL fails. A guessed/spoofed country header must never reach an internet-accessible origin directly. Confirm any operational callers before changing ingress. This branch updates the manual deploy and GitHub workflow to probe the canonical `https://astra-via.com/health` (overridable with `ASTRA_PUBLIC_SITE_URL`) rather than the direct origin; deploy that workflow change before closing direct ingress. Keep the separate investor backend and its deployment/verification behavior intact; it does not need the trusted-country switch for its account routes.
5. Only after those checks, enable runtime `ASTRA_TRUST_GOOGLE_GEO=true`. The default is disabled. This variable is an operational trust switch, not authentication by itself. A user-supplied `X-Astra-Client-Country: IL` is ignored when the switch is disabled. Do not enable it on a publicly reachable direct origin.
6. Deploy the reviewed source through the existing website pipeline. Test Israel, EEA, UK, USA, UAE/other, unknown country, selected region, forged headers, direct origin denial and cache separation. Roll back the switch first if the header trust boundary fails; unknown locations will then use English.

Do not apply an update that drops existing custom request headers. Export and review the existing backend configuration before editing it. No new paid infrastructure is provisioned by this branch.

## Google Tag Manager activation

No existing container ID was supplied. Both the container and tracking remain disabled by default. Runtime `ASTRA_GTM_ENABLED=true` **and** a valid `ASTRA_GTM_CONTAINER_ID=GTM-…` are required. No `NEXT_PUBLIC` build variable is used.

Before enabling, inspect the actual container and publish an accurate notice covering the chosen products, data, recipients, cookies, purposes, retention and transfer arrangements. The generic category controls do not supply missing vendor information. Verify the container's consent configuration in Google Tag Assistant:

- Use basic consent mode: the entire container is blocked until an optional category is explicitly allowed; there is no noscript iframe, preconnect, prefetch, or pre-consent cookieless ping.
- Default `analytics_storage`, `ad_storage`, `ad_user_data` and `ad_personalization` to denied. Analytics and advertising are separate choices. Rejection is available at the same level as analytics acceptance; advertising requires its own unchecked choice.
- Use a consent template with Google's `setDefaultConsentState` / `updateConsentState` APIs in Consent Initialization and on the `astra_consent` event. Data-layer booleans `astra_analytics` and `astra_advertising` provide the chosen categories. The page queues the documented fallback consent commands before `gtm.js`; the template must synchronize the same values before any tag fires.
- Audit **every** container tag, including custom HTML and non-Google tags, for category checks. An analytics-only grant must never fire an advertising tag. Do not put essential application behavior in GTM.
- Global Privacy Control (`Sec-GPC` or `navigator.globalPrivacyControl`) and Do Not Track keep all optional tags off, even after a previously saved grant. Pending, invalid, old-version, future-dated and expired preferences do not authorize tags.
- The six-month `astra-consent` cookie stores choices, version and timestamp in the browser. It is not an independent server consent ledger or proof of identity. Nothing is added to localStorage. A notice version change requires a new choice.
- Tags load only on the exact public marketing path allowlist in `src/regional/consent.ts`. Legal, settings, account, recovery, investor and API paths never start a container. Public navigation uses full document links so tags loaded on a marketing page do not survive into the investor or privacy pages. Keep future account navigation as full document navigation too; do not add SPA navigation from a tracked page into protected content.
- Saving a preference reloads the page; withdrawing it stops future tags. It cannot recall provider data or erase all third-party cookies. Provider deletion requests remain a separate process.
- Never send investor identities, recovery tokens, document names, prompts, files, email addresses, precise location or other private product data to GTM. Review automatic URL/query/hash collection and configure URL redaction before enabling Google tags.

## Customer data regions: separate infrastructure work

Moving the marketing page or changing its label does not relocate Supabase Auth, Firestore, Storage, Colossus inference, provider processing, email, logs, backups or investor records. The website currently describes Israel hosting; no EU-only or US-only claim has been introduced. All listed Cloud Run services are in `me-west1`, including the public website, workspace, investor service and the Supabase service. The `astra-workspace` and `astra-colossus` Firestore databases are in `me-west1`. The live Storage inventory places workspace files, investor documents, general documents, Enigma history, Colossus engines and the main backup bucket in `ME-WEST1`. A separate IPFS backup bucket is in `US-CENTRAL1`, and the Cloud Build bucket is in the US multi-region. These observations do not verify bucket contents, replication, external inference destinations, or where Supabase's underlying database/volumes/backups live. Logging has separate default/audit retention periods; the existing public website request-log notice states 30 days, not the retention of every audit record.

For regulated product access, inventory those systems and their actual locations, processor agreements and transfer arrangements. Record each tenant's approved service/data region at onboarding using protected server metadata and a versioned agreement. Route authenticated API, database, file storage, inference, logs and backups from that approved tenant policy, with server-side enforcement and a defined failure mode if the region is unavailable. An IP estimate or editable website preference must not select the tenant's data residence or override permissions. Existing users require an explicit migration plan; do not copy live customer data across regions as a side effect of this website change.

Israeli business/privacy/accessibility duties remain part of the baseline. EEA/UK applicability and representatives, US state thresholds and rights, consent requirements, actual legal company details, accessibility coordinator obligations and product contracts need assessment against the business's real activities. The UI does not replace these obligations with a checkbox.

## References

- Google global external load-balancer country headers, overwrite behavior, and estimated locations: https://docs.cloud.google.com/load-balancing/docs/https/custom-headers-global
- Google Cloud Run ingress: https://docs.cloud.google.com/run/docs/securing/ingress
- Google consent mode and Tag Manager consent APIs: https://developers.google.com/tag-platform/security/guides/consent
- GDPR scope and information duties: https://eur-lex.europa.eu/eli/reg/2016/679
- UK international transfers: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/
- California privacy rights, scope and GPC: https://oag.ca.gov/privacy/ccpa
- Israeli website accessibility: https://www.gov.il/en/pages/website_accessibility

## Local verification

Run `npm test`, then `npm run build`. For local country-header fixtures only, start the production build with `ASTRA_TRUST_GOOGLE_GEO=true npm start -- --port 3217 --hostname 127.0.0.1` and run `node tests/live-regional.mjs http://localhost:3217`. Do not expose that fixture server publicly. Repeat without the trust variable and confirm an `IL` header cannot enable Hebrew.
