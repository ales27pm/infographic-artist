# Deployment

The review endpoint must be stable, publicly reachable, and protected by valid TLS:

`https://<host>/mcp`

Required public routes:

- `https://<host>/`
- `https://<host>/health`
- `https://<host>/privacy`
- `https://<host>/terms`
- `https://<host>/support`
- `https://<host>/.well-known/openai-apps-challenge`

## Container

```bash
docker build -t infographic-artist-chatgpt .
docker run --rm -p 8000:8000 \
  -e APP_BASE_URL=https://brand-atlas.example.com \
  -e MCP_ALLOWED_HOSTS=brand-atlas.example.com \
  -e MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://platform.openai.com \
  -e CORS_ALLOW_ORIGINS=https://chatgpt.com,https://platform.openai.com \
  infographic-artist-chatgpt
```

`APP_BASE_URL` must be the HTTPS origin only, without `/mcp` or any other path. `MCP_ALLOWED_HOSTS` receives only the hostname.

## Domain verification

Keep `OPENAI_APPS_CHALLENGE_TOKEN` unset during normal setup. When the OpenAI portal issues a token, set it exactly and redeploy:

```text
OPENAI_APPS_CHALLENGE_TOKEN=TOKEN_EXACT_FROM_PORTAL
```

Verify that the response body is exactly the token:

```bash
curl -fsS https://<host>/.well-known/openai-apps-challenge
```

No JSON wrapper, quotes, prefix, or added newline should be returned.

## Render blueprint

`render.yaml` defines a Docker web service and `/health` probe. After creating the service, set `APP_BASE_URL` and `MCP_ALLOWED_HOSTS` to the final Render origin/host. Add the challenge token only after the submission portal generates it.

## Production constraints

- Install `requirements.txt` so `/health` reports `official-mcp-sdk`.
- Keep the MCP service stateless.
- Terminate TLS at the platform or reverse proxy.
- Do not log uploaded image bytes or complete user prompts.
- Enforce request-size and execution-time limits.
- Configure automatic restart and monitor `/health`.
- Preserve MCP POST requests and JSON/streaming responses without HTML rewrites.
- Permit only the final host and the required ChatGPT/Platform origins.
- Re-run the tool scanner whenever schemas, annotations, CSP, or the MCP origin changes.
