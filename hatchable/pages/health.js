import { APP_NAME, APP_VERSION } from "../lib/contract.js";
import { atlasSummary, generationRuntimeSummary } from "../lib/core.js";

export const access = "public";

function challengeConfigured() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN;
  return typeof token === "string" && token.length > 0 && token === token.trim() && !/\s/.test(token);
}

export default async function (_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const summary = await atlasSummary();
  return res.json({
    status: "ok",
    app: APP_NAME,
    version: APP_VERSION,
    transport: "hatchable-stateless-jsonrpc",
    mcp_path: "/api/chatgpt-mcp",
    domain_challenge_configured: challengeConfigured(),
    image_generation: generationRuntimeSummary(),
    ...summary,
  });
}
