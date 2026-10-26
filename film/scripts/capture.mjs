// Captures every state the Pawzoo Nebius film shows, from the real app with live Nemotron calls on Nebius Token
// Factory, at 1600 css px wide @2x, and records the boxes the camera frames (public/pawzoo/boxes.json). It also runs
// the standalone evening digest job for real and keeps its output (public/pawzoo/job.json) for the terminal scene.
// Start Pawzoo first with a key and a job token:  PAWZOO_JOB_TOKEN=film npm start   (repo root), then  npm run capture
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.PAWZOO_URL ?? 'http://127.0.0.1:8787';
const OUT = new URL('../public/pawzoo/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const post = (path, body) => fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const status = await (await fetch(`${BASE}/api/status`)).json();
if (!status.nemotron) throw new Error('Pawzoo is not using Nemotron: start it with NEBIUS_API_KEY and PAWZOO_BUDGET_USD.');

const browser = await chromium.launch();
const W = 1600;
const H = 1000;
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const tv = await ctx.newPage();
const boxes = { size: { w: W, h: H } };
const wait = (ms) => page.waitForTimeout(ms);

async function boxOf(key, locator) {
  const b = await locator.first().boundingBox();
  if (!b) throw new Error(`No box for ${key}`);
  boxes[key] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}
async function shot(name) {
  await boxOf(`answer:${name}`, page.locator('.answer'));
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('captured', name);
}
async function tvShot(name) {
  await tv.waitForTimeout(1500);
  await tv.screenshot({ path: `${OUT}${name}.png` });
  console.log('captured', name);
}
const transcript = () => page.textContent('#transcript');
async function ask(key, say) {
  const chip = page.locator(`[data-say="${say}"]`);
  await boxOf(key, chip);
  await chip.click();
  await page.waitForFunction((s) => {
    const t = document.querySelector('#transcript')?.textContent ?? '';
    return t.startsWith(s) && t.length > s.length + 10;
  }, say, { timeout: 60000 });
  await wait(2500);
}

await post('/api/demo/reset');
await post('/api/demo/time', { time: '14:00' });
await page.goto(BASE);
await page.waitForFunction(() => /Nemotron/.test(document.querySelector('#session')?.textContent ?? ''), null, { timeout: 30000 });
await tv.goto(`${BASE}/tv.html`);
await wait(1500);
await shot('sim-start');
await tvShot('tv-start');

await ask('chipDay', "How was Biscuit's day?");
await shot('sim-day');
await ask('chipFood', 'Do we need dog food?');
await shot('sim-food');
await ask('chipWalker', 'Show me when the walker came on the TV');
await shot('sim-walker');
await tvShot('tv-walker');

await page.click('#hood-toggle');
await wait(1200);
await boxOf('nemo', page.locator('section:has(#nemo-totals)'));
await page.screenshot({ path: `${OUT}hood-calls.png` });
console.log('captured hood-calls');
await page.click('#hood-close');
await wait(800);

// The clock crosses 19:00: nobody asks, the evening digest arrives on its own.
await boxOf('step7p', page.locator('.step[data-time="19:00"]'));
await page.click('.step[data-time="19:00"]');
await page.waitForFunction(() => /Evening update/.test(document.querySelector('#transcript')?.textContent ?? ''), null, { timeout: 60000 });
await wait(2500);
await shot('sim-evening');
await tvShot('tv-evening');

// The same digest from the standalone job, the unit to schedule as a Nebius Serverless Job.
const out = execFileSync('node', ['server/dist/jobs/evening-digest.js'], {
  cwd: new URL('../../', import.meta.url).pathname,
  env: { ...process.env, PAWZOO_URL: BASE, PAWZOO_JOB_TOKEN: process.env.PAWZOO_JOB_TOKEN ?? 'film' },
}).toString();
const deliveredLine = out.slice(Math.max(0, out.indexOf('Delivered'))).replace(/\s+/g, ' ').trim();
writeFileSync(`${OUT}job.json`, JSON.stringify({ command: 'node server/dist/jobs/evening-digest.js', output: deliveredLine }, null, 2));
await page.waitForFunction(() => /scheduled job/.test(document.querySelector('#transcript')?.textContent ?? ''), null, { timeout: 30000 });
await wait(1500);
await shot('sim-job');

await page.click('#hood-toggle');
await wait(1200);
await page.screenshot({ path: `${OUT}hood-digest.png` });
console.log('captured hood-digest');

writeFileSync(`${OUT}boxes.json`, JSON.stringify(boxes, null, 2));
const calls = await (await fetch(`${BASE}/api/calls`)).json();
writeFileSync(`${OUT}calls.json`, JSON.stringify(calls, null, 2));
console.log('totals', JSON.stringify(calls.totals), 'spent', calls.spentUsd);
await browser.close();
