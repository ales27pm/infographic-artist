// A single immutable API file avoids partial shared-module updates in the hosted isolate.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const esbuild=require(process.env.INFOGRAPHIC_ESBUILD_PATH||'esbuild');
if(esbuild.version!=='0.27.3')throw new Error('Use the pinned esbuild 0.27.3 for reproducible artifacts.');
const destination=path.join(root,'deployment/public-mcp.bundle.js');
const result=await esbuild.build({absWorkingDir:root,entryPoints:['deployment/hatchable/api/chatgpt-mcp.js'],outfile:destination,bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',charset:'utf8',external:['hatchable'],plugins:[{name:'hatchable-pool',setup(build){build.onResolve({filter:/^lib\//},args=>{const generated=path.join(root,'deployment/hatchable',args.path);return {path:fs.existsSync(generated)?generated:path.join(root,'hatchable',args.path)};});}}]});
let bundled=result.outputFiles[0].text;
const trailer='export {\n  access,\n  chatgpt_mcp_default as default,\n  methods\n};';
if(!bundled.includes(trailer))throw new Error('Unexpected compiler export shape; review before shipping.');
bundled=bundled.replace('var access = "public";','').replace('var methods = ["POST", "OPTIONS"];','').replace(trailer,'export const access = "public";\nexport const methods = ["POST", "OPTIONS"];\nexport default async function(req,res){return chatgpt_mcp_default(req,res);}');
const bytes=Buffer.from(bundled);
const release=JSON.parse(fs.readFileSync(path.join(root,'deployment/hatchable/manifest.json'),'utf8')).release;
// The old shared data pool is retained for supporting pages. The actual MCP runtime is self-contained.
const health=`import { atlasSummary } from "lib/core.js";\nexport const access="public";\nconst release=${JSON.stringify(release)};\nexport default async function(_req,res){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");return res.json({status:"ok",app:"Infographic Artist",version:"1.1.0-hatchable.1",transport:"hatchable-stateless-jsonrpc",mcp_path:"/api/chatgpt-mcp",tool_count:9,image_generation:{mode:"host_native",plugin_rendering_available:false},release,...await atlasSummary()});}\n`;
const outputs={'deployment/public-mcp.bundle.js':bytes,'deployment/public-health.js':Buffer.from(health)};
const metadata={release,compiler:'esbuild 0.27.3',mapping:{'api/chatgpt-mcp.js':{source:'deployment/public-mcp.bundle.js',sha256:crypto.createHash('sha256').update(bytes).digest('hex')},'pages/health.js':{source:'deployment/public-health.js',sha256:crypto.createHash('sha256').update(health).digest('hex')}}};
outputs['deployment/public-manifest.json']=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
for(const [relative,content] of Object.entries(outputs)){
 const target=path.join(root,relative);
 if(process.argv.includes('--check')){if(!fs.existsSync(target)||!fs.readFileSync(target).equals(content))throw new Error('Stale artifact: '+relative);}else fs.writeFileSync(target,content);
}
console.log(JSON.stringify({bytes:bytes.length,...metadata},null,2));
