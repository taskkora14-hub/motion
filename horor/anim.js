/* "jam 23.00. satu notifikasi." — light horror-comedy promo, 40s, 1080x1920.
 * Dark room lit by screens, a paper-stack shadow monster, dutch angles... then the door opens and
 * it's MinTask with a folder and a lamp. Every frame is a pure function of time.
 * Heartbeat / tick times are mirrored in horor/music.py. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueL: '#2F6BD3', blueXL: '#9CC0FF', blueD: '#0F3274',
    navy: '#0B1A3D', navy2: '#050B1E', navy3: '#16285A',
    white: '#FFFFFF', paper: '#EEF2FA', amber: '#FFB627', amberD: '#D98E00', amberL: '#FFD77A',
    skin: '#F1C49E', skinD: '#D9A07A', pale: '#A9BCE8', hair: '#151A2C', line: '#0A1430',
  };
  const F = (w, s) => `${w} ${s}px "PP", sans-serif`;

  // ---------- timeline ----------
  const T = {
    hook: 4.0, wideA: 8.5, screen: 11.5, wideB: 15.5, face: 18.5,
    creak: 24.0, reveal: 26.0, shrink0: 27.0, poof: 28.6, walk0: 28.8, walk1: 30.8, hand: 31.4,
    lights: 33.8, brand: 36.4,
  };
  // heartbeat (mirrored in music.py): 66 -> 132 bpm, stops before the reveal
  const HEART = (() => { const a = []; let t = 4.2; while (t < 25.6) { a.push(t); t += 60 / (66 + 66 * Math.pow(Math.min(1, (t - 4) / 21), 1.5)); } return a; })();

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
    outElastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join(''); };
  const heartPulse = t => { let p = 0; for (const h of HEART) { const d = t - h; if (d >= 0 && d < 0.5) p = Math.max(p, Math.exp(-d * 9)); } return p; };

  // story parameters
  const fear = t => (t < T.reveal ? clamp(0.35 + 0.65 * P(t, 4, 18)) : 1 - P(t, T.reveal + 2, T.hand + 0.6));
  const warm = t => 0.45 * E.inOutCubic(P(t, T.reveal, T.reveal + 3)) + 0.55 * E.outCubic(P(t, T.lights, T.lights + 0.3));
  const doorOpen = t => (t < T.creak ? 0 : t < T.reveal ? 0.42 * E.inOutCubic(P(t, T.creak, T.reveal - 0.2)) : 0.42 + 0.58 * E.outBack(P(t, T.reveal, T.reveal + 0.25)));
  const tidy = t => E.outCubic(P(t, T.poof - 0.1, T.poof + 0.35));

  // ---------- assets ----------
  const mark = new Image();
  let darkC, dctx, grain = [];
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load(F(900, 40)), document.fonts.load(F(800, 40)), document.fonts.load(F(600, 40)),
  ]).then(() => document.fonts.ready).then(() => {
    darkC = document.createElement('canvas'); darkC.width = W; darkC.height = H; dctx = darkC.getContext('2d');
    for (let k = 0; k < 4; k++) {
      const g = document.createElement('canvas'); g.width = 270; g.height = 480; const gc = g.getContext('2d');
      const im = gc.createImageData(270, 480);
      for (let i = 0; i < im.data.length; i += 4) { const v = rnd(i * 0.37 + k * 999) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
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
    ctx.font = F(o.weight || 900, size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = '0px'; ctx.wordSpacing = Math.round(size * 0.12) + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const w = ctx.measureText(s).width, max = o.maxW || 980;
    if (w > max) { ctx.translate(x, y); ctx.scale(max / w, max / w); ctx.translate(-x, -y); }
    if (o.stroke !== false) { ctx.lineWidth = o.sw || Math.max(8, size * 0.14); ctx.strokeStyle = o.stroke || C.navy2; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    if (o.shadow !== false) { ctx.fillStyle = o.shadow || C.navy2; ctx.fillText(s, x, y + Math.max(6, size * 0.08)); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
    ctx.restore();
  }
  function withScale(x, y, s, fn) { if (s <= 0.001) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y); fn(); ctx.restore(); }
  function tick(x, y, z, c, w) { ctx.beginPath(); ctx.moveTo(x - z * 0.5, y); ctx.lineTo(x - z * 0.12, y + z * 0.38); ctx.lineTo(x + z * 0.55, y - z * 0.4); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }

  // ---------- characters (local units: head centre at 0,0, head radius ~100) ----------
  function person(o, t) {
    // legs (standing only)
    if (o.standing) {
      const st = o.step || 0;
      outlined(() => rr(-140, 590 - Math.max(0, st) * 20, 128, 470, 16), o.pants);
      outlined(() => rr(12, 590 - Math.max(0, -st) * 20, 128, 470, 16), o.pants);
      outlined(() => rr(-150, 1040 - Math.max(0, st) * 20, 145, 52, 24), C.white);
      outlined(() => rr(5, 1040 - Math.max(0, -st) * 20, 145, 52, 24), C.white);
    }
    // hood
    if (o.top === 'hoodie') outlined(() => { ctx.beginPath(); ctx.ellipse(0, 175, 150, 60, 0, 0, TAU); }, o.c2);
    // torso
    const torso = () => { ctx.beginPath(); ctx.moveTo(-178, 230); ctx.quadraticCurveTo(-168, 160, -92, 152); ctx.lineTo(92, 152); ctx.quadraticCurveTo(168, 160, 178, 230); ctx.lineTo(162, 620); ctx.lineTo(-162, 620); ctx.closePath(); };
    outlined(torso, o.c1);
    ctx.save(); torso(); ctx.clip();
    if (o.top === 'hoodie') { fillRR(-110, 420, 220, 130, 30, o.c2); }
    if (o.top === 'jacket') {
      poly([[-70, 150], [70, 150], [60, 640], [-60, 640]], C.white);
      seg(-64, 160, -56, 640, C.amber, 8); seg(64, 160, 56, 640, C.amber, 8);
      fillRR(70, 300, 92, 34, 8, C.white); text('mintask', 116, 325, 20, C.blue, { stroke: false, shadow: false, weight: 800, maxW: 84 });
      circle(0, 360, 40, C.blue); tick(0, 360, 44, C.white, 9);
    }
    ctx.restore();
    torso(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    if (o.top === 'hoodie') { seg(-24, 170, -28, 300, C.paper, 7); seg(24, 170, 28, 300, C.paper, 7); }
    // arms
    for (const arm of o.arms || []) { limb(arm.pts, o.c1, 74); if (arm.hand !== false) { const h = arm.pts[arm.pts.length - 1]; ctx.beginPath(); ctx.arc(h[0], h[1], 34, 0, TAU); ctx.fillStyle = o.skin; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke(); } }
    // neck + head
    ctx.save(); ctx.translate(o.headDx || 0, o.headDy || 0); ctx.rotate(o.headRot || 0);
    outlined(() => rr(-34, 80, 68, 90, 20), mix(o.skin, '#000000', 0.12));
    outlined(() => { ctx.beginPath(); ctx.ellipse(-100, 12, 22, 30, 0, 0, TAU); }, o.skin);
    outlined(() => { ctx.beginPath(); ctx.ellipse(100, 12, 22, 30, 0, 0, TAU); }, o.skin);
    outlined(() => { ctx.beginPath(); ctx.ellipse(0, 0, 100, 118, 0, 0, TAU); }, o.skin);
    hair(o.hair, t);
    face(o, t);
    ctx.restore();
  }

  function hair(kind, t) {
    if (kind === 'messy') {
      ctx.beginPath(); ctx.moveTo(-108, -10);
      ctx.quadraticCurveTo(-116, -118, -40, -134); ctx.quadraticCurveTo(60, -156, 108, -66); ctx.lineTo(104, -10);
      ctx.quadraticCurveTo(58, -66, 10, -38); ctx.quadraticCurveTo(-30, -86, -68, -38); ctx.quadraticCurveTo(-88, -28, -108, -10); ctx.closePath();
      ctx.fillStyle = C.hair; ctx.fill();
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (1.08 + k * 0.1), r0 = 112, r1 = 146 + rnd(k + 3) * 36, w = 0.09;
        poly([[Math.cos(a - w) * r0, -8 + Math.sin(a - w) * r0 * 1.1], [Math.cos(a) * r1, -8 + Math.sin(a) * r1 * 1.08], [Math.cos(a + w) * r0, -8 + Math.sin(a + w) * r0 * 1.1]], C.hair);
      }
    } else {
      ctx.beginPath(); ctx.moveTo(-104, 10);
      ctx.quadraticCurveTo(-114, -126, -10, -138); ctx.quadraticCurveTo(112, -136, 106, 4);
      ctx.quadraticCurveTo(92, -62, 28, -72); ctx.quadraticCurveTo(-38, -92, -58, -44); ctx.quadraticCurveTo(-82, -28, -104, 10); ctx.closePath();
      ctx.fillStyle = C.hair; ctx.fill();
      seg(-40, -112, 46, -108, 'rgba(255,255,255,0.18)', 9);
    }
  }

  function face(o, t) {
    const m = o.mood, y = 20, ex = [-46, 46], ey = y - 8, px = o.pupilX || 0;
    if (o.bags) for (const e of ex) { ctx.beginPath(); ctx.ellipse(e, ey + 30, 30, 12, 0, 0.1, Math.PI - 0.1); ctx.strokeStyle = `rgba(70,50,130,${0.5 * o.bags})`; ctx.lineWidth = 8; ctx.stroke(); }
    const brow = (dy, rot) => { for (const [i, e] of ex.entries()) { ctx.save(); ctx.translate(e, ey - 44 + dy); ctx.rotate(rot * (i === 0 ? 1 : -1)); seg(-22, 0, 22, 0, C.hair, 10); ctx.restore(); } };
    if (m === 'shock' || m === 'terror' || m === 'surprised') {
      const big = m === 'terror' ? 1.25 : m === 'surprised' ? 1.1 : 1;
      for (const e of ex) { ell(e, ey, 26 * big, 31 * big, C.white); ctx.lineWidth = 5; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.ellipse(e, ey, 26 * big, 31 * big, 0, 0, TAU); ctx.stroke(); circle(e + px * 12, ey + 2, m === 'surprised' ? 12 : 6, C.line); }
      brow(-14 * big, m === 'surprised' ? 0 : -0.3);
      if (m === 'surprised') { ell(0, y + 56, 20, 26, C.line); }
      else {
        ctx.beginPath(); const wv = m === 'terror' ? 30 : 20;
        ctx.moveTo(-wv, y + 56); for (let k = 0; k <= 8; k++) ctx.lineTo(-wv + k * wv / 4, y + 56 + (k % 2 ? -6 : 6));
        ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke();
      }
    } else if (m === 'laugh' || m === 'relief') {
      for (const e of ex) { ctx.beginPath(); ctx.arc(e, ey + 8, 18, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = C.line; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke(); }
      brow(-10, 0.12);
      circle(-70, y + 32, 18, 'rgba(255,130,100,0.35)'); circle(70, y + 32, 18, 'rgba(255,130,100,0.35)');
      const open = m === 'laugh' ? 1 : 0.55;
      ctx.beginPath(); ctx.moveTo(-44, y + 38); ctx.quadraticCurveTo(0, y + 38 + 70 * open, 44, y + 38); ctx.closePath(); ctx.fillStyle = C.navy; ctx.fill();
      ctx.save(); ctx.clip(); fillRR(-42, y + 34, 84, 14, 4, C.white); circle(0, y + 38 + 56 * open, 22, '#E8697A'); ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
      if (m === 'laugh') for (const s of [-1, 1]) { const k = (t * 2.5 + (s > 0 ? 0.5 : 0)) % 1; ell(s * 66, ey + 12 + k * 40, 7, 11, `rgba(156,192,255,${1 - k})`); }
    } else { // smile (MinTask)
      for (const e of ex) { ell(e, ey, 13, 17, C.line); circle(e + 4, ey - 6, 5, C.white); }
      brow(-6, -0.05);
      circle(-70, y + 32, 16, 'rgba(255,130,100,0.3)'); circle(70, y + 32, 16, 'rgba(255,130,100,0.3)');
      ctx.beginPath(); ctx.moveTo(-40, y + 36); ctx.quadraticCurveTo(0, y + 90, 40, y + 36); ctx.closePath(); ctx.fillStyle = C.navy; ctx.fill();
      ctx.save(); ctx.clip(); fillRR(-38, y + 32, 76, 14, 4, C.white); ctx.restore(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    }
    // sweat drops when scared
    if (o.sweat) for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.7 + k * 0.5) % 1), x = k ? 92 : -96, yy = -40 + ph * 90;
      ctx.globalAlpha = 1 - ph * 0.6;
      ctx.beginPath(); ctx.moveTo(x, yy - 18); ctx.quadraticCurveTo(x + 12, yy + 2, x, yy + 10); ctx.quadraticCurveTo(x - 12, yy + 2, x, yy - 18); ctx.fillStyle = C.blueXL; ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function studentLook(t) {
    const f = fear(t);
    let mood = t < T.reveal ? (t > T.face + 2.5 ? 'terror' : 'shock') : t < T.hand + 0.5 ? 'surprised' : 'relief';
    if (t >= T.lights - 0.6) mood = 'laugh';
    const look = 3 < t && t < T.reveal ? Math.sin(t * 1.3) * 0.4 + (t > T.wideB ? -0.6 : 0) : t >= T.reveal && t < T.hand ? 1 : 0; // eyes slide toward the shadow
    return { top: 'hoodie', c1: '#2A3966', c2: '#1F2B52', pants: C.navy, hair: 'messy', bags: 0.9 * (1 - P(t, T.hand, T.lights + 0.4)),
      skin: mix(C.skin, C.pale, f * 0.85), mood, pupilX: look, sweat: f > 0.6 && t < T.hand };
  }
  const MINTASK = { top: 'jacket', c1: C.blue, c2: C.blueD, pants: C.navy, hair: 'neat', skin: C.skin, mood: 'smile', standing: true };

  // ---------- props ----------
  function lantern(x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 3) * 0.08);
    seg(0, -70, 0, -30, C.line, 8); ctx.beginPath(); ctx.arc(0, -78, 16, Math.PI, 0); ctx.strokeStyle = C.line; ctx.lineWidth = 6; ctx.stroke();
    outlined(() => rr(-46, -34, 92, 20, 8), C.navy3);
    outlined(() => rr(-38, -16, 76, 104, 14), C.amberL);
    circle(0, 36, 22 + Math.sin(t * 9) * 2, C.white);
    outlined(() => rr(-46, 86, 92, 20, 8), C.navy3);
    ctx.restore();
  }
  function folder(x, y, s, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(rot);
    outlined(() => rr(-90, -66, 180, 132, 12), C.amber);
    fillRR(-90, -78, 70, 24, 8, C.amberD);
    fillRR(-60, -30, 120, 16, 6, C.white); fillRR(-60, 0, 90, 12, 6, 'rgba(255,255,255,0.7)');
    ctx.restore();
  }
  function paperPile(x, y, k, t) { // k: 0 messy -> 1 neat
    for (let i = 0; i < 9; i++) {
      const msr = (1 - k);
      const rot = (rnd(i + 20) - 0.5) * 0.7 * msr + Math.sin(t * 4 + i) * 0.03 * msr * (t < T.reveal ? 1 : 0);
      const dx = (rnd(i + 40) - 0.5) * 70 * msr, yy = y - i * lerp(18, 12, k);
      ctx.save(); ctx.translate(x + dx, yy); ctx.rotate(rot);
      fillRR(-95, -10, 190, 20, 3, i % 2 ? C.paper : '#D8E0EF'); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,20,48,0.5)'; rr(-95, -10, 190, 20, 3); ctx.stroke();
      ctx.restore();
    }
    if (k < 0.5) { ctx.save(); ctx.translate(x + 30, y - 175); ctx.rotate(0.3); fillRR(-50, -30, 100, 60, 4, C.paper); text('revisi', 0, 12, 26, C.amberD, { stroke: false, shadow: false, weight: 800 }); ctx.restore(); }
    if (k > 0) {
      ctx.globalAlpha = k;
      fillRR(x - 20, y - 130, 40, 40, 6, C.amber);
      circle(x + 80, y - 150, 30 * E.outBack(k), C.blue); tick(x + 80, y - 150, 34, C.white, 7);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- the shadow monster (on the wall) ----------
  function monster(t, s, menace, eyesOnly) {
    if (s <= 0.01) return;
    const bx = 290, by = 1190;
    ctx.save(); ctx.translate(bx, by);
    const sq = 1 + Math.sin(t * 2.2) * 0.03;
    ctx.scale(s / sq, s * sq);
    const col = 'rgba(3,6,18,0.92)';
    if (!eyesOnly) {
      // paper-sheet body layers
      for (let i = 0; i < 9; i++) {
        const w = 380 - i * 14 + Math.sin(t * 3 + i) * 10, h = 70;
        ctx.save(); ctx.translate(Math.sin(t * 1.7 + i * 0.8) * 10, -i * 62 - 40); ctx.rotate(Math.sin(t * 1.3 + i) * 0.06);
        fillRR(-w / 2, -h / 2, w, h, 14, col); ctx.restore();
      }
      // sheets sticking out on top (spiky "hair")
      for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(-120 + k * 60, -580); ctx.rotate(-0.5 + k * 0.25 + Math.sin(t * 2 + k) * 0.1); fillRR(-26, -110, 52, 120, 6, col); ctx.restore(); }
      // reaching arms: chains of sheets
      for (const side of [-1, 1]) {
        const reach = menace;
        let x = side * 170, y = -360;
        for (let k = 0; k < 7; k++) {
          const a = side > 0 ? lerp(-0.4, -0.9, reach) + Math.sin(t * 2.5 + k * 0.7) * 0.18 : lerp(-2.6, -2.3, reach) + Math.sin(t * 2.5 + k * 0.7) * 0.18;
          x += Math.cos(a) * 62 * (side > 0 ? 1 + reach * 0.9 : 0.8); y += Math.sin(a) * 62 * 0.6;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a); fillRR(-36, -24, 72, 48, 8, col); ctx.restore();
        }
        // crumpled-paper claw
        for (let f = 0; f < 3; f++) { ctx.save(); ctx.translate(x, y); ctx.rotate((side > 0 ? -0.6 : -2.5) + (f - 1) * 0.5 + Math.sin(t * 6 + f) * 0.15); fillRR(10, -10, 70, 20, 10, col); ctx.restore(); }
      }
      // "revisi" stamped faintly on the body
      ctx.save(); ctx.rotate(-0.08); ctx.globalAlpha = 0.25; text('revisi', 0, -170, 70, '#2B3E7A', { stroke: false, shadow: false }); ctx.restore();
      // mouth: lighter cut-out with paper-clip fangs
      ctx.beginPath(); ctx.moveTo(-90, -330);
      for (let k = 0; k <= 8; k++) ctx.lineTo(-90 + k * 22.5, -330 + (k % 2 ? 26 : 0) + menace * 20 * (k % 2));
      ctx.lineTo(90, -300); ctx.quadraticCurveTo(0, -250 + menace * 30, -90, -300); ctx.closePath();
      ctx.fillStyle = 'rgba(60,90,170,0.55)'; ctx.fill();
    } else {
      // glowing googly eyes (drawn above the darkness)
      const blink = ((t + 0.4) % 2.7) < 0.12 ? 0.15 : 1;
      for (const e of [-70, 70]) {
        ctx.save(); ctx.translate(e, -430);
        ctx.shadowColor = 'rgba(156,192,255,0.9)'; ctx.shadowBlur = 30;
        ell(0, 0, 44, 48 * blink, '#DCE7FF');
        ctx.shadowBlur = 0;
        const lx = Math.sin(t * 1.1) * 12 + 14, ly = Math.cos(t * 1.7) * 8 + 8;
        if (blink > 0.5) circle(lx, ly, 17, C.amber), circle(lx, ly, 8, C.navy2);
        ctx.restore();
        // angry brows
        ctx.save(); ctx.translate(e, -490); ctx.rotate(e < 0 ? 0.35 : -0.35); fillRR(-46, -10, 92, 20, 10, 'rgba(3,6,18,0.95)'); ctx.restore();
      }
    }
    ctx.restore();
  }
  const monsterScale = t => {
    if (t < T.shrink0) return lerp(0.42, 1.38, E.inOutCubic(P(t, 4, 23.5))) * (1 + 0.04 * heartPulse(t));
    return lerp(1.38, 0, E.inCubic(P(t, T.shrink0, T.poof)));
  };
  const menace = t => clamp(P(t, 6, 23.5) * (1 - P(t, T.reveal, T.reveal + 0.6)));

  // ---------- wide room shot ----------
  function camWide(t) {
    const tilt = t < T.reveal ? -0.12 + Math.sin(t * 0.6) * 0.012 : -0.12 * (1 - E.outElastic(P(t, T.reveal + 0.15, T.reveal + 1.4)));
    const push = t < T.reveal ? lerp(1.12, 1.24, P(t, 4, 24)) : lerp(1.24, 1.12, E.inOutCubic(P(t, T.reveal, T.reveal + 1.5)));
    const shake = t >= T.reveal && t < T.reveal + 0.3 ? (1 - (t - T.reveal) / 0.3) * 16 : 0;
    const f = Math.floor(t * 60);
    ctx.translate(540 + (rnd(f) - 0.5) * shake, 960 + (rnd(f + 3) - 0.5) * shake); ctx.rotate(tilt); ctx.scale(push, push); ctx.translate(-560, -840);
  }
  function wideShot(t) {
    ctx.save();
    camWide(t);
    const wm = warm(t);
    // wall + floor (oversized so the dutch angle never shows an edge)
    ctx.fillStyle = mix('#141E40', '#F2D9A6', wm * 0.85); ctx.fillRect(-500, -500, 2080, 1700);
    ctx.fillStyle = mix('#0B1230', '#C99A5A', wm * 0.8); ctx.fillRect(-500, 1200, 2080, 1300);
    // wallpaper stripes
    ctx.fillStyle = `rgba(255,255,255,${0.03 + wm * 0.05})`; for (let x = -500; x < 1600; x += 120) ctx.fillRect(x, -500, 50, 1700);
    // poster + shelf
    fillRR(70, 640, 200, 260, 8, mix('#1D2A55', C.blue, wm)); circle(170, 730, 50, mix('#2A3966', C.amber, wm)); fillRR(100, 830, 140, 18, 6, mix('#2A3966', C.white, wm));
    // clock
    ctx.save(); ctx.translate(655, 560); ctx.scale(0.72, 0.72); clock(0, 0, t, wm); ctx.restore();
    // door
    door(t, wm);
    // monster body (shadow on the wall)
    monster(t, monsterScale(t), menace(t), false);
    // MinTask
    if (t >= T.creak) mintaskInRoom(t);
    // student
    const st = studentLook(t);
    const jump = t >= T.reveal && t < T.reveal + 0.5 ? -Math.sin(P(t, T.reveal, T.reveal + 0.5) * Math.PI) * 70 : 0;
    const laugh = t >= T.lights - 0.6 ? Math.abs(Math.sin(t * 16)) * 10 : 0;
    const tremble = fear(t) > 0.5 && t < T.reveal ? Math.sin(t * 60) * 3 * fear(t) : 0;
    ctx.save(); ctx.translate(520 + tremble, 865 + jump - laugh); ctx.scale(0.95, 0.95);
    st.headRot = t >= T.lights - 0.6 ? -0.1 + Math.sin(t * 8) * 0.04 : 0;
    st.arms = t >= T.lights - 0.6
      ? [{ pts: [[-160, 210], [-200, 420], [-90, 470]] }, { pts: [[160, 210], [200, 420], [90, 470]] }]       // holding belly, laughing
      : [{ pts: [[-160, 210], [-190, 400], [-120, 520]] }, { pts: [[160, 210], [190, 400], [120, 520]] }];
    person(st, t);
    ctx.restore();
    // desk
    ctx.fillStyle = mix('#1B2650', '#8A5A2E', wm * 0.9); ctx.fillRect(-500, 1255, 2080, 1300);
    ctx.fillStyle = mix('#28366A', '#B07A44', wm * 0.9); ctx.fillRect(-500, 1245, 2080, 22);
    // laptop (back towards camera)
    outlined(() => { ctx.beginPath(); ctx.moveTo(400, 1080); ctx.lineTo(680, 1080); ctx.lineTo(690, 1252); ctx.lineTo(390, 1252); ctx.closePath(); }, mix('#26325C', '#9AA6C4', wm));
    circle(540, 1160, 18, `rgba(156,192,255,${0.6 - wm * 0.3})`);
    // paper pile + folder hand-off + phone
    paperPile(220, 1240, tidy(t), t);
    if (t >= T.hand) { const k = E.outBack(P(t, T.hand, T.hand + 0.4)); folder(lerp(880, 720, k), lerp(1060, 1215, k), 0.8, -0.1); }
    phoneOnDesk(t, wm);
    // darkness + lights
    lighting(t);
    // monster eyes glow through the dark
    monster(t, monsterScale(t), menace(t), true);
    ctx.restore();
  }
  function clock(x, y, t, wm) {
    circle(x, y, 96, mix('#0B1230', C.navy, wm)); circle(x, y, 84, mix('#D8E0F0', C.white, wm));
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; seg(x + Math.cos(a) * 68, y + Math.sin(a) * 68, x + Math.cos(a) * 78, y + Math.sin(a) * 78, C.navy, 6); }
    const mins = t < T.reveal ? 59 * Math.pow(P(t, 0, 23.5), 1.25) : 59 + P(t, T.reveal, 40) * 8;
    const hrs = 23 + mins / 60;
    const ma = mins / 60 * TAU - Math.PI / 2, ha = (hrs % 12) / 12 * TAU - Math.PI / 2;
    seg(x, y, x + Math.cos(ha) * 42, y + Math.sin(ha) * 42, C.navy, 10);
    seg(x, y, x + Math.cos(ma) * 64, y + Math.sin(ma) * 64, C.navy, 7);
    const sa = Math.floor(t * 2) / 120 * TAU * 4 - Math.PI / 2;  // ticks every 0.5 s
    seg(x, y, x + Math.cos(sa) * 72, y + Math.sin(sa) * 72, C.amberD, 3);
    circle(x, y, 8, C.navy);
  }
  function door(t, wm) {
    const x0 = 760, x1 = 990, y0 = 450, y1 = 1200, o = doorOpen(t);
    fillRR(x0 - 22, y0 - 22, x1 - x0 + 44, y1 - y0 + 22, 6, mix('#0A1128', '#7A5530', wm));
    // doorway (hallway light behind)
    ctx.fillStyle = o > 0 ? mix('#2B2A33', '#FFE2A3', clamp(o * 2)) : '#060A1A'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (o > 0 && t < T.reveal) { // silhouette in the gap
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
      ctx.translate(875, 545); ctx.scale(0.6, 0.6); ctx.globalAlpha = 0.95;
      ell(0, 0, 105, 122, '#1A1422'); fillRR(-178, 152, 356, 940, 60, '#1A1422');
      ctx.restore();
    }
    // the door panel swings towards the hinge (right)
    const pw = (x1 - x0) * (1 - o * 0.85);
    ctx.fillStyle = mix('#1A2550', '#A9763F', wm); ctx.fillRect(x1 - pw, y0, pw, y1 - y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 6;
    if (pw > 60) { ctx.strokeRect(x1 - pw + 30, y0 + 50, pw - 60, 260); ctx.strokeRect(x1 - pw + 30, y0 + 360, pw - 60, 300); }
    circle(x1 - pw + 34, 860, 14, mix('#3A4A7A', C.amber, wm));
    // light leaking under the door before it opens
    const leak = P(t, 22.4, 23.6) * (o < 0.05 ? 1 : 0);
    if (leak > 0) { ctx.fillStyle = `rgba(255,215,122,${0.8 * leak})`; ctx.fillRect(x0, y1 - 8, x1 - x0, 8); }
  }
  function mintaskInRoom(t) {
    const o = doorOpen(t);
    if (t < T.reveal) return;
    const w = E.inOutCubic(P(t, T.walk0, T.walk1));
    const x = lerp(875, 870, w), y = lerp(545, 760, w), s = lerp(0.6, 0.8, w);
    const step = t > T.walk0 && t < T.walk1 ? Math.sin((t - T.walk0) * 9) : 0;
    ctx.save();
    if (w <= 0) { ctx.beginPath(); ctx.rect(760, 300, 230, 900); ctx.clip(); }
    ctx.translate(x, y - Math.abs(step) * 12); ctx.scale(s, s);
    const pose = t < T.reveal + 0.8 ? 1 : 0;   // "ta-da" pose right at the reveal
    const handing = t >= T.hand - 0.4;
    person({ ...MINTASK, step,
      arms: [
        { pts: [[-160, 210], [-260, 120 - pose * 60], [-230, -60 - pose * 80]] },                         // lantern raised
        handing ? { pts: [[160, 210], [80, 380], [-60, 420]] } : { pts: [[160, 210], [200, 400], [130, 470]] },
      ] }, t);
    lantern(-230, -150 - pose * 80, 1.1, t);
    if (!handing) folder(150, 430, 0.95, 0.2);
    ctx.restore();
  }
  function phoneOnDesk(t, wm) {
    const buzz = (t > 4 && t < 4.6) ? Math.sin(t * 90) * 4 : 0;
    ctx.save(); ctx.translate(840 + buzz, 1300); ctx.rotate(-0.15);
    fillRR(-60, -20, 120, 40, 10, C.navy2); fillRR(-52, -14, 104, 28, 6, t < T.lights ? '#1D3C86' : '#28324F');
    ctx.restore();
  }
  function lighting(t) {
    const wm = warm(t);
    const d = dctx; d.setTransform(ctx.getTransform()); d.globalCompositeOperation = 'source-over';
    d.clearRect(-2000, -2000, 6000, 6000);
    const darkness = lerp(0.82, 0.0, wm);
    d.fillStyle = `rgba(2,5,18,${darkness})`; d.fillRect(-600, -600, 2300, 3200);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(530, 950, 520, 0.95);               // laptop light on face + wall behind
    hole(330, 720, 760, 0.85);               // wall wash where the shadow lives
    hole(840, 1300, 180, 0.8);               // phone
    const o = doorOpen(t);
    if (o > 0) hole(875, 800, 300 + 500 * o, clamp(o * 1.5));
    if (t > 22.4) hole(875, 1200, 260, 0.7 * P(t, 22.4, 23.6));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkC, 0, 0); ctx.restore();
    // coloured light
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, c) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    const flick = 0.85 + 0.15 * rnd(Math.floor(t * 12));
    glow(530, 1060, 460, `rgba(40,80,190,${0.45 * flick * (1 - wm)})`);
    if (o > 0) glow(875, 700, 520, `rgba(255,170,60,${0.35 * clamp(o * 1.4)})`);
    if (t >= T.reveal) { const w = E.inOutCubic(P(t, T.walk0, T.walk1)); glow(lerp(737, 686, w), lerp(455, 568, w), 360, `rgba(255,182,39,${0.4})`); }
    ctx.restore();
  }

  // ---------- close-ups ----------
  function phoneShot(t) {
    ctx.fillStyle = '#060A18'; ctx.fillRect(0, 0, W, H);
    // desk grain
    for (let i = 0; i < 18; i++) { ctx.fillStyle = `rgba(30,50,110,${0.08 + rnd(i) * 0.06})`; ctx.fillRect(-100, 600 + i * 80 + rnd(i + 3) * 30, 1300, 6); }
    const buzz = (t < 1.1 || (t > 1.8 && t < 2.6)) ? 1 : 0;
    const f = Math.floor(t * 60), j = buzz * 9;
    ctx.save(); ctx.translate(540 + (rnd(f) - 0.5) * j * 2, 1180 + (rnd(f + 5) - 0.5) * j); ctx.rotate(-0.09 + (rnd(f + 9) - 0.5) * 0.02 * buzz);
    const zoom = 1 + 0.05 * P(t, 0, 4); ctx.scale(zoom, zoom);
    // glow on the desk
    const g = ctx.createRadialGradient(0, 0, 100, 0, 0, 760); g.addColorStop(0, 'rgba(47,107,211,0.5)'); g.addColorStop(1, 'rgba(47,107,211,0)'); ctx.fillStyle = g; ctx.fillRect(-900, -900, 1800, 1800);
    fillRR(-250, -470, 500, 940, 60, '#05070F'); fillRR(-232, -452, 464, 904, 46, '#0D1A40');
    const lg = ctx.createLinearGradient(0, -452, 0, 452); lg.addColorStop(0, '#1B3E8F'); lg.addColorStop(1, '#0A1636'); ctx.fillStyle = lg; rr(-232, -452, 464, 904, 46); ctx.fill();
    fillRR(-60, -440, 120, 24, 12, '#05070F');
    text('23.00', 0, -210, 130, C.white, { stroke: false, shadow: false, weight: 600 });
    text('senin, 13 oktober', 0, -150, 30, 'rgba(255,255,255,0.7)', { stroke: false, shadow: false, weight: 600 });
    // notification card
    const nc = E.outBack(P(t, -0.05, 0.25));
    withScale(0, 20, 0.85 + 0.15 * nc, () => {
      fillRR(-210, -60, 420, 170, 28, 'rgba(238,242,250,0.95)');
      circle(-150, -2, 30, C.blue); text('d', -150, 10, 34, C.white, { stroke: false, shadow: false });
      text('dosen', -105, 6, 32, C.navy, { stroke: false, shadow: false, align: 'left', weight: 800 });
      text('sekarang', 190, 4, 22, '#6B7A99', { stroke: false, shadow: false, align: 'right', weight: 600 });
      text('revisi bab 3, besok pagi', -185, 72, 31, C.navy, { stroke: false, shadow: false, align: 'left', weight: 600, maxW: 370 });
    });
    ctx.restore();
    // vibration arcs
    if (buzz) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(540 + s * (330 + k * 34), 1180, 70 + k * 30, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6);
      ctx.strokeStyle = `rgba(156,192,255,${0.7 - k * 0.2})`; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
    }
    // hook text (visible from frame 0)
    const s = 1 + 0.08 * (1 - E.outCubic(P(t, 0, 0.25)));
    withScale(540, 400, s, () => {
      text('jam 23.00.', 540, 360, 140, C.white, { sw: 22 });
      text('satu notifikasi.', 540, 500, 112, C.amber, { sw: 20 });
    });
  }

  function screenShot(t) {
    ctx.save(); ctx.translate(540, 960); ctx.rotate(0.07 + Math.sin(t) * 0.01); ctx.scale(1.12 + P(t, T.wideA, T.screen) * 0.08, 1.12 + P(t, T.wideA, T.screen) * 0.08); ctx.translate(-540, -960);
    ctx.fillStyle = '#0A1330'; ctx.fillRect(-200, -200, 1480, 2320);
    // editor chrome
    fillRR(60, 260, 960, 1400, 20, '#1A2A5C');
    fillRR(60, 260, 960, 90, 20, C.blue); text('bab 3 - revisi.docx', 540, 318, 32, C.white, { stroke: false, shadow: false, weight: 600 });
    for (let k = 0; k < 6; k++) fillRR(100 + k * 90, 370, 60, 30, 8, '#2A3D78');
    // page
    fillRR(150, 430, 780, 1140, 8, '#CFDAF0');
    text('bab 3', 220, 540, 56, C.navy, { stroke: false, shadow: false, align: 'left' });
    text('hasil dan pembahasan', 220, 600, 34, '#3A4C7E', { stroke: false, shadow: false, align: 'left', weight: 600 });
    const on = Math.floor(t * 2) % 2 === 0;
    if (on) fillRR(222, 650, 8, 60, 2, C.navy);
    // status bar
    fillRR(60, 1600, 960, 60, 0, '#13214A');
    text('0 kata', 150, 1640, 28, C.amber, { stroke: false, shadow: false, align: 'left', weight: 600 });
    text('23.47', 940, 1640, 28, C.white, { stroke: false, shadow: false, align: 'right', weight: 600 });
    // a shadow claw creeps over the screen
    const k = E.inOutCubic(P(t, 9.6, 11.5));
    for (let f = 0; f < 3; f++) { ctx.save(); ctx.translate(-160 + k * 420, 900 + f * 70); ctx.rotate(-0.2 + f * 0.2); fillRR(-300, -24, 300 + f * 30, 48, 24, 'rgba(3,6,18,0.85)'); ctx.restore(); }
    ctx.restore();
    // blue screen light + vignette
    const g = ctx.createRadialGradient(540, 960, 300, 540, 960, 1200); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,5,18,0.8)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function faceShot(t) {
    ctx.fillStyle = '#060B1E'; ctx.fillRect(0, 0, W, H);
    const k = P(t, T.wideB, T.face);
    ctx.save(); ctx.translate(540, 1000); ctx.rotate(-0.1); const z = 3.1 + k * 0.4; ctx.scale(z, z);
    const st = studentLook(t);
    st.pupilX = -0.9 + Math.sin(t * 7) * 0.2 * (t > 17 ? 1 : 0);   // eyes dart to the wall
    st.arms = [];
    person(st, t);
    ctx.restore();
    // monster shadow creeping in from the left edge
    const m = E.inOutCubic(P(t, 16.3, 18.5));
    ctx.fillStyle = 'rgba(3,6,18,0.9)';
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(-200 + m * 260, 300 + i * 260); ctx.rotate(0.3 - i * 0.12); fillRR(-260, -60, 300, 120, 30, 'rgba(3,6,18,0.9)'); ctx.restore(); }
    // under-light from the laptop + heartbeat vignette
    const g = ctx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, 'rgba(47,107,211,0.45)'); g.addColorStop(0.5, 'rgba(47,107,211,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const hp = heartPulse(t);
    const v = ctx.createRadialGradient(540, 960, 380 - hp * 80, 540, 960, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(2,5,18,${0.75 + hp * 0.2})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    text('dug. dug. dug.', 540, 1760, 64, C.white, { sw: 12, alpha: 0.5 + hp * 0.5 });
  }

  // ---------- on-screen captions ----------
  function captions(t) {
    if (t >= T.screen && t < T.wideB) {
      const p = E.outBack(P(t, T.screen + 0.3, T.screen + 0.6));
      withScale(540, 330, p, () => { text('revisinya...', 540, 300, 96, C.white, { sw: 16 }); text('bergerak?', 540, 420, 110, C.amber, { sw: 18 }); });
    }
    if (t >= 21.8 && t < T.reveal) {
      const a = P(t, 21.8, 22.3);
      text('...ada yang datang.', 540, 330, 84, C.white, { sw: 14, alpha: a });
    }
    if (t >= T.reveal && t < T.lights) {
      withScale(540, 300, E.outBack(P(t, T.reveal + 0.1, T.reveal + 0.4)), () => text('plot twist:', 540, 300, 104, C.amber, { sw: 18 }));
      withScale(540, 420, E.outBack(P(t, T.reveal + 0.5, T.reveal + 0.8)), () => text('yang datang mintask.', 540, 420, 90, C.white, { sw: 16, maxW: 1000 }));
      if (t > T.poof) { const k = P(t, T.poof, T.poof + 0.5); text('monsternya jadi rapi.', 540, 520, 54, C.amberL, { sw: 10, alpha: k, weight: 800 }); }
    }
    if (t >= T.lights && t < T.brand) {
      withScale(540, 330, E.outBack(P(t, T.lights + 0.15, T.lights + 0.45)), () => { text('revisi bab 3?', 540, 300, 96, C.navy, { stroke: C.white, sw: 18, shadow: false }); text('aman.', 540, 430, 130, C.blue, { stroke: C.white, sw: 22, shadow: false }); });
    }
  }

  // ---------- end card ----------
  function endCard(t) {
    const s = T.brand;
    const g = ctx.createRadialGradient(540, 820, 50, 540, 820, 1300); g.addColorStop(0, '#2459B8'); g.addColorStop(1, C.blue);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // warm lantern glow remains as a friendly nod
    const lg = ctx.createRadialGradient(540, 820, 0, 540, 820, 600); lg.addColorStop(0, 'rgba(255,182,39,0.18)'); lg.addColorStop(1, 'rgba(255,182,39,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    const lp = E.outBack(P(t, s + 0.15, s + 0.55));
    withScale(540, 800, lp * (1 + 0.015 * Math.sin(t * 4)), () => ctx.drawImage(mark, 540 - 210, 800 - 210, 420, 420));
    withScale(540, 1140, E.outBack(P(t, s + 0.5, s + 0.85)), () => text('taskkora', 540, 1180, 150, C.white, { stroke: false, shadow: C.blueD }));
    withScale(540, 1320, E.outBack(P(t, s + 0.9, s + 1.25)), () => {
      ctx.font = F(800, 52); const w = ctx.measureText('ada task? taskkora-in aja.').width + 80;
      fillRR(540 - w / 2, 1270, w, 100, 50, C.amber);
      text('ada task? taskkora-in aja.', 540, 1338, 52, C.navy, { stroke: false, shadow: false, weight: 800 });
    });
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.3;
    ctx.font = F(600, 30); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.white;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
    ctx.fillText('@taskkora__', 1040, 1872);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (t < T.hook) phoneShot(t);
    else if (t < T.wideA) wideShot(t);
    else if (t < T.screen) screenShot(t);
    else if (t < T.wideB) wideShot(t);
    else if (t < T.face) faceShot(t);
    else if (t < T.brand) wideShot(t);
    else endCard(t);
    // iris wipe into the brand screen
    if (t >= T.brand && t < T.brand + 0.35) {
      const k = E.outCubic(P(t, T.brand, T.brand + 0.35));
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(540, 800, 2200 * k, 0, TAU, true); ctx.clip();
      ctx.save(); ctx.translate(0, 0); wideShot(t); ctx.restore(); ctx.restore();
    }
    if (t < T.brand) {
      captions(t);
      // hard-cut flash frames (horror pacing) + the reveal flash
      for (const c of [T.hook, T.wideA, T.screen, T.wideB, T.face]) { const d = t - c; if (d >= 0 && d < 0.05) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); } }
      const rd = t - T.reveal; if (rd >= 0 && rd < 0.12) { ctx.fillStyle = `rgba(255,240,210,${0.8 * (1 - rd / 0.12)})`; ctx.fillRect(0, 0, W, H); }
      // film grain, stronger in the dark
      ctx.save(); ctx.globalAlpha = 0.07 * (1 - warm(t) * 0.7); ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(grain[Math.floor(t * 24) % 4], 0, 0, W, H); ctx.restore();
    }
    // the very first frame: impact flash on the phone shot
    if (t < 0.08) { ctx.fillStyle = `rgba(156,192,255,${0.25 * (1 - t / 0.08)})`; ctx.fillRect(0, 0, W, H); }
    watermark();
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
