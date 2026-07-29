from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import core  # noqa: E402


def synthetic_mark(offset: int = 0) -> Image.Image:
    im = Image.new("RGB", (640, 480), "#f3efe4")
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((130 + offset, 80, 510 + offset, 400), radius=65, fill="#161813")
    draw.ellipse((235 + offset, 145, 405 + offset, 315), fill="#c9ff39")
    draw.polygon([(320 + offset, 110), (430 + offset, 250), (320 + offset, 350), (210 + offset, 250)], fill="#ff6238")
    return im


def test_atlas_counts_and_bounded_search() -> None:
    summary = core.atlas_summary()
    assert summary["brand_count"] == 934
    assert summary["deep_case_count"] == 64
    assert summary["library_count"] == 105
    result = core.search_atlas("espace négatif logistique", limit=100)
    assert 1 <= len(result["items"]) <= 25
    assert result["items"][0]["id"] == "fedex"
    assert result["items"][0]["depth"] == "deep"


def test_case_and_comparison_expose_anti_copy_boundaries() -> None:
    case = core.get_brand_case("fedex")
    assert case and case["sources"]
    assert case["do_not_copy"]
    result = core.compare_brand_systems(["fedex", "ibm-8-bar"])
    assert len(result["cases"]) == 2
    assert all(item["collision_boundary"] for item in result["cases"])


def test_graph_and_library_are_bounded() -> None:
    graph = core.explore_graph("typographie", 200)
    assert 1 <= len(graph["nodes"]) <= 120
    assert len(graph["edges"]) <= 360
    library = core.search_design_systems("NASA", limit=25)
    assert library["items"][0]["name"] == "NASA Graphics Standards Program"


def test_directions_are_structurally_incompatible_and_french() -> None:
    result = core.generate_directions(
        {
            "name": "Atelier Boréal",
            "sector": "architecture durable",
            "promise": "rendre la précision humaine et crédible",
            "traits": ["précise", "humaine"],
            "must_avoid": ["montagnes"],
        }
    )
    assert [route["id"] for route in result["routes"]] == ["symbol", "type", "system"]
    assert len({route["architecture"] for route in result["routes"]}) == 3
    assert all("Ne pas emprunter" in route["anti_copy_rule"] for route in result["routes"])
    assert "Prototyper" in result["decision_rule"]


def test_image_metrics_and_critique() -> None:
    image = synthetic_mark()
    metrics = core.image_metrics(image)
    assert 0 <= metrics["edge_density"] <= 1
    assert 0 <= metrics["small_size_stability"] <= 1
    result = core.critique_image(image, context="Test")
    assert 0 <= result["score"] <= 100
    assert len(result["axes"]) == 5
    assert sum(axis["score"] for axis in result["axes"].values()) == pytest.approx(result["score"], abs=0.2)
    assert result["priority_actions"]


def test_similarity_identical_is_high_and_explained() -> None:
    image = synthetic_mark()
    identical = core.compare_images(image, image.copy())
    shifted = core.compare_images(image, synthetic_mark(40))
    assert identical["risk_score"] >= 95
    assert identical["risk_score"] >= shifted["risk_score"]
    assert identical["recommended_transformations"]
    assert "triage perceptuel" in identical["legal_note"]


def test_url_guard_blocks_local_networks() -> None:
    for url in [
        "http://example.com/a.png",
        "https://localhost/a.png",
        "https://127.0.0.1/a.png",
        "https://10.0.0.2/a.png",
        "https://user:pass@example.com/a.png",
    ]:
        with pytest.raises(ValueError):
            core._validate_public_https_url(url)
