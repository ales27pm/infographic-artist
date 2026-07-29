# OpenAI plugin submission fields

## App information

| Field | Value |
|---|---|
| Plugin type | With MCP |
| Display name | Infographic Artist |
| Subtitle | Brand research & critique |
| Category | DESIGN |
| Authentication | None |
| Commerce | None |
| Public writes | None |
| Persistent user storage | None |
| Suggested initial availability | Canada |

## Description

Infographic Artist helps designers study iconic brand systems, navigate a mechanism graph, compare precedents, generate original creative directions, critique uploaded proposals on five visual axes, triage perceptual similarity, and convert feedback into measurable design exercises.

## Production URLs

Replace `VOTRE-DOMAINE` only after the final deployment is stable.

| Field | URL |
|---|---|
| Website | `https://VOTRE-DOMAINE/` |
| MCP server | `https://VOTRE-DOMAINE/mcp` |
| Privacy policy | `https://VOTRE-DOMAINE/privacy` |
| Terms of use | `https://VOTRE-DOMAINE/terms` |
| Support | `https://VOTRE-DOMAINE/support` |
| Domain challenge | `https://VOTRE-DOMAINE/.well-known/openai-apps-challenge` |
| Health check | `https://VOTRE-DOMAINE/health` |

## Upload assets

| Asset | File | Dimensions |
|---|---|---|
| Main icon | `assets/app-icon-512.png` | 512 × 512 |
| Small icon | `assets/app-icon-64.png` | 64 × 64 |
| Atlas screenshot | `assets/submission-atlas.png` | 1440 × 1469 |
| Directions screenshot | `assets/submission-directions.png` | 1440 × 1474 |
| Critique screenshot | `assets/submission-critique.png` | 1440 × 980 |

## Reviewer summary

- Nine deterministic, read-only MCP tools.
- No login, purchases, messaging, publishing, deletion, or external mutation.
- Uploaded images are fetched from user-selected ChatGPT file URLs, processed in memory, and not persisted.
- The package contains metadata and analytical descriptions of iconic identities, not third-party logo artwork.
- Similarity results are perceptual triage and explicitly not trademark clearance.
- The widget is self-contained and has no remote scripts, trackers, fonts, frames, or direct network requests.
- The public domain challenge is off by default and returns the portal token exactly when configured.

## Test inventory

- Exactly five positive cases and three negative cases are provided in `chatgpt-app-submission.json`.
- Reviewer notes: `submission/review-notes.md`.
- Source audit: `submission/review-report.md`.
- Reproducible validation: `validation/TEST_RESULTS.md` and `validation/runtime-smoke.json`.
