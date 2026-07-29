export const SITE = {
  productName: "Infographic Artist",
  publisherName: "27pm",
  subtitle: "Brand research & critique",
  siteUrl: "https://infographic-artist-1w7v.hatchable.site",
  mcpUrl: "https://infographic-artist-1w7v.hatchable.site/api/chatgpt-mcp",
  versionLabel: "v1.0.0",
  toolCount: 12,
  copyrightYear: "2026",
  effectiveDate: "July 29, 2026",
  lastUpdatedDate: "July 29, 2026",
  lastUpdatedIso: "2026-07-29",
  support: {
    email: "support@27pm.org",
    placeholder: "SUPPORT_EMAIL_REQUIRED",
    note: "Support mailbox confirmed by the publisher.",
  },
  description:
    "Infographic Artist helps designers study iconic brand systems, navigate a mechanism graph, compare precedents, generate original creative directions, render plugin-side concept boards, critique visual proposals on five axes, triage perceptual similarity, and turn feedback into measurable design exercises.",
};

export const NAVIGATION = [
  { href: "/", label: "Overview" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
];

export const LEGAL_LINKS = NAVIGATION.filter((item) => item.href !== "/");

export const TOOL_NAMES = [
  "open_brand_atlas",
  "get_brand_case",
  "compare_brand_systems",
  "explore_brand_graph",
  "search_design_systems",
  "generate_brand_directions",
  "render_brand_direction",
  "run_brand_workflow",
  "get_render_job",
  "critique_brand_image",
  "compare_brand_images",
  "coach_brand_decision",
];

export const WORKFLOWS = [
  {
    name: "Brand atlas",
    text: "Browse curated identity-system records by era, region, sector, mechanism, and production pattern.",
  },
  {
    name: "Brand case studies",
    text: "Open deeper cases for mechanism notes, transferable principles, stress tests, and anti-copy boundaries.",
  },
  {
    name: "Brand-system comparison",
    text: "Compare two to four precedents by structure, typography, palette logic, and collision risk.",
  },
  {
    name: "Knowledge graph",
    text: "Move through connected mechanisms, asset layers, studios, regions, and system patterns.",
  },
  {
    name: "Graphic-systems library",
    text: "Search design manuals, studios, schools, and methods as factual research references.",
  },
  {
    name: "Original direction generation",
    text: "Generate three structurally distinct creative routes and plugin-ready concept-board prompts without copying protected forms.",
  },
  {
    name: "Plugin-side rendering",
    text: "Start asynchronous concept-board rendering jobs through the image-generation provider, store generated assets, and poll status.",
  },
  {
    name: "Visual critique",
    text: "Critique uploaded proposals on composition, hierarchy, legibility, memorability, and differentiation.",
  },
  {
    name: "Similarity-risk analysis",
    text: "Triage perceptual similarity across silhouette, edge structure, colour, mass, composition, and reduction.",
  },
  {
    name: "Design coaching",
    text: "Turn critique into a 45-90 minute exercise with measurable acceptance criteria.",
  },
];

export const SERVICE_FACTS = [
  "Available through ChatGPT",
  "Uses a public MCP server",
  "No separate account required",
  "No authentication required",
  "No commerce or payment processing",
  "No advertisements",
  "Image rendering may call OpenAI's image-generation API",
  "Does not publish user content",
];

export const RESPONSIBLE_DESIGN_POINTS = [
  "Infographic Artist transfers principles, not protected forms.",
  "It does not help users create near-copies of protected logos, marks, mascots, signature typography, trade dress, or colour systems.",
  "Visual-similarity results are design triage signals, not legal advice, trademark clearance, or permission to launch.",
];

export const PRIVACY_SECTIONS = [
  {
    heading: "Who operates this product",
    body: [
      "Infographic Artist is published and operated by 27pm. The product is a ChatGPT-accessible MCP app for brand research and critique.",
    ],
  },
  {
    heading: "Accounts, commerce, and advertising",
    body: [
      "Infographic Artist itself does not require user accounts, login, authentication, payment, checkout, subscriptions, advertising, or ad targeting.",
      "No product analytics are intentionally installed in the site or MCP service.",
    ],
  },
  {
    heading: "Information processed",
    body: [
      "The MCP tools receive only the arguments needed for the requested brand research, comparison, critique, similarity triage, or coaching workflow.",
      "Creative-direction outputs include concept-board prompts. When rendering tools are used, Infographic Artist sends the selected prompt and rendering options to the configured image-generation provider, stores the generated asset, and returns a job status link.",
      "For uploaded-image critique or comparison, ChatGPT supplies a short-lived file URL and file metadata. Infographic Artist accesses the image temporarily to complete the requested analysis.",
      "Bundled brand-atlas, knowledge-graph, and graphic-system data are read locally by the service.",
    ],
  },
  {
    heading: "Uploaded images",
    body: [
      "The plugin does not persist uploaded images. Image analysis is performed temporarily for the requested critique or comparison, and the app does not maintain an image archive.",
      "Uploaded images are accessed only through short-lived URLs supplied by ChatGPT. Users should not upload material they do not have the right to evaluate.",
    ],
  },
  {
    heading: "Tool actions",
    body: [
      "Atlas, case, comparison, graph, library, direction generation, critique, similarity, coaching, and render-status tools are read-only from the user's perspective.",
      "render_brand_direction and run_brand_workflow are non-destructive generation actions. They may call the configured image-generation provider, incur provider costs for the operator, and create generated image assets in the app's configured storage.",
      "The app does not publish content, write to third-party services, send email, create accounts, place orders, or post user material publicly.",
    ],
  },
  {
    heading: "Hosting and operational logs",
    body: [
      "Basic hosting infrastructure may process technical logs such as request time, route, status code, IP-related network metadata, and user agent, subject to the host's operation.",
      "27pm does not promise zero operational logs because hosting and network providers may retain logs for security, abuse prevention, debugging, and reliability.",
      "The product does not intentionally set tracking cookies. Hosting platforms may set operational cookies or security tokens required to deliver and protect the site.",
    ],
  },
  {
    heading: "Retention",
    body: [
      "Infographic Artist does not maintain user profiles, payment records, persistent uploaded-image storage, or a public content database.",
      "Generated render-job metadata and generated image assets are retained only for the configured generated-asset retention window, 168 hours by default, and are then eligible for deletion.",
      "Temporary request data is used to answer the active request. Operational logs, if any, are retained according to the hosting provider's normal infrastructure practices.",
    ],
  },
  {
    heading: "Sale of personal information",
    body: [
      "27pm does not sell personal information from Infographic Artist. The product has no advertising business model and no commerce flow.",
    ],
  },
  {
    heading: "Security",
    body: [
      "The service is designed around no user account database, no payment collection, no public publishing, and only narrowly scoped generation actions.",
      "Image inputs are limited to supported public HTTPS file URLs and supported image types. Private, local, reserved, or credential-bearing URLs are rejected by the service.",
      "Generated-asset URLs are scoped to opaque render job IDs and filenames, but users should avoid sending secrets or confidential material in prompts.",
      "No security measure is perfect. Users should avoid submitting secrets, unreleased client artwork, personal documents, or regulated information unless they are comfortable with ChatGPT and the hosting path processing it for the request.",
    ],
  },
  {
    heading: "International access",
    body: [
      "Infographic Artist may be accessed internationally through ChatGPT and the public website. Technical processing may occur in Canada, the United States, or other locations used by hosting, network, and ChatGPT infrastructure.",
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      "The product is available to a general audience but is not marketed to children under 13. 27pm does not knowingly collect personal information from children under 13 through Infographic Artist.",
    ],
  },
  {
    heading: "Your rights and contact",
    body: [
      "Users may contact 27pm to ask privacy questions, request correction of inaccurate support information, or raise concerns about data handling.",
      "Use the support page for privacy requests and include enough context to identify the relevant request without sending passwords, API keys, confidential client artwork, or unrelated personal data.",
    ],
  },
];

export const TERMS_SECTIONS = [
  {
    heading: "Acceptance of terms",
    body: [
      "By using Infographic Artist through ChatGPT or visiting this site, you agree to these terms. If you do not agree, do not use the service.",
    ],
  },
  {
    heading: "Description of service",
    body: [
      "Infographic Artist is an MCP-based design research, rendering, and critique app by 27pm. It provides tools for brand-system research, precedent comparison, knowledge-graph exploration, original direction generation, plugin-side concept-board rendering, uploaded-image critique, perceptual-similarity triage, and design coaching.",
      "The service is available through ChatGPT, requires no separate account with 27pm, has no authentication flow, includes no commerce, and contains no advertising.",
    ],
  },
  {
    heading: "Eligibility",
    body: [
      "The product is available to a general audience but is not marketed to children under 13. If you are not old enough to accept these terms under applicable law, use the service only with involvement of a parent, guardian, or authorized organization.",
    ],
  },
  {
    heading: "Permitted use",
    body: [
      "You may use Infographic Artist for lawful design research, critique, education, creative exploration, and internal review.",
      "You remain responsible for deciding whether outputs are suitable for a client, production, launch, filing, publication, or commercial use.",
    ],
  },
  {
    heading: "Prohibited use",
    body: [
      "Do not use the service to copy, imitate, reconstruct, or make near-copies of protected marks, logos, mascots, signature typography, trade dress, protected colour systems, or other third-party intellectual property.",
      "Do not submit material you do not have the right to evaluate. Do not use the service for unlawful, infringing, deceptive, harmful, or abusive content.",
      "Do not attempt to bypass tool limits, scrape the service, interfere with the MCP server, or use outputs to misrepresent affiliation, endorsement, sponsorship, or clearance.",
    ],
  },
  {
    heading: "User responsibility for uploaded material",
    body: [
      "You retain responsibility for images, marks, layouts, prompts, and context you provide through ChatGPT. You should remove confidential or personal material that is not needed for the critique.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "27pm owns or licenses the Infographic Artist service, site text, tool implementation, original icon assets, and bundled research structure, except for rights held by others.",
      "Third-party brand names may appear as factual references in research data. Their appearance does not imply endorsement, affiliation, sponsorship, or permission.",
      "27pm makes no ownership claim over third-party trademarks, logos, brand names, or protected forms. Historical precedents are used to explain methods and design principles, not to provide templates or licenses.",
      "Concept-board prompts and plugin-rendered boards are creative exploration outputs, not finished brand assets, image-generation service promises, or trademark clearance.",
      "You retain rights you already hold in uploaded materials. Service-generated output is provided for creative and educational assistance and should be independently reviewed before commercial use.",
    ],
  },
  {
    heading: "No professional or legal advice",
    body: [
      "Infographic Artist does not provide legal, trademark, business, accessibility, production, or other professional advice.",
      "Similarity analysis is a perceptual design triage signal, not a trademark clearance opinion, freedom-to-operate analysis, registration opinion, or legal approval.",
    ],
  },
  {
    heading: "Availability and changes",
    body: [
      "27pm may update, limit, suspend, or discontinue the site or MCP service. Features, tool descriptions, and bundled research data may change over time.",
    ],
  },
  {
    heading: "Disclaimer of warranties",
    body: [
      "The service is provided as is and as available. To the extent permitted by applicable law, 27pm disclaims warranties of accuracy, completeness, non-infringement, merchantability, fitness for a particular purpose, uninterrupted availability, and error-free operation.",
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "To the extent permitted by applicable law, 27pm will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, business interruption, failed launches, or third-party claims arising from use of the service.",
      "Nothing in these terms limits liability that cannot be limited under applicable law.",
    ],
  },
  {
    heading: "Suspension or termination",
    body: [
      "27pm may restrict access to the service when needed to protect the service, comply with law, respond to abuse, or address use that appears to violate these terms.",
    ],
  },
  {
    heading: "Governing law",
    body: [
      "These terms are governed by the laws applicable in the Province of Quebec and the federal laws of Canada applicable there, without inventing any separate corporate address or registration details in these terms.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about these terms should be sent through the support page.",
    ],
  },
];

export const SUPPORT_FAQS = [
  {
    question: "How do I use Infographic Artist in ChatGPT?",
    answer:
      "Open ChatGPT, choose the Infographic Artist plugin or app when available, and ask for a brand atlas search, case study, comparison, graph exploration, original direction, plugin-side concept-board rendering, uploaded-image critique, similarity triage, or coaching exercise.",
  },
  {
    question: "What image formats are supported?",
    answer:
      "Image critique and similarity tools accept supported ChatGPT file inputs when they are supplied as public short-lived HTTPS file URLs with PNG, JPEG, WebP, or GIF MIME types. Damaged, private, credential-bearing, oversized, or unsupported files may be rejected.",
  },
  {
    question: "Are uploaded images stored?",
    answer:
      "Uploaded images are not persisted. Plugin-rendered concept boards and their job metadata are stored only as generated assets for the configured retention window, 168 hours by default.",
  },
  {
    question: "Why did a tool not trigger?",
    answer:
      "ChatGPT decides when to call tools. Ask for one of the supported workflows by name, provide the needed brief or image, and avoid asking Infographic Artist to perform unrelated actions such as sending email, publishing content, making purchases, or modifying external systems.",
  },
  {
    question: "Is critique the same as legal trademark clearance?",
    answer:
      "No. Critique and similarity analysis are design triage. They can highlight visual risks, but they are not legal advice, trademark clearance, or a substitute for professional review.",
  },
  {
    question: "What should I do when an MCP request fails?",
    answer:
      "Retry once, simplify the request, confirm the uploaded file is a supported image, remove private or credential-bearing URLs, and include the tool name and approximate request time in a support message if the issue continues.",
  },
  {
    question: "How do I report harmful or infringing content?",
    answer:
      "Use the support process and describe the content, why it may be harmful or infringing, the tool used, and enough context to reproduce the concern without sending secrets or confidential client material.",
  },
  {
    question: "Can I request accessibility support?",
    answer:
      "Yes. Report the affected page, device, browser, assistive technology if relevant, and the barrier you encountered.",
  },
  {
    question: "How do I make a privacy request?",
    answer:
      "Use the support page and label the message as a privacy request. Include only the information needed to identify the request.",
  },
];

export const SUPPORT_REQUEST_ITEMS = [
  "Tool name or page path.",
  "Expected result and observed result.",
  "Approximate request time and time zone.",
  "Browser or ChatGPT surface used.",
  "For image issues, file type and size, without attaching confidential artwork unless necessary.",
  "Screenshots with client secrets and unreleased material removed.",
];
