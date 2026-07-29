import { SITE } from "../lib/site-config.js";
import { setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

export default async function (_req, res) {
  setCommonHeaders(res, "text/plain; charset=utf-8");
  return res.send(`User-agent: *
Allow: /
Sitemap: ${SITE.siteUrl}/sitemap.xml
`);
}
