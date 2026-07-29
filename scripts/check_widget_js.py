#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "assets/app-v1.html"


def main() -> None:
    node = shutil.which("node")
    if not node:
        raise SystemExit("node is required for this check")
    text = HTML.read_text(encoding="utf-8")
    scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", text, flags=re.IGNORECASE | re.DOTALL)
    if not scripts:
        raise SystemExit("no inline script found")
    source = "\n".join(scripts)
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
        handle.write(source)
        temp = Path(handle.name)
    try:
        subprocess.run([node, "--check", str(temp)], check=True)
    finally:
        temp.unlink(missing_ok=True)
    print(f"widget JavaScript syntax: passed ({len(source.encode('utf-8'))} bytes)")


if __name__ == "__main__":
    main()
