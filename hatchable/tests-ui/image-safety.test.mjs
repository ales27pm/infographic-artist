import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const esbuild=require(process.env.INFOGRAPHIC_ESBUILD_PATH||'esbuild');
const {chromium}=await import(process.env.INFOGRAPHIC_PLAYWRIGHT_PATH?pathToFileURL(process.env.INFOGRAPHIC_PLAYWRIGHT_PATH).href:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
let browser,core,production,temporary,visits=0;const originalFetch=globalThis.fetch;
before(async()=>{
 browser=await chromium.launch({headless:true});temporary=await fs.mkdtemp(path.join(os.tmpdir(),'ia-image-safety-'));
 globalThis.__iaTestBrowser={session:async callback=>{visits++;const page=await browser.newPage();await page.route('**/*',()=>{throw new Error('Image decoder must never navigate or fetch a third-party document');});try{return await callback(page);}finally{await page.close();}}};
 const output=path.join(temporary,'core.mjs');
 await esbuild.build({entryPoints:[path.join(root,'hatchable/lib/core.js')],outfile:output,bundle:true,platform:'node',format:'esm',plugins:[{name:'test-managed-browser-boundary',setup(build){build.onResolve({filter:/^hatchable$/},()=>({path:'hatchable',namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const browser=globalThis.__iaTestBrowser;',loader:'js'}));}}]});
 core=await import(pathToFileURL(output).href);
 const productionOutput=path.join(temporary,'production.mjs');
 await esbuild.build({entryPoints:[path.join(root,'deployment/public-mcp.bundle.js')],outfile:productionOutput,bundle:true,platform:'node',format:'esm',plugins:[{name:'test-production-browser-boundary',setup(build){build.onResolve({filter:/^hatchable$/},()=>({path:'hatchable',namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const browser=globalThis.__iaTestBrowser;',loader:'js'}));}}]});
 production=(await import(pathToFileURL(productionOutput).href)).default;

});
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.__iaTestBrowser;await browser?.close();if(temporary)await fs.rm(temporary,{recursive:true,force:true});});
async function raster(mime,transparent=false){const page=await browser.newPage();try{return await page.evaluate(({mime,transparent})=>{const c=document.createElement('canvas');c.width=64;c.height=48;const x=c.getContext('2d');if(!transparent){x.fillStyle='white';x.fillRect(0,0,64,48);}x.fillStyle='black';x.fillRect(20,8,24,32);return c.toDataURL(mime);},{mime,transparent});}finally{await page.close();}}
function serve(data,mime){const bytes=Buffer.from(data.split(',')[1],'base64');globalThis.fetch=async()=>new Response(bytes,{headers:{'content-type':mime}});}
for(const mime of ['image/png','image/jpeg','image/webp'])test(`real ${mime} decoder stays offline with finite descriptors`,async()=>{
 serve(await raster(mime),mime);const result=await core.imageMetrics({download_url:'https://files.openai.com/qa',file_id:'qa',mime_type:mime});assert.equal(result.width,64);assert.equal(result.height,48);assert.equal(result.alpha_background,'#ffffff');for(const key of ['contrast','entropy','edge_density','foreground_occupancy'])assert.ok(Number.isFinite(result[key]));
});
test('transparent and white-backed PNG have identical image descriptors',async()=>{
 serve(await raster('image/png',true),'image/png');const alpha=await core.imageMetrics({download_url:'https://files.openai.com/qa',file_id:'qa'});
 serve(await raster('image/png',false),'image/png');const opaque=await core.imageMetrics({download_url:'https://files.openai.com/qa',file_id:'qa'});assert.deepEqual(alpha,opaque);
});
test('real GIF decoder accepts the supported signature offline',async()=>{
 serve('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','image/gif');const result=await core.imageMetrics({download_url:'https://files.openai.com/qa',file_id:'qa'});assert.equal(result.width,1);assert.equal(result.height,1);
});
test('HTML disguised as an attachment is rejected before opening a managed browser',async()=>{
 const before=visits;globalThis.fetch=async()=>new Response('<script>location="https://evil.test"</script>',{headers:{'content-type':'image/png'}});
 await assert.rejects(()=>core.imageMetrics({download_url:'https://files.openai.com/qa',file_id:'qa'}),/signature|image/i);assert.equal(visits,before);
});

test('the generated production handler executes the actual image pipeline',async()=>{
 serve(await raster('image/png',true),'image/png');
 const res={status(n){this.code=n;return this;},setHeader(){},json(body){this.body=body;return this;},send(body){this.body=body;return this;}};
 await production({method:'POST',headers:{accept:'application/json'},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'critique_brand_image',arguments:{image:{download_url:'https://files.openai.com/qa.png',file_id:'qa',mime_type:'image/png'}}}}},res);
 assert.equal(res.body.result?.isError,false,JSON.stringify(res.body));
 assert.equal(res.body.result.structuredContent.data.technical_metrics.width,64);
 assert.equal(res.body.result.structuredContent.data.axes.differentiation.score,null);
});
