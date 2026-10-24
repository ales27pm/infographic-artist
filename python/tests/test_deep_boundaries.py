import io
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import core


@pytest.mark.parametrize("query", ["!!!", "🪷", "比例"])
def test_atlas_unsearchable_does_not_return_browse(query):
    result = core.search_atlas(query, limit=2)
    assert result["total_matches"] == 0 and result["items"] == []


@pytest.mark.parametrize(
    "text,minutes",
    [
        ("Deux variantes en 1 heure 30 minutes à 24 et 48 px.", 90),
        ("Two variants in 1.5 hours at 24 and 48 px.", 90),
        ("Deux variantes en 1,5 heure à 24 et 48 px.", 90),
        ("Deux variantes en 1h30 à 24 et 48 px.", 90),
    ],
)
def test_compound_decimal_duration(text, minutes):
    exercise = core.coach_decision(text)["exercise"]
    assert exercise["duration_minutes"] == minutes
    assert exercise["variant_count"] == 2
    assert sum(item["minutes"] for item in exercise["schedule"]) == minutes


def test_negative_size_list_not_positive_constraint():
    exercise = core.coach_decision("2 variantes en 60 minutes. Pas de tests à 16, 24 ou 48 px.")["exercise"]
    assert exercise["variant_count"] == 2 and exercise["duration_minutes"] == 60
    assert exercise["sizes_px"] == []


@pytest.mark.parametrize("score", [-1, 21, float("nan"), True, None])
def test_invalid_axis_scores_not_ranked(score):
    result = core.coach_decision("Comparer", {"axes": {"hierarchy": {"score": score, "label": "INVALID"}}})
    assert "INVALID" not in result["diagnosis"]


def test_wrong_axis_shape_is_ignored_safely():
    assert "diagnosis" in core.coach_decision("Comparer", {"axes": []})
    assert "{}" not in core.coach_decision("Comparer", {"axes": {"hierarchy": {"score": 12, "label": {}}}})["diagnosis"]


@pytest.mark.parametrize(
    "url",
    ["https://example.com/a.png", "https://files.openai.com.evil.test/a.png", "https://files.openai.com:8443/a.png"],
)
def test_only_host_attachment_urls_are_allowed_before_dns(url, monkeypatch):
    def no_dns(*args, **kwargs):
        pytest.fail("A rejected URL must not reach DNS")

    monkeypatch.setattr(core.socket, "getaddrinfo", no_dns)
    with pytest.raises(ValueError):
        core._validate_public_https_url(url)


@pytest.mark.asyncio
async def test_transparent_raster_is_composited_on_declared_white_background(monkeypatch):
    image = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    payload = stream.getvalue()
    import httpx

    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, headers={"content-type": "image/png"}, content=payload)
    )
    original = core.httpx.AsyncClient
    monkeypatch.setattr(core, "_validate_public_https_url", lambda url: None)
    monkeypatch.setattr(core.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs))
    result = await core.download_image({"download_url": "https://files.openai.com/image.png", "file_id": "qa"})
    assert result.getpixel((0, 0)) == (255, 255, 255)


def test_observed_host_file_origin_is_allowed_without_azure_wildcard(monkeypatch):
    monkeypatch.setattr(core.socket, "getaddrinfo", lambda *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))])
    core._validate_public_https_url("https://oaisdmntprcentralus.blob.core.windows.net/qa.png")
    with pytest.raises(ValueError):
        core._validate_public_https_url("https://untrusted-qa.blob.core.windows.net/qa.png")
