# Infographic Artist — consolidated plugin, 1.1.1

The deliverable is a working plugin in ChatGPT and Codex. The Vercel 70-reference catalogue is a research artifact, not the plugin or a replacement MCP server.

## Single public contract

Endpoint: `https://infographic-artist-1w7v.hatchable.site/api/chatgpt-mcp`.
Nine read-only tools: atlas, case, system comparison, graph, library, directions, uploaded-image critique, visual comparison and coaching. Results include `structuredContent` and JSON text fallback for non-UI MCP clients.

The source catalogue has 934 entries: 64 deeper studies and 870 index leads. The 70 supplementary annotated project references are bundled in the skill. They overlap with the mechanism atlas and must not be added to its count as 70 distinct new brands. Neither collection redistributes third-party images or font files.

## Images and capability truth

Direction generation returns three complete art-directed prompts. The widget's **Créer dans la conversation** action sends the selected prompt to ChatGPT/Codex. Actual image generation uses the host tool only when present and requested. A prompt or a transmitted follow-up is not a generated image.

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

For public review, submit the ZIP with the real remote MCP URL using the current With MCP flow. The package includes five positive and three negative review cases. Final attestations, a current walkthrough recording, and approval/publication status must be verified in the actual developer portal; this repository cannot assert them. The older `/demo.mp4` may be valid video without proving the new handoff.

## Recovery rule

Verify source, package, installed Codex state and live Hatchable separately. A passing local suite or health status is not proof of host tool invocation. Preserve original untracked files, inspect authoritative deploy state before retrying, and rerun the original failing case after each fix.

## Release 1.1.1 regression protection

Native handoff disables the selected action before awaiting the host. State survives same-result rerenders. A returned refusal, interrupted connection or confirmation timeout does not become a success message and never destroys the visible brief. Only a definite refusal enables an explicit manual retry; uncertain deliveries are not retransmitted automatically. The new UI resource is versioned, and the old `app-v1.html` resource remains readable for existing connections.

The archived 1.0.0 portal export contained release notes for an unrelated audio project and obsolete support URLs. It is historical evidence, not current portal state. The new ZIP supplies explicit Infographic Artist release notes and canonical URLs. Apply it to the existing portal record; never import historical attestations or claim a public publication based on a local test.

Run `npm ci --ignore-scripts` to install the pinned build/test dependencies and `npm run test:ui` for host-API regression tests. Existing browser installations may be used through `INFOGRAPHIC_PLAYWRIGHT_PATH`; no connected user browser session or credentials are required by that isolated test.
