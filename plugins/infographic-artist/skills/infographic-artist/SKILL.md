---
name: infographic-artist
description: Research and improve visual identities, logos, brand systems, infographics and their UI applications with Infographic Artist. Use for source-aware precedents, concrete critique, distinct creative directions and a verified concept-to-image workflow. Not for unrelated calendars, email or deployment of a separate showcase site.
---

# Infographic Artist

The product is this plugin in ChatGPT and Codex. A showcase website or an HTML atlas is a supporting artifact, not a replacement for working plugin tools.

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

When its mode is `host_native`, use the current host's real image-generation tool when available and the user has requested an image. Carry the chosen route, original reference and exact text into that tool. Never paste tool JSON as the finished artwork; never say an image is generating unless a real generation call was made.

When the host has no image tool, return the selected production brief and say that no image was rendered in that execution. Do not invent a render job, a completed image, a download URL, a provider key or a paid API request. The public server does not run the experimental renderer. A mock provider proves plumbing only, not artwork quality.

For edits, a real image target is required. Do not treat an opaque ID or a claim of an approved image as an available file. Avoid requesting new uploads when the actual file is already supplied and readable.

## Improve and verify

Give specific changes to the drawing, spacing, hierarchy and applications. Keep wordmark geometry identical across colour and reversed variants unless an optical correction is deliberately documented. Check small sizes, monochrome, wide/mobile lockups and actual production constraints. No automatic numerical claim of perfection.

Use `coach_brand_decision` to convert the weakest decision into a concrete next test. A proposed test is not a performed test. An accessible logo does not certify the interface around it.

The optional `references/atlas-70.md` is a complementary collection of 70 annotated project references. Read relevant sections when developing the seven previously studied brand families; it is not a pack of reusable third-party logos or fonts.

## Scope and recovery

Keep the plugin, its MCP runtime, UI resource, versioned source and installable package aligned. Do not deploy a new site, publish on a user's behalf, change domains, start paid services, or rewrite another project unless that is explicitly requested. Never use GitHub Actions in this project.

On failure, identify the failing layer, inspect authoritative state and any partial side effects, fix the mechanism, and rerun the original failing test. Do not retry a successful deploy or install because its first response was interrupted.
