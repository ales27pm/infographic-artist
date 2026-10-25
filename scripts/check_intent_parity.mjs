// Local-only cross-runtime acceptance test. Does not generate images or call providers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateDirections,coachDecision} from '../hatchable/lib/core.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const cases=JSON.parse(fs.readFileSync(new URL('../python/tests/fixtures/intent_cases.json',import.meta.url),'utf8'));
const code=`import json,sys\nfrom pathlib import Path\nsys.path.insert(0,'python')\nimport core\ncases=json.loads(Path('python/tests/fixtures/intent_cases.json').read_text())\nout=[]\nfor c in cases:\n a=c['args'];d=core.generate_directions(a) if c['tool']=='directions' else core.coach_decision(**a)\n out.append({'id':c['id'],'intent':d['intent_resolution'],'stages':len(d['design_workflow']['stages']),'routes':[{k:r[k] for k in ['id','architecture','concept_board_prompt','assets']} for r in d.get('routes',[])],'answer':d.get('answer')})\nprint(json.dumps(out,ensure_ascii=False))`;
const env={...process.env,PYTHONDONTWRITEBYTECODE:'1',IMAGE_GENERATION_ENABLED:'0',IMAGE_GENERATION_PROVIDER:'host_native'};delete env.OPENAI_API_KEY;
const result=spawnSync(process.env.INFOGRAPHIC_PYTHON_PATH||'python3',['-c',code],{cwd:root,encoding:'utf8',env,maxBuffer:2*1024*1024});
assert.equal(result.status,0,result.stderr);
const expected=JSON.parse(result.stdout);
for(let i=0;i<cases.length;i++){
 const c=cases[i],a=c.args,d=c.tool==='directions'?await generateDirections(a):coachDecision(a.question,a.critique,a.goal,a.design_context,a.execution);
 const actual={id:c.id,intent:d.intent_resolution,stages:d.design_workflow.stages.length,routes:(d.routes||[]).map(r=>Object.fromEntries(['id','architecture','concept_board_prompt','assets'].map(k=>[k,r[k]]))),answer:d.answer??null};
 assert.deepEqual(actual,expected[i],c.id);
}
console.log(JSON.stringify({passed:true,cases:cases.length,scope:'Python/JavaScript exact intent, route and prompt parity'},null,2));
