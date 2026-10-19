import { atlasSummary } from "lib/core.js";
export const access="public";
const release={"version":"1.1.1","profile":"public-readonly-native-images","source_sha256":"49cfffe2fe540e5c138ebb4c214fa3f34f806f5538663761049ca07b9f5618c5","widget_sha256":"85310bab5780190546dc8405bcee8d8bfc30aea9485840b5fd0a678a21801038","tool_count":9};
export default async function(_req,res){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");return res.json({status:"ok",app:"Infographic Artist",version:"1.1.1-hatchable.1",transport:"hatchable-stateless-jsonrpc",mcp_path:"/api/chatgpt-mcp",tool_count:9,image_generation:{mode:"host_native",plugin_rendering_available:false},release,...await atlasSummary()});}
