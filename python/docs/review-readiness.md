# ChatGPT plugin review readiness

## Product scope

Infographic Artist has one clear purpose: help people study brand-system mechanisms and make more original, testable visual decisions. It can render original concept boards from user briefs, but it does not generate or distribute third-party logo artwork.

## Tool contract

- Twelve tools, each with one job.
- Every description begins with “Use this when…” and states the intended trigger.
- Inputs and outputs use JSON Schema.
- Analysis and status tools declare `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`, and `idempotentHint: true`.
- `render_brand_direction` and `run_brand_workflow` declare `readOnlyHint: false`, `destructiveHint: false`, `openWorldHint: true`, and `idempotentHint: false`.
- File tools declare ChatGPT file parameters and require only `download_url` and `file_id`.
- `generate_brand_directions` returns text routes, plugin-ready concept-board prompts, and evaluation criteria without calling an image-generation API.
- `render_brand_direction` and `run_brand_workflow` start asynchronous image-generation jobs, store generated assets, and return polling metadata. `get_render_job` returns status without starting a new render.
- One versioned widget resource is returned through `_meta.ui.resourceUri`, with compatibility aliases for existing ChatGPT hosts.

## Widget security

- Self-contained HTML, CSS, and JavaScript.
- No third-party scripts, fonts, trackers, or frames.
- Widget CSP allows generated assets from the configured app origin when `APP_BASE_URL` is set.
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
- Generated concept boards are created only when a render tool is used, stored under generated-asset retention rules, and eligible for deletion after `GENERATED_ASSET_RETENTION_HOURS`, 168 hours by default.
- 12 MB file limit and MIME validation.
- SSRF protections reject non-HTTPS, local, private, reserved, and credential-bearing destinations.
- `OPENAI_API_KEY` is required only for live rendering when `IMAGE_GENERATION_PROVIDER=openai`; tests use the mock provider to avoid paid API calls.

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
8. Test all positive and negative review cases, including render job start, workflow start, and status polling.
9. Select country/region availability, upload assets, and submit.
10. After approval, publish explicitly from the owning organization.
