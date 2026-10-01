# Legit

Legit is an open-source local signal map for people who want to see what is happening around them while the story is still unfolding.

People can post an early report, ask a local question, add source trails, and vote on whether a source is useful or credible. As independent evidence aligns, a happening’s legitimacy signal grows. The signal is a guide for attention—not a declaration of objective truth.

## What this first slice includes

- Single-screen, full-window map for local happenings; the map is the primary interface and does not depend on a scrolling feed.
- Left-click a marker for a compact event preview; right-click a marker for actions such as add to desk, full details, useful-evidence upvote, and issue reporting.
- OpenStreetMap tiles rendered through the open-source Leaflet library, with neighborhood-level public coordinates.
- Color-coded map markers: blue is a left-leaning reported angle, red is a right-leaning reported angle, and purple is agnostic/mixed. Marker size represents event importance; legitimacy remains a separate score.
- A compact time slider for `Today`, `Yesterday`, `Last week`, `Last month`, `Last year`, and `All time`, defaulting to `Today`.
- Filters for legitimacy, balance/perspective, and importance.
- Aggregated public reporting counts and rounded map positions to reduce location exposure.
- Server-backed public map refreshes that aggregate approved reports across visitors.
- Status language that keeps uncertainty visible: `Unverified`, `Needs checking`, `Building consensus`, and `Corroborated`.
- Source-trail cards with community credibility votes.
- Public report/correction intake with moderator review and a visible correction history.
- Anonymous-by-default posting, with optional identity disclosure.
- Legit points for supported happenings, useful source trails, corrections, and relevant materials.
- Server-side attachment metadata is held privately until moderation; low-legitimacy media is not public by default.
- Reputation-ready “fact seeker” model in the interface.
- Public posting flow with privacy and safety guidance.
- Pinch, drag, and zoom map navigation on touch and desktop.

The public map includes demo happenings until approved database records exist, then merges approved server records into the same map surface. New submissions cross a server-side privacy gate. Durable D1 records keep the moderation queue, claim, evidence, and correction shape authoritative; the browser is only an interaction surface.

## Map interaction model

Legit intentionally keeps the public experience on one map screen:

- Left click or quick-tap a point for a mini information card.
- Right click, or press and hold a point for about half a second, for event actions; releasing after the hold does not also open the mini card.
- Keyboard users can focus a marker, press Enter for details, or use Shift+F10 for the same actions menu.
- Tap the `L` mark to open an in-place sign-up/sign-in dialog without leaving the map; anonymous browsing remains available.
- Use the profile’s `Data controls` section to view profile-linked record counts, request a correction, download a sanitized data export, opt out of sale/sharing, limit sensitive-data use, and delete all profile-linked data.
- `Add to desk` is durable for signed-in users and remains device-local for anonymous users.
- Choose `View full details` only when the evidence trail needs inspection.
- Use the map’s time slider for `Today`, `Yesterday`, `Last week`, `Last month`, `Last year`, or `All time`; it defaults to `Today`.
- Use `Filters` for legitimacy, balance, and importance without leaving the map.
- Open `Accessibility` for local text-size, high-contrast, reduced-motion, and map-label settings; keyboard users can use the skip link, focus indicators, and trapped dialog focus.
- The map reports whether live data is current or using the last known result; approved evidence trails and correction history are visible in full details.
- The map remains privacy-aware: public coordinates are aggregated by default and marker color describes reported perspective, not truth.

## Data controls and aggregation boundary

Legit uses a privacy-preserving baseline informed by GDPR data-subject rights and California privacy rights. Signed-in profiles can request access/export, submit a correction request, limit sensitive-data use, and delete all profile-linked records. Legit never sells or shares personal information, so that control is always on. The profile controls are product functionality, not a legal certification or substitute for a jurisdiction-specific privacy notice.

Every incoming happening is filtered before durable storage: raw request bodies are discarded, common email/phone/address patterns are removed, source URLs lose query strings and fragments, and coordinates are rounded to neighborhood precision. Exact pins are never stored. Signed-in ownership is represented by a secret-backed HMAC fingerprint rather than a raw account identifier. Anonymous contributions have no profile owner key and remain aggregated. Signed-in useful-evidence events are linked to the same opaque owner key for export and deletion; anonymous abuse-prevention fingerprints remain unlinked by design.

## Accessibility target

Legit targets WCAG 2.2 AA as the forward-looking bar, with WCAG 2.1 AA as California’s published baseline for 2025 certification. This is an implementation target, not a legal certification. The interface supports keyboard navigation, a skip link, visible focus, scalable text, high contrast, reduced motion, screen-reader labels and live updates, and a map-label mode that makes perspective readable without relying on color alone.

