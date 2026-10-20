"""Documented principle lookup and a planning-only, eight-stage design workflow."""
from __future__ import annotations

import json
import re
import unicodedata
from copy import deepcopy
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
DESIGN_PRINCIPLES = json.loads((DATA_DIR / "design_principles.json").read_text(encoding="utf-8"))
DESIGN_WORKFLOW = json.loads((DATA_DIR / "design_workflow.json").read_text(encoding="utf-8"))
CONTEXT_FIELDS = DESIGN_WORKFLOW["context_fields"]
_SOURCES = {source["id"]: source for source in DESIGN_PRINCIPLES["sources"]}
_STOP_WORDS = {"a", "d", "de", "des", "du", "et", "la", "le", "les", "of", "the"}


def normalize_principle(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).casefold().replace("œ", "oe").replace("æ", "ae")
    text = text.replace("φ", " phi ").replace("ϕ", " phi ").replace("π", " pi ")
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _compact(value: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    return text if len(text) <= limit else text[:limit - 1].rstrip() + "…"


def _canonical_query(value: str) -> str:
    text = normalize_principle(value)
    for alias in DESIGN_WORKFLOW["search_aliases"]:
        text = re.sub(r"\b" + re.escape(alias["from"]) + r"\b", alias["to"], text)
    return text


def catalogue_counts() -> dict[str, int]:
    return {"concepts": len(DESIGN_PRINCIPLES["concepts"]), "sources": len(_SOURCES), "domains": len(DESIGN_PRINCIPLES["domains"])}


def _source_card(source: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(source)
    scope = source.get("read_level") or source.get("reading")
    documented = isinstance(scope, str) and bool(scope.strip())
    result["read_level"] = scope if documented else "Portée de lecture non renseignée dans le catalogue."
    result["read_scope_status"] = "documented" if documented else "not_recorded"
    return result


def search_principles(query: str = "", limit: int = 12) -> dict[str, Any]:
    """Return full, bounded evidence-aware cards; relevance is not scientific strength."""
    if not isinstance(query, str):
        raise ValueError("query must be a string.")
    if isinstance(limit, bool) or not isinstance(limit, int):
        raise ValueError("limit must be an integer.")
    query = _compact(query, 500)
    canonical = _canonical_query(query)
    terms = [term for term in canonical.split() if term not in _STOP_WORDS]
    ranked = []
    for concept in DESIGN_PRINCIPLES["concepts"]:
        sources = [_SOURCES[source_id] for source_id in concept.get("source_ids", [])]
        basis_label = DESIGN_PRINCIPLES["basis_labels"].get(concept["basis"], concept["basis"])
        fields = [concept.get(key) or "" for key in ("id", "name", "definition", "application", "limits", "formula", "domain", "domain_label", "basis", "verification_note")]
        fields.append(basis_label)
        fields.extend(str(source.get(key) or "") for source in sources for key in ("title", "authors", "year", "supports"))
        haystack = normalize_principle(" ".join(fields))
        if query and (not terms or not all(term in haystack for term in terms)):
            continue
        name = normalize_principle(concept["name"])
        score = (100 if canonical and canonical == normalize_principle(concept["id"]) else 0)
        score += 30 if canonical and canonical == name else 0
        score += 10 if canonical and canonical in name else 0
        score += sum(2 for term in terms if term in name)
        ranked.append((score, concept, sources, basis_label))
    ranked.sort(key=lambda item: (-item[0], item[1]["id"]))
    items = [deepcopy(concept) | {"kind": "principle", "basis_label": basis_label, "sources": [_source_card(source) for source in sources]}
             for _, concept, sources, basis_label in ranked[:max(1, min(limit, 25))]]
    return {"collection": "design_principles", "query": _compact(query, 250), "normalized_query": canonical,
            "kind": "principle", "total_matches": len(ranked), "catalogue_counts": catalogue_counts(), "items": items,
            "method_note": "Recherche documentaire : lire définition, application, limites et portée des sources. Le classement exprime une pertinence textuelle, pas une preuve d’efficacité sur le projet."}


def normalize_design_context(value: dict[str, Any] | None = None) -> dict[str, str]:
    if value is None:
        return {}
    if not isinstance(value, dict) or any(key not in CONTEXT_FIELDS for key in value):
        raise ValueError("design_context must contain only the documented context fields.")
    out = {}
    for key, text in value.items():
        if not isinstance(text, str) or len(text) > CONTEXT_FIELDS[key]["max_length"]:
            raise ValueError(f"design_context.{key} must be a string of at most {CONTEXT_FIELDS[key]['max_length']} characters.")
        clean = re.sub(r"\s+", " ", text).strip()
        if clean:
            out[key] = clean
    return out


def untested_evaluations() -> dict[str, Any]:
    return deepcopy(DESIGN_WORKFLOW["evaluations"])


def build_design_workflow(design_context: dict[str, Any] | None = None, *, declared_brief: dict[str, Any] | None = None) -> dict[str, Any]:
    brief = normalize_design_context(design_context)
    brief_sources = {key: "design_context." + key for key in brief}
    # Read only original arguments, never the defaults synthesized for creative routes.
    for target, source in (("audience", "audience"), ("message", "promise")):
        value = (declared_brief or {}).get(source)
        if target not in brief and isinstance(value, str) and value.strip():
            brief[target] = _compact(value, CONTEXT_FIELDS[target]["max_length"])
            brief_sources[target] = source
    return {
        "schema_version": DESIGN_WORKFLOW["schema_version"], "title": DESIGN_WORKFLOW["title"],
        "status": "non_testé", "scope_note": DESIGN_WORKFLOW["scope_note"],
        "brief": brief, "brief_sources": brief_sources,
        "missing_brief": [key for key in CONTEXT_FIELDS if key not in brief],
        "stages": deepcopy(DESIGN_WORKFLOW["stages"]), "evaluations": untested_evaluations(),
        "evidence_contract": deepcopy(DESIGN_WORKFLOW["evidence_contract"]),
        "principle_lookup": {"tool": "search_design_systems", "kind": "principle", "query_hint": "Utiliser un identifiant de principe ou un thème pour lire la fiche complète et ses sources."},
        "catalogue_counts": catalogue_counts(),
    }
