import { page, setCommonHeaders } from "../lib/site.js";

export const access = "public";
export const methods = ["GET"];

export default async function (_req, res) {
  setCommonHeaders(res);
  return res.status(404).send(
    page({
      title: "Page Not Found",
      description: "The requested Infographic Artist page was not found.",
      path: "/404",
      children: `
<section class="hero-grid" aria-labelledby="missing-title">
  <div>
    <p class="eyebrow">404</p>
    <h1 id="missing-title" class="page-title">Page not found</h1>
    <p class="lede">The page you requested does not exist on the Infographic Artist public site.</p>
    <div class="hero-actions">
      <a class="button" href="/">Return home</a>
      <a class="button secondary" href="/support">Contact support</a>
    </div>
  </div>
</section>
`,
    }),
  );
}
