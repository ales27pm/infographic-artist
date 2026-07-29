from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import ipaddress
import json
import math
import os
import random
import re
import shutil
import socket
import statistics
import time
import unicodedata
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse
from uuid import uuid4

import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MAX_RESULTS = 25
MAX_FILE_BYTES = 12 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations"
DEFAULT_IMAGE_MODEL = "gpt-image-2"
DEFAULT_ASSET_RETENTION_HOURS = 168
DEFAULT_GENERATED_ASSET_MAX_BYTES = 512 * 1024 * 1024
DEFAULT_RENDER_DAILY_IMAGE_LIMIT = 25
DEFAULT_RENDER_MAX_CONCURRENT_JOBS = 2
SUPPORTED_RENDER_SIZES = {"auto", "1024x1024", "1536x1024", "1024x1536"}
SUPPORTED_RENDER_QUALITIES = {"auto", "low", "medium", "high"}
SUPPORTED_OUTPUT_FORMATS = {"png", "jpeg", "webp"}
SUPPORTED_BACKGROUNDS = {"auto", "transparent", "opaque"}


def normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def compact_text(value: Any, limit: int = 500) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _load_json(name: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


ATLAS_DOCUMENT = _load_json("identity_atlas.json")
LIBRARY_DOCUMENT = _load_json("design_system_library.json")
GRAPH_DOCUMENT = _load_json("knowledge_graph.json")
BRANDS: list[dict[str, Any]] = ATLAS_DOCUMENT["brands"]
LIBRARY: list[dict[str, Any]] = LIBRARY_DOCUMENT["entries"]
BRANDS_BY_ID = {item["id"]: item for item in BRANDS}
LIBRARY_BY_ID = {
    re.sub(r"[^a-z0-9]+", "-", normalize(item["name"])).strip("-"): item for item in LIBRARY
}


_SEARCH_FIELDS = (
    ("name", 8.0),
    ("organization", 5.0),
    ("designers", 5.0),
    ("category", 3.0),
    ("archetype", 4.0),
    ("system_pattern", 5.0),
    ("primary_mechanism", 4.0),
    ("mechanism_clusters", 3.0),
    ("tags", 2.5),
    ("region", 2.0),
    ("era", 1.5),
    ("visual_mechanism", 1.5),
    ("brand_system_lesson", 1.25),
    ("transferable_principles", 1.5),
)


def _field_text(item: dict[str, Any], field: str) -> str:
    value = item.get(field, "")
    if isinstance(value, list):
        value = " ".join(str(part) for part in value)
    return normalize(value)


def _tokens(text: str) -> list[str]:
    return [token for token in normalize(text).split() if len(token) >= 2]


def _score_brand(item: dict[str, Any], query: str) -> float:
    query_n = normalize(query)
    if not query_n:
        base = 5.0 if item.get("depth") == "deep" else 1.0
        base += 0.8 if item.get("evidence_confidence") == "high" else 0.0
        return base + float(item.get("anchor_year") or 0) / 100000.0
    q_tokens = _tokens(query_n)
    score = 0.0
    for field, weight in _SEARCH_FIELDS:
        text = _field_text(item, field)
        if not text:
            continue
        if query_n == text:
            score += weight * 4
        elif query_n in text:
            score += weight * 2.2
        matched = sum(1 for token in q_tokens if token in text)
        score += weight * matched / max(len(q_tokens), 1)
    if item.get("depth") == "deep":
        score += 0.75
    return score


def compact_brand(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "name": item["name"],
        "organization": item.get("organization", ""),
        "year": item.get("first_use") or item.get("anchor_year"),
        "designers": item.get("designers", [])[:4],
        "category": item.get("category", ""),
        "region": item.get("region", ""),
        "era": item.get("era", ""),
        "archetype": item.get("archetype", ""),
        "system_pattern": item.get("system_pattern", ""),
        "primary_mechanism": item.get("primary_mechanism", ""),
        "why_iconic": compact_text(item.get("why_iconic"), 260),
        "lesson": compact_text(item.get("brand_system_lesson"), 300),
        "principles": item.get("transferable_principles", [])[:4],
        "do_not_copy": compact_text(item.get("do_not_copy"), 260),
        "evidence": item.get("evidence_confidence") or item.get("evidence_level") or "index",
        "depth": item.get("depth", "deep" if item.get("sources") else "index"),
    }


def atlas_summary() -> dict[str, Any]:
    patterns = Counter(item.get("system_pattern") or "non classé" for item in BRANDS)
    regions = Counter(item.get("region") or "non classée" for item in BRANDS)
    return {
        "brand_count": len(BRANDS),
        "deep_case_count": int(ATLAS_DOCUMENT.get("deep_case_count", 0)),
        "index_case_count": int(ATLAS_DOCUMENT.get("index_case_count", 0)),
        "library_count": len(LIBRARY),
        "graph_nodes": len(GRAPH_DOCUMENT.get("nodes", [])),
        "graph_edges": len(GRAPH_DOCUMENT.get("edges", [])),
        "top_patterns": [{"name": k, "count": v} for k, v in patterns.most_common(8)],
        "top_regions": [{"name": k, "count": v} for k, v in regions.most_common(8)],
    }


def search_atlas(
    query: str = "",
    *,
    region: str = "",
    pattern: str = "",
    category: str = "",
    era: str = "",
    limit: int = 12,
) -> dict[str, Any]:
    limit = max(1, min(int(limit), MAX_RESULTS))
    filters = {
        "region": normalize(region),
        "system_pattern": normalize(pattern),
        "category": normalize(category),
        "era": normalize(era),
    }
    ranked: list[tuple[float, dict[str, Any]]] = []
    for item in BRANDS:
        if any(value and value not in _field_text(item, field) for field, value in filters.items()):
            continue
        score = _score_brand(item, query)
        if query.strip() and score <= 0:
            continue
        ranked.append((score, item))
    ranked.sort(key=lambda pair: (pair[0], pair[1].get("depth") == "deep", pair[1]["name"]), reverse=True)
    items = [compact_brand(item) | {"relevance": round(score, 3)} for score, item in ranked[:limit]]
    return {
        "query": compact_text(query, 250),
        "filters": {key: value for key, value in {"region": region, "pattern": pattern, "category": category, "era": era}.items() if value},
        "total_matches": len(ranked),
        "items": items,
    }


def get_brand_case(item_id: str) -> dict[str, Any] | None:
    item = BRANDS_BY_ID.get(item_id)
    if not item:
        # Exact normalized name fallback helps model follow-up calls.
        target = normalize(item_id)
        item = next((entry for entry in BRANDS if normalize(entry["name"]) == target), None)
    if not item:
        return None
    return {
        **compact_brand(item),
        "visual_mechanism": compact_text(item.get("visual_mechanism"), 700),
        "recognition_basis": item.get("recognition_basis", [])[:6],
        "asset_layers": item.get("asset_layers", [])[:8],
        "collision_layers": item.get("collision_layers", [])[:8],
        "stress_tests": item.get("stress_tests", [])[:8],
        "benchmark_dimensions": item.get("benchmark_dimensions", {}),
        "legal_sensitivity": item.get("legal_sensitivity", "standard"),
        "sources": [
            {"title": compact_text(source.get("title"), 180), "url": source.get("url", ""), "kind": source.get("kind", "")}
            for source in item.get("sources", [])[:6]
            if source.get("url")
        ],
    }


def compare_brand_systems(ids: Iterable[str]) -> dict[str, Any]:
    unique = []
    for item_id in ids:
        if item_id not in unique:
            unique.append(item_id)
    if not 2 <= len(unique) <= 4:
        raise ValueError("Fournir entre 2 et 4 identifiants uniques de l’atlas.")
    cases = []
    for item_id in unique:
        case = get_brand_case(item_id)
        if case is None:
            raise ValueError(f"Identifiant d’atlas inconnu : {item_id}")
        cases.append(case)
    pattern_counts = Counter(case.get("system_pattern") or "" for case in cases)
    mechanism_counts = Counter(
        mechanism for item_id in unique for mechanism in BRANDS_BY_ID[item_id].get("mechanism_clusters", [])
    )
    shared_patterns = [name for name, count in pattern_counts.items() if name and count > 1]
    shared_mechanisms = [name for name, count in mechanism_counts.items() if count > 1]
    matrix = []
    for case in cases:
        matrix.append(
            {
                "id": case["id"],
                "name": case["name"],
                "pattern": case["system_pattern"],
                "mechanism": case["primary_mechanism"],
                "principles": case["principles"][:3],
                "collision_boundary": case["do_not_copy"],
                "stress_tests": case["stress_tests"][:4],
            }
        )
    return {
        "cases": matrix,
        "shared_patterns": shared_patterns,
        "shared_mechanisms": shared_mechanisms,
        "synthesis": (
            "Transférer la logique de conception partagée seulement après avoir changé la silhouette, la topologie, la typographie, le comportement chromatique et la composition."
            if shared_patterns or shared_mechanisms
            else "Ces précédents sont structurellement distincts; les utiliser pour créer des routes concurrentes plutôt qu’un pastiche fusionné."
        ),
    }


def _library_id(item: dict[str, Any]) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize(item["name"])).strip("-")


