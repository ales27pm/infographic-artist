from __future__ import annotations

from copy import deepcopy
from typing import Any

TEMPLATE_URI = "ui://infographic-artist/app-v1.html"
MIME_TYPE = "text/html;profile=mcp-app"

SERVER_INSTRUCTIONS = (
    "Infographic Artist studies brand systems and user-supplied visual proposals. "
    "Treat iconic identities as precedents of method only. Never reproduce protected logos, "
    "signature typography, mascots, colour systems, negative-space tricks, or trade dress. "
    "Derive every direction from the user brief. Similarity scores are perceptual triage, not legal clearance. "
    "Prefer deep atlas cases over index-only entries when making historical claims. State uncertainty and request "
    "professional trademark review before commercial launch."
)

FILE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "An image file selected or uploaded in ChatGPT.",
    "properties": {
        "download_url": {"type": "string", "format": "uri", "description": "Short-lived HTTPS download URL."},
        "file_id": {"type": "string", "description": "Stable file identifier supplied by ChatGPT."},
        "mime_type": {"type": "string", "description": "MIME type when available."},
        "file_name": {"type": "string", "description": "Original file name when available."},
    },
    "required": ["download_url", "file_id"],
    "additionalProperties": False,
}

RENDER_OPTIONS_SCHEMA: dict[str, Any] = {
    "model": {
        "type": "string",
        "default": "",
        "description": "Optional OpenAI image model override. Empty uses IMAGE_GENERATION_MODEL.",
    },
    "size": {
        "type": "string",
        "enum": ["auto", "1024x1024", "1536x1024", "1024x1536"],
        "default": "1024x1024",
        "description": "Rendered image size.",
    },
    "quality": {
        "type": "string",
        "enum": ["auto", "low", "medium", "high"],
        "default": "medium",
        "description": "Image quality setting sent to the provider.",
    },
    "output_format": {
        "type": "string",
        "enum": ["png", "jpeg", "webp"],
        "default": "png",
        "description": "Stored generated-asset format.",
    },
    "background": {
        "type": "string",
        "enum": ["auto", "transparent", "opaque"],
        "default": "auto",
        "description": "Background handling for image models that support it.",
    },
}

RENDER_ROUTE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "Optional full route object returned by generate_brand_directions.",
    "properties": {
        "id": {"type": "string", "maxLength": 80},
        "name": {"type": "string", "maxLength": 160},
        "concept_board_prompt": {"type": "string", "minLength": 24, "maxLength": 32000},
        "board_evaluation_focus": {
            "type": "array",
            "items": {"type": "string", "maxLength": 220},
            "maxItems": 6,
        },
    },
    "required": ["concept_board_prompt"],
    "additionalProperties": True,
}

BRIEF_RENDER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": "Optional brief metadata to store with the render job.",
    "properties": {
        "name": {"type": "string", "maxLength": 120},
        "sector": {"type": "string", "maxLength": 160},
        "promise": {"type": "string", "maxLength": 1000},
        "audience": {"type": "string", "maxLength": 400},
        "traits": {"type": "array", "items": {"type": "string", "maxLength": 100}, "maxItems": 8},
        "must_avoid": {"type": "array", "items": {"type": "string", "maxLength": 100}, "maxItems": 8},
        "risk_tolerance": {"type": "string", "maxLength": 120},
    },
    "additionalProperties": False,
}


READ_ONLY_ANNOTATIONS = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "openWorldHint": False,
    "idempotentHint": True,
}

GENERATION_ANNOTATIONS = {
    "readOnlyHint": False,
    "destructiveHint": False,
    "openWorldHint": True,
    "idempotentHint": False,
}

def _object_schema(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required or [],
        "additionalProperties": False,
    }


def _render_direction_input_schema() -> dict[str, Any]:
    schema = _object_schema(
        {
            "route_id": {"type": "string", "default": "custom", "description": "Route identifier such as symbol, type, or system."},
            "route_name": {"type": "string", "default": "Concept board", "description": "Human-readable route name."},
            "concept_board_prompt": {
                "type": "string",
                "minLength": 24,
                "maxLength": 32000,
                "description": "Art-directed prompt returned by generate_brand_directions. Required unless route.concept_board_prompt is provided.",
            },
            "route": deepcopy(RENDER_ROUTE_SCHEMA),
            "brief": deepcopy(BRIEF_RENDER_SCHEMA),
            "evaluation_focus": {
                "type": "array",
                "items": {"type": "string", "maxLength": 220},
                "maxItems": 6,
                "default": [],
                "description": "Optional criteria to apply when evaluating the generated board.",
            },
            **deepcopy(RENDER_OPTIONS_SCHEMA),
        }
    )
    schema["anyOf"] = [{"required": ["concept_board_prompt"]}, {"required": ["route"]}]
    return schema


