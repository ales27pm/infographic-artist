import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TOOLS, APP_VERSION } from '../lib/contract.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
test('review autofill advertises only the nine public tools',()=>{
 const v=read('chatgpt-tool-review-autofill.json');
 assert.deepEqual(Object.keys(v.tools).sort(),TOOLS.map(x=>x.name).sort());
 assert.equal(v.app_info.description,read('python/chatgpt-app-submission.json').app_info.description);
 assert.equal(v.privacy_costs_retention.image_generation_mode,'host_native');
 assert.equal(v.privacy_costs_retention.plugin_rendering_available,false);
});
test('portable and compatibility packages contain explicit product-specific release notes',()=>{
 const p=read('plugins/infographic-artist/plugin.json');
 const compatibility=read('plugins/infographic-artist/.codex-plugin/plugin.json');
 const extension=p.extensions['com.openai'];
 assert.equal(compatibility.version,p.version);
 assert.equal(compatibility.extensions['com.openai'].publication.release_notes,extension.publication.release_notes);
 assert.match(extension.publication.release_notes,/Infographic Artist/i);
 assert.doesNotMatch(extension.publication.release_notes,/Daft.?Citadel|daft_punk/i);
 assert.equal(extension.review.test_cases.positive.length,7);
 assert.equal(extension.review.test_cases.negative.length,3);
});

test('package version, release version and server version stay synchronized',()=>{
 const p=read('plugins/infographic-artist/plugin.json');
 const release=read('deployment/hatchable/manifest.json').release;
 assert.equal(APP_VERSION,`${p.version}-hatchable.${release.runtime_revision}`);
 assert.equal(release.runtime_revision,4);
 assert.equal(read('deployment/hatchable/manifest.json').release.version,p.version);
 assert.equal(read('chatgpt-tool-review-autofill.json').version,p.version);
});
