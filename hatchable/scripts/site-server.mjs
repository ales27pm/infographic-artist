import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_DIR = join(ROOT, "public");

const ROUTES = new Map([
  ["/", "pages/index.js"],
  ["/privacy", "pages/privacy.js"],
  ["/terms", "pages/terms.js"],
  ["/support", "pages/support.js"],
  ["/health", "pages/health.js"],
  ["/demo.mp4", "pages/demo.mp4.js"],
  ["/robots.txt", "pages/robots.txt.js"],
  ["/sitemap.xml", "pages/sitemap.xml.js"],
  ["/.well-known/openai-apps-challenge", "pages/.well-known/openai-apps-challenge.js"],
]);

const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".mp4", "video/mp4"],
]);

function staticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const safe = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = resolve(PUBLIC_DIR, safe.replace(/^\/+/, ""));
  if (!candidate.startsWith(PUBLIC_DIR)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}

function sendStatic(req, res, filePath) {
  const type = TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
  const size = statSync(filePath).size;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(size));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (req.method === "HEAD") return res.end();
  createReadStream(filePath).pipe(res);
}

class LocalResponse {
  constructor(res) {
    this.res = res;
    this.statusCode = 200;
  }

  setHeader(name, value) {
    this.res.setHeader(name, value);
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(value) {
    this.setHeader("Content-Type", "application/json; charset=utf-8");
    return this.send(`${JSON.stringify(value)}\n`);
  }

  send(value = "") {
    this.res.statusCode = this.statusCode;
    if (Buffer.isBuffer(value)) return this.res.end(value);
    return this.res.end(String(value));
  }
}

async function callPage(routePath, req, res, statusOverride = null) {
  const modulePath = ROUTES.get(routePath) || "pages/404.js";
  const mod = await import(pathToFileURL(join(ROOT, modulePath)).href);
  const localRes = new LocalResponse(res);
  if (statusOverride) localRes.status(statusOverride);
  return mod.default(req, localRes);
}

export async function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    return res.end("");
  }

  const filePath = staticPath(pathname);
  if (filePath) return sendStatic(req, res, filePath);

  req.path = pathname;
  req.query = Object.fromEntries(url.searchParams.entries());

  if (ROUTES.has(pathname)) return callPage(pathname, req, res);
  return callPage(pathname, req, res, 404);
}

export function createServer() {
  return createHttpServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(`${error?.stack || error}\n`);
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const port = Number(process.env.PORT || process.argv[2] || 4173);
  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Infographic Artist site listening on http://127.0.0.1:${port}`);
  });
}
