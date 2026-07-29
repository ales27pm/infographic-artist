import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = process.argv[2] ? resolve(process.argv[2]) : "";
const destination = resolve(ROOT, "public", "demo.mp4");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isMp4(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

if (!source) {
  fail("Usage: node hatchable/scripts/prepare-demo.mjs /absolute/or/relative/demo.mp4");
}

if (!source.toLowerCase().endsWith(".mp4")) {
  fail(`${basename(source)} must have an .mp4 extension`);
}

let stat;
try {
  stat = statSync(source);
} catch {
  fail(`Input file not found: ${source}`);
}

if (!stat.isFile() || stat.size <= 0) {
  fail("Input demo must be a non-empty file");
}

const bytes = readFileSync(source);
if (!isMp4(bytes)) {
  fail("Input demo is not an ISO Base Media File Format MP4 with an ftyp signature");
}

mkdirSync(resolve(ROOT, "public"), { recursive: true });
copyFileSync(source, destination);
console.log(`Copied valid demo MP4 to ${destination}`);
