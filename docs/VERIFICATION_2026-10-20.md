# Infographic Artist 1.2.0 — verification before deployment

## Scope

The release adds a documented catalogue of 150 design principles across 14 domains, backed by 69 references, and an eight-stage design plan. It extends the existing nine public MCP tools. The public image-generation handoff continues to designate `@Créer une image`.

The catalogue distinguishes mathematical properties, empirical findings, proposed applications and historical or symbolic references. Source records retain their stated scope; an absent reading scope is reported as unrecorded. Catalogue relevance is not a measure of scientific strength.

## Source and reproducibility

- Base commit: `0b8c54e3aebe1a1f8c9b2a1c8b0524ebc3b8cee8`.
- Package version: `1.2.0`; hosted runtime version: `1.2.0-hatchable.1`.
- Canonical resource: `ui://infographic-artist/app-v1.2.0.html`.
- Compatibility resource paths: `app-v1.html`, `app-v1.1.1.html`, `app-v1.1.2.html`.
- The source was recovered from the exact base commit after the remote device stopped responding. Downloaded snapshots were checked against their Git or SHA-256 hashes before integration.
- Build compiler: esbuild `0.27.3`, as pinned by the project.
- A second build with `--check` passed. Independently emitted ZIP files were byte-identical.

| Artifact | SHA-256 |
|---|---|
| Source manifest | `3d673487670181af8e8ff3af79c2e298b592e2fe64f67f3ab46eb86df2e1083e` |
| Widget HTML | `cac97680972f10d35e5722980ee604b61e8030e308168b1ec7cd73d9fe395415` |
| Public MCP bundle | `a34612688ac18371921c6f51b230cf993ed17de152d84bc8117b46d75c6b2731` |
| Public health handler | `b9b051371bf56fe20d21e53d9825f81273a209c69e3f89903fd8e558fa88d923` |
| Portable ZIP | `0bb9fc7abd21e120704f49f969726f16aee47b4f457aef628070b96e93dc4d02` |

The ZIP is 82,950 bytes. The Python wheel was also built and inspected: `design_workflow.py`, both catalogue/workflow JSON files and the widget are included.

## Automated verification

| Check | Result |
|---|---|
| Python suite | 55 collected tests, all passed |
| JavaScript catalogue, workflow and public contracts | 26 tests, all passed |
| Browser interface tests | 11 tests, all passed |
| Submission validator | Passed, no errors |
| Official skill validator | Passed |
| Widget JavaScript syntax | Passed |
| Generated-artifact freshness and ZIP reproducibility | Passed |
| Git whitespace check | Passed |

Python tests used Python 3.12, pytest 8.4.2, MCP 1.30.0, FastAPI 0.150.0 and Starlette 0.52.1, within the declared dependency ranges. A confined test run stalled during asynchronous cleanup and was interrupted; the complete run in the approved execution context passed. One upstream Starlette deprecation warning remained.

Browser tests used Playwright 1.62.1 and its exact Chrome for Testing 151.0.7922.34 / revision 1234. The unavailable Playwright CDN returned an HTML error page; matching Chrome and Headless Shell archives were obtained from Google's official distribution, their sizes and checksums verified, and launch tested. No project dependency or browser launch option was changed.

Covered behavior includes all 150 principle IDs, source preservation and limits, accents and aliases (including Fibonacci and phi), empty versus unmatched searches, declared context bounds, missing facts, exact stage order, independent results, heuristic critique labels, nine-tool compatibility and all four resource URIs. Browser coverage includes the real local MCP handler, keyboard expansion, mobile width, inert markup-like searches, double clicks, explicit refusal, rejected promises, missing host capabilities and uncertain transmissions without silent retries.

## Visual and skill checks

Desktop (1,440 px) and mobile (390 px) captures were inspected. They show the declared brief, eight stages, separate recognition/comprehension/preference cards, accessible search controls and expandable principle references, without horizontal overflow in the tested viewports.

A fresh skill application was checked using a supplied museum-affiche scenario. It corrected area-encoded radii from 10/40/90 to 10/20/30 for values 1/4/9, distinguished preference from comprehension in the supplied sample notes, left recognition unmeasured, and treated sacred geometry as a symbolic reference without inferring physical energy. This was a reasoning check against supplied scenario data, not a participant study.

## Boundaries of these results

All workflow and human-evaluation statuses returned by the tools remain `non_testé`; the software prepares checks and does not record or certify their completion. Automated software tests do not establish beauty, comprehension, memorization, accessibility conformance or audience preference.

The browser handoff tests use host stubs and verify message transmission behavior. They do not prove that ChatGPT invoked an image-generation tool or generated an image. Native image invocation must be assessed in the actual host conversation.

This report records validation before external deployment. It does not assert a live deployment, app-directory approval, or installation on the user's computer. At this checkpoint the last verified installed Codex package was 1.1.2, pinned to the base commit, and Remote Desktop Commander reported that the device did not respond. Live deployment and installed-state checks must be recorded separately after their respective actions.
