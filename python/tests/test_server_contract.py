import asyncio
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from contract import MIME_TYPE, READ_ONLY_ANNOTATIONS, TEMPLATE_URI, TOOL_DEFINITIONS  # noqa: E402


@pytest.fixture(scope="module")
def mcp_client():
    with TestClient(server.app, base_url="http://127.0.0.1") as client:
        yield client


def test_all_tools_have_required_annotations_and_output_schema():
    tools = server.get_tool_descriptors()
    for tool in tools:
        assert tool["outputSchema"]
        expected = TOOL_DEFINITIONS[tool["name"]].get("annotations", READ_ONLY_ANNOTATIONS)
        assert tool["annotations"] == expected
        assert tool["_meta"]["ui"]["resourceUri"] == TEMPLATE_URI
    mutable = {tool["name"] for tool in tools if tool["annotations"]["readOnlyHint"] is False}
    assert mutable == {"render_brand_direction", "run_brand_workflow"}


def test_file_schemas_are_submission_valid():
    for name in ("critique_brand_image", "compare_brand_images"):
        spec = TOOL_DEFINITIONS[name]
        for field in spec["files"]:
            schema = spec["input"]["properties"][field]
            assert set((schema.get("properties") or {}).keys()) >= {
                "download_url",
                "file_id",
                "mime_type",
                "file_name",
            }
            assert schema["required"] == ["download_url", "file_id"]


def test_widget_resource_contract():
    resource = server.get_resources()[0]
    assert resource["mimeType"] == MIME_TYPE
    assert resource["_meta"]["ui"]["csp"]["connectDomains"] == []
    assert resource["_meta"]["ui"]["csp"]["resourceDomains"] == []
    assert resource["_meta"]["ui"]["csp"]["frameDomains"] == []


def test_widget_resource_includes_asset_origin_when_configured(monkeypatch):
    monkeypatch.setenv("APP_BASE_URL", "https://brand.example")
    resource = server.get_resources()[0]
    assert resource["_meta"]["ui"]["csp"]["resourceDomains"] == ["https://brand.example"]
    assert resource["_meta"]["openai/widgetCSP"]["resource_domains"] == ["https://brand.example"]


def test_public_website_is_available():
    client = TestClient(server.app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Infographic Artist" in response.text


def test_domain_challenge_is_disabled_until_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_APPS_CHALLENGE_TOKEN", raising=False)
    client = TestClient(server.app)
    response = client.get("/.well-known/openai-apps-challenge")
    assert response.status_code == 404
    assert response.content == b""


def test_domain_challenge_returns_exact_token_only(monkeypatch):
    token = "openai-apps-verification-27pm"
    monkeypatch.setenv("OPENAI_APPS_CHALLENGE_TOKEN", token)
    client = TestClient(server.app)
    response = client.get("/.well-known/openai-apps-challenge")
    assert response.status_code == 200
    assert response.content == token.encode("utf-8")
    assert response.headers["cache-control"] == "no-store"


def test_domain_challenge_rejects_whitespace_bearing_tokens(monkeypatch):
    monkeypatch.setenv("OPENAI_APPS_CHALLENGE_TOKEN", "bad token")
    client = TestClient(server.app)
    with pytest.raises(RuntimeError, match="must not contain whitespace"):
        client.get("/.well-known/openai-apps-challenge")


def test_mcp_initialize_list_and_call(mcp_client):
    init = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(**{"mcp-protocol-version": "2025-06-18"}),
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}},
        },
    )
    assert init.status_code == 200
    assert init.json()["result"]["protocolVersion"] == "2025-06-18"
    listed = mcp_client.post("/mcp", headers=_mcp_headers(), json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    assert {tool["name"] for tool in listed.json()["result"]["tools"]} == set(TOOL_DEFINITIONS)
    called = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(),
        json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "open_brand_atlas", "arguments": {"query": "FedEx", "limit": 3}}},
    )
    result = called.json()["result"]
    assert result["isError"] is False
    assert result["structuredContent"]["view"] == "atlas"
    assert result["structuredContent"]["data"]["items"]


