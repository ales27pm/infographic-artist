from __future__ import annotations

import contextlib
import os
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import jsonschema
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

import core
from contract import MIME_TYPE, SERVER_INSTRUCTIONS, TEMPLATE_URI, TOOL_DEFINITIONS

ROOT = Path(__file__).resolve().parent
ASSETS_DIR = ROOT / "assets"
DOCS_DIR = ROOT / "docs"
APP_NAME = "Infographic Artist"
APP_VERSION = "1.0.1"
SUPPORTED_PROTOCOL_VERSIONS = ("2025-11-25", "2025-06-18", "2025-03-26")
MAX_RPC_BYTES = 1_000_000


def _split_env_list(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def _app_base_url() -> str:
    value = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise RuntimeError("APP_BASE_URL must be an HTTPS origin without a path, query, or fragment.")
    return f"{parsed.scheme}://{parsed.netloc}"


def _openai_apps_challenge_token() -> str:
    value = os.getenv("OPENAI_APPS_CHALLENGE_TOKEN", "")
    if not value:
        return ""
    if value != value.strip() or any(character.isspace() for character in value):
        raise RuntimeError("OPENAI_APPS_CHALLENGE_TOKEN must not contain whitespace.")
    return value


@lru_cache(maxsize=1)
def _widget_html() -> str:
    return (ASSETS_DIR / "app-v1.html").read_text(encoding="utf-8")


def _resource_meta() -> dict[str, Any]:
    resource_domains = [_app_base_url()] if _app_base_url() else []
    csp = {"connectDomains": [], "resourceDomains": resource_domains, "frameDomains": []}
    ui: dict[str, Any] = {
        "prefersBorder": True,
        "csp": csp,
    }
    if _app_base_url():
        ui["domain"] = _app_base_url()
    return {
        "ui": ui,
        "openai/widgetDescription": (
            "Interactive brand-system atlas, knowledge graph, creative-direction, critique, similarity, and coaching workspace."
        ),
        "openai/widgetPrefersBorder": True,
        "openai/widgetCSP": {
            "connect_domains": [],
            "resource_domains": resource_domains,
            "frame_domains": [],
        },
        **({"openai/widgetDomain": _app_base_url()} if _app_base_url() else {}),
    }


def _tool_meta(name: str) -> dict[str, Any]:
    spec = TOOL_DEFINITIONS[name]
    meta: dict[str, Any] = {
        "ui": {"resourceUri": TEMPLATE_URI, "visibility": ["model", "app"]},
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": spec["invoking"],
        "openai/toolInvocation/invoked": spec["invoked"],
        "openai/widgetAccessible": True,
        "securitySchemes": [{"type": "noauth"}],
    }
    if spec.get("files"):
        meta["openai/fileParams"] = spec["files"]
    return meta


def _annotations(name: str) -> dict[str, bool]:
    return dict(TOOL_DEFINITIONS[name].get(
        "annotations",
        {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    ))


def _allowed_origins() -> set[str]:
    values = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS") or os.getenv("CORS_ALLOW_ORIGINS"))
    if not values:
        values = ["https://chatgpt.com", "https://chat.openai.com", "https://platform.openai.com"]
    if _app_base_url():
        values.append(_app_base_url())
    return {value.rstrip("/") for value in values}


def get_tool_descriptors() -> list[dict[str, Any]]:
    descriptors: list[dict[str, Any]] = []
    for name, spec in TOOL_DEFINITIONS.items():
        descriptors.append(
            {
                "name": name,
                "title": spec["title"],
                "description": spec["description"],
                "inputSchema": spec["input"],
                "outputSchema": {
                    "type": "object",
                    "properties": {
                        "view": {"type": "string", "const": spec["view"]},
                        "data": {"type": "object"},
                    },
                    "required": ["view", "data"],
                    "additionalProperties": False,
                },
                "annotations": _annotations(name),
                "_meta": _tool_meta(name),
            }
        )
    return descriptors


def get_resources() -> list[dict[str, Any]]:
    return [
        {
            "name": APP_NAME,
            "title": "Infographic Artist workspace",
            "uri": TEMPLATE_URI,
            "description": "Interactive atlas, knowledge graph, creative-direction, critique, similarity, and coaching workspace.",
            "mimeType": MIME_TYPE,
            "_meta": _resource_meta(),
        }
    ]


def get_resource_templates() -> list[dict[str, Any]]:
    return [
        {
            "name": APP_NAME,
            "title": "Infographic Artist workspace",
            "uriTemplate": TEMPLATE_URI,
            "description": "Interactive brand-analysis workspace.",
            "mimeType": MIME_TYPE,
            "_meta": _resource_meta(),
        }
    ]


def _payload(view: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"view": view, "data": data}


async def _execute_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "open_brand_atlas":
        results = core.search_atlas(
            args.get("query", ""),
            region=args.get("region", ""),
            pattern=args.get("pattern", ""),
            category=args.get("category", ""),
            era=args.get("era", ""),
            limit=args.get("limit", 12),
        )
        return _payload("atlas", {"summary": core.atlas_summary(), **results})
    if name == "get_brand_case":
        case = core.get_brand_case(str(args.get("item_id", "")))
        if not case:
            raise ValueError("Unknown atlas identity. Search the atlas first and use a returned ID.")
        return _payload("case", case)
    if name == "compare_brand_systems":
        return _payload("comparison", core.compare_brand_systems(args.get("item_ids", [])))
    if name == "explore_brand_graph":
        return _payload("graph", core.explore_graph(args.get("query", ""), args.get("limit", 80)))
    if name == "search_design_systems":
        return _payload(
            "library",
            core.search_design_systems(args.get("query", ""), args.get("kind", ""), args.get("limit", 12)),
        )
    if name == "generate_brand_directions":
        return _payload("directions", core.generate_directions(args))
    if name == "render_brand_direction":
        return _payload("render_job", await core.render_brand_direction(args))
    if name == "run_brand_workflow":
        return _payload("render_workflow", await core.run_brand_workflow(args))
    if name == "get_render_job":
        return _payload("render_job", core.get_render_job(str(args.get("job_id", ""))))
    if name == "critique_brand_image":
        image = await core.download_image(args["image"])
        reference = await core.download_image(args["reference"]) if args.get("reference") else None
        return _payload("critique", core.critique_image(image, reference=reference, context=args.get("context", "")))
    if name == "compare_brand_images":
        left = await core.download_image(args["left"])
        right = await core.download_image(args["right"])
        return _payload("similarity", core.compare_images(left, right))
    if name == "coach_brand_decision":
        return _payload(
            "coach",
            core.coach_decision(
                args.get("question", ""),
                args.get("critique"),
                args.get("goal", "improve the next iteration"),
            ),
        )
    raise ValueError(f"Unknown tool: {name}")


def _jsonrpc_result(request_id: Any, result: dict[str, Any]) -> JSONResponse:
    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "result": result})


