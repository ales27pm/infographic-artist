import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {generateDirections,coachDecision} from '../lib/core.js';
const {chromium}=await import(process.env.INFOGRAPHIC_PLAYWRIGHT_PATH?pathToFileURL(process.env.INFOGRAPHIC_PLAYWRIGHT_PATH).href:'playwright');
const html=fs.readFileSync(new URL('../../python/assets/app-v1.html',import.meta.url),'utf8');
const cases=JSON.parse(fs.readFileSync(new URL('../../python/tests/fixtures/intent_cases.json',import.meta.url),'utf8'));
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});
async function fixture(c,width){
 const a=c.args,data=c.tool==='directions'?await generateDirections(a):coachDecision(a.question,a.critique,a.goal,a.design_context,a.execution),view=c.tool==='directions'?'directions':'coach';
 const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
 page.setDefaultTimeout(4000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(({view,data})=>{window.__sent=[];window.openai={toolOutput:{view,data},sendFollowUpMessage:async r=>{window.__sent.push(r);}};},{view,data});
 await page.route('https://widget.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto('https://widget.test/');
 assert.equal(page.url(),'https://widget.test/');assert.match(await page.title(),/Infographic Artist/);
 return {page,errors,data};
}
for(const width of [390,1440])for(const id of ['poster_no_rebrand','website_preserve_identity','targeted_alignment','structured_count_conflict','full_plan_opt_in'])test(`${id} rendered at ${width}px`,async()=>{
 const c=cases.find(x=>x.id===id),{page,errors}=await fixture(c,width);
 try{
  assert.ok((await page.locator('#root').innerText()).length>30);
  assert.equal(await page.locator('[data-workflow-stage]').count(),c.stages);
  if(c.tool==='directions')assert.equal(await page.locator('.native-render-route').count(),c.count);
  if(c.advice){assert.equal(await page.locator('[data-focused-advice]').count(),1);assert.match(await page.locator('#root').innerText(),/gauche/);assert.equal(await page.locator('[data-coach-schedule]').count(),0);}
  if(c.clarification){assert.match(await page.locator('#root').innerText(),/Clarifier/);assert.equal(await page.locator('.copy-native-brief').count(),0);}
  if(id==='poster_no_rebrand'){
   await page.locator('.native-render-route').click();
   await page.waitForFunction(()=>window.__sent.length===1);
   const [sent]=await page.evaluate(()=>window.__sent);
   assert.ok(sent.prompt.startsWith('@Créer une image\n\n'));assert.ok(sent.prompt.includes('Horaire d’hiver'));assert.ok(sent.prompt.includes('420 × 594 mm'));assert.ok(sent.prompt.includes('conserver le logo déjà approuvé'));
   assert.ok(!sent.prompt.includes('Show a dominant black-and-white symbol silhouette'));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  if(process.env.INFOGRAPHIC_QA_DIR){fs.mkdirSync(process.env.INFOGRAPHIC_QA_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.INFOGRAPHIC_QA_DIR,`intent-${id}-${width}.png`),fullPage:true});}
 }finally{await page.close();}
});
