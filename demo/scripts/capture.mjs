// Captures every state the Pawzoo film shows, from the real app, at 1600 css px wide @2x, and records the
// on-screen box of each button the cursor clicks and of each answer the camera reads
// (public/pawzoo/boxes.json), the way the Dribble Logs film does. The simulator is captured tall enough
// for its tallest answer (the board grows to fit a card rather than clip it); the TV at 16:9. Start Pawzoo first (npm start in the repo root), then: npm run capture
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.PAWZOO_URL ?? 'http://127.0.0.1:8787';
const OUT = new URL('../public/pawzoo/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const post = (path, body) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const SIM_H = 1110;
const ctx = await browser.newContext({ viewport: { width: 1600, height: SIM_H }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
const boxes = { size: { w: 1600, h: SIM_H } };
const settle = (ms = 1700) => page.waitForTimeout(ms);

async function boxOf(key, locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error(`No box for ${key}`);
  boxes[key] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}

/** A button inside the MCP Apps card iframe, in page coordinates. */
async function cardButtonBox(key, text) {
  const frameBox = await page.locator('#card iframe').boundingBox();
  const inner = await page.frameLocator('#card iframe').locator(`button:has-text("${text}")`).first().boundingBox();
  if (!frameBox || !inner) throw new Error(`No card button ${text}`);
  boxes[key] = { x: Math.round(inner.x), y: Math.round(inner.y), w: Math.round(inner.width), h: Math.round(inner.height) };
}

async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height > SIM_H) throw new Error(`${name} is ${String(height)}px tall; raise SIM_H so nothing is cut off`);
  await boxOf(`answer:${name}`, page.locator('.answer'));
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('captured', name);
}

const chip = (say) => page.locator(`[data-say="${say}"]`);
async function ask(key, say) {
  await boxOf(key, chip(say));
  await chip(say).click();
  await page.waitForSelector('#card iframe');
  await settle();
}

await post('/api/demo/reset');
await post('/api/demo/time', { time: '19:00' });
await page.goto(`${BASE}/?film=1`);
await page.waitForFunction(() => document.querySelector('#session')?.textContent?.includes('2025-11-25'));
// Silence in-app speech while capturing (the checkbox lives in the closed drawer).
await page.evaluate(() => {
  const box = document.querySelector('#speak');
  box.checked = false;
  box.dispatchEvent(new Event('change'));
});
await settle(1200);
await shot('sim-start');

await ask('chipDay', "How was Biscuit's day?");
await shot('sim-day');

await ask('chipWalk', 'How long was the walk?');
await shot('sim-walk');
await cardButtonBox('cardPayTip', 'Pay + $3 Tip');
await page.frameLocator('#card iframe').locator('button:has-text("Pay + $3 Tip")').click();
await settle();
await shot('sim-pay');
await cardButtonBox('cardConfirm', 'Confirm');
await page.frameLocator('#card iframe').locator('button:has-text("Confirm")').click();
await settle();
await shot('sim-paid');

await ask('chipFood', 'Do we need dog food?');
await shot('sim-food');
await ask('chipCups', "She's on two and a half cups a day now");
await shot('sim-cups');

await ask('chipGroom', 'Book Biscuit a grooming appointment');
await shot('sim-groom');

await boxOf('chipTv', chip("Play Biscuit's day on the TV"));

// The TV, in its own page.
const tv = await ctx.newPage();
await tv.setViewportSize({ width: 1600, height: 900 });
await tv.goto(`${BASE}/tv.html`);
await tv.waitForTimeout(1500);
await tv.screenshot({ path: `${OUT}tv-home.png` });
console.log('captured tv-home');
await post('/api/tv/cast', { target: 'day_reel' });
await tv.waitForTimeout(600);
for (const [i, name] of [[0, 'tv-reel-1'], [3, 'tv-reel-2'], [8, 'tv-reel-3']]) {
  await tv.evaluate((n) => document.querySelectorAll('.chapter')[n]?.dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
  await tv.waitForTimeout(1300);
  await tv.screenshot({ path: `${OUT}${name}.png` });
  console.log('captured', name);
}

// The escape: the simulator speaks up and the TV takes over.
await post('/api/demo/escape');
await settle(2000);
await shot('sim-alert');
await tv.waitForTimeout(500);
await tv.screenshot({ path: `${OUT}tv-alert.png` });
console.log('captured tv-alert');

writeFileSync(`${OUT}boxes.json`, JSON.stringify(boxes, null, 2));
console.log('wrote boxes.json');
await browser.close();
