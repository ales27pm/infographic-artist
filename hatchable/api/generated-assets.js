import { getGeneratedAsset } from "../lib/core.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const jobId = String(req.query?.job_id || "");
    const filename = String(req.query?.filename || "");
    const asset = getGeneratedAsset(jobId, filename);
    res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
    return res.send(asset.bytes);
  } catch (error) {
    res.statusCode = 404;
    return res.json({ error: error?.message || "Generated asset not found." });
  }
}
