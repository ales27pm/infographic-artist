from __future__ import annotations

import ast
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
sys.path.insert(0, str(ROOT))
from contract import READ_ONLY_ANNOTATIONS, TOOL_DEFINITIONS  # noqa: E402

EXPECTED_TOOLS = set(TOOL_DEFINITIONS)


def check(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


for name in ["contract.py", "core.py", "fallback_server.py", "official_server.py", "server.py"]:
    try:
        ast.parse((ROOT / name).read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{name}: {exc}")


# Inspect the actual live descriptor source used by the restricted-build fallback.
try:
    import fallback_server

    descriptors = fallback_server.get_tool_descriptors()
    check({item.get("name") for item in descriptors} == EXPECTED_TOOLS, "live descriptor tools do not match expected tools")
    for item in descriptors:
        tool_name = str(item.get("name") or "<unknown>")
        check(str(item.get("description") or "").startswith("Use this when"), f"{tool_name}: description must start with Use this when")
        check(bool(item.get("outputSchema")), f"{tool_name}: missing outputSchema")
        annotations = item.get("annotations") or {}
        expected = TOOL_DEFINITIONS[tool_name].get("annotations", READ_ONLY_ANNOTATIONS)
        check(annotations.get("readOnlyHint") is expected["readOnlyHint"], f"{tool_name}: live readOnlyHint mismatch")
        check(annotations.get("openWorldHint") is expected["openWorldHint"], f"{tool_name}: live openWorldHint mismatch")
        check(annotations.get("destructiveHint") is expected["destructiveHint"], f"{tool_name}: live destructiveHint mismatch")
        check(annotations.get("idempotentHint") is expected["idempotentHint"], f"{tool_name}: live idempotentHint mismatch")
except Exception as exc:
    errors.append(f"live descriptor inspection: {exc}")

manifest_path = ROOT / "chatgpt-app-submission.json"
try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception as exc:
    manifest = {}
    errors.append(f"submission JSON: {exc}")

check(manifest.get("$schema") == "https://developers.openai.com/apps-sdk/schemas/chatgpt-app-submission.v1.json", "invalid submission schema URI")
check(manifest.get("schema_version") == 1, "schema_version must be integer 1")
check(manifest.get("app_info", {}).get("display_name") == "Infographic Artist", "missing app display name")
check(len(manifest.get("app_info", {}).get("subtitle", "")) <= 30, "subtitle exceeds 30 characters")
check(manifest.get("app_info", {}).get("category") == "DESIGN", "category must be DESIGN")
check(set(manifest.get("tools", {})) == EXPECTED_TOOLS, "submission tools do not match server tools")
check(len(manifest.get("test_cases", [])) >= 7, "expected at least seven positive test cases")
check(len(manifest.get("negative_test_cases", [])) >= 3, "expected at least three negative test cases")
for name, item in manifest.get("tools", {}).items():
    annotations = item.get("annotations") or {}
    expected = TOOL_DEFINITIONS[name].get("annotations", READ_ONLY_ANNOTATIONS)
    check(annotations.get("readOnlyHint") is expected["readOnlyHint"], f"{name}: readOnlyHint mismatch")
    check(annotations.get("openWorldHint") is expected["openWorldHint"], f"{name}: openWorldHint mismatch")
    check(annotations.get("destructiveHint") is expected["destructiveHint"], f"{name}: destructiveHint mismatch")
    check(bool(item.get("justifications", {}).get("read_only_justification")), f"{name}: missing read-only justification")
    check(bool(item.get("justifications", {}).get("open_world_justification")), f"{name}: missing open-world justification")
    check(bool(item.get("justifications", {}).get("destructive_justification")), f"{name}: missing destructive justification")

for rel in [
    "assets/app-v1.html",
    "assets/app-icon-512.png",
    "assets/app-icon-64.png",
    "assets/submission-atlas.png",
    "assets/submission-directions.png",
    "assets/submission-critique.png",
    "docs/website.md",
    "docs/deployment.md",
    "docs/privacy-policy.md",
    "docs/terms.md",
    "docs/security.md",
    "Dockerfile",
    "render.yaml",
    "submission/publish-checklist.md",
    "docs/PUBLISH_TO_CHATGPT.md",
    "docs/support.md",
]:
    check((ROOT / rel).is_file(), f"missing required file: {rel}")

for rel in ("fallback_server.py", "official_server.py"):
    source = (ROOT / rel).read_text(encoding="utf-8")
    check("/.well-known/openai-apps-challenge" in source, f"{rel}: missing OpenAI domain challenge route")
    check("OPENAI_APPS_CHALLENGE_TOKEN" in source or "_openai_apps_challenge_token" in source, f"{rel}: missing challenge token wiring")
check("OPENAI_APPS_CHALLENGE_TOKEN" in (ROOT / ".env.example").read_text(encoding="utf-8"), ".env.example: missing challenge token variable")


secret_re = re.compile(r"(?:sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{20,})")
ignored = {".git", ".venv", ".pytest_cache", "__pycache__", "validation"}
for path in ROOT.rglob("*"):
    if any(part in ignored for part in path.parts):
        continue
    if not path.is_file() or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip"}:
        continue
    if secret_re.search(path.read_text(encoding="utf-8", errors="ignore")):
        errors.append(f"potential secret: {path.relative_to(ROOT)}")

files = []
for path in sorted(ROOT.rglob("*")):
    if not path.is_file() or any(part in ignored for part in path.parts):
        continue
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    files.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size, "sha256": digest})
(ROOT / "validation").mkdir(exist_ok=True)
(ROOT / "validation/manifest.json").write_text(json.dumps({"files": files}, indent=2), encoding="utf-8")
report = {"status": "failed" if errors else "passed", "errors": errors, "file_count": len(files)}
(ROOT / "validation/report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
sys.exit(1 if errors else 0)
