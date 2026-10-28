# Contributing to Legit

Legit is designed for careful, local, source-aware reporting. Contributions should make it easier to understand what is known, what is claimed, and what still needs checking.

## Before opening a pull request

- Keep claims attributed to a person, organization, source, or perspective.
- Do not add language that turns popularity into certainty.
- Treat privacy, safety, accessibility, and anti-abuse protections as product features.
- Preserve anonymous-by-default behavior and aggregate public locations; never add exact-location exposure as a convenience shortcut.
- Keep attachment filtering fail-closed for new or low-legitimacy happenings. Image metadata must be stripped before display, and video needs a review path.
- Include a short note explaining how a change affects trust, uncertainty, or source provenance.

## Data-model rules

- Keep the primary claim separate from the happening description; a happening may contain several claims over time.
- Classify every evidence item by type and relationship (`supports`, `qualifies`, or `contradicts`) and preserve its provenance and capture time.
- Keep source-quality assessment separate from agreement with a claim.
- Record corrections as append-only revisions. Do not overwrite the original signal or erase uncertainty from the public history.
- Treat legitimacy as alignment among independently useful evidence, never as a raw popularity count.
- Route new submissions through `/api/happenings`; do not make browser state authoritative for public records.
- Keep moderation fail-closed: if durable storage or privacy processing is unavailable, reject the write rather than publishing an unreviewed fallback.

## Development

Use a current Node.js 22 or 24 release. SQLite integration tests use the built-in `node:sqlite` module. These build and test commands need no third-party packages or production credentials.

- Edit public assets in `dist/` and server source in `worker/index.js`; do not hand-edit generated `dist/server/index.js`.
- Run `npm run build` to embed the current assets and Worker source into `dist/server/index.js`.
- Run `npm test` before opening a pull request. It rebuilds the Worker, checks JavaScript syntax, and runs the generated-output, SQLite privacy integration, submission-privacy, security, offline-privacy, refresh-reliability, detail-refresh, and map-focus suites. It stops with a nonzero exit code on the first failure.
- Include generated Worker changes with their source changes. `git diff -- dist/server/index.js` shows whether rebuilding changed the checked-in bundle.
- A static preview of `dist/` provides the UI only; it does not provide the D1-backed API. Test primary flows with a keyboard and narrow viewport when a browser preview is available. The synthetic test suites do not replace browser or production D1 qualification.

## Continuous integration

GitHub Actions runs validation for pushes to `main`, pull requests, and manual runs on Node.js 22 and 24. It uses read-only repository permissions and no production credentials. Run `npm run check:generated` **before** `npm test` to catch a stale checked-in Worker without rewriting it. If it fails, run `npm run build` and commit the generated output with its source changes. CI also checks that the tests leave generated output unchanged.

The SQLite privacy suite applies every canonical migration to an in-memory database, adapts the D1 statement methods, and invokes the built Worker routes with synthetic submissions. It checks real SQL joins and constraints. It does not qualify Cloudflare D1 service behavior, concurrency, or production data.
