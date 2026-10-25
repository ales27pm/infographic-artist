#!/usr/bin/env python3
"""Generate public review autofill from the public submission and portable package.
No portal request, attestations or publication-status mutations are performed.
"""
import json
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def generated_autofill():
    public = json.loads((ROOT / 'python/chatgpt-app-submission.json').read_text())
    plugin_root = ROOT / 'plugins/infographic-artist'
    plugin = json.loads((plugin_root / 'plugin.json').read_text())
    mcp = json.loads((plugin_root / 'mcp.json').read_text())
    endpoint = mcp['mcpServers']['infographic_artist']['url']
    parsed = urlsplit(endpoint)
    origin = f'{parsed.scheme}://{parsed.netloc}'
    csp = {'connect_domains': [], 'resource_domains': [origin]}
    tools = {}
    for name, item in public['tools'].items():
        tools[name] = {**item['annotations'], **item['justifications'], 'csp_metadata': csp}
    return {
        'format': '27pm-review-autofill-v2',
        'generated_from': ['python/chatgpt-app-submission.json', 'plugins/infographic-artist/plugin.json', 'plugins/infographic-artist/mcp.json'],
        'version': plugin['version'],
        'app_info': public['app_info'],
        'mcp_server': {'url': endpoint, 'authentication': 'No Auth'},
        'default_csp_metadata': csp,
        'privacy_costs_retention': {
            'image_generation_mode': 'host_native',
            'plugin_rendering_available': False,
            'operator_cost_note': 'The public MCP server does not call a paid image-generation provider.',
            'generated_asset_retention': 'The public MCP server does not generate or retain rendered concept boards.',
            'uploaded_image_retention': 'Selected images are accessed temporarily for the requested critique or comparison and are not persisted by the application.'
        },
        'tools': tools,
        'review': plugin['extensions']['com.openai']['review'],
        'publication': plugin['extensions']['com.openai']['publication'],
        'portal_note': 'Apply to the existing Infographic Artist record after reading its current state. Explicitly replace old release notes. This file does not assert compliance, developer identity, review approval or public publication.'
    }

if __name__ == '__main__':
    print(json.dumps(generated_autofill(), ensure_ascii=False, indent=2))
