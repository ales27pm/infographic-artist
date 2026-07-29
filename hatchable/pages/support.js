import { SITE, SUPPORT_FAQS, SUPPORT_REQUEST_ITEMS } from "../lib/site-config.js";
import { esc, list, page, setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

function supportContact() {
  if (SITE.support.email) {
    return `<p>Email: <a href="mailto:${esc(SITE.support.email)}">${esc(SITE.support.email)}</a></p>`;
  }

  return `<p>Email: <strong class="small-code">${esc(SITE.support.placeholder)}</strong></p><p>${esc(SITE.support.note)}</p>`;
}

function faqs() {
  return `<div class="faq-list">${SUPPORT_FAQS.map(
    (item) =>
      `<details><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`,
  ).join("")}</div>`;
}

export default async function (_req, res) {
  setCommonHeaders(res);
  return res.send(
    page({
      title: "Support",
      description:
        "Support for Infographic Artist by 27pm, including contact, common questions, troubleshooting, and privacy request guidance.",
      path: "/support",
      children: `
<header class="content-shell">
  <div class="content-meta">
    <p class="eyebrow">${esc(SITE.publisherName)} support</p>
    <p>${esc(SITE.productName)}</p>
    <p>No guaranteed response time or SLA is currently published.</p>
  </div>
  <div class="support-intro">
    <h1 class="page-title">Support</h1>
    <p class="lede">${esc(
      SITE.productName,
    )} support covers product questions, MCP failures, data corrections, accessibility issues, harmful or infringing content reports, and privacy requests.</p>
  </div>
</header>

<div class="content-shell">
  <div></div>
  <div>
    <section class="content-section" aria-labelledby="contact-title">
      <h2 id="contact-title">Contact</h2>
      ${supportContact()}
      <p>${esc(SITE.publisherName)} reviews support messages when available, but no response time is guaranteed.</p>
    </section>

    <section class="content-section" aria-labelledby="faq-title">
      <h2 id="faq-title">Common questions</h2>
      ${faqs()}
    </section>

    <section class="content-section" aria-labelledby="troubleshooting-title">
      <h2 id="troubleshooting-title">Troubleshooting steps</h2>
      ${list(
        [
          "Confirm the request matches one of the supported Infographic Artist workflows.",
          "Name the desired tool or workflow explicitly in ChatGPT.",
          "For image tools, upload a supported image file through ChatGPT instead of pasting private or credential-bearing URLs.",
          "Retry once after a short pause if ChatGPT or the MCP server reports a transient failure.",
          "If the issue continues, send a concise support request with the information below.",
        ].map((item) => esc(item)),
      )}
    </section>

    <section class="content-section" aria-labelledby="request-title">
      <h2 id="request-title">What to include in a support request</h2>
      ${list(SUPPORT_REQUEST_ITEMS.map((item) => esc(item)))}
      <p>Do not include passwords, API keys, unreleased client artwork, unnecessary personal information, or confidential documents.</p>
    </section>

    <section class="content-section" aria-labelledby="policies-title">
      <h2 id="policies-title">Policies</h2>
      <p>Read the <a href="/privacy">privacy policy</a> and <a href="/terms">terms of service</a> for data handling, legal boundaries, and permitted use.</p>
    </section>
  </div>
</div>
`,
    }),
  );
}
