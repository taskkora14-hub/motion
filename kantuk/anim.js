/* "Level kantuk kelas jam 7 pagi." — 40s, 1080x1920, playful flat 2D cartoon.
 * A student at a 7 a.m. lecture slides through five sleepiness levels, tracked by a meter
 * on the left, until the lecturer asks "ada pertanyaan?". Every frame is a pure function
 * of time; shared timing lives in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, TAU = Math.PI * 2;
  const TL = window.KANTUK_TL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueHi: '#2F63C4', blueLo: '#123A80', navy: '#0E1A44', white: '#FFFFFF', paper: '#F7F9FD',
    wall: '#E4ECFA', wall2: '#D2DFF4', amber: '#FFB627', amberLo: '#E09A10', amberHi: '#FFD27A',
    skin: '#FFD3B0', skinLo: '#F2B48C', cheek: '#FF9F80', sky: '#9CC0FF', board: '#F4F7FC',
  };
  const FONT = '"Fredoka", sans-serif';
  const INK = 7;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: x => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);

  const ready = Promise.all([document.fonts.load(`700 60px ${FONT}`), document.fonts.load(`600 60px ${FONT}`)]).then(() => document.fonts.ready);

  // ---------- drawing helpers ----------
  function ink(fill, lw = INK, stroke = C.navy) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const ell = (x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
  function line(pts, w = INK, col = C.navy) {
    ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]);
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function text(str, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 700} ${size}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = (o.spacing ?? 0) + 'px';
    const w = ctx.measureText(str).width, max = o.maxW || 960;
    ctx.translate(x, y); if (w > max) ctx.scale(max / w, max / w);
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.rot) ctx.rotate(o.rot);
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.outline) { ctx.lineWidth = o.outlineW || 14; ctx.strokeStyle = o.outline; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
    ctx.fillStyle = color; ctx.fillText(str, 0, 0);
    ctx.restore();
    return Math.min(w, max);
  }

  // =====================================================================
  // CHARACTER STATE
  const DEFAULT = {
    headDY: 0, headDX: 0, rot: 0, squash: 1, bodyDY: 0,
    eyes: 'normal', open: 1, look: [0, 0], brow: 0, mouth: 'smile', mouthOpen: 0,
    hair: 'normal', drool: 0, snot: 0, zzz: 0, write: 0, pencil: 'hand', slump: 0, sweat: 0, blush: 0.6, bang: 0,
  };
  const lvlLook = { 1: { eyes: 'normal', mouth: 'smile', write: 1 }, 2: { eyes: 'heavy', open: 0.42, mouth: 'flat', write: 0.35, brow: -0.4 } };

  function sleepyPose(k, t) { // static pose for level k (used in the grid and as base)
    const s = { ...DEFAULT };
    if (k === 1) Object.assign(s, { write: 1, mouth: 'smile', blush: 0.7 });
    if (k === 2) Object.assign(s, { eyes: 'heavy', open: 0.4, mouth: 'flat', write: 0.3, brow: -0.5 });
    if (k === 3) Object.assign(s, { eyes: 'heavy', open: 0.15, mouth: 'o', headDY: 55, rot: 0.12, brow: -0.6 });
    if (k === 4) Object.assign(s, { eyes: 'blank', mouth: 'slack', mouthOpen: 0.7, drool: 0.8, zzz: 0.7, slump: 0.6, headDY: 10, rot: Math.sin(t * 1.3) * 0.02 });
    if (k === 5) Object.assign(s, { eyes: 'closed', mouth: 'o', mouthOpen: 0.3, drool: 1, snot: 0.6 + 0.4 * Math.sin(t * Math.PI), zzz: 1, pencil: 'stuck', slump: 1 });
    return s;
  }

  function mainState(t) {
    const H0 = TL.HOOK, EN = TL.END;
    const s = { ...DEFAULT };
    // ---------------- hook ----------------
    if (t < 4) {
      if (t < H0.jolt) {
        Object.assign(s, { headDY: 300, squash: t < 0.12 ? 0.74 : 0.84, eyes: 'closed', mouth: 'o', mouthOpen: 0.3, rot: -0.05, zzz: 0, blush: 0.3 });
      } else if (t < 1.3) {
        const p = P(t, H0.jolt, H0.jolt + 0.45);
        Object.assign(s, { headDY: lerp(-90, 0, E.outElastic(p)), bodyDY: -30 * (1 - p), eyes: 'shock', hair: 'spiky', mouth: 'o', mouthOpen: 1, brow: 1, bang: 1 - P(t, 1.0, 1.3) });
      } else if (t < H0.smile) {
        const lk = Math.sin((t - H0.look) * 4.5) > 0 ? -16 : 16;
        Object.assign(s, { eyes: 'wide', look: [lk, 0], mouth: 'flat', sweat: 1, brow: 0.6 });
      } else Object.assign(s, { mouth: 'smile', sweat: 1 - P(t, 3.2, 3.6), write: t > 3.3 ? 1 : 0, blush: 0.8 });
      return s;
    }
    // ---------------- levels ----------------
    const k = TL.level(t);
    if (k >= 1 && t < EN.ask) {
      if (k === 1) Object.assign(s, { write: 1, mouth: 'smile', blush: 0.7, look: [10, 14] });
      if (k === 2) {
        Object.assign(s, { eyes: 'heavy', open: 0.42, mouth: 'flat', write: 0.35, brow: -0.4, look: [6, 16] });
        for (const b of TL.BLINKS) if (t >= b && t < b + 0.45) s.open = 0.42 * (1 - bump(t, b, b + 0.45));
        if (t >= TL.YAWN && t < TL.YAWN + 1.1) {
          const y = bump(t, TL.YAWN, TL.YAWN + 1.1);
          Object.assign(s, { mouth: 'yawn', mouthOpen: y, eyes: y > 0.3 ? 'squeeze' : 'heavy', headDY: -14 * y, rot: -0.05 * y, write: 0 });
        }
      }
      if (k === 3) {
        Object.assign(s, { eyes: 'heavy', open: 0.32, mouth: 'flat', brow: -0.5 });
        for (const n of TL.NODS) {
          if (t >= n.t0 && t < n.flop) { const p = E.inCubic(P(t, n.t0, n.flop)); Object.assign(s, { headDY: 70 * p, rot: 0.1 * p, open: 0.32 * (1 - p), mouth: 'o', mouthOpen: 0.25 * p }); }
          else if (t >= n.flop && t < n.up) Object.assign(s, { headDY: 150, rot: 0.2, open: 0, eyes: 'closed', mouth: 'o', mouthOpen: 0.3, squash: 0.95 });
          else if (t >= n.up && t < n.up + 0.45) { const p = P(t, n.up, n.up + 0.45); Object.assign(s, { headDY: lerp(-40, 0, E.outElastic(p)), eyes: 'wide', open: 1, brow: 0.7, mouth: 'o', mouthOpen: 0.4 }); }
        }
      }
      if (k === 4) Object.assign(s, sleepyPose(4, t), { drool: P(t, 22.4, 25) });
      if (k === 5) Object.assign(s, sleepyPose(5, t), { snot: snotAt(t) });
      return s;
    }
    // ---------------- question + wake ----------------
    if (t < EN.wake) return Object.assign(s, sleepyPose(5, t), { snot: snotAt(t) * (1 + 0.5 * P(t, EN.ask + 0.2, EN.wake)) });
    const p = P(t, EN.wake, EN.wake + 0.5);
    return Object.assign(s, { eyes: 'shock', hair: 'spiky', mouth: 'o', mouthOpen: 1, brow: 1, headDY: lerp(-110, 0, E.outElastic(p)), bodyDY: -40 * (1 - p), pencil: 'fly', bang: 1, sweat: 1 });
  }
  function snotAt(t) {
    const ph = ((t - TL.SNORE.start) / TL.SNORE.period) % 1;
    return 0.35 + 0.65 * Math.sin(Math.max(0, ph) * Math.PI);
  }

  // =====================================================================
  // CHARACTER DRAWING (origin: head centre at 560,1040; desk top at y 1440)
  const HX = 560, HY = 1040, HR = 168, DESK = 1440;

  function person(t, s, o = {}) {
    const by = s.bodyDY;
    // body (hoodie)
    ctx.beginPath();
    ctx.moveTo(HX - 230, DESK + 10); ctx.bezierCurveTo(HX - 240, 1260 + by, HX - 170, 1190 + by, HX, 1188 + by);
    ctx.bezierCurveTo(HX + 170, 1190 + by, HX + 240, 1260 + by, HX + 230, DESK + 10); ctx.closePath();
    ink(C.blue);
    line([[HX - 40, 1230 + by], [HX - 46, 1300 + by]], 6, C.white); line([[HX + 40, 1230 + by], [HX + 46, 1300 + by]], 6, C.white);
    ell(HX, 1205 + by, 90, 26); ink(C.blueHi, 6);                                      // hood collar
    // desk
    const dw = o.deskW || 940, dh = o.deskH || 420;
    rr(HX - 20 - dw / 2, DESK, dw, 60, 18); ink(C.amber);
    rr(HX - 20 - dw / 2, DESK, dw, 16, 10); ctx.fillStyle = C.amberHi; ctx.fill();
    rr(HX + 20 - dw / 2, DESK + 60, dw - 80, dh, 0); ctx.fillStyle = '#1B2C66'; ctx.fill();
    // notebook
    ctx.save(); ctx.translate(HX + 40, DESK + 6); ctx.rotate(-0.04);
    rr(-210, -34, 420, 52, 10); ink(C.paper, 6);
    line([[0, -34], [0, 18]], 4, C.sky);
    ctx.strokeStyle = 'rgba(24,74,161,0.35)'; ctx.lineWidth = 3;
    const written = o.written ?? 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-190, -22 + i * 12); ctx.lineTo(-190 + 170 * Math.min(1, written * (1 - i * 0.2)), -22 + i * 12); ctx.stroke(); }
    ctx.restore();
    // head
    head(t, s);
    // arms + hands on the desk
    const wr = s.write * Math.sin(t * 22) * 10, sl = s.slump;
    ctx.beginPath(); ctx.moveTo(HX - 190, 1270 + by); ctx.quadraticCurveTo(HX - 250, 1380, HX - 150 - 20 * sl, DESK - 4); ink(null, 64, C.navy);
    ctx.beginPath(); ctx.moveTo(HX - 190, 1270 + by); ctx.quadraticCurveTo(HX - 250, 1380, HX - 150 - 20 * sl, DESK - 4); ink(null, 50, C.blue);
    ell(HX - 145 - 20 * sl, DESK - 6, 44, 28); ink(C.skin, 6);
    const rhx = HX + 150 + wr + 40 * sl, rhy = DESK - 8 + 6 * sl;
    ctx.beginPath(); ctx.moveTo(HX + 190, 1270 + by); ctx.quadraticCurveTo(HX + 260, 1380, rhx, rhy); ink(null, 64, C.navy);
    ctx.beginPath(); ctx.moveTo(HX + 190, 1270 + by); ctx.quadraticCurveTo(HX + 260, 1380, rhx, rhy); ink(null, 50, C.blue);
    // pencil
    if (s.pencil === 'hand') pencil(rhx - 18, rhy - 52, -0.5 + Math.sin(t * 22) * 0.12 * s.write);
    else if (s.pencil === 'stuck') pencil(HX + 30, DESK - 70, 0.04 * Math.sin(t * 3));     // standing on its own, tip in the paper
    else if (s.pencil === 'fly') {
      const p = P(t, TL.END.wake, TL.END.wake + 0.6);
      if (p < 1) pencil(HX + 30 + 260 * p, DESK - 70 - 520 * p + 600 * p * p, p * 9);
    }
    ell(rhx, rhy, 42, 28); ink(C.skin, 6);
  }

  function pencil(x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    rr(-11, -60, 22, 112, 6); ink(C.amber, 6);
    rr(-11, -66, 22, 18, 5); ink('#FF8FA3', 6);
    ctx.beginPath(); ctx.moveTo(-11, 52); ctx.lineTo(11, 52); ctx.lineTo(0, 78); ctx.closePath(); ink('#FCE3C2', 6);
    ell(0, 74, 4, 5); ctx.fillStyle = C.navy; ctx.fill();
    ctx.restore();
  }

  function head(t, s) {
    ctx.save();
    ctx.translate(HX + s.headDX, HY + s.headDY + s.bodyDY);
    ctx.rotate(s.rot);
    ctx.scale(1 / Math.sqrt(s.squash), s.squash);
    // ears
    ell(-HR + 6, 18, 30, 40); ink(C.skin);
    ell(HR - 6, 18, 30, 40); ink(C.skin);
    // face
    ell(0, 0, HR, HR * 0.94); ink(C.skin);
    // hair
    ctx.beginPath();
    if (s.hair === 'spiky') {
      ctx.moveTo(-HR + 4, -10);
      const n = 9;
      for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI; const r = i % 2 ? HR + 70 : HR + 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.95 - 10); }
      ctx.lineTo(HR - 4, -10); ctx.quadraticCurveTo(0, -60, -HR + 4, -10);
    } else {
      ctx.moveTo(-HR + 2, -6);
      ctx.bezierCurveTo(-HR - 6, -HR * 1.2, HR + 6, -HR * 1.2, HR - 2, -6);
      ctx.quadraticCurveTo(HR * 0.55, -78, HR * 0.1, -96);
      ctx.quadraticCurveTo(-HR * 0.2, -62, -HR * 0.55, -86);
      ctx.quadraticCurveTo(-HR * 0.8, -50, -HR + 2, -6);
    }
    ctx.closePath(); ink(C.navy, INK);
    if (s.hair !== 'spiky') { ctx.beginPath(); ctx.moveTo(-20, -158); ctx.quadraticCurveTo(10, -215, 40, -190); ink(null, 9); }  // ahoge
    // cheeks
    ctx.save(); ctx.globalAlpha = s.blush;
    ell(-100, 58, 30, 18); ctx.fillStyle = C.cheek; ctx.fill(); ell(100, 58, 30, 18); ctx.fill(); ctx.restore();
    // eyes
    for (const side of [-1, 1]) eye(side * 62, 8, side, s, t);
    // brows
    for (const side of [-1, 1]) {
      const b = s.brow, y = -62 - 18 * Math.max(0, b);
      line([[side * 92, y + (b < 0 ? -10 * b : 0)], [side * 34, y - 6 * b - (b < 0 ? 14 * b : 0)]], 10);
    }
    mouth(s, t);
    // drool
    if (s.drool > 0) {
      ctx.beginPath(); ctx.moveTo(34, 104); ctx.quadraticCurveTo(40, 104 + 70 * s.drool, 30, 110 + 90 * s.drool);
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(156,192,255,0.9)'; ctx.lineCap = 'round'; ctx.stroke();
      ell(30, 112 + 90 * s.drool, 9, 11); ctx.fillStyle = 'rgba(156,192,255,0.95)'; ctx.fill();
    }
    // snot bubble
    if (s.snot > 0) {
      const r = 18 + 46 * s.snot;
      ell(-8, 58 + r * 0.2, r, r * 0.95); ctx.fillStyle = 'rgba(190,220,255,0.55)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(14,26,68,0.55)'; ctx.stroke();
      ell(-8 - r * 0.35, 58 - r * 0.25, r * 0.22, r * 0.14, -0.6); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    }
    // sweat
    if (s.sweat > 0) {
      ctx.save(); ctx.globalAlpha = s.sweat;
      ctx.beginPath(); ctx.moveTo(HR - 30, -90); ctx.quadraticCurveTo(HR - 6, -54, HR - 22, -40); ctx.quadraticCurveTo(HR - 46, -54, HR - 30, -90); ink(C.sky, 5);
      ctx.restore();
    }
    ctx.restore();
  }

  function eye(x, y, side, s, t) {
    const lx = s.look[0], ly = s.look[1];
    if (s.eyes === 'closed') { // sleepy arcs
      ctx.beginPath(); ctx.arc(x, y + 4, 30, 0.15 * Math.PI, 0.85 * Math.PI); ink(null, 9); return;
    }
    if (s.eyes === 'squeeze') { line([[x + side * 26, y - 16], [x - side * 14, y], [x + side * 26, y + 16]], 9); return; }  // > <
    const big = s.eyes === 'shock' ? 1.35 : s.eyes === 'wide' ? 1.15 : s.eyes === 'blank' ? 1.2 : 1;
    const rx = 34 * big, ry = 40 * big;
    ell(x, y, rx, ry); ink(C.white, 7);
    ctx.save(); ell(x, y, rx, ry); ctx.clip();
    const pr = s.eyes === 'blank' ? 6 : s.eyes === 'shock' ? 11 : 18;
    ell(x + lx, y + ly, pr, pr * 1.1); ctx.fillStyle = C.navy; ctx.fill();
    if (pr > 8) { ell(x + lx - 6, y + ly - 8, 6, 6); ctx.fillStyle = C.white; ctx.fill(); }
    if (s.eyes === 'heavy') { // eyelid comes down
      const lid = 1 - s.open;
      rr(x - rx - 4, y - ry - 4, rx * 2 + 8, (ry * 2 + 8) * lid + 2, 0); ctx.fillStyle = C.skinLo; ctx.fill();
      line([[x - rx, y - ry + (ry * 2) * lid], [x + rx, y - ry + (ry * 2) * lid]], 7);
    }
    ctx.restore();
    ell(x, y, rx, ry); ink(null, 7);
    if (s.eyes === 'blank') { // bags under the stare
      ctx.beginPath(); ctx.arc(x, y + ry + 4, rx * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(14,26,68,0.45)'; ctx.stroke();
    }
  }

  function mouth(s, t) {
    const y = 88;
    if (s.mouth === 'smile') { ctx.beginPath(); ctx.arc(0, y - 26, 40, 0.18 * Math.PI, 0.82 * Math.PI); ink(null, 9); return; }
    if (s.mouth === 'flat') { line([[-26, y], [26, y + 3]], 9); return; }
    if (s.mouth === 'o' || s.mouth === 'slack') {
      const o = s.mouthOpen;
      ell(0, y + 4, 16 + 12 * o, 10 + 26 * o); ink('#7A2E3A', 7);
      if (o > 0.5) { ell(0, y + 10 + 14 * o, 10 + 6 * o, 6 + 6 * o); ctx.fillStyle = '#FF8FA3'; ctx.fill(); }
      return;
    }
    if (s.mouth === 'yawn') {
      const o = s.mouthOpen;
      ell(0, y + 6, 26 + 28 * o, 14 + 52 * o); ink('#7A2E3A', 7);
      ell(0, y + 22 + 34 * o, 18 + 12 * o, 8 + 10 * o); ctx.fillStyle = '#FF8FA3'; ctx.fill();
    }
  }

  // ---------- FX ----------
  function zzz(t, x, y, amt, scale = 1) {
    if (amt <= 0) return;
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.55 + k / 3) % 1);
      const zx = x + ph * 90 * scale + Math.sin(ph * 6 + k) * 12, zy = y - ph * 150 * scale;
      text('z', zx, zy, (40 + 46 * ph) * scale, C.blue, { alpha: amt * Math.sin(ph * Math.PI), outline: C.white, outlineW: 10 });
    }
  }
  function bangs(x, y, amt, scale = 1) {
    if (amt <= 0) return;
    ctx.save(); ctx.globalAlpha = amt;
    for (const [dx, r] of [[-60, -0.3], [0, 0], [60, 0.3]]) {
      ctx.save(); ctx.translate(x + dx * scale, y); ctx.rotate(r); ctx.scale(scale, scale);
      rr(-9, -60, 18, 64, 8); ink(C.amber, 6); ell(0, 22, 10, 10); ink(C.amber, 6);
      ctx.restore();
    }
    ctx.restore();
  }
  function impact(t) {
    if (t > 0.55) return;
    const p = P(t, 0, 0.5);
    ctx.save(); ctx.translate(HX, DESK - 40);
    for (let k = 0; k < 8; k++) {
      const a = Math.PI + (k / 7) * Math.PI, r0 = 190 + 80 * p, r1 = r0 + 60 * (1 - p);
      line([[Math.cos(a) * r0, Math.sin(a) * r0 * 0.6], [Math.cos(a) * r1, Math.sin(a) * r1 * 0.6]], 10, C.amber);
    }
    ctx.restore();
    text('duk!', HX + 300, DESK - 210, 96 + 20 * (1 - p), C.amber, { outline: C.navy, outlineW: 14, rot: -0.15, alpha: 1 - P(t, 0.4, 0.55) });
  }

  // =====================================================================
  // CLASSROOM
  function classroom(t, k) {
    const g = ctx.createLinearGradient(0, 0, 0, DESK);
    g.addColorStop(0, C.wall); g.addColorStop(1, C.wall2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // window with the morning sun
    rr(840, 470, 200, 300, 18); ink('#BFD7FF');
    ell(930, 560, 50, 50); ctx.fillStyle = C.amber; ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.25; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.2; line([[930 + Math.cos(a) * 62, 560 + Math.sin(a) * 62], [930 + Math.cos(a) * 92, 560 + Math.sin(a) * 92]], 8, C.amber); } ctx.restore();
    rr(840, 470, 200, 300, 18); ink(null); line([[940, 470], [940, 770]], 7); line([[840, 620], [1040, 620]], 7);
    // whiteboard
    rr(215, 470, 600, 380, 18); ink(C.board, 9);
    rr(215, 470, 600, 380, 18); ctx.save(); ctx.clip();
    ctx.filter = k >= 2 ? `blur(${(k - 1) * 1.6}px)` : 'none';     // the board gets blurry as he gets sleepier
    text('kalkulus 1', 250, 530, 44, C.blue, { align: 'left', weight: 700 });
    text("f'(x) = lim h→0 …", 250, 600, 38, C.navy, { align: 'left', weight: 600, maxW: 560 });
    ctx.strokeStyle = 'rgba(14,26,68,0.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(250, 660 + i * 42); for (let x = 250; x < 250 + 300 + 80 * rnd(i); x += 24) ctx.lineTo(x, 660 + i * 42 + (x / 24 % 2 ? -8 : 8)); ctx.stroke(); }
    ctx.filter = 'none';
    ctx.restore();
    // clock on the board frame
    rr(600, 492, 150, 58, 14); ink(C.navy, 0); ctx.fillStyle = C.navy; ctx.fill();
    text(TL.CLOCK[Math.min(5, k)], 675, 522, 40, C.amber, { weight: 700 });
    // lecturer
    lecturer(t, k);
  }

  function lecturer(t, k) {
    const x = 730, y = 640;
    let talk = 0;
    for (const [w0, n] of TL.WAH) if (t >= w0 && t < w0 + n * 0.42) talk = Math.abs(Math.sin((t - w0) / 0.42 * Math.PI));
    const ask = t >= TL.END.ask && t < TL.END.grid;
    if (ask) talk = Math.abs(Math.sin((t - TL.END.ask) * 10)) * (t < TL.END.ask + 0.6 ? 1 : 0);
    // body
    ctx.beginPath(); ctx.moveTo(x - 80, 900); ctx.quadraticCurveTo(x - 80, 720, x, 715); ctx.quadraticCurveTo(x + 80, 720, x + 80, 900); ctx.closePath(); ink(C.navy, 6, '#060C24');
    ctx.beginPath(); ctx.moveTo(x - 22, 722); ctx.lineTo(x, 790); ctx.lineTo(x + 22, 722); ctx.closePath(); ctx.fillStyle = C.white; ctx.fill();
    // arm pointing at the board
    line([[x - 60, 760], [x - 140, 700 + Math.sin(t * 2) * 10]], 26, C.navy); ell(x - 146, 698 + Math.sin(t * 2) * 10, 14, 14); ink(C.skin, 5);
    // head
    ell(x, y, 56, 60); ink(C.skin, 6);
    ctx.beginPath(); ctx.arc(x, y - 18, 56, Math.PI * 1.05, Math.PI * 1.95); ink('#9AA6C4', 6);   // grey hair
    ell(x - 20, y, 14, 12); ink(C.white, 5); ell(x + 20, y, 14, 12); ink(C.white, 5); line([[x - 6, y], [x + 6, y]], 5);
    ell(x - 20, y + 1, 4, 4); ctx.fillStyle = C.navy; ctx.fill(); ell(x + 20, y + 1, 4, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 24, y + 24); ctx.quadraticCurveTo(x, y + 14, x + 24, y + 24); ink(null, 9, '#6B7590');     // moustache
    ell(x, y + 34, 10 + 4 * talk, 3 + 12 * talk); ink('#7A2E3A', 4);
    // "wah-wah" drifting away: smaller, fainter and blurrier every level
    for (const [w0, n] of TL.WAH) {
      if (t < w0 || t > w0 + n * 0.42 + 0.9) continue;
      const lv = TL.level(w0), far = (lv - 1) / 4;
      for (let i = 0; i < n; i++) {
        const ti = w0 + i * 0.42; if (t < ti) continue;
        const age = t - ti, a = (1 - P(age, 0.6, 1.2)) * lerp(1, 0.32, far);
        ctx.save(); ctx.filter = far > 0 ? `blur(${far * 3}px)` : 'none';
        text('wah', x + 70 + i * 62 + age * 30, y - 70 - i * 26 - age * 40, lerp(46, 28, far), C.navy, { alpha: a, rot: (i % 2 ? 0.2 : -0.15), outline: C.white, outlineW: 8 });
        ctx.restore();
      }
    }
  }

  // ---------- meter ----------
  function meterFill(t) {
    const EN = TL.END;
    if (t >= EN.wake) return 1 - E.outCubic(P(t, EN.wake, EN.wake + 0.35));
    let f = 0;
    TL.LEVELS.forEach((l0, i) => { if (t >= l0) f = lerp(i / 5, (i + 1) / 5, E.outElastic(P(t, l0, l0 + 0.8))); });
    if (t < 4) f = 0.03 + 0.02 * Math.sin(t * 20) * (t > 0.55 && t < 1.3 ? 1 : 0);
    return f;
  }
  function meter(t, k) {
    const x = 44, w = 100, top = 560, bot = 1330, h = bot - top;
    text('level', x + w / 2, top - 72, 34, C.navy, { weight: 700, maxW: 150 });
    text('kantuk', x + w / 2, top - 34, 34, C.navy, { weight: 700, maxW: 150 });
    rr(x, top, w, h, w / 2); ink(C.white, 8);
    const f = meterFill(t);
    ctx.save(); rr(x, top, w, h, w / 2); ctx.clip();
    const fy = bot - h * f;
    const g = ctx.createLinearGradient(0, bot, 0, top);
    g.addColorStop(0, C.sky); g.addColorStop(0.45, C.blue); g.addColorStop(0.8, C.amber); g.addColorStop(1, C.amberLo);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, bot + 10);
    for (let xx = x; xx <= x + w; xx += 8) ctx.lineTo(xx, fy + Math.sin(xx / 14 + t * 6) * 5);
    ctx.lineTo(x + w, bot + 10); ctx.closePath(); ctx.fill();
    // bubbles in the liquid
    for (let i = 0; i < 6; i++) { const ph = (t * 0.4 + rnd(i)) % 1, by = bot - ph * h * f; if (by > fy + 10) { ell(x + 20 + rnd(i + 3) * 64, by, 6, 6); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(); } }
    ctx.restore();
    rr(x, top, w, h, w / 2); ink(null, 8);
    for (let i = 1; i < 5; i++) { const yy = bot - h * i / 5; line([[x + w - 26, yy], [x + w, yy]], 6); }
    for (let i = 1; i <= 5; i++) text(String(i), x + w + 24, bot - h * (i - 0.5) / 5, 34, i <= k ? C.blue : 'rgba(14,26,68,0.35)', { weight: 700 });
    // level badge
    const pop = k > 0 ? 1 + 0.35 * (1 - E.outBack(P(t, TL.LEVELS[k - 1], TL.LEVELS[k - 1] + 0.35))) : 1;
    ctx.save(); ctx.translate(x + w / 2, bot + 78); ctx.scale(pop, pop);
    ell(0, 0, 62, 62); ink(k >= 4 ? C.amber : C.blue, 8);
    text(String(k), 0, 4, 64, k >= 4 ? C.navy : C.white, { weight: 700 });
    ctx.restore();
    // level-up sparkle
    if (k > 0) {
      const age = t - TL.LEVELS[k - 1];
      if (age >= 0 && age < 0.6) for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU, d = 30 + age * 220;
        ctx.save(); ctx.globalAlpha = 1 - age / 0.6; ctx.translate(x + w / 2 + Math.cos(a) * d, fy0(t) + Math.sin(a) * d);
        ctx.rotate(a); rr(-4, -14, 8, 28, 4); ctx.fillStyle = C.amber; ctx.fill(); ctx.restore();
      }
    }
    if (k === 5 && t < TL.END.wake) zzz(t, x + w / 2, top - 120, 0.8, 0.6);
  }
  const fy0 = t => 1330 - 770 * meterFill(t);

  // ---------- level title ----------
  function title(t, k) {
    const l0 = TL.LEVELS[k - 1], l1 = l0 + 6;
    const pin = E.outBack(P(t, l0, l0 + 0.35)), pout = E.inCubic(P(t, l1 - 0.25, l1));
    const s = pin * (1 - pout);
    if (s <= 0) return;
    ctx.save(); ctx.translate(540, 250); ctx.scale(s, s);
    ctx.font = `700 76px ${FONT}`; const w = ctx.measureText(`level ${k}`).width + 70;
    rr(-w / 2, -54, w, 108, 54); ink(C.amber, 8);
    text(`level ${k}`, 0, 4, 76, C.navy);
    ctx.restore();
    const s2 = E.outBack(P(t, l0 + 0.12, l0 + 0.5)) * (1 - pout);
    if (s2 > 0) text(TL.LABELS[k - 1], 540, 378, 74, C.navy, { scale: s2, outline: C.white, outlineW: 16 });
  }

  // =====================================================================
  // ENDING: question + everyone wakes
  function askBubble(t) {
    const EN = TL.END;
    if (t < EN.ask || t >= EN.grid) return;
    const s = E.outBack(P(t, EN.ask, EN.ask + 0.3)), shake = t < EN.ask + 0.6 ? Math.sin(t * 60) * 4 : 0;
    ctx.save(); ctx.translate(560 + shake, 330); ctx.scale(s, s);
    rr(-400, -100, 800, 200, 60); ink(C.white, 9);
    ctx.beginPath(); ctx.moveTo(110, 96); ctx.lineTo(170, 220); ctx.lineTo(210, 96); ink(C.white, 9);
    rr(-396, -96, 792, 190, 56); ctx.fillStyle = C.white; ctx.fill();
    text('ada pertanyaan?', 0, 6, 92, C.blue, { maxW: 740 });
    ctx.restore();
  }

  function grid(t) {
    const EN = TL.END;
    ctx.fillStyle = C.blue; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = C.white;
    for (let y = 40; y < H; y += 80) for (let x = 40 + (y / 80 % 2) * 40; x < W; x += 80) { ell(x, y, 5, 5); ctx.fill(); }
    ctx.restore();
    const woke = t >= EN.gridWake;
    const cells = [[190, 950], [540, 950], [890, 950], [365, 1400], [715, 1400]];
    cells.forEach(([cx, cy], i) => {
      const k = i + 1;
      const enter = E.outBack(P(t, EN.grid + i * 0.06, EN.grid + i * 0.06 + 0.35));
      if (enter <= 0) return;
      let s = sleepyPose(k, t);
      if (woke) {
        const p = P(t, EN.gridWake, EN.gridWake + 0.5);
        s = { ...DEFAULT, eyes: 'shock', hair: 'spiky', mouth: 'o', mouthOpen: 1, brow: 1, headDY: lerp(-120, 0, E.outElastic(p)), bodyDY: -40 * (1 - p), bang: 1, pencil: 'none', sweat: 1 };
      }
      if (k === 5 && !woke) s.snot = snotAt(t);
      const sc = 0.5 * enter;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-HX, -HY - 120);
      person(t, s, { written: 0.5, deskW: 620, deskH: 120 });
      if (!woke && k >= 4) zzz(t, HX + 120, HY - 180, 1, 1.4);
      if (woke) bangs(HX, HY - 260 + s.headDY, 1 - P(t, EN.gridWake + 1.6, EN.gridWake + 2.2), 1.6);
      ctx.restore();
      // label
      ctx.save(); ctx.translate(cx, cy + 250); ctx.scale(enter, enter);
      rr(-92, -32, 184, 64, 32); ink(C.amber, 6); text(`level ${k}`, 0, 3, 40, C.navy);
      ctx.restore();
    });
    // flash on the simultaneous wake
    if (t >= EN.gridWake && t < EN.gridWake + 0.15) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (t - EN.gridWake) / 0.15)})`; ctx.fillRect(0, 0, W, H); }
    // final question
    const p1 = E.outBack(P(t, EN.text, EN.text + 0.35)), p2 = E.outBack(P(t, EN.text + 0.18, EN.text + 0.55));
    if (p1 > 0) text('level berapa', 540, 330, 116, C.white, { scale: p1, outline: C.navy, outlineW: 18 });
    if (p2 > 0) text('kamu hari ini?', 540, 470, 116, C.amber, { scale: p2, outline: C.navy, outlineW: 18 });
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    const EN = TL.END;
    if (t < EN.grid) {
      const k = TL.level(t);
      const kk = t >= EN.ask ? 5 : k;
      classroom(t, kk);
      meter(t, kk);
      const s = mainState(t);
      person(t, s, { written: t < 4 ? 0.2 : clamp((t - 4) / 12, 0.2, 1) });
      if (s.zzz > 0) zzz(t, HX + 175, HY - 90 + s.headDY, s.zzz);
      if (s.bang > 0) bangs(HX, HY - 260 + s.headDY + s.bodyDY, s.bang);
      if (t < 0.6) impact(t);
      // sleepy eyelid vignette: closes in a little more every level, and on every blink
      let lid = [0, 0, 0.05, 0.1, 0.16, 0.22][kk];
      for (const b of TL.BLINKS) lid += 0.12 * bump(t, b, b + 0.45);
      for (const n of TL.NODS) lid += 0.1 * bump(t, n.t0 + 0.3, n.up + 0.1);
      if (t >= EN.wake) lid = 0;
      if (lid > 0) {
        const hh = H * lid;
        let g = ctx.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, 'rgba(14,26,68,0.55)'); g.addColorStop(1, 'rgba(14,26,68,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, hh);
        g = ctx.createLinearGradient(0, H, 0, H - hh); g.addColorStop(0, 'rgba(14,26,68,0.55)'); g.addColorStop(1, 'rgba(14,26,68,0)');
        ctx.fillStyle = g; ctx.fillRect(0, H - hh, W, hh);
      }
      // texts
      if (t < 4) {
        const out = E.inCubic(P(t, 3.7, 4.0));
        const s0 = (t < 0.1 ? 1.08 : 1) * (1 - out);
        if (s0 > 0) {
          text('level kantuk', 540, 250, 124, C.navy, { scale: s0, outline: C.white, outlineW: 18 });
          ctx.save(); ctx.translate(540, 392); ctx.scale(s0, s0);
          ctx.font = `700 96px ${FONT}`; const w = ctx.measureText('kelas jam 7 pagi.').width + 60;
          rr(-w / 2, -62, w, 124, 30); ink(C.amber, 8);
          text('kelas jam 7 pagi.', 0, 4, 96, C.navy);
          ctx.restore();
        }
      } else if (k >= 1 && t < EN.ask) title(t, k);
      askBubble(t);
    } else grid(t);

    // watermark (bottom-right, small, never over the main text)
    ctx.save(); ctx.globalAlpha = 0.25; ctx.font = `600 32px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.strokeStyle = C.navy; ctx.lineJoin = 'round'; ctx.strokeText('@taskkora__', W - 44, H - 52);
    ctx.fillStyle = '#FFFFFF'; ctx.fillText('@taskkora__', W - 44, H - 52); ctx.restore();
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
