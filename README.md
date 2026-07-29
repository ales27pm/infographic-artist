# Infographic Artist

This repository is the canonical source for the two Infographic Artist implementations:

- `python/` contains the standalone Python ChatGPT/MCP package, submission material, validation scripts, and deployment files.
- `hatchable/` contains the byte-for-byte source export of the live Hatchable project currently serving `https://infographic-artist-1w7v.hatchable.site`.

The Hatchable export is a backup only. No production Hatchable deployment is triggered by committing these files.

## Workflows

Run and validate the Python package from `python/`:

```bash
cd python
uv venv
source .venv/bin/activate
uv pip install -e '.[dev]'
pytest
python scripts/validate_submission.py
python scripts/check_widget_js.py
python scripts/smoke_mcp.py --output validation/runtime-smoke.json
```

Inspect the Hatchable export manifest:

```bash
cat hatchable/EXPORT_MANIFEST.json
```
