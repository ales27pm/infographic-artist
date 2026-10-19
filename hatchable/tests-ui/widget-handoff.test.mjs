import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const playwrightPath=process.env.INFOGRAPHIC_PLAYWRIGHT_PATH;
const {chromium}=await import(playwrightPath?pathToFileURL(playwrightPath).href:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const html=fs.readFileSync(path.join(root,'python/assets/app-v1.html'),'utf8');
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function fixture(mode='deferred',viewport={width:1440,height:1000}){
 const page=await browser.newPage({viewport});page.setDefaultTimeout(2000);
 await page.addInitScript(({mode})=>{
  const routes=['symbol','type','system'].map(id=>({id,name:'Direction '+id,thesis:'Une identité originale.',concept_board_prompt:'Original '+id+' concept board for Atelier Boréal; preserve the exact name and do not copy any existing mark.'}));
  const data={view:'directions',data:{brief:{name:'Atelier Boréal',sector:'architecture',promise:'précision humaine'},routes,image_generation_handoff:{mode:'host_native',plugin_rendering_available:false},decision_rule:'Comparer les directions.'}};
  window.__sent=[];window.__data=data;
  window.openai={toolOutput:data,sendFollowUpMessage:x=>{
   window.__sent.push(x);
   if(mode==='refused')return Promise.resolve({isError:true,content:[{type:'text',text:'The host declined this request.'}]});
   if(mode==='thrown')return Promise.reject(new Error('Connection interrupted'));
   if(mode==='success')return Promise.resolve();
   return new Promise(resolve=>{window.__complete=resolve;});
  }};
  if(mode==='unsupported')delete window.openai.sendFollowUpMessage;
 },{mode});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://widget.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto('https://widget.test/');
 await page.locator('.native-render-route').first().waitFor();
 return {page,errors};
}
test('double click and host rerender do not send the same brief twice',async()=>{
 const {page}=await fixture();try{
  await page.evaluate(()=>{const b=document.querySelector('.native-render-route');b.click();b.click();});
  assert.equal(await page.evaluate(()=>window.__sent.length),1,'second click must not send another request');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{toolOutput:window.__data}})));
  assert.equal(await page.locator('.native-render-route').first().isDisabled(),true,'rerender must retain pending lock');
  await page.evaluate(()=>window.__complete());
  await page.waitForFunction(()=>document.querySelector('.native-render-route').textContent.includes('transmise'));
  assert.equal(await page.locator('.route').count(),3);
  assert.equal(await page.locator('.native-render-route').nth(1).isDisabled(),false,'another direction remains available');
 }finally{await page.close();}
});
test('resolved host refusal is not displayed as a successful handoff',async()=>{
 const {page}=await fixture('refused');try{
  await page.locator('.native-render-route').first().click();await page.waitForTimeout(50);
  assert.ok(!(await page.locator('body').innerText()).includes('Demande transmise à la conversation'));
  assert.equal(await page.locator('.route').count(),3,'retain the briefs');
  assert.match(await page.locator('[data-handoff-status]').first().innerText(),/refus/i);
 }finally{await page.close();}
});
test('a rejected promise preserves the brief and does not silently retry',async()=>{
 const {page}=await fixture('thrown');try{
  await page.locator('.native-render-route').first().click();await page.waitForTimeout(50);
  assert.equal(await page.locator('.route').count(),3);
  assert.equal(await page.evaluate(()=>window.__sent.length),1);
  assert.match(await page.locator('[data-handoff-status]').first().innerText(),/incertain|confirm/i);
  assert.equal(await page.locator('.native-render-route').first().isDisabled(),true);
 }finally{await page.close();}
});
test('a missing host capability keeps prompts visible and sends nothing',async()=>{
 const {page}=await fixture('unsupported');try{
  await page.locator('.native-render-route').first().click();await page.waitForTimeout(50);
  assert.equal(await page.locator('.route').count(),3);
  assert.equal(await page.evaluate(()=>window.__sent.length),0);
  assert.match(await page.locator('[data-handoff-status]').first().innerText(),/indisponible/i);
 }finally{await page.close();}
});
test('stalled handoff becomes uncertain, without resending or claiming success',async()=>{
 const {page}=await fixture();try{
  await page.clock.install();
  await page.locator('.native-render-route').first().click();
  await page.clock.runFor(16000);
  assert.equal(await page.evaluate(()=>window.__sent.length),1);
  assert.match(await page.locator('[data-handoff-status]').first().innerText(),/incertain|confirm/i);
  assert.equal(await page.locator('.native-render-route').first().isDisabled(),true);
 }finally{await page.close();}
});
test('successful handoff and mobile layout remain clear',async()=>{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const {page,errors}=await fixture('success',viewport);try{
   await page.locator('.native-render-route').first().click();
   await page.waitForFunction(()=>document.querySelector('.native-render-route').textContent.includes('transmise'));
   assert.equal(await page.locator('.native-render-route').first().isDisabled(),true);
   assert.equal(await page.locator('.route').count(),3);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(errors,[]);
   if(process.env.INFOGRAPHIC_QA_DIR){fs.mkdirSync(process.env.INFOGRAPHIC_QA_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INFOGRAPHIC_QA_DIR,`handoff-${viewport.width}.png`)});}
  }finally{await page.close();}
 }
});

test('an explicit refusal permits one deliberate retry, not an automatic retry',async()=>{
 const {page}=await fixture('refused');try{
  await page.locator('.native-render-route').first().click();await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>window.__sent.length),1);
  await page.evaluate(()=>{window.openai.sendFollowUpMessage=x=>{window.__sent.push(x);return Promise.resolve();};});
  await page.locator('.native-render-route').first().click();
  await page.waitForFunction(()=>document.querySelector('.native-render-route').textContent.includes('transmise'));
  assert.equal(await page.evaluate(()=>window.__sent.length),2);
 }finally{await page.close();}
});