def search_design_systems(query: str = "", kind: str = "", limit: int = 12) -> dict[str, Any]:
    limit = max(1, min(int(limit), 25))
    q = normalize(query)
    kind_n = normalize(kind)
    ranked: list[tuple[float, dict[str, Any]]] = []
    for item in LIBRARY:
        if kind_n and kind_n not in normalize(item.get("type")):
            continue
        fields = [item.get("name"), item.get("type"), item.get("region"), item.get("era")]
        fields += item.get("focus", []) + item.get("principles", []) + item.get("key_works", [])
        haystack = normalize(" ".join(str(value) for value in fields if value))
        if q and not any(token in haystack for token in _tokens(q)):
            continue
        score = 4.0 if q and q in normalize(item.get("name")) else 0.0
        score += sum(1.0 for token in _tokens(q) if token in haystack)
        ranked.append((score, item))
    ranked.sort(key=lambda pair: (pair[0], pair[1]["name"]), reverse=True)
    items = [
        {
            "id": _library_id(item),
            "name": item["name"],
            "kind": item.get("type", ""),
            "region": item.get("region", ""),
            "era": item.get("era", ""),
            "focus": item.get("focus", [])[:6],
            "principles": item.get("principles", [])[:5],
            "signature_projects": item.get("key_works", [])[:5],
            "source_url": item.get("source_url", ""),
            "source_status": item.get("source_status", ""),
        }
        for _, item in ranked[:limit]
    ]
    return {"query": compact_text(query, 250), "kind": kind, "total_matches": len(ranked), "items": items}


def explore_graph(query: str = "", limit: int = 80) -> dict[str, Any]:
    limit = max(20, min(int(limit), 120))
    nodes = GRAPH_DOCUMENT.get("nodes", [])
    edges = GRAPH_DOCUMENT.get("edges", [])
    q_tokens = _tokens(query)
    if q_tokens:
        selected = {
            node["id"]
            for node in nodes
            if all(token in normalize(" ".join(str(node.get(key, "")) for key in ("label", "node_type", "category", "kind", "ref"))) for token in q_tokens)
        }
        # Pull two-hop neighbours to preserve meaning without returning the full graph.
        for _ in range(2):
            expanded = set(selected)
            for edge in edges:
                if edge["source"] in selected:
                    expanded.add(edge["target"])
                if edge["target"] in selected:
                    expanded.add(edge["source"])
            selected = expanded
        # Keep the graph useful when an exact query has only a tiny component.
        if len(selected) < min(20, limit):
            for node in sorted(nodes, key=lambda item: item.get("degree", 0), reverse=True):
                selected.add(node["id"])
                if len(selected) >= min(20, limit):
                    break
        filtered_nodes = [node for node in nodes if node["id"] in selected]
    else:
        filtered_nodes = sorted(nodes, key=lambda node: node.get("degree", 0), reverse=True)
    filtered_nodes = filtered_nodes[:limit]
    keep = {node["id"] for node in filtered_nodes}
    filtered_edges = [edge for edge in edges if edge["source"] in keep and edge["target"] in keep][: limit * 3]
    return {
        "query": compact_text(query, 250),
        "nodes": [
            {
                "id": node["id"],
                "label": node.get("label", node["id"]),
                "type": node.get("node_type", "concept"),
                "ref": node.get("ref", ""),
                "x": node.get("x", 0.5),
                "y": node.get("y", 0.5),
                "degree": node.get("degree", 0),
            }
            for node in filtered_nodes
        ],
        "edges": filtered_edges,
        "meta": {"node_count": len(filtered_nodes), "edge_count": len(filtered_edges)},
    }


_ROUTE_ARCHETYPES = [
    {
        "key": "symbol",
        "name": "Signal autonome",
        "architecture": "Un symbole compact conçu d’abord en silhouette monochrome, puis relié au nom par une règle de proportion stable.",
        "geometry": "Une masse primaire, une tension directionnelle et une contreforme utile. Éviter les détails décoratifs avant 24 px.",
        "typography": "Mot-signe calme et distinct, sans chercher à répéter littéralement la forme du symbole.",
        "assets": ["symbole", "mot-signe", "micro-icône", "règles de réduction"],
        "tests": ["12/24/48 px", "monochrome", "flou 3 px", "découpe", "rappel après 2 secondes"],
    },
    {
        "key": "type",
        "name": "Rythme typographique propriétaire",
        "architecture": "Le nom devient l’actif principal grâce à une anomalie locale, un rythme ou une modulation issue de la promesse.",
        "geometry": "Construire les intervalles, ligatures et contreformes sur une grille; limiter l’idée distinctive à un geste répétable.",
        "typography": "Dessin ou modification ciblée plutôt qu’une police spectaculaire non gouvernée.",
        "assets": ["mot-signe", "monogramme", "alphabet secondaire", "motif dérivé"],
        "tests": ["lecture immédiate", "gravure", "petite taille", "langues secondaires", "animation de construction"],
    },
    {
        "key": "system",
        "name": "Champ vivant gouverné",
        "architecture": "Une grammaire stable génère plusieurs compositions, icônes ou cadres sans figer la marque dans une seule image.",
        "geometry": "Définir des invariants mesurables — grille, module, angle, densité et zone de repos — avant les variations.",
        "typography": "Typographie fonctionnelle servant d’ancrage pendant que le champ visuel varie.",
        "assets": ["grille", "règles de variation", "bibliothèque de modules", "motion", "gabarits"],
        "tests": ["10 variantes cohérentes", "signalétique", "motion 2 secondes", "supports étroits", "version statique"],
    },
]


_CONCEPT_BOARD_LAYERS = {
    "symbol": (
        "a dominant black-and-white symbol silhouette, a reduction strip at 48, 24, and 12 px, "
        "one cropped detail showing the counterform logic, and two restrained application mockups"
    ),
    "type": (
        "a wordmark construction study with abstract placeholder glyphs, spacing rhythm diagrams, "
        "a monogram crop, and two small-use tests where the typographic anomaly remains readable"
    ),
    "system": (
        "a governed visual grammar with a visible grid, three generated module variations, "
        "one motion/keyframe strip, and two application mockups that share the same invariants"
    ),
}


def _join_prompt_terms(values: Iterable[Any], fallback: str, *, limit: int = 6) -> str:
    clean = [compact_text(value, 90) for value in values if compact_text(value, 90)]
    return ", ".join(clean[:limit]) if clean else fallback


def _concept_board_prompt(
    *,
    name: str,
    sector: str,
    promise: str,
    audience: str,
    traits: list[str],
    avoid: list[str],
    archetype: dict[str, Any],
    precedents: list[dict[str, Any]],
) -> str:
    precedent_names = _join_prompt_terms((source.get("name") for source in precedents), "no visible precedent references", limit=3)
    trait_text = _join_prompt_terms(traits, "clear, coherent, distinctive")
    avoid_text = _join_prompt_terms(
        [
            *avoid,
            "existing logos",
            "mascots",
            "signature typography",
            "trade dress",
            "recognizable third-party colour systems",
        ],
        "existing logos, protected marks, mascots, signature typography, trade dress",
        limit=10,
    )
    layer_text = _CONCEPT_BOARD_LAYERS.get(archetype["key"], "three disciplined visual studies and production tests")
    return compact_text(
        "Create one square concept board for an original brand identity, not a finished logo. "
        f"Brand or project name: {name}. Sector: {sector}. Promise to make visible: {promise}. "
        f"Audience: {audience}. Direction: {archetype['name']}. Structural idea: {archetype['architecture']} "
        f"Show {layer_text}. Express these traits through structure: {trait_text}. "
        f"Use a restrained palette logic that can still work in black and white. Avoid: {avoid_text}. "
        f"The cited precedents are method-only context ({precedent_names}); do not include, imitate, remix, "
        "or allude visually to their protected forms. Do not reproduce existing marks, protected logos, mascots, "
        "signature lettering, negative-space tricks, trade dress, or recognizable third-party brand systems. "
        "Use placeholder text where needed and keep the board production-minded, high-contrast, and independently derived.",
        1800,
    )


