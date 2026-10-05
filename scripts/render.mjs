// Frame-accurate export of index.html to MP4 (H.264, 1080x1920).
//   node scripts/render.mjs                      -> out/taskkora.mp4 (60 fps)
//   node scripts/render.mjs --fps 30 --out x.mp4
//   node scripts/render.mjs --stills 1,6.5,14   -> out/stills/*.png
//   node scripts/render.mjs --page menunda/index.html --audio out/menunda-music.wav --out out/menunda.mp4
//   node scripts/render.mjs --page cake/index.html --gl ...   (enables WebGL via SwiftShader for three.js pages)
// Needs: playwright (Chromium) and an ffmpeg with libx264 (env FFMPEG or imageio-ffmpeg).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const FPS = Number(args.fps || 60);
const OUT = path.resolve(ROOT, args.out || 'out/taskkora.mp4');
const AUDIO = args.audio === 'none' ? null : path.resolve(ROOT, args.audio || 'out/taskkora-music.wav');
const PAGE = args.page || 'index.html';
const FROM = Number(args.from || 0), TO = args.to ? Number(args.to) : null;

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execSync('python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim(); } catch { return 'ffmpeg'; }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const CRF = String(args.crf || 16);
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch(args.gl ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});   // --gl: WebGL pages (software GL)
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('page error:', e));
await page.goto(`http://127.0.0.1:${port}/${PAGE}?render`);
await page.evaluate(() => window.TASKKORA.ready);
const DURATION = await page.evaluate(() => window.TASKKORA.DURATION);

const grab = t => page.evaluate(tt => { window.TASKKORA.render(tt); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);

if (args.stills) {
  const dir = path.resolve(ROOT, args.dir || 'out/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of String(args.stills).split(',')) {
    const t = Number(s);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`), Buffer.from(await grab(t), 'base64'));
  }
  console.log('stills ->', dir);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const end = TO ?? DURATION;
  const frames = Math.round((end - FROM) * FPS);
  const hasAudio = AUDIO && fs.existsSync(AUDIO);
  const ff = spawn(ffmpegPath(), [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    ...(hasAudio ? ['-ss', String(FROM), '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const buf = Buffer.from(await grab(FROM + f / FPS), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % FPS === 0) process.stdout.write(`\r${(f / FPS).toFixed(0)}s / ${(end - FROM).toFixed(0)}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  console.log(`\nwrote ${OUT}${hasAudio ? ' (with audio)' : ''}`);
}
await browser.close();
server.close();
