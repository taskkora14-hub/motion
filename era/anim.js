/* "tugas kuliah: dulu vs sekarang." — cross-era montage, 40s, 1080x1920.
 * One student swipes through 1958 -> 1988 -> 1999 -> 2012 -> 2021 -> now; every era has its own
 * texture, colours, device and classic problem, then MinTask fixes them all. Swipe times are
 * mirrored in era/music.py so each musical style switches on the swipe. Pure function of time. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const main = document.getElementById('c');
  const mctx = main.getContext('2d');
  let ctx = mctx;                       // swapped to off-screen layers while an era renders

  const C = {
    blue: '#184AA1', blueL: '#2F6BD3', blueXL: '#9CC0FF', blueD: '#0F3274',
    navy: '#0B1A3D', navy2: '#060E24', white: '#FFFFFF', paper: '#F3F0E6', amber: '#FFB627', amberD: '#D98E00',
    skin: '#F1C49E', skinD: '#D9A07A', hair: '#1A1A24', line: '#14151F',
  };
  const F = (w, s, fam = 'PP') => `${w} ${s}px "${fam}", sans-serif`;

  // ---------- timeline ----------
  const SW = [0, 8.0, 12.5, 17.0, 22.0, 26.0, 34.0];   // swipe = music style change
  const SWIPE = 0.38;
  const ERA = ['e1958', 'e1988', 'e1999', 'e2012', 'e2021', 'now', 'brand'];
  // typewriter keystrokes in the hook (mirrored in music.py)
  const KEYS = (() => { const a = [], g = [0.11, 0.13, 0.1, 0.16, 0.12]; let t = 0, i = 0; while (t < 2.7) { a.push(t); t += g[i % 5]; i++; } return a; })();
  const KEYS2 = (() => { const a = [], g = [0.12, 0.15, 0.11, 0.18]; let t = 4.3, i = 0; while (t < 5.5) { a.push(t); t += g[i % 4]; i++; } t = 6.75; while (t < 7.6) { a.push(t); t += g[i % 4]; i++; } return a; })();

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const eraIndex = t => { let i = 0; for (let k = 0; k < SW.length; k++) if (t >= SW[k]) i = k; return i; };
  const countBefore = (arr, t) => { let n = 0; for (const k of arr) if (k <= t) n++; return n; };

  // ---------- assets / layers ----------
  const mark = new Image();
  const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  let LA, LB, small, grain = [];
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    ...['900 40px "PP"', '800 40px "PP"', '600 40px "PP"', '40px "TW"', '40px "NEON"', '40px "AW"', '40px "PX"'].map(f => document.fonts.load(f)),
  ]).then(() => document.fonts.ready).then(() => {
    LA = layer(); LB = layer(); small = document.createElement('canvas'); small.width = 270; small.height = 480;
    for (let k = 0; k < 4; k++) {
      const g = document.createElement('canvas'); g.width = 360; g.height = 640; const gc = g.getContext('2d');
      const im = gc.createImageData(360, 640);
      for (let i = 0; i < im.data.length; i += 4) { const v = rnd(i * 0.31 + k * 777) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      gc.putImageData(im, 0, 0); grain.push(g);
    }
  });

  // ---------- helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function fillRR(x, y, w, h, r, c) { rr(x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }
  function circle(x, y, r, c) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function ell(x, y, rx, ry, c, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function seg(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function poly(pts, c) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); }
  function outlined(path, fill, lw = 6) { path(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.lineJoin = 'round'; ctx.stroke(); }
  function limb(pts, c, w) {
    for (const [col, ww] of [[C.line, w + 12], [c, w]]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = col; ctx.lineWidth = ww; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
  }
  function text(s, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = o.font || F(o.weight || 900, size, o.fam || 'PP'); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.wordSpacing = Math.round(size * (o.ws ?? 0.12)) + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const w = ctx.measureText(s).width, max = o.maxW || 980;
    if (w > max) { ctx.translate(x, y); ctx.scale(max / w, max / w); ctx.translate(-x, -y); }
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 30; }
    if (o.stroke) { ctx.lineWidth = o.sw || Math.max(8, size * 0.14); ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(s, x + (o.sx || 0), y + (o.sy ?? Math.max(6, size * 0.08))); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
    ctx.restore();
  }
  function withScale(x, y, s, fn) { if (s <= 0.001) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y); fn(); ctx.restore(); }
  function tick(x, y, z, c, w) { ctx.beginPath(); ctx.moveTo(x - z * 0.5, y); ctx.lineTo(x - z * 0.12, y + z * 0.38); ctx.lineTo(x + z * 0.55, y - z * 0.4); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  function blueCheck(x, y, r, k = 1) { if (k <= 0) return; withScale(x, y, E.outBack(k), () => { circle(x, y, r, C.blue); ctx.lineWidth = r * 0.14; ctx.strokeStyle = C.white; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); tick(x, y, r * 1.05, C.white, r * 0.22); }); }

  // ---------- the student (local units: head centre 0,0, radius ~100) ----------
  function person(o, t) {
    if (o.top === 'hoodie') outlined(() => { ctx.beginPath(); ctx.ellipse(0, 175, 150, 60, 0, 0, TAU); }, o.c2);
    const torso = () => { ctx.beginPath(); ctx.moveTo(-178, 230); ctx.quadraticCurveTo(-168, 160, -92, 152); ctx.lineTo(92, 152); ctx.quadraticCurveTo(168, 160, 178, 230); ctx.lineTo(162, 620); ctx.lineTo(-162, 620); ctx.closePath(); };
    outlined(torso, o.c1);
    ctx.save(); torso(); ctx.clip(); topDetails(o, t); ctx.restore();
    torso(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    if (o.top === 'hoodie') { seg(-24, 170, -28, 300, '#EEE', 7); seg(24, 170, 28, 300, '#EEE', 7); }
    for (const arm of o.arms || []) { limb(arm.pts, arm.c || o.sleeve || o.c1, 72); const h = arm.pts[arm.pts.length - 1]; if (arm.hand !== false) { ctx.beginPath(); ctx.arc(h[0], h[1], 32, 0, TAU); ctx.fillStyle = C.skin; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke(); } }
    ctx.save(); ctx.translate(0, o.headDy || 0); ctx.rotate(o.headRot || 0);
    outlined(() => rr(-34, 80, 68, 90, 20), C.skinD);
    if (o.bowtie) { poly([[0, 158], [-36, 140], [-36, 176]], C.line); poly([[0, 158], [36, 140], [36, 176]], C.line); circle(0, 158, 9, '#333'); }
    if (o.headphones) { ctx.beginPath(); ctx.ellipse(0, 150, 120, 40, 0, 0, Math.PI); ctx.strokeStyle = o.headphones; ctx.lineWidth = 16; ctx.stroke(); ell(-118, 150, 26, 36, o.headphones); ell(118, 150, 26, 36, o.headphones); }
    if (o.hair === 'big') ell(0, -20, 150, 150, C.hair);
    outlined(() => { ctx.beginPath(); ctx.ellipse(-100, 12, 22, 30, 0, 0, TAU); }, C.skin);
    outlined(() => { ctx.beginPath(); ctx.ellipse(100, 12, 22, 30, 0, 0, TAU); }, C.skin);
    outlined(() => { ctx.beginPath(); ctx.ellipse(0, 0, 100, 118, 0, 0, TAU); }, C.skin);
    hair(o, t);
    face(o, t);
    if (o.glasses) { ctx.lineWidth = 7; ctx.strokeStyle = C.line; rr(-82, -6, 66, 50, 18); ctx.stroke(); rr(16, -6, 66, 50, 18); ctx.stroke(); seg(-16, 14, 16, 14, C.line, 6); }
    if (o.headband) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 101, 119, 0, 0, TAU); ctx.clip(); fillRR(-120, -78, 240, 30, 6, o.headband); ctx.restore(); }
    ctx.restore();
  }
  function topDetails(o) {
    switch (o.top) {
      case 'vest':
        ctx.fillStyle = '#F4F4F4'; ctx.fillRect(-180, 140, 360, 500);
        poly([[-110, 150], [0, 360], [110, 150], [170, 230], [160, 640], [-160, 640], [-170, 230]], o.c1);
        for (let y = 380; y < 620; y += 70) circle(0, y, 8, C.line);
        break;
      case 'denim':
        poly([[-70, 150], [70, 150], [60, 640], [-60, 640]], o.c2);
        text('rad', 0, 330, 54, '#FFE14D', { fam: 'AW', font: '54px "AW"', ws: 0 });
        seg(-70, 160, -60, 640, '#2B4F86', 10); seg(70, 160, 60, 640, '#2B4F86', 10);
        for (const s of [-1, 1]) fillRR(s > 0 ? 82 : -142, 260, 60, 50, 6, '#4C7FC4');
        break;
      case 'flannel':
        for (let x = -180; x < 180; x += 46) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, 140, 16, 500); }
        for (let y = 150; y < 640; y += 46) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-180, y, 360, 14); }
        poly([[-60, 150], [60, 150], [50, 640], [-50, 640]], '#ECECEC');
        break;
      case 'hoodie':
        fillRR(-110, 420, 220, 130, 30, o.c2);
        break;
      case 'cardigan':
        poly([[-70, 150], [70, 150], [60, 640], [-60, 640]], C.white);
        for (let y = 330; y < 620; y += 70) circle(80, y, 8, '#8A6E4B');
        break;
      case 'jacket':
        poly([[-70, 150], [70, 150], [60, 640], [-60, 640]], C.white);
        seg(-64, 160, -56, 640, C.amber, 8); seg(64, 160, 56, 640, C.amber, 8);
        circle(0, 340, 38, C.blue); tick(0, 340, 40, C.white, 8);
        break;
    }
  }
  function hair(o, t) {
    const k = o.hair;
    ctx.fillStyle = C.hair;
    if (k === 'big') { // 80s volume + curls
      for (let i = 0; i < 11; i++) { const a = Math.PI * (1.0 + i * 0.1); circle(Math.cos(a) * 112, -10 + Math.sin(a) * 120, 42, C.hair); }
      ctx.beginPath(); ctx.ellipse(0, -60, 104, 70, 0, Math.PI, 0); ctx.fill();
      return;
    }
    if (k === 'spiky') { // 90s gel spikes with frosted tips
      ctx.beginPath(); ctx.ellipse(0, -40, 104, 84, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 8; i++) { const x = -96 + i * 27; poly([[x - 18, -60], [x + 4, -170 - (i % 2) * 20], [x + 22, -60]], C.hair); poly([[x - 6, -130 - (i % 2) * 20], [x + 4, -170 - (i % 2) * 20], [x + 12, -130 - (i % 2) * 20]], '#E8C25A'); }
      return;
    }
    if (k === 'slick') { // 50s side part, shiny
      ctx.beginPath(); ctx.moveTo(-104, 0); ctx.quadraticCurveTo(-110, -120, -20, -136); ctx.quadraticCurveTo(100, -150, 108, -10);
      ctx.quadraticCurveTo(80, -80, 20, -86); ctx.lineTo(-40, -96); ctx.quadraticCurveTo(-80, -60, -104, 0); ctx.closePath(); ctx.fill();
      seg(-30, -120, 60, -116, 'rgba(255,255,255,0.35)', 8); seg(-40, -96, -46, -132, '#444', 4);
      return;
    }
    if (k === 'fringe') { // 2010s side-swept fringe
      ctx.beginPath(); ctx.moveTo(-108, 10); ctx.quadraticCurveTo(-118, -130, 0, -140); ctx.quadraticCurveTo(110, -136, 108, 0);
      ctx.quadraticCurveTo(70, -40, -30, -30); ctx.quadraticCurveTo(-80, -10, -108, 10); ctx.closePath(); ctx.fill();
      return;
    }
    // neat
    ctx.beginPath(); ctx.moveTo(-104, 10);
    ctx.quadraticCurveTo(-114, -126, -10, -138); ctx.quadraticCurveTo(112, -136, 106, 4);
    ctx.quadraticCurveTo(92, -62, 28, -72); ctx.quadraticCurveTo(-38, -92, -58, -44); ctx.quadraticCurveTo(-82, -28, -104, 10); ctx.closePath(); ctx.fill();
  }
  function face(o, t) {
    const m = o.mood, y = 20, ex = [-46, 46], ey = y - 8, px = o.pupilX || 0, py = o.pupilY || 0;
    const blinkOn = ((t + 0.3) % 2.9) < 0.1;
    const brow = (dy, rot) => { for (const [i, e] of ex.entries()) { ctx.save(); ctx.translate(e, ey - 44 + dy); ctx.rotate(rot * (i === 0 ? 1 : -1)); seg(-22, 0, 22, 0, C.hair, 10); ctx.restore(); } };
    if (o.bags) for (const e of ex) { ctx.beginPath(); ctx.ellipse(e, ey + 30, 28, 11, 0, 0.1, Math.PI - 0.1); ctx.strokeStyle = `rgba(90,60,120,${0.5 * o.bags})`; ctx.lineWidth = 7; ctx.stroke(); }
    if (m === 'shock' || m === 'panic') {
      for (const e of ex) { ell(e, ey, 26, 31, C.white); ctx.lineWidth = 5; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.ellipse(e, ey, 26, 31, 0, 0, TAU); ctx.stroke(); circle(e + px * 10, ey + py * 10, 7, C.line); }
      brow(-16, -0.28);
      if (m === 'shock') ell(0, y + 58, 20, 26, C.line);
      else { ctx.beginPath(); ctx.moveTo(-26, y + 56); for (let k = 0; k <= 8; k++) ctx.lineTo(-26 + k * 6.5, y + 56 + (k % 2 ? -6 : 6)); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.stroke(); }
    } else if (m === 'happy') {
      for (const e of ex) { ctx.beginPath(); ctx.arc(e, ey + 8, 18, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = C.line; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke(); }
      brow(-10, 0.1);
      circle(-70, y + 32, 17, 'rgba(255,130,100,0.35)'); circle(70, y + 32, 17, 'rgba(255,130,100,0.35)');
      ctx.beginPath(); ctx.moveTo(-42, y + 36); ctx.quadraticCurveTo(0, y + 96, 42, y + 36); ctx.closePath(); ctx.fillStyle = C.navy; ctx.fill();
      ctx.save(); ctx.clip(); fillRR(-40, y + 32, 80, 14, 4, C.white); circle(0, y + 80, 20, '#E8697A'); ctx.restore(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    } else {
      // focus / annoyed / bored / tired
      for (const e of ex) {
        if (blinkOn) { seg(e - 16, ey, e + 16, ey, C.line, 7); continue; }
        ell(e, ey, 13, 17, C.line); circle(e + 4 + px * 4, ey - 6 + py * 4, 5, C.white);
        if (m !== 'focus') { ctx.fillStyle = C.skin; ctx.fillRect(e - 20, ey - 26, 40, m === 'annoyed' ? 20 : 22); seg(e - 18, ey - 5, e + 18, ey - 5, C.line, 6); }
      }
      if (m === 'focus') brow(4, -0.12); else if (m === 'annoyed') brow(10, -0.35); else brow(-2, 0.05);
      if (m === 'annoyed') { ctx.beginPath(); ctx.moveTo(-24, y + 58); ctx.quadraticCurveTo(0, y + 46, 24, y + 60); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.stroke(); }
      else if (m === 'bored') seg(-18, y + 56, 18, y + 56, C.line, 7);
      else if (m === 'tired') { ctx.beginPath(); ctx.moveTo(-22, y + 58); ctx.quadraticCurveTo(-6, y + 50, 4, y + 58); ctx.quadraticCurveTo(14, y + 64, 24, y + 54); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, y + 36, 20, 0.3 * Math.PI, 0.7 * Math.PI); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.stroke(); }
    }
    if (o.sweat) for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.8 + k * 0.5) % 1), x = k ? 92 : -96, yy = -40 + ph * 90;
      ctx.globalAlpha = 1 - ph * 0.6; ctx.beginPath(); ctx.moveTo(x, yy - 18); ctx.quadraticCurveTo(x + 12, yy + 2, x, yy + 10); ctx.quadraticCurveTo(x - 12, yy + 2, x, yy - 18); ctx.fillStyle = '#9CC0FF'; ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  // place the student consistently in every era
  function student(o, t, s0) {
    const bob = Math.sin((t - s0) * 3) * 4;
    ctx.save(); ctx.translate(540, 960 + bob); ctx.scale(0.95, 0.95); person(o, t); ctx.restore();
  }

  // ---------- shared era furniture ----------
  function yearTag(year, label, t, s0, style) {
    const p = E.outBack(P(t, s0 + 0.12, s0 + 0.45));
    withScale(540, 300, p, () => {
      if (style === 'tw') text(year, 540, 340, 200, '#F2F2F2', { font: '200px "TW"', shadow: '#000', sy: 8, ws: 0 });
      else if (style === 'neon') text(year, 540, 340, 190, '#FF4FD8', { font: '190px "NEON"', glow: '#FF4FD8', blur: 40, ws: 0 });
      else if (style === 'px') text(year, 540, 330, 150, '#7CFF6B', { font: '150px "PX"', shadow: '#0B3A12', sy: 12, sx: 12, ws: 0 });
      else if (style === 'lofi') text(year, 540, 340, 190, '#FFF4E0', { weight: 900, shadow: 'rgba(120,70,40,0.6)', sy: 10, ws: 0 });
      else text(year, 540, 340, 180, C.navy, { weight: 900, shadow: 'rgba(11,26,61,0.15)', sy: 10, ws: 0 });
    });
    const q = E.outCubic(P(t, s0 + 0.35, s0 + 0.65));
    if (q > 0) {
      ctx.save(); ctx.globalAlpha = q; ctx.translate(0, (1 - q) * 20);
      const col = style === 'tw' ? '#111' : style === 'neon' ? '#1B0B33' : style === 'px' ? '#0B1F10' : style === 'lofi' ? '#5A3A2A' : C.navy;
      const fg = style === 'tw' ? '#F2F2F2' : style === 'neon' ? '#5CF2FF' : style === 'px' ? '#7CFF6B' : style === 'lofi' ? '#FFE3B8' : C.white;
      ctx.font = F(800, 46); const w = ctx.measureText(label).width + 70;
      fillRR(540 - w / 2, 386, w, 76, 38, col);
      text(label, 540, 438, 46, fg, { weight: 800 });
      ctx.restore();
    }
  }
  function callout(x, y, w, h, t, s0, delay, draw, o = {}) {
    const p = E.outBack(P(t, s0 + delay, s0 + delay + 0.35));
    if (p <= 0) return;
    const bob = Math.sin(t * 2.4) * 6;
    withScale(x, y + h / 2, p, () => {
      ctx.save(); ctx.translate(0, bob);
      if (o.shadow !== false) fillRR(x - w / 2 + 12, y + 14, w, h, o.r ?? 26, 'rgba(0,0,0,0.25)');
      fillRR(x - w / 2, y, w, h, o.r ?? 26, o.bg || C.white);
      if (o.border) { ctx.lineWidth = 6; ctx.strokeStyle = o.border; rr(x - w / 2, y, w, h, o.r ?? 26); ctx.stroke(); }
      ctx.save(); rr(x - w / 2, y, w, h, o.r ?? 26); ctx.clip(); draw(x - w / 2, y, w, h); ctx.restore();
      ctx.restore();
    });
  }
  function desk(top, front, edge) { ctx.fillStyle = front; ctx.fillRect(0, 1380, W, 540); ctx.fillStyle = top; ctx.fillRect(0, 1360, W, 40); ctx.fillStyle = edge; ctx.fillRect(0, 1396, W, 10); }

  // ======================= HOOK: typewriter close-up (0–4) =======================
  const TYPED = 'makalah sejarah: bab 1';
  function hookTypewriter(t) {
    ctx.fillStyle = '#1C1C1C'; ctx.fillRect(0, 0, W, H);
    // desk wood (mono)
    for (let i = 0; i < 24; i++) { ctx.fillStyle = `rgba(255,255,255,${0.02 + rnd(i) * 0.03})`; ctx.fillRect(0, 900 + i * 44, W, 4 + rnd(i + 2) * 8); }
    const n = countBefore(KEYS, t);
    const last = KEYS[n - 1] ?? -9, hit = t - last < 0.06;
    const shake = hit ? 4 : 0;
    ctx.save(); ctx.translate((rnd(n) - 0.5) * shake, 300 + (rnd(n + 1) - 0.5) * shake);
    // paper (rips out after the bell)
    const rip = P(t, 2.95, 3.3), fly = P(t, 3.3, 4.0);
    const carriage = -Math.min(n, TYPED.length) * 18 + (t > 2.8 ? E.outCubic(P(t, 2.8, 2.95)) * Math.min(n, TYPED.length) * 18 : 0);
    ctx.save();
    if (fly > 0) { ctx.translate(lerp(540, 980, E.inCubic(fly)), lerp(560, -300, E.inCubic(fly))); ctx.rotate(fly * 2.4); ctx.scale(1 - fly * 0.5, 1 - fly * 0.6); ctx.translate(-540, -560); }
    const py = 560 - E.inCubic(rip) * 420;
    ctx.translate(carriage, 0);
    fillRR(260, py - 200, 560, 700, 4, '#EDEDED');
    for (let l = 0; l < 3; l++) seg(300, py + 300 + l * 0, 300, py + 300, '#EDEDED', 1);
    // typed text: one character per keystroke
    ctx.font = '40px "TW"'; ctx.fillStyle = '#1A1A1A'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('tugas mata kuliah', 300, py - 130);
    ctx.fillText(TYPED.slice(0, Math.min(n, TYPED.length)), 300, py - 50);
    if (fly > 0) { ctx.globalAlpha = fly; ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 12; k++) seg(260 + rnd(k) * 560, py - 200 + rnd(k + 3) * 700, 260 + rnd(k + 6) * 560, py - 200 + rnd(k + 9) * 700, 'rgba(0,0,0,0.3)', 4); ctx.globalAlpha = 1; }
    ctx.restore();
    // platen / roller + carriage
    ctx.save(); ctx.translate(carriage, 0);
    fillRR(170, 520, 740, 90, 45, '#0E0E0E'); fillRR(190, 532, 700, 22, 11, '#3A3A3A');
    circle(150, 565, 46, '#2A2A2A'); circle(930, 565, 46, '#2A2A2A');
    fillRR(880, 470, 160, 30, 15, '#BDBDBD');                                 // return lever
    ctx.restore();
    // body
    ctx.beginPath(); ctx.moveTo(110, 1240); ctx.quadraticCurveTo(120, 640, 540, 620); ctx.quadraticCurveTo(960, 640, 970, 1240); ctx.closePath();
    ctx.fillStyle = '#121212'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#3C3C3C'; ctx.stroke();
    text('royal-ish', 540, 760, 42, '#CFCFCF', { font: '42px "TW"', ws: 0 });
    // type-bar basket; the active bar flicks up on each stroke
    for (let k = 0; k < 29; k++) {
      const a = Math.PI * (1.08 + k * 0.03), r0 = 150, x0 = 540 + Math.cos(a) * r0, y0 = 980 + Math.sin(a) * r0 * 0.6;
      const active = hit && k === (n * 7) % 29;
      seg(x0, y0, active ? 540 : lerp(x0, 540, 0.12), active ? 640 : y0 - 30, active ? '#E0E0E0' : '#7A7A7A', 5);
    }
    // keys: four curved rows of round keys
    for (let r = 0; r < 4; r++) for (let k = 0; k < 11 - (r === 3 ? 2 : 0); k++) {
      const x = 170 + k * 70 + r * 24, y = 1110 + r * 92;
      const down = hit && (n * 3 + 1) % 40 === r * 10 + k ? 8 : 0;
      circle(x, y + 10, 30, '#000'); circle(x, y + down, 30, '#E8E8E8'); circle(x, y + down, 22, '#111');
      ctx.font = '22px "TW"'; ctx.fillStyle = '#EEE'; ctx.textAlign = 'center'; ctx.fillText('qwertyuiopasdfghjklzxcvbnm,.-'[(r * 11 + k) % 29], x, y + down + 8);
    }
    fillRR(320, 1470, 440, 56, 28, '#E8E8E8');                                // space bar
    ctx.restore();
    // hands typing (alternate fingers on each keystroke)
    ctx.save(); ctx.translate(0, 300);
    for (const s of [-1, 1]) {
      const mine = (n % 2 === 0) === (s < 0) && hit;
      const hx = 540 + s * 220 + Math.sin(t * 7 + s) * 10, hy = 1420 + (mine ? 14 : 0);
      limb([[hx + s * 150, 2000], [hx + s * 40, 1620], [hx, hy + 80]], '#4A4A4A', 120);
      ctx.save(); ctx.translate(hx, hy);
      for (let f = 0; f < 4; f++) { const fx = -66 + f * 44, dip = mine && f === n % 4 ? 26 : 0; limb([[fx * 0.8, 40], [fx, -40 + dip]], '#D8D8D8', 34); }
      ell(0, 50, 100, 70, '#D8D8D8'); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.ellipse(0, 50, 100, 70, 0, 0, TAU); ctx.stroke();
      limb([[s * -70, 60], [s * -110, 10]], '#D8D8D8', 34);
      ctx.restore();
    }
    ctx.restore();
    // hook text (visible from frame 0)
    const sc = 1 + 0.08 * (1 - E.outCubic(P(t, 0, 0.25)));
    withScale(540, 300, sc, () => {
      text('tugas kuliah:', 540, 250, 120, '#FFFFFF', { stroke: '#000', sw: 18, shadow: '#000' });
      text('dulu vs sekarang.', 540, 390, 120, '#FFFFFF', { stroke: '#000', sw: 18, shadow: '#000', maxW: 1000 });
    });
  }

  // ======================= 1958 (4–8): tip-ex =======================
  function era1958(t) {
    const s0 = 4.0;
    ctx.fillStyle = '#8C8C8C'; ctx.fillRect(0, 0, W, H);
    // wallpaper + framed picture + desk lamp
    for (let x = 0; x < W; x += 90) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x, 0, 40, 1360); }
    fillRR(80, 560, 200, 250, 6, '#3A3A3A'); fillRR(96, 576, 168, 218, 4, '#BDBDBD'); circle(180, 660, 40, '#7A7A7A');
    // student typing
    const n = countBefore(KEYS2, t), hit = KEYS2.some(k => t - k >= 0 && t - k < 0.06);
    const annoyed = t > 5.5 && t < 6.75;
    student({ top: 'vest', c1: '#6E6E6E', hair: 'slick', bowtie: true, mood: annoyed ? 'annoyed' : 'focus', pupilY: 0.6,
      arms: [{ pts: [[-160, 210], [-200, 420], [-90, 500 - (hit && n % 2 ? 12 : 0)]] }, { pts: [[160, 210], [200, 420], [90, 500 - (hit && n % 2 === 0 ? 12 : 0)]] }], sleeve: '#F4F4F4' }, t, s0);
    desk('#5A5A5A', '#3E3E3E', '#2A2A2A');
    // typewriter from behind
    ctx.beginPath(); ctx.moveTo(330, 1390); ctx.quadraticCurveTo(340, 1210, 540, 1200); ctx.quadraticCurveTo(740, 1210, 750, 1390); ctx.closePath(); ctx.fillStyle = '#151515'; ctx.fill();
    fillRR(400, 1110, 280, 70, 3, '#E6E6E6'); fillRR(300, 1170, 480, 50, 25, '#0E0E0E');
    // props: tip-ex bottle + crumpled sheets
    outlined(() => rr(800, 1300, 70, 100, 12), '#EDEDED'); fillRR(812, 1270, 46, 40, 8, '#333'); text('tip-ex', 835, 1360, 18, '#222', { weight: 800, ws: 0 });
    for (let k = 0; k < 4; k++) { circle(150 + k * 70, 1480 + (k % 2) * 40, 40, '#D9D9D9'); seg(130 + k * 70, 1470, 170 + k * 70, 1490, '#999', 4); }
    yearTag('1958', 'mesin ketik', t, s0 - 0.1, 'tw');
    // callout: the typed page, the typo, and the tip-ex brush
    callout(540, 500, 860, 300, t, s0, 0.5, (x, y, w, h) => {
      ctx.fillStyle = '#F2F2F2'; ctx.fillRect(x, y, w, h);
      ctx.font = '44px "TW"'; ctx.fillStyle = '#111'; ctx.textAlign = 'left';
      const x0 = x + 50, wx = x0 + ctx.measureText('sejarah ').width, ww = ctx.measureText('indonseia').width;
      ctx.fillText('sejarah indonseia', x0, y + 110);
      const cov = E.outCubic(P(t, 5.9, 6.5));
      if (t > 5.4 && t < 6.6) { ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(wx + ww / 2, y + 96, ww / 2 + 30, 46, 0, 0, TAU); ctx.stroke(); }
      if (cov > 0) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(wx - 8, y + 62, (ww + 16) * cov, 64, 18); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(wx - 8, y + 120, (ww + 16) * cov, 6); }
      // brush
      if (t > 5.8 && t < 6.7) { const bx = wx - 8 + (ww + 16) * cov; ctx.save(); ctx.translate(bx, y + 70); ctx.rotate(0.5); fillRR(-12, -120, 24, 120, 8, '#333'); fillRR(-14, -10, 28, 30, 10, '#FFF'); ctx.restore(); }
      if (t > 6.75) { ctx.fillStyle = '#111'; ctx.font = '44px "TW"'; ctx.textAlign = 'left'; ctx.fillText('indonesia'.slice(0, countBefore(KEYS2.filter(k => k > 6.7), t) + 1), wx, y + 110); }
      ctx.font = '30px "TW"'; ctx.fillStyle = '#666'; ctx.fillText(t > 6.0 ? 'tip-ex lagi... tunggu kering.' : 'eh, salah ketik.', x + 50, y + 220);
    }, { r: 6 });
  }

  // ======================= 1988 (8–12.5): floppy, file lost =======================
  function era1988(t) {
    const s0 = SW[1];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2A0F4A'); g.addColorStop(0.6, '#6A1E7A'); g.addColorStop(1, '#1B0B33'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // neon sun + grid
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 1360); ctx.clip();
    const sg = ctx.createLinearGradient(0, 700, 0, 1100); sg.addColorStop(0, '#FFE14D'); sg.addColorStop(1, '#FF4FD8'); circle(820, 900, 200, sg);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#4A1366'; ctx.fillRect(600, 900 + k * 32, 440, 10 + k * 2); }
    ctx.strokeStyle = 'rgba(92,242,255,0.55)'; ctx.lineWidth = 3;
    for (let k = 0; k < 10; k++) { const y = 1100 + Math.pow(k / 10, 2) * 260 + ((t * 40) % 26); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(540 + k * 40, 1100); ctx.lineTo(540 + k * 220, 1360); ctx.stroke(); }
    ctx.restore();
    const err = t > 10.2;
    student({ top: 'denim', c1: '#3E6FB0', c2: '#FF3FA4', hair: 'big', headband: '#FFE14D', mood: err ? 'shock' : 'focus', pupilY: 0.5,
      arms: [{ pts: [[-160, 210], [-200, 420], [-90, 500]] }, { pts: [[160, 210], [230, 420], [260, 520]] }] }, t, s0);
    desk('#C9BFA6', '#A89E86', '#8F8570');
    // beige monitor back + CPU with floppy drive
    fillRR(370, 1110, 340, 260, 18, '#D8CFB6'); fillRR(400, 1140, 280, 200, 10, '#C9BFA6');
    for (let k = 0; k < 6; k++) fillRR(430 + k * 40, 1200, 20, 90, 6, '#B3A98F');
    fillRR(720, 1250, 300, 130, 8, '#D8CFB6'); fillRR(750, 1290, 160, 16, 4, '#333'); circle(960, 1300, 10, err ? '#FF3B30' : '#3BD16F');
    // floppy disk ejecting
    const ej = E.outCubic(P(t, 10.4, 10.9));
    ctx.save(); ctx.translate(830, 1290 - ej * 120); ctx.rotate(-ej * 0.2);
    fillRR(-70, -70, 140, 140, 8, '#1F1F2A'); fillRR(-40, -70, 80, 50, 4, '#BFC4CF'); fillRR(-50, 10, 100, 54, 4, '#F2F2F2');
    ctx.font = '16px "AW"'; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.fillText('tugas.doc', 0, 44); ctx.restore();
    // more disks on the desk
    for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(170 + k * 60, 1460 + k * 18); ctx.rotate(-0.2 + k * 0.15); fillRR(-60, -60, 120, 120, 6, ['#FF3FA4', '#5CF2FF', '#FFE14D'][k]); fillRR(-36, -60, 72, 42, 4, '#BFC4CF'); ctx.restore(); }
    yearTag('1988', 'komputer & disket', t, s0, 'neon');
    // DOS-style dialog
    callout(540, 500, 880, 300, t, s0, 0.45, (x, y, w, h) => {
      ctx.fillStyle = '#0000AA'; ctx.fillRect(x, y, w, h);
      ctx.font = '26px "PX"'; ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF';
      const lines = ['a:\\> copy tugas.doc c:', 'membaca disket...'];
      const typed = Math.floor(P(t, s0 + 0.6, s0 + 1.6) * lines[0].length);
      ctx.fillText(lines[0].slice(0, typed), x + 40, y + 70);
      if (t > s0 + 1.7) ctx.fillText(lines[1], x + 40, y + 120);
      if (err) {
        const on = Math.floor(t * 4) % 2 === 0;
        ctx.fillStyle = on ? '#FFFFFF' : '#FFE14D'; ctx.fillRect(x + 30, y + 150, w - 60, 110);
        ctx.fillStyle = '#AA0000'; ctx.font = '30px "PX"'; ctx.fillText('disk error!', x + 60, y + 200);
        ctx.fillStyle = '#000'; ctx.font = '22px "PX"'; ctx.fillText('file tidak ditemukan', x + 60, y + 240);
      } else if (Math.floor(t * 2) % 2) { ctx.fillRect(x + 40 + typed * 26, y + 48, 22, 28); }
    }, { r: 4, border: '#AAAAAA' });
  }

  // ======================= 1999 (12.5–17): internet cafe queue =======================
  function era1999(t) {
    const s0 = SW[2];
    ctx.fillStyle = '#1E2B22'; ctx.fillRect(0, 0, W, H);
    // fluorescent light + booths with glowing CRTs and silhouettes
    fillRR(240, 40, 600, 30, 15, '#E8FFE8');
    const lg = ctx.createRadialGradient(540, 60, 20, 540, 60, 900); lg.addColorStop(0, 'rgba(200,255,210,0.35)'); lg.addColorStop(1, 'rgba(200,255,210,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) {
      const x = 20 + k * 270;
      fillRR(x, 820, 250, 520, 6, '#2E4234'); fillRR(x + 10, 830, 230, 500, 4, '#25362B');
      ell(x + 125, 960, 60, 70, '#101912'); fillRR(x + 45, 1020, 160, 200, 50, '#101912');
      fillRR(x + 60, 1150, 130, 100, 6, '#B8C2B0'); fillRR(x + 70, 1160, 110, 80, 4, `rgba(124,255,107,${0.5 + 0.3 * rnd(k + Math.floor(t * 6))})`);
      text('pc ' + (k + 1), x + 125, 870, 26, '#7CFF6B', { font: '22px "PX"', ws: 0 });
    }
    text('penuh', 145, 925, 30, '#FFE14D', { font: '26px "PX"', shadow: '#000', sy: 4, ws: 0 });
    // student queuing with a ticket
    const now = 12 + Math.floor(P(t, s0 + 0.5, SW[3]) * 3);
    student({ top: 'flannel', c1: '#B5372E', hair: 'spiky', mood: 'bored', pupilY: -0.8,
      arms: [{ pts: [[-160, 210], [-200, 420], [-180, 560]] }, { pts: [[160, 210], [280, 330], [250, 170]] }] }, t, s0);
    // ticket in the raised hand
    ctx.save(); ctx.translate(540 + 250 * 0.95, 960 + 120 * 0.95); ctx.rotate(0.15);
    fillRR(-60, -90, 120, 90, 6, '#FFF6C9'); text('no.', 0, -55, 22, '#333', { weight: 800, ws: 0 }); text('27', 0, -14, 40, '#B5372E', { weight: 900, ws: 0 }); ctx.restore();
    desk('#5B6B5E', '#3E4A41', '#2A332C');
    // billing monitor + bell on the counter
    fillRR(130, 1180, 260, 200, 10, '#B8C2B0'); fillRR(150, 1200, 220, 150, 4, '#0B1F10');
    ctx.font = '20px "PX"'; ctx.textAlign = 'left'; ctx.fillStyle = '#7CFF6B'; ctx.fillText('billing', 166, 1240); ctx.fillText('rp3.000/jam', 166, 1290);
    ellipseBell(850, 1350);
    yearTag('1999', 'warnet', t, s0, 'px');
    // queue + dial-up callout
    callout(540, 500, 860, 300, t, s0, 0.45, (x, y, w, h) => {
      ctx.fillStyle = '#0B1F10'; ctx.fillRect(x, y, w, h);
      ctx.textAlign = 'left'; ctx.font = '30px "PX"'; ctx.fillStyle = '#FFE14D';
      ctx.fillText('antrean: no. 27', x + 40, y + 70);
      ctx.fillStyle = '#7CFF6B'; ctx.fillText('sekarang: no. ' + now, x + 40, y + 124);
      ctx.font = '20px "PX"'; ctx.fillStyle = '#B8FFB0';
      const dots = '.'.repeat(1 + Math.floor(t * 3) % 3);
      ctx.fillText('menghubungkan 56k' + dots, x + 40, y + 190);
      const pr = P(t, s0 + 0.6, SW[3]) * 0.35;
      ctx.strokeStyle = '#7CFF6B'; ctx.lineWidth = 4; ctx.strokeRect(x + 40, y + 216, w - 80, 36);
      ctx.fillStyle = '#7CFF6B'; for (let k = 0; k < Math.floor(pr * 26); k++) ctx.fillRect(x + 48 + k * 29, y + 222, 22, 24);
    }, { r: 4, border: '#7CFF6B' });
  }
  function ellipseBell(x, y) { ell(x, y + 10, 70, 16, '#555'); ctx.beginPath(); ctx.arc(x, y, 56, Math.PI, 0); ctx.fillStyle = '#C9C9C9'; ctx.fill(); circle(x, y - 60, 12, '#888'); }

  // ======================= 2012 (17–22): laptop + flashdisk, battery dies =======================
  function battery(t) { return Math.max(0, Math.round(lerp(14, 0, P(t, 17.8, 20.8)))); }
  function era2012(t) {
    const s0 = SW[3];
    const dead = t > 20.8;
    ctx.fillStyle = '#E9DCCB'; ctx.fillRect(0, 0, W, H);
    // dorm wall: corkboard with polaroids + fairy lights
    fillRR(60, 560, 380, 300, 10, '#C49A6C');
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(120 + k * 90, 650 + (k % 2) * 90); ctx.rotate((rnd(k) - 0.5) * 0.4); fillRR(-40, -48, 80, 96, 3, '#FFFFFF'); fillRR(-32, -40, 64, 60, 2, ['#9BC4C9', '#E8B38C', '#B5C99B', '#D8A6B5'][k]); ctx.restore(); }
    ctx.beginPath(); ctx.moveTo(500, 520); ctx.quadraticCurveTo(780, 620, 1080, 520); ctx.strokeStyle = '#6B5544'; ctx.lineWidth = 3; ctx.stroke();
    for (let k = 0; k < 9; k++) { const u = (k + 0.5) / 9; circle(500 + u * 580, 520 + 4 * 100 * u * (1 - u) * 0.95 + 10, 10, k % 2 ? '#FFD27A' : '#FFF1C9'); }
    student({ top: 'hoodie', c1: '#7A8291', c2: '#666E7D', hair: 'fringe', headphones: '#E85D5D', mood: dead ? 'panic' : 'focus', sweat: t > 19.5, pupilY: 0.5,
      arms: [{ pts: [[-160, 210], [-200, 420], [-90, 500]] }, { pts: [[160, 210], [200, 420], [90, 500]] }] }, t, s0);
    desk('#B08A64', '#8E6C4C', '#6E5238');
    // laptop back + flashdisk plugged in
    fillRR(370, 1120, 340, 250, 16, '#C8CCD2'); circle(540, 1240, 26, '#E8EAEE');
    ctx.save(); ctx.translate(712, 1330); fillRR(0, -12, 60, 24, 6, '#2B6FD6'); fillRR(60, -8, 20, 16, 2, '#AAB'); ctx.restore();
    // charger cable lying uselessly (not plugged)
    ctx.beginPath(); ctx.moveTo(140, 1520); ctx.bezierCurveTo(260, 1450, 220, 1600, 340, 1560); ctx.strokeStyle = '#333'; ctx.lineWidth = 8; ctx.stroke(); fillRR(330, 1540, 50, 34, 6, '#EEE');
    // mug
    outlined(() => rr(820, 1260, 110, 120, 16), '#F3F0E6'); text('bab 4', 875, 1336, 26, '#8E6C4C', { weight: 800, ws: 0 });
    yearTag('2012', 'laptop & flashdisk', t, s0, 'lofi');
    callout(540, 500, 760, 300, t, s0, 0.45, (x, y, w, h) => {
      ctx.fillStyle = '#FFF8EE'; ctx.fillRect(x, y, w, h);
      const b = battery(t);
      // battery icon
      const bx = x + 60, by = y + 70;
      ctx.lineWidth = 10; ctx.strokeStyle = '#3A3A3A'; rr(bx, by, 260, 140, 20); ctx.stroke(); fillRR(bx + 262, by + 44, 24, 52, 6, '#3A3A3A');
      const col = b > 10 ? '#3BB273' : b > 4 ? '#F5A623' : '#E5484D';
      if (!(b <= 4 && Math.floor(t * 4) % 2)) fillRR(bx + 14, by + 14, Math.max(0, 232 * b / 100 * 4), 112, 10, col);
      text(b + '%', x + 520, y + 150, 92, col, { weight: 900, ws: 0 });
      ctx.font = F(600, 30); ctx.textAlign = 'left'; ctx.fillStyle = '#5A4A3A';
      ctx.fillText(dead ? 'mati. belum ke-save.' : 'baterai lemah...', x + 60, y + 262);
    }, { r: 30 });
  }

  // ======================= 2021 (22–26): google docs at a cafe =======================
  const COMMENTS = ['revisi ya', 'kurang referensi', 'format salah', 'tambah data', 'cek typo', 'ganti judul?', 'revisi lagi'];
  function era2021(t) {
    const s0 = SW[4];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#F6EFE6'); g.addColorStop(1, '#E3D5C4'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // cafe window with bokeh + plants + menu board
    fillRR(560, 520, 460, 560, 14, '#C7D6DE');
    for (let k = 0; k < 14; k++) circle(600 + rnd(k) * 380, 560 + rnd(k + 5) * 480, 20 + rnd(k + 9) * 30, `rgba(255,${200 + rnd(k) * 50},150,${0.25 + 0.2 * Math.sin(t * 2 + k)})`);
    seg(790, 520, 790, 1080, '#B39C84', 10); seg(560, 800, 1020, 800, '#B39C84', 10);
    fillRR(60, 560, 300, 360, 12, '#2E2A27'); text('menu', 210, 640, 44, '#F6EFE6', { weight: 800, ws: 0 });
    for (let k = 0; k < 4; k++) fillRR(100, 690 + k * 50, 220 - k * 20, 14, 7, 'rgba(246,239,230,0.6)');
    ell(110, 1300, 70, 100, '#7FA77A'); fillRR(80, 1300, 60, 80, 8, '#C9A37A');
    student({ top: 'cardigan', c1: '#D9C3A0', hair: 'neat', glasses: true, mood: 'tired', bags: 0.8,
      arms: [{ pts: [[-160, 210], [-200, 420], [-90, 500]] }, { pts: [[160, 210], [200, 420], [90, 500]] }] }, t, s0);
    desk('#E9E2D8', '#CFC3B3', '#B8AA98');
    fillRR(380, 1150, 320, 220, 14, '#D7DADF'); circle(540, 1255, 22, '#EEF0F3');
    fillRR(400, 1180, 60, 60, 10, '#F5A623'); fillRR(620, 1290, 60, 40, 8, '#5C9CE6');             // stickers
    outlined(() => { ctx.beginPath(); ctx.moveTo(780, 1250); ctx.lineTo(880, 1250); ctx.lineTo(866, 1380); ctx.lineTo(794, 1380); ctx.closePath(); }, '#FFFFFF');
    ell(830, 1252, 50, 12, '#C08A5A'); circle(830, 1252, 14, '#F3E6D6');
    yearTag('2021', 'google docs di kafe', t, s0, 'clean');
    callout(540, 500, 860, 320, t, s0, 0.4, (x, y, w, h) => {
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#4285F4'; ctx.fillRect(x, y, w, 56);
      ctx.font = F(600, 26); ctx.textAlign = 'left'; ctx.fillStyle = '#FFF'; ctx.fillText('tugas_kelompok_final (3)', x + 30, y + 37);
      for (let l = 0; l < 6; l++) fillRR(x + 40, y + 90 + l * 34, 420 - (l % 3) * 60, 14, 7, '#D6DCE6');
      const n = Math.min(COMMENTS.length, Math.floor(P(t, s0 + 0.7, SW[5] - 0.3) * COMMENTS.length + 0.999));
      for (let k = 0; k < n; k++) {
        const yy = y + 76 + k * 34 - Math.max(0, n - 6) * 34;
        fillRR(x + 500, yy, 330, 30, 8, '#FFF4CC'); ctx.fillStyle = '#5A4A1A'; ctx.font = F(600, 18); ctx.fillText(COMMENTS[k], x + 512, yy + 21);
      }
      const total = Math.round(lerp(3, 47, P(t, s0 + 0.7, SW[5] - 0.3)));
      fillRR(x + 40, y + h - 66, 260, 46, 23, '#FDE2E1'); ctx.fillStyle = '#C5221F'; ctx.font = F(800, 24); ctx.fillText(total + ' komentar', x + 62, y + h - 34);
      ctx.fillStyle = '#5A6274'; ctx.font = F(600, 22); ctx.fillText('deadline 23.59', x + 330, y + h - 34);
    }, { r: 18 });
  }

  // ======================= now (26–34): chat MinTask, everything resolves =======================
  const OLD = ['tip-ex', 'disket error', 'antre warnet', 'baterai 0%', '47 komentar'];
  function eraNow(t) {
    const s0 = SW[5];
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#F4F7FD'); g.addColorStop(1, '#DCE7FA'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 8; k++) circle(rnd(k) * W, 520 + rnd(k + 3) * 800, 40 + rnd(k + 6) * 60, 'rgba(24,74,161,0.05)');
    const done = t > 31.0;
    student({ top: 'jacket', c1: C.blue, c2: C.blueD, hair: 'neat', mood: t > 28.4 ? 'happy' : 'focus', pupilY: 0.6, pupilX: 0.4,
      arms: [{ pts: [[-160, 210], [-200, 420], [-120, 540]] }, { pts: [[160, 210], [240, 400], [150, 330]] }] }, t, s0);
    // phone in hand (back side, blue case)
    ctx.save(); ctx.translate(540 + 150 * 0.95, 960 + 300 * 0.95); ctx.rotate(-0.2); fillRR(-50, -90, 100, 180, 18, C.blue); circle(-22, -60, 10, C.navy); ctx.restore();
    desk('#FFFFFF', '#E6ECF7', '#C9D5EA');
    fillRR(380, 1200, 320, 170, 14, '#C9D5EA'); circle(540, 1285, 18, '#FFFFFF');
    outlined(() => rr(780, 1270, 100, 110, 16), C.white); fillRR(790, 1300, 80, 24, 6, C.amber);
    yearTag('sekarang', 'chat mintask', t, s0, 'clean');
    // chat (26.4 – 29.8), then the tidy document
    if (t < 30.0) {
      callout(540, 480, 820, 400, t, s0, 0.35, (x, y, w, h) => {
        ctx.fillStyle = '#F4F7FD'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = C.blue; ctx.fillRect(x, y, w, 76);
        ctx.drawImage(mark, x + 24, y + 12, 52, 52);
        ctx.font = F(800, 32); ctx.textAlign = 'left'; ctx.fillStyle = C.white; ctx.fillText('mintask', x + 92, y + 50);
        circle(x + 230, y + 40, 8, '#3BD16F');
        const msg = (k0, str, mine, yy) => {
          const p = E.outBack(P(t, k0, k0 + 0.25)); if (p <= 0) return;
          ctx.font = F(600, 28); const tw = ctx.measureText(str).width + 48;
          const bx = mine ? x + w - 30 - tw : x + 30;
          withScale(mine ? bx + tw : bx, yy, p, () => { fillRR(bx, yy, tw, 62, 26, mine ? C.blue : C.white); ctx.fillStyle = mine ? C.white : C.navy; ctx.fillText(str, bx + 24, yy + 41); });
        };
        msg(26.6, 'min, tolong rapihin tugasku', true, y + 100);
        if (t > 27.15 && t < 27.65) { fillRR(x + 30, y + 180, 110, 50, 25, C.white); for (let k = 0; k < 3; k++) circle(x + 60 + k * 25, y + 205 + Math.sin(t * 14 + k) * 5, 8, '#9AA6C4'); }
        msg(27.65, 'siap! kirim filenya ya', false, y + 180);
        msg(28.1, 'tugas_final.docx', true, y + 260);
        msg(28.6, 'beres. rapi & siap kumpul.', false, y + 330);
      }, { r: 30 });
    } else {
      callout(540, 520, 700, 360, t, 30.0, 0, (x, y, w, h) => {
        ctx.fillStyle = C.white; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = C.blue; ctx.fillRect(x, y, 16, h);
        ctx.font = F(800, 34); ctx.textAlign = 'left'; ctx.fillStyle = C.navy; ctx.fillText('tugas_final.pdf', x + 50, y + 70);
        for (let l = 0; l < 5; l++) fillRR(x + 50, y + 110 + l * 40, 520 - (l % 2) * 120, 16, 8, '#DCE4F2');
        blueCheck(x + w - 80, y + h - 80, 52, P(t, 30.2, 30.5));
      }, { r: 24 });
    }
    // the old problems orbit the student, then get blue-checked away on the beat
    OLD.forEach((s, i) => {
      const appear = E.outBack(P(t, 28.9 + i * 0.12, 29.2 + i * 0.12));
      const tc = 31.0 + i * 0.5, gone = P(t, tc + 0.25, tc + 0.5);
      if (appear <= 0 || gone >= 1) return;
      const [x, y] = [[280, 1500], [800, 1500], [540, 1610], [280, 1720], [800, 1720]][i];
      withScale(x, y, appear * (1 - E.inCubic(gone)), () => {
        ctx.font = F(800, 40); const w = ctx.measureText(s).width + 70;
        fillRR(x - w / 2, y - 36, w, 72, 36, t > tc ? '#E6EEFC' : '#FFFFFF'); ctx.lineWidth = 4; ctx.strokeStyle = t > tc ? C.blue : '#C5221F'; rr(x - w / 2, y - 36, w, 72, 36); ctx.stroke();
        text(s, x, y + 14, 40, t > tc ? C.blue : '#8E1B19', { weight: 800 });
        if (t > tc) { seg(x - w / 2 + 24, y, x + w / 2 - 24, y, C.blue, 5); blueCheck(x + w / 2 - 6, y - 34, 26, P(t, tc, tc + 0.2)); }
      });
    });
    if (done) {
      const p = E.outBack(P(t, 33.0, 33.3));
      withScale(540, 1600, p, () => text('semua beres.', 540, 1640, 96, C.blue, { weight: 900 }));
    }
  }

  // ======================= brand (34–40) =======================
  function brand(t) {
    const s0 = SW[6];
    const g = ctx.createRadialGradient(540, 820, 50, 540, 820, 1300); g.addColorStop(0, '#2459B8'); g.addColorStop(1, C.blue); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint era years drifting in the background
    ['1958', '1988', '1999', '2012', '2021'].forEach((y, i) => text(y, 140 + i * 200, 300 + (i % 2) * 1300 + Math.sin(t + i) * 10, 70, 'rgba(255,255,255,0.08)', { weight: 900, ws: 0 }));
    withScale(540, 800, E.outBack(P(t, s0 + 0.2, s0 + 0.6)) * (1 + 0.015 * Math.sin(t * 4)), () => ctx.drawImage(mark, 540 - 210, 800 - 210, 420, 420));
    withScale(540, 1140, E.outBack(P(t, s0 + 0.5, s0 + 0.85)), () => text('taskkora', 540, 1180, 150, C.white, { weight: 900, shadow: C.blueD, ws: 0 }));
    withScale(540, 1320, E.outBack(P(t, s0 + 1.0, s0 + 1.35)), () => {
      ctx.font = F(800, 52); const w = ctx.measureText('ada task? taskkora-in aja.').width + 80;
      fillRR(540 - w / 2, 1270, w, 100, 50, C.amber);
      text('ada task? taskkora-in aja.', 540, 1338, 52, C.navy, { weight: 800 });
    });
  }

  // ---------- per-era looks (texture / colour treatment) ----------
  const LOOK = [
    { filter: 'grayscale(1) contrast(1.15) brightness(0.98)', grain: 0.16, flicker: true },
    { filter: 'saturate(1.25) contrast(1.05)', vhs: true },
    { filter: 'saturate(1.1)', pixel: true, crt: true },
    { filter: 'sepia(0.28) saturate(1.15) contrast(0.92) brightness(1.04)', fade: true },
    { filter: 'none', soft: true },
    { filter: 'none' },
    { filter: 'none' },
  ];
  const DRAW = [t => (t < 4 ? hookTypewriter(t) : era1958(t)), era1988, era1999, era2012, era2021, eraNow, brand];

  function renderEra(i, t, target) {
    const tctx = target.getContext('2d');
    const prev = ctx; ctx = tctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.clearRect(0, 0, W, H);
    DRAW[i](t);
    ctx.restore();
    const L = LOOK[i];
    if (L.pixel) { const s = small.getContext('2d'); s.imageSmoothingEnabled = true; s.clearRect(0, 0, 270, 480); s.drawImage(target, 0, 0, 270, 480); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.35; ctx.drawImage(small, 0, 0, W, H); ctx.restore(); }
    if (L.crt) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2); }
    if (L.vhs) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25; ctx.drawImage(target, 6, 0); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      const by = ((t * 300) % (H + 200)) - 100; ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, by, W, 30);
      ctx.font = '34px "AW"'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'left'; ctx.fillText('play', 60, 120);
    }
    if (L.grain) { ctx.save(); ctx.globalAlpha = L.grain; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grain[Math.floor(t * 24) % 4], 0, 0, W, H); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 2; k++) { const x = rnd(Math.floor(t * 12) + k) * W; ctx.fillRect(x, 0, 2, H); } }
    if (L.flicker) { ctx.fillStyle = `rgba(0,0,0,${0.05 * rnd(Math.floor(t * 24))})`; ctx.fillRect(0, 0, W, H); }
    if (L.fade || L.grain || L.vhs) { const v = ctx.createRadialGradient(540, 960, 500, 540, 960, 1200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
    ctx = prev;
  }

  function watermark() {
    mctx.save(); mctx.globalAlpha = 0.3; mctx.filter = 'none';
    mctx.font = F(600, 30); mctx.textAlign = 'right'; mctx.textBaseline = 'alphabetic'; mctx.fillStyle = C.white;
    mctx.shadowColor = 'rgba(0,0,0,0.6)'; mctx.shadowBlur = 4;
    mctx.fillText('@taskkora__', 1040, 1872);
    mctx.restore();
  }

  // =====================================================================
  function render(t) {
    mctx.save(); mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalAlpha = 1; mctx.filter = 'none';
    const i = eraIndex(t), s = SW[i];
    const k = i > 0 ? E.inOutCubic(P(t, s, s + SWIPE)) : 1;
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
    if (k < 1) {
      renderEra(i - 1, t, LA); renderEra(i, t, LB);
      // push-swipe to the left with a slanted seam
      const x = (1 - k) * W, skew = 160;
      mctx.save(); mctx.filter = LOOK[i - 1].filter; mctx.drawImage(LA, x - W, 0); mctx.restore();
      mctx.save(); mctx.beginPath(); mctx.moveTo(x + skew, 0); mctx.lineTo(x + W + skew, 0); mctx.lineTo(x + W, H); mctx.lineTo(x - skew * 0.0, H); mctx.closePath(); mctx.clip();
      mctx.filter = LOOK[i].filter; mctx.drawImage(LB, x, 0); mctx.restore();
      // seam streaks
      mctx.save(); mctx.filter = 'none';
      for (let j = 0; j < 3; j++) { mctx.beginPath(); mctx.moveTo(x + skew - j * 26, 0); mctx.lineTo(x - j * 26, H); mctx.strokeStyle = j ? 'rgba(255,255,255,0.4)' : (i === 6 ? C.amber : C.white); mctx.lineWidth = j ? 8 : 18; mctx.stroke(); }
      mctx.restore();
    } else {
      renderEra(i, t, LB);
      mctx.save(); mctx.filter = LOOK[i].filter; mctx.drawImage(LB, 0, 0); mctx.restore();
    }
    if (t < 0.08) { mctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - t / 0.08)})`; mctx.fillRect(0, 0, W, H); }
    watermark();
    mctx.restore();
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