def _board_evaluation_focus(archetype: dict[str, Any]) -> list[str]:
    return [
        f"La planche exprime la promesse par la structure {archetype['key']} plutôt que par une finition de surface.",
        "La silhouette, la topologie, la typographie, le comportement chromatique et la composition divergent clairement des précédents cités.",
        "L’idée principale survit aux tests monochrome, petite taille, flou et rappel rapide.",
    ]


def generate_directions(brief: dict[str, Any]) -> dict[str, Any]:
    name = compact_text(brief.get("name"), 120)
    sector = compact_text(brief.get("sector"), 160)
    promise = compact_text(brief.get("promise"), 1000)
    if not name or not sector or len(promise) < 3:
        raise ValueError("name, sector, and a meaningful promise are required.")
    audience = compact_text(brief.get("audience") or "public général", 400)
    traits = [compact_text(value, 100) for value in brief.get("traits", []) if compact_text(value, 100)][:8]
    avoid = [compact_text(value, 100) for value in brief.get("must_avoid", []) if compact_text(value, 100)][:8]
    risk = brief.get("risk_tolerance") or "équilibrée"
    seed_material = json.dumps({"name": name, "sector": sector, "promise": promise, "traits": traits, "avoid": avoid, "risk": risk}, sort_keys=True, ensure_ascii=False)
    rng = random.Random(int(hashlib.sha256(seed_material.encode()).hexdigest()[:16], 16))
    precedent_query = " ".join([sector, promise, *traits])
    precedents = search_atlas(precedent_query, limit=12)["items"]
    rng.shuffle(precedents)
    routes = []
    for index, archetype in enumerate(_ROUTE_ARCHETYPES):
        precedent = precedents[index] if index < len(precedents) else None
        secondary = precedents[index + 3] if index + 3 < len(precedents) else None
        principles = []
        for source in (precedent, secondary):
            if source:
                principles.extend(source.get("principles", [])[:2])
        route = {
            "id": archetype["key"],
            "name": archetype["name"],
            "thesis": f"Pour {name}, rendre « {promise} » visible par {archetype['architecture'][0].lower() + archetype['architecture'][1:]}",
            "architecture": archetype["architecture"],
            "geometry": archetype["geometry"],
            "typography": archetype["typography"],
            "palette_logic": (
                "Commencer en noir et blanc; ajouter une couleur fonctionnelle liée à la promesse, puis vérifier le contraste et la reproduction."
            ),
            "assets": archetype["assets"],
            "stress_tests": archetype["tests"],
            "traits_to_express": traits or ["clarté", "cohérence", "présence"],
            "must_avoid": avoid,
            "precedents": [
                {"id": source["id"], "name": source["name"], "principle_only": source.get("principles", [source.get("lesson", "")])[0] if source else ""}
                for source in (precedent, secondary)
                if source
            ],
            "transferable_principles": list(dict.fromkeys(principles))[:4],
            "anti_copy_rule": "Ne pas emprunter la silhouette, la construction des lettres, la combinaison chromatique, le dispositif d’espace négatif ou la composition du précédent. Redériver chaque forme depuis ce brief.",
            "fit": {"audience": audience, "risk_tolerance": risk, "sector": sector},
        }
        route["concept_board_prompt"] = _concept_board_prompt(
            name=name,
            sector=sector,
            promise=promise,
            audience=audience,
            traits=traits,
            avoid=avoid,
            archetype=archetype,
            precedents=route["precedents"],
        )
        route["board_evaluation_focus"] = _board_evaluation_focus(archetype)
        routes.append(route)
    return {
        "brief": {"name": name, "sector": sector, "promise": promise, "audience": audience, "traits": traits, "must_avoid": avoid, "risk_tolerance": risk},
        "routes": routes,
        "image_generation_handoff": {
            "mode": "plugin_rendering_available",
            "instructions": "Utiliser render_brand_direction pour une route ou run_brand_workflow pour générer les trois planches dans le plugin, puis consulter get_render_job pendant l’exécution.",
            "storage_note": f"Les planches rendues par le plugin sont conservées comme actifs générés jusqu’à expiration de la rétention configurée, {_retention_hours():g} heures.",
        },
        "decision_rule": "Prototyper les trois routes en monochrome avant d’en choisir une. Retenir celle dont la structure — et non la finition — rend la promesse la plus facile à percevoir et la plus difficile à confondre.",
    }


_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()
_SAFE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{7,80}$")
_SAFE_FILE_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{1,160}$")
MAX_RENDER_PROMPT_CHARS = 32000
MAX_RENDER_METADATA_BYTES = 40_000
IMAGE_DOWNLOAD_TOTAL_DEADLINE_SECONDS = 20.0
IMAGE_DOWNLOAD_CONNECT_TIMEOUT_SECONDS = 10.0


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        parsed = float(value)
    except ValueError:
        return default
    return parsed if math.isfinite(parsed) and parsed > 0 else default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _numeric_env_warning(name: str, default: float | int) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        return ""
    try:
        numeric = float(value)
    except ValueError:
        return f"{name} is invalid; using default {default}."
    if not math.isfinite(numeric) or numeric <= 0:
        return f"{name} must be positive and finite; using default {default}."
    return ""


def _asset_root() -> Path:
    value = os.getenv("GENERATED_ASSET_DIR", "generated_assets").strip() or "generated_assets"
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    return path


def _jobs_dir() -> Path:
    return _asset_root() / "jobs"


def _assets_dir() -> Path:
    return _asset_root() / "assets"


def _retention_hours() -> float:
    return max(1.0, _env_float("GENERATED_ASSET_RETENTION_HOURS", float(DEFAULT_ASSET_RETENTION_HOURS)))


def _generation_timeout() -> float:
    return max(10.0, _env_float("IMAGE_GENERATION_TIMEOUT_SECONDS", 120.0))


def _max_retained_bytes() -> int:
    return max(1, _env_int("GENERATED_ASSET_MAX_BYTES", DEFAULT_GENERATED_ASSET_MAX_BYTES))


def _render_daily_image_limit() -> int:
    return max(1, _env_int("RENDER_DAILY_IMAGE_LIMIT", DEFAULT_RENDER_DAILY_IMAGE_LIMIT))


def _render_max_concurrent_jobs() -> int:
    return max(1, _env_int("RENDER_MAX_CONCURRENT_JOBS", DEFAULT_RENDER_MAX_CONCURRENT_JOBS))


def _provider() -> str:
    return normalize(os.getenv("IMAGE_GENERATION_PROVIDER", "openai")) or "openai"


def _image_model(model: Any = "") -> str:
    return compact_text(model or os.getenv("IMAGE_GENERATION_MODEL") or DEFAULT_IMAGE_MODEL, 80)


def _safe_slug(value: Any, fallback: str = "asset") -> str:
    slug = re.sub(r"[^a-z0-9._-]+", "-", normalize(value)).strip("-._")
    return slug[:72] or fallback


def _new_job_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex}"


def _validate_job_id(job_id: str) -> None:
    if not _SAFE_ID_RE.match(job_id):
        raise ValueError("Invalid render job ID.")


def _validate_filename(filename: str) -> None:
    if not _SAFE_FILE_RE.match(filename) or "/" in filename or "\\" in filename:
        raise ValueError("Invalid generated asset filename.")


def _job_path(job_id: str) -> Path:
    _validate_job_id(job_id)
    return _jobs_dir() / f"{job_id}.json"


