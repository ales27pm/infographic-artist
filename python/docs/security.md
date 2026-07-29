# Security review

- Analysis and status tools are read-only, non-destructive, closed-world, and retry-safe.
- `render_brand_direction` and `run_brand_workflow` are non-destructive but not read-only: they may call the configured image-generation provider, create generated assets, and incur provider costs for the app operator.
- The widget CSP allows generated image assets from the configured app origin when `APP_BASE_URL` is set. It still embeds no third-party scripts, fonts, trackers, or frames.
- Image tools accept only ChatGPT file parameters with the documented file fields.
- File downloads require public credential-free HTTPS URLs.
- DNS resolution is checked against private and reserved address ranges before the request and after redirects.
- MIME type and decoded-image validity are checked.
- Downloads are capped at 12 MB and 20 seconds.
- Uploaded images are processed in memory and not persisted.
- Generated render assets are stored under opaque job IDs and are eligible for deletion after `GENERATED_ASSET_RETENTION_HOURS`, 168 hours by default.
- No API keys, passwords, authentication tokens, or precise location fields are requested.
- `OPENAI_API_KEY` is read only from the deployment environment for live image rendering and is never returned in tool output or stored in generated job metadata.
- The domain-verification secret is environment-only, rejected when it contains whitespace, hidden behind HTTP 404 while absent, and returned only from the exact well-known route when configured.
- The challenge response explicitly uses `Cache-Control: no-store`; the fallback runtime also applies defensive browser headers globally.
