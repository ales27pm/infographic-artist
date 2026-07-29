import { PRIVACY_SECTIONS, SITE } from "../lib/site-config.js";
import { esc, page, sections, setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

export default async function (_req, res) {
  setCommonHeaders(res);
  return res.send(
    page({
      title: "Privacy Policy",
      description:
        "Privacy policy for Infographic Artist by 27pm, including image handling, logs, retention, and user rights.",
      path: "/privacy",
      children: `
<header class="content-shell">
  <div class="content-meta">
    <p class="eyebrow">${esc(SITE.productName)}</p>
    <p>Effective: ${esc(SITE.effectiveDate)}</p>
    <p>Last updated: ${esc(SITE.lastUpdatedDate)}</p>
  </div>
  <div>
    <h1 class="page-title">Privacy Policy</h1>
    <p class="lede">This policy explains how ${esc(SITE.publisherName)} handles data for ${esc(
        SITE.productName,
      )}, a ChatGPT-accessible MCP app for brand research and critique.</p>
  </div>
</header>
<div class="content-shell">
  <div></div>
  <div>
    ${sections(PRIVACY_SECTIONS)}
    <section class="content-section" aria-labelledby="privacy-contact">
      <h2 id="privacy-contact">Contact</h2>
      <p>Privacy questions and requests should be sent through <a href="/support">support</a>.</p>
    </section>
  </div>
</div>
`,
    }),
  );
}