def _write_job(job: dict[str, Any]) -> None:
    _jobs_dir().mkdir(parents=True, exist_ok=True)
    path = _job_path(str(job["job_id"]))
    tmp = path.with_name(f"{path.name}.tmp")
    tmp.write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _read_job(job_id: str) -> dict[str, Any]:
    path = _job_path(job_id)
    if not path.is_file():
        raise ValueError("Render job not found.")
    return json.loads(path.read_text(encoding="utf-8"))


def _iter_job_records() -> Iterable[tuple[Path, dict[str, Any]]]:
    jobs_dir = _jobs_dir()
    if not jobs_dir.exists():
        return
    for path in jobs_dir.glob("*.json"):
        try:
            _validate_job_id(path.stem)
            job = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        yield path, job


def _public_asset_url(job_id: str, filename: str) -> str:
    base = os.getenv("APP_BASE_URL", "").strip().rstrip("/")
    path = f"/generated-assets/{job_id}/{filename}"
    return f"{base}{path}" if base else path


def _public_job(job: dict[str, Any]) -> dict[str, Any]:
    published = json.loads(json.dumps(job, ensure_ascii=False))
    for asset in published.get("assets", []):
        filename = asset.get("filename")
        if filename:
            asset["asset_url"] = _public_asset_url(str(published["job_id"]), str(filename))
    return published


def _update_job(job_id: str, **updates: Any) -> dict[str, Any]:
    job = _read_job(job_id)
    job.update(updates)
    job["updated_at"] = _iso(_utcnow())
    _write_job(job)
    return job


def _job_artifact_bytes(job_id: str) -> int:
    try:
        _validate_job_id(job_id)
    except ValueError:
        return 0
    total = 0
    job_path = _job_path(job_id)
    if job_path.is_file():
        total += job_path.stat().st_size
    asset_dir = _assets_dir() / job_id
    if asset_dir.exists():
        for path in asset_dir.rglob("*"):
            if path.is_file():
                total += path.stat().st_size
    return total


def _delete_job_artifacts(job_id: str) -> None:
    _validate_job_id(job_id)
    _job_path(job_id).unlink(missing_ok=True)
    shutil.rmtree(_assets_dir() / job_id, ignore_errors=True)


def _cleanup_storage_quota() -> None:
    max_bytes = _max_retained_bytes()
    records: list[tuple[datetime, str, str, int]] = []
    total = 0
    for path, job in _iter_job_records() or []:
        job_id = path.stem
        artifact_bytes = _job_artifact_bytes(job_id)
        total += artifact_bytes
        if str(job.get("status")) in {"succeeded", "failed"}:
            records.append((_parse_iso(job.get("created_at")) or datetime.min.replace(tzinfo=UTC), job_id, str(job.get("status")), artifact_bytes))
    if total <= max_bytes:
        return
    for _, job_id, _, artifact_bytes in sorted(records):
        _delete_job_artifacts(job_id)
        total -= artifact_bytes
        if total <= max_bytes:
            break


def _cleanup_expired_assets() -> None:
    now = _utcnow()
    for path, job in _iter_job_records() or []:
        expires_at = _parse_iso(job.get("expires_at"))
        if expires_at and expires_at <= now:
            _delete_job_artifacts(path.stem)
    _cleanup_storage_quota()


def cleanup_expired_render_assets() -> None:
    _cleanup_expired_assets()


def recover_interrupted_render_jobs() -> None:
    _cleanup_expired_assets()
    for path, job in _iter_job_records() or []:
        if str(job.get("status")) not in {"queued", "running"}:
            continue
        try:
            _update_job(
                path.stem,
                status="failed",
                error="Render job was interrupted by a server restart before completion.",
            )
        except Exception:
            continue


def _render_options(args: dict[str, Any]) -> dict[str, Any]:
    size = str(args.get("size") or "1024x1024")
    quality = str(args.get("quality") or "medium")
    output_format = str(args.get("output_format") or "png").lower()
    background = str(args.get("background") or "auto")
    model = _image_model(args.get("model"))
    if size not in SUPPORTED_RENDER_SIZES:
        raise ValueError(f"Unsupported render size: {size}")
    if quality not in SUPPORTED_RENDER_QUALITIES:
        raise ValueError(f"Unsupported render quality: {quality}")
    if output_format not in SUPPORTED_OUTPUT_FORMATS:
        raise ValueError(f"Unsupported output format: {output_format}")
    if background not in SUPPORTED_BACKGROUNDS:
        raise ValueError(f"Unsupported background: {background}")
    if background == "transparent" and output_format == "jpeg":
        raise ValueError("Transparent background requires PNG or WebP output.")
    if background == "transparent" and model == "gpt-image-2":
        raise ValueError("Transparent background is not supported with gpt-image-2.")
    return {
        "model": model,
        "size": size,
        "quality": quality,
        "output_format": output_format,
        "background": background,
    }


