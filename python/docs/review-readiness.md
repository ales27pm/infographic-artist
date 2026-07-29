# ChatGPT plugin review readiness

## Product scope

Infographic Artist has one clear purpose: help people study brand-system mechanisms and make more original, testable visual decisions. It does not generate or distribute third-party logo artwork.

## Tool contract

- Nine tools, each with one job.
- Every description begins with “Use this when…” and states the intended trigger.
- Inputs and outputs use JSON Schema.
- Every tool declares `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`, and `idempotentHint: true`.
- File tools declare ChatGPT file parameters and require only `download_url` and `file_id`.
- One versioned widget resource is returned through `_meta.ui.resourceUri`, with compatibility aliases for existing ChatGPT hosts.

## Widget security

- Self-contained HTML, CSS, and JavaScript.
- No third-party scripts, fonts, trackers, frames, or remote images.
- Empty widget CSP allowlists.
- Text values are HTML-escaped before rendering.
- External source links open with `noopener noreferrer`.

## Hosting and domain verification

- Public product website at `/`.
- Stable MCP endpoint at `/mcp` after deployment.
- Health and three policy/support routes.
- `/.well-known/openai-apps-challenge` returns HTTP 404 while unconfigured.
- Once `OPENAI_APPS_CHALLENGE_TOKEN` is set, the route returns only that exact token with `Cache-Control: no-store`.

## Data and privacy

- No accounts or project database.
- Uploaded files are processed in memory and discarded after the call.
- 12 MB file limit and MIME validation.
- SSRF protections reject non-HTTPS, local, private, reserved, and credential-bearing destinations.
- No OpenAI API key is required by the app.

## Intellectual property

- Curated names, metadata, principles, and links only.
- No third-party logo artwork in the package.
- Server instructions prohibit reconstruction of protected signatures.
- Similarity output explicitly says it is not legal clearance.
- Index-depth evidence is distinguished from deep, sourced monographs.

## Before public submission

1. Deploy to a stable public HTTPS host and replace the URL placeholders.
2. Confirm `/health` reports `official-mcp-sdk`.
3. Connect and test `/mcp` in ChatGPT Developer Mode.
4. Use the final owning verified OpenAI organization and a global-data-residency project.
5. Create a **With MCP** plugin draft and enter the website/policy/support URLs.
6. Add the portal-issued domain token and verify the exact challenge response.
7. Run **Scan Tools** and clear every warning.
8. Test all five positive and three negative cases.
9. Select country/region availability, upload assets, and submit.
10. After approval, publish explicitly from the owning organization.
