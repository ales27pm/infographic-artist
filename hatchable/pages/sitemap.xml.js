import { NAVIGATION, SITE } from "../lib/site-config.js";
import { esc, setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

export default async function (_req, res) {
  setCommonHeaders(res, "application/xml; charset=utf-8");
  const urls = NAVIGATION.map((item) => {
    const loc = `${SITE.siteUrl}${item.href === "/" ? "/" : item.href}`;
    return `<url><loc>${esc(loc)}</loc><lastmod>${esc(SITE.lastUpdatedIso)}</lastmod><changefreq>monthly</changefreq></url>`;
  }).join("");

  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>
`);
}
