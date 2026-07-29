from __future__ import annotations

import os

# Production uses the official stable MCP Python SDK. The fallback keeps local
# contract tests runnable in restricted build environments where the SDK wheel
# cannot be downloaded; it implements only this app's stateless JSON-RPC surface.
try:
    import mcp  # noqa: F401
except ModuleNotFoundError:
    from fallback_server import app as app
    from fallback_server import get_resource_templates as get_resource_templates
    from fallback_server import get_resources as get_resources
    from fallback_server import get_tool_descriptors as get_tool_descriptors
else:
    from official_server import app as app
    from official_server import get_resource_templates as get_resource_templates
    from official_server import get_resources as get_resources
    from official_server import get_tool_descriptors as get_tool_descriptors


def main() -> None:
    import uvicorn

    uvicorn.run("server:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))


if __name__ == "__main__":
    main()
