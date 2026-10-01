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

The current prototype is a static site in `dist/`. Make changes there, serve it locally, and test the primary flows with keyboard and a narrow viewport before submitting a pull request.
