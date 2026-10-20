"""Tests for the documented catalogue and planning-only workflow; no image provider."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from contract import DESIGN_CONTEXT_SCHEMA, TOOL_DEFINITIONS  # noqa: E402
from design_workflow import (  # noqa: E402
    CONTEXT_FIELDS, DESIGN_PRINCIPLES, build_design_workflow,
    normalize_design_context, search_principles, untested_evaluations,
)

TITLES = [
    "Définir la tâche, le public, le message, le support et la taille finale.",
    "Déterminer ce que le visuel doit représenter correctement.",
    "Appliquer les contraintes de reproduction et d’accessibilité pertinentes.",
    "Choisir les principes perceptifs qui clarifient la structure.",
    "Explorer plusieurs systèmes de proportion et de composition.",
    "Développer la direction artistique et les références symboliques.",
    "Effectuer les corrections optiques et les déclinaisons.",
    "Évaluer séparément reconnaissance, compréhension et préférence.",
]


class DesignWorkflowTests(unittest.TestCase):
    def test_complete_catalogue_is_bounded_and_each_id_is_reachable(self):
        result = search_principles("", 100)
        self.assertEqual(result["collection"], "design_principles")
        self.assertEqual(result["catalogue_counts"], {"concepts": 150, "sources": 69, "domains": 14})
        self.assertEqual(result["total_matches"], 150)
        self.assertEqual(len(result["items"]), 25)
        sources = {source["id"]: source for source in DESIGN_PRINCIPLES["sources"]}
        for concept in DESIGN_PRINCIPLES["concepts"]:
            with self.subTest(concept=concept["id"]):
                card = search_principles(concept["id"], 1)["items"][0]
                self.assertEqual(card["id"], concept["id"])
                for key, value in concept.items():
                    self.assertEqual(card[key], value)
                self.assertTrue(card["basis_label"])
                self.assertEqual([source["id"] for source in card["sources"]], concept["source_ids"])
                for source in card["sources"]:
                    for key, value in sources[source["id"]].items():
                        self.assertEqual(source[key], value)
                    self.assertTrue(source["read_level"])

    def test_aliases_accents_apostrophes_and_greek_symbols(self):
        groups = [
            ["fibonaci", "FIBONACCI"],
            ["golden ratio", "nombre d’or", "nombre d'or", "φ", "ϕ", "Φ", "phi"],
            ["sacred geometry", "géométrie sacrée", "GEOMETRIE SACREE"],
        ]
        for queries in groups:
            expected = [item["id"] for item in search_principles(queries[0], 25)["items"]]
            self.assertTrue(expected)
            for query in queries[1:]:
                with self.subTest(query=query):
                    self.assertEqual([item["id"] for item in search_principles(query, 25)["items"]], expected)
        self.assertEqual(search_principles("φ", 1)["items"][0]["id"], "GEO-09")

    def test_unmatched_or_non_ascii_only_query_never_opens_whole_catalogue(self):
        for query in ["qxzvnjk987654321", "🪷", "比例", "!!!"]:
            with self.subTest(query=query):
                result = search_principles(query)
                self.assertEqual(result["total_matches"], 0)
                self.assertEqual(result["items"], [])
        self.assertEqual(search_principles("   ")["total_matches"], 150)

    def test_normative_and_symbolic_limits_are_not_dropped(self):
        text = search_principles("INF-14", 1)["items"][0]
        self.assertIn("4.5", text["definition"])
        self.assertIn("4.499", text["limits"])
        self.assertIn("Exceptions", text["limits"])
        self.assertTrue(all(source["read_level"] for source in text["sources"]))
        for source in text["sources"]:
            original = next(item for item in DESIGN_PRINCIPLES["sources"] if item["id"] == source["id"])
            if not original.get("read_level") and not original.get("reading"):
                self.assertEqual(source["read_scope_status"], "not_recorded")
                self.assertIn("non renseignée", source["read_level"])
        motion = search_principles("INF-32", 1)["items"][0]
        self.assertIn("AAA", motion["definition"])
        self.assertIn("AA", motion["limits"])
        symbolic = search_principles("THE-07", 1)["items"][0]
        self.assertEqual(symbolic["basis"], "historical_symbolic")
        self.assertIn("preuve", symbolic["limits"])

    def test_exact_stage_order_resolved_principles_and_no_fabricated_results(self):
        plan = build_design_workflow()
        self.assertEqual([stage["title"] for stage in plan["stages"]], TITLES)
        self.assertEqual(len({stage["id"] for stage in plan["stages"]}), 8)
        ids = {concept["id"] for concept in DESIGN_PRINCIPLES["concepts"]}
        for stage in plan["stages"]:
            self.assertEqual(stage["status"], "non_testé")
            self.assertTrue(stage["deliverables"] and stage["checks"])
            self.assertTrue(set(stage["principle_ids"]).issubset(ids))
        self.assertEqual(set(plan["evaluations"]), {"recognition", "comprehension", "preference"})
        for evaluation in plan["evaluations"].values():
            self.assertEqual(evaluation["status"], "non_testé")
            self.assertEqual(evaluation["evidence"], [])
            self.assertEqual(evaluation["observations"], [])
        self.assertFalse(plan["evidence_contract"]["automatic_validation"])
        self.assertFalse(plan["evidence_contract"]["accepts_evidence"])

    def test_declared_context_precedence_and_missing_facts(self):
        empty = build_design_workflow()
        self.assertEqual(empty["brief"], {})
        self.assertEqual(set(empty["missing_brief"]), set(CONTEXT_FIELDS))
        plan = build_design_workflow({"audience": "  Lecteurs  experts ", "medium": "Imprimé"}, declared_brief={"audience": "Public fourni", "promise": "Rendre les données comparables"})
        self.assertEqual(plan["brief"]["audience"], "Lecteurs experts")
        self.assertEqual(plan["brief_sources"]["audience"], "design_context.audience")
        self.assertEqual(plan["brief_sources"]["message"], "promise")
        self.assertIn("task", plan["missing_brief"])
        self.assertIn("final_size", plan["missing_brief"])
        self.assertNotIn("audience", plan["missing_brief"])

    def test_context_bounds_types_and_no_evidence_input(self):
        self.assertEqual(normalize_design_context({"audience": "x" * 400})["audience"], "x" * 400)
        for context in [{"audience": "x" * 401}, {"task": 42}, {"medium": None}, [], "web", {"evidence": []}, {"status": "satisfait"}]:
            with self.subTest(context=context), self.assertRaises(ValueError):
                normalize_design_context(context)

    def test_results_are_detached_and_do_not_record_implicit_evidence(self):
        plan = build_design_workflow()
        plan["stages"][0]["status"] = "satisfait"
        plan["evaluations"]["recognition"]["evidence"].append("not a study")
        card = search_principles("INF-14", 1)["items"][0]
        card["sources"][0]["read_level"] = "changed by caller"
        self.assertEqual(build_design_workflow()["stages"][0]["status"], "non_testé")
        self.assertEqual(untested_evaluations()["recognition"]["evidence"], [])
        self.assertNotEqual(search_principles("INF-14", 1)["items"][0]["sources"][0]["read_level"], "changed by caller")

    def test_public_schemas_match_both_runtimes_and_keep_context_optional(self):
        js = (ROOT.parent / "hatchable/lib/contract.js").read_text()
        specs = json.loads(js.split("const ALL_TOOLS = ", 1)[1].split(";\nexport const TOOLS", 1)[0])
        js_tools = {item["name"]: item for item in specs}
        for name in ("generate_brand_directions", "coach_brand_decision"):
            schema = TOOL_DEFINITIONS[name]["input"]
            self.assertNotIn("design_context", schema["required"])
            self.assertEqual(schema, js_tools[name]["inputSchema"])
            self.assertEqual(schema["properties"]["design_context"], DESIGN_CONTEXT_SCHEMA)
        self.assertNotIn("default", TOOL_DEFINITIONS["generate_brand_directions"]["input"]["properties"]["audience"])
        for key, spec in CONTEXT_FIELDS.items():
            self.assertEqual(DESIGN_CONTEXT_SCHEMA["properties"][key]["maxLength"], spec["max_length"])


if __name__ == "__main__":
    unittest.main()
