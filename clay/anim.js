/* "Tugas numpuk? Ya dibentuk." — 40s, 1080x1920, claymation stop-motion.
 * Every prop is a lumpy clay blob: volume gradient + fingerprint texture + contact shadow.
 * Motion is quantised to 12 poses/s and every pose "boils" slightly, like hand-animated clay.
 * Every frame is a pure function of time; shared timing lives in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, TAU = Math.PI * 2;
  const TL = window.CLAY_TL, q = TL.q;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', navy: '#14224F', navy2: '#1F2D5C', white: '#F2F4F8', amber: '#F2A93B',
    wall: '#D9E2F2', skin: '#EDC29C', skinArt: '#E6B58C', wood: '#D08F45', woodLo: '#A86A2C',
    coffee: '#7C4A22', sky: '#9DB8EA', paper: '#F4F5F7',
  };
  const FONT = '"Fredoka", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const outBack = x => { const c1 = 1.8, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const shade = (h, k) => { // k>0 lighten, k<0 darken
    const c = hex(h).map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
    return '#' + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  };
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;

  let F = 0;          // current stop-motion pose index (drives the boil)
  const BOIL = 0.022;

  // ---------- assets ----------
  const mark = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load(`700 60px ${FONT}`), document.fonts.load(`600 60px ${FONT}`),
  ]).then(() => document.fonts.ready);

  // clay texture: neutral grey + speckle + fingerprint whorls + tool smears (used with soft-light)
  const TEX = (() => {
    const S = 512, c = Object.assign(document.createElement('canvas'), { width: S, height: S }), g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 128 + (rnd(i * 0.37) - 0.5) * 26;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.filter = 'blur(0.7px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    const whorl = (cx, cy, k) => {
      const rot = rnd(k) * Math.PI, sx = 0.75 + rnd(k + 1) * 0.3;
      for (let r = 5; r < 70; r += 4.2) {
        const a0 = rnd(k * 9 + r) * 1.2, a1 = a0 + Math.PI * (1.2 + rnd(k * 3 + r) * 0.75);
        for (const [dx, col] of [[0, 'rgba(0,0,0,0.20)'], [1.6, 'rgba(255,255,255,0.16)']]) {
          g.save(); g.translate(cx + dx, cy + dx); g.rotate(rot); g.scale(1, sx);
          g.beginPath(); g.ellipse(0, 0, r, r * 1.25, 0, a0, a1); g.strokeStyle = col; g.lineWidth = 1.3; g.stroke(); g.restore();
        }
      }
    };
    for (let k = 0; k < 7; k++) whorl(rnd(k + 10) * S, rnd(k + 20) * S, k);
    for (let k = 0; k < 14; k++) { // smears
      g.beginPath(); const x = rnd(k + 40) * S, y = rnd(k + 50) * S;
      g.moveTo(x, y); g.quadraticCurveTo(x + 60, y + (rnd(k + 60) - 0.5) * 60, x + 140, y + (rnd(k + 70) - 0.5) * 40);
      g.strokeStyle = k % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; g.lineWidth = 2 + rnd(k) * 3; g.stroke();
    }
    for (let k = 0; k < 160; k++) { // pits
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.arc(rnd(k + 90) * S, rnd(k + 190) * S, 0.8 + rnd(k + 290) * 1.6, 0, TAU); g.fill();
    }
    return c;
  })();
  const texPat = ctx.createPattern(TEX, 'repeat');
  const GRAIN = (() => {
    const S = 256, c = Object.assign(document.createElement('canvas'), { width: S, height: S }), g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = rnd(i * 1.13 + 7) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return ctx.createPattern(c, 'repeat');
  })();

  // ---------- clay primitives ----------
  // lumpy superellipse; p=2 ellipse, higher p = boxier. Returns its bbox.
  function blob(cx, cy, rx, ry, o = {}) {
    const n = o.n || (o.p > 3 ? 44 : 30), p = o.p || 2, rot = o.rot || 0, lump = o.lump ?? 0.03, seed = o.seed || 0;
    const boil = o.boil ?? BOIL, cr = Math.cos(rot), sr = Math.sin(rot);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, c = Math.cos(a), s = Math.sin(a);
      let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * rx, y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * ry;
      const k = 1 + lump * (rnd(seed * 7.31 + i * 1.7) - 0.5) * 2 + boil * (rnd(seed * 3.17 + i * 5.3 + F * 0.913) - 0.5);
      x *= k; y *= k;
      if (o.warp) [x, y] = o.warp(x, y);
      pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    ctx.beginPath();
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let s0 = m(pts[n - 1], pts[0]); ctx.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], mm = m(a, b); ctx.quadraticCurveTo(a[0], a[1], mm[0], mm[1]); }
    ctx.closePath();
    const R = Math.max(rx, ry) * 1.25;
    return { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R };
  }
  function capsule(ax, ay, bx, by, r, seed = 0) {
    const j = BOIL * r * (rnd(seed + F * 0.71) - 0.5) * 2;
    const a = Math.atan2(by - ay, bx - ax);
    ctx.beginPath();
    ctx.arc(ax, ay, r + j, a + Math.PI / 2, a - Math.PI / 2);
    ctx.arc(bx, by, r - j * 0.5, a - Math.PI / 2, a + Math.PI / 2);
    ctx.closePath();
    return { x: Math.min(ax, bx) - r, y: Math.min(ay, by) - r, w: Math.abs(bx - ax) + 2 * r, h: Math.abs(by - ay) + 2 * r };
  }
  // fill a path as clay
  function clay(path, color, o = {}) {
    let bb = path();
    ctx.save();
    if (o.shadow !== false) {
      ctx.shadowColor = `rgba(8,14,44,${o.sa ?? 0.32})`; ctx.shadowBlur = o.sb ?? 14;
      ctx.shadowOffsetX = o.sx ?? 5; ctx.shadowOffsetY = o.sy ?? 9;
    }
    ctx.fillStyle = color; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.clip();
    const lx = bb.x + bb.w * (o.lx ?? 0.33), ly = bb.y + bb.h * (o.ly ?? 0.28), rr = Math.max(bb.w, bb.h) * 0.9;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, rr);
    g.addColorStop(0, shade(color, o.hi ?? 0.24)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -(o.lo ?? 0.3)));
    ctx.fillStyle = g; ctx.fillRect(bb.x - 20, bb.y - 20, bb.w + 40, bb.h + 40);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = o.tex ?? 0.95;
    const s = (o.seed || 0) * 97.3, ox = s % 512, oy = (s * 1.7) % 512;
    ctx.translate(ox, oy);
    ctx.fillStyle = texPat; ctx.fillRect(bb.x - 20 - ox, bb.y - 20 - oy, bb.w + 40, bb.h + 40);
    ctx.restore();
    bb = path();
    ctx.lineWidth = o.edge ?? 9; ctx.strokeStyle = `rgba(10,16,40,${o.ea ?? 0.18})`; ctx.stroke();
    ctx.restore();
  }
  const B = (cx, cy, rx, ry, o) => () => blob(cx, cy, rx, ry, o);
  const Cap = (ax, ay, bx, by, r, seed) => () => capsule(ax, ay, bx, by, r, seed);
  // a carved line (mouth, brows): dark groove + light lip under it
  function groove(pathFn, w = 7) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(0, 2.5); pathFn(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = w; ctx.stroke();
    ctx.translate(0, -2.5); pathFn(); ctx.strokeStyle = 'rgba(30,18,30,0.75)'; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }

  // clay lettering (per-letter boil, extruded, shaded, textured)
  const tcan = Object.assign(document.createElement('canvas'), { width: W, height: 360 });
  const tc = tcan.getContext('2d');
  const tmask = Object.assign(document.createElement('canvas'), { width: W, height: 360 });
  const tm = tmask.getContext('2d');
  function clayText(str, cx, cy, size, color, o = {}) {
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W, 360);
    tc.font = `700 ${size}px ${FONT}`; tc.textBaseline = 'middle'; tc.textAlign = 'left';
    const ws = [...str].map(ch => tc.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0);
    const fit = Math.min(1, (o.maxW || 980) / total);
    const sc = o.scale ?? 1;
    const draw = (col, dx, dy, g = tc) => {
      g.fillStyle = col; let x = W / 2 - total * fit / 2;
      [...str].forEach((ch, i) => {
        const pop = o.pop ? o.pop(i) : 1;
        if (pop > 0 && ch !== ' ') {
          const r = (rnd(i * 13 + F * 0.37 + (o.seed || 0)) - 0.5) * 0.06, jy = (rnd(i * 7 + F * 0.53) - 0.5) * 4;
          g.save(); g.translate(x + ws[i] * fit / 2 + dx, 180 + jy + dy); g.rotate(r + (i % 2 ? 0.02 : -0.02)); g.scale(fit * pop, fit * pop);
          g.fillText(ch, -ws[i] / 2, 0); g.restore();
        }
        x += ws[i] * fit;
      });
    };
    draw(o.side || C.navy, 0, size * 0.07);          // thickness of the clay letters
    draw(color, 0, 0);
    tc.globalCompositeOperation = 'source-atop';
    const g = tc.createLinearGradient(0, 180 - size / 2, 0, 180 + size / 2);
    g.addColorStop(0, shade(color, 0.3)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.25));
    tc.fillStyle = g; tc.fillRect(0, 0, W, 360);
    tc.globalCompositeOperation = 'soft-light'; tc.fillStyle = texPat; tc.fillRect(0, 0, W, 360);
    // soft-light also paints transparent pixels: re-mask with the letter shapes
    tm.setTransform(1, 0, 0, 1, 0, 0); tm.clearRect(0, 0, W, 360); tm.font = tc.font; tm.textBaseline = 'middle'; tm.textAlign = 'left';
    draw('#000', 0, size * 0.07, tm); draw('#000', 0, 0, tm);
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(tmask, 0, 0);
    tc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.shadowColor = 'rgba(8,14,44,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 10;
    ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.drawImage(tcan, -W / 2, -180);
    ctx.restore();
  }

  // logo as clay: raised (white) or pressed-in (imprint)
  const lcan = Object.assign(document.createElement('canvas'), { width: 520, height: 520 });
  const lc = lcan.getContext('2d');
  const lcan2 = Object.assign(document.createElement('canvas'), { width: 520, height: 520 });
  const lc2 = lcan2.getContext('2d');
  function maskInto(g, color, dx = 0, dy = 0) {
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 520, 520);
    g.drawImage(mark, 40 + dx, 40 + dy, 440, 440);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 520, 520);
    g.globalCompositeOperation = 'source-over';
  }
  function clayLogo(cx, cy, size, mode, alpha = 1) {
    if (mode === 'imprint') {
      maskInto(lc, shade(C.blue, -0.05));
      // inner shadow on the top-left walls of the hollow
      maskInto(lc2, 'rgba(5,12,40,0.75)');
      lc2.globalCompositeOperation = 'destination-out'; lc2.drawImage(mark, 40 + 9, 40 + 11, 440, 440); lc2.globalCompositeOperation = 'source-over';
      lc.globalCompositeOperation = 'source-atop'; lc.drawImage(lcan2, 0, 0);
      maskInto(lc2, 'rgba(255,255,255,0.55)');
      lc2.globalCompositeOperation = 'destination-out'; lc2.drawImage(mark, 40 - 5, 40 - 6, 440, 440); lc2.globalCompositeOperation = 'source-over';
      lc.drawImage(lcan2, 0, 0);
      lc.globalCompositeOperation = 'soft-light'; lc.fillStyle = texPat; lc.fillRect(0, 0, 520, 520);
      lc.globalCompositeOperation = 'destination-in'; lc.drawImage(mark, 40, 40, 440, 440);
      lc.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(lcan, cx - size / 2 * 520 / 440, cy - size / 2 * 520 / 440, size * 520 / 440, size * 520 / 440); ctx.restore();
      return;
    }
    // raised white clay
    maskInto(lc, C.white);
    lc.globalCompositeOperation = 'source-atop';
    const g = lc.createRadialGradient(170, 150, 0, 170, 150, 420);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, '#E9EDF5'); g.addColorStop(1, '#B9C3D9');
    lc.fillStyle = g; lc.fillRect(0, 0, 520, 520);
    maskInto(lc2, 'rgba(20,34,79,0.4)');
    lc2.globalCompositeOperation = 'destination-out'; lc2.drawImage(mark, 40 - 6, 40 - 7, 440, 440); lc2.globalCompositeOperation = 'source-over';
    lc.drawImage(lcan2, 0, 0);
    lc.globalCompositeOperation = 'soft-light'; lc.fillStyle = texPat; lc.fillRect(0, 0, 520, 520);
    lc.globalCompositeOperation = 'destination-in'; lc.drawImage(mark, 40, 40, 440, 440);
    lc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(5,12,40,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 14;
    const s = size * 520 / 440;
    ctx.drawImage(lcan, cx - s / 2, cy - s / 2, s, s);
    ctx.restore();
  }

  // =====================================================================
  // SET: miniature kos room
  const DESK_Y = 1300;
  function room(t) {
    // wall
    const g = ctx.createLinearGradient(0, 0, 0, 1450);
    g.addColorStop(0, '#C6D3EC'); g.addColorStop(0.5, C.wall); g.addColorStop(1, '#C9D5EC');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 1460);
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.9; ctx.fillStyle = texPat; ctx.fillRect(0, 0, W, 1460); ctx.restore();
    // faint wallpaper stripes, pressed in by a tool
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = C.blue;
    for (let x = 30; x < W; x += 90) ctx.fillRect(x, 0, 10, 1440);
    ctx.restore();
    // window
    clay(B(240, 720, 175, 190, { p: 6, seed: 3, lump: 0.01 }), C.white, { seed: 3 });
    clay(B(240, 720, 140, 155, { p: 6, seed: 4, lump: 0.01 }), '#13205A', { shadow: false, seed: 4, hi: 0.15, lo: 0.4 });
    clay(B(300, 640, 34, 34, { seed: 5 }), C.amber, { shadow: false, seed: 5 });           // moon
    clay(B(286, 632, 26, 28, { seed: 6 }), '#13205A', { shadow: false, seed: 6, tex: 0.5 }); // crescent cut
    for (let k = 0; k < 6; k++) {
      const tw = (F + k * 3) % 9 < 6 ? 1 : 0.5;
      ctx.save(); ctx.globalAlpha = tw; clay(B(140 + rnd(k + 3) * 190, 600 + rnd(k + 8) * 220, 5, 5, { seed: 20 + k }), '#FFFFFF', { shadow: false, seed: k, tex: 0.3 }); ctx.restore();
    }
    clay(B(240, 720, 10, 160, { p: 6, seed: 7 }), C.white, { seed: 7, sb: 6, sy: 4 });      // mullion
    clay(B(240, 720, 150, 10, { p: 6, seed: 8 }), C.white, { seed: 8, sb: 6, sy: 4 });
    clay(B(80, 730, 46, 215, { p: 3, seed: 9, warp: (x, y) => [x + Math.sin(y / 40) * 6, y] }), C.blue, { seed: 9 }); // curtains
    clay(B(400, 730, 46, 215, { p: 3, seed: 10, warp: (x, y) => [x + Math.sin(y / 40 + 1) * 6, y] }), C.blue, { seed: 10 });
    // sticky notes
    stickies(t);
    // bed (right, behind the desk)
    clay(B(1000, 1330, 190, 130, { p: 4, seed: 12 }), C.navy2, { seed: 12 });
    clay(B(985, 1255, 170, 75, { p: 3.2, seed: 13 }), C.blue, { seed: 13 });
    clay(B(1010, 1190, 70, 36, { p: 2.6, seed: 14 }), C.white, { seed: 14 });
    // floor + rug
    const fg = ctx.createLinearGradient(0, 1450, 0, H);
    fg.addColorStop(0, '#2A3A70'); fg.addColorStop(1, '#16224C');
    ctx.fillStyle = fg; ctx.fillRect(0, 1440, W, H - 1440);
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = texPat; ctx.fillRect(0, 1440, W, H - 1440); ctx.restore();
    clay(B(540, 1450, 560, 22, { p: 6, seed: 15, lump: 0.004 }), C.navy, { seed: 15, sb: 8 }); // baseboard
    clay(B(540, 1760, 430, 95, { seed: 16, lump: 0.015 }), C.amber, { seed: 16, sa: 0.4 });
    clay(B(540, 1760, 360, 70, { seed: 17, lump: 0.015 }), '#F5C46E', { shadow: false, seed: 17 });
    clock(t);
  }

  function stickies(t) {
    const notes = [[600, 640, -0.08, 'deadline!'], [690, 760, 0.07, 'kuis'], [585, 800, 0.05, 'revisi']];
    notes.forEach(([x, y, r, label], k) => {
      if (t < 4 + k * 3 && k > 0) return;
      const flap = t > 18 ? Math.sin(F * 1.7 + k) * 0.03 : 0;
      clay(B(x, y, 58, 52, { p: 5, rot: r + flap, seed: 30 + k, lump: 0.015 }), k === 0 ? C.amber : k === 1 ? '#FFFFFF' : '#F5C46E', { seed: 30 + k, sb: 6, sy: 5 });
      ctx.save(); ctx.translate(x, y); ctx.rotate(r + flap); ctx.font = `600 ${label.length > 6 ? 21 : 26}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.navy; ctx.fillText(label, 0, 0); ctx.restore();
    });
  }

  function clock(t) {
    const tq = q(t), rev = TL.clockRev(tq);
    const shake = tq > 15 && tq < 31 ? Math.min(1, (tq - 15) / 8) : 0;
    const cx = 850 + (rnd(F * 1.3) - 0.5) * 8 * shake, cy = 650 + (rnd(F * 2.1) - 0.5) * 8 * shake;
    clay(B(cx, cy, 112, 112, { seed: 40 }), C.blue, { seed: 40 });
    clay(B(cx, cy, 90, 90, { seed: 41 }), C.white, { shadow: false, seed: 41, hi: 0.1 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; clay(B(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, 8, 8, { seed: 42 + k }), C.navy, { seed: k, sb: 3, sy: 2, sx: 2 }); }
    const am = rev * TAU - Math.PI / 2, ah = rev / 12 * TAU - Math.PI / 3;
    clay(Cap(cx, cy, cx + Math.cos(ah) * 45, cy + Math.sin(ah) * 45, 9, 50), C.navy, { sb: 4, sy: 3, sx: 3 });
    clay(Cap(cx, cy, cx + Math.cos(am) * 72, cy + Math.sin(am) * 72, 6, 51), C.navy, { sb: 4, sy: 3, sx: 3 });
    clay(B(cx, cy, 13, 13, { seed: 52 }), C.amber, { seed: 52, sb: 3, sy: 2 });
    if (shake > 0.3 && F % 2 === 0) { // motion lines pressed around a frantic clock
      ctx.save(); ctx.strokeStyle = 'rgba(20,34,79,0.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.arc(cx, cy, 135, a - 0.15 + Math.PI * (F % 4 < 2 ? 0 : 1), a + 0.15 + Math.PI * (F % 4 < 2 ? 0 : 1)); ctx.stroke(); }
      ctx.restore();
    }
  }

  function desk() {
    // legs
    clay(Cap(150, 1330, 150, 1650, 26, 60), C.woodLo, { seed: 60 });
    clay(Cap(930, 1330, 930, 1650, 26, 61), C.woodLo, { seed: 61 });
    clay(B(540, 1420, 400, 100, { p: 7, seed: 62, lump: 0.006 }), C.woodLo, { seed: 62 });
    clay(B(540, 1415, 120, 60, { p: 6, seed: 63, lump: 0.01 }), C.wood, { seed: 63, sb: 6 });   // drawer
    clay(B(540, 1418, 18, 14, { seed: 64 }), C.navy, { seed: 64, sb: 4, sy: 3 });
    clay(B(540, DESK_Y + 12, 480, 36, { p: 7, seed: 65, lump: 0.005 }), C.wood, { seed: 65, ly: 0.1 });
  }

  // =====================================================================
  // STUDENT
  function student(t, o) {
    const tq = q(t);
    const s = o.stress;
    const pop = o.pop ?? 1;
    const cx = 540;
    ctx.save();
    ctx.translate(cx, 1300); ctx.scale(pop, pop); ctx.translate(-cx, -1300);
    // body (hoodie)
    clay(B(cx, 1210, 160, 135, { p: 2.4, seed: 70 }), C.blue, { seed: 70 });
    clay(Cap(cx - 30, 1110, cx - 36, 1170, 6, 71), C.white, { sb: 4, sy: 3 });
    clay(Cap(cx + 30, 1110, cx + 36, 1170, 6, 72), C.white, { sb: 4, sy: 3 });
    // head (melts downward with stress)
    const drop = 34 * s, hy = 990 + drop;
    const melt = (x, y) => {
      if (y > 0) { const k = y / 112; return [x * (1 + 0.22 * s * k), y * (1 + 0.6 * s)]; }
      return [x * (1 - 0.06 * s), y * (1 - 0.12 * s)];
    };
    clay(B(cx - 116, hy + 6, 22, 30, { seed: 73 }), C.skin, { seed: 73, sb: 8 });
    clay(B(cx + 116, hy + 6, 22, 30, { seed: 74 }), C.skin, { seed: 74, sb: 8 });
    clay(B(cx, hy, 118, 112, { seed: 75, warp: melt }), C.skin, { seed: 75 });
    // jowls hanging when stressed
    if (s > 0.6) {
      const j = (s - 0.6) / 0.4;
      clay(B(cx - 70, hy + 105 + 30 * j, 36 + 10 * j, 30 + 14 * j, { seed: 76 }), C.skin, { seed: 76, sb: 6 });
      clay(B(cx + 70, hy + 105 + 30 * j, 36 + 10 * j, 30 + 14 * j, { seed: 77 }), C.skin, { seed: 77, sb: 6 });
    }
    // hair
    clay(B(cx, hy - 82 + s * 10, 128, 62, { seed: 78, warp: (x, y) => [x, y > 0 ? y * 0.5 : y] }), C.navy, { seed: 78 });
    for (let k = 0; k < 4; k++) clay(B(cx - 70 + k * 46, hy - 58 + s * 12 + (k % 2) * 6, 30, 20, { seed: 79 + k, rot: 0.4 - k * 0.25 }), C.navy, { seed: 79 + k, sb: 6, sy: 4 });
    // cheeks
    ctx.save(); ctx.globalAlpha = 0.5 - 0.3 * s;
    clay(B(cx - 70, hy + 45 + 40 * s, 22, 14, { seed: 83 }), C.amber, { shadow: false, seed: 83 });
    clay(B(cx + 70, hy + 45 + 40 * s, 22, 14, { seed: 84 }), C.amber, { shadow: false, seed: 84 });
    ctx.restore();
    // eyes
    const eyeY = hy - 2 + 30 * s, blink = o.blink ? 1 : 0, shock = o.shock ? 1 : 0;
    for (const side of [-1, 1]) {
      const ex = cx + side * (44 + 4 * s), sag = side * 0.35 * s;
      const ery = 27 * (1 + 0.25 * shock) * (blink ? 0.12 : 1);
      clay(B(ex, eyeY, 22 * (1 + 0.2 * shock), ery, { seed: 85 + side, rot: sag }), '#FFFFFF', { seed: 85, sb: 5, sy: 4, sx: 2, hi: 0.1 });
      if (!blink) {
        const lx = o.look ? o.look[0] : 0, ly = o.look ? o.look[1] : 0;
        clay(B(ex + lx + side * 2 * s, eyeY + 6 + ly + 6 * s, 10 * (1 - 0.3 * shock), 11 * (1 - 0.3 * shock), { seed: 87 + side }), C.navy, { shadow: false, seed: 87 });
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(ex + lx - 3, eyeY + 2 + ly + 6 * s, 3, 0, TAU); ctx.fill(); ctx.restore();
        // drooping eyelid
        const lid = Math.max(0, s - 0.25) / 0.75;
        if (lid > 0 && !shock) {
          ctx.save(); blob(ex, eyeY, 22, ery, { seed: 85 + side, rot: sag }); ctx.clip();
          clay(B(ex, eyeY - 28 + 26 * lid, 30, 26, { seed: 89 + side, rot: sag }), C.skin, { shadow: false, seed: 89 });
          ctx.restore();
        }
      }
      // brows
      const by = eyeY - 42 - 6 * shock;
      const inner = side * (o.happy ? 6 : -10 * s);
      groove(() => { ctx.beginPath(); ctx.moveTo(ex - side * 22, by + inner); ctx.lineTo(ex + side * 18, by - inner + 4 * s); }, 9);
    }
    // mouth
    const my = hy + 62 + 52 * s;
    if (shock) clay(B(cx, my, 20, 26, { seed: 92 }), '#3A1A26', { shadow: false, seed: 92, tex: 0.4 });
    else if (o.happy) {
      clay(B(cx, my - 4, 44, 26, { seed: 93, warp: (x, y) => [x, y < 0 ? y * 0.15 : y] }), '#3A1A26', { shadow: false, seed: 93, tex: 0.4 });
      clay(B(cx, my + 6, 20, 9, { seed: 94 }), '#E26D6D', { shadow: false, seed: 94, tex: 0.3 });
    } else {
      const k = s;
      groove(() => {
        ctx.beginPath();
        if (k < 0.3) { ctx.moveTo(cx - 32, my - 6); ctx.quadraticCurveTo(cx, my + 16 - 40 * k, cx + 32, my - 6); }
        else { // wobbly frown
          ctx.moveTo(cx - 36, my + 10);
          for (let i = 1; i <= 8; i++) { const x = cx - 36 + i * 9; ctx.lineTo(x, my + 10 - 22 * Math.sin(i / 8 * Math.PI) * k + (i % 2 ? 4 : -4) * k); }
        }
      }, 8);
    }
    // sweat drops
    if (s >= 0.5) {
      const ph = (F % 6) / 6;
      clay(B(cx + 104, hy - 40 + ph * 70, 11, 16, { seed: 95 }), C.sky, { seed: 95, sb: 4, sy: 3, hi: 0.4 });
      if (s > 0.8) clay(B(cx - 108, hy - 20 + ((F + 3) % 6) / 6 * 70, 9, 13, { seed: 96 }), C.sky, { seed: 96, sb: 4, sy: 3, hi: 0.4 });
    }
    ctx.restore();
  }
  // arms are drawn after the desk so the hands rest on the desktop
  function studentArms(t, o) {
    const tq = q(t), cx = 540;
    if (o.cheer) {
      for (const side of [-1, 1]) {
        clay(Cap(cx + side * 120, 1150, cx + side * 210, 960, 34, 100 + side), C.blue, { seed: 100 });
        clay(B(cx + side * 214, 940, 30, 30, { seed: 102 + side }), C.skin, { seed: 102 });
      }
      return;
    }
    const writing = o.writing;
    const wx = writing ? Math.round(Math.sin(tq * 9) * 2) * 10 : 0;
    clay(Cap(cx - 130, 1150, cx - 150, 1272, 34, 104), C.blue, { seed: 104 });
    clay(B(cx - 150, 1280, 34, 24, { seed: 105 }), C.skin, { seed: 105 });
    clay(Cap(cx + 130, 1150, cx + 110 + wx, 1268, 34, 106), C.blue, { seed: 106 });
    clay(B(cx + 112 + wx, 1276, 32, 24, { seed: 107 }), C.skin, { seed: 107 });
    // pencil
    clay(Cap(cx + 128 + wx, 1220, cx + 96 + wx, 1290, 9, 108), C.amber, { seed: 108, sb: 5, sy: 4 });
    clay(B(cx + 95 + wx, 1294, 6, 8, { seed: 109 }), C.navy, { shadow: false, seed: 109 });
  }
  function notebook(t) {
    clay(B(540, 1296, 120, 14, { p: 6, seed: 110, lump: 0.01 }), C.white, { seed: 110, sb: 6, sy: 4 });
    ctx.save(); ctx.strokeStyle = 'rgba(24,74,161,0.5)'; ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(450, 1290 + k * 4); ctx.lineTo(450 + Math.min(170, (q(t) - 4) * 9 % 170 + k * 20), 1290 + k * 4); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- lump stages (hook) ----------
  function lump(t) {
    const tq = q(t);
    if (tq < TL.HOOK.pinch) {
      const sq = tq < 0.09 ? 1 : tq < 0.17 ? 0.6 : 0.4;   // impact squash settling
      clay(B(540, 1235 + 8 * sq, 165 + 24 * sq, 70 - 12 * sq, { seed: 120, lump: 0.06 }), C.blue, { seed: 120 });
    } else {
      const k = tq < TL.HOOK.pinch + 0.17 ? 0.7 : 1;      // stretched upward by the pinch
      clay(B(540, 1180 - 20 * k, 130, 120 + 40 * k, { seed: 121, lump: 0.05, warp: (x, y) => [y < 0 ? x * (0.75 + 0.25 * (1 + y / 200)) : x, y] }), C.blue, { seed: 121 });
      clay(B(540, 1020 - 40 * k, 70, 56, { seed: 122, lump: 0.08 }), C.blue, { seed: 122, sb: 6 });
    }
  }

  // ---------- artist's hand ----------
  function hand(x, y, pose, o = {}) {
    // arm comes from the top right
    const wx = x + 70, wy = y - 210;
    clay(Cap(wx + 30, wy - 30, wx + 330, wy - 900, 92, 130), C.navy, { seed: 130, sa: 0.35, sb: 30, sy: 24, sx: 14 });
    clay(B(wx + 22, wy - 20, 96, 46, { rot: -1.05, seed: 131 }), C.white, { seed: 131, sb: 10 }); // cuff
    const fingers = [];
    const fx = [x - 52, x - 16, x + 22, x + 58];
    const full = pose === 'flat' ? [1, 1, 1, 1] : pose === 'poke' ? [0.35, 1, 0.35, 0.3] : pose === 'pinch' ? [0.35, 0.95, 0.4, 0.35] : [0.3, 0.3, 0.3, 0.3];
    fx.forEach((fxx, i) => {
      const len = 150 * full[i];
      const tx = pose === 'pinch' && i === 1 ? x - 6 : pose === 'poke' && i === 1 ? x : fxx;
      fingers.push([fxx + 10, wy + 60, tx, wy + 60 + len, 25 - (i === 3 ? 4 : 0)]);
    });
    clay(B(x + 12, wy + 40, 100, 95, { seed: 132, p: 2.4 }), C.skinArt, { seed: 132, sa: 0.3, sb: 22, sy: 16 });
    fingers.forEach(([ax, ay, bx, by, r], i) => clay(Cap(ax, ay, bx, by, r, 133 + i), C.skinArt, { seed: 133 + i, sb: 12, sy: 10 }));
    // thumb
    const th = pose === 'pinch' ? [x - 40, wy + 70, x - 4, y + 18] : [x - 82, wy + 50, x - 112, wy + 140];
    clay(Cap(th[0], th[1], th[2], th[3], 27, 140), C.skinArt, { seed: 140, sb: 12, sy: 10 });
    // nails
    fingers.forEach(([ax, ay, bx, by], i) => { if (full[i] > 0.9) clay(B(bx, by - 12, 12, 9, { seed: 141 + i }), '#F3D2BC', { shadow: false, seed: i, tex: 0.4 }); });
    if (o.stamp) {
      clay(B(x + 10, wy + 520, 262, 250, { p: 6, seed: 151, lump: 0.01 }), C.navy, { seed: 151, sb: 30, sy: 24 });
      clay(B(x + 10, wy + 520, 225, 212, { p: 6, seed: 152, lump: 0.01 }), C.blue, { seed: 152, shadow: false, hi: 0.15 });
      clay(Cap(x + 10, wy + 110, x + 10, wy + 330, 44, 150), C.amber, { seed: 150, sb: 16 });
      clay(B(x + 10, wy + 340, 90, 30, { seed: 153 }), C.amber, { seed: 153, sb: 10 });
    }
  }
  function hookHand(t) {
    const tq = q(t), H0 = TL.HOOK;
    // [time, x, y(fingertips), pose]
    let k;
    if (tq < H0.slap + 0.33) k = [540, 1172, 'flat'];
    else if (tq < 0.9) k = [540, lerp(1172, 700, ease(P(tq, 0.33, 0.9))), 'flat'];
    else if (tq < 1.0) return;
    else if (tq < H0.pinch) k = [560, lerp(600, 1000, P(tq, 1.0, H0.pinch)), 'pinch'];
    else if (tq < H0.pinch + 0.42) k = [560, lerp(1000, 900, P(tq, H0.pinch, H0.pinch + 0.42)), 'pinch'];
    else if (tq < 2.0) k = [560, lerp(900, 380, P(tq, H0.pinch + 0.42, 2.0)), 'pinch'];
    else if (tq < 2.1) return;
    else if (tq < H0.poke) k = [600, lerp(650, 960, P(tq, 2.1, H0.poke)), 'poke'];
    else if (tq < H0.poke + 0.25) k = [600, 960, 'poke'];
    else if (tq < 3.0) k = [600, lerp(960, 300, ease(P(tq, H0.poke + 0.25, 3.0))), 'poke'];
    else return;
    hand(k[0], k[1], k[2]);
  }

  // ---------- papers ----------
  function sheet(x, y, rot, seed) {
    clay(B(x, y, 92, 9, { p: 6, rot, seed, lump: 0.02 }), C.paper, { seed, sb: 5, sy: 4, sx: 3, edge: 5, ea: 0.22, hi: 0.08 });
  }
  function stacks(t) {
    const tq = q(t), MT = TL.MINTASK;
    const landed = TL.sheets.filter(s => tq >= s.land);
    const total = landed.length;
    // cleanup: each burst removes a quarter of the pile (from the top)
    let removed = 0;
    MT.bursts.forEach(b => { if (tq >= b) removed += Math.ceil(TL.sheets.length / 4); });
    const keep = Math.max(0, total - removed);
    const A = [], Bs = [];
    landed.forEach((s, i) => { if (i < keep) (s.stack === 'A' ? A : Bs).push(s); });
    const sway = tq > 18 && tq < 28 ? Math.min(1, (tq - 18) / 5) : 0;
    const swing = Math.sin(F * 0.9) * sway;
    Bs.forEach((s, j) => sheet(150 + (rnd(s.i) - 0.5) * 14 + swing * j * 0.8, DESK_Y - 22 - j * 17, (rnd(s.i + 5) - 0.5) * 0.08, 200 + s.i));
    A.forEach((s, j) => sheet(275 + (rnd(s.i) - 0.5) * 18 + swing * j * 1.3, DESK_Y - 12 - j * 17, (rnd(s.i + 5) - 0.5) * 0.08 + swing * 0.004 * j, 200 + s.i));
    // falling sheets
    for (const s of TL.sheets) {
      if (tq < s.t0 || tq >= s.land) continue;
      const p = (tq - s.t0) / (s.land - s.t0);
      const nA = TL.sheets.filter(o => o.stack === s.stack && o.land <= s.t0).length;
      const tx = s.stack === 'A' ? 275 : 150, ty = DESK_Y - (s.stack === 'A' ? 12 : 22) - nA * 17;
      sheet(tx + (1 - p) * 120, lerp(-60, ty, p * p), (1 - p) * 0.9, 200 + s.i);
    }
    // flying to the folders during cleanup
    MT.bursts.forEach((b, k) => {
      if (tq < b || tq >= b + 0.34) return;
      const p = (tq - b) / 0.34;
      for (let j = 0; j < 5; j++) {
        const sx = 270 - j * 10, sy = DESK_Y - 200 - j * 60 + k * 40;
        const ex = 320, ey = DESK_Y - 20 - k * 22;
        sheet(lerp(sx, ex, p), lerp(sy, ey, p) - Math.sin(p * Math.PI) * 140, (1 - p) * (j % 2 ? 1 : -1), 400 + k * 5 + j);
      }
    });
  }
  function folders(t) {
    const tq = q(t);
    const cols = [C.blue, C.amber, C.navy, C.white];
    TL.MINTASK.bursts.forEach((b, k) => {
      if (tq < b + 0.33) return;
      const pop = tq < b + 0.42 ? 1.15 : 1;
      const y = DESK_Y - 16 - k * 24;
      ctx.save(); ctx.translate(320, y); ctx.scale(pop, pop); ctx.translate(-320, -y);
      clay(B(320, y, 110, 13, { p: 7, seed: 300 + k, lump: 0.008 }), cols[k], { seed: 300 + k, sb: 6, sy: 5 });
      clay(B(240, y - 12, 26, 6, { p: 5, seed: 310 + k }), cols[k], { seed: 310 + k, shadow: false });
      clay(B(350, y, 34, 6, { p: 5, seed: 320 + k }), k === 3 ? C.blue : C.white, { seed: 320 + k, shadow: false, tex: 0.4 });
      ctx.restore();
    });
  }

  // ---------- coffee ----------
  function coffee(t) {
    const tq = q(t), CF = TL.COFFEE, MT = TL.MINTASK;
    const up = tq < CF.knock || tq >= MT.mugUp;
    // puddle
    let pr = 0;
    if (tq >= CF.spill) pr = Math.min(1, 0.25 + Math.floor((tq - CF.spill) / ((CF.full - CF.spill) / 6)) / 6 * 0.75);
    MT.wipe.forEach((w, k) => { if (tq >= w) pr = Math.min(pr, [0.6, 0.3, 0][k]); });
    if (pr > 0) clay(B(735 - 60 * pr, DESK_Y - 4, 40 + 170 * pr, 10 + 12 * pr, { seed: 500, lump: 0.12 }), C.coffee, { shadow: false, seed: 500, hi: 0.35, lo: 0.2 });
    // splash drops
    if (tq >= CF.spill && tq < CF.spill + 0.42) {
      const p = (tq - CF.spill) / 0.42;
      for (let k = 0; k < 4; k++) clay(B(760 - k * 40 - p * 60, DESK_Y - 40 - Math.sin(p * Math.PI) * (80 + k * 25), 10, 9, { seed: 510 + k }), C.coffee, { seed: 510 + k, sb: 4, sy: 3 });
    }
    // mug
    const pop = tq >= MT.mugUp && tq < MT.mugUp + 0.1 ? 1.15 : 1;
    let rot = 0, mx = 790, my = DESK_Y - 46;
    if (!up) {
      const k = tq - CF.knock;
      rot = k < 0.09 ? 0.35 : k < 0.17 ? 0.95 : 1.57;
      mx = 790 + (k < 0.17 ? 10 : 20); my = DESK_Y - (k < 0.17 ? 44 : 34);
    }
    ctx.save(); ctx.translate(mx, my + 40); ctx.rotate(rot); ctx.scale(pop, pop); ctx.translate(-mx, -(my + 40));
    clay(Cap(mx + 46, my - 18, mx + 58, my + 14, 13, 520), C.white, { seed: 520, sb: 6 });
    clay(B(mx, my, 46, 50, { p: 3.4, seed: 521, lump: 0.02 }), C.white, { seed: 521 });
    clay(B(mx, my + 8, 46, 9, { p: 5, seed: 522, lump: 0.01 }), C.blue, { seed: 522, shadow: false });
    if (up) clay(B(mx, my - 44, 38, 9, { seed: 523 }), C.coffee, { shadow: false, seed: 523, hi: 0.3 });
    ctx.restore();
    // steam (only while calm)
    if (up && (tq < 9 || tq > 32)) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) { const o = (F + k * 3) % 6; ctx.beginPath(); ctx.moveTo(780 + k * 20, DESK_Y - 110 - o * 6); ctx.bezierCurveTo(800 + k * 20, DESK_Y - 140 - o * 6, 760 + k * 20, DESK_Y - 160 - o * 6, 784 + k * 20, DESK_Y - 190 - o * 6); ctx.stroke(); }
      ctx.restore();
    }
  }
  function lamp() {
    clay(B(990, DESK_Y - 10, 46, 14, { seed: 530 }), C.navy, { seed: 530, sb: 6 });
    clay(Cap(990, DESK_Y - 14, 1000, DESK_Y - 130, 9, 531), C.navy, { seed: 531, sb: 6 });
    clay(B(985, DESK_Y - 150, 70, 46, { seed: 532, warp: (x, y) => [y > 0 ? x * 1.2 : x * 0.75, y] }), C.amber, { seed: 532 });
  }

  // ---------- mintask ----------
  function mintask(t) {
    const tq = q(t), MT = TL.MINTASK;
    if (tq < MT.hops[0]) return;
    // hop in from the right
    let x = 900, jump = 0;
    MT.hops.forEach((h, k) => {
      const x0 = 1260 - k * 72, x1 = x0 - 72;
      if (tq >= h && tq < h + 0.33) { const p = (tq - h) / 0.33; x = lerp(x0, x1, p); jump = Math.sin(p * Math.PI) * 50; }
      else if (tq >= h + 0.33) x = x1;
    });
    const y = -jump;
    const tWave = tq >= MT.wave && tq < MT.bursts[0];
    const tPoint = tq >= MT.bursts[0] && tq < MT.wipe[0];
    const tWipe = tq >= MT.wipe[0] && tq < MT.mugUp + 0.2;
    const tThumb = tq >= MT.thumbs;
    // legs + shoes
    clay(Cap(x - 34, 1560 + y, x - 38, 1690 + y, 24, 600), C.navy, { seed: 600 });
    clay(Cap(x + 34, 1560 + y, x + 38, 1690 + y, 24, 601), C.navy, { seed: 601 });
    clay(B(x - 48, 1700 + y, 40, 20, { seed: 602 }), C.white, { seed: 602 });
    clay(B(x + 48, 1700 + y, 40, 20, { seed: 603 }), C.white, { seed: 603 });
    // body + apron
    clay(B(x, 1440 + y, 100, 140, { p: 2.3, seed: 604 }), C.white, { seed: 604 });
    clay(B(x, 1475 + y, 78, 110, { p: 3, seed: 605 }), C.blue, { seed: 605, sb: 8 });
    clay(Cap(x - 70, 1330 + y, x - 40, 1380 + y, 8, 606), C.blue, { sb: 4 });
    clay(Cap(x + 70, 1330 + y, x + 40, 1380 + y, 8, 607), C.blue, { sb: 4 });
    clay(B(x, 1520 + y, 40, 26, { p: 4, seed: 608 }), shade(C.blue, -0.12), { seed: 608, shadow: false });     // pocket
    groove(() => { ctx.beginPath(); ctx.moveTo(x - 18, 1440 + y); ctx.lineTo(x - 5, 1455 + y); ctx.lineTo(x + 20, 1425 + y); }, 9); // check emblem
    ctx.save(); ctx.strokeStyle = C.white; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - 18, 1438 + y); ctx.lineTo(x - 5, 1453 + y); ctx.lineTo(x + 20, 1423 + y); ctx.stroke(); ctx.restore();
    // arms
    const shL = [x - 92, 1360 + y], shR = [x + 92, 1360 + y];
    let hl = [x - 120, 1500 + y], hr = [x + 120, 1500 + y];
    if (tWave) hr = [x + 150, 1210 + y + (F % 4 < 2 ? 0 : 20)];
    if (tPoint) { const k = MT.bursts.findIndex((b, i) => tq >= b && (i === 3 || tq < MT.bursts[i + 1])); hl = [x - 230 - (k % 2) * 30, 1250 + y - (k % 2) * 40]; }
    if (tWipe) hl = [x - 210 + ((F % 4) < 2 ? -40 : 30), DESK_Y - 10];
    if (tThumb) hr = [x + 140, 1250 + y];
    clay(Cap(shL[0], shL[1], hl[0], hl[1], 26, 610), C.white, { seed: 610 });
    clay(Cap(shR[0], shR[1], hr[0], hr[1], 26, 611), C.white, { seed: 611 });
    clay(B(hl[0], hl[1], 28, 28, { seed: 612 }), C.skin, { seed: 612 });
    clay(B(hr[0], hr[1], 28, 28, { seed: 613 }), C.skin, { seed: 613 });
    if (tWipe) clay(B(hl[0] - 10, hl[1] + 8, 46, 16, { seed: 614, lump: 0.1 }), C.sky, { seed: 614, sb: 4 });
    if (tThumb) clay(Cap(hr[0], hr[1] - 10, hr[0] + 4, hr[1] - 52, 12, 615), C.skin, { seed: 615, sb: 5 });
    // head
    const hy = 1215 + y;
    clay(B(x, hy, 86, 82, { seed: 620 }), C.skin, { seed: 620 });
    clay(B(x, hy - 60, 92, 44, { seed: 621, warp: (xx, yy) => [xx, yy > 0 ? yy * 0.5 : yy] }), C.navy, { seed: 621 });
    clay(B(x + 4, hy - 112, 34, 30, { seed: 622 }), C.navy, { seed: 622, sb: 6 });                      // bun
    clay(B(x - 30, hy - 74, 40, 12, { rot: -0.2, seed: 623 }), C.blue, { seed: 623, sb: 4 });           // headband
    for (const side of [-1, 1]) {
      clay(B(x + side * 30, hy + 2, 12, 15, { seed: 624 + side }), C.navy, { seed: 624, sb: 3, sy: 2, sx: 1 });
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + side * 30 - 3, hy - 3, 3, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.55; clay(B(x + side * 52, hy + 30, 16, 10, { seed: 626 + side }), C.amber, { shadow: false, seed: 626 }); ctx.restore();
    }
    clay(B(x, hy + 34, 30, 17, { seed: 628, warp: (xx, yy) => [xx, yy < 0 ? yy * 0.15 : yy] }), '#3A1A26', { shadow: false, seed: 628, tex: 0.4 });
  }

  function sparkles(t, t0, pts, col = C.amber) {
    const tq = q(t);
    if (tq < t0 || tq > t0 + 1.2) return;
    pts.forEach(([x, y], k) => {
      const p = (tq - t0 - k * 0.08);
      if (p < 0 || p > 1) return;
      const s = p < 0.17 ? 1.3 : p > 0.8 ? 0.6 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      clay(() => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 24, a = i / 10 * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); return { x: -24, y: -24, w: 48, h: 48 }; }, col, { seed: 700 + k, sb: 6, sy: 4 });
      ctx.restore();
    });
  }

  // =====================================================================
  // FINALE: stamp + blue + tagline
  function finale(t) {
    const tq = q(t), EN = TL.END;
    // slab on a navy table
    ctx.fillStyle = '#16224C'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = texPat; ctx.fillRect(0, 0, W, H); ctx.restore();
    const plop = tq < EN.cut + 0.09 ? 1.08 : 1;
    const press = tq >= EN.press && tq < EN.press + 0.25 ? 1 : 0;
    clay(B(540, 960, (470 + 14 * press) * plop, (560 - 10 * press) * plop, { p: 4.5, seed: 800, lump: 0.025 }), '#EEF1F7', { seed: 800, sa: 0.5, sb: 40, sy: 26, hi: 0.12 });
    for (let k = 0; k < 3; k++) clay(B(180 + k * 340, 1560 - (k % 2) * 80, 18, 14, { seed: 810 + k }), '#EEF1F7', { seed: 810 + k, sb: 6 });  // crumbs
    // imprint revealed under the stamp
    if (tq >= EN.lift) clayLogo(540, 900, 470, 'imprint');
    // hand with stamp
    let hy = null;
    const HP = 590; // stamp block centred on the logo spot
    if (tq < EN.press) hy = lerp(-900, HP, ease(P(tq, EN.cut + 0.2, EN.press)));
    else if (tq < EN.lift) hy = HP + (tq < EN.press + 0.25 ? 10 : 0);
    else if (tq < EN.lift + 0.6) hy = lerp(HP, -1100, ease(P(tq, EN.lift, EN.lift + 0.6)));
    if (hy != null) hand(530, hy, 'stamp', { stamp: true });

    // blue clay sheet rolls over the screen
    if (tq >= EN.blue[0]) {
      const k = EN.blue.findIndex((b, i) => i === EN.blue.length - 1 || tq < EN.blue[i + 1]);
      const cover = [0.3, 0.6, 0.85, 1.2][Math.max(0, k)];
      if (cover < 1.1) {
        clay(B(540, H + 200 - cover * 1400, 900, 400 + cover * 1300, { seed: 820, lump: 0.05 }), C.blue, { seed: 820, sa: 0.45, sb: 30, sy: -16 });
      } else {
        ctx.fillStyle = C.blue; ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(400, 600, 0, 400, 600, 1500);
        g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,30,0.28)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = texPat; ctx.fillRect(0, 0, W, H); ctx.restore();
        const lp = tq < EN.logo ? 0 : tq < EN.logo + 0.09 ? 1.15 : 1;
        if (lp > 0) { ctx.save(); ctx.translate(540, 860); ctx.scale(lp, lp); clayLogo(0, 0, 440, 'raised'); ctx.restore(); }
        const p1 = tq < EN.tag1 ? 0 : tq < EN.tag1 + 0.09 ? 1.2 : 1;
        const p2 = tq < EN.tag2 ? 0 : tq < EN.tag2 + 0.09 ? 1.2 : 1;
        if (p1) clayText('ada task?', 540, 1250, 118, C.amber, { scale: p1, side: '#0E1A44' });
        if (p2) clayText('taskkora-in aja.', 540, 1395, 112, C.white, { scale: p2, side: '#0E1A44' });
        sparkles(t, EN.sparkle, [[200, 700], [880, 640], [930, 1120], [150, 1150]]);
      }
    }
  }

  // =====================================================================
  function render(t) {
    F = Math.floor(t * TL.FPS_STOP + 1e-6);
    const tq = q(t), H0 = TL.HOOK, MT = TL.MINTASK;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (tq < TL.END.cut) {
      room(t);
      const s = TL.stress(tq);
      const formed = tq >= H0.poke;
      if (formed) {
        const shock = tq >= TL.COFFEE.knock && tq < TL.COFFEE.spill + 0.7;
        const happy = tq >= MT.smile;
        const blink = (tq >= H0.blink && tq < H0.blink + 0.1) || (happy && F % 30 === 0);
        const look = shock ? [12, 2] : tq < 4 ? [0, 0] : tq >= MT.hops[0] && tq < MT.smile ? [10, -2] : [-8, 8];
        student(t, { stress: s, pop: tq < H0.poke + 0.09 ? 1.12 : 1, blink, shock, happy, look });
      } else lump(t);
      desk();
      lamp();
      stacks(t);
      folders(t);
      coffee(t);
      if (formed) {
        notebook(t);
        studentArms(t, { writing: tq > 4.3 && tq < 26 && !(tq >= TL.COFFEE.knock && tq < 14.5), cheer: tq >= MT.thumbs });
        if (tq >= H0.wave && tq < 3.9) { // little wave right after he's formed
          clay(Cap(660, 1150, 720, 1000 - (F % 2) * 20, 30, 160), C.blue, { seed: 160 });
          clay(B(724, 990 - (F % 2) * 20, 30, 30, { seed: 161 }), C.skin, { seed: 161 });
        }
      }
      mintask(t);
      sparkles(t, MT.smile, [[380, 900], [700, 880], [430, 760], [660, 740]]);
      if (tq < 3.2) hookHand(t);
      // hook text: on screen from frame 0, letters plop away on exit
      if (tq < H0.textOut + 0.34) {
        const out = tq >= H0.textOut ? Math.floor((tq - H0.textOut) * 12) : -1;
        const pop = i => (out < 0 ? 1 : out === 0 ? 1.15 : Math.max(0, 1 - (out / 3) - (i % 3) * 0.05));
        const enter = tq < 0.09 ? 1.08 : 1;
        clayText('tugas numpuk?', 540, 330, 132, C.blue, { pop, scale: enter, seed: 1 });
        clayText('ya dibentuk.', 540, 480, 132, C.amber, { pop, scale: enter, seed: 2 });
      }
    } else finale(t);

    // lighting: warm key, slight exposure flicker per pose, vignette, grain
    const flick = (rnd(F * 3.7) - 0.5) * 0.035;
    ctx.fillStyle = flick > 0 ? `rgba(255,236,200,${flick})` : `rgba(0,0,20,${-flick})`; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(5,8,30,0.42)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    ctx.translate((F * 37) % 256, (F * 59) % 256); ctx.fillStyle = GRAIN; ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();

    // watermark
    ctx.save(); ctx.globalAlpha = 0.3; ctx.font = `600 32px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.strokeStyle = C.navy; ctx.lineJoin = 'round'; ctx.strokeText('@taskkora__', W - 46, H - 58);
    ctx.fillStyle = '#FFFFFF'; ctx.fillText('@taskkora__', W - 46, H - 58); ctx.restore();
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