## Product principles

1. **Post early, label clearly.** A first report is a signal, not a verdict.
2. **Keep perspectives attributed.** Avoid presenting a crowd’s current view as “objective.”
3. **Reward evidence and corrections.** A useful source can be a firsthand account, public record, image, dataset, or informed correction.
4. **Make uncertainty legible.** Consensus and popularity are not the same thing.
5. **Protect people.** Do not expose private details, exact home addresses, or unverified accusations.
6. **Aggregate before storage.** Public maps show a privacy-preserving area and report count; exact coordinates are never stored.
7. **Filter materials before trust grows.** Low-legitimacy uploads should be metadata-scrubbed, held privately, or sent to review before public display.

## Trust-map model

Each happening should keep separate fields for the transient `submitted_location` (never persisted), `public_location`, `impact`, `legitimacy_score`, `report_count`, and `identity_visibility`. The public map uses `public_location` and aggregates nearby reports. A legitimacy score is evidence alignment—not a popularity score and not a claim of objective truth.

## Canonical claim and evidence model

The first backlog milestone establishes a vocabulary that can move from this prototype into a durable API and database:

- **Happening** — the local event container: time window, public location, impact, privacy state, and linked reports.
- **Claim** — a narrow statement about what may be happening. Claims have a status such as `unverified`, `consensus-forming`, or `corroborated`; they are never silently promoted to fact.
- **Evidence** — a contribution that supports, qualifies, or contradicts a claim. Store its type, provenance, capture time, relationship to the claim, and whether it is still under review.
- **Assessment** — a separate judgment about evidence usefulness, source quality, balance/perspective, or legitimacy alignment. “Useful evidence” must not be treated as “I agree.”
- **Correction** — an append-only revision that records what changed, why it changed, and who or what supplied the correction.

The public detail view should expose the primary claim, its status and attribution, the evidence trail, source-quality signal, and revision history. The map remains a discovery surface; the evidence trail is where users evaluate the reporting.

## Server-side privacy boundary

`POST /api/happenings` is the only accepted path for new signals. The boundary:

- rejects oversized or malformed submissions;
- removes common email, phone, and street-address patterns from text;
- defaults identity to anonymous and always rounds coordinates to neighborhood precision;
- stores new reports as `pending` with a bounded retention window;
- purges expired `pending` and `flagged` records, including their claims, evidence, reports, and moderation decisions, on API traffic while preserving a non-identifying deletion audit count;
- purges expired verification events, completed/released/expired moderator tasks after 180 days, and quality-review events after 365 days;
- exposes a Worker `scheduled` handler for a host-level Cron Trigger so retention can run during no-traffic periods; the current Site deployment still needs that Cron Trigger attached before no-traffic cleanup is guaranteed;
- keeps attachment metadata and low-legitimacy media in `private_review` state; raw file bytes are not accepted by this endpoint;
- records claims, evidence, and moderation reports in D1; and
- applies a privacy-preserving, in-memory request limit and an atomic D1-backed minute bucket before the durable write.

Public review status is aggregate-only through `GET /api/moderation/status`. The authenticated moderator contract is fail-closed: `GET /api/moderation/queue` exposes pending happenings and privacy requests only after a server-side `MODERATOR_TOKEN` check, and `POST /api/moderation/actions` records append-only happening decisions plus privacy-request resolution status and a pseudonymous moderator fingerprint. The token is never accepted from the public UI or stored in the browser. Database migrations are canonical and applied before the Worker is uploaded.

`GET /api/happenings` returns only approved, sanitized, neighborhood-level records. The first aggregation pass groups identical sanitized titles within the same topic and neighborhood bucket, combines report/source counts, averages legitimacy, and uses agnostic balance when reported frames disagree. This deterministic grouping is intentionally conservative; semantic clustering is a later hardening step.

The browser’s image re-encoding and video review message remain useful feedback, but they are not treated as the security boundary. The server rejects the submission if durable moderation storage is unavailable.

## Perspective-label rubric

Perspective color is descriptive, not evidentiary: blue marks a left-leaning reported frame, red a right-leaning reported frame, and purple an agnostic or mixed frame. Each label carries a confidence note based on the diversity and consistency of the available reports. A label is not inferred from a contributor’s identity, and a purple label does not mean objective truth.

## Reputation ledger

Reputation is awarded by server-side events, not by the number of posts or votes a person can generate. The first public assessment action is useful-evidence marking:

