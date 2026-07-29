import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./site-server.mjs";
import { SITE } from "../lib/site-config.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REQUIRE_PRODUCTION = process.argv.includes("--require-production");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function titleOf(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

function hrefs(html) {
  return [...html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/demo.mp4"));
}

function isMp4(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

async function main() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  async function request(path, init = {}) {
    const res = await fetch(`${base}${path}`, init);
    const body = init.method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
    return { res, body, text: body.toString("utf8") };
  }

  try {
    const pages = {
      "/": await request("/"),
      "/privacy": await request("/privacy"),
      "/terms": await request("/terms"),
      "/support": await request("/support"),
    };

    assert(pages["/"].res.status === 200, "GET / must return 200");
    assert(pages["/"].text.includes("Infographic Artist"), "home must contain Infographic Artist");
    assert(pages["/privacy"].res.status === 200, "GET /privacy must return 200");
    assert(/<h1[^>]*>Privacy Policy<\/h1>/i.test(pages["/privacy"].text), "privacy must contain privacy-policy heading");
    assert(pages["/terms"].res.status === 200, "GET /terms must return 200");
    assert(/<h1[^>]*>Terms of Service<\/h1>/i.test(pages["/terms"].text), "terms must contain terms heading");
    assert(pages["/support"].res.status === 200, "GET /support must return 200");
    assert(/<h1[^>]*>Support<\/h1>/i.test(pages["/support"].text), "support must contain support content");

    const titles = Object.values(pages).map((page) => titleOf(page.text));
    assert(titles.every(Boolean), "all HTML pages must have titles");
    assert(new Set(titles).size === titles.length, "all four HTML pages must have distinct titles");
    assert(pages["/privacy"].text !== pages["/"].text, "privacy must not return homepage body");
    assert(pages["/terms"].text !== pages["/"].text, "terms must not return homepage body");
    assert(pages["/support"].text !== pages["/"].text, "support must not return homepage body");

    const banned = [/Coming Soon/i, /DaftCitadel/i, /lorem ipsum/i, /noindex/i];
    for (const [route, page] of Object.entries(pages)) {
      for (const pattern of banned) {
        assert(!pattern.test(page.text), `${route} must not contain ${pattern}`);
      }
    }

    const internalLinks = new Set(Object.values(pages).flatMap((page) => hrefs(page.text)));
    for (const link of internalLinks) {
      const linked = await request(link, { method: "HEAD" });
      assert(linked.res.status < 400, `internal link must resolve: ${link}`);
    }

    const robots = await request("/robots.txt");
    assert(robots.res.status === 200, "robots.txt must return 200");
    assert((robots.res.headers.get("content-type") || "").includes("text/plain"), "robots.txt must be text/plain");
    assert(/User-agent:\s*\*/.test(robots.text), "robots.txt must include User-agent");
    assert(robots.text.includes(`${SITE.siteUrl}/sitemap.xml`), "robots.txt must reference sitemap");

    const sitemap = await request("/sitemap.xml");
    assert(sitemap.res.status === 200, "sitemap.xml must return 200");
    assert((sitemap.res.headers.get("content-type") || "").includes("application/xml"), "sitemap.xml must be XML");
    for (const route of Object.keys(pages)) {
      const loc = `${SITE.siteUrl}${route === "/" ? "/" : route}`;
      assert(sitemap.text.includes(`<loc>${loc}</loc>`), `sitemap must include ${loc}`);
    }

    const missing = await request("/missing-route");
    assert(missing.res.status === 404, "unknown route must return 404");
    assert(/Page not found/i.test(missing.text), "404 page must contain page not found");

    const demo = await request("/demo.mp4");
    if (demo.res.status === 200) {
      assert((demo.res.headers.get("content-type") || "").includes("video/mp4"), "demo.mp4 must be video/mp4");
      assert(demo.body.length > 0, "demo.mp4 must be non-zero");
      assert(isMp4(demo.body), "demo.mp4 body must begin with an ISO BMFF MP4 signature");
    } else {
      assert(demo.res.status === 404, "demo.mp4 must return 404 when no real MP4 is present");
      assert(!(demo.res.headers.get("content-type") || "").includes("text/html"), "missing demo.mp4 must not be HTML");
    }

    if (REQUIRE_PRODUCTION) {
      const blockers = [];
      if (!SITE.support.email) {
        blockers.push("production build requires a verified support email in SITE.support.email");
      }
      if (demo.res.status !== 200) {
        blockers.push("production build requires hatchable/public/demo.mp4");
      }
      const demoPath = join(ROOT, "public", "demo.mp4");
      if (!existsSync(demoPath)) {
        blockers.push("production build requires hatchable/public/demo.mp4 on disk");
      } else if (!isMp4(readFileSync(demoPath))) {
        blockers.push("production demo.mp4 must have an MP4 signature");
      }
      assert(!blockers.length, `production build blockers:\n- ${blockers.join("\n- ")}`);
    }

    console.log(`Validated Infographic Artist site at ${base}`);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
