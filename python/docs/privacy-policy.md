# Privacy Policy

Effective date: July 29, 2026

Infographic Artist helps people research brand systems and evaluate user-supplied visual proposals inside ChatGPT.

## Data processed

The app receives only the parameters needed for the tool the user asks ChatGPT to run. For image critique or comparison, ChatGPT supplies a short-lived file download URL and file identifier. The server downloads the image only to perform the requested analysis.

Creative-direction results include concept-board prompts. When `render_brand_direction` or `run_brand_workflow` is used, Infographic Artist sends the selected prompt and rendering options to the configured image-generation provider, OpenAI Images by default, then stores the generated image asset and render-job metadata so ChatGPT and the widget can retrieve the result.

## Storage and retention

This version does not create user accounts, maintain user profiles, persist uploaded images, or store raw conversation history. Uploaded-image bytes are processed in memory and discarded when the critique or comparison request finishes.

Plugin-rendered concept boards are generated assets. They are stored under `GENERATED_ASSET_DIR` with bounded job metadata and are eligible for deletion after `GENERATED_ASSET_RETENTION_HOURS`, 168 hours by default. Generated asset URLs contain opaque job IDs and hash-only filenames; route names and client identifiers are not embedded in filenames. Users should not include secrets or confidential client material in render prompts.

## Third parties

The application does not send user prompts or images to advertising networks or data brokers. Rendering tools may send prompts and rendering options to the configured image-generation provider and may incur provider costs for the app operator. Source links shown in historical brand cases are public references; they are opened only when the user chooses them.

## Security

File downloads are limited to supported image types, 12 MB, and public HTTPS addresses. Private, local, reserved, and credential-bearing URLs are rejected.

## Legal limits

Similarity and critique results are perceptual design analysis, not legal advice or trademark clearance. Users should obtain professional review before commercial launch.

## Contact

Support and privacy contact: https://github.com/ales27pm
