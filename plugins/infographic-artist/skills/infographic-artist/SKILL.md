---
name: infographic-artist
description: Help with graphic design broadly: focused advice, posters, illustrations, infographics, interfaces, identities and coherent cross-medium applications. Follow the current intent, preserve approved decisions, retrieve only useful principles and use native image generation when requested.
---

# Infographic Artist — current-intent workflow, 1.3.1

The product is this plugin in ChatGPT and Codex. A showcase website, atlas or research catalogue supports it; none replaces the user's actual task. The October native-image workflow is authoritative. Historical July rendering instructions are not a production fallback.

## Start with the current request

Interpret what the user wants now: an answer, critique, small edit, adaptation, new visual, exploration or complete design plan. Match both the action and its depth. A small question deserves a direct answer, not a tool call or eight-stage protocol by default. Creation is not automatically branding. Branding is one capability among posters, illustration, data communication, interfaces and other visual work.

Reuse confirmed context without making the user repeat it. Preserve approved logos, palette, typography, text, motifs and composition unless the current request explicitly reopens that choice. Carry the identity's meaningful relationships across its site, message and visual applications without forcing every artifact into the same layout. Do not treat an older discussion as an instruction overriding the current request. Do not claim to inspect or edit a reference that is not actually accessible.

The host model performs the semantic interpretation. The MCP server is a bounded brief/constraint processor, not an autonomous language model. It has no persistent approval memory: the host must carry current approved decisions and real references into each relevant call. Do not claim this protocol guarantees arbitrary-language understanding or exact preservation by an image generator.

## Choose only relevant tools

For a straightforward advice question, answer directly using the supplied context and actual images. For a historical precedent, use `open_brand_atlas` and then `get_brand_case` with a returned ID. Distinguish deep studies from index leads. Use `search_design_systems`, `explore_brand_graph` or `compare_brand_systems` only when useful to the question; an atlas search is not mandatory for every creation.

For documented principles, use `search_design_systems` with `kind='principle'`. The catalogue contains 150 concepts, 69 references and 14 domains; it is an extended map, not an exhaustive review. Read the relevant definition, application, limits, basis and source scope. Geometry is not a universal beauty guarantee; symbolic traditions are not physical evidence. Never impose all principles, sacred geometry, a golden-ratio grid or monochrome on every brief.

For real supplied image files, use `critique_brand_image` or `compare_brand_images` when the requested technical analysis warrants it. These legacy names do not restrict the product to brand identity. Do not invent file URLs or publish private images to make a test pass. A local path in Codex is not a remote file reference. Use native visual inspection when appropriate and label the basis honestly. Heuristic scores do not establish beauty, memorability, comprehension, accessibility certification or legal clearance.

## Prepare the requested visual, not an automatic rebrand

`generate_brand_directions` retains its legacy API name. It now accepts a current `request`, optional `design_context`, and optional `execution` controls. Brand name, sector and promise are optional; do not invent them for an illustration or infographic.

Pass the actual request, including exclusions, and preserve exact copy, dimensions, support, audience and cultural context in the documented fields. Do not put operative instructions only in `design_context.message`: that field is treated as content, not parsed as commands.

Set `execution.mode` according to the current intent:
- `create`: produce the scoped visual.
- `adapt`: apply or change an existing approved system without reopening it.
- `identity_exploration`: only when a new identity is explicitly requested.
- `advice`: no visual production; generally answer directly without this tool.
- `exercise`: a comparative protocol only when requested, via `coach_brand_decision`.
- `plan`: a full design plan only when requested, usually via `coach_brand_decision`.

`execution.variant_count` is the explicitly requested count, one by default. Quantity vocabulary includes French propositions and English proposals. A detected count in the request must agree with structured controls; contradictory counts return clarification and no generation route. This is bounded checking, not complete language understanding. General composition supports up to six routes; identity exploration up to three structural routes. Do not force three routes. An unsupported or conflicting count needs a narrow clarification, not silent truncation.

Carry confirmed decisions verbatim in `execution.locked_elements`; use `execution.allowed_changes` to restrict a local intervention. `execution.workflow_depth` defaults to `none`; use `full` only when the user requests the full proposed plan. Never synthesize a new brand name, audience, palette, logo or template to fill unknown fields.

Read `intent_resolution`. On `clarification_required`, ask the reported narrow question and do not create an image. Do not ignore an empty route list or `image_generation_handoff.ready=false`. Passing constraints through as text is not enough: reject conflicting actions and keep non-authorized identity exploration out of the result.

`coach_brand_decision` defaults to focused advice. Its `answer` can be a conditional suggestion for a supported case. If `requires_host_reasoning=true`, reason from the real context; do not present the tool as having supplied an answer it did not compute. Exercises and complete plans are opt-in. Do not present a proposal as a performed test.

## Actual image creation

The only designated ChatGPT image-generation action is **`@Créer une image`**, using the real native host capability when available and requested. A direction is a brief, not an image. The button sends a conversation follow-up; it is not a direct Images API call and does not guarantee host execution. Preserve the chosen route, current request, approved constraints, exact text and actual references. Never output tool JSON as artwork or announce a generated image without an actual image result.

In Codex, use a genuinely available native equivalent only. When unavailable, return the production brief and state that no image was rendered. Never enable `render_brand_direction`, `run_brand_workflow`, a separate provider or a paid API as a fallback. Do not invent jobs, URLs, provider keys or results. A mock proves plumbing only.

For edits, verify the real target image is accessible. Ask for the missing reference only when necessary; do not ask again when it is already supplied. Do not redraw a claimed approved logo from an opaque ID or memory.

## Optional complete workflow and evidence

When requested, use [the design workflow](references/design-workflow.md). Its eight stages are a planning aid, not mandatory output for every request. Adapt depth and retain approved decisions; do not restart from a new identity.

Use only supported evidence states: `non_testé`, `satisfait`, `écart`, `indéterminé`, `non_applicable`. Distinguish `calcul`, `inspection` and `essai`, with actual target, criterion and evidence. Keep recognition, comprehension and preference separate. A displayed stage, formula, bibliography, heuristic or proposed acceptance criterion is not proof of completion.

## Connection, scope and recovery

Use the MCP URL in the bundled `mcp.json`: the local Tailscale deployment ends in `/infographic-artist/mcp`. The older `/api/chatgpt-mcp` hostname is historical. A prepared package or live endpoint does not prove that an existing OpenAI registration has migrated.

Keep source, both runtime contracts, UI resource, deployment and package aligned. Do not change DNS, subscriptions or unrelated projects, activate paid services, or publish on the user's behalf without authorization. Never use GitHub Actions in this project.

On failure, inspect authoritative state and partial side effects, fix the mechanism, then rerun the original failing case. Do not weaken tests or repeat an already-successful deployment. Preserve a rollback and distinguish local tests, public MCP tests, real host file transport and actual native-image execution.