def _string_list_payload(value: Any, *, limit: int, item_limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [compact_text(item, item_limit) for item in value if compact_text(item, item_limit)][:limit]


def _brief_payload(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    payload: dict[str, Any] = {}
    for key, limit in {
        "name": 120,
        "sector": 160,
        "promise": 1000,
        "audience": 400,
        "risk_tolerance": 120,
    }.items():
        text = compact_text(value.get(key), limit)
        if text:
            payload[key] = text
    traits = _string_list_payload(value.get("traits"), limit=8, item_limit=100)
    must_avoid = _string_list_payload(value.get("must_avoid"), limit=8, item_limit=100)
    if traits:
        payload["traits"] = traits
    if must_avoid:
        payload["must_avoid"] = must_avoid
    return payload


def _ensure_job_payload_size(payload: dict[str, Any]) -> dict[str, Any]:
    size = len(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    if size > MAX_RENDER_METADATA_BYTES:
        raise ValueError("Render metadata exceeds the maximum persisted size.")
    return payload


def _route_payload(args: dict[str, Any]) -> dict[str, Any]:
    route = args.get("route") if isinstance(args.get("route"), dict) else {}
    prompt = compact_text(args.get("concept_board_prompt") or route.get("concept_board_prompt"), MAX_RENDER_PROMPT_CHARS)
    if len(prompt) < 24:
        raise ValueError("concept_board_prompt is required and must describe the board to render.")
    evaluation_focus = args.get("evaluation_focus") or route.get("board_evaluation_focus") or []
    return {
        "route_id": _safe_slug(args.get("route_id") or route.get("id") or "custom", "custom"),
        "route_name": compact_text(args.get("route_name") or route.get("name") or "Concept board", 160),
        "concept_board_prompt": prompt,
        "evaluation_focus": [compact_text(item, 220) for item in evaluation_focus if compact_text(item, 220)][:6],
        "brief": _brief_payload(args.get("brief")),
    }


def _workflow_render_payload(directions: dict[str, Any]) -> dict[str, Any]:
    routes = []
    for index, route in enumerate(directions.get("routes", []), start=1):
        prompt = compact_text(route.get("concept_board_prompt"), MAX_RENDER_PROMPT_CHARS)
        if len(prompt) < 24:
            raise ValueError("Generated route is missing a renderable concept_board_prompt.")
        routes.append(
            {
                "id": _safe_slug(route.get("id") or f"route-{index}", f"route-{index}"),
                "name": compact_text(route.get("name") or f"Route {index}", 160),
                "concept_board_prompt": prompt,
                "board_evaluation_focus": _string_list_payload(route.get("board_evaluation_focus"), limit=6, item_limit=220),
            }
        )
    return {
        "brief": _brief_payload(directions.get("brief")),
        "directions": {"routes": routes},
    }


def _new_job(kind: str, *, provider: str, options: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    now = _utcnow()
    job_id = _new_job_id("render" if kind == "render" else "workflow")
    payload = _ensure_job_payload_size(payload)
    return {
        "job_id": job_id,
        "kind": kind,
        "status": "queued",
        "created_at": _iso(now),
        "updated_at": _iso(now),
        "expires_at": _iso(now + timedelta(hours=_retention_hours())),
        "provider": provider,
        "options": options,
        "progress": {"completed": 0, "total": 1 if kind == "render" else 3},
        "input": payload,
        "assets": [],
        "evaluations": [],
        "error": "",
        "retention": {
            "hours": _retention_hours(),
            "policy": "Generated job metadata and image assets are removed after the configured retention window.",
        },
    }


def _track_task(task: asyncio.Task[Any]) -> None:
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


def _provider_note(provider: str) -> str:
    if provider == "mock":
        return "mock provider for local validation; no external image API call was made"
    return "OpenAI Images API generation request"


def _job_render_cost(job: dict[str, Any]) -> int:
    if str(job.get("kind")) == "workflow":
        total = job.get("progress", {}).get("total") if isinstance(job.get("progress"), dict) else None
        return max(1, int(total or 3))
    return 1


def _enforce_render_abuse_controls(kind: str, provider: str) -> None:
    if provider != "openai":
        return
    queued_or_running = 0
    daily_images = 0
    day_start = _utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    for _, job in _iter_job_records() or []:
        if str(job.get("provider")) != "openai":
            continue
        if str(job.get("status")) in {"queued", "running"}:
            queued_or_running += 1
        created_at = _parse_iso(job.get("created_at"))
        if created_at and created_at >= day_start:
            daily_images += _job_render_cost(job)
    requested_images = 3 if kind == "workflow" else 1
    if queued_or_running >= _render_max_concurrent_jobs():
        raise ValueError("Render concurrency limit reached; poll existing jobs before starting another paid render.")
    if daily_images + requested_images > _render_daily_image_limit():
        raise ValueError("Daily paid render quota reached for this deployment.")


def generation_runtime_summary() -> dict[str, Any]:
    provider = _provider()
    warnings = [
        warning
        for warning in (
            _numeric_env_warning("GENERATED_ASSET_RETENTION_HOURS", DEFAULT_ASSET_RETENTION_HOURS),
            _numeric_env_warning("IMAGE_GENERATION_TIMEOUT_SECONDS", 120),
            _numeric_env_warning("GENERATED_ASSET_MAX_BYTES", DEFAULT_GENERATED_ASSET_MAX_BYTES),
            _numeric_env_warning("RENDER_DAILY_IMAGE_LIMIT", DEFAULT_RENDER_DAILY_IMAGE_LIMIT),
            _numeric_env_warning("RENDER_MAX_CONCURRENT_JOBS", DEFAULT_RENDER_MAX_CONCURRENT_JOBS),
        )
        if warning
    ]
    return {
        "provider": provider,
        "model": _image_model(),
        "retention_hours": _retention_hours(),
        "storage": {
            "backend": "filesystem",
            "cleanup": "startup, render enqueue, status polling, and generated-asset requests",
            "max_retained_bytes": _max_retained_bytes(),
        },
        "abuse_controls": {
            "max_concurrent_jobs": _render_max_concurrent_jobs(),
            "daily_image_limit": _render_daily_image_limit(),
        },
        "openai_key_configured": bool(os.getenv("OPENAI_API_KEY", "").strip()) if provider == "openai" else False,
        "configuration_warnings": warnings,
    }


def _parse_dimensions(size: str) -> tuple[int, int]:
    if size == "1536x1024":
        return 1536, 1024
    if size == "1024x1536":
        return 1024, 1536
    return 1024, 1024


def _mock_render_bytes(prompt: str, options: dict[str, Any], route_id: str, route_name: str) -> bytes:
    width, height = _parse_dimensions(str(options.get("size") or "1024x1024"))
    seed = hashlib.sha256(f"{prompt}|{route_id}|{route_name}".encode()).digest()
    colours = [
        tuple(seed[i] for i in range(0, 3)),
        tuple(seed[i] for i in range(3, 6)),
        tuple(seed[i] for i in range(6, 9)),
    ]
    im = Image.new("RGB", (width, height), "#f2efe6")
    draw = ImageDraw.Draw(im)
    margin = max(54, width // 18)
    draw.rectangle((margin, margin, width - margin, height - margin), outline="#151712", width=max(4, width // 180))
    for index, colour in enumerate(colours):
        x0 = margin + (index * width // 7) + seed[10 + index] * width // 900
        y0 = margin + (index * height // 9) + seed[13 + index] * height // 950
        x1 = min(width - margin, x0 + width // (3 + index))
        y1 = min(height - margin, y0 + height // (4 + index))
        fill = "#{:02x}{:02x}{:02x}".format(*colour)
        if index == 0:
            draw.rounded_rectangle((x0, y0, x1, y1), radius=width // 28, fill=fill)
        elif index == 1:
            draw.ellipse((x0, y0, x1, y1), fill=fill)
        else:
            draw.polygon([(x0, y1), ((x0 + x1) // 2, y0), (x1, y1), ((x0 + x1) // 2, min(height - margin, y1 + height // 8))], fill=fill)
    strip_top = height - margin - height // 8
    for index, size in enumerate((48, 24, 12)):
        box = margin + index * width // 10
        draw.rectangle((box, strip_top, box + width // 18, strip_top + width // 18), fill="#151712")
        draw.text((box, strip_top + width // 16), f"{size}px", fill="#151712")
    draw.text((margin, margin // 2), compact_text(route_name, 52), fill="#151712")
    draw.text((margin, height - margin // 2), f"Mock concept board · {route_id}", fill="#151712")
    out = io.BytesIO()
    fmt = "JPEG" if options.get("output_format") == "jpeg" else str(options.get("output_format") or "png").upper()
    im.save(out, format=fmt, quality=92)
    return out.getvalue()


async def _openai_render_bytes(prompt: str, options: dict[str, Any]) -> bytes:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for IMAGE_GENERATION_PROVIDER=openai.")
    body = {
        "model": options["model"],
        "prompt": prompt,
        "n": 1,
        "size": options["size"],
        "quality": options["quality"],
        "output_format": options["output_format"],
        "background": options["background"],
        "moderation": "auto",
    }
    timeout = httpx.Timeout(_generation_timeout(), connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            OPENAI_IMAGE_GENERATIONS_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=body,
        )
    if response.status_code >= 400:
        try:
            error_message = response.json().get("error", {}).get("message") or response.text
        except Exception:
            error_message = response.text
        raise RuntimeError(f"OpenAI image generation failed: {compact_text(error_message, 500)}")
    data = response.json()
    items = data.get("data") or []
    if not items or not isinstance(items[0], dict) or not items[0].get("b64_json"):
        raise RuntimeError("OpenAI image generation did not return base64 image data.")
    return _base64_decode(str(items[0]["b64_json"]))


def _base64_decode(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except Exception as exc:
        raise RuntimeError("Image API response contained invalid base64 data.") from exc


async def _render_bytes(prompt: str, options: dict[str, Any], provider: str, route_id: str, route_name: str) -> bytes:
    if provider == "mock":
        return await asyncio.to_thread(_mock_render_bytes, prompt, options, route_id, route_name)
    if provider != "openai":
        raise ValueError(f"Unsupported image generation provider: {provider}")
    return await _openai_render_bytes(prompt, options)


def _normalized_image_format(value: Any) -> str:
    output = str(value or "").lower()
    if output in {"jpg", "jpeg"}:
        return "jpeg"
    return output if output in SUPPORTED_OUTPUT_FORMATS else ""


def _image_has_alpha(image: Image.Image) -> bool:
    return image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info)


def _store_asset(job_id: str, image_bytes: bytes, options: dict[str, Any], route: dict[str, Any]) -> dict[str, Any]:
    Image.MAX_IMAGE_PIXELS = 50_000_000
    with Image.open(io.BytesIO(image_bytes)) as image:
        image.load()
        detected_format = _normalized_image_format(image.format) or _normalized_image_format(options.get("output_format")) or "png"
        keep_alpha = (
            str(options.get("background")) == "transparent"
            and detected_format in {"png", "webp"}
            and _image_has_alpha(image)
        )
        converted = image.convert("RGBA" if keep_alpha else "RGB")
        width, height = converted.size
        out = io.BytesIO()
        fmt = "JPEG" if detected_format == "jpeg" else detected_format.upper()
        converted.save(out, format=fmt, quality=92)
        payload = out.getvalue()
    digest = hashlib.sha256(payload).hexdigest()
    extension = "jpg" if detected_format == "jpeg" else detected_format
    filename = f"{digest[:24]}.{extension}"
    directory = _assets_dir() / job_id
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / filename
    path.write_bytes(payload)
    mime_type = "image/jpeg" if detected_format == "jpeg" else f"image/{detected_format}"
    return {
        "asset_id": digest[:16],
        "route_id": route.get("route_id", "custom"),
        "route_name": route.get("route_name", "Concept board"),
        "filename": filename,
        "asset_url": _public_asset_url(job_id, filename),
        "mime_type": mime_type,
        "bytes": len(payload),
        "sha256": digest,
        "width": width,
        "height": height,
    }


def _asset_to_image(job_id: str, asset: dict[str, Any]) -> Image.Image:
    path = _assets_dir() / job_id / str(asset["filename"])
    with Image.open(path) as image:
        image.load()
        return image.convert("RGB")


def _critique_stored_asset(job_id: str, asset: dict[str, Any], context: str) -> dict[str, Any]:
    return critique_image(_asset_to_image(job_id, asset), context=context)


def _safe_fail_job(job_id: str, exc: Exception) -> None:
    try:
        _update_job(job_id, status="failed", error=f"{type(exc).__name__}: {exc}")
    except Exception:
        return


async def _run_render_job(job_id: str) -> None:
    try:
        job = _update_job(job_id, status="running")
        provider = str(job["provider"])
        options = dict(job["options"])
        route = dict(job["input"]["route"])
        image_bytes = await _render_bytes(route["concept_board_prompt"], options, provider, route["route_id"], route["route_name"])
        asset = await asyncio.to_thread(_store_asset, job_id, image_bytes, options, route)
        evaluation = await asyncio.to_thread(
            _critique_stored_asset,
            job_id,
            asset,
            " | ".join(route.get("evaluation_focus", [])) or route.get("route_name", ""),
        )
        _update_job(
            job_id,
            status="succeeded",
            assets=[asset],
            evaluations=[{"route_id": route["route_id"], "asset_id": asset["asset_id"], "critique": evaluation}],
            progress={"completed": 1, "total": 1},
            provider_note=_provider_note(provider),
        )
    except Exception as exc:
        _safe_fail_job(job_id, exc)


async def _run_workflow_job(job_id: str) -> None:
    try:
        job = _update_job(job_id, status="running")
        provider = str(job["provider"])
        options = dict(job["options"])
        routes = list(job["input"]["directions"].get("routes", []))
        assets: list[dict[str, Any]] = []
        evaluations: list[dict[str, Any]] = []
        for index, route in enumerate(routes, start=1):
            route_payload = {
                "route_id": _safe_slug(route.get("id") or f"route-{index}", f"route-{index}"),
                "route_name": compact_text(route.get("name") or f"Route {index}", 160),
                "concept_board_prompt": route["concept_board_prompt"],
                "evaluation_focus": route.get("board_evaluation_focus", []),
            }
            image_bytes = await _render_bytes(
                route_payload["concept_board_prompt"],
                options,
                provider,
                route_payload["route_id"],
                route_payload["route_name"],
            )
            asset = await asyncio.to_thread(_store_asset, job_id, image_bytes, options, route_payload)
            assets.append(asset)
            critique = await asyncio.to_thread(
                _critique_stored_asset,
                job_id,
                asset,
                " | ".join(route_payload.get("evaluation_focus", [])) or route_payload["route_name"],
            )
            evaluations.append(
                {
                    "route_id": route_payload["route_id"],
                    "asset_id": asset["asset_id"],
                    "critique": critique,
                }
            )
            _update_job(job_id, assets=assets, evaluations=evaluations, progress={"completed": index, "total": len(routes)})
        _update_job(job_id, status="succeeded", provider_note=_provider_note(provider), progress={"completed": len(routes), "total": len(routes)})
    except Exception as exc:
        _safe_fail_job(job_id, exc)


async def render_brand_direction(args: dict[str, Any]) -> dict[str, Any]:
    _cleanup_expired_assets()
    provider = _provider()
    options = _render_options(args)
    _enforce_render_abuse_controls("render", provider)
    route = _route_payload(args)
    job = _new_job(
        "render",
        provider=provider,
        options=options,
        payload={"route": route},
    )
    _write_job(job)
    _track_task(asyncio.create_task(_run_render_job(job["job_id"])))
    return _public_job(job)


async def run_brand_workflow(args: dict[str, Any]) -> dict[str, Any]:
    _cleanup_expired_assets()
    provider = _provider()
    options = _render_options(args)
    _enforce_render_abuse_controls("workflow", provider)
    directions = generate_directions(args)
    job = _new_job(
        "workflow",
        provider=provider,
        options=options,
        payload=_workflow_render_payload(directions),
    )
    _write_job(job)
    _track_task(asyncio.create_task(_run_workflow_job(job["job_id"])))
    return _public_job(job)


def get_render_job(job_id: str) -> dict[str, Any]:
    job = _read_job(job_id)
    expires_at = _parse_iso(job.get("expires_at"))
    if expires_at and expires_at <= _utcnow():
        _delete_job_artifacts(job_id)
        raise ValueError("Render job has expired.")
    _cleanup_expired_assets()
    return _public_job(job)


def resolve_generated_asset_path(job_id: str, filename: str) -> tuple[Path, str]:
    _validate_job_id(job_id)
    _validate_filename(filename)
    job = get_render_job(job_id)
    asset = next((item for item in job.get("assets", []) if item.get("filename") == filename), None)
    if not asset:
        raise ValueError("Generated asset not found.")
    path = (_assets_dir() / job_id / filename).resolve()
    root = (_assets_dir() / job_id).resolve()
    if root not in path.parents or not path.is_file():
        raise ValueError("Generated asset not found.")
    return path, str(asset.get("mime_type") or "application/octet-stream")


@dataclass(frozen=True)
class ImageInput:
    download_url: str
    file_id: str
    mime_type: str = ""
    file_name: str = ""


def _validate_public_https_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Seules les URL HTTPS sans identifiants intégrés sont acceptées.")
    host = parsed.hostname.casefold()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise ValueError("Les URL de fichiers locaux ne sont pas acceptées.")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None and not literal.is_global:
        raise ValueError("Les adresses réseau privées ou réservées ne sont pas acceptées.")
    # DNS rebinding guard: reject resolved private/reserved addresses.
    try:
        for info in socket.getaddrinfo(host, parsed.port or 443, type=socket.SOCK_STREAM):
            address = ipaddress.ip_address(info[4][0])
            if not address.is_global:
                raise ValueError("L’URL du fichier pointe vers une adresse réseau non publique.")
    except socket.gaierror as exc:
        raise ValueError("Le nom d’hôte du fichier ne peut pas être résolu de façon sûre.") from exc


async def download_image(file_value: dict[str, Any]) -> Image.Image:
    deadline = time.monotonic() + IMAGE_DOWNLOAD_TOTAL_DEADLINE_SECONDS
    image_input = ImageInput(
        download_url=str(file_value.get("download_url") or ""),
        file_id=str(file_value.get("file_id") or ""),
        mime_type=str(file_value.get("mime_type") or ""),
        file_name=str(file_value.get("file_name") or ""),
    )
    if not image_input.download_url or not image_input.file_id:
        raise ValueError("File values must include download_url and file_id.")
    if image_input.mime_type and image_input.mime_type.casefold() not in ALLOWED_IMAGE_MIME_TYPES:
        raise ValueError(f"Unsupported image MIME type: {image_input.mime_type}")
    _validate_public_https_url(image_input.download_url)
    current_url = image_input.download_url
    chunks: list[bytes] = []
    async with httpx.AsyncClient(follow_redirects=False) as client:
        for _ in range(5):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ValueError("Le téléchargement de l’image a dépassé la limite de 20 secondes.")
            _validate_public_https_url(current_url)
            timeout = httpx.Timeout(remaining, connect=min(IMAGE_DOWNLOAD_CONNECT_TIMEOUT_SECONDS, remaining))
            async with client.stream("GET", current_url, headers={"Accept": "image/*"}, timeout=timeout) as response:
                if time.monotonic() > deadline:
                    raise ValueError("Le téléchargement de l’image a dépassé la limite de 20 secondes.")
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("La redirection du fichier ne fournit aucune destination.")
                    current_url = urljoin(current_url, location)
                    _validate_public_https_url(current_url)
                    continue
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";", 1)[0].casefold()
                if content_type and content_type not in ALLOWED_IMAGE_MIME_TYPES:
                    raise ValueError(f"Le fichier téléchargé n’est pas une image prise en charge : {content_type}")
                content_length = response.headers.get("content-length")
                if content_length and content_length.isdigit() and int(content_length) > MAX_FILE_BYTES:
                    raise ValueError("L’image dépasse la limite de traitement de 12 Mo.")
                total = 0
                async for chunk in response.aiter_bytes():
                    if time.monotonic() > deadline:
                        raise ValueError("Le téléchargement de l’image a dépassé la limite de 20 secondes.")
                    total += len(chunk)
                    if total > MAX_FILE_BYTES:
                        raise ValueError("L’image dépasse la limite de traitement de 12 Mo.")
                    chunks.append(chunk)
                break
        else:
            raise ValueError("Le téléchargement de l’image comporte trop de redirections.")
    try:
        Image.MAX_IMAGE_PIXELS = 50_000_000
        image = Image.open(io.BytesIO(b"".join(chunks)))
        if image.width > 8192 or image.height > 8192 or image.width * image.height > 50_000_000:
            raise ValueError("Les dimensions de l’image dépassent la limite de traitement.")
        image.load()
        return ImageOps.exif_transpose(image).convert("RGB")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Le fichier téléchargé n’est pas une image lisible.") from exc


def _resize_gray(image: Image.Image, size: tuple[int, int]) -> np.ndarray:
    return np.asarray(ImageOps.grayscale(image).resize(size, Image.Resampling.LANCZOS), dtype=np.float32) / 255.0


def _average_hash(image: Image.Image, size: int = 16) -> np.ndarray:
    gray = _resize_gray(image, (size, size))
    return gray >= gray.mean()


def _difference_hash(image: Image.Image, size: int = 16) -> np.ndarray:
    gray = _resize_gray(image, (size + 1, size))
    return gray[:, 1:] >= gray[:, :-1]


def _hamming_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(1.0 - np.mean(left != right))


def _edge_map(gray: np.ndarray) -> np.ndarray:
    gx = np.abs(np.diff(gray, axis=1, prepend=gray[:, :1]))
    gy = np.abs(np.diff(gray, axis=0, prepend=gray[:1, :]))
    return np.clip(gx + gy, 0.0, 1.0)


def _mask(gray: np.ndarray) -> np.ndarray:
    # Choose the foreground polarity that occupies less area, common for logos.
    threshold = float(np.median(gray))
    dark = gray < threshold
    light = gray > threshold
    candidate = dark if dark.mean() <= light.mean() else light
    occupancy = candidate.mean()
    if occupancy < 0.02 or occupancy > 0.98:
        candidate = gray < gray.mean()
    return candidate


def _centroid(mask: np.ndarray) -> tuple[float, float]:
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return 0.5, 0.5
    return float(xs.mean() / max(mask.shape[1] - 1, 1)), float(ys.mean() / max(mask.shape[0] - 1, 1))


def _histogram(image: Image.Image, bins: int = 8) -> np.ndarray:
    arr = np.asarray(image.resize((96, 96), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    hist_parts = []
    for channel in range(3):
        hist, _ = np.histogram(arr[:, :, channel], bins=bins, range=(0, 1), density=False)
        hist_parts.append(hist.astype(np.float32))
    vector = np.concatenate(hist_parts)
    total = vector.sum() or 1.0
    return vector / total


def _cosine(left: np.ndarray, right: np.ndarray) -> float:
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    return float(np.dot(left, right) / denominator) if denominator else 0.0


def image_metrics(image: Image.Image) -> dict[str, Any]:
    rgb = image.convert("RGB")
    gray = _resize_gray(rgb, (256, 256))
    small = _resize_gray(rgb, (32, 32))
    mask = _mask(gray)
    mask_small = _mask(small)
    mask_small_up = np.asarray(Image.fromarray((mask_small * 255).astype(np.uint8)).resize((256, 256), Image.Resampling.NEAREST)) > 127
    intersection = np.logical_and(mask, mask_small_up).sum()
    union = np.logical_or(mask, mask_small_up).sum() or 1
    edge = _edge_map(gray)
    occupancy = float(mask.mean())
    cx, cy = _centroid(mask)
    contrast = float(gray.std())
    edge_density = float((edge > 0.12).mean())
    entropy_hist, _ = np.histogram(gray, bins=32, range=(0, 1), density=True)
    probabilities = entropy_hist / (entropy_hist.sum() or 1.0)
    entropy = float(-(probabilities[probabilities > 0] * np.log2(probabilities[probabilities > 0])).sum() / 5.0)
    # Saliency concentration: share of gradient energy in the strongest 20% of cells.
    cells = edge.reshape(16, 16, 16, 16).mean(axis=(1, 3)).flatten()
    sorted_cells = np.sort(cells)[::-1]
    saliency_concentration = float(sorted_cells[: max(1, len(sorted_cells) // 5)].sum() / (sorted_cells.sum() or 1.0))
    quadrant = [
        float(mask[:128, :128].mean()),
        float(mask[:128, 128:].mean()),
        float(mask[128:, :128].mean()),
        float(mask[128:, 128:].mean()),
    ]
    balance = 1.0 - min(float(statistics.pstdev(quadrant)) * 3.2, 1.0)
    return {
        "width": rgb.width,
        "height": rgb.height,
        "aspect_ratio": round(rgb.width / max(rgb.height, 1), 4),
        "contrast": round(contrast, 4),
        "edge_density": round(edge_density, 4),
        "entropy": round(entropy, 4),
        "foreground_occupancy": round(occupancy, 4),
        "centroid": {"x": round(cx, 4), "y": round(cy, 4)},
        "balance": round(balance, 4),
        "small_size_stability": round(float(intersection / union), 4),
        "saliency_concentration": round(saliency_concentration, 4),
        "average_hash": _average_hash(rgb).astype(np.uint8).flatten().tolist(),
        "difference_hash": _difference_hash(rgb).astype(np.uint8).flatten().tolist(),
        "colour_histogram": _histogram(rgb).round(6).tolist(),
    }


def _clamp_score(value: float) -> float:
    return max(0.0, min(20.0, value))


def critique_image(image: Image.Image, *, reference: Image.Image | None = None, context: str = "") -> dict[str, Any]:
    m = image_metrics(image)
    occupancy = m["foreground_occupancy"]
    centroid_distance = math.dist((m["centroid"]["x"], m["centroid"]["y"]), (0.5, 0.5))
    composition = _clamp_score(20 * (0.42 * m["balance"] + 0.28 * (1 - min(centroid_distance / 0.55, 1)) + 0.30 * (1 - min(abs(occupancy - 0.38) / 0.5, 1))))
    hierarchy = _clamp_score(20 * (0.60 * min(m["saliency_concentration"] / 0.55, 1) + 0.40 * (1 - min(abs(m["edge_density"] - 0.18) / 0.35, 1))))
    legibility = _clamp_score(20 * (0.55 * min(m["contrast"] / 0.30, 1) + 0.45 * m["small_size_stability"]))
    complexity_fit = 1 - min(abs(m["edge_density"] - 0.16) / 0.32, 1)
    memorability = _clamp_score(20 * (0.45 * complexity_fit + 0.30 * min(m["entropy"] / 0.78, 1) + 0.25 * min(m["saliency_concentration"] / 0.55, 1)))
    comparison = compare_images(image, reference) if reference is not None else None
    if comparison:
        differentiation = _clamp_score(20 * (1 - comparison["risk_score"] / 100))
        diff_confidence = "élevée"
    else:
        differentiation = _clamp_score(20 * (0.45 * complexity_fit + 0.35 * (1 - min(abs(occupancy - 0.35) / 0.55, 1)) + 0.20 * min(m["entropy"] / 0.8, 1)))
        diff_confidence = "faible; aucune référence fournie"
    axes = {
        "beaux_arts": {"label": "Beaux-arts / composition", "score": round(composition, 1)},
        "hierarchy": {"label": "Hiérarchie visuelle", "score": round(hierarchy, 1)},
        "legibility": {"label": "Lisibilité et réduction", "score": round(legibility, 1)},
        "memorability": {"label": "Mémorisation", "score": round(memorability, 1)},
        "differentiation": {"label": "Différenciation", "score": round(differentiation, 1), "confidence": diff_confidence},
    }
    total = round(sum(axis["score"] for axis in axes.values()), 1)
    weaknesses = sorted(axes.items(), key=lambda pair: pair[1]["score"])[:2]
    actions = []
    mapping = {
        "beaux_arts": "Reconstruire en noir et blanc avec une masse dominante, une contreforme et un centre visuel délibéré.",
        "hierarchy": "Créer trois variantes qui changent volontairement le premier point d’attention; tester en vignette et à deux mètres.",
        "legibility": "Retirer les détails qui s’effondrent à 24 px, puis vérifier les versions monochrome, floutée, gravée et inversée.",
        "memorability": "Réduire l’idée à un contour redessinable après deux secondes d’exposition; conserver une seule anomalie contrôlée.",
        "differentiation": "Changer la silhouette, la topologie, la typographie, le comportement chromatique et la composition — pas seulement le style de surface.",
    }
    for key, _ in weaknesses:
        actions.append(mapping[key])
    return {
        "context": compact_text(context, 500),
        "score": total,
        "grade": "A" if total >= 86 else "B" if total >= 72 else "C" if total >= 58 else "D",
        "axes": axes,
        "technical_metrics": {key: value for key, value in m.items() if key not in {"average_hash", "difference_hash", "colour_histogram"}},
        "priority_actions": actions,
        "reference_comparison": comparison,
        "method_note": "Les mesures techniques soutiennent la critique; elles ne remplacent ni le jugement humain, ni les tests utilisateurs, ni la recherche de marques, ni l’examen juridique.",
    }


def compare_images(left: Image.Image, right: Image.Image | None) -> dict[str, Any]:
    if right is None:
        raise ValueError("Une image de référence est requise pour la comparaison.")
    lm = image_metrics(left)
    rm = image_metrics(right)
    ah = _hamming_similarity(np.array(lm["average_hash"], dtype=bool), np.array(rm["average_hash"], dtype=bool))
    dh = _hamming_similarity(np.array(lm["difference_hash"], dtype=bool), np.array(rm["difference_hash"], dtype=bool))
    colour = max(0.0, min(1.0, _cosine(np.array(lm["colour_histogram"]), np.array(rm["colour_histogram"]))))
    occupancy = 1 - min(abs(lm["foreground_occupancy"] - rm["foreground_occupancy"]) / 0.65, 1)
    centroid = 1 - min(math.dist((lm["centroid"]["x"], lm["centroid"]["y"]), (rm["centroid"]["x"], rm["centroid"]["y"])) / 0.7, 1)
    edge = 1 - min(abs(lm["edge_density"] - rm["edge_density"]) / 0.45, 1)
    stability = 1 - min(abs(lm["small_size_stability"] - rm["small_size_stability"]) / 0.8, 1)
    components = {
        "silhouette_hash": round(100 * ah, 1),
        "edge_hash": round(100 * dh, 1),
        "colour_distribution": round(100 * colour, 1),
        "mass_occupancy": round(100 * occupancy, 1),
        "composition_centroid": round(100 * centroid, 1),
        "edge_density": round(100 * edge, 1),
        "small_size_behaviour": round(100 * stability, 1),
    }
    risk = round(100 * (0.26 * ah + 0.18 * dh + 0.10 * colour + 0.14 * occupancy + 0.12 * centroid + 0.10 * edge + 0.10 * stability), 1)
    band = "très élevé" if risk >= 82 else "élevé" if risk >= 68 else "accru" if risk >= 52 else "modéré" if risk >= 35 else "faible"
    strongest = sorted(components.items(), key=lambda pair: pair[1], reverse=True)[:3]
    transformations = []
    if ah >= 0.70:
        transformations.append("Changer le contour extérieur, l’axe et les terminaisons jusqu’à ce que la silhouette diverge sous les tests de flou et de monochrome.")
    if dh >= 0.70 or edge >= 0.75:
        transformations.append("Reconstruire la topologie interne et l’espace négatif; ne pas conserver les mêmes ouvertures, découpes ou rythmes directionnels.")
    if colour >= 0.82:
        transformations.append("Tester un comportement chromatique structurellement différent et valider le dessin en monochrome afin que la couleur ne soit pas la seule distinction.")
    if centroid >= 0.82 and occupancy >= 0.82:
        transformations.append("Changer la composition, le rapport d’aspect, les relations d’échelle et le placement des masses plutôt que de simplement redessiner les détails.")
    if not transformations:
        transformations.append("Continuer de documenter une dérivation indépendante et effectuer malgré tout une recherche professionnelle de marques et de risque de confusion avant le lancement.")
    return {
        "risk_score": risk,
        "risk_band": band,
        "components": components,
        "strongest_convergences": [{"dimension": name, "score": score} for name, score in strongest],
        "recommended_transformations": transformations,
        "legal_note": "Il s’agit d’un triage perceptuel, non d’une autorisation de marque ni d’un avis juridique. Le risque de similarité dépend aussi du secteur, du territoire, du public, du contexte d’usage et des droits protégés.",
    }


def coach_decision(question: str, critique: dict[str, Any] | None = None, goal: str = "improve the next iteration") -> dict[str, Any]:
    question = compact_text(question, 1800)
    goal = compact_text(goal, 400)
    axes = (critique or {}).get("axes", {}) if isinstance(critique, dict) else {}
    ranked = sorted(
        [(key, value) for key, value in axes.items() if isinstance(value, dict) and isinstance(value.get("score"), (int, float))],
        key=lambda pair: pair[1]["score"],
    )
    weakest = ranked[:2]
    exercises = {
        "beaux_arts": "Produire six vignettes noir et blanc de 4 cm. Utiliser une masse dominante, une contreforme et aucun effet.",
        "hierarchy": "Construire trois versions avec des ordres de lecture volontairement différents. Demander à trois personnes ce qu’elles ont vu en premier.",
        "legibility": "Tester à 16, 24 et 48 px, en monochrome, flou, réserve, gravure et découpe vinyle.",
        "memorability": "Montrer le signe pendant deux secondes, le masquer, puis faire redessiner uniquement le contour extérieur et un trait interne.",
        "differentiation": "Placer la référence la plus proche à côté en gris; changer contour, topologie, construction typographique et composition jusqu’à disparition de la ressemblance cumulative.",
    }
    criteria = {
        "beaux_arts": "La composition reste stable en aplats, avec un point d’entrée clair et une zone de repos volontaire.",
        "hierarchy": "Trois personnes sur trois identifient le même premier élément sans explication.",
        "legibility": "Le noyau reste identifiable à 24 px et en monochrome.",
        "memorability": "Une personne peut rappeler le contour principal après deux secondes d’exposition.",
        "differentiation": "Aucune convergence cumulative forte ne subsiste entre silhouette, topologie, typographie, comportement chromatique et composition.",
    }
    if weakest:
        diagnosis = "La prochaine itération doit isoler " + " et ".join(value.get("label", key) for key, value in weakest) + ", plutôt que de tout redessiner en même temps."
        plan = [exercises[key] for key, _ in weakest if key in exercises]
        acceptance = [criteria[key] for key, _ in weakest if key in criteria]
    else:
        diagnosis = "Aucune critique chiffrée n’a été fournie. Transformer la question en une décision visuelle falsifiable avant de raffiner le style."
        plan = ["Formuler la décision comme une hypothèse d’une phrase, puis construire trois prototypes structurellement incompatibles en noir et blanc."]
        acceptance = ["La direction choisie communique la promesse visée sans explication verbale et survit à trois contextes de production."]
    return {
        "question": question,
        "goal": goal,
        "diagnosis": diagnosis,
        "why": "Une décision plus forte réduit l’ambiguïté du système visuel et rend le prochain test mesurable. La finition ne peut pas réparer une hiérarchie structurelle faible ni une topologie copiée.",
        "exercise": {"duration": "45–90 minutes", "steps": plan},
        "acceptance_criteria": acceptance,
        "coach_rule": "Défendre la décision avec des preuves observables : réduction, rappel, ordre de lecture, comportement en production et distance par rapport aux références — pas seulement avec des adjectifs.",
    }
