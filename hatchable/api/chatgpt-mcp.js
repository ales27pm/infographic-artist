import { APP_NAME, APP_VERSION, TEMPLATE_URI, MIME_TYPE, SERVER_INSTRUCTIONS, SUPPORTED_PROTOCOL_VERSIONS, TOOLS, RESOURCES, RESOURCE_TEMPLATES, TOOL_SPECS } from '../lib/contract.js';
import { loadWidgetHtml } from '../lib/data.js';
import { executeTool } from '../lib/core.js';
import { validateSchema } from '../lib/schema.js';
export const access = 'public';
export const methods = ['POST','OPTIONS'];
const ORIGINS = new Set(['https://chatgpt.com','https://chat.openai.com','https://platform.openai.com']);
const object = value => value!==null && typeof value==='object' && !Array.isArray(value);
function rpcError(res,id,code,message,status=200){return res.status(status).json({jsonrpc:'2.0',id,error:{code,message}});}
function result(res,id,value){return res.status(200).json({jsonrpc:'2.0',id,result:value});}
export default async function(req,res){
  const origin=String(req.headers?.origin||'').replace(/\/$/,'');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Vary','Origin');
  if(origin&&!ORIGINS.has(origin))return rpcError(res,null,-32000,'Origin not allowed',403);
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Accept, Authorization, MCP-Protocol-Version, MCP-Session-Id');
  if(req.method==='OPTIONS')return res.status(204).send('');
  if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');return res.status(405).send('');}
  const protocol=String(req.headers?.['mcp-protocol-version']||'');
  if(protocol&&!SUPPORTED_PROTOCOL_VERSIONS.includes(protocol))return rpcError(res,null,-32600,'Unsupported MCP-Protocol-Version',400);
  const accept=String(req.headers?.accept||'');
  if(accept&&!accept.includes('*/*')&&!accept.includes('application/json')&&!accept.includes('text/event-stream'))return rpcError(res,null,-32600,'Client must accept application/json or text/event-stream',406);
  let message=req.body;
  try{
    const raw=typeof message==='string'?message:JSON.stringify(message);
    if(raw===undefined)return rpcError(res,null,-32600,'Invalid Request',400);
    if(new TextEncoder().encode(raw).length>1000000)return rpcError(res,null,-32600,'Request too large',413);
    if(typeof message==='string')message=JSON.parse(message);
  }catch{return rpcError(res,null,-32700,'Parse error',400);}
  if(!object(message)||message.jsonrpc!=='2.0')return rpcError(res,null,-32600,'Invalid Request',400);
  const {id,method}=message;
  if(id!==undefined&&id!==null&&typeof id!=='string'&&!(typeof id==='number'&&Number.isFinite(id)))return rpcError(res,null,-32600,'Invalid request id',400);
  if(method===undefined&&('result' in message||'error' in message))return res.status(202).send('');
  if(typeof method!=='string'||!method)return rpcError(res,id??null,-32600,'Invalid Request');
  if(id===undefined)return res.status(202).send('');
  const params=message.params===undefined?{}:message.params;
  if(!object(params))return rpcError(res,id,-32602,'Params must be an object');
  if(method==='initialize')return result(res,id,{protocolVersion:SUPPORTED_PROTOCOL_VERSIONS.includes(params.protocolVersion)?params.protocolVersion:SUPPORTED_PROTOCOL_VERSIONS[0],capabilities:{tools:{listChanged:false},resources:{subscribe:false,listChanged:false}},serverInfo:{name:'infographic-artist',title:APP_NAME,version:APP_VERSION},instructions:SERVER_INSTRUCTIONS});
  if(method==='ping')return result(res,id,{});
  if(method==='tools/list')return result(res,id,{tools:TOOLS});
  if(method==='resources/list')return result(res,id,{resources:RESOURCES});
  if(method==='resources/templates/list')return result(res,id,{resourceTemplates:RESOURCE_TEMPLATES});
  if(method==='resources/read'){
    if(params.uri!==TEMPLATE_URI && !['ui://infographic-artist/app-v1.html','ui://infographic-artist/app-v1.1.1.html'].includes(params.uri))return rpcError(res,id,-32002,'Resource not found');
    return result(res,id,{contents:[{uri:params.uri,mimeType:MIME_TYPE,text:await loadWidgetHtml(),_meta:RESOURCES[0]._meta}]});
  }
  if(method!=='tools/call')return rpcError(res,id,-32601,'Method not found');
  const tool=TOOLS.find(t=>t.name===params.name);
  if(!tool)return rpcError(res,id,-32602,'Unknown or unavailable tool');
  const args=params.arguments===undefined?{}:params.arguments;
  const invalid=validateSchema(tool.inputSchema,args);
  if(invalid)return result(res,id,{content:[{type:'text',text:`Input validation error: ${invalid}`}],isError:true});
  try{
    const structured=await executeTool(tool.name,args);
    const invalidOutput=validateSchema(tool.outputSchema,structured,'result');
    if(invalidOutput)throw new Error('Tool returned an invalid result');
    return result(res,id,{content:[{type:'text',text:JSON.stringify(structured)}],structuredContent:structured,_meta:{'openai/toolInvocation/invoked':TOOL_SPECS[tool.name].invoked},isError:false});
  }catch(error){
    return result(res,id,{content:[{type:'text',text:`Infographic Artist error: ${String(error?.message||error).slice(0,500)}`}],isError:true});
  }
}
