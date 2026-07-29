# Infographic Artist ChatGPT App 1.0.1

Release date: 2026-07-24

## Plugin resubmission release notes

Initial submission of Infographic Artist, an MCP-based design research and critique app by 27pm.

The app provides nine read-only tools for brand-system research, precedent comparison, knowledge-graph exploration, original creative-direction generation, uploaded-image critique, perceptual-similarity triage, and design coaching.

The app requires no authentication, includes no commerce or advertising, performs no external write actions, and does not publish user content. Uploaded images are accessed temporarily through ChatGPT-provided file URLs for the requested analysis and are not persistently stored by the app.

## Included

- Nine read-only MCP tools for atlas research, cases, comparison, graph exploration, systems research, creative direction, image critique, image similarity, and coaching.
- One versioned, self-contained MCP Apps widget.
- A 934-identity atlas, 105-system library, and 159-node/425-edge mechanism graph.
- ChatGPT file-attachment descriptors for visual critique and comparison.
- Explicit input/output schemas and tool annotations.
- Original icon and three review screenshots.
- Public website, privacy, terms, support, deployment, review, and publication documents.
- Importable `chatgpt-app-submission.json` with five positive and three negative test cases.
- Official MCP Python SDK production path plus a bounded fallback contract runner for restricted build environments.

## Changes from 1.0.0

- Added `/.well-known/openai-apps-challenge` to both runtimes.
- Added environment-driven exact-token domain verification through `OPENAI_APPS_CHALLENGE_TOKEN`.
- Added a public website at `/` for the listing URL.
- Added automated tests and smoke coverage for the website and domain challenge.
- Updated the import JSON to the current Apps SDK submission schema URL.
- Updated the review package for website fields, country/region availability, publisher identity consistency, Apps Management permissions, and global-data-residency project requirements.

## Publication boundary

The release is code-complete for deployment but is not yet hosted, submitted, approved, or published. The remaining account-bound operations are production deployment, portal-issued domain verification, publisher/organization verification, availability selection, Scan Tools, review submission, and explicit publication after approval.
