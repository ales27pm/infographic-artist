# Infographic Artist — consolidated plugin, 1.2.0

The deliverable is a working plugin in ChatGPT and Codex. The Vercel 70-reference catalogue is a research artifact, not the plugin or a replacement MCP server.

## Single public contract

Endpoint: `https://infographic-artist-1w7v.hatchable.site/api/chatgpt-mcp`.
Nine read-only tools: atlas, case, system comparison, graph, library, directions, uploaded-image critique, visual comparison and coaching. Results include `structuredContent` and JSON text fallback for non-UI MCP clients.

The source catalogue has 934 entries: 64 deeper studies and 870 index leads. The 70 supplementary annotated project references are bundled in the skill. They overlap with the mechanism atlas and must not be added to its count as 70 distinct new brands. Neither collection redistributes third-party images or font files.

## Images and capability truth

Direction generation returns three complete art-directed prompts. The widget's **`@Créer une image`** action sends the selected prompt to ChatGPT/Codex. Actual image generation uses the host tool only when present and requested. A prompt or a transmitted follow-up is not a generated image.

The experimental Python renderer is retained but opt-in. `IMAGE_GENERATION_PROVIDER=mock` is for tests only. A production provider additionally requires explicit enablement and operator credentials. No provider credentials, costs or durable rendering service were activated in this consolidation. Hatchable's public build excludes the in-memory renderer rather than advertising jobs it cannot reliably retain.

ChatGPT supplies real selected-file references for image tools. A local Codex path is not a remote download URL: use an actual host file reference or clearly label native visual analysis. Never publish private artwork to make an HTTP test pass.

## Reproducible source and deploy

`python/assets/app-v1.html` is the widget master. `scripts/build_plugin.py` also regenerates `chatgpt-tool-review-autofill.json` from the public submission and portable manifest, preventing a twelve-tool/private-renderer description from reaching public review. It generates `hatchable/lib/widget.js`, release fingerprints and the exact `deployment/hatchable/` sources. Relative imports are adapted for Hatchable's module resolver. The production MCP file is bundled by `scripts/bundle_public_mcp.mjs` using pinned esbuild 0.27.3. Deploy `deployment/public-mcp.bundle.js` as `api/chatgpt-mcp.js` and `deployment/public-health.js` as `pages/health.js`; verify their hashes against `deployment/public-manifest.json`. This two-file surface avoids partial shared-pool updates. Supporting site modules and data stay intact. Existing challenge, public pages and video routes are preserved.

```
python3 scripts/build_plugin.py
python3 scripts/build_plugin.py --check --output /tmp/infographic-plugin-release
node scripts/bundle_public_mcp.mjs --check
node --test hatchable/tests/*.test.mjs
cd python
pytest
python scripts/check_widget_js.py
python scripts/validate_submission.py --output-dir /tmp/infographic-validation
```

No GitHub Actions. The release fingerprint on `/health` identifies the tested source set; the served widget must match its SHA-256.

## Distribution

Portable package: `plugins/infographic-artist/plugin.json`, `mcp.json`, `skills/`, assets. Compatibility manifests are included for Codex. The repo marketplace is `.agents/plugins/marketplace.json`.

Install the tested branch or eventual merged main through `codex plugin marketplace add`, then `codex plugin add infographic-artist@27pm-plugins`. Do not represent a local or Git marketplace install as universal public-directory approval.

For public review, submit the ZIP with the real remote MCP URL using the current With MCP flow. The package includes seven positive and three negative review cases: the original five positive cases plus full golden-ratio principle retrieval with limits and sources, and an eight-stage plan with three separate untested human evaluations. Final attestations, a current walkthrough recording, and approval/publication status must be verified in the actual developer portal; this repository cannot assert them. The older `/demo.mp4` may be valid video without proving the new handoff.

## Recovery rule

