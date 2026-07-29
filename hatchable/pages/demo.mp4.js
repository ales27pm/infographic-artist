export const access = "public";
export const methods = ["GET", "HEAD"];

export default async function (_req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(404).send("demo.mp4 is not available until a real MP4 recording is supplied.\n");
}