def _jsonrpc_error(request_id: Any, code: int, message: str, data: Any | None = None, *, status: int = 200) -> JSONResponse:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return JSONResponse({"jsonrpc": "2.0", "id": request_id, "error": error}, status_code=status)


def _simple_doc(title: str, markdown: str) -> str:
    import html

    blocks = []
    in_list = False
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            if in_list:
                blocks.append("</ul>")
                in_list = False
            continue
        if line.startswith("- "):
            if not in_list:
                blocks.append("<ul>")
                in_list = True
            blocks.append(f"<li>{html.escape(line[2:])}</li>")
            continue
        if in_list:
            blocks.append("</ul>")
            in_list = False
        if line.startswith("### "):
            blocks.append(f"<h3>{html.escape(line[4:])}</h3>")
        elif line.startswith("## "):
            blocks.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("# "):
            blocks.append(f"<h1>{html.escape(line[2:])}</h1>")
        else:
            blocks.append(f"<p>{html.escape(line)}</p>")
    if in_list:
        blocks.append("</ul>")
    return (
        "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>{html.escape(title)} · Infographic Artist</title><style>body{{max-width:780px;margin:60px auto;padding:0 24px;"
        "font:16px/1.65 system-ui;background:#f4f1e8;color:#131511}h1,h2,h3{font-family:Georgia,serif}li{margin:.4em 0}"
        "a{color:#4b5bdc}</style></head><body>" + "".join(blocks) + "</body></html>"
    )


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    core.recover_interrupted_render_jobs()
    yield


