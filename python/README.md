# Infographic Artist — ChatGPT App 1.0.1

Infographic Artist is an MCP-backed ChatGPT App for brand-system research and design decisions. It exposes an interactive atlas, a knowledge graph, a graphic-systems library, original direction generation with plugin-ready concept-board prompts, plugin-side image rendering, visual critique, perceptual-similarity triage, and a coach that converts feedback into measurable experiments.

Most tools are read-only analysis tools. `render_brand_direction` and `run_brand_workflow` are non-destructive generation tools: they can call the configured image-generation provider, incur provider costs for the app operator, create generated image assets, and store render-job metadata until the configured retention window expires. The app still does not publish, send email, purchase anything for the user, or modify external user records. Iconic identities are treated as precedents of method; the app does not distribute third-party logo artwork and does not provide trademark clearance.

## App archetype

`submission-ready`: Python Streamable HTTP MCP server plus one self-contained vanilla HTML widget. All twelve tools return concise `structuredContent`, explicit output schemas, explicit safety annotations, and the same versioned MCP App resource.

## Tools

- `open_brand_atlas`
- `get_brand_case`
- `compare_brand_systems`
- `explore_brand_graph`
- `search_design_systems`
- `generate_brand_directions`
- `render_brand_direction`
- `run_brand_workflow`
- `get_render_job`
- `critique_brand_image`
- `compare_brand_images`
- `coach_brand_decision`

## Run locally

```bash
uv venv
source .venv/bin/activate
uv pip install -e '.[dev]'
python server.py
```

Endpoints:

- Website: `http://127.0.0.1:8000/`
- MCP: `http://127.0.0.1:8000/mcp`
- Health: `http://127.0.0.1:8000/health`
- Privacy: `http://127.0.0.1:8000/privacy`
- Terms: `http://127.0.0.1:8000/terms`
- Support: `http://127.0.0.1:8000/support`
- OpenAI domain challenge: `http://127.0.0.1:8000/.well-known/openai-apps-challenge`

With the required `mcp>=1.28.1,<2` dependency installed, `server.py` selects `official_server.py`. `fallback_server.py` exists only so the contract can be exercised in restricted build environments where the official wheel cannot be downloaded.

## Validate

```bash
pytest
python scripts/validate_submission.py
python scripts/check_widget_js.py
python scripts/smoke_mcp.py --output validation/runtime-smoke.json
```

## Production

Deploy to a stable public HTTPS origin and set:

```text
APP_BASE_URL=https://your-production-origin.example
MCP_ALLOWED_HOSTS=your-production-origin.example
MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://platform.openai.com
CORS_ALLOW_ORIGINS=https://chatgpt.com,https://platform.openai.com
OPENAI_APPS_CHALLENGE_TOKEN=
OPENAI_API_KEY=<set-in-deployment-for-live-rendering>
IMAGE_GENERATION_PROVIDER=openai
IMAGE_GENERATION_MODEL=gpt-image-2
GENERATED_ASSET_DIR=generated_assets
GENERATED_ASSET_RETENTION_HOURS=168
GENERATED_ASSET_MAX_BYTES=536870912
RENDER_MAX_CONCURRENT_JOBS=2
RENDER_DAILY_IMAGE_LIMIT=25
```

`APP_BASE_URL` must be an HTTPS origin with no path, query, or fragment. It is injected into `_meta.ui.domain`, the compatibility `openai/widgetDomain` field, and the widget resource allowlist so generated image assets can load from the app origin.

Keep `OPENAI_APPS_CHALLENGE_TOKEN` empty until the OpenAI portal issues a verification token. Once set, the well-known route returns exactly that token; while unset, it returns HTTP 404.

`OPENAI_API_KEY` is required only for live plugin-side rendering with `IMAGE_GENERATION_PROVIDER=openai`. Live rendering is bounded by the configured concurrency and daily image quotas. Local tests and smoke checks use `IMAGE_GENERATION_PROVIDER=mock` to avoid paid image-generation calls.

A `Dockerfile`, `Procfile`, and `render.yaml` are included.

## Submission and publication

- Import/reviewer metadata: `chatgpt-app-submission.json`
- Icon and screenshots: `assets/`
- Reviewer material: `submission/`
- Website and policies: `docs/website.md`, `docs/privacy-policy.md`, `docs/terms.md`, `docs/support.md`
- End-to-end publication guide: `docs/PUBLISH_TO_CHATGPT.md`
- Reproducible runtime smoke test: `scripts/smoke_mcp.py`

The package is **code-complete for deployment, not hosted or directory-published**. Final publication still requires a public origin, portal domain verification, an eligible verified OpenAI organization/project, the platform tool scan, review approval, and an explicit owner-triggered publish action.
