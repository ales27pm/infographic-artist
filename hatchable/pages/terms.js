import { SITE, TERMS_SECTIONS } from "../lib/site-config.js";
import { esc, page, sections, setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

export default async function (_req, res) {
  setCommonHeaders(res);
  return res.send(
    page({
      title: "Terms of Service",
      description:
        "Terms of service for Infographic Artist by 27pm, including permitted use, IP boundaries, disclaimers, and Quebec governing law.",
      path: "/terms",
      children: `
<header class="content-shell">
  <div class="content-meta">
    <p class="eyebrow">${esc(SITE.productName)}</p>
    <p>Effective: ${esc(SITE.effectiveDate)}</p>
    <p>Last updated: ${esc(SITE.lastUpdatedDate)}</p>
  </div>
  <div>
    <h1 class="page-title">Terms of Service</h1>
    <p class="lede">These terms govern use of ${esc(SITE.productName)}, a read-only MCP design research and critique app published by ${esc(
        SITE.publisherName,
      )}.</p>
  </div>
</header>
<div class="content-shell">
  <div></div>
  <div>
    ${sections(TERMS_SECTIONS)}
  </div>
</div>
`,
    }),
  );
}
