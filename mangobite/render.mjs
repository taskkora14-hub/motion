// Frame-accurate export of mangobite/index.html to MP4 (H.264, 1080x1920).
//   node mangobite/render.mjs                     -> mangobite/dist/mangobite-30s-9x16.mp4 (60 fps)
//   node mangobite/render.mjs --fps 30 --out x.mp4
//   node mangobite/render.mjs --stills 1,5,12.3   -> mangobite/out/stills/*.png
// Needs: playwright (Chromium) and ffmpeg with libx264 (env FFMPEG or ffmpeg on PATH).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const DIR = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const FPS = Number(args.fps || 60);
const OUT = path.resolve(DIR, args.out || 'dist/mangobite-30s-9x16.mp4');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('page error:', e));
await page.goto('file://' + path.join(DIR, 'index.html') + '?render');
await page.evaluate(() => window.MANGOBITE.ready);
const DURATION = await page.evaluate(() => window.MANGOBITE.DURATION);
const grab = async t => { await page.evaluate(tt => window.MANGOBITE.render(tt), t); return page.screenshot({ type: 'png' }); };

if (args.stills) {
  const dir = path.resolve(DIR, args.dir || 'out/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of String(args.stills).split(',')) fs.writeFileSync(path.join(dir, `t${Number(s).toFixed(2).padStart(5, '0')}.png`), await grab(Number(s)));
  console.log('stills ->', dir);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const frames = Math.round(DURATION * FPS);
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 18), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    const buf = await grab(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % FPS === 0) process.stdout.write(`\r${(f / FPS).toFixed(0)}s / ${DURATION}s`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  console.log(`\nwrote ${OUT}`);
}
await browser.close();
