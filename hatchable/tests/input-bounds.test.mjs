import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chatgpt-mcp.js';
async function call(name,args){const res={status(n){this.code=n;return this;},setHeader(){},json(body){this.body=body;return this;},send(body){this.body=body;return this;}};await handler({method:'POST',headers:{accept:'application/json'},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}},res);return res.body;}
for(const [key,size] of [['sector',161],['promise',1001],['audience',401],['risk_tolerance',121]])test(`directions reject oversized ${key}, not silent truncation`,async()=>{
 const result=await call('generate_brand_directions',{name:'27PM',sector:'Studio',promise:'Clarté concrète',[key]:'x'.repeat(size)});assert.equal(result.result.isError,true);
});
for(const [key,size] of [['traits',101],['must_avoid',1001]])test(`directions bound ${key} items`,async()=>{
 const result=await call('generate_brand_directions',{name:'27PM',sector:'Studio',promise:'Clarté concrète',[key]:['x'.repeat(size)]});assert.equal(result.result.isError,true);
});
test('coach rejects oversized question at input boundary',async()=>{const result=await call('coach_brand_decision',{question:'x'.repeat(4001)});assert.equal(result.result.isError,true);});
test('unsupported public tool and arbitrary origin remain rejected',async()=>{
 assert.ok((await call('render_brand_direction',{concept_board_prompt:'x'.repeat(100)})).error);
 const res={status(n){this.code=n;return this;},setHeader(){},json(body){this.body=body;return this;}};
 await handler({method:'POST',headers:{origin:'https://evil.test'},body:{jsonrpc:'2.0',id:1,method:'tools/list'}},res);assert.equal(res.code,403);
});
