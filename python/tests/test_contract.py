from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from contract import FILE_SCHEMA, MIME_TYPE, READ_ONLY_ANNOTATIONS, TEMPLATE_URI, TOOL_DEFINITIONS  # noqa: E402

WIDGET = (ROOT / "assets" / "app-v1.html").read_text(encoding="utf-8")
EXPECTED_TOOLS = set(TOOL_DEFINITIONS)


def test_source_syntax_and_tool_surface() -> None:
    for name in ("contract.py", "core.py", "fallback_server.py", "official_server.py", "server.py"):
        ast.parse((ROOT / name).read_text(encoding="utf-8"))
    descriptors = server.get_tool_descriptors()
    assert {tool["name"] for tool in descriptors} == EXPECTED_TOOLS
    assert {"render_brand_direction", "run_brand_workflow", "get_render_job"} <= EXPECTED_TOOLS


def test_descriptions_annotations_and_outputs_are_review_friendly() -> None:
    for tool in server.get_tool_descriptors():
        assert tool["description"].startswith("Use this when")
        assert tool["outputSchema"]
        expected = TOOL_DEFINITIONS[tool["name"]].get("annotations", READ_ONLY_ANNOTATIONS)
        assert tool["annotations"] == expected
        assert tool["_meta"]["ui"]["resourceUri"] == TEMPLATE_URI


def test_file_schema_matches_chatgpt_contract() -> None:
    assert set(FILE_SCHEMA["properties"]) == {"download_url", "file_id", "mime_type", "file_name"}
    assert FILE_SCHEMA["required"] == ["download_url", "file_id"]
    for name in ("critique_brand_image", "compare_brand_images"):
        for field in TOOL_DEFINITIONS[name]["files"]:
            schema = TOOL_DEFINITIONS[name]["input"]["properties"][field]
            assert set(schema["properties"]) == set(FILE_SCHEMA["properties"])
            assert schema["required"] == FILE_SCHEMA["required"]


def test_widget_is_self_contained_and_bridge_first() -> None:
    assert "ui/notifications/tool-result" in WIDGET
    assert "openai:set_globals" in WIDGET
    assert "bridgeRequest('tools/call'" in WIDGET
    assert "window.openai?.callTool" in WIDGET
    assert "window.openai?.openExternal" in WIDGET
    assert "<script src=" not in WIDGET
    assert "<iframe" not in WIDGET
    assert 'rel="noopener noreferrer"' in WIDGET


def test_widget_resource_contract() -> None:
    resource = server.get_resources()[0]
    assert resource["uri"] == TEMPLATE_URI
    assert resource["mimeType"] == MIME_TYPE
    assert resource["_meta"]["ui"]["csp"] == {
        "connectDomains": [],
        "resourceDomains": [],
        "frameDomains": [],
    }


def test_submission_manifest_matches_import_contract() -> None:
    manifest = json.loads((ROOT / "chatgpt-app-submission.json").read_text(encoding="utf-8"))
    assert manifest["$schema"].endswith("chatgpt-app-submission.v1.json")
    assert manifest["schema_version"] == 1
    assert manifest["app_info"]["display_name"] == "Infographic Artist"
    assert len(manifest["app_info"]["subtitle"]) <= 30
    assert manifest["app_info"]["category"] == "DESIGN"
    assert set(manifest["tools"]) == EXPECTED_TOOLS
    assert len(manifest["test_cases"]) >= 7
    assert len(manifest["negative_test_cases"]) >= 3
    for name, item in manifest["tools"].items():
        expected = TOOL_DEFINITIONS[name].get("annotations", READ_ONLY_ANNOTATIONS)
        assert item["annotations"]["readOnlyHint"] is expected["readOnlyHint"], name
        assert item["annotations"]["openWorldHint"] is expected["openWorldHint"], name
        assert item["annotations"]["destructiveHint"] is expected["destructiveHint"], name
        assert set(item["justifications"]) == {
            "read_only_justification",
            "open_world_justification",
            "destructive_justification",
        }
    assert all(case["tools_triggered"] in EXPECTED_TOOLS for case in manifest["test_cases"])
    assert all(case["tools_triggered"] is None for case in manifest["negative_test_cases"])


def test_submission_assets_are_valid_pngs() -> None:
    expected = {
        ROOT / "assets/app-icon-512.png": (512, 512),
        ROOT / "assets/app-icon-64.png": (64, 64),
        ROOT / "assets/submission-atlas.png": (1440, 1469),
        ROOT / "assets/submission-directions.png": (1440, 1474),
        ROOT / "assets/submission-critique.png": (1440, 980),
    }
    for path, dimensions in expected.items():
        assert path.is_file()
        with Image.open(path) as image:
            assert image.format == "PNG"
            assert image.size == dimensions


def test_no_secret_material_in_text_files() -> None:
    secret_patterns = [r"sk-proj-[A-Za-z0-9_-]{20,}", r"OPENAI_API_KEY\s*=\s*[^<\s]", r"hf_[A-Za-z0-9]{20,}"]
    ignored_parts = {".venv", ".pytest_cache", "__pycache__", "validation"}
    for path in ROOT.rglob("*"):
        if any(part in ignored_parts for part in path.parts):
            continue
        if not path.is_file() or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in secret_patterns:
            assert not re.search(pattern, text), f"Potential secret in {path}"
