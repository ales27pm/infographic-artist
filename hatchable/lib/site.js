import { LEGAL_LINKS, NAVIGATION, SITE } from "./site-config.js";

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function list(items, className = "") {
  return `<ul${className ? ` class="${esc(className)}"` : ""}>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

export function paragraphs(items) {
  return items.map((item) => `<p>${esc(item)}</p>`).join("");
}

export function sections(items) {
  return items
    .map(
      (item) =>
        `<section class="content-section" aria-labelledby="${slug(item.heading)}"><h2 id="${slug(item.heading)}">${esc(
          item.heading,
        )}</h2>${paragraphs(item.body)}</section>`,
    )
    .join("");
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function css() {
  return `
:root {
  color-scheme: light;
  --paper: #f7f7f4;
  --paper-2: #ece9e2;
  --ink: #151512;
  --muted: #56564f;
  --line: #c8c4b8;
  --line-strong: #8f8b80;
  --accent: #b83f24;
  --accent-2: #1f6f63;
  --panel: #ffffff;
  --focus: #005fcc;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); }
body {
  margin: 0;
  background:
    linear-gradient(90deg, rgba(21,21,18,.055) 1px, transparent 1px),
    linear-gradient(180deg, rgba(21,21,18,.045) 1px, transparent 1px),
    var(--paper);
  background-size: 48px 48px;
  font-size: 16px;
  line-height: 1.55;
  letter-spacing: 0;
}
a { color: inherit; text-decoration-color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: .22em; }
a:hover { color: var(--accent); }
a:focus-visible, button:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
img { display: block; max-width: 100%; height: auto; }
.skip-link {
  position: absolute;
  left: 1rem;
  top: .75rem;
  z-index: 10;
  transform: translateY(-150%);
  background: var(--ink);
  color: #fff;
  padding: .65rem .85rem;
}
.skip-link:focus { transform: translateY(0); }
.site-header {
  border-bottom: 1px solid var(--line);
  background: rgba(247,247,244,.96);
}
.header-inner, .footer-inner, main {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
}
.header-inner {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: .72rem;
  text-decoration: none;
}
.brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ink);
  background: var(--ink);
  color: var(--paper);
  font-size: .82rem;
  font-weight: 820;
}
.brand-name { display: block; font-weight: 760; line-height: 1; }
.brand-subtitle { display: block; color: var(--muted); font-size: .78rem; margin-top: .18rem; }
.nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: .35rem .85rem;
  font-size: .93rem;
}
.nav a {
  padding: .52rem .18rem;
  color: var(--muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
}
.nav a[aria-current="page"], .nav a:hover { color: var(--ink); border-color: var(--accent); }
main { padding: 56px 0 88px; }
.eyebrow {
  color: var(--accent);
  font-size: .76rem;
  font-weight: 760;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(300px, .92fr);
  gap: clamp(1.5rem, 4vw, 4rem);
  align-items: start;
  padding-bottom: 54px;
  border-bottom: 2px solid var(--ink);
}
h1, h2, h3 {
  letter-spacing: 0;
  line-height: 1.05;
  margin: 0;
}
h1 {
  max-width: 880px;
  font-size: clamp(3.2rem, 13vw, 9.6rem);
  font-weight: 820;
  text-transform: uppercase;
}
.page-title {
  max-width: 920px;
  font-size: clamp(2.55rem, 7.5vw, 5.8rem);
  margin-top: .45rem;
}
.lede {
  max-width: 820px;
  color: #2f2f2b;
  font-size: clamp(1.08rem, 1.55vw, 1.32rem);
  margin: 1.2rem 0 0;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .7rem;
  margin-top: 1.7rem;
}
.button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ink);
  background: var(--ink);
  color: #fff;
  padding: .72rem 1rem;
  text-decoration: none;
  font-weight: 720;
}
.button.secondary {
  background: transparent;
  color: var(--ink);
}
.button:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.facts-panel {
  background: var(--panel);
  border: 1px solid var(--ink);
  padding: 1rem;
  box-shadow: 10px 10px 0 var(--ink);
}
.facts-panel h2 { font-size: 1.05rem; margin-bottom: .8rem; }
.fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}
.fact {
  min-height: 76px;
  padding: .78rem;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: .9rem;
}
.fact strong {
  display: block;
  color: var(--ink);
  font-size: 1.4rem;
  line-height: 1.05;
  margin-bottom: .25rem;
}
.section {
  padding: 58px 0;
  border-bottom: 1px solid var(--line);
}
.section-header {
  display: grid;
  grid-template-columns: minmax(160px, 260px) minmax(0, 1fr);
  gap: 1.5rem;
  margin-bottom: 1.2rem;
}
.section h2, .content-section h2 {
  font-size: clamp(1.65rem, 3vw, 2.6rem);
}
.section .section-copy {
  color: var(--muted);
  max-width: 720px;
  margin: 0;
}
.workflow-grid, .card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.workflow, .card {
  background: var(--paper);
  min-height: 160px;
  padding: 1rem;
}
.workflow h3, .card h3 {
  font-size: 1.1rem;
  margin-bottom: .6rem;
}
.workflow p, .card p {
  color: var(--muted);
  margin: 0;
}
.rail-list {
  display: grid;
  gap: .65rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.rail-list li {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr);
  gap: .85rem;
  align-items: baseline;
  padding: .78rem 0;
  border-bottom: 1px solid var(--line);
}
.rail-list span {
  color: var(--accent);
  font-weight: 780;
  font-variant-numeric: tabular-nums;
}
.plain-list {
  display: grid;
  gap: .45rem;
  margin: 1rem 0 0;
  padding-left: 1.1rem;
  color: var(--muted);
}
.screens {
  display: grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 1rem;
  align-items: start;
}
.screen-stack {
  display: grid;
  gap: 1rem;
}
.interface-panel {
  min-height: 24rem;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 1rem;
  background:
    linear-gradient(90deg, rgba(17, 17, 15, .04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(17, 17, 15, .04) 1px, transparent 1px),
    var(--panel);
  background-size: 24px 24px;
  border: 1px solid var(--line-strong);
  padding: 1rem;
}
.interface-panel.compact {
  min-height: 13.5rem;
}
.panel-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: .75rem;
}
.panel-tabs {
  display: flex;
  gap: .35rem;
}
.panel-tabs span {
  width: .55rem;
  height: .55rem;
  border: 1px solid var(--ink);
  background: var(--paper);
}
.panel-label {
  color: var(--muted);
  font-size: .78rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.atlas-rows {
  display: grid;
  gap: .75rem;
}
.atlas-row {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) 4rem;
  gap: .75rem;
  align-items: center;
  padding: .75rem;
  background: rgba(255, 255, 255, .68);
  border: 1px solid var(--line);
}
.atlas-row strong,
.direction-card strong {
  font-size: .95rem;
}
.axis-stack {
  display: grid;
  gap: .7rem;
  align-content: center;
}
.axis {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) 2.5rem;
  gap: .65rem;
  align-items: center;
  color: var(--muted);
  font-size: .88rem;
}
.bar {
  height: .55rem;
  background: #dad8d0;
  position: relative;
}
.bar::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--value);
  background: var(--accent);
}
.direction-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .75rem;
}
.direction-card {
  min-height: 7rem;
  display: grid;
  align-content: space-between;
  gap: 1rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, .68);
  padding: .75rem;
}
.direction-card span {
  display: block;
  color: var(--accent);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
figure {
  margin: 0;
}
figcaption {
  color: var(--muted);
  font-size: .86rem;
  margin-top: .5rem;
}
.content-shell {
  display: grid;
  grid-template-columns: minmax(180px, 280px) minmax(0, 780px);
  gap: clamp(1.5rem, 5vw, 4rem);
  align-items: start;
}
.content-meta {
  position: sticky;
  top: 1rem;
  color: var(--muted);
  border-top: 2px solid var(--ink);
  padding-top: 1rem;
}
.content-section {
  padding: 0 0 2rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--line);
}
.content-section p, .support-intro p {
  color: #343430;
  margin: .85rem 0 0;
}
.faq-list {
  display: grid;
  gap: .8rem;
}
.faq-list details {
  background: var(--panel);
  border: 1px solid var(--line-strong);
  padding: .9rem 1rem;
}
.faq-list summary {
  cursor: pointer;
  font-weight: 750;
}
.faq-list p { color: var(--muted); }
.notice {
  border-left: 4px solid var(--accent);
  background: #fff;
  padding: 1rem;
  color: #343430;
}
.site-footer {
  border-top: 2px solid var(--ink);
  background: var(--paper-2);
}
.footer-inner {
  min-height: 104px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 0;
  color: var(--muted);
}
.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: .85rem;
}
.small-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .9em;
  overflow-wrap: anywhere;
}
@media (max-width: 860px) {
  .header-inner, .footer-inner { align-items: flex-start; flex-direction: column; padding: 1rem 0; }
  .nav { justify-content: flex-start; }
  main { padding-top: 38px; }
  .hero-grid, .section-header, .content-shell, .screens { grid-template-columns: 1fr; }
  .content-meta { position: static; }
  .workflow-grid, .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .direction-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .header-inner, .footer-inner, main { width: min(100% - 24px, 1180px); }
  .fact-grid, .workflow-grid, .card-grid { grid-template-columns: 1fr; }
  h1 { font-size: clamp(2.8rem, 18vw, 4.7rem); }
  .facts-panel { box-shadow: 6px 6px 0 var(--ink); }
  .atlas-row, .axis { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }
}`.trim();
}

function nav(path) {
  return NAVIGATION.map((item) => {
    const current = item.href === path || (path !== "/" && item.href !== "/" && path.startsWith(item.href));
    return `<a href="${esc(item.href)}"${current ? ' aria-current="page"' : ""}>${esc(item.label)}</a>`;
  }).join("");
}

function footer() {
  return `<footer class="site-footer"><div class="footer-inner"><p><strong>${esc(
    SITE.publisherName,
  )}</strong> &copy; ${esc(SITE.copyrightYear)}. ${esc(
    SITE.productName,
  )}.</p><nav class="footer-links" aria-label="Legal links">${LEGAL_LINKS.map(
    (item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`,
  ).join("")}</nav></div></footer>`;
}

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2311110f'/%3E%3Cpath d='M14 46V18h8v28zm14 0V18h22v7H36v4h12v7H36v10z' fill='%23f5f3ed'/%3E%3C/svg%3E";

function header(path) {
  return `<header class="site-header"><div class="header-inner"><a class="brand-lockup" href="/" aria-label="${esc(
    SITE.productName,
  )} home"><span class="brand-mark" aria-hidden="true">IA</span><span><span class="brand-name">${esc(
    SITE.productName,
  )}</span><span class="brand-subtitle">${esc(SITE.subtitle)}</span></span></a><nav class="nav" aria-label="Primary">${nav(
    path,
  )}</nav></div></header>`;
}

export function page({ title, description, path = "/", children }) {
  const canonical = `${SITE.siteUrl}${path === "/" ? "/" : path}`;
  const fullTitle = title.includes(SITE.productName) ? title : `${title} - ${SITE.productName}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.publisherName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<style>${css()}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header(path)}
<main id="main">${children}</main>
${footer()}
</body>
</html>`;
}

export function setCommonHeaders(res, contentType = "text/html; charset=utf-8") {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "img-src 'self' data:",
      "media-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "form-action 'none'",
      "frame-ancestors 'self' https://chatgpt.com https://platform.openai.com https://hatchable.com https://*.hatchable.com",
    ].join("; "),
  );
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
}