- the first useful-evidence assessment earns up to `+2` points;
- repeated same-day assessments decay toward `+1` and stop at a daily cap;
- the same actor fingerprint cannot assess the same target or the same story twice;
- a burst of assessments from multiple actors on one public story enters coordination review and awards no points until reviewed;
- public legitimacy gains from distinct approved sources and useful-evidence assessments, with a penalty while a coordination review is open;
- points are based on evidence usefulness, not agreement with a claim; and
- corrections and Legit outcomes will be awarded only after their review state changes, never from client-supplied point values.

The fingerprint is a truncated, secret-backed HMAC abuse-control correlation value derived server-side; raw network identifiers are not shown in the ledger or returned to the browser. The Site identity boundary supplies a signed principal for signed-in requests; the API prefers `oai-authenticated-user-id` and falls back to the platform-injected `oai-authenticated-user-email`, HMACs it immediately, and does not accept user IDs from request bodies. Cross-origin mutations are rejected.

## Moderator safety and accountability framework

Moderator access is fail-closed and supports a second verification secret through `MODERATOR_VERIFICATION_SECRET`, an optional fingerprint allowlist through `MODERATOR_FINGERPRINT_ALLOWLIST`, and short-lived verification records. The API never returns a moderator name, email, stable public alias, raw credential, IP address, or user agent.

Moderator tasks can be claimed and released through `/api/moderation/tasks`. Decisions close the task and record response time. `/api/moderation/metrics` reports only the authenticated moderator's workload plus aggregate team totals and daily trends. A quality reviewer can record an append-only `upheld`, `reversed`, or `inconclusive` outcome through `/api/moderation/quality`; a reversed `hold` or `flag` is counted as an illegitimate bounce. The system prevents a moderator from reviewing their own decision.

This creates accountability without exposing moderators to the public. The service stores only secret-backed HMAC credential fingerprints and rotating verification timestamps; hosting-provider security logs remain outside the application’s control. Completed moderator task history is retained for 180 days and quality-review history for 365 days to balance accountability with data minimization.

## Run locally

For a UI-only preview, open `dist/index.html` in a browser or serve the repository with any static server:

```bash
python3 -m http.server 4173 --directory dist
```

Then visit `http://localhost:4173`.

The server-side privacy gate is generated for Sites’ Worker runtime. Run `node scripts/build-worker.mjs` before packaging a deployment; a local static server will not provide the D1-backed `/api/happenings` endpoint.

After rebuilding the Worker, run `node scripts/security-smoke.mjs` to check the response security headers and mutation boundary with synthetic requests.

## Ordered work backlog

1. **Claim, evidence, source, assessment, and correction model — prototype complete.** Keep the model explicit in the UI and prepare the API/database shape around append-only evidence and revisions.
2. **Server-side privacy and moderation — public read path and retention enforcement live.** The Site now has a D1-backed public happenings endpoint, approved-report aggregation, server-side text/location controls, enforced cleanup for expired unverified records, non-identifying deletion audit counts, a scheduled-retention handler ready for a host Cron Trigger, private-review media state, moderation reports, a request limit, a public aggregate review-status endpoint, and fail-closed authenticated queue/action routes with append-only decisions. Next hardening is configuring the deployment secret, attaching the production Cron Trigger, adding moderator/privacy-request workflows, and server-side media processing.
3. **Structured legitimacy and perspective labels — confidence rubric added.** Separate evidence alignment from popularity; label the reported frame independently from truth status, show confidence and basis, and keep the color legend explicitly non-evidentiary.
4. **Anti-gaming reputation — source diversity and coordination controls live.** The Site now uses server-assessed useful-evidence events, same-story duplicate protection, diminishing returns, daily caps, distinct-source weighting, a durable abuse bucket, and a coordination-review hold for burst assessments. Next hardening is reviewed correction credit and durable investigation workflows.
5. **Journalist and fact-seeker workspace — evidence, desk, and correction handoff live.** The Site now surfaces approved evidence trails, correction history, open questions, evidence gaps, and durable signed-in “add to desk” state. Next hardening is durable investigations, source comparison, and evidence requests.
6. **Notifications and community growth — map-first slice live.** The Site now uses a single-screen map with compact left-click previews, right-click actions, filter controls, and privacy-preserving markers. Next hardening is account-backed alert preferences and rate-limited notification delivery only after the identity and abuse controls are ready.

## Security

See [SECURITY.md](./SECURITY.md) for the reporting process and current security boundaries. The first hardening layer rejects cross-origin mutations, requires JSON request bodies, bounds the in-memory rate limiter, and applies response security headers at the Worker boundary.

## License

Apache-2.0. See [LICENSE](./LICENSE).