app = FastAPI(title=APP_NAME, version=APP_VERSION, docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(_allowed_origins()),
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id"],
    allow_credentials=False,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.url.path == "/mcp":
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in _allowed_origins():
            return _jsonrpc_error(None, -32000, "Origin not allowed", status=403)
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > MAX_RPC_BYTES:
            return _jsonrpc_error(None, -32000, "Request too large", status=413)
        protocol_header = request.headers.get("mcp-protocol-version")
        if protocol_header and protocol_header not in SUPPORTED_PROTOCOL_VERSIONS:
            return _jsonrpc_error(None, -32600, "Unsupported MCP-Protocol-Version", status=400)
        if request.method == "POST":
            accept = request.headers.get("accept", "")
            if accept and "*/*" not in accept and "application/json" not in accept and "text/event-stream" not in accept:
                return _jsonrpc_error(None, -32600, "Client must accept application/json or text/event-stream", status=406)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/")
async def root() -> HTMLResponse:
    return HTMLResponse(_simple_doc(APP_NAME, (DOCS_DIR / "website.md").read_text(encoding="utf-8")))


@app.get("/.well-known/openai-apps-challenge")
async def openai_apps_challenge() -> Response:
    token = _openai_apps_challenge_token()
    if not token:
        return Response(status_code=404, headers={"Cache-Control": "no-store"})
    return Response(content=token.encode("utf-8"), media_type="text/plain", headers={"Cache-Control": "no-store"})


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "app": APP_NAME,
            "version": APP_VERSION,
            "transport": "restricted-build-fallback",
            "mcp_path": "/mcp",
            "image_generation": core.generation_runtime_summary(),
            **core.atlas_summary(),
        }
    )


@app.get("/generated-assets/{job_id}/{filename}")
async def generated_asset(job_id: str, filename: str) -> FileResponse:
    try:
        core.cleanup_expired_render_assets()
        path, media_type = core.resolve_generated_asset_path(job_id, filename)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "private, max-age=300"})


@app.get("/privacy")
async def privacy() -> HTMLResponse:
    return HTMLResponse(_simple_doc("Privacy Policy", (DOCS_DIR / "privacy-policy.md").read_text(encoding="utf-8")))


@app.get("/terms")
async def terms() -> HTMLResponse:
    return HTMLResponse(_simple_doc("Terms of Use", (DOCS_DIR / "terms.md").read_text(encoding="utf-8")))


@app.get("/support")
async def support() -> HTMLResponse:
    return HTMLResponse(_simple_doc("Support", (DOCS_DIR / "support.md").read_text(encoding="utf-8")))


@app.get("/mcp")
async def mcp_get() -> Response:
    return Response(status_code=405, headers={"Allow": "POST"})


@app.delete("/mcp")
async def mcp_delete() -> Response:
    return Response(status_code=405, headers={"Allow": "GET, POST"})


