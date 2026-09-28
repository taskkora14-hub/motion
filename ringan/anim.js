/* "Kenapa Tugas Terlihat Susah Padahal Sebenarnya Nggak?" — 40s educational motion piece, 1080x1920.
 * Every frame is a pure function of time: render(t). Beat grid: 120 BPM (0.5 s). */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    bg: '#0B0D12', card: '#151A24', card2: '#1C2230', line: '#2A3242', ink: '#F4F1EA', dim: '#8A93A6',
    mint: '#3DDC97', mintD: '#1E6E4F', coral: '#FF5C6C', amber: '#FFC857', sky: '#6CA8FF', paper: '#F4F1EA', pline: '#C9CED8',
  };
  const F = '"BG", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], p))).join(',')})`; };
  const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    ...[400, 500, 600, 700, 800].map(w => document.fonts.load(`${w} 40px ${F}`)),
  ]).then(() => document.fonts.ready);
  // film grain tiles
  const GRAIN = [0, 1, 2, 3].map(k => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), im = g.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) { const v = rnd(i * 0.37 + k * 9173.1) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  });

  // ---------- helpers ----------
  const font = (w, s) => `${w} ${s}px ${F}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function shadow(a = 0.4, blur = 40, oy = 16, c = '0,0,0') { ctx.shadowColor = `rgba(${c},${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy; }
  function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function tick(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  // Masked kinetic line: words rise out of an invisible slot and leave upward.
  function kText(text, x, y, t, t0, o = {}) {
    const size = o.size || 100, stagger = o.stagger ?? 0.07, dur = o.dur || 0.6;
    ctx.save();
    ctx.font = font(o.weight || 800, size); ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.03)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' '), sp = ctx.measureText(' ').width;
    const ws = words.map(w => ctx.measureText(w).width);
    const raw = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    const fit = raw > (o.maxW || 960) ? (o.maxW || 960) / raw : 1, total = raw * fit;
    const x0 = x - total / 2;
    ctx.beginPath(); ctx.rect(x0 - 40, y - size * 1.0 * fit, total + 80, size * 1.32 * fit); ctx.clip();
    let cx = x0;
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, p = E.outExpo(P(t, a, a + dur));
      const q = o.out != null ? E.inCubic(P(t, o.out + i * 0.04, o.out + i * 0.04 + 0.35)) : 0;
      if (p > 0 && q < 1) {
        const bob = o.bob && o.bob[i] ? Math.sin(t * 3 + i) * 8 : 0;
        ctx.save(); ctx.translate(cx, y + (1 - p) * size * 1.15 * fit - q * size * 1.15 * fit + bob); ctx.scale(fit, fit);
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.ink; ctx.fillText(words[i], 0, 0); ctx.restore();
      }
      cx += (ws[i] + sp) * fit;
    }
    ctx.restore();
    return total;
  }

  // ---------- atmosphere ----------
  function stress(t) {
    if (t < 5) return E.inCubic(P(t, 1.8, 4.8));
    if (t < 9) return 0.15;
    if (t < 24) return 0.5;
    return 0;
  }
  function background(t) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const s = stress(t);
    const glows = [[540 + Math.sin(t * 0.4) * 120, 300, 900, C.coral, 0.22 * s], [540 + Math.cos(t * 0.35) * 140, 1500, 1000, C.mint, 0.16 * (1 - s)], [180, 900, 700, C.sky, 0.07]];
    for (const [x, y, r, c, a] of glows) {
      if (a <= 0.001) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
  function postFx(t) {
    // vignette
    const v = ctx.createRadialGradient(540, 960, 500, 540, 960, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // grain
    const g = GRAIN[Math.floor(t * 24) % 4];
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(g, 'repeat'); ctx.translate((Math.floor(t * 24) * 37) % 256, (Math.floor(t * 24) * 91) % 256);
    ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  }
  function finish(t) {
    const wa = P(t, 0.4, 1.1) * 0.9;
    if (wa > 0) { // Taskkora logo, unaltered, small watermark top-right
      const s = 66, x = W - 56 - s, y = 146;
      ctx.save(); ctx.globalAlpha = wa; shadow(0.35, 16, 5);
      rr(x, y, s, s, 16); ctx.fillStyle = '#004FC6'; ctx.fill(); noShadow();
      rr(x, y, s, s, 16); ctx.clip();
      const ih = s * logo.height / logo.width; ctx.drawImage(logo, x, y + (s - ih) / 2, s, ih);
      ctx.restore();
    }
    const f = 1 - P(t, 0, 0.25) + P(t, 39.5, 40);
    if (f > 0) { ctx.fillStyle = `rgba(11,13,18,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- paper ----------
  function page(x, y, w, h, rot, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= o.alpha ?? 1;
    if (o.shadow !== false) shadow(0.45, 30, 12);
    rr(-w / 2, -h / 2, w, h, w * 0.035); ctx.fillStyle = C.paper; ctx.fill(); noShadow();
    const m = w * 0.12, lw = Math.max(2, w * 0.018);
    rr(-w / 2 + m, -h / 2 + m, w * 0.42, h * 0.045, h * 0.02); ctx.fillStyle = o.head || C.ink; ctx.fill();
    const n = 9, top = -h / 2 + m + h * 0.12, gap = (h - m * 2 - h * 0.14) / n;
    for (let k = 0; k < n; k++) {
      const len = (w - m * 2) * (k % 4 === 3 ? 0.55 : 0.8 + rnd(k + (o.seed || 0)) * 0.2);
      line(-w / 2 + m, top + k * gap, -w / 2 + m + len, top + k * gap, C.pline, lw);
    }
    if (o.mess) { // red-pen chaos
      ctx.globalAlpha *= o.mess;
      ctx.strokeStyle = C.coral; ctx.lineWidth = lw * 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(w * 0.05, top + gap * 2, w * 0.3, gap * 0.9, -0.1, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w * 0.3, top + gap * 5.2);
      for (let k = 0; k < 7; k++) ctx.lineTo(-w * 0.3 + k * w * 0.09, top + gap * 5.2 + (k % 2 ? -gap * 0.5 : gap * 0.3));
      ctx.stroke();
      ctx.fillStyle = rgba(C.amber, 0.5); ctx.fillRect(-w / 2 + m, top + gap * 7 - lw * 3, (w - m * 2) * 0.7, lw * 6);
    }
    if (o.label) {
      ctx.font = font(800, w * 0.1); ctx.fillStyle = o.labelColor || C.coral; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(o.label, w / 2 - m * 0.6, h / 2 - m * 0.5);
    }
    ctx.restore();
  }
  function cryFace(x, y, r, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 9) * 0.06);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#FFE27A'); g.addColorStop(1, '#F7B733');
    circle(0, 0, r, g);
    ctx.strokeStyle = '#5A3A12'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.36, -r * 0.12, r * 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * 0.3, r * 0.2 + Math.sin(t * 14) * r * 0.04, 0, 0, TAU); ctx.fillStyle = '#5A3A12'; ctx.fill();
    for (const s of [-1, 1]) { // tear streams
      const flow = (t * 2.2) % 1;
      ctx.fillStyle = '#5FB6FF';
      ctx.beginPath(); ctx.moveTo(s * r * 0.5, -r * 0.02); ctx.quadraticCurveTo(s * r * 0.62, r * 0.5, s * r * 0.5, r * 0.95); ctx.lineTo(s * r * 0.3, r * 0.95); ctx.quadraticCurveTo(s * r * 0.4, r * 0.5, s * r * 0.22, -r * 0.02); ctx.closePath(); ctx.fill();
      circle(s * r * 0.42, r * 0.95 + flow * r * 0.5, r * 0.08 * (1 - flow), '#5FB6FF');
    }
    ctx.restore();
  }

  // =====================================================================
  // 1. HOOK (0 – 5.0): one page → a hundred pages
  // =====================================================================
  const MAIN = { x: 540, y: 1180, w: 330, h: 440 };
  const SWARM = Array.from({ length: 100 }, (_, k) => {
    const a = rnd(k * 3.3) * TAU, d = 250 + Math.sqrt(rnd(k * 7.1)) * 900;
    return { tx: 540 + Math.cos(a) * d * 0.75, ty: 1100 + Math.sin(a) * d, rot: (rnd(k + 11) - 0.5) * 50 * DEG, s: 0.55 + rnd(k + 23) * 0.5,
      ta: 1.9 + 2.3 * Math.sqrt(k / 99), mess: rnd(k + 5) > 0.4 ? 1 : 0 };
  }).reverse();
  function sHook(t) {
    const z = 1 + 0.14 * E.inCubic(P(t, 2.0, 4.85)), sh = Math.pow(P(t, 3.3, 4.85), 2) * 12;
    ctx.save();
    ctx.translate(540 + Math.sin(t * 83) * sh, 1100 + Math.cos(t * 71) * sh); ctx.scale(z, z); ctx.translate(-540, -1100);
    const implode = E.inExpo(P(t, 4.8, 5.05));
    // swarm
    SWARM.forEach((p, k) => {
      const f = E.outCubic(P(t, p.ta, p.ta + 0.5));
      if (f <= 0) return;
      const x = lerp(lerp(MAIN.x, p.tx, f), MAIN.x, implode), y = lerp(lerp(MAIN.y, p.ty, f), MAIN.y, implode);
      const jit = P(t, 4.3, 4.8) * 6;
      page(x + Math.sin(t * 40 + k) * jit, y + Math.cos(t * 37 + k) * jit, MAIN.w * p.s * 0.8, MAIN.h * p.s * 0.8, p.rot * f * (1 - implode), { mess: p.mess, seed: k, alpha: 1 - implode * 0.6 });
    });
    // the original page
    const pin = E.outBack(P(t, 0.1, 0.6)), breathe = 1 + Math.sin(t * 3) * 0.01;
    page(MAIN.x, MAIN.y + (1 - pin) * 200, MAIN.w * breathe, MAIN.h * breathe, -2 * DEG * pin, { alpha: clamp(pin * 2), label: t < 1.9 ? '1 hal.' : '', labelColor: C.mint });
    ctx.restore();
    // darken behind the words while pages flood the screen
    const band = P(t, 2.4, 3.0) * (1 - P(t, 4.7, 4.9));
    if (band > 0) {
      const g = ctx.createLinearGradient(0, 180, 0, 900);
      g.addColorStop(0, `rgba(11,13,18,${0.92 * band})`); g.addColorStop(0.75, `rgba(11,13,18,${0.85 * band})`); g.addColorStop(1, 'rgba(11,13,18,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 900);
    }
    kText('Pernah lihat tugas', 540, 430, t, 0.15, { size: 78, weight: 600, color: C.dim, out: 1.8 });
    kText('1 halaman…', 540, 580, t, 0.55, { size: 134, color: C.mint, out: 1.8 });
    kText('tapi rasanya kayak', 540, 430, t, 2.0, { size: 78, weight: 600, color: C.dim, out: 4.65 });
    kText('100 halaman?', 540, 580, t, 2.35, { size: 134, color: C.coral, out: 4.65 });
    const ep = E.outBack(P(t, 2.9, 3.3)) * (1 - E.inCubic(P(t, 4.6, 4.8)));
    if (ep > 0) { ctx.save(); ctx.translate(540, 745); ctx.scale(ep, ep); cryFace(0, 0, 70, t); ctx.restore(); }
    // page counter
    const cp = E.outBack(P(t, 1.95, 2.3)) * (1 - E.inCubic(P(t, 4.6, 4.85)));
    if (cp > 0) {
      const n = Math.max(1, Math.round(1 + 99 * E.inCubic(P(t, 2.0, 4.2) ** 0.7)));
      ctx.save(); ctx.translate(540, 1745); ctx.scale(cp, cp);
      ctx.font = font(700, 40); ctx.letterSpacing = '0px'; const txt = `${n} halaman`, w = ctx.measureText(txt).width + 70;
      shadow(0.5, 24, 8); rr(-w / 2, -38, w, 76, 38); ctx.fillStyle = mix(C.mintD, C.coral, clamp(n / 60)); ctx.fill(); noShadow();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 2); ctx.restore();
    }
  }

  // =====================================================================
  // 2. "Bukan selalu karena tugasnya susah." — the page splits (5.0 – 9.0)
  // =====================================================================
  const PIECES = 5;
  function pieceRect(k, sp) {
    const w = 360, h = 480, ph = h / PIECES, x0 = 540 - w / 2, y0 = 1180 - h / 2;
    return { x: 540 + (rnd(k + 2) - 0.5) * 140 * sp, y: y0 + ph * (k + 0.5) + (k - 2) * 46 * sp, w: w - 40 * sp, h: ph - 8 * sp, rot: (rnd(k + 7) - 0.5) * 14 * DEG * sp, r: lerp(0, 18, sp), x0 };
  }
  function sSplit(t) {
    const flash = 1 - P(t, 5.0, 5.35);
    if (flash > 0) { ctx.fillStyle = `rgba(244,241,234,${0.35 * flash})`; ctx.fillRect(0, 0, W, H); }
    kText('Bukan selalu karena', 540, 430, t, 5.35, { size: 78, weight: 600, color: C.dim, out: 8.55 });
    kText('tugasnya susah.', 540, 575, t, 5.7, { size: 124, out: 8.55 });
    const sp = E.inOutExpo(P(t, 6.9, 7.7)), exit = E.inOutExpo(P(t, 8.7, 9.2));
    const pin = E.outExpo(P(t, 5.0, 5.5));
    ctx.save(); ctx.translate(-exit * W, 0);
    if (sp <= 0) page(540, 1180, 360 * lerp(1.25, 1, pin), 480 * lerp(1.25, 1, pin), 0, { seed: 3 });
    else for (let k = 0; k < PIECES; k++) {
      const p = pieceRect(k, sp), bob = Math.sin(t * 2 + k) * 8 * sp;
      ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(p.rot);
      shadow(0.45, 26, 10); rr(-p.w / 2, -p.h / 2, p.w, p.h, p.r); ctx.fillStyle = C.paper; ctx.fill(); noShadow();
      const lw = 7;
      line(-p.w / 2 + 40, -12, -p.w / 2 + 40 + p.w * (0.5 + rnd(k) * 0.3), -12, C.pline, lw);
      line(-p.w / 2 + 40, 14, -p.w / 2 + 40 + p.w * (0.3 + rnd(k + 1) * 0.3), 14, C.pline, lw);
      circle(p.w / 2 - 40, 0, 14 * sp, [C.mint, C.sky, C.amber, C.coral, C.mint][k]);
      ctx.restore();
    }
    ctx.restore();
  }

  // =====================================================================
  // 3. THREE CAUSES (9.0 – 24.0)
  // =====================================================================
  const CAUSE_T = [9.0, 14.0, 19.0], CD = 5.0;
  const CAUSES = [['Lihat semuanya', 'sekaligus'], ['Belum tahu harus', 'mulai dari mana'], ['Terlalu fokus', 'pada hasil akhir']];
  const TILES = ['Cari sumber', 'Tulis intro', 'Format', 'Kutipan', 'Data', 'Grafik', 'Pembahasan', 'Kesimpulan', 'Daftar pustaka', 'Cek typo', 'Judul', 'Margin', 'Abstrak', 'Tabel', 'Kirim'];
  function slideX(t, b) {
    const i = E.inOutExpo(P(t, b - 0.25, b + 0.3)), o = E.inOutExpo(P(t, b + CD - 0.25, b + CD + 0.3));
    return (1 - i) * W - o * W;
  }
  function causeHeader(t, i, b) {
    ctx.save();
    const np = E.outBack(P(t, b + 0.1, b + 0.5)) * (1 - E.inCubic(P(t, b + CD - 0.35, b + CD - 0.1)));
    if (np > 0) {
      ctx.save(); ctx.translate(540, 300); ctx.scale(np, np);
      ctx.font = font(800, 40); ctx.letterSpacing = '6px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lbl = `PENYEBAB  0${i + 1}`, w = ctx.measureText(lbl).width + 64;
      rr(-w / 2, -34, w, 68, 34); ctx.fillStyle = rgba(C.coral, 0.16); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.coral; ctx.stroke();
      ctx.fillStyle = C.coral; ctx.fillText(lbl, 3, 2); ctx.restore();
    }
    kText(CAUSES[i][0], 540, 460, t, b + 0.2, { size: 92, out: b + CD - 0.4 });
    kText(CAUSES[i][1], 540, 570, t, b + 0.35, { size: 92, color: C.coral, out: b + CD - 0.35 });
    ctx.restore();
  }
  function tile(x, y, w, h, label, hot, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(o.s ?? 1, o.s ?? 1); ctx.rotate(o.rot || 0); ctx.globalAlpha *= o.alpha ?? 1;
    shadow(0.4, 20, 8); rr(-w / 2, -h / 2, w, h, 20); ctx.fillStyle = mix(C.card, '#3A1D25', hot); ctx.fill(); noShadow();
    ctx.lineWidth = 3; ctx.strokeStyle = mix(C.line, C.coral, hot); ctx.stroke();
    circle(-w / 2 + 34, 0, 9, mix(C.dim, C.coral, hot));
    ctx.font = font(600, o.fs || 30); ctx.letterSpacing = '0px'; ctx.fillStyle = mix(C.ink, '#FFD9DD', hot); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, -w / 2 + 58, 2); ctx.restore();
  }
  // 01 — everything lights up at once, the load meter overflows
  function vAll(t, b) {
    const u = t - b, cols = 3, tw = 300, th = 116, gx = 18, gy = 22;
    const x0 = 540 - (cols * tw + (cols - 1) * gx) / 2 + tw / 2, y0 = 760;
    const all = P(u, 2.8, 3.0);
    const shake = all * (1 - P(u, 3.6, 4.2)) * 7;
    TILES.forEach((lab, k) => {
      const c = k % cols, r = Math.floor(k / cols);
      const p = E.outBack(P(u, 0.35 + k * 0.05, 0.75 + k * 0.05));
      if (p <= 0) return;
      // sequential flashes, speeding up, then everything at once
      const order = (k * 7) % 15, ft = 1.2 + 1.5 * Math.sqrt(order / 15);
      const flash = Math.max(Math.exp(-Math.max(0, u - ft) * 5) * (u > ft ? 1 : 0), all);
      tile(x0 + c * (tw + gx) + Math.sin(t * 60 + k) * shake, y0 + r * (th + gy) + Math.cos(t * 53 + k) * shake, tw, th, lab, flash, { s: p, fs: 28 });
    });
    // mental-load meter
    const mp = E.outCubic(P(u, 0.9, 1.3));
    if (mp > 0) {
      const y = 1560, x = 130, w = 820, fill = E.inOutCubic(P(u, 1.2, 3.0));
      ctx.save(); ctx.globalAlpha *= mp;
      ctx.font = font(600, 30); ctx.fillStyle = C.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('Beban pikiran', x, y - 26);
      ctx.textAlign = 'right'; ctx.font = font(800, 34); ctx.fillStyle = fill > 0.95 ? (Math.floor(t * 6) % 2 ? C.coral : '#fff') : C.ink;
      ctx.fillText(fill > 0.95 ? 'OVERLOAD' : `${Math.round(fill * 100)}%`, x + w, y - 24);
      rr(x, y, w, 30, 15); ctx.fillStyle = C.card2; ctx.fill();
      if (fill > 0) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, C.amber); g.addColorStop(1, C.coral); rr(x, y, w * fill, 30, 15); ctx.fillStyle = g; ctx.fill(); }
      ctx.restore();
    }
  }
  // 02 — a compass that can't settle on a first step
  function vCompass(t, b) {
    const u = t - b, cx = 540, cy = 1150;
    const labels = ['Cari sumber', 'Tulis intro', 'Judul', 'Data', 'Kutipan', 'Abstrak', 'Grafik', 'Kesimpulan'];
    const ang = u * 5.2 + 2.2 * Math.sin(u * 2.7) + 1.4 * Math.sin(u * 6.1) - Math.PI / 2;
    labels.forEach((lab, k) => {
      const a = -Math.PI / 2 + k * TAU / labels.length;
      const p = E.outBack(P(u, 0.4 + k * 0.06, 0.8 + k * 0.06));
      if (p <= 0) return;
      const hot = clamp(1 - Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a))) / 0.45); // pointed-at tile lights up
      const x = cx + Math.cos(a) * 360, y = cy + Math.sin(a) * 440 + Math.sin(t * 2 + k) * 6;
      ctx.save(); ctx.font = font(600, 28); const w = ctx.measureText(lab).width + 86; ctx.restore();
      tile(x, y, w, 84, lab, hot, { s: p, fs: 28 });
    });
    const cp = E.outBack(P(u, 0.2, 0.7));
    if (cp > 0) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(cp, cp);
      shadow(0.5, 40, 12); circle(0, 0, 170, C.card); noShadow();
      ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.stroke();
      for (let k = 0; k < 36; k++) { const a = k * TAU / 36, r1 = k % 9 === 0 ? 118 : 132; line(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * 142, Math.sin(a) * 142, k % 9 === 0 ? C.ink : C.dim, k % 9 === 0 ? 5 : 3); }
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -112); ctx.lineTo(18, 0); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fillStyle = C.coral; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 112); ctx.lineTo(18, 0); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
      ctx.rotate(-(ang + Math.PI / 2));
      circle(0, 0, 44, C.bg);
      ctx.font = font(800, 58); ctx.fillStyle = C.amber; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 4);
      ctx.restore();
    }
  }
  // 03 — staring at the summit makes the mountain grow
  function vMountain(t, b) {
    const u = t - b, grow = E.inOutCubic(P(u, 0.7, 3.8)), base = 1640, peakY = lerp(1360, 900, grow), bx0 = 90, bx1 = 990, px = 560;
    const ap = E.outCubic(P(u, 0.2, 0.7));
    if (ap <= 0) return;
    ctx.save(); ctx.globalAlpha *= ap;
    // back range
    ctx.beginPath(); ctx.moveTo(bx0 - 80, base); ctx.lineTo(260, lerp(1420, 1180, grow)); ctx.lineTo(420, base); ctx.closePath(); ctx.fillStyle = '#141A26'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(700, base); ctx.lineTo(900, lerp(1450, 1250, grow)); ctx.lineTo(bx1 + 100, base); ctx.closePath(); ctx.fill();
    // main peak
    const g = ctx.createLinearGradient(0, peakY, 0, base); g.addColorStop(0, '#2B3448'); g.addColorStop(1, '#161C28');
    ctx.beginPath(); ctx.moveTo(bx0, base); ctx.lineTo(px, peakY); ctx.lineTo(bx1, base); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    // snow cap
    const cap = 0.2, lx = lerp(px, bx0, cap), rx = lerp(px, bx1, cap), cy = lerp(peakY, base, cap);
    ctx.beginPath(); ctx.moveTo(px, peakY); ctx.lineTo(rx, cy); ctx.lineTo(lerp(px, rx, 0.6), cy - 22); ctx.lineTo(px, cy + 10); ctx.lineTo(lerp(px, lx, 0.6), cy - 22); ctx.lineTo(lx, cy); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
    // flag + goal label
    line(px, peakY, px, peakY - 110, C.ink, 5);
    ctx.beginPath(); ctx.moveTo(px, peakY - 110); ctx.lineTo(px + 70 + Math.sin(t * 6) * 6, peakY - 90); ctx.lineTo(px, peakY - 70); ctx.closePath(); ctx.fillStyle = C.coral; ctx.fill();
    ctx.font = font(800, 34); ctx.letterSpacing = '2px';
    const gl = 'HASIL AKHIR', gw = ctx.measureText(gl).width + 56;
    rr(px + 90, peakY - 124, gw, 64, 32); ctx.fillStyle = rgba(C.amber, 0.16); ctx.fill(); ctx.strokeStyle = C.amber; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = C.amber; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gl, px + 90 + gw / 2 + 1, peakY - 90);
    // you, tiny, at the bottom
    const yx = 170, yy = base - 22;
    circle(yx, yy - 36, 14, C.mint); rr(yx - 13, yy - 20, 26, 40, 10); ctx.fillStyle = C.mint; ctx.fill();
    ctx.font = font(700, 28); ctx.letterSpacing = '0px'; ctx.fillStyle = C.mint; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('kamu', yx, base + 44);
    // distance line
    const dp = E.inOutCubic(P(u, 1.2, 2.2));
    if (dp > 0) {
      ctx.save(); ctx.setLineDash([12, 12]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = rgba(C.ink, 0.5); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(yx + 30, yy - 50); ctx.lineTo(lerp(yx + 30, px - 30, dp), lerp(yy - 50, peakY + 30, dp)); ctx.stroke(); ctx.restore();
      const lp = P(u, 2.0, 2.4);
      if (lp > 0) {
        const mx = lerp(yx + 30, px - 30, 0.45), my = lerp(yy - 50, peakY + 30, 0.45);
        ctx.save(); ctx.globalAlpha *= lp; ctx.font = font(700, 30); ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText('jauh banget…', mx - 24, my); ctx.restore();
      }
    }
    ctx.restore();
  }
  const VIS = [vAll, vCompass, vMountain];
  function sCauses(t) {
    CAUSE_T.forEach((b, i) => {
      if (t < b - 0.3 || t > b + CD + 0.35) return;
      ctx.save(); ctx.translate(slideX(t, b), 0);
      VIS[i](t, b);
      ctx.restore();
      causeHeader(t, i, b);
    });
  }

  // =====================================================================
  // 4. STEPS (24.0 – 33.5): Baca → Pahami → Pecah → Kerjakan → Review
  // =====================================================================
  const STEPS = [
    ['Baca', 'Baca instruksi sampai habis', 'book'],
    ['Pahami', 'Apa yang sebenarnya diminta?', 'bulb'],
    ['Pecah', 'Bagi jadi bagian-bagian kecil', 'split'],
    ['Kerjakan', 'Satu bagian, satu waktu', 'pen'],
    ['Review', 'Cek ulang, lalu kirim', 'lens'],
  ];
  const ST0 = 24.0, S0 = 25.0, SD = 1.5, DONE = S0 + SD * 5, END = 33.5;
  const CARD = { x: 100, w: 880, h: 150, y0: 650, gap: 28 };
  const cardY = i => CARD.y0 + i * (CARD.h + CARD.gap);
  function icon(kind, x, y, s, c, p) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const k = s / 60;
    ctx.scale(k, k);
    if (kind === 'book') {
      const o = Math.sin(p * Math.PI * 2) * 4;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(-14, -26 - o, -28, -20); ctx.lineTo(-28, 20); ctx.quadraticCurveTo(-14, 14 - o, 0, 22); ctx.quadraticCurveTo(14, 14 - o, 28, 20); ctx.lineTo(28, -20); ctx.quadraticCurveTo(14, -26 - o, 0, -18); ctx.lineTo(0, 22); ctx.stroke();
    } else if (kind === 'bulb') {
      ctx.beginPath(); ctx.arc(0, -6, 18, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(8, 14); ctx.lineTo(-8, 14); ctx.closePath(); ctx.stroke();
      line(-7, 22, 7, 22, c, 5);
      const g = Math.sin(p * Math.PI);
      for (let a = 0; a < 5; a++) { const an = -Math.PI / 2 + (a - 2) * 0.6; line(Math.cos(an) * 26, -6 + Math.sin(an) * 26, Math.cos(an) * (26 + 8 * g), -6 + Math.sin(an) * (26 + 8 * g), c, 4); }
    } else if (kind === 'split') {
      const g = 4 + 8 * Math.sin(p * Math.PI);
      rr(-26, -24, 52, 14, 4); ctx.stroke(); rr(-26 - g * 0.3, -5, 52, 14, 4); ctx.stroke(); rr(-26 + g * 0.3, 14, 52, 14, 4); ctx.stroke();
    } else if (kind === 'pen') {
      ctx.rotate(-0.8 + Math.sin(p * TAU * 2) * 0.1);
      rr(-8, -28, 16, 44, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(0, 30); ctx.lineTo(8, 16); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-4 + Math.sin(p * TAU) * 3, -4, 16, 0, TAU); ctx.stroke(); line(8, 8, 22, 22, c, 6);
    }
    ctx.restore();
  }
  function sSteps(t) {
    const out = E.inOutExpo(P(t, END, END + 0.5));
    // header: the flow, lighting up word by word
    const hp = P(t, ST0 + 0.2, ST0 + 0.6) * (1 - P(t, END - 0.1, END + 0.2));
    if (hp > 0) {
      ctx.save(); ctx.globalAlpha *= hp;
      ctx.font = font(700, 30); ctx.letterSpacing = '6px'; ctx.fillStyle = C.mint; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('UBAH JADI LANGKAH SEDERHANA', 540, 318);
      ctx.restore();
    }
    const parts = STEPS.map(s => s[0]);
    ctx.save(); ctx.font = font(800, 62); ctx.letterSpacing = '-1px';
    const arrowW = 64, ws = parts.map(p => ctx.measureText(p).width), total = ws.reduce((a, b) => a + b, 0) + arrowW * 4;
    const fit = Math.min(1, 960 / total);
    let x = 540 - total * fit / 2;
    parts.forEach((p, i) => {
      const s = S0 + i * SD, ap = E.outExpo(P(t, ST0 + 0.3 + i * 0.08, ST0 + 0.9 + i * 0.08)) * (1 - P(t, END - 0.1, END + 0.2));
      const done = P(t, s + 1.0, s + 1.2), act = P(t, s, s + 0.2);
      if (ap > 0) {
        ctx.save(); ctx.globalAlpha *= ap; ctx.translate(x, 430 + (1 - ap) * 40); ctx.scale(fit, fit);
        ctx.fillStyle = done > 0.5 ? C.mint : act > 0.5 ? C.ink : '#4A5264'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(p, 0, 0);
        if (i < 4) { ctx.fillStyle = '#4A5264'; ctx.font = font(600, 50); ctx.fillText('→', ws[i] + 10, -4); ctx.font = font(800, 62); }
        ctx.restore();
      }
      x += (ws[i] + arrowW) * fit;
    });
    ctx.restore();
    // big task block slicing into five slots
    const bp = E.outBack(P(t, ST0 + 0.1, ST0 + 0.5)), sl = E.inOutExpo(P(t, ST0 + 0.6, ST0 + 1.2));
    ctx.save(); ctx.translate(0, -out * 260); ctx.globalAlpha *= 1 - out;
    STEPS.forEach((st, i) => {
      const from = { x: 540 - 280, y: 760 + i * 128, w: 560, h: 128 }, to = { x: CARD.x, y: cardY(i), w: CARD.w, h: CARD.h };
      const r = { x: lerp(from.x, to.x, sl), y: lerp(from.y, to.y, sl), w: lerp(from.w, to.w, sl), h: lerp(from.h, to.h, sl) };
      if (bp <= 0) return;
      const s = S0 + i * SD, cin = E.outExpo(P(t, s, s + 0.45)), act = P(t, s, s + 0.2) * (1 - P(t, s + 1.0, s + 1.3));
      const chk = P(t, s + 1.0, s + 1.3), pulse = Math.sin(clamp((t - s - 1.0) / 0.35) * Math.PI) * 0.035;
      const wave = Math.sin(clamp((t - DONE - i * 0.08) / 0.4) * Math.PI) * 0.03;
      ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(bp * (1 + pulse + wave), bp * (1 + pulse + wave));
      if (sl < 1) { // the task block
        ctx.fillStyle = mix(C.coral, C.card, sl); rr(-r.w / 2, -r.h / 2 + 2, r.w, r.h - 4 * sl, lerp(0, 26, sl)); ctx.fill();
        if (i === 2 && sl < 0.2) { ctx.font = font(800, 64); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha *= 1 - sl * 5; ctx.fillText('TUGAS BESAR', 0, 4); }
      } else {
        shadow(act > 0 ? 0.55 : 0.35, act > 0 ? 50 : 24, 10, act > 0 ? '61,220,151' : '0,0,0');
        rr(-r.w / 2, -r.h / 2, r.w, r.h, 26); ctx.fillStyle = mix(C.card, '#12281F', chk * 0.6 + act * 0.3); ctx.fill(); noShadow();
        ctx.lineWidth = 3; ctx.strokeStyle = mix(C.line, C.mint, Math.max(act, chk * 0.6)); ctx.stroke();
        if (cin <= 0) { // empty slot
          ctx.setLineDash([10, 10]); ctx.strokeStyle = '#3A4356'; rr(-r.w / 2 + 16, -r.h / 2 + 16, r.w - 32, r.h - 32, 18); ctx.stroke(); ctx.setLineDash([]);
        } else {
          ctx.save(); ctx.globalAlpha *= cin; ctx.translate((1 - cin) * 80, 0);
          rr(-r.w / 2 + 26, -48, 96, 96, 22); ctx.fillStyle = mix(C.card2, C.mintD, chk); ctx.fill();
          icon(st[2], -r.w / 2 + 74, 0, 62, mix(C.ink, C.mint, Math.max(act, chk)), P(t, s, s + 1.0));
          ctx.font = font(800, 52); ctx.letterSpacing = '-1px'; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(st[0], -r.w / 2 + 150, -6);
          ctx.font = font(500, 29); ctx.letterSpacing = '0px'; ctx.fillStyle = C.dim; ctx.fillText(st[1], -r.w / 2 + 150, 38);
          ctx.font = font(700, 24); ctx.fillStyle = '#4A5264'; ctx.textAlign = 'right'; ctx.fillText(`0${i + 1}`, r.w / 2 - 120, -34);
          ctx.restore();
          // checkbox
          const bx = r.w / 2 - 66;
          ctx.lineWidth = 4; ctx.strokeStyle = chk > 0 ? C.mint : '#4A5264'; ctx.beginPath(); ctx.arc(bx, 0, 30, 0, TAU); ctx.stroke();
          if (chk > 0) { circle(bx, 0, 30 * E.outBack(chk), C.mint); tick(bx, 0, 34, C.bg, 6, P(t, s + 1.05, s + 1.3)); }
          // burst
          const bu = P(t, s + 1.0, s + 1.6);
          if (bu > 0 && bu < 1) for (let k = 0; k < 10; k++) {
            const a = k * TAU / 10 + i, d = 36 + 70 * E.outCubic(bu);
            circle(bx + Math.cos(a) * d, Math.sin(a) * d, 6 * (1 - bu), k % 2 ? C.mint : C.amber);
          }
        }
      }
      ctx.restore();
    });
    // progress
    const pp = E.outCubic(P(t, S0 - 0.3, S0 + 0.1));
    if (pp > 0) {
      let prog = 0; for (let i = 0; i < 5; i++) prog += E.inOutCubic(P(t, S0 + i * SD + 1.0, S0 + i * SD + 1.4)) / 5;
      const y = 1600, x = CARD.x, w = CARD.w;
      ctx.save(); ctx.globalAlpha *= pp;
      rr(x, y, w, 22, 11); ctx.fillStyle = C.card2; ctx.fill();
      if (prog > 0) { rr(x, y, w * prog, 22, 11); ctx.fillStyle = C.mint; ctx.fill(); circle(x + w * prog, y + 11, 18, C.mint); circle(x + w * prog, y + 11, 8, C.bg); }
      ctx.font = font(700, 30); ctx.fillStyle = C.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('Progres', x, y - 22);
      ctx.textAlign = 'right'; ctx.fillStyle = prog > 0.99 ? C.mint : C.ink; ctx.font = font(800, 34); ctx.fillText(`${Math.round(prog * 100)}%`, x + w, y - 20);
      ctx.restore();
      // completion ring burst
      const rb = P(t, DONE, DONE + 0.9);
      if (rb > 0 && rb < 1) { ctx.save(); ctx.globalAlpha *= 1 - rb; ctx.lineWidth = 6 * (1 - rb) + 1; ctx.strokeStyle = C.mint; ctx.beginPath(); ctx.arc(x + w, y + 11, 20 + 200 * E.outCubic(rb), 0, TAU); ctx.stroke(); ctx.restore(); }
    }
    ctx.restore();
  }

  // =====================================================================
  // 5. ENDING (33.5 – 40)
  // =====================================================================
  function lightBlocks(t) { // small pieces drifting up — "ringan"
    for (let k = 0; k < 18; k++) {
      const st = END + 0.1 + rnd(k) * 0.6, p = P(t, st, st + 0.5);
      if (p <= 0) continue;
      const life = (t - st) / 6, x = (k % 2 ? 60 + rnd(k + 3) * 150 : 870 + rnd(k + 3) * 150) + Math.sin(t * 0.8 + k) * 20;
      const y = cardY(k % 5) + 75 - life * 900 - p * 40, s = 18 + rnd(k + 9) * 26;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.5 * (k % 2 ? 1 : -1) + k); ctx.globalAlpha *= p * 0.5 * (1 - P(t, 39.0, 39.6));
      rr(-s / 2, -s / 2, s, s, s * 0.25); ctx.fillStyle = [C.mint, C.sky, C.amber][k % 3]; ctx.fill(); ctx.restore();
    }
  }
  function sEnd(t) {
    lightBlocks(t);
    const o1 = 36.3;
    kText('Tugas besar', 540, 700, t, END + 0.25, { size: 116, out: o1 });
    kText('terasa ringan', 540, 830, t, END + 0.5, { size: 116, hl: { 1: C.mint }, bob: { 1: true }, out: o1 });
    kText('kalau dipecah menjadi', 540, 960, t, END + 0.95, { size: 64, weight: 600, color: C.dim, out: o1 + 0.05 });
    kText('langkah kecil.', 540, 1075, t, END + 1.25, { size: 92, color: C.mint, out: o1 + 0.05 });
    kText('Jangan selesaikan', 540, 640, t, 36.55, { size: 70, weight: 600, color: C.dim });
    kText('semuanya sekaligus.', 540, 735, t, 36.8, { size: 70, weight: 600, color: C.dim });
    kText('Selesaikan', 540, 920, t, 37.35, { size: 124 });
    kText('satu langkah dulu.', 540, 1055, t, 37.6, { size: 116, color: C.mint });
    // one single step card
    const cp = E.outBack(P(t, 38.2, 38.6));
    if (cp > 0) {
      ctx.save(); ctx.translate(540, 1250); ctx.scale(cp, cp);
      shadow(0.5, 50, 10, '61,220,151'); rr(-230, -64, 460, 128, 64); ctx.fillStyle = '#12281F'; ctx.fill(); noShadow();
      ctx.lineWidth = 3; ctx.strokeStyle = C.mint; ctx.stroke();
      const chk = P(t, 38.6, 38.9);
      circle(-160, 0, 38, chk > 0 ? C.mint : C.card2); tick(-160, 0, 42, C.bg, 7, chk);
      ctx.font = font(800, 44); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Langkah 1', -100, 3);
      ctx.restore();
    }
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px'; noShadow();
    background(t);
    if (t < 5.1) sHook(t);
    if (t >= 5.0 && t < 9.3) sSplit(t);
    if (t >= 8.7 && t < 24.4) sCauses(t);
    if (t >= 23.9 && t < END + 0.6) sSteps(t);
    if (t >= END) sEnd(t);
    postFx(t);
    finish(t);
    ctx.restore();
  }

  // ---------- runtime ----------
  window.TASKKORA = { render, ready, DURATION, W, H };
  const params = new URLSearchParams(location.search);
  if (params.has('render')) { document.body.classList.add('render'); return; }
  const btn = document.getElementById('play'), seek = document.getElementById('seek'), tl = document.getElementById('time');
  let playing = true, start = performance.now(), tNow = 0;
  if (params.has('t')) { tNow = parseFloat(params.get('t')); playing = false; btn.textContent = 'Play'; }
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; start = performance.now() - tNow * 1000; };
  seek.oninput = () => { tNow = parseFloat(seek.value); start = performance.now() - tNow * 1000; };
  ready.then(() => {
    const loop = () => {
      if (playing) tNow = ((performance.now() - start) / 1000) % DURATION;
      render(tNow); seek.value = tNow; tl.textContent = tNow.toFixed(2) + 's';
      requestAnimationFrame(loop);
    };
    loop();
  });
})();
