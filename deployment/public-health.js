import { atlasSummary } from "lib/core.js";
export const access="public";
const release={"version":"1.1.2","profile":"public-readonly-native-images","source_sha256":"a4baad05b73f27472ed73c22125641f1ed35b0b046d91e1bc6cb078511b71f7c","widget_sha256":"e0270a3468bd83111267a1dfa770eacb3ffd2dd3541b531171bc67f2bf8b21e6","tool_count":9};
export default async function(_req,res){res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");return res.json({status:"ok",app:"Infographic Artist",version:"1.1.2-hatchable.1",transport:"hatchable-stateless-jsonrpc",mcp_path:"/api/chatgpt-mcp",tool_count:9,image_generation:{mode:"host_native",plugin_rendering_available:false},release,...await atlasSummary()});}
