import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIRS = ["api", "lib", "pages", "scripts"];
const SKIP = [/data-part\d/i];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = DIRS.flatMap((dir) => walk(join(ROOT, dir))).filter(
  (file) => /\.(mjs|js)$/.test(file) && !SKIP.some((pattern) => pattern.test(file)),
);

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(`${file.slice(ROOT.length + 1)}\n${result.stderr || result.stdout}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Syntax/type check passed for ${files.length} files`);
