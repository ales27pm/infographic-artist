export const access = "public";
export const methods = ["GET"];

function getChallengeToken() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN;
  if (typeof token !== "string" || token.length === 0) return null;

  // OpenAI requires a byte-for-byte token response. Reject malformed
  // configuration instead of trimming or otherwise changing the value.
  if (token !== token.trim() || /\s/.test(token)) return null;
  return token;
}

export default async function (_req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const token = getChallengeToken();
  if (!token) return res.status(404).send("");

  return res.status(200).send(token);
}
