import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateDirections,coachDecision} from '../lib/core.js';
const cases=JSON.parse(fs.readFileSync(new URL('../../python/tests/fixtures/intent_cases.json',import.meta.url),'utf8'));
for(const c of cases)test(`current request: ${c.id}`,async()=>{
 const a=c.args,d=c.tool==='directions'?await generateDirections(a):coachDecision(a.question,a.critique,a.goal,a.design_context,a.execution);
 assert.equal(d.design_workflow.stages.length,c.stages);
 assert.equal(d.intent_resolution.status,c.clarification?'clarification_required':'resolved');
 if(c.tool==='directions'){
  assert.equal(d.routes.length,c.count);assert.equal(d.intent_resolution.identity_exploration,c.identity);
  if(!c.identity)for(const r of d.routes){assert.ok(!['symbol','type','system'].includes(r.id));assert.ok(!r.assets.some(x=>['symbole','mot-signe','monogramme','alphabet secondaire'].includes(x)));}
  for(const r of d.routes)for(const v of [...Object.values(a.design_context||{}),...(a.must_avoid||[]),...(a.execution?.locked_elements||[])])assert.ok(r.concept_board_prompt.includes(v),v);
  assert.equal(d.image_generation_handoff.native_tool,'@Créer une image');assert.equal(d.image_generation_handoff.plugin_rendering_available,false);
 }else if(c.advice){assert.equal(d.mode,'advice');assert.deepEqual(d.exercise.steps,[]);assert.deepEqual(d.exercise.schedule,[]);assert.match(d.answer,/gauche|left/);}
});
