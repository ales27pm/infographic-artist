---
name: infographic-artist
description: Research and improve visual identities, art, infographics and UI applications with documented principles of proportion, geometry, perception, aesthetics, physics and information design. Use for sourced precedents, concrete critique, an eight-step design workflow, distinct creative directions and native concept-to-image creation with Infographic Artist.
---

# Infographic Artist

The product is this plugin in ChatGPT and Codex. A showcase website or an HTML atlas is a supporting artifact, not a replacement for working plugin tools.

## Eight-step design workflow

Follow [the design workflow](references/design-workflow.md) in this order, adapting the depth to the task and reusing the user's confirmed context:

1. Définir la tâche, le public, le message, le support et la taille finale.
2. Déterminer ce que le visuel doit représenter correctement.
3. Appliquer les contraintes de reproduction et d’accessibilité pertinentes.
4. Choisir les principes perceptifs qui clarifient la structure.
5. Explorer plusieurs systèmes de proportion et de composition.
6. Développer la direction artistique et les références symboliques.
7. Effectuer les corrections optiques et les déclinaisons.
8. Évaluer séparément reconnaissance, compréhension et préférence.

Retrieve relevant principles on demand with `search_design_systems` and `kind='principle'`, searching by ID, name or domain. The bundled [design-principles.json](references/design-principles.json) contains 150 concepts, 69 references and 14 domains; it is an extended map, not an exhaustive or systematic review. Read each selected record's `basis`, `application`, `limits` and `source_ids`, then the cited source's scope. Applications are proposed translations into design, not experimentally validated instructions for every image. Load only relevant records; never apply all 150 rules to every brief.

When supported by the discovered tool schema, pass optional `design_context` (`task`, `message`, `medium`, `final_size`, `audience`, `cultural_context`) to `coach_brand_decision` or `generate_brand_directions`. Their `data.design_workflow` is an eight-step plan initialized as `non_testé`, not a performed audit. The Principes/library view exposes the same research; a visible step, returned plan or heuristic score is not evidence of completion. If the installed tools lack these fields, state that limitation and use the reference to prepare the plan without inventing a successful API call.

For actual checks, distinguish `calcul`, `inspection` and `essai`. Record only supported states: `non_testé`, `satisfait`, `écart`, `indéterminé`, `non_applicable`; attach the actual target, criterion and evidence. Keep recognition, comprehension and preference separate. Never produce an aggregate beauty score or imply that the server performed user studies, computed compliance or validated a proposed check.

## Tools and evidence

Use the bundled `infographic_artist` MCP server. Its canonical HTTPS endpoint ends in `/api/chatgpt-mcp`, not `/mcp`. Discover available tools; never assume a render tool exists just because an old document mentions it.

1. Identify the actual supplied image, brand name, intended medium and design question. Read or inspect the supplied files before claiming to have reviewed them. Do not invent initials, company identities or user-test results.
2. Use `open_brand_atlas` for precedents; then `get_brand_case` with a returned ID for sources and detail. Separate the 64 deeper studies from the broader index. Index entries are research leads, not verified historical claims.
3. Use `search_design_systems`, `explore_brand_graph` or `compare_brand_systems` only when they answer the question. Study mechanisms, not copied silhouettes.
4. For supplied images, use `critique_brand_image` or `compare_brand_images` with real file inputs. ChatGPT rewrites selected file parameters. A raw local Codex path is NOT an HTTPS file input: use an actual host-provided file reference or native visual inspection and label it as such. Do not upload private files to a public host just to make a test pass.
5. Distinguish computed image descriptors, subjective critique and observed user tests. The 100-point scores are heuristic diagnostics, not measured memorability, trademark clearance or WCAG contrast certification.
6. Use `generate_brand_directions` to prepare three structurally different routes. Preserve the user's exact words and brand constraints. Select a route based on silhouette, counterforms, hierarchy, small-size legibility and real production needs.

## Creating actual images

`generate_brand_directions` returns art-directed prompts, not rendered images. Read `image_generation_handoff`.

When its mode is `host_native`, the only designated ChatGPT image-generation action is **`@Créer une image`**. The widget button must display that exact label and send a follow-up starting with `@Créer une image` to request the real native tool. This is a conversation handoff, not a direct API call or a guarantee of tool execution. In Codex, use a native image-generation capability only when actually available; do not substitute a separate provider. If the user requests an image and the host provides the native tool, invoke that real tool. Carry the chosen route, original reference and exact text into that tool. Never paste tool JSON as the finished artwork; never say an image is generating unless a real generation call was made.

When the host has no image tool, return the selected production brief and say that no image was rendered in that execution. Do not invent a render job, a completed image, a download URL, a provider key or a paid API request. The public server does not run the experimental renderer. Do not enable the old `render_brand_direction`, `run_brand_workflow`, or paid Images API as a fallback for this native workflow. A mock provider proves plumbing only, not artwork quality.

For edits, a real image target is required. Do not treat an opaque ID or a claim of an approved image as an available file. Avoid requesting new uploads when the actual file is already supplied and readable.

## Improve and verify

Give specific changes to the drawing, spacing, hierarchy and applications. Keep wordmark geometry identical across colour and reversed variants unless an optical correction is deliberately documented. Check small sizes, monochrome, wide/mobile lockups and actual production constraints. No automatic numerical claim of perfection.

Use `coach_brand_decision` to convert the weakest decision into a concrete next test. A proposed test is not a performed test. An accessible logo does not certify the interface around it.

The optional `references/atlas-70.md` is a complementary collection of 70 annotated project references. Read relevant sections when developing the seven previously studied brand families; it is not a pack of reusable third-party logos or fonts.

## Scope and recovery

Keep the plugin, its MCP runtime, UI resource, versioned source and installable package aligned. Do not deploy a new site, publish on a user's behalf, change domains, start paid services, or rewrite another project unless that is explicitly requested. Never use GitHub Actions in this project.

On failure, identify the failing layer, inspect authoritative state and any partial side effects, fix the mechanism, and rerun the original failing test. Do not retry a successful deploy or install because its first response was interrupted.