@app.post("/mcp")
async def mcp_post(request: Request) -> Response:
    try:
        message = await request.json()
    except Exception:
        return _jsonrpc_error(None, -32700, "Parse error", status=400)
    if not isinstance(message, dict):
        return _jsonrpc_error(None, -32600, "Invalid Request", status=400)

    request_id = message.get("id")
    method = message.get("method")
    params = message.get("params") or {}

    # Client responses and notifications do not receive JSON-RPC bodies.
    if not method and ("result" in message or "error" in message):
        return Response(status_code=202)
    if not isinstance(method, str):
        return _jsonrpc_error(request_id, -32600, "Invalid Request")
    if request_id is None:
        return Response(status_code=202)

    if method == "initialize":
        requested = str(params.get("protocolVersion") or "")
        protocol = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else SUPPORTED_PROTOCOL_VERSIONS[0]
        return _jsonrpc_result(
            request_id,
            {
                "protocolVersion": protocol,
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"subscribe": False, "listChanged": False},
                },
                "serverInfo": {"name": "infographic-artist", "title": APP_NAME, "version": APP_VERSION},
                "instructions": SERVER_INSTRUCTIONS,
            },
        )
    if method == "ping":
        return _jsonrpc_result(request_id, {})
    if method == "tools/list":
        return _jsonrpc_result(request_id, {"tools": get_tool_descriptors()})
    if method == "resources/list":
        return _jsonrpc_result(request_id, {"resources": get_resources()})
    if method == "resources/templates/list":
        return _jsonrpc_result(request_id, {"resourceTemplates": get_resource_templates()})
    if method == "resources/read":
        if str(params.get("uri") or "") != TEMPLATE_URI:
            return _jsonrpc_error(request_id, -32002, "Resource not found")
        return _jsonrpc_result(
            request_id,
            {
                "contents": [
                    {
                        "uri": TEMPLATE_URI,
                        "mimeType": MIME_TYPE,
                        "text": _widget_html(),
                        "_meta": _resource_meta(),
                    }
                ]
            },
        )
    if method == "tools/call":
        name = str(params.get("name") or "")
        arguments = params.get("arguments") or {}
        if name not in TOOL_DEFINITIONS:
            return _jsonrpc_error(request_id, -32602, f"Unknown tool: {name}")
        if not isinstance(arguments, dict):
            return _jsonrpc_error(request_id, -32602, "Tool arguments must be an object")
        try:
            jsonschema.validate(instance=arguments, schema=TOOL_DEFINITIONS[name]["input"])
        except jsonschema.ValidationError as exc:
            return _jsonrpc_result(
                request_id,
                {
                    "content": [{"type": "text", "text": f"Input validation error: {exc.message}"}],
                    "isError": True,
                },
            )
        try:
            structured = await _execute_tool(name, arguments)
            jsonschema.validate(
                instance=structured,
                schema=next(tool["outputSchema"] for tool in get_tool_descriptors() if tool["name"] == name),
            )
        except Exception as exc:
            return _jsonrpc_result(
                request_id,
                {
                    "content": [{"type": "text", "text": f"Infographic Artist error: {exc}"}],
                    "isError": True,
                    "_meta": {"openai/toolInvocation/invoked": "The analysis could not be completed"},
                },
            )
        spec = TOOL_DEFINITIONS[name]
        summaries = {
            "atlas": "Opened the brand atlas.",
            "case": "Opened the requested brand case.",
            "comparison": "Compared the requested brand systems.",
            "graph": "Built the requested brand knowledge graph.",
            "library": "Searched the graphic-systems library.",
            "directions": "Generated three original creative directions.",
            "render_job": "Started or checked a plugin-side image render job.",
            "render_workflow": "Started the full plugin-side brand workflow.",
            "critique": "Scored the visual proposal on five design axes.",
            "similarity": "Completed perceptual similarity triage.",
            "coach": "Converted the design question into a measurable coaching exercise.",
        }
        return _jsonrpc_result(
            request_id,
            {
                "content": [{"type": "text", "text": summaries[spec["view"]]}],
                "structuredContent": structured,
                "_meta": {"openai/toolInvocation/invoked": spec["invoked"]},
                "isError": False,
            },
        )
    return _jsonrpc_error(request_id, -32601, "Method not found")


def main() -> None:
    import uvicorn

    uvicorn.run("server:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))


if __name__ == "__main__":
    main()
