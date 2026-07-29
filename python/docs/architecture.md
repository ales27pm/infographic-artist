# Architecture

## Production server

`official_server.py` exposes a stateless Streamable HTTP MCP server at `/mcp` through the stable official MCP Python SDK (`mcp>=1.28.1,<2`). It advertises concise server instructions, nine explicit tools, one versioned UI resource, output schemas, ChatGPT file-parameter metadata, and read-only safety annotations.

`server.py` selects the official SDK implementation whenever the `mcp` package is installed, which is the production and Docker path.

## Restricted-build fallback

`fallback_server.py` implements the same bounded JSON-RPC tool and resource surface with FastAPI. It exists so the package can be contract-tested in restricted build environments that cannot download the official SDK wheel. It is not the preferred production transport. The fallback supports initialize, ping, tool/resource listing, resource reads, tool calls, and notifications without user state.

## Shared contract

`contract.py` is the single source of truth for tool names, input schemas, file schemas, widget metadata, output view discriminators, invocation labels, and server instructions. Both transports use the same contract.

## Domain logic

`core.py` contains deterministic atlas search, graph extraction, direction generation, image measurement, perceptual comparison, critique scoring, and coaching logic. It never calls an external AI model.

## Widget

`assets/app-v1.html` is a self-contained vanilla HTML/CSS/JavaScript component served as `text/html;profile=mcp-app`. It listens for MCP Apps `ui/notifications/tool-result`, renders `structuredContent`, calls tools through `window.openai.callTool` when available, and uses ChatGPT-specific display-mode APIs only as optional enhancements.

## Data boundary

`structuredContent` contains only information the model may read. Uploaded files are downloaded into memory for the duration of one call and are not intentionally persisted. The current app does not need large widget-only hidden payloads, so result `_meta` is limited to invocation metadata.
