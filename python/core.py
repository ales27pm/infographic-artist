from __future__ import annotations

import hashlib
import io
import ipaddress
import json
import math
import random
import re
import socket
import statistics
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse

import httpx
import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MAX_RESULTS = 25
MAX_FILE_BYTES = 12 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


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
        routes.append(route)
    return {
        "brief": {"name": name, "sector": sector, "promise": promise, "audience": audience, "traits": traits, "must_avoid": avoid, "risk_tolerance": risk},
        "routes": routes,
        "decision_rule": "Prototyper les trois routes en monochrome avant d’en choisir une. Retenir celle dont la structure — et non la finition — rend la promesse la plus facile à percevoir et la plus difficile à confondre.",
    }


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
    timeout = httpx.Timeout(20.0, connect=10.0)
    current_url = image_input.download_url
    chunks: list[bytes] = []
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for _ in range(5):
            _validate_public_https_url(current_url)
            async with client.stream("GET", current_url, headers={"Accept": "image/*"}) as response:
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
