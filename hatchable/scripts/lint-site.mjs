import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ROUTE_DIRS = ["api", "pages"];
const CONTENT_DIRS = ["lib", "pages"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const errors = [];

for (const dir of ROUTE_DIRS) {
  for (const file of walk(join(ROOT, dir)).filter((path) => path.endsWith(".js"))) {
    const text = readFileSync(file, "utf8");
    if (!/export\s+const\s+access\s*=/.test(text)) {
      errors.push(`${file.slice(ROOT.length + 1)}: route missing export const access`);
    }
  }
}

const banned = [
  [/Coming Soon/i, "Coming Soon"],
  [/DaftCitadel/i, "DaftCitadel"],
  [/lorem ipsum/i, "lorem ipsum"],
  [/<meta[^>]+name=["']robots["'][^>]+noindex/i, "noindex robots tag"],
];

for (const dir of CONTENT_DIRS) {
  for (const file of walk(join(ROOT, dir)).filter((path) => path.endsWith(".js") && !/data-part\d/i.test(path))) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of banned) {
      if (pattern.test(text)) errors.push(`${file.slice(ROOT.length + 1)}: banned content: ${label}`);
    }
    if (/<button[^>]*>\s*<\/button>/i.test(text)) {
      errors.push(`${file.slice(ROOT.length + 1)}: empty button`);
    }
    if (/\shref=["']["']/i.test(text)) {
      errors.push(`${file.slice(ROOT.length + 1)}: empty href`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Site lint passed");
