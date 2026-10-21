// Renders one still per moment worth reviewing and tiles them into out/storyboard.jpg.
// Usage: npm run storyboard   (uses the silent, choreographed lengths)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const FPS = 60;
const OVERLAP = 10;
const source = readFileSync(new URL('../src/pawzoo/script.ts', import.meta.url), 'utf8');
const scenes = [...source.matchAll(/id: '(\w+)'.*?minSeconds: ([\d.]+)/g)].map((m) => ({ id: m[1], frames: Math.round(Number(m[2]) * FPS) }));

// Moments to review, as a fraction of each scene.
const picks = { intro: [0.7], day: [0.15, 0.85], walk: [0.85], pay: [0.35, 0.92], food: [0.4, 0.92], groom: [0.9], tv: [0.2, 0.8], alert: [0.7], outro: [0.85] };

const browser = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => existsSync(p));
mkdirSync('out/storyboard', { recursive: true });
let start = 0;
const files = [];
for (const s of scenes) {
  for (const [i, f] of (picks[s.id] ?? [0.5]).entries()) {
    const frame = start + Math.round(s.frames * f);
    const file = `out/storyboard/${String(files.length).padStart(2, '0')}-${s.id}-${String(i)}.png`;
    const args = ['remotion', 'still', 'src/index.ts', 'PawzooLandscape', file, `--frame=${String(frame)}`, '--scale=0.5'];
    if (browser) args.push(`--browser-executable=${browser}`);
    execFileSync('npx', args, { stdio: 'ignore' });
    files.push(file);
    console.log(file);
  }
  start += s.frames - OVERLAP;
}

const cols = 3;
const inputs = files.flatMap((f) => ['-i', f]);
const layout = files.map((_, i) => `${String((i % cols) * 960)}_${String(Math.floor(i / cols) * 540)}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `xstack=inputs=${String(files.length)}:layout=${layout}:fill=white`, 'out/storyboard.jpg']);
console.log('wrote out/storyboard.jpg');
