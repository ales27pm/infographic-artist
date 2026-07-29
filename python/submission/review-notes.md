# Review notes

- Product name: **Infographic Artist**.
- Plugin type: **With MCP**.
- Category: **DESIGN**.
- Subtitle: **Brand research & critique**.
- Authentication: none.
- Commerce: none.
- External writes: rendering tools may call the configured image-generation provider; no public publishing or third-party user-account mutation.
- User data persisted: none.
- Image-generation API calls by this app: `render_brand_direction` and `run_brand_workflow` may call OpenAI Images when configured.
- Generated-asset storage by this app: render jobs and generated concept-board images are retained under `GENERATED_ASSET_RETENTION_HOURS`, 168 hours by default.
- Third-party artwork bundled: none.
- The atlas contains names, metadata, principles, and public-source links only.
- `generate_brand_directions` returns three original routes plus plugin-ready concept-board prompts; rendering tools can create and evaluate boards inside the app.
- The image tools process user-selected ChatGPT files in memory.
- The app explicitly warns that perceptual similarity is not legal clearance.
- The website and policies are served from the same production origin as MCP.
- The well-known domain challenge returns only the portal-issued token when configured.
