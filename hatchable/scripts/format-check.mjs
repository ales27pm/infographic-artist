import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const INCLUDE_DIRS = ["api", "lib", "pages", "scripts"];
const SKIP = [/data-part\d/i];
const EXTENSIONS = new Set([".js", ".mjs"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

const files = INCLUDE_DIRS.flatMap((dir) => walk(join(ROOT, dir))).filter(
  (file) => EXTENSIONS.has(extension(file)) && !SKIP.some((pattern) => pattern.test(file)),
);

const errors = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(ROOT.length + 1);
  if (!text.endsWith("\n")) errors.push(`${rel}: missing final newline`);
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (/[ \t]$/.test(line)) errors.push(`${rel}:${index + 1}: trailing whitespace`);
  });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Format check passed for ${files.length} files`);
