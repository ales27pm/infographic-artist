import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/chatgpt-mcp.js';
import {generateDirections,coachDecision} from '../lib/core.js';
const cases=JSON.parse(fs.readFileSync(new URL('../../python/tests/fixtures/boulet_cases.json',import.meta.url),'utf8'));
for(const c of cases)test(`original Boulet: ${c.id}`,async()=>{
 const res={status(n){this.code=n;return this;},setHeader(){},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};
 await handler({method:'POST',headers:{accept:'application/json, text/event-stream'},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:c.tool,arguments:c.args}}},res);
 assert.equal(res.body.result.isError,false);const d=res.body.result.structuredContent.data;
 const actual={routes:(d.routes??[]).length,stages:d.design_workflow.stages.length,mode:d.intent_resolution.mode,status:d.intent_resolution.status};
 for(const [k,v]of Object.entries(c.expected))assert.equal(actual[k],v,k);
 if(actual.status==='clarification_required'){assert.deepEqual(d.routes,[]);assert.equal(d.image_generation_handoff.ready,false);assert.ok(d.intent_resolution.clarifications.length);}
 for(const r of d.routes??[])for(const lock of c.args.execution?.locked_elements??[])assert.ok(r.concept_board_prompt.includes(lock));
});
for(const question of ['Deux propositions en 60 minutes, tests à 24 et 48 px.','Two proposals in 60 minutes, test at 24 and 48 px.'])test(`coaching proposal count: ${question}`,()=>{
 const d=coachDecision(question);assert.equal(d.exercise.variant_count,2);assert.equal(d.exercise.duration_minutes,60);assert.deepEqual(d.exercise.sizes_px,[24,48]);assert.equal(d.intent_resolution.status,'resolved');
});
for(const request of ['Pas de propositions.','No proposals.'])test(`no proposals: ${request}`,async()=>{
 const d=await generateDirections({request,execution:{variant_count:2}});assert.equal(d.intent_resolution.status,'clarification_required');assert.deepEqual(d.routes,[]);
});
