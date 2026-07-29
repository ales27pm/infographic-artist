import { atlasSummary } from "../lib/core.js";
import {
  RESPONSIBLE_DESIGN_POINTS,
  SERVICE_FACTS,
  SITE,
  TOOL_NAMES,
  WORKFLOWS,
} from "../lib/site-config.js";
import { esc, list, page, setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

function factCards(summary) {
  const facts = [
    [`${SITE.toolCount}`, "read-only MCP tools"],
    [summary.brand_count || "934", "bundled identity records"],
    [summary.deep_case_count || "64", "deep brand cases"],
    [summary.graph_nodes || "159", "mechanism graph nodes"],
  ];
  return `<div class="fact-grid">${facts
    .map(([value, label]) => `<div class="fact"><strong>${esc(value)}</strong>${esc(label)}</div>`)
    .join("")}</div>`;
}

function workflowGrid() {
  return `<div class="workflow-grid">${WORKFLOWS.map(
    (item) => `<article class="workflow"><h3>${esc(item.name)}</h3><p>${esc(item.text)}</p></article>`,
  ).join("")}</div>`;
}

function toolRail() {
  return `<ol class="rail-list">${TOOL_NAMES.map(
    (name, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><code class="small-code">${esc(name)}</code></li>`,
  ).join("")}</ol>`;
}

export default async function (_req, res) {
  setCommonHeaders(res);
  const summary = await atlasSummary();

  return res.send(
    page({
      title: "Infographic Artist - Brand Research & Critique",
      description:
        "Infographic Artist is a 27pm ChatGPT MCP app for brand research, visual critique, similarity triage, and design coaching.",
      path: "/",
      children: `
<section class="hero-grid" aria-labelledby="home-title">
  <div>
    <p class="eyebrow">${esc(SITE.publisherName)} / ${esc(SITE.subtitle)}</p>
    <h1 id="home-title">Infographic<br>Artist</h1>
    <p class="lede">${esc(SITE.description)}</p>
    <div class="hero-actions" aria-label="Primary actions">
      <a class="button" href="/support">Contact support</a>
      <a class="button secondary" href="/privacy">Review privacy</a>
    </div>
  </div>
  <aside class="facts-panel" aria-labelledby="facts-title">
    <h2 id="facts-title">Public service facts</h2>
    ${factCards(summary)}
    ${list(SERVICE_FACTS.map((item) => esc(item)), "plain-list")}
  </aside>
</section>

<section class="section" aria-labelledby="workflows-title">
  <div class="section-header">
    <p class="eyebrow">Workflows</p>
    <div>
      <h2 id="workflows-title">Research, critique, and coaching in one read-only MCP surface.</h2>
      <p class="section-copy">Infographic Artist is available through ChatGPT and uses a public MCP endpoint at <span class="small-code">${esc(
        SITE.mcpUrl,
      )}</span>. It has no account system, no authentication, no commerce, no advertisements, no external writes, and no public publishing workflow.</p>
    </div>
  </div>
  ${workflowGrid()}
</section>

<section class="section" aria-labelledby="how-title">
  <div class="section-header">
    <p class="eyebrow">How it works</p>
    <div>
      <h2 id="how-title">ChatGPT calls one of nine tools when a design request matches the app.</h2>
      <p class="section-copy">The service reads its bundled atlas, graph, and design-system library locally. For image critique or comparison, ChatGPT supplies short-lived file URLs, and the app analyzes the image only for the requested result.</p>
    </div>
  </div>
  ${toolRail()}
</section>