Verify source, package, installed Codex state and live Hatchable separately. A passing local suite or health status is not proof of host tool invocation. Preserve original untracked files, inspect authoritative deploy state before retrying, and rerun the original failing case after each fix.

## Release 1.1.1 regression protection

Native handoff disables the selected action before awaiting the host. State survives same-result rerenders. A returned refusal, interrupted connection or confirmation timeout does not become a success message and never destroys the visible brief. Only a definite refusal enables an explicit manual retry; uncertain deliveries are not retransmitted automatically. The new UI resource is versioned, and the old `app-v1.html` resource remains readable for existing connections.

The archived 1.0.0 portal export contained release notes for an unrelated audio project and obsolete support URLs. It is historical evidence, not current portal state. The new ZIP supplies explicit Infographic Artist release notes and canonical URLs. Apply it to the existing portal record; never import historical attestations or claim a public publication based on a local test.

Run `npm ci --ignore-scripts` to install the pinned build/test dependencies and `npm run test:ui` for host-API regression tests. Existing browser installations may be used through `INFOGRAPHIC_PLAYWRIGHT_PATH`; no connected user browser session or credentials are required by that isolated test.

## Native image action — 1.1.2

The single ChatGPT image-generation action is **`@Créer une image`**. The widget displays this exact name and sends a follow-up beginning with this exact string. It does **not** invoke an Images API or assert that the tool was called: the ChatGPT host must actually choose and execute its native image-generation tool. The public plugin does not expose server-side rendering. Codex uses a native equivalent only if supported; otherwise it returns the prompt without faking a result.

## Release 1.2.0 — principles and eight-stage planning

The local contract adds **150 documented design principles, 69 sources and 14 domains**, separate from the brand-atlas counts above. It is an extended map, not an exhaustive or systematic review. `search_design_systems` with `kind='principle'` returns full matching records, including `definition`, `basis`, `application`, `limits`, `formula`, `source_ids` and resolved sources with `supports` and reading scope. Missing reading scope stays explicitly unrecorded; a geometric formula does not certify aesthetic preference or physical energy.

`coach_brand_decision` and `generate_brand_directions` accept optional `design_context` (`task`, `message`, `medium`, `final_size`, `audience`, `cultural_context`). `data.design_workflow` preserves the declared brief, identifies missing facts and follows these exact stage titles:

1. Définir la tâche, le public, le message, le support et la taille finale.
2. Déterminer ce que le visuel doit représenter correctement.
3. Appliquer les contraintes de reproduction et d’accessibilité pertinentes.
4. Choisir les principes perceptifs qui clarifient la structure.
5. Explorer plusieurs systèmes de proportion et de composition.
6. Développer la direction artistique et les références symboliques.
7. Effectuer les corrections optiques et les déclinaisons.
8. Évaluer séparément reconnaissance, compréhension et préférence.

The plan and the three separate recognition, comprehension and preference evaluations begin as `non_testé`, with empty observations and evidence. Image-critique scores remain technical heuristics, not measured recognition, comprehension, preference or an aggregate beauty score. Any actual verification must retain its target, criterion and evidence type: `calcul`, `inspection` or `essai`. A plan, visible stage or heuristic score is not a completed audit.

The canonical UI resource is `ui://infographic-artist/app-v1.2.0.html`; the `app-v1.html`, `app-v1.1.1.html` and `app-v1.1.2.html` aliases remain readable. The exclusive **`@Créer une image`** host-native handoff is preserved. This section documents local source changes; remote tests, installation, portal approval and showcase publication require their own evidence and are not asserted here.

## Runtime revision 2 — review corrections (2026-10-24)

The portable/public package stays at 1.2.0. The hosted MCP runtime identifies as
`1.2.0-hatchable.2`, with `release.runtime_revision = 2`; the standalone Python
runtime identifies as `1.2.0+reviewfix.2`. This is not a new OpenAI publication
attestation. The canonical widget resource is `app-v1.2.0-r2.html`; the original
`app-v1.2.0.html` and earlier aliases remain readable.

