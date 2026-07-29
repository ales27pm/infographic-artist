# Security review

- All tools are read-only, non-destructive, closed-world, and retry-safe.
- The widget has an empty CSP allowlist because it embeds no external resources and performs no direct network fetches.
- Image tools accept only ChatGPT file parameters with the documented file fields.
- File downloads require public credential-free HTTPS URLs.
- DNS resolution is checked against private and reserved address ranges before the request and after redirects.
- MIME type and decoded-image validity are checked.
- Downloads are capped at 12 MB and 20 seconds.
- Uploaded images are processed in memory and not persisted.
- No API keys, passwords, authentication tokens, or precise location fields are requested.
- The domain-verification secret is environment-only, rejected when it contains whitespace, hidden behind HTTP 404 while absent, and returned only from the exact well-known route when configured.
- The challenge response explicitly uses `Cache-Control: no-store`; the fallback runtime also applies defensive browser headers globally.
