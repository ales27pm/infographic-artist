"""Regression cases reproduced in the published connector on 2026-10-24."""
import math
import sys
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import core  # noqa: E402

BRIEF = {
    "name": "27PM", "sector": "Studio québécois", "promise": "Rendre les offres complexes claires.",
    "must_avoid": ["Ne pas modifier les textes exacts « 27PM » et « 27:00 »."],
    "design_context": {
        "task": "Composer une page d’accueil, pas une planche de logos.",
        "message": "Conserver « 27PM », « 27:00 » et « Du concret, bien pensé. » exactement.",
        "medium": "Page web responsive et carte imprimée",
        "final_size": "Bureau 1440 × 900 px; mobile 390 × 844 px; symbole 24 px; carte 3,5 × 2 po.",
        "cultural_context": "Français du Québec; noir, blanc et vermillon.",
    },
}

@pytest.mark.parametrize("query", ["IBM", "NASA", "nasa-worm", "brand:ibm-8-bar"])
@pytest.mark.parametrize("limit", [20, 25, 30])
def test_graph_keeps_subject_before_one_hop_context(query, limit):
    result = core.explore_graph(query, limit)
    expected = "brand:ibm-8-bar" if "ibm" in query.lower() else "brand:nasa-worm"
    assert expected in {node["id"] for node in result["nodes"]}
    assert result["nodes"][0]["is_match"]
    seen_neighbour = False
    for node in result["nodes"]:
        if not node["is_match"]:
            seen_neighbour = True
        elif seen_neighbour:
            pytest.fail("Matching subject followed an unrelated neighbour")
    keep = {node["id"] for node in result["nodes"]}
    assert all(edge["source"] in keep and edge["target"] in keep for edge in result["edges"])
    assert len(result["nodes"]) <= limit
    assert result["meta"]["context_hops"] == 1
    seeds = {node["id"] for node in result["nodes"] if node["is_match"]}
    adjacent = set()
    for edge in core.GRAPH_DOCUMENT["edges"]:
        if edge["source"] in seeds:
            adjacent.add(edge["target"])
        if edge["target"] in seeds:
            adjacent.add(edge["source"])
    assert all(node["is_match"] or node["id"] in adjacent for node in result["nodes"])
    assert core.explore_graph(query, limit) == result

@pytest.mark.parametrize("query", ["zzqv-inexistant-27pm-qa-20261024", "!!!", "🪷"])
def test_graph_does_not_substitute_unrelated_nodes_for_no_match(query):
    result = core.explore_graph(query, 20)
    assert result["nodes"] == result["edges"] == []
    assert result["meta"]["matched_count"] == 0
    assert result["meta"]["no_matches"] is True


def test_empty_graph_remains_browsable():
    assert len(core.explore_graph("", 20)["nodes"]) == 20


def test_prompts_preserve_exact_text_medium_dimensions_and_native_handoff(monkeypatch):
    monkeypatch.delenv("IMAGE_GENERATION_PROVIDER", raising=False)
    result = core.generate_directions(BRIEF)
    for route in result["routes"]:
        prompt = route["concept_board_prompt"]
        for text in ["27PM", "27:00", "Du concret, bien pensé.", "1440 × 900 px", "390 × 844 px", "3,5 × 2 po", "vermillon"]:
            assert text in prompt
        for contradictory in ["abstract placeholder glyphs", "Create one square concept board", "Use placeholder text where needed"]:
            assert contradictory not in prompt
        assert "verbatim" in prompt
    assert result["image_generation_handoff"]["native_tool"] == "@Créer une image"


def test_long_message_keeps_final_exact_copy_and_constraints():
    message = "Texte : " + "Contenu long. " * 60 + "« TEXTE-FINAL-À-CONSERVER »"
    result = core.generate_directions({**BRIEF, "design_context": {**BRIEF["design_context"], "message": message}})
    for route in result["routes"]:
        assert "TEXTE-FINAL-À-CONSERVER" in route["concept_board_prompt"]
        assert BRIEF["must_avoid"][0] in route["concept_board_prompt"]

@pytest.mark.parametrize("question", [
    "Deux variantes seulement, exactement 60 minutes, tests à 24 et 48 pixels. Pas trois prototypes ni 45–90 minutes.",
    "Exactly 2 variants in 60 minutes; test at 24 and 48 px. Do not propose 3 variants or 45–90 minutes.",
])
def test_coach_obeys_constraints_and_keeps_human_evaluations_untested(question):
    result = core.coach_decision(question)
    exercise = result["exercise"]
    assert exercise["duration"] == "60 minutes"
    assert exercise["variant_count"] == 2
    assert exercise["sizes_px"] == [24, 48]
    assert sum(step["minutes"] for step in exercise["schedule"]) == 60
    assert all(any(f"{size} px" in text for text in result["acceptance_criteria"]) for size in [24, 48])
    assert "trois prototypes" not in " ".join(exercise["steps"])
    assert all(item["status"] == "non_testé" for item in result["design_workflow"]["evaluations"].values())


def test_conflicting_positive_constraints_are_not_silently_resolved():
    result = core.coach_decision("Deux variantes en 60 minutes, puis quatre variantes en 30 minutes.")
    exercise = result["exercise"]
    assert exercise["constraint_status"] == "ambiguous"
    assert exercise["variant_count"] is None
    assert exercise["duration_minutes"] is None
    assert exercise["schedule"] == []


def test_unspecified_constraints_stay_unknown():
    exercise = core.coach_decision("Comment comparer ces propositions ?")["exercise"]
    assert exercise["duration_minutes"] is None
    assert exercise["variant_count"] is None
    assert exercise["sizes_px"] == []


def mark():
    image = Image.new("RGB", (256, 256), "white")
    ImageDraw.Draw(image).rectangle((105, 30, 150, 225), fill="black")
    return image


def test_missing_reference_excludes_differentiation_from_score_and_actions():
    result = core.critique_image(mark())
    assert result["axes"]["differentiation"]["score"] is None
    assert result["axes"]["differentiation"]["status"] == "non_evaluable"
    assert result["score_max"] == 80
    assert result["grade"] is None
    assert result["excluded_axes"] == ["differentiation"]
    assert "differentiation" not in result["priority_axes"]
    assert all("Changer la silhouette" not in action for action in result["priority_actions"])
    assert result["score"] == round(sum(item["score"] or 0 for item in result["axes"].values()), 1)


def test_reference_enables_only_relative_heuristic():
    image = mark()
    result = core.critique_image(image, reference=image)
    assert result["axes"]["differentiation"]["score"] == 0
    assert result["axes"]["differentiation"]["status"] == "heuristic"
    assert result["score_max"] == 100
    assert result["excluded_axes"] == []
    assert "référence" in result["axes"]["differentiation"]["measurement_note"]


def test_coach_filters_null_nonfinite_and_boolean_axes():
    result = core.coach_decision("Deux variantes en 60 minutes à 24 et 48 px.", {"axes": {
        "differentiation": {"score": None, "status": "non_evaluable"},
        "hierarchy": {"score": 12, "label": "Hiérarchie"},
        "legibility": {"score": math.nan}, "memorability": {"score": True},
    }})
    assert "Hiérarchie" in result["diagnosis"]
    assert "legibility" not in result["diagnosis"]
    assert "memorability" not in result["diagnosis"]
    assert result["exercise"]["variant_count"] == 2
