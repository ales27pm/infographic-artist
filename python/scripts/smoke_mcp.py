#!/usr/bin/env python3
"""Start the app, exercise its public MCP contract, and emit a machine-readable report."""
from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from contract import TOOL_DEFINITIONS  # noqa: E402


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def rpc(client: httpx.Client, url: str, request_id: int, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        payload["params"] = params
    response = client.post(
        url,
        json=payload,
        headers={
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2025-06-18",
        },
    )
    response.raise_for_status()
    data = response.json()
    if "error" in data:
        raise RuntimeError(f"MCP {method} failed: {data['error']}")
    return data["result"]


def run(output: Path | None = None) -> dict[str, Any]:
    port = free_port()
    env = os.environ.copy()
    env.update(
        {
            "HOST": "127.0.0.1",
            "PORT": str(port),
            "OPENAI_APPS_CHALLENGE_TOKEN": "infographic-artist-smoke-token",
            "IMAGE_GENERATION_PROVIDER": "mock",
            "GENERATED_ASSET_DIR": str(ROOT / "validation" / "runtime-generated-assets"),
        }
    )
    process = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    base = f"http://127.0.0.1:{port}"
    report: dict[str, Any] = {
        "status": "failed",
        "base_url": base,
        "checks": {},
        "runtime": "unknown",
    }
    captured = ""
    try:
        with httpx.Client(timeout=15.0) as client:
            deadline = time.time() + 25
            while time.time() < deadline:
                try:
                    response = client.get(base + "/health")
                    if response.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                if process.poll() is not None:
                    raise RuntimeError("Server exited before becoming healthy")
                time.sleep(0.2)
            else:
                raise RuntimeError("Server did not become healthy")

            health = client.get(base + "/health")
            health.raise_for_status()
            health_json = health.json()
            report["runtime"] = health_json.get("transport", "unknown")
            report["checks"]["health"] = {
                "status_code": health.status_code,
                "app": health_json.get("app"),
                "version": health_json.get("version"),
                "atlas_total": health_json.get("brand_count"),
            }

            initialized = rpc(
                client,
                base + "/mcp",
                1,
                "initialize",
                {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "infographic-smoke", "version": "1.0.1"},
                },
            )
            report["checks"]["initialize"] = {
                "protocol_version": initialized.get("protocolVersion"),
                "server_name": initialized.get("serverInfo", {}).get("name"),
            }

            tools = rpc(client, base + "/mcp", 2, "tools/list")
            tool_names = [item["name"] for item in tools.get("tools", [])]
            report["checks"]["tools_list"] = {
                "count": len(tool_names),
                "names": tool_names,
                "all_have_output_schema": all(bool(item.get("outputSchema")) for item in tools.get("tools", [])),
                "mutable_tools": [item["name"] for item in tools.get("tools", []) if item.get("annotations", {}).get("readOnlyHint") is False],
                "render_tools_present": {"render_brand_direction", "run_brand_workflow", "get_render_job"}.issubset(set(tool_names)),
            }

            called = rpc(
                client,
                base + "/mcp",
                3,
                "tools/call",
                {"name": "open_brand_atlas", "arguments": {"query": "FedEx", "limit": 1}},
            )
            structured = called.get("structuredContent", {})
            results = structured.get("data", {}).get("items", [])
            report["checks"]["tool_call"] = {
                "view": structured.get("view"),
                "result_count": len(results),
                "first_result": results[0].get("name") if results else None,
                "is_error": called.get("isError", False),
            }

            render_started = rpc(
                client,
                base + "/mcp",
                30,
                "tools/call",
                {
                    "name": "render_brand_direction",
                    "arguments": {
                        "route_id": "symbol",
                        "route_name": "Smoke concept board",
                        "concept_board_prompt": "Create one square concept board for an original brand identity symbol direction with reduction tests, placeholder text, and no existing logos.",
                        "quality": "low",
                    },
                },
            )
            render_data = render_started.get("structuredContent", {}).get("data", {})
            job_id = render_data.get("job_id", "")
            deadline = time.time() + 12
            while time.time() < deadline:
                checked = rpc(client, base + "/mcp", 31, "tools/call", {"name": "get_render_job", "arguments": {"job_id": job_id}})
                render_data = checked.get("structuredContent", {}).get("data", {})
                if render_data.get("status") in {"succeeded", "failed"}:
                    break
                time.sleep(0.2)
            assets = render_data.get("assets", [])
            asset_status = None
            asset_type = None
            if assets:
                asset_url = assets[0].get("asset_url", "")
                response = client.get(asset_url if asset_url.startswith("http") else base + asset_url)
                asset_status = response.status_code
                asset_type = response.headers.get("content-type")
            report["checks"]["render_job"] = {
                "job_id": job_id,
                "status": render_data.get("status"),
                "asset_count": len(assets),
                "asset_status_code": asset_status,
                "asset_content_type": asset_type,
                "evaluation_count": len(render_data.get("evaluations", [])),
            }

            resources = rpc(client, base + "/mcp", 4, "resources/list")
            resource_items = resources.get("resources", [])
            uri = resource_items[0]["uri"]
            read = rpc(client, base + "/mcp", 5, "resources/read", {"uri": uri})
            contents = read.get("contents", [])
            html = contents[0].get("text", "") if contents else ""
            report["checks"]["widget_resource"] = {
                "uri": uri,
                "mime_type": contents[0].get("mimeType") if contents else None,
                "bytes": len(html.encode("utf-8")),
                "has_mcp_bridge": "tools/call" in html and "ui/notifications/tool-result" in html,
            }

            website = client.get(base + "/")
            report["checks"]["website"] = {
                "status_code": website.status_code,
                "content_type": website.headers.get("content-type"),
                "has_product_name": "Infographic Artist" in website.text,
            }

            challenge = client.get(base + "/.well-known/openai-apps-challenge")
            report["checks"]["domain_challenge"] = {
                "status_code": challenge.status_code,
                "content_type": challenge.headers.get("content-type"),
                "exact_token_only": challenge.content == b"infographic-artist-smoke-token",
            }

            policy_statuses = {}
            for route in ("/privacy", "/terms", "/support"):
                response = client.get(base + route)
                policy_statuses[route] = response.status_code
            report["checks"]["public_pages"] = policy_statuses

            failures = []
            if report["checks"]["health"]["status_code"] != 200:
                failures.append("health")
            if report["checks"]["tools_list"]["count"] != len(TOOL_DEFINITIONS):
                failures.append("tools_list")
            if not report["checks"]["tools_list"]["all_have_output_schema"]:
                failures.append("output_schema")
            if report["checks"]["tools_list"]["mutable_tools"] != ["render_brand_direction", "run_brand_workflow"]:
                failures.append("tool_annotations")
            if not report["checks"]["tools_list"]["render_tools_present"]:
                failures.append("render_tools")
            if report["checks"]["tool_call"]["view"] != "atlas" or report["checks"]["tool_call"]["result_count"] < 1:
                failures.append("tool_call")
            if (
                report["checks"]["render_job"]["status"] != "succeeded"
                or report["checks"]["render_job"]["asset_count"] < 1
                or report["checks"]["render_job"]["asset_status_code"] != 200
            ):
                failures.append("render_job")
            if report["checks"]["widget_resource"]["mime_type"] != "text/html;profile=mcp-app":
                failures.append("widget_mime")
            if not report["checks"]["widget_resource"]["has_mcp_bridge"]:
                failures.append("widget_bridge")
            if report["checks"]["website"]["status_code"] != 200 or not report["checks"]["website"]["has_product_name"]:
                failures.append("website")
            if report["checks"]["domain_challenge"]["status_code"] != 200 or not report["checks"]["domain_challenge"]["exact_token_only"]:
                failures.append("domain_challenge")
            if any(value != 200 for value in policy_statuses.values()):
                failures.append("public_pages")

            report["status"] = "passed" if not failures else "failed"
            report["failures"] = failures
    except Exception as exc:
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        process.terminate()
        try:
            captured, _ = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            captured, _ = process.communicate(timeout=5)
        report["server_log_tail"] = "\n".join(captured.splitlines()[-12:])
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = run(args.output)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["status"] == "passed" else 1)


if __name__ == "__main__":
    main()
