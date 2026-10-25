"""Current-request acceptance cases, shared with the JavaScript runtime."""
import json
import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import core
CASES = json.loads((Path(__file__).parent / "fixtures/intent_cases.json").read_text())

@pytest.mark.parametrize("case", CASES, ids=lambda c:c["id"])
def test_current_request_controls_result(case):
    args = case["args"]
    data = core.generate_directions(args) if case["tool"] == "directions" else core.coach_decision(**args)
    assert len(data["design_workflow"]["stages"]) == case["stages"]
    assert data["intent_resolution"]["status"] == ("clarification_required" if case.get("clarification") else "resolved")
    if case["tool"] == "directions":
        assert len(data["routes"]) == case["count"]
        assert data["intent_resolution"]["identity_exploration"] == case["identity"]
        if not case["identity"]:
            assert all(r["id"] not in {"symbol","type","system"} for r in data["routes"])
            assert all(not set(r["assets"]) & {"symbole","mot-signe","monogramme","alphabet secondaire"} for r in data["routes"])
        for r in data["routes"]:
            prompt = r["concept_board_prompt"]
            for value in args.get("design_context",{}).values():
                assert value in prompt
            for value in args.get("must_avoid",[]):
                assert value in prompt
            for value in args.get("execution",{}).get("locked_elements",[]):
                assert value in prompt
            assert 'dominant black-and-white symbol silhouette' not in prompt or case["identity"]
        assert data["image_generation_handoff"]["native_tool"] == "@Créer une image"
        assert data["image_generation_handoff"]["plugin_rendering_available"] is False
    elif case.get("advice"):
        assert data["mode"] == "advice"
        assert data["exercise"]["steps"] == data["exercise"]["schedule"] == []
        assert data["answer"] and ('gauche' in data["answer"] or 'left' in data["answer"])


def test_default_does_not_invent_brand_or_audience():
    data = core.generate_directions({"request":"Une illustration de feuilles", "design_context":{"medium":"Illustration"}})
    assert data["brief"]["name"] == data["brief"]["audience"] == ""
    assert len(data["routes"]) == 1
    assert data["design_workflow"]["stages"] == []


def test_empty_request_cannot_generate_unrelated_brand():
    with pytest.raises(ValueError):
        core.generate_directions({})
