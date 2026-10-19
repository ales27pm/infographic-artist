import { APP_NAME, APP_VERSION, TOOLS } from 'lib/contract.js';
import { atlasSummary } from 'lib/core.js';
import { RELEASE } from 'lib/release.js';
export const access = 'public';
export default async function(_req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  return res.json({status:'ok',app:APP_NAME,version:APP_VERSION,transport:'hatchable-stateless-jsonrpc',mcp_path:'/api/chatgpt-mcp',tool_count:TOOLS.length,image_generation:{mode:'host_native',plugin_rendering_available:false},release:RELEASE,...await atlasSummary()});
}