def _result_schema(view: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "view": {"type": "string", "const": view},
            "data": {"type": "object"},
        },
        "required": ["view", "data"],
        "additionalProperties": False,
    }


TOOL_DEFINITIONS: dict[str, dict[str, Any]] = {
    "open_brand_atlas": {
        "title": "Open the brand atlas",
        "description": (
            "Use this when the user wants to browse or search iconic identities, brand mechanisms, regions, eras, "
            "or design-system patterns. Returns compact, source-aware precedent cards; it does not return third-party artwork."
        ),
        "input": _object_schema(
            {
                "query": {"type": "string", "default": "", "description": "Concept, identity, mechanism, sector, or designer to find."},
                "region": {"type": "string", "default": "", "description": "Optional region filter."},
                "pattern": {"type": "string", "default": "", "description": "Optional brand-system pattern filter."},
                "category": {"type": "string", "default": "", "description": "Optional sector or category filter."},
                "era": {"type": "string", "default": "", "description": "Optional era filter."},
                "limit": {"type": "integer", "minimum": 1, "maximum": 25, "default": 12},
            }
        ),
        "view": "atlas",
        "invoking": "Searching the brand atlas",
        "invoked": "Brand atlas ready",
    },
    "get_brand_case": {
        "title": "Read an iconic brand case",
        "description": (
            "Use this when the user wants the mechanisms, transferable principles, stress tests, evidence level, "
            "and anti-copy boundary for one atlas identity. Use an ID returned by open_brand_atlas."
        ),
        "input": _object_schema(
            {"item_id": {"type": "string", "minLength": 1, "description": "Atlas ID or exact identity name."}},
            ["item_id"],
        ),
        "view": "case",
        "invoking": "Opening the brand case",
        "invoked": "Brand case ready",
    },
    "compare_brand_systems": {
        "title": "Compare brand systems",
        "description": (
            "Use this when the user wants to compare two to four iconic identities by mechanism, system pattern, "
            "transferable principles, collision boundaries, and production stress tests."
        ),
        "input": _object_schema(
            {
                "item_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 2,
                    "maxItems": 4,
                    "uniqueItems": True,
                    "description": "Two to four atlas IDs.",
                }
            },
            ["item_ids"],
        ),
        "view": "comparison",
        "invoking": "Comparing brand systems",
        "invoked": "Comparison ready",
    },
    "explore_brand_graph": {
        "title": "Explore the brand knowledge graph",
        "description": (
            "Use this when the user wants a navigable graph of identities, mechanisms, asset layers, studios, regions, "
            "and design systems. A query returns the matching nodes plus one-hop context."
        ),
        "input": _object_schema(
            {
                "query": {"type": "string", "default": "", "description": "Optional graph topic or node label."},
                "limit": {"type": "integer", "minimum": 20, "maximum": 120, "default": 80},
            }
        ),
        "view": "graph",
        "invoking": "Building the brand graph",
        "invoked": "Brand graph ready",
    },
    "search_design_systems": {
        "title": "Search the graphic-systems library",
        "description": (
            "Use this when the user wants methods, manuals, studios, designers, schools, or system precedents such as "
            "NASA, Braun, IBM, Pentagram, Chermayeff & Geismar, Vignelli, or Müller-Brockmann."
        ),
        "input": _object_schema(
            {
                "query": {"type": "string", "default": "", "description": "Name, method, project, or design principle."},
                "kind": {"type": "string", "default": "", "description": "Optional type filter, such as studio, manual, designer, or school."},
                "limit": {"type": "integer", "minimum": 1, "maximum": 25, "default": 12},
            }
        ),
        "view": "library",
        "invoking": "Searching graphic systems",
        "invoked": "Graphic systems ready",
    },
    "generate_brand_directions": {
        "title": "Generate original brand directions",
        "description": (
            "Use this when the user provides a brand brief and wants three structurally incompatible creative routes. "
            "The tool transfers principles, never protected forms, and includes stress tests, anti-copy rules, and "
            "plugin-ready image-generation prompts for concept boards."
        ),
        "input": _object_schema(
            {
                "name": {"type": "string", "minLength": 1, "description": "Brand or project name."},
                "sector": {"type": "string", "minLength": 1, "description": "Sector or operating context."},
                "promise": {"type": "string", "minLength": 3, "description": "What the identity must make credible or perceptible."},
                "audience": {"type": "string", "default": "public général"},
                "traits": {"type": "array", "items": {"type": "string"}, "maxItems": 8, "default": []},
                "must_avoid": {"type": "array", "items": {"type": "string"}, "maxItems": 8, "default": []},
                "risk_tolerance": {"type": "string", "default": "équilibrée"},
            },
            ["name", "sector", "promise"],
        ),
        "view": "directions",
        "invoking": "Generating original directions",
        "invoked": "Creative directions ready",
    },
    "render_brand_direction": {
        "title": "Render one brand direction",
        "description": (
            "Use this when the user wants the plugin to generate and store one concept-board image for a previously "
            "created creative route. This starts an asynchronous image-generation job that may call an external provider and incur cost."
        ),
        "input": _render_direction_input_schema(),
        "view": "render_job",
        "invoking": "Starting image render",
        "invoked": "Render job started",
        "annotations": deepcopy(GENERATION_ANNOTATIONS),
    },
    "run_brand_workflow": {
        "title": "Generate and render a brand workflow",
        "description": (
            "Use this when the user provides a brand brief and wants the plugin to generate three original directions, "
            "render all three concept boards asynchronously, store the assets, and evaluate the generated boards."
        ),
        "input": _object_schema(
            {
                "name": {"type": "string", "minLength": 1, "description": "Brand or project name."},
                "sector": {"type": "string", "minLength": 1, "description": "Sector or operating context."},
                "promise": {"type": "string", "minLength": 3, "description": "What the identity must make credible or perceptible."},
                "audience": {"type": "string", "default": "public général"},
                "traits": {"type": "array", "items": {"type": "string"}, "maxItems": 8, "default": []},
                "must_avoid": {"type": "array", "items": {"type": "string"}, "maxItems": 8, "default": []},
                "risk_tolerance": {"type": "string", "default": "équilibrée"},
                **deepcopy(RENDER_OPTIONS_SCHEMA),
            },
            ["name", "sector", "promise"],
        ),
        "view": "render_workflow",
        "invoking": "Starting brand workflow",
        "invoked": "Brand workflow started",
        "annotations": deepcopy(GENERATION_ANNOTATIONS),
    },
    "get_render_job": {
        "title": "Check render job status",
        "description": (
            "Use this when the user wants the latest status, generated-asset links, errors, retention expiry, or "
            "evaluation results for a plugin-side image rendering job."
        ),
        "input": _object_schema(
            {"job_id": {"type": "string", "minLength": 8, "description": "Render or workflow job ID returned by a rendering tool."}},
            ["job_id"],
        ),
        "view": "render_job",
        "invoking": "Checking render status",
        "invoked": "Render status ready",
        "annotations": deepcopy(READ_ONLY_ANNOTATIONS),
    },
    "critique_brand_image": {
        "title": "Critique a visual proposal",
        "description": (
            "Use this when the user supplies a logo, mark, layout, or brand proposal and wants a scored critique of "
            "composition, hierarchy, legibility, memorability, and differentiation. An optional reference improves the differentiation score."
        ),
        "input": _object_schema(
            {
                "image": deepcopy(FILE_SCHEMA),
                "reference": deepcopy(FILE_SCHEMA) | {"description": "Optional comparison image selected or uploaded in ChatGPT."},
                "context": {"type": "string", "default": "", "description": "Brief, intended use, or design question."},
            },
            ["image"],
        ),
        "view": "critique",
        "invoking": "Critiquing the proposal",
        "invoked": "Visual critique ready",
        "files": ["image", "reference"],
    },
    "compare_brand_images": {
        "title": "Check visual similarity risk",
        "description": (
            "Use this when the user supplies two visual proposals or a proposal plus a reference and wants perceptual "
            "similarity triage across silhouette, edge structure, colour, mass, composition, and reduction behaviour."
        ),
        "input": _object_schema(
            {"left": deepcopy(FILE_SCHEMA), "right": deepcopy(FILE_SCHEMA)},
            ["left", "right"],
        ),
        "view": "similarity",
        "invoking": "Comparing visual structures",
        "invoked": "Similarity triage ready",
        "files": ["left", "right"],
    },
    "coach_brand_decision": {
        "title": "Coach a design decision",
        "description": (
            "Use this when the user wants to understand why one graphic decision is stronger, convert critique into a "
            "45–90 minute exercise, or define measurable acceptance criteria for the next iteration."
        ),
        "input": _object_schema(
            {
                "question": {"type": "string", "minLength": 1, "description": "The concrete design decision or uncertainty."},
                "goal": {"type": "string", "default": "improve the next iteration"},
                "critique": {"type": "object", "description": "Optional critique result previously returned by critique_brand_image."},
            },
            ["question"],
        ),
        "view": "coach",
        "invoking": "Turning critique into a test",
        "invoked": "Coaching plan ready",
    },
}
