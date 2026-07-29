#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT.parent
SOURCE_NAME = "infographic_artist_chatgpt_app_v1.0.1"
SUBMISSION_NAME = "infographic_artist_chatgpt_submission_v1.0.1"
FIXED_TIME = (2026, 7, 24, 0, 0, 0)
EXCLUDED_PARTS = {".venv", ".pytest_cache", "__pycache__", ".git"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".zip"}

SUBMISSION_FILES = [
    "chatgpt-app-submission.json",
    "assets/app-icon-512.png",
    "assets/app-icon-64.png",
    "assets/submission-atlas.png",
    "assets/submission-directions.png",
    "assets/submission-critique.png",
    "submission/app-info.md",
    "submission/app-directory-fields.md",
    "submission/publish-checklist.md",
    "submission/review-notes.md",
    "submission/review-report.md",
    "submission/test-prompts.md",
    "docs/PUBLISH_TO_CHATGPT.md",
    "docs/website.md",
    "docs/deployment.md",
    "docs/security.md",
    "docs/privacy-policy.md",
    "docs/terms.md",
    "docs/support.md",
    "docs/review-readiness.md",
    "validation/TEST_RESULTS.md",
    "validation/runtime-smoke.json",
    "validation/report.json",
    "RELEASE_NOTES.md",
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def included_source_files() -> list[Path]:
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDED_PARTS for part in rel.parts):
            continue
        if path.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        files.append(path)
    return files


def zip_bytes(zf: zipfile.ZipFile, arcname: str, data: bytes) -> None:
    info = zipfile.ZipInfo(arcname, date_time=FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    zf.writestr(info, data)


def write_zip(path: Path, prefix: str, entries: list[tuple[str, bytes]]) -> None:
    path.unlink(missing_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for rel, data in entries:
            zip_bytes(zf, f"{prefix}/{rel}", data)


def write_sidecar(path: Path) -> None:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    path.with_suffix(path.suffix + ".sha256").write_text(f"{digest}  {path.name}\n", encoding="utf-8")


def main() -> None:
    source_files = included_source_files()
    source_manifest = {
        "release": SOURCE_NAME,
        "generated_on": "2026-07-24",
        "files": [
            {
                "path": str(path.relative_to(ROOT)),
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in source_files
            if path.relative_to(ROOT) != Path("validation/release-manifest.json")
        ],
    }
    manifest_path = ROOT / "validation/release-manifest.json"
    manifest_path.write_text(json.dumps(source_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    source_files = included_source_files()

    source_entries = [(str(path.relative_to(ROOT)), path.read_bytes()) for path in source_files]
    source_zip = OUT_DIR / f"{SOURCE_NAME}_verified.zip"
    write_zip(source_zip, SOURCE_NAME, source_entries)
    write_sidecar(source_zip)

    submission_entries: list[tuple[str, bytes]] = []
    for rel in SUBMISSION_FILES:
        path = ROOT / rel
        if not path.is_file():
            raise FileNotFoundError(rel)
        submission_entries.append((rel, path.read_bytes()))
    submission_manifest = {
        "release": SUBMISSION_NAME,
        "generated_on": "2026-07-24",
        "note": "Reviewer/import package only. The deployable source is in the separate full archive.",
        "files": [
            {"path": rel, "bytes": len(data), "sha256": sha256_bytes(data)}
            for rel, data in submission_entries
        ],
    }
    submission_entries.append(
        ("submission-manifest.json", (json.dumps(submission_manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    )
    submission_zip = OUT_DIR / f"{SUBMISSION_NAME}.zip"
    write_zip(submission_zip, SUBMISSION_NAME, submission_entries)
    write_sidecar(submission_zip)

    print(json.dumps({
        "source_zip": str(source_zip),
        "source_sha256": hashlib.sha256(source_zip.read_bytes()).hexdigest(),
        "source_files": len(source_entries),
        "submission_zip": str(submission_zip),
        "submission_sha256": hashlib.sha256(submission_zip.read_bytes()).hexdigest(),
        "submission_files": len(submission_entries),
    }, indent=2))


if __name__ == "__main__":
    main()
