# Hatchable Source Export

This directory contains a local source mirror derived from a byte-for-byte export of the live Hatchable project source for Infographic Artist.

- Project: `proj_0ZtdM0sQTbe1`
- Public URL: `https://infographic-artist-1w7v.hatchable.site`
- Deployment version: `18`
- Export source: Hatchable `read_file` connector results
- Production status: local edits under this directory did not deploy or modify Hatchable

The virtual Hatchable `AGENTS.md` file is not committed here because the platform generates it live.

## Render storage limitation

The Hatchable mirror keeps generated render jobs and assets in single-instance process memory because this export does not include a durable cross-worker storage adapter. It enforces retention cleanup, retained-byte eviction, concurrency limits, and daily image quotas within that process, but it does not provide cross-worker or cold-start recovery. Use the Python deployment with `GENERATED_ASSET_DIR` backed by mounted durable storage for the documented 168-hour generated-asset retention behavior.