Graph queries reserve matching subjects before one-hop context and truncation.
Nonempty unmatched queries return an explicit empty graph, not unrelated popular
nodes. Image prompts preserve required exact text and declared dimensions in the
actual host handoff; web briefs receive page-layout directions, not logo sheets.

The coach extracts explicit French/English counts, minute/hour budgets and pixel
lists. It does not claim general natural-language understanding: conflicting,
ranged or unsupported recognized constraints stay unresolved rather than becoming
invented defaults. Proposed schedules and acceptance criteria are not performed
user studies. Recognition, comprehension and preference remain separately untested.

Without a reference, `axes.differentiation.score` is `null`, with status
`non_evaluable`. Consumers must use `score_max` (80 for the four scored axes),
respect `excluded_axes`, and never coerce unavailable axes to zero or /100. No
overall grade is assigned to partial coverage. With a reference, differentiation
remains only a relative perceptual heuristic, not corpus-wide originality.

Regression entry points: `python/tests/test_review_regressions.py`,
`hatchable/tests/review-regressions.test.mjs` and
`hatchable/tests-ui/review-regressions.test.mjs`. The browser tests use an isolated
host-API harness; successful follow-up delivery does not prove native image
creation inside ChatGPT. Keep that external boundary explicitly unverified until
an actual image-generation tool call and returned image have been observed.

## Runtime revision 4 — deeper boundary verification (2026-10-24)

The hosted runtime is `1.2.0-hatchable.4`; the standalone version is
`1.2.0+reviewfix.4`. The portable package version remains 1.2.0. This change is
not a new OpenAI portal approval or publication. The canonical widget is
`app-v1.2.0-r4.html`; r3, r2 and all earlier aliases remain readable.

Image tools now accept host-authorized ChatGPT attachment origins only. An
arbitrary external image URL must first be attached/selected in ChatGPT. Each
redirect is validated before following it. Raster signatures, MIME consistency,
12 MiB processing size and header dimensions (8192 per side / 50 million pixels)
are checked before browser decoding. The decoder starts on the managed browser's
initial blank page and receives only a data URL; it never navigates to user
HTML. Alpha is flattened onto white before resampling, consistently with Python.
Hatchable buffers fetch responses upstream, so the byte cap is a processing limit,
not a claimed streaming network/memory guarantee. The trusted-host policy is not
an independent audit of OpenAI/CDN DNS or the platform network boundary.

User briefs are rejected at explicit length limits rather than silently truncated.
Unsearchable nonempty atlas queries no longer become browse requests. Coaching
recognizes decimal and compound hour budgets, keeps negative size lists negative,
and ignores malformed/out-of-range supplied axes. This remains conservative
numeric extraction, not unrestricted natural-language understanding.

Native handoffs distinguish valid acknowledgements from malformed values. With
host widget-state support, SHA-256 fingerprints and delivery phases survive an
iframe reload; raw prompts are not persisted there. An interrupted/pending receipt
restores as uncertain and is not resent. Without host persistence support, the
existing in-memory protection remains. Clipboard denial offers a selectable full
native request. Late host capability can become usable without sending anything
automatically. A stale tool result cannot replace a newer user selection, and a
failed read preserves the current design and recovery controls.

Release gates now execute the actual generated production handler through its
image pipeline, not just the source module. The builder keeps the explicit
`BEGIN_PUBLIC_IMAGE_INPUTS` boundary; do not strip new public policy constants
when excluding the experimental renderer. Managed Hatchable browsers reject an
explicit `goto('about:blank')` even though their initial page is blank: use that
initial page directly, verified in the live managed service. PNG/JPEG/WebP/GIF
are decoded in Chromium in local tests; transparent and white-backed fixtures
have equal descriptors. Test doubles for network/host delivery are labelled and
must not be presented as a new real ChatGPT image-generation proof.
