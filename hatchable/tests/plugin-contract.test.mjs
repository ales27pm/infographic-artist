import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chatgpt-mcp.js';
import { searchAtlas, generateDirections } from '../lib/core.js';

async function rpc(method, params) {
  const res = {code:200, headers:{}, status(n){this.code=n;return this;}, setHeader(k,v){this.headers[k]=v;}, json(v){this.body=v;return this;},send(v){this.body=v;return this;}};
  await handler({method:'POST',headers:{accept:'application/json, text/event-stream'},body:{jsonrpc:'2.0',id:1,method,params}},res);
  return res;
}

test('unmatched query returns no unrelated deep cases',async()=>{
 const r=await searchAtlas('qxzvnjk987654321',{limit:2}); assert.equal(r.total_matches,0);assert.deepEqual(r.items,[]);
});
test('public tools omit unsupported server rendering',async()=>{
 const r=await rpc('tools/list',{}); const names=r.body.result.tools.map(t=>t.name);
 assert.equal(names.length,9);assert.ok(!names.includes('render_brand_direction'));
});
test('directions hand off to actual host capabilities without fake jobs',async()=>{
 const d=await generateDirections({name:'Atelier',sector:'architecture',promise:'précision humaine'});
 assert.equal(d.image_generation_handoff.mode,'host_native');assert.equal(d.image_generation_handoff.plugin_rendering_available,false);
 assert.ok(d.routes.every(x=>x.concept_board_prompt.length>100));
});
for(const args of [{limit:0},{limit:26},{limit:1.5},{limit:null},{query:42}])test(`invalid atlas input ${JSON.stringify(args)} rejected`,async()=>{
 const r=await rpc('tools/call',{name:'open_brand_atlas',arguments:args});assert.equal(r.body.result.isError,true);
});
test('duplicate comparison IDs rejected',async()=>{
 const r=await rpc('tools/call',{name:'compare_brand_systems',arguments:{item_ids:['nasa-worm','nasa-worm']}});assert.equal(r.body.result.isError,true);
});
test('successful responses work for text-only MCP clients',async()=>{
 const r=await rpc('tools/call',{name:'open_brand_atlas',arguments:{query:'NASA',limit:2}});
 assert.equal(r.body.result.isError,false);
 assert.deepEqual(JSON.parse(r.body.result.content.find(c=>c.type==='text').text),r.body.result.structuredContent);
});
test('invalid JSON-RPC params is a protocol error',async()=>{
 const r=await rpc('tools/call',[]);assert.equal(r.body.error.code,-32602);
});
