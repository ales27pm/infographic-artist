import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../lib/core.js';
import {validateSchema} from '../lib/schema.js';

for(const query of ['!!!','🪷','比例']) test(`atlas does not turn unsearchable ${query} into browse`,async()=>{
 const r=await core.searchAtlas(query,{limit:2});assert.equal(r.total_matches,0);assert.deepEqual(r.items,[]);
});
test('empty atlas still browses',async()=>assert.ok((await core.searchAtlas('',{limit:2})).items.length));
test('boolean false schema rejects values',()=>assert.ok(validateSchema(false,42)));
for(const origin of ['https://127.0.0.2','https://[::1]','https://[::ffff:7f00:1]','https://localhost.','https://foo.localhost','https://100.64.0.1','https://files.openai.com.evil.test','https://example.com','https://files.openai.com:8443']){
 test(`file boundary rejects ${origin} before network or browser`,async()=>{
  await assert.rejects(()=>core.imageMetrics({download_url:origin+'/test.png',file_id:'qa'}),/autoris|local|priv|trusted|public|HTTPS|fichier/i);
 });
}
for(const [text,minutes] of [['Deux variantes en 1 heure 30 minutes à 24 et 48 px.',90],['Two variants in 1.5 hours at 24 and 48 px.',90],['Deux variantes en 1,5 heure à 24 et 48 px.',90],['Deux variantes en 1h30 à 24 et 48 px.',90]]){
 test(`compound/decimal duration: ${text}`,()=>{const e=core.coachDecision(text).exercise;assert.equal(e.duration_minutes,minutes);assert.equal(e.variant_count,2);assert.equal(e.schedule.reduce((n,s)=>n+s.minutes,0),minutes);});
}
test('negated pixel list cannot invalidate unrelated positive constraints',()=>{
 const e=core.coachDecision('2 variantes en 60 minutes. Pas de tests à 16, 24 ou 48 px.').exercise;
 assert.equal(e.variant_count,2);assert.equal(e.duration_minutes,60);assert.deepEqual(e.sizes_px,[]);
});
for(const score of [-1,21,Infinity,NaN,null,true])test(`invalid supplied score ${score} is never ranked`,()=>{
 const r=core.coachDecision('Comparer',{axes:{hierarchy:{score,label:'INVALID'}}});assert.ok(!r.diagnosis.includes('INVALID'));
});
test('untrusted axis label must not be stringified as object',()=>assert.ok(!core.coachDecision('Comparer',{axes:{hierarchy:{score:12,label:{}}}}).diagnosis.includes('[object Object]')));
const PNG=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
const file={download_url:'https://files.openai.com/qa.png',file_id:'qa',mime_type:'image/png'};
test('image download validates content bytes, MIME, redirect destinations and size',async()=>{
 assert.equal(typeof core.fetchImageBytes,'function');
 let calls=0;
 const good=await core.fetchImageBytes(file,async()=>{calls++;return new Response(PNG,{headers:{'content-type':'image/png'}});});
 assert.equal(good.mimeType,'image/png');assert.deepEqual(good.bytes,PNG);assert.equal(calls,1);
 await assert.rejects(()=>core.fetchImageBytes(file,async()=>new Response('<script>bad()</script>',{headers:{'content-type':'text/html'}})),/image|MIME/i);
 await assert.rejects(()=>core.fetchImageBytes(file,async()=>new Response('<script>bad()</script>',{headers:{'content-type':'image/png'}})),/signature|image/i);
 calls=0;
 await assert.rejects(()=>core.fetchImageBytes(file,async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.2/metadata'}});}),/autoris|local|priv|public/i);assert.equal(calls,1);
 await assert.rejects(()=>core.fetchImageBytes(file,async()=>new Response(PNG,{headers:{'content-type':'image/png','content-length':String(13*1024*1024)}})),/12|limite/i);
});
test('buffered hosted fetch is supported without pretending to stream',async()=>{
 const result=await core.fetchImageBytes(file,async()=>({status:200,ok:true,headers:new Headers({'content-type':'image/png'}),arrayBuffer:async()=>PNG.buffer}));assert.deepEqual(result.bytes,PNG);
});

test('oversized raster dimensions are rejected before browser allocation',async()=>{
 const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);const view=new DataView(bytes.buffer);view.setUint32(16,50000);view.setUint32(20,50000);
 await assert.rejects(()=>core.fetchImageBytes(file,async()=>new Response(bytes,{headers:{'content-type':'image/png'}})),/dimensions|limite/i);
});
test('expired signed URLs never appear in a download error',async()=>{
 const sensitive={...file,download_url:'https://files.openai.com/a?sig=SECRET-QA'};
 await assert.rejects(()=>core.fetchImageBytes(sensitive,async()=>{throw new Error('Failure at '+sensitive.download_url);}),error=>!error.message.includes('SECRET-QA'));
});

test('observed ChatGPT temporary-file origin is supported without a blanket Azure wildcard',async()=>{
 const origin='https://oaisdmntprcentralus.blob.core.windows.net/qa.png';
 const result=await core.fetchImageBytes({...file,download_url:origin},async()=>new Response(PNG,{headers:{'content-type':'image/png'}}));assert.equal(result.width,1);
 await assert.rejects(()=>core.imageMetrics({...file,download_url:'https://untrusted-qa.blob.core.windows.net/qa.png'}),/non autorisé/);
});
