# Infographic Artist

This repository is the canonical source for the two Infographic Artist implementations:

- `python/` contains the standalone Python ChatGPT/MCP package, submission material, validation scripts, and deployment files.
- `hatchable/` contains the byte-for-byte source export of the live Hatchable project currently serving `https://infographic-artist-1w7v.hatchable.site`.

The Hatchable export is a backup only. No production Hatchable deployment is triggered by committing these files.

## Workflows

Run and validate the Python package from `python/`:

```bash
cd python
uv venv
source .venv/bin/activate
uv pip install -e '.[dev]'
pytest
python scripts/validate_submission.py
python scripts/check_widget_js.py
python scripts/smoke_mcp.py --output validation/runtime-smoke.json
```

Inspect the Hatchable export manifest:

```bash
cat hatchable/EXPORT_MANIFEST.json
```

## Public website and review URLs

The public website source lives in `hatchable/`. It implements the plugin review URLs:

- `/`
- `/privacy`
- `/terms`
- `/support`
- `/robots.txt`
- `/sitemap.xml`
- `/demo.mp4` when a real MP4 is supplied

Local validation:

```bash
node hatchable/scripts/format-check.mjs
node hatchable/scripts/lint-site.mjs
node hatchable/scripts/typecheck.mjs
node hatchable/scripts/validate-site.mjs
```

Production gate:

```bash
node hatchable/scripts/build-site.mjs
```

The production gate intentionally fails until both of these are true:

1. `hatchable/lib/site-config.js` has a verified 27pm-controlled support email in `SITE.support.email`.
2. `hatchable/public/demo.mp4` is a real browser-playable MP4.

Prepare a real demo recording:

```bash
node hatchable/scripts/prepare-demo.mjs /path/to/real-demo.mp4
```

Generate a demo with the OpenAI Sora 2 Videos API:

```bash
OPENAI_API_KEY=... node hatchable/scripts/generate-sora-demo.mjs
```

The Sora workflow follows the official model and video-generation docs for `sora-2`: create a video job with `POST /v1/videos`, poll the video status, download the completed MP4, and write it to `hatchable/public/demo.mp4`.

Do not place a generated placeholder at `/demo.mp4`. If `demo.mp4` is absent, local validation verifies that the route is a plain non-HTML 404 instead of a homepage fallback.

## Deployment note

As of July 29, 2026, live DNS for `27pm.org` resolves to Squarespace addresses and returns a Squarespace "Coming Soon" parking page. This repository is not currently bound to `27pm.org` through `.openai/hosting.json`, and the Sites account inspected during validation did not list a 27pm.org site project.

The provided Squarespace app password was used only for read-only Developer Platform Git discovery. The expected template repositories at `https://27pm.org/template.git`, `https://www.27pm.org/template.git`, `https://27pm.squarespace.com/template.git`, and the internal Squarespace site slug exposed by the login flow were not reachable as Git repositories. That means an app password alone is not enough to deploy this site to Squarespace from this checkout; Developer Mode Git must be enabled for a Squarespace 7.0 template site, a connected GitHub template repository must be provided, or DNS must be moved to a host that can serve the implemented site.

The free hosting path is the existing Hatchable project exported here: `proj_0ZtdM0sQTbe1`, currently published at `https://infographic-artist-1w7v.hatchable.site`, which is also the MCP endpoint host. If Hatchable remains the production host, update the OpenAI submission URLs to:

- `https://infographic-artist-1w7v.hatchable.site`
- `https://infographic-artist-1w7v.hatchable.site/privacy`
- `https://infographic-artist-1w7v.hatchable.site/terms`
- `https://infographic-artist-1w7v.hatchable.site/support`
- `https://infographic-artist-1w7v.hatchable.site/demo.mp4`

If the submitted review URLs must remain on `https://27pm.org`, the Hatchable project needs custom-domain support or a separate routing layer that preserves paths and serves the Hatchable project, then `27pm.org` DNS can be pointed away from the Squarespace parking page. Do not remove unrelated DNS records.
