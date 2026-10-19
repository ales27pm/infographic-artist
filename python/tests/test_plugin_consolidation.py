import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import core  # noqa: E402
import server  # noqa: E402


def test_unmatched_query_does_not_return_all_deep_cases():
    result = core.search_atlas("qxzvnjk987654321", limit=2)
    assert result["total_matches"] == 0
    assert result["items"] == []


def test_unconfigured_renderer_uses_honest_host_handoff(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("IMAGE_GENERATION_ENABLED", raising=False)
    monkeypatch.setenv("IMAGE_GENERATION_PROVIDER", "openai")
    data = core.generate_directions({"name":"Atelier", "sector":"architecture", "promise":"précision humaine"})
    assert data["image_generation_handoff"]["mode"] == "host_native"
    assert data["image_generation_handoff"]["plugin_rendering_available"] is False
    assert all(len(r["concept_board_prompt"]) > 100 for r in data["routes"])
    names = {t["name"] for t in server.get_tool_descriptors()}
    assert len(names) == 9
    assert "render_brand_direction" not in names


@pytest.mark.asyncio
async def test_disabled_renderer_creates_no_job(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("IMAGE_GENERATION_ENABLED", raising=False)
    monkeypatch.setenv("IMAGE_GENERATION_PROVIDER", "openai")
    monkeypatch.setenv("GENERATED_ASSET_DIR", str(tmp_path))
    with pytest.raises(ValueError, match="not enabled"):
        await core.render_brand_direction({"concept_board_prompt":"Original identity concept board for an architecture studio."})
    assert not list(tmp_path.rglob("*.json"))


def test_distributable_plugin_points_to_real_mcp():
    root = ROOT.parent / "plugins/infographic-artist"
    manifest = json.loads((root / "plugin.json").read_text())
    assert manifest["name"] == "infographic-artist"
    mcp = json.loads((root / "mcp.json").read_text())
    assert mcp["mcpServers"]["infographic_artist"]["url"] == "https://infographic-artist-1w7v.hatchable.site/api/chatgpt-mcp"
    assert (root / "skills/infographic-artist/SKILL.md").is_file()


def test_explicit_mock_runtime_keeps_experimental_descriptors(monkeypatch):
    monkeypatch.setenv("IMAGE_GENERATION_PROVIDER", "mock")
    assert len(server.get_tool_descriptors()) == 12
    assert {"render_brand_direction", "run_brand_workflow", "get_render_job"}.issubset(
        {tool["name"] for tool in server.get_tool_descriptors()})
