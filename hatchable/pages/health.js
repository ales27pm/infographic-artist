import { APP_NAME, APP_VERSION } from "../lib/contract.js";
import { atlasSummary } from "../lib/core.js";

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
    image_generation: {
      provider: process.env.IMAGE_GENERATION_PROVIDER || "openai",
      model: process.env.IMAGE_GENERATION_MODEL || "gpt-image-2",
      retention_hours: Number(process.env.GENERATED_ASSET_RETENTION_HOURS || 168),
      openai_key_configured: Boolean(process.env.OPENAI_API_KEY),
    },
    ...summary,
  });
}
