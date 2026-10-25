import test, {after,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import handler from '../api/chatgpt-mcp.js';

const playwrightPath=process.env.INFOGRAPHIC_PLAYWRIGHT_PATH;
const {chromium}=await import(playwrightPath?pathToFileURL(playwrightPath).href:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const html=fs.readFileSync(path.join(root,'python/assets/app-v1.html'),'utf8');
let browser;
before(async()=>{browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();});

async function tool(name,args){
  const res={code:200,headers:{},status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};
  await handler({method:'POST',headers:{accept:'application/json, text/event-stream'},body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}},res);
  assert.equal(res.body.result?.isError,false,JSON.stringify(res.body));
  return res.body.result;
}
async function fixture(result,viewport){
  const page=await browser.newPage({viewport});page.setDefaultTimeout(5000);
  const errors=[],calls=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('serverTool',async(name,args)=>{calls.push({name,args});return tool(name,args);});
  await page.addInitScript(({data})=>{window.openai={toolOutput:data,callTool:(name,args)=>window.serverTool(name,args)};},{data:result.structuredContent});
  await page.route('https://widget.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto('https://widget.test/');
  return {page,errors,calls};
}
async function screenshot(page,name){
  if(!process.env.INFOGRAPHIC_QA_DIR)return;
  fs.mkdirSync(process.env.INFOGRAPHIC_QA_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.INFOGRAPHIC_QA_DIR,name),fullPage:true});
}

test('real coaching output displays the eight stages and three untested outcomes',async()=>{
  const result=await tool('coach_brand_decision',{question:'Comparer les surfaces de trois bulles sans déformer les quantités.',execution:{workflow_depth:'full'},design_context:{task:'Comparer 1, 4 et 9',audience:'Public du musée',message:'Les surfaces expriment les quantités',medium:'Affiche statique',final_size:'420 × 594 mm'}});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const {page,errors}=await fixture(result,viewport);
    try{
      assert.equal(await page.locator('[data-workflow-stage]').count(),8);
      assert.equal(await page.locator('[data-evaluation]').count(),3);
      for(const key of ['recognition','comprehension','preference']){
        assert.match(await page.locator('[data-evaluation="'+key+'"]').innerText(),/Non testé/i);
      }
      assert.match(await page.locator('.workflow-brief').innerText(),/420 × 594 mm/);
      const stage=page.locator('[data-workflow-stage]').nth(4);
      await stage.locator('summary').focus();await page.keyboard.press('Enter');
      assert.equal(await stage.getAttribute('open'),'');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      await screenshot(page,'workflow-'+viewport.width+'.png');
    }finally{await page.close();}
  }
});

test('principle search reaches the real MCP tool and preserves sources and limits',async()=>{
  const result=await tool('search_design_systems',{kind:'principle',query:'nombre d’or',limit:12});
  const {page,errors,calls}=await fixture(result,{width:390,height:844});
  try{
    assert.ok(await page.locator('.principle-card').count()>0);
    assert.match(await page.locator('body').innerText(),/Application proposée/);
    assert.match(await page.locator('body').innerText(),/propriété mathématique ne démontre pas/);
    await page.locator('.principle-card details').first().locator('summary').click();
    assert.ok(await page.locator('.principle-card .sources a').count()>0);
    for(const query of ["nombre d'or",'fibonaci']){
      await page.locator('#principleQuery').fill(query);
      await page.locator('#principleSearch button').click();
      await page.waitForFunction(q=>document.querySelector('#principleQuery')?.value===q,query);
      assert.ok(await page.locator('.principle-card').count()>0);
    }
    assert.deepEqual(calls.map(x=>x.args.query),["nombre d'or",'fibonaci']);
    assert.ok(calls.every(x=>x.name==='search_design_systems'&&x.args.kind==='principle'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
    await screenshot(page,'principles-390.png');
  }finally{await page.close();}
});

test('unmatched and markup-like principle queries stay explicit and inert',async()=>{
  const result=await tool('search_design_systems',{kind:'principle',query:'qxzvnjk987654321',limit:12});
  const {page,errors}=await fixture(result,{width:390,height:844});
  try{
    assert.equal(await page.locator('.principle-card').count(),0);
    assert.match(await page.locator('body').innerText(),/0 correspondances/);
    const query='<img src=x onerror=alert(1)>';
    await page.locator('#principleQuery').fill(query);await page.locator('#principleSearch button').click();
    await page.waitForFunction(q=>document.querySelector('#principleQuery')?.value===q,query);
    assert.equal(await page.locator('#root img').count(),0);
    assert.match(await page.locator('body').innerText(),/Aucune fiche/);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
