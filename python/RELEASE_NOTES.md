# Infographic Artist ChatGPT App 1.0.1

Release date: 2026-07-29

## Plugin resubmission release notes

Initial submission of Infographic Artist, an MCP-based design research, rendering, and critique app by 27pm.

The app provides twelve tools for brand-system research, precedent comparison, knowledge-graph exploration, original creative-direction generation, plugin-side concept-board rendering, uploaded-image critique, perceptual-similarity triage, render-job status polling, and design coaching.

The app requires no authentication and includes no commerce or advertising. Rendering tools may call the configured image-generation provider, incur provider costs for the app operator, and store generated assets until retention expiry. Uploaded images are accessed temporarily through ChatGPT-provided file URLs for the requested analysis and are not persistently stored by the app.

## Included

- Twelve MCP tools for atlas research, cases, comparison, graph exploration, systems research, creative direction, rendering, render status, image critique, image similarity, and coaching.
- One versioned, self-contained MCP Apps widget.
- A 934-identity atlas, 105-system library, and 159-node/425-edge mechanism graph.
- ChatGPT file-attachment descriptors for visual critique and comparison.
- Explicit input/output schemas and tool annotations.
- Original icon and three review screenshots.
- Public website, privacy, terms, support, deployment, review, and publication documents.
- Importable `chatgpt-app-submission.json` with expanded positive and negative review cases, including rendering and status polling.
- Official MCP Python SDK production path plus a bounded fallback contract runner for restricted build environments.

## Changes from 1.0.0

- Added `/.well-known/openai-apps-challenge` to both runtimes.
- Added environment-driven exact-token domain verification through `OPENAI_APPS_CHALLENGE_TOKEN`.
- Added a public website at `/` for the listing URL.
- Added automated tests and smoke coverage for the website and domain challenge.
- Updated the import JSON to the current Apps SDK submission schema URL.
- Added `render_brand_direction`, `run_brand_workflow`, `get_render_job`, generated-asset storage, and retention-aware asset routes.
- Updated the review package for website fields, country/region availability, publisher identity consistency, Apps Management permissions, and global-data-residency project requirements.

## Publication boundary

The release is code-complete for deployment but is not yet hosted, submitted, approved, or published. The remaining account-bound operations are production deployment, portal-issued domain verification, publisher/organization verification, availability selection, Scan Tools, review submission, and explicit publication after approval.
