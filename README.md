# Infographic Artist — 1.2.0

## Current plugin source: ChatGPT and Codex (1.2.0)

The canonical installable package is `plugins/infographic-artist/`. The public service exposes nine working read-only MCP tools at `https://infographic-artist-1w7v.hatchable.site/api/chatgpt-mcp`. Image-generation prompts are handed to the host conversation; experimental paid server rendering is not enabled in production.

See [the consolidation and distribution guide](docs/PLUGIN_CONSOLIDATION.md). Generate and verify the exact Hatchable release with `python3 scripts/build_plugin.py --check`. The Vercel atlas is supplementary research, not the plugin.

This repository is the canonical source for the two Infographic Artist implementations:

- `python/` contains the standalone Python ChatGPT/MCP package, submission material, validation scripts, and deployment files.
- `hatchable/` contains the editable source used to build the Hatchable project serving `https://infographic-artist-1w7v.hatchable.site`.

`hatchable/` is the editable source; `deployment/public-manifest.json` identifies the exact generated files deployed to Hatchable. A Git commit alone does not deploy them.

## Release 1.2.0 — documented design principles and workflow

The local source adds **150 documented design principles, 69 sources and 14 domains**. This is an extended map, not an exhaustive or systematic review. Use `search_design_systems` with `kind='principle'` and a principle ID or topic, such as `golden ratio`, to retrieve full cards with their basis, applications, limits and supporting sources. Source reading scope is reported or explicitly marked as unrecorded; a citation does not imply that the full text was read.

`coach_brand_decision` and `generate_brand_directions` accept optional `design_context` fields: `task`, `message`, `medium`, `final_size`, `audience` and `cultural_context`. They preserve declared context, identify missing facts and return `data.design_workflow` with these exact stages:

1. Définir la tâche, le public, le message, le support et la taille finale.
2. Déterminer ce que le visuel doit représenter correctement.
3. Appliquer les contraintes de reproduction et d’accessibilité pertinentes.
4. Choisir les principes perceptifs qui clarifient la structure.
5. Explorer plusieurs systèmes de proportion et de composition.
6. Développer la direction artistique et les références symboliques.
7. Effectuer les corrections optiques et les déclinaisons.
8. Évaluer séparément reconnaissance, compréhension et préférence.

The returned plan is initially `non_testé`. Recognition, comprehension and preference remain three separate evaluations, each `non_testé` with no invented observations or evidence. Critique scores are technical heuristics, not measured human outcomes, accessibility certification or an aggregate beauty score. Record actual checks separately as `calcul`, `inspection` or `essai`; a displayed stage is not proof of completion.

The exclusive native image action remains **`@Créer une image`**. This source update does not establish successful remote tests, installation, portal approval or publication of the showcase website. See the [design workflow](plugins/infographic-artist/skills/infographic-artist/references/design-workflow.md) for the complete protocol.

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

## Historical deployment note — July 2026 (not current DNS evidence)

As of July 29, 2026, live DNS for `27pm.org` resolves to Squarespace addresses and returns a Squarespace "Coming Soon" parking page. This repository is not currently bound to `27pm.org` through `.openai/hosting.json`, and the Sites account inspected during validation did not list a 27pm.org site project.

The provided Squarespace app password was used only for read-only Developer Platform Git discovery. The expected template repositories at `https://27pm.org/template.git`, `https://www.27pm.org/template.git`, `https://27pm.squarespace.com/template.git`, and the internal Squarespace site slug exposed by the login flow were not reachable as Git repositories. That means an app password alone is not enough to deploy this site to Squarespace from this checkout; Developer Mode Git must be enabled for a Squarespace 7.0 template site, a connected GitHub template repository must be provided, or DNS must be moved to a host that can serve the implemented site.

The free hosting path is the existing Hatchable project exported here: `proj_0ZtdM0sQTbe1`, currently published at `https://infographic-artist-1w7v.hatchable.site`, which is also the MCP endpoint host. If Hatchable remains the production host, update the OpenAI submission URLs to:

- `https://infographic-artist-1w7v.hatchable.site`
- `https://infographic-artist-1w7v.hatchable.site/privacy`
- `https://infographic-artist-1w7v.hatchable.site/terms`
- `https://infographic-artist-1w7v.hatchable.site/support`
- `https://infographic-artist-1w7v.hatchable.site/demo.mp4`

If the submitted review URLs must remain on `https://27pm.org`, the Hatchable project needs custom-domain support or a separate routing layer that preserves paths and serves the Hatchable project, then `27pm.org` DNS can be pointed away from the Squarespace parking page. Do not remove unrelated DNS records.
