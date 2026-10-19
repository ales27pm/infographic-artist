import { atlasSummary } from "lib/core.js";
export const access="public";
const release={"version":"1.1.0","profile":"public-readonly-native-images","source_sha256":"7a7e02bfafbd142eb59f5535e7940ba02d0298488ed8184f8c6562cafe3a7a9e","widget_sha256":"f77e6d18740e789295e5e323437e0a5e29e172ff25a634384f7de6ae0394d113","tool_count":9};
export default async function(_req,res){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");return res.json({status:"ok",app:"Infographic Artist",version:"1.1.0-hatchable.1",transport:"hatchable-stateless-jsonrpc",mcp_path:"/api/chatgpt-mcp",tool_count:9,image_generation:{mode:"host_native",plugin_rendering_available:false},release,...await atlasSummary()});}
