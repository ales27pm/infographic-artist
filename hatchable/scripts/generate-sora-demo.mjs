import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OUT = resolve(ROOT, "public", "demo.mp4");
const API_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const PROMPT = `
Create an 8-second polished product demo video for a public website reviewing a ChatGPT plugin named Infographic Artist by 27pm.
Style: rigorous Swiss-modern editorial motion design, neutral paper background, black grid lines, restrained rust accent, crisp typography-like blocks without relying on readable small text.
Sequence: start on an abstract ChatGPT plugin workspace, move through a brand atlas grid, a mechanism graph, a comparison table, a five-axis critique panel, and a final coaching checklist.
Motion: slow camera push and clean lateral transitions, no excessive animation, no glowing gradients, no glassmorphism.
Constraints: no people, no real company logos, no third-party brand artwork, no testimonials, no customer logos, no invented metrics, no legal claims, no watermark.
`.replace(/\s+/g, " ").trim();

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function isMp4(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

async function apiFetch(path, init = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is required to generate demo.mp4 with Sora 2.");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let detail = "";
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => null);
      detail = data ? JSON.stringify(data) : "";
    } else {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`OpenAI API ${response.status} ${response.statusText}: ${detail}`);
  }

  return response;
}

async function createVideo({ model, size, seconds, prompt }) {
  const body = JSON.stringify({ model, size, seconds, prompt });

  try {
    const response = await apiFetch("/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return response.json();
  } catch (error) {
    if (!String(error?.message || error).includes("Content-Type")) throw error;
  }

  const form = new FormData();
  form.set("model", model);
  form.set("size", size);
  form.set("seconds", seconds);
  form.set("prompt", prompt);
  const response = await apiFetch("/videos", {
    method: "POST",
    body: form,
  });
  return response.json();
}

async function retrieveVideo(id) {
  const response = await apiFetch(`/videos/${encodeURIComponent(id)}`);
  return response.json();
}

async function downloadVideo(id) {
  const response = await apiFetch(`/videos/${encodeURIComponent(id)}/content`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const out = resolve(argValue("--out", DEFAULT_OUT));
  const model = argValue("--model", "sora-2");
  const size = argValue("--size", "1280x720");
  const seconds = argValue("--seconds", "8");
  const prompt = argValue("--prompt", PROMPT);
  const maxWaitMs = Number(argValue("--max-wait-ms", String(12 * 60 * 1000)));

  console.log(`Creating Sora demo with ${model}, ${size}, ${seconds}s`);
  let video = await createVideo({ model, size, seconds, prompt });
  console.log(`Video job started: ${video.id} (${video.status})`);

  const started = Date.now();
  while (["queued", "in_progress"].includes(video.status)) {
    if (Date.now() - started > maxWaitMs) {
      throw new Error(`Timed out waiting for Sora video job ${video.id}`);
    }
    await sleep(15_000);
    video = await retrieveVideo(video.id);
    const progress = Number.isFinite(Number(video.progress)) ? `${video.progress}%` : "progress unavailable";
    console.log(`Video job ${video.id}: ${video.status}, ${progress}`);
  }

  if (video.status !== "completed") {
    throw new Error(`Sora video job ${video.id} ended with status ${video.status}: ${JSON.stringify(video.error || {})}`);
  }

  const bytes = await downloadVideo(video.id);
  if (!isMp4(bytes)) {
    throw new Error("Downloaded Sora output did not have an ISO BMFF MP4 ftyp signature.");
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log(`Wrote browser-playable MP4 to ${out} (${bytes.length} bytes)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
