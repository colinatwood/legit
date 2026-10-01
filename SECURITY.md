# Security at Legit

Legit handles local reports that may contain sensitive location, identity, and media information. Security and privacy protections are part of the product’s trust model.

## Reporting a vulnerability

Please use the repository’s private vulnerability-reporting channel when available. Do not open a public issue for an undisclosed vulnerability or include private addresses, identity information, access tokens, or raw media in a report.

Include:

- the affected route, component, or deployment;
- a concise reproduction using synthetic data;
- the security impact and likely abuse path; and
- a suggested mitigation, if known.

Allow time for confirmation and remediation before public disclosure. Legit contributors should not test against real people, private locations, or production data without explicit authorization.

## Current security boundaries

- Public locations are always aggregated; exact locations are never stored, including for attributed submissions.
- New submissions are sanitized server-side and enter private review before public display.
- Raw attachment bytes are not accepted by the public submission endpoint. Media metadata and low-legitimacy material remain private until review.
- Mutation endpoints accept same-origin JSON requests only and enforce a bounded request body, in-memory limit, and atomically incremented D1-backed per-fingerprint minute bucket.
- Public reports and correction requests are stored as pending moderation records; resolution history is append-oriented and public output contains only sanitized summaries.
- Signed-in desk items are owned by a secret-backed HMAC profile fingerprint and are included in export/deletion controls; anonymous desk state stays device-local.
- Moderator routes fail closed when `MODERATOR_TOKEN` is absent and never expose the token to browser code.
- Moderator verification can require both `MODERATOR_TOKEN` and `MODERATOR_VERIFICATION_SECRET`; an optional fingerprint allowlist can restrict which verified credentials are active.
- Moderator task claims, response time, quality reviews, and illegitimate-bounce counts are stored without public moderator identities. A reversed `hold` or `flag` is the defined illegitimate-bounce outcome.
- Moderator metrics return only the current moderator's own metrics, aggregate team totals, and daily trend buckets; no stable public moderator alias is emitted.
- Database schema changes are migration-owned; the Worker does not create or alter production tables at request time.
- Retention cleanup runs on API traffic and is also exposed through a scheduled Worker handler; a production Cron Trigger must be attached before no-traffic cleanup is treated as guaranteed. Verification events expire after 15 minutes, completed/released/expired moderator tasks are purged after 180 days, and quality-review events are purged after 365 days.
- Moderation decisions are append-only and record a pseudonymous moderator fingerprint.
- The moderator fingerprint is a secret-backed HMAC of the credential only; moderator IP and user-agent values are not stored in the moderator task, quality, or verification tables.
- `LEGIT_OWNER_HMAC_SECRET`, `LEGIT_ABUSE_HMAC_SECRET`, and `LEGIT_MODERATOR_HMAC_SECRET` are production-only Sites secrets. Profile and write paths fail closed when their required secret is absent; secret values never belong in source control or `.openai/hosting.json`.
- Sites supplies a signed authenticated principal to the Worker. The application prefers `oai-authenticated-user-id` and falls back to the platform-injected `oai-authenticated-user-email` when that is the available Site header; either is HMACed immediately and the raw value is never stored. The application accepts no account identifier in JSON bodies and requires same-origin or same-site mutation metadata; deployments must preserve the platform identity-injection boundary and must not proxy or rewrite these headers from user input.
- The external Leaflet map assets are version-pinned and loaded with Subresource Integrity checks.
- Browser responses include baseline clickjacking, MIME-sniffing, referrer, permissions, transport, and Content Security Policy protections.

## Contributor rules

Preserve anonymous-by-default reporting, aggregate public locations, fail-closed moderation, and server-side validation. Do not add client-only authorization, expose exact coordinates for convenience, or treat popularity as proof.
