from __future__ import annotations

import contextlib
import os
from typing import Any
from urllib.parse import urlparse

import mcp.types as types
from mcp.server.lowlevel import Server
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import HTMLResponse, JSONResponse, Response
from starlette.routing import Route
from starlette.types import Receive, Scope, Send

import core
from contract import MIME_TYPE, SERVER_INSTRUCTIONS, TEMPLATE_URI, TOOL_DEFINITIONS
from fallback_server import (
    APP_NAME,
    APP_VERSION,
    DOCS_DIR,
    _app_base_url,
    _execute_tool,
    _openai_apps_challenge_token,
    _resource_meta,
    _simple_doc,
    _split_env_list,
    _tool_meta,
    _widget_html,
    get_resource_templates,
    get_resources,
    get_tool_descriptors,
)


def _transport_security_settings() -> TransportSecuritySettings:
    hosts = _split_env_list(os.getenv("MCP_ALLOWED_HOSTS"))
    origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
    base_url = _app_base_url()
    if not hosts:
        hosts = ["localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"]
        if base_url:
            hosts.append(urlparse(base_url).netloc)
    if not origins:
        origins = ["https://chatgpt.com", "https://chat.openai.com", "https://platform.openai.com"]
        if base_url:
            origins.append(base_url)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=hosts,
        allowed_origins=origins,
    )


mcp_server: Server[Any, Any] = Server(
    name="infographic-artist",
    version=APP_VERSION,
    instructions=SERVER_INSTRUCTIONS,
    website_url=_app_base_url() or None,
)


@mcp_server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [types.Tool(**descriptor) for descriptor in get_tool_descriptors()]


@mcp_server.list_resources()
async def list_resources() -> list[types.Resource]:
    return [types.Resource(**resource) for resource in get_resources()]


@mcp_server.list_resource_templates()
async def list_resource_templates() -> list[types.ResourceTemplate]:
    return [types.ResourceTemplate(**resource) for resource in get_resource_templates()]


@mcp_server.read_resource()
async def read_resource(uri) -> list[ReadResourceContents]:
    if str(uri) != TEMPLATE_URI:
        raise ValueError("Unknown resource")
    return [
        ReadResourceContents(
            content=_widget_html(),
            mime_type=MIME_TYPE,
            meta=_resource_meta(),
        )
    ]


@mcp_server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> types.CallToolResult:
    if name not in TOOL_DEFINITIONS:
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=f"Unknown tool: {name}")],
            isError=True,
        )
    try:
        structured = await _execute_tool(name, dict(arguments or {}))
    except Exception as exc:
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=f"Infographic Artist error: {exc}")],
            isError=True,
            _meta={"openai/toolInvocation/invoked": "The analysis could not be completed"},
        )

    spec = TOOL_DEFINITIONS[name]
    summaries = {
        "atlas": "Opened the brand atlas.",
        "case": "Opened the requested brand case.",
        "comparison": "Compared the requested brand systems.",
        "graph": "Built the requested brand knowledge graph.",
        "library": "Searched the graphic-systems library.",
        "directions": "Generated three original creative directions.",
        "critique": "Scored the visual proposal on five design axes.",
        "similarity": "Completed perceptual similarity triage.",
        "coach": "Converted the design question into a measurable coaching exercise.",
    }
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=summaries[spec["view"]])],
        structuredContent=structured,
        _meta={"openai/toolInvocation/invoked": spec["invoked"]},
        isError=False,
    )


session_manager = StreamableHTTPSessionManager(
    app=mcp_server,
    json_response=True,
    stateless=True,
    security_settings=_transport_security_settings(),
)


async def root(_request) -> HTMLResponse:
    return HTMLResponse(_simple_doc(APP_NAME, (DOCS_DIR / "website.md").read_text(encoding="utf-8")))


async def openai_apps_challenge(_request) -> Response:
    token = _openai_apps_challenge_token()
    if not token:
        return Response(status_code=404, headers={"Cache-Control": "no-store"})
    return Response(content=token.encode("utf-8"), media_type="text/plain", headers={"Cache-Control": "no-store"})


async def health(_request) -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "app": APP_NAME,
            "version": APP_VERSION,
            "transport": "official-mcp-sdk",
            **core.atlas_summary(),
        }
    )


async def privacy(_request) -> HTMLResponse:
    return HTMLResponse(_simple_doc("Privacy Policy", (DOCS_DIR / "privacy-policy.md").read_text(encoding="utf-8")))


async def terms(_request) -> HTMLResponse:
    return HTMLResponse(_simple_doc("Terms of Use", (DOCS_DIR / "terms.md").read_text(encoding="utf-8")))


async def support(_request) -> HTMLResponse:
    return HTMLResponse(_simple_doc("Support", (DOCS_DIR / "support.md").read_text(encoding="utf-8")))


@contextlib.asynccontextmanager
async def lifespan(_app: Starlette):
    async with session_manager.run():
        yield


site = Starlette(
    routes=[
        Route("/", root, methods=["GET"]),
        Route("/.well-known/openai-apps-challenge", openai_apps_challenge, methods=["GET"]),
        Route("/health", health, methods=["GET"]),
        Route("/privacy", privacy, methods=["GET"]),
        Route("/terms", terms, methods=["GET"]),
        Route("/support", support, methods=["GET"]),
    ],
    lifespan=lifespan,
)


class ExactMCPDispatch:
    """Dispatch the exact /mcp path to the official session manager."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("path") == "/mcp":
            if scope.get("method") != "POST":
                response = Response(status_code=405, headers={"Allow": "POST"})
                await response(scope, receive, send)
                return
            await session_manager.handle_request(scope, receive, send)
            return
        await site(scope, receive, send)


app = CORSMiddleware(
    ExactMCPDispatch(),
    allow_origins=_split_env_list(os.getenv("CORS_ALLOW_ORIGINS"))
    or ["https://chatgpt.com", "https://chat.openai.com", "https://platform.openai.com"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id"],
    allow_credentials=False,
)
