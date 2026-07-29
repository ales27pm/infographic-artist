# Validation results — Infographic Artist ChatGPT App 1.0.1

Validation date: **2026-07-28**

## Result

**PASS — submission package is structurally ready for deployment and OpenAI review.**

This result does not claim that the app has already been hosted, submitted, approved, or published in ChatGPT. Those stages require a stable public HTTPS deployment and actions performed from the owning OpenAI organization.

## Automated checks

| Check | Result |
|---|---|
| Pytest suite | **29 passed** |
| Submission import validator | **passed** |
| Python syntax/bytecode compilation | **passed** |
| Widget JavaScript syntax (`node --check`) | **passed** |
| Secret-pattern scan | **passed** |
| Tool count | **9** |
| Every tool has `inputSchema` | **yes** |
| Every tool has `outputSchema` | **yes** |
| Every tool has explicit read/open-world/destructive hints | **yes** |
| Positive review cases | **5** |
| Negative review cases | **3** |

## Runtime MCP smoke test

A real local HTTP process was started and exercised through JSON-RPC on `/mcp`.

| Check | Observed |
|---|---|
| Runtime | `official-mcp-sdk` |
| `GET /health` | HTTP 200 |
| MCP protocol | `2025-06-18` |
| Server name | `infographic-artist` |
| `tools/list` | 9 tools |
| Representative `tools/call` | `open_brand_atlas` returned the FedEx case |
| Widget URI | `ui://infographic-artist/app-v1.html` |
| Widget MIME | `text/html;profile=mcp-app` |
| Widget bridge | `tools/call` and `ui/notifications/tool-result` detected |
| Public website | HTTP 200; product identity present |
| Domain challenge | HTTP 200; response body exactly matched the configured token |
| Privacy / terms / support | HTTP 200 / 200 / 200 |

Machine-readable evidence: `validation/runtime-smoke.json`.

## Corpus and assets

| Item | Count / dimensions |
|---|---|
| Atlas identities | 934 |
| Deep monographs | 64 |
| Index records | 870 |
| Graphic-system records | 105 |
| Knowledge-graph nodes | 159 |
| Knowledge-graph edges | 425 |
| Main icon | 512 × 512 PNG |
| Small icon | 64 × 64 PNG |
| Atlas screenshot | 1440 × 1469 PNG |
| Directions screenshot | 1440 × 1474 PNG |
| Critique screenshot | 1440 × 980 PNG |

## Runtime distinction

The smoke test used `official_server.py` through the installed official `mcp` SDK. It verified stateless Streamable HTTP JSON-RPC on `/mcp`, local host/origin transport checks, and the domain challenge route returning only the configured token without decoration or caching.

`fallback_server.py` remains in the package only so the contract can still be exercised in restricted build environments where the official wheel cannot be downloaded. The first production deployment should still install `requirements.txt` and repeat `scripts/smoke_mcp.py` before submission.

## Remaining external gates

- stable public HTTPS origin;
- production execution with the official MCP SDK dependency installed;
- ChatGPT Developer Mode connection;
- portal-issued domain verification;
- OpenAI Scan Tools pass;
- owning-organization verification, permissions, and global data residency;
- availability selection;
- human review approval;
- explicit owner-triggered publication.