<section class="section" aria-labelledby="screens-title">
  <div class="section-header">
    <p class="eyebrow">Interface</p>
    <div>
      <h2 id="screens-title">Designed for structured review, not generic generation.</h2>
      <p class="section-copy">The ChatGPT widget presents atlas findings, creative routes, and critique outputs as compact research artifacts with explicit boundaries and measurable next steps.</p>
    </div>
  </div>
  <div class="screens">
    <figure>
      <div class="interface-panel" role="img" aria-label="Abstract interface panel showing brand atlas precedent rows">
        <div class="panel-chrome"><span class="panel-label">Brand atlas</span><span class="panel-tabs"><span></span><span></span><span></span></span></div>
        <div class="atlas-rows">
          <div class="atlas-row"><strong>Grid</strong><span>Swiss systems, wayfinding, editorial identity</span><span>0.91</span></div>
          <div class="atlas-row"><strong>Signal</strong><span>High recognition through restraint and compression</span><span>0.86</span></div>
          <div class="atlas-row"><strong>Motion</strong><span>Adaptable rule set across screen and print contexts</span><span>0.79</span></div>
          <div class="atlas-row"><strong>Risk</strong><span>Principle transfer without protected form copying</span><span>triage</span></div>
        </div>
      </div>
      <figcaption>Brand atlas and precedent cards.</figcaption>
    </figure>
    <div class="screen-stack">
      <figure>
        <div class="interface-panel compact" role="img" aria-label="Abstract interface panel showing three original creative directions">
          <div class="panel-chrome"><span class="panel-label">Directions</span><span class="panel-tabs"><span></span><span></span><span></span></span></div>
          <div class="direction-grid">
            <div class="direction-card"><span>01</span><strong>Measured atlas</strong></div>
            <div class="direction-card"><span>02</span><strong>Editorial instrument</strong></div>
            <div class="direction-card"><span>03</span><strong>Graph notation</strong></div>
          </div>
        </div>
        <figcaption>Original direction generation.</figcaption>
      </figure>
      <figure>
        <div class="interface-panel compact" role="img" aria-label="Abstract interface panel showing five visual critique axes">
          <div class="panel-chrome"><span class="panel-label">Critique</span><span class="panel-tabs"><span></span><span></span><span></span></span></div>
          <div class="axis-stack">
            <div class="axis"><span>Distinctive</span><span class="bar" style="--value: 74%"></span><strong>74</strong></div>
            <div class="axis"><span>Legible</span><span class="bar" style="--value: 88%"></span><strong>88</strong></div>
            <div class="axis"><span>Systemic</span><span class="bar" style="--value: 67%"></span><strong>67</strong></div>
            <div class="axis"><span>Adaptive</span><span class="bar" style="--value: 82%"></span><strong>82</strong></div>
            <div class="axis"><span>Similarity</span><span class="bar" style="--value: 32%"></span><strong>32</strong></div>
          </div>
        </div>
        <figcaption>Five-axis visual critique.</figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="privacy-summary-title">
  <div class="section-header">
    <p class="eyebrow">Data and privacy</p>
    <div>
      <h2 id="privacy-summary-title">No accounts, payments, ads, analytics, or persistent uploaded-image storage.</h2>
      <p class="section-copy">The MCP tools are read-only and do not write to external systems. Hosting infrastructure may process operational request logs, but the product does not intentionally install analytics or sell personal information.</p>
    </div>
  </div>
  <div class="card-grid">
    <article class="card"><h3>No external writes</h3><p>The service does not publish user content, send email, place orders, or modify third-party services.</p></article>
    <article class="card"><h3>Temporary image analysis</h3><p>Uploaded images are accessed through short-lived ChatGPT file URLs only for the requested critique or comparison.</p></article>
    <article class="card"><h3>Local bundled data</h3><p>Brand-atlas, graph, and design-system data are bundled with the service and read locally by the MCP tools.</p></article>
  </div>
</section>

<section class="section" aria-labelledby="responsible-title">
  <div class="section-header">
    <p class="eyebrow">Responsible design</p>
    <div>
      <h2 id="responsible-title">Principles are useful. Protected forms are not templates.</h2>
      ${list(RESPONSIBLE_DESIGN_POINTS.map((item) => esc(item)))}
    </div>
  </div>
  <p class="notice">Infographic Artist is a design research and critique tool. It is not a legal service, trademark clearance system, or professional opinion on registrability or infringement.</p>
</section>
`,
    }),
  );
}
