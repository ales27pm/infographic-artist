import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { critiqueImageMetrics, coachDecision, generateDirections, exploreGraph } from '../lib/core.js';

const { chromium } = await import(process.env.INFOGRAPHIC_PLAYWRIGHT_PATH ? pathToFileURL(process.env.INFOGRAPHIC_PLAYWRIGHT_PATH).href : 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'python/assets/app-v1.html'), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function fixture(view, data, viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(({ view, data }) => {
    window.__sent = [];
    window.openai = { toolOutput: { view, data }, sendFollowUpMessage: async request => { window.__sent.push(request); } };
  }, { view, data });
  await page.route('https://widget.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await page.goto('https://widget.test/');
  assert.equal(page.url(), 'https://widget.test/');
  assert.match(await page.title(), /Infographic Artist/);
  return { page, errors };
}
async function screenshot(page, name) {
  if (!process.env.INFOGRAPHIC_QA_DIR) return;
  fs.mkdirSync(process.env.INFOGRAPHIC_QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.INFOGRAPHIC_QA_DIR, name), fullPage: true });
}
const metrics = { foreground_occupancy: .13, centroid: { x: .5, y: .5 }, balance: .99, saliency_concentration: 1, edge_density: .006, contrast: .33, small_size_stability: .97, entropy: .11 };
for (const width of [1440, 390]) {
  test(`missing-reference critique displays Non évaluable, not zero, at ${width}px`, async () => {
    const { page, errors } = await fixture('critique', critiqueImageMetrics(metrics), { width, height: 844 });
    try {
      const axis = page.locator('[data-axis="differentiation"]');
      assert.match(await axis.innerText(), /Non évaluable/);
      assert.equal(await axis.locator('.fill').count(), 0);
      assert.doesNotMatch(await axis.innerText(), /null|0\/20/);
      assert.match(await page.locator('h1').innerText(), /\/80/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await screenshot(page, `critique-${width}.png`);
    } finally { await page.close(); }
  });
}
test('the displayed coaching schedule preserves the exact 60-minute allocation', async () => {
  const data = coachDecision('Deux variantes seulement en 60 minutes, tests à 24 et 48 px.');
  const { page, errors } = await fixture('coach', data);
  try {
    const schedule = page.locator('[data-coach-schedule]');
    assert.equal(await schedule.locator('li').count(), 4);
    for (const minutes of [9, 27, 18, 6]) assert.ok((await schedule.innerText()).includes(`${minutes} min`));
    assert.match(await page.locator('body').innerText(), /60 minutes/);
    assert.match(await page.locator('body').innerText(), /exactement 2 variantes/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await screenshot(page, 'coach-390.png');
  } finally { await page.close(); }
});
test('actual direction prompt arrives in host handoff without dropping exact copy or formats', async () => {
  const data = await generateDirections({ execution:{variant_count:2}, name: '27PM', sector: 'Studio web', promise: 'Rendre le complexe clair.', design_context: {
    message: 'Conserver « 27PM » et « 27:00 » exactement.', medium: 'Page web responsive', final_size: 'Bureau 1440 × 900 px; mobile 390 × 844 px.'
  } });
  const { page, errors } = await fixture('directions', data);
  try {
    await page.locator('.native-render-route').nth(1).click();
    await page.waitForFunction(() => document.querySelectorAll('.native-render-route')[1].textContent.includes('transmise'));
    const requests = await page.evaluate(() => window.__sent);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].prompt.startsWith('@Créer une image\n\n'));
    for (const text of ['27PM', '27:00', '1440 × 900 px', '390 × 844 px']) assert.ok(requests[0].prompt.includes(text));
    assert.doesNotMatch(requests[0].prompt, /abstract placeholder glyphs/);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await screenshot(page, 'directions-handoff-390.png');
  } finally { await page.close(); }
});
test('unmatched graph displays an honest empty state', async () => {
  const { page, errors } = await fixture('graph', await exploreGraph('zzqv-inexistant-27pm-qa-20261024', 20));
  try {
    assert.match(await page.locator('body').innerText(), /Aucun nœud/);
    assert.equal(await page.locator('.graph-node').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
