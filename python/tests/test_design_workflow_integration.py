"""Public-tool integration tests; run with the complete installed data and dependencies."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import core  # noqa: E402
import fallback_server  # noqa: E402
from contract import TOOL_DEFINITIONS  # noqa: E402


def test_principle_search_uses_existing_library_view_without_changing_atlas():
    before = core.atlas_summary()
    result = asyncio.run(fallback_server._execute_tool("search_design_systems", {"kind": "principle", "query": "golden ratio", "limit": 2}))
    assert result["view"] == "library"
    assert result["data"]["collection"] == "design_principles"
    assert result["data"]["items"][0]["id"] == "GEO-09"
    assert core.atlas_summary() == before
    assert core.search_design_systems("NASA")["items"][0]["name"] == "NASA Graphics Standards Program"


def test_directions_and_dispatch_preserve_native_handoff_and_declared_facts(monkeypatch):
    monkeypatch.delenv("INFOGRAPHIC_ENABLE_SERVER_RENDERING", raising=False)
    monkeypatch.delenv("IMAGE_GENERATION_PROVIDER", raising=False)
    brief = {"name": "Atelier", "sector": "architecture", "promise": "Précision humaine"}
    plain = core.generate_directions(brief)
    supplied = asyncio.run(fallback_server._execute_tool("generate_brand_directions", {**brief, "design_context": {"audience": "Architectes", "final_size": "1080 × 1350 px"}}))["data"]
    assert supplied["image_generation_handoff"] == plain["image_generation_handoff"]
    assert plain["image_generation_handoff"]["native_tool"] == "@Créer une image"
    assert [route["id"] for route in supplied["routes"]] == ["symbol", "type", "system"]
    assert "audience" in plain["design_workflow"]["missing_brief"]
    assert plain["brief"]["audience"] == "public général"
    assert supplied["design_workflow"]["brief"]["audience"] == "Architectes"
    assert supplied["brief"]["audience"] == "Architectes"
    assert all(route["concept_board_prompt"] for route in supplied["routes"])


def test_coaching_does_not_turn_critique_or_input_claims_into_human_evidence():
    critique = {"axes": {"memorability": {"label": "Old memorability label", "score": 19}}, "evaluations": {"recognition": {"status": "satisfait", "evidence": ["unverified claim"]}}}
    result = asyncio.run(fallback_server._execute_tool("coach_brand_decision", {"question": "Que vérifier ?", "critique": critique, "design_context": {"task": "Comparer les valeurs"}}))["data"]
    assert result["design_workflow"]["brief"] == {"task": "Comparer les valeurs"}
    assert len(result["design_workflow"]["stages"]) == 8
    for item in result["design_workflow"]["evaluations"].values():
        assert item["status"] == "non_testé" and item["evidence"] == []
    assert core.coach_decision("Question")["design_workflow"]["brief"] == {}


def test_critique_retains_numbers_and_identifies_heuristic_scope():
    result = core.critique_image(Image.new("RGB", (64, 64), "#fffdf8"))
    assert len(result["axes"]) == 5
    assert 0 <= result["score"] <= 100
    assert result["score"] == pytest.approx(sum(item["score"] for item in result["axes"].values() if item["score"] is not None), abs=0.2)
    assert result["score_kind"] == "heuristic_proxy"
    assert result["axes"]["memorability"]["basis"] == "heuristic"
    assert "proxy" in result["axes"]["memorability"]["label"]
    assert all(item["status"] == "non_testé" for item in result["evaluations"].values())


@pytest.mark.parametrize("context", [{"task": 42}, {"final_size": "x" * 161}, {"evidence": []}, {"status": "satisfait"}])
def test_invalid_context_rejected_by_public_schema(context):
    import jsonschema
    for tool, args in [("coach_brand_decision", {"question": "Que vérifier ?"}), ("generate_brand_directions", {"name": "Atelier", "sector": "architecture", "promise": "Précision humaine"})]:
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate({**args, "design_context": context}, TOOL_DEFINITIONS[tool]["input"])