def test_resource_read_returns_mcp_app_html(mcp_client):
    response = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(),
        json={"jsonrpc": "2.0", "id": 4, "method": "resources/read", "params": {"uri": TEMPLATE_URI}},
    )
    content = response.json()["result"]["contents"][0]
    assert content["mimeType"] == MIME_TYPE
    assert "ui/notifications/tool-result" in content["text"]


def test_mcp_rejects_invalid_tool_arguments(mcp_client):
    response = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(),
        json={
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {"name": "generate_brand_directions", "arguments": {"name": "Missing brief"}},
        },
    )
    result = response.json()["result"]
    assert result["isError"] is True
    assert "validation" in result["content"][0]["text"].lower()


def test_mcp_render_job_mock_provider(mcp_client, monkeypatch, tmp_path):
    monkeypatch.setenv("IMAGE_GENERATION_PROVIDER", "mock")
    monkeypatch.setenv("GENERATED_ASSET_DIR", str(tmp_path))
    started = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(),
        json={
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "render_brand_direction",
                "arguments": {
                    "route_id": "symbol",
                    "route_name": "Signal autonome",
                    "concept_board_prompt": "Create one square concept board for a structurally original symbol direction with reduction tests and no existing logos.",
                },
            },
        },
    )
    payload = started.json()["result"]["structuredContent"]
    assert payload["view"] == "render_job"
    job_id = payload["data"]["job_id"]
    data = payload["data"]
    for _ in range(80):
        checked = mcp_client.post(
            "/mcp",
            headers=_mcp_headers(),
            json={
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {"name": "get_render_job", "arguments": {"job_id": job_id}},
            },
        )
        data = checked.json()["result"]["structuredContent"]["data"]
        if data["status"] == "succeeded":
            break
        asyncio.run(asyncio.sleep(0.05))
    assert data["status"] == "succeeded"
    asset = data["assets"][0]
    asset_response = mcp_client.get(asset["asset_url"])
    assert asset_response.status_code == 200
    assert asset_response.headers["content-type"].startswith("image/png")


def test_production_origin_is_injected_into_resource_metadata(monkeypatch):
    monkeypatch.setenv("APP_BASE_URL", "https://brand.example")
    resource = server.get_resources()[0]
    assert resource["_meta"]["ui"]["domain"] == "https://brand.example"
    assert resource["_meta"]["openai/widgetDomain"] == "https://brand.example"


def test_invalid_production_origin_is_rejected(monkeypatch):
    monkeypatch.setenv("APP_BASE_URL", "http://brand.example/mcp")
    import fallback_server

    with pytest.raises(RuntimeError, match="HTTPS origin"):
        fallback_server.get_resources()


def _mcp_headers(**extra):
    headers = {
        "accept": "application/json, text/event-stream",
        "mcp-protocol-version": "2025-11-25",
        "origin": "https://chatgpt.com",
    }
    headers.update(extra)
    return headers


def test_mcp_transport_security_and_method_contract(mcp_client):
    assert mcp_client.get("/mcp", headers=_mcp_headers()).status_code == 405
    assert mcp_client.delete("/mcp", headers=_mcp_headers()).status_code == 405

    bad_origin = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(origin="https://evil.example"),
        json={"jsonrpc": "2.0", "id": 20, "method": "ping", "params": {}},
    )
    assert bad_origin.status_code == 403

    bad_protocol = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(**{"mcp-protocol-version": "1900-01-01"}),
        json={"jsonrpc": "2.0", "id": 21, "method": "ping", "params": {}},
    )
    assert bad_protocol.status_code == 400

    bad_accept = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(accept="text/plain"),
        json={"jsonrpc": "2.0", "id": 22, "method": "ping", "params": {}},
    )
    assert bad_accept.status_code == 406


def test_mcp_notification_and_client_response_return_accepted(mcp_client):
    notification = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(),
        json={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
    )
    assert notification.status_code == 202
    assert not notification.content

    response = mcp_client.post(
        "/mcp",
        headers=_mcp_headers(),
        json={"jsonrpc": "2.0", "id": 99, "result": {}},
    )
    assert response.status_code == 202
    assert not response.content
