/* "Green flag vs red flag semester akhir" — fast split-screen spot, 40s, 1080x1920.
 * Left half green flag, right half red flag; waving cloth flags, alternating text cards and a
 * reacting student. Every frame is a pure function of time; the pair schedule is in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const { T, PAIRS, pairStart } = window.FLAGS;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueL: '#3F72CF', navy: '#0D1B3E', navy2: '#16285A', white: '#FFFFFF', paper: '#F7F8FC',
    green: '#22B263', greenD: '#128049', greenL: '#7BE3A7', red: '#E8434A', redD: '#B4232B', redL: '#FF9A9E',
    skin: '#F6C9A3', skinD: '#E3A982', hair: '#231B38', amber: '#FFB627',
  };
  const HEAD = '"BG", sans-serif', BODY = '"IN", sans-serif', MONO = '"JB", monospace';
  const fH = s => `800 ${s}px ${HEAD}`, fB = (w, s) => `${w} ${s}px ${BODY}`;

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
    inBack: x => { const c1 = 1.7; return (c1 + 1) * x * x * x - c1 * x * x; },
    outElastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const beat = t => Math.exp(-((t % 0.5) / 0.11));             // 120 BPM pulse

  const ready = Promise.all([
    document.fonts.load(fH(80)), document.fonts.load(fB(600, 40)), document.fonts.load(fB(800, 40)), document.fonts.load(`700 40px ${MONO}`),
  ]).then(() => document.fonts.ready);

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function shadowed(fn, blur = 30, oy = 12, a = 0.3) { ctx.save(); ctx.shadowColor = `rgba(6,12,30,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; fn(); ctx.restore(); }
  function wrap(text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (ctx.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryL; }
    if (cur) lines.push(cur); return lines;
  }

  // ---------- state helpers ----------
  const pairAt = t => { const i = Math.floor((t - T.PAIR0) / T.PAIR_LEN); return i >= 0 && i < PAIRS.length ? i : -1; };
  function sideFocus(t) { // 0 = both, -1 = green lit, +1 = red lit
    const i = pairAt(t); if (i < 0) return 0;
    const lt = t - pairStart(i);
    return lt < T.RED_AT ? -1 * P(lt, 0, 0.2) : lt < T.EXIT_AT ? lerp(-1, 0, P(lt, T.RED_AT, T.RED_AT + 0.25)) : 0;
  }

  // =====================================================================
  //  background
  // =====================================================================
  function halves(t, focus) {
    const pulse = beat(t) * (t > T.HOOK && t < T.CRASH ? 1 : 0.4);
    // green half
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2BC46F'); g.addColorStop(0.55, C.green); g.addColorStop(1, C.greenD);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W / 2, H);
    g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#F65A60'); g.addColorStop(0.55, C.red); g.addColorStop(1, C.redD);
    ctx.fillStyle = g; ctx.fillRect(W / 2, 0, W / 2, H);
    // moving diagonal stripes (navy, subtle)
    ctx.save(); ctx.globalAlpha = 0.09; ctx.fillStyle = C.navy;
    const off = (t * 60) % 120;
    for (let x = -H; x < W + H; x += 120) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off + 50, 0); ctx.lineTo(x + off + 50 - H * 0.5, H); ctx.lineTo(x + off - H * 0.5, H); ctx.fill(); }
    ctx.restore();
    // beat flash + focus dimming
    ctx.fillStyle = `rgba(255,255,255,${0.06 * pulse})`; ctx.fillRect(0, 0, W, H);
    if (focus < 0) { ctx.fillStyle = `rgba(13,27,62,${0.42 * -focus})`; ctx.fillRect(W / 2, 0, W / 2, H); }
    // big faint ✓ / ✕ glyphs in each half
    ctx.save(); ctx.globalAlpha = 0.1; ctx.strokeStyle = C.white; ctx.lineWidth = 46; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = 1 + 0.04 * pulse;
    ctx.save(); ctx.translate(270, 1500); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-150, 0); ctx.lineTo(-40, 110); ctx.lineTo(170, -120); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(810, 1500); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-130, -130); ctx.lineTo(130, 130); ctx.moveTo(130, -130); ctx.lineTo(-130, 130); ctx.stroke(); ctx.restore();
    ctx.restore();
    // seam
    ctx.fillStyle = C.navy; ctx.fillRect(W / 2 - 9, 0, 18, H);
    ctx.fillStyle = C.blue; ctx.fillRect(W / 2 - 3, 0, 6, H);
  }

  // =====================================================================
  //  flags
  // =====================================================================
  const POLE = { L: { x: 420, dir: -1, col: [C.green, '#36D987', C.greenD], mark: 'check' }, R: { x: 660, dir: 1, col: [C.red, '#FF6E74', C.redD], mark: 'x' } };
  const BASE_Y = 560, TOP_Y = 120, FW = 330, FHt = 200;
  function cloth(dir, cols, t, amp, phase) {
    const N = 28, pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, w = Math.sin(u * 7.0 - t * 9 + phase) * amp * Math.pow(u, 1.1) + Math.sin(u * 3 - t * 4 + phase) * amp * 0.3 * u;
      pts.push({ x: dir * u * FW * (1 - 0.04 * Math.abs(Math.cos(u * 7 - t * 9 + phase)) * u), y: w, s: Math.cos(u * 7.0 - t * 9 + phase) * u });
    }
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1], sh = (a.s + b.s) / 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + dir * 0.6, b.y); ctx.lineTo(b.x + dir * 0.6, b.y + FHt); ctx.lineTo(a.x, a.y + FHt); ctx.closePath();
      ctx.fillStyle = sh > 0.25 ? cols[1] : sh < -0.25 ? cols[2] : cols[0]; ctx.fill();
    }
    return pts;
  }
  function flag(side, t, o = {}) {
    const p = POLE[side];
    const amp = (o.amp ?? 20);
    ctx.save();
    ctx.translate(o.x ?? p.x, o.y ?? BASE_Y); ctx.rotate(o.rot || 0); ctx.scale(o.s || 1, o.s || 1);
    const len = BASE_Y - TOP_Y;
    // pole
    shadowed(() => { rr(-9, -len - 14, 18, len + 14, 9); ctx.fillStyle = C.paper; ctx.fill(); }, 20, 8, 0.25);
    ctx.fillStyle = 'rgba(13,27,62,0.18)'; ctx.fillRect(2, -len - 4, 7, len);
    ctx.beginPath(); ctx.arc(0, -len - 20, 17, 0, TAU); ctx.fillStyle = C.amber; ctx.fill();
    ctx.beginPath(); ctx.arc(-5, -len - 25, 6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    // pointed tip stuck in the screen
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(0, 26); ctx.closePath(); ctx.fillStyle = '#C9D1E4'; ctx.fill();
    // cloth
    ctx.save(); ctx.translate(p.dir * 8, -len);
    shadowed(() => { cloth(p.dir, p.col, t, amp, side === 'L' ? 0 : 1.3); }, 24, 10, 0.25);
    // emblem rides the wave at u = 0.5
    const u = 0.5, wv = Math.sin(u * 7.0 - t * 9 + (side === 'L' ? 0 : 1.3)) * amp * Math.pow(u, 1.1) + Math.sin(u * 3 - t * 4 + (side === 'L' ? 0 : 1.3)) * amp * 0.3 * u;
    ctx.translate(p.dir * FW * 0.5, wv + FHt / 2);
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fillStyle = C.white; ctx.fill();
    ctx.strokeStyle = side === 'L' ? C.green : C.red; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (p.mark === 'check') { ctx.moveTo(-24, 2); ctx.lineTo(-7, 20); ctx.lineTo(26, -18); } else { ctx.moveTo(-19, -19); ctx.lineTo(19, 19); ctx.moveTo(19, -19); ctx.lineTo(-19, 19); }
    ctx.stroke();
    ctx.restore();
    // banner label under the cloth
    if (o.label !== false) {
      ctx.save(); ctx.translate(p.dir * (FW * 0.5 + 8), -len + FHt + 58);
      ctx.font = fH(40); const tx = side === 'L' ? 'GREEN FLAG' : 'RED FLAG', w = ctx.measureText(tx).width + 44;
      rr(-w / 2, -30, w, 60, 30); ctx.fillStyle = C.navy; ctx.fill();
      ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tx, 0, 3); ctx.restore();
    }
    ctx.restore();
  }
  function impactFx(x, y, t, ti, col) {
    const a = t - ti; if (a < 0 || a > 0.9) return;
    ctx.save();
    ctx.globalAlpha = 1 - a / 0.9;
    ctx.strokeStyle = C.white; ctx.lineWidth = 10 * (1 - a / 0.9) + 2;
    ctx.beginPath(); ctx.ellipse(x, y, 30 + a * 520, 10 + a * 160, 0, 0, TAU); ctx.stroke();
    // screen cracks
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI * (0.1 + 0.8 * rnd(i + ti * 10)) + (i % 2 ? Math.PI : 0) * 0;
      let px = x, py = y + 10; ctx.beginPath(); ctx.moveTo(px, py);
      const L = E.outCubic(P(a, 0, 0.12)) * (70 + rnd(i + 3) * 110);
      for (let k = 1; k <= 3; k++) { px += Math.cos(ang + (rnd(i * 3 + k) - 0.5) * 0.8) * L / 3 * (i % 2 ? 1 : -1); py += Math.sin(ang) * L / 3 * 0.5 + 6; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    // debris
    for (let i = 0; i < 14; i++) {
      const ang = -Math.PI * rnd(i + ti * 7), sp = 300 + rnd(i + 2) * 600;
      ctx.fillStyle = i % 2 ? C.white : col;
      const px = x + Math.cos(ang) * sp * a, py = y + Math.sin(ang) * sp * a + 1400 * a * a;
      ctx.fillRect(px - 6, py - 6, 12, 12);
    }
    if (a < 0.08) { ctx.globalAlpha = 0.3 * (1 - a / 0.08); ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  // =====================================================================
  //  icons
  // =====================================================================
  function icon(name, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 40, s / 40);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (name) {
      case 'calendar': rr(-16, -13, 32, 30, 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-16, -4); ctx.lineTo(16, -4); ctx.moveTo(-8, -18); ctx.lineTo(-8, -10); ctx.moveTo(8, -18); ctx.lineTo(8, -10); ctx.stroke(); ctx.fillRect(-9, 3, 6, 6); ctx.fillRect(3, 3, 6, 6); break;
      case 'folder': ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(-6, -12); ctx.lineTo(-2, -7); ctx.lineTo(18, -7); ctx.lineTo(18, 15); ctx.lineTo(-18, 15); ctx.closePath(); ctx.stroke(); break;
      case 'chat': rr(-18, -15, 36, 24, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, 9); ctx.lineTo(-12, 18); ctx.lineTo(0, 9); ctx.stroke(); ctx.beginPath(); ctx.arc(-8, -3, 2.5, 0, TAU); ctx.arc(0, -3, 2.5, 0, TAU); ctx.arc(8, -3, 2.5, 0, TAU); ctx.fill(); break;
      case 'book': ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(-9, -16, -19, -14); ctx.lineTo(-19, 14); ctx.quadraticCurveTo(-9, 12, 0, 17); ctx.quadraticCurveTo(9, 12, 19, 14); ctx.lineTo(19, -14); ctx.quadraticCurveTo(9, -16, 0, -10); ctx.lineTo(0, 17); ctx.stroke(); break;
      case 'moon': ctx.beginPath(); ctx.arc(0, 0, 17, 0.6, TAU - 0.6 + 0.0001 - 0.0001 + 0); ctx.stroke(); ctx.beginPath(); ctx.arc(9, -7, 13, 0, TAU); ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(); ctx.restore(); break;
      case 'list': for (let i = 0; i < 3; i++) { const y = -12 + i * 12; ctx.beginPath(); ctx.arc(-13, y, 3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, y); ctx.lineTo(17, y); ctx.stroke(); } break;
      case 'check': ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-14, 1); ctx.lineTo(-4, 12); ctx.lineTo(15, -11); ctx.stroke(); break;
      case 'x': ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, 12); ctx.moveTo(12, -12); ctx.lineTo(-12, 12); ctx.stroke(); break;
      case 'flag': ctx.fillRect(-14, -18, 4, 36); ctx.beginPath(); ctx.moveTo(-10, -18); ctx.quadraticCurveTo(0, -22, 6, -16); ctx.quadraticCurveTo(12, -11, 18, -14); ctx.lineTo(18, 4); ctx.quadraticCurveTo(12, 7, 6, 2); ctx.quadraticCurveTo(0, -4, -10, 0); ctx.closePath(); ctx.fill(); break;
      case 'comment': rr(-18, -15, 36, 26, 9); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, 9); ctx.lineTo(-12, 19); ctx.lineTo(4, 9); ctx.fill(); break;
      case 'sparkle': ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 18, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
  }

  // =====================================================================
  //  cards
  // =====================================================================
  const CARD = { y: 660, w: 480, h: 470, gx: 30, rx: 570 };
  function card(side, pair, t, lt) {
    const green = side === 'g', t0 = green ? 0.05 : T.RED_AT + 0.05;
    const kin = P(lt, t0, t0 + 0.32), kout = P(lt, T.EXIT_AT, T.EXIT_AT + 0.42);
    if (kin <= 0 || kout >= 1) return;
    const e = E.outBack(kin), x = green ? CARD.gx : CARD.rx, cx = x + CARD.w / 2;
    ctx.save();
    const fromX = green ? -700 : 700;
    ctx.translate(cx + (1 - e) * fromX + E.inBack(kout) * (green ? -900 : 900), CARD.y + CARD.h / 2 + E.inBack(kout) * 120);
    ctx.rotate((1 - e) * (green ? -0.3 : 0.3) + (green ? -0.025 : 0.025) + E.inBack(kout) * (green ? -0.4 : 0.4));
    const slam = 1 + 0.08 * bump(lt, t0 + 0.2, t0 + 0.4);
    ctx.scale(slam, slam);
    const X = -CARD.w / 2, Y = -CARD.h / 2;
    shadowed(() => { rr(X, Y, CARD.w, CARD.h, 36); ctx.fillStyle = C.white; ctx.fill(); }, 50, 22, 0.35);
    // header chip
    const col = green ? C.green : C.red;
    ctx.font = fH(32); const chipW = ctx.measureText(green ? 'GREEN FLAG' : 'RED FLAG').width + 82;
    rr(X + 26, Y + 26, chipW, 58, 29); ctx.fillStyle = col; ctx.fill();
    icon(green ? 'check' : 'x', X + 58, Y + 55, 30, C.white);
    ctx.fillStyle = C.white; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(green ? 'GREEN FLAG' : 'RED FLAG', X + 82, Y + 57);
    // pair icon
    ctx.beginPath(); ctx.arc(X + CARD.w - 62, Y + 56, 36, 0, TAU); ctx.fillStyle = green ? '#E5F7EC' : '#FDE8E9'; ctx.fill();
    icon(PAIRS[pair].ic, X + CARD.w - 62, Y + 56, 38, col);
    // text
    const txt = green ? PAIRS[pair].g : PAIRS[pair].r;
    ctx.fillStyle = C.navy; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let ty = Y + 170;
    if (Array.isArray(txt)) {
      ctx.font = fH(58); ctx.fillText(txt[0], X + 34, ty);
      ctx.font = `700 25px ${MONO}`; const mw = ctx.measureText(txt[1]).width + 30;
      rr(X + 30, ty + 30, mw, 62, 14); ctx.fillStyle = '#FDE8E9'; ctx.fill(); ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.redD; ctx.textBaseline = 'middle'; ctx.fillText(txt[1], X + 45, ty + 62);
      ctx.font = `700 27px ${MONO}`; ctx.fillStyle = '#9AA3BC'; ctx.fillText('.docx', X + 45, ty + 122);
    } else {
      ctx.font = fH(58); const lines = wrap(txt, CARD.w - 68);
      const size = lines.length > 3 ? 50 : 58; ctx.font = fH(size);
      wrap(txt, CARD.w - 68).forEach((l, i) => ctx.fillText(l, X + 34, ty + i * size * 1.08));
    }
    // stamp
    const sk = E.outBack(P(lt, t0 + 0.28, t0 + 0.5));
    if (sk > 0) {
      ctx.save(); ctx.translate(X + CARD.w - 86, Y + CARD.h - 82); ctx.rotate(green ? -0.18 : 0.18); ctx.scale(lerp(2, 1, sk), lerp(2, 1, sk)); ctx.globalAlpha = clamp(sk * 2);
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();
      icon(green ? 'check' : 'x', 0, 0, 52, C.white); ctx.restore();
    }
    ctx.restore();
  }
  function progress(t, i, lt) {
    // pair counter on the seam
    const k = E.outBack(P(lt, 0, 0.3));
    ctx.save(); ctx.translate(540, 612); ctx.scale(k, k);
    rr(-82, -32, 164, 64, 32); ctx.fillStyle = C.navy; ctx.fill(); ctx.strokeStyle = C.white; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = C.white; ctx.font = fH(38); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${i + 1} / 6`, 0, 3);
    ctx.restore();
  }

  // =====================================================================
  //  the student (vector bust)
  // =====================================================================
  function student(t, state, kPop, extra = {}) {
    const cx = 540, by = 1920;
    const bob = Math.sin(t * Math.PI * 2) * 5 * (state === 'think' ? 0.4 : 1);   // nods on the beat
    const hx = cx + (extra.tilt || 0) * 30, hy = 1390 + bob;
    // glow behind
    const gl = ctx.createRadialGradient(cx, 1520, 60, cx, 1520, 420); gl.addColorStop(0, 'rgba(255,255,255,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(cx - 450, 1080, 900, 840);
    // hoodie body
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx - 300, by); ctx.lineTo(cx - 285, 1660); ctx.quadraticCurveTo(cx - 270, 1560, cx - 150, 1540); ctx.lineTo(cx + 150, 1540); ctx.quadraticCurveTo(cx + 270, 1560, cx + 285, 1660); ctx.lineTo(cx + 300, by); ctx.closePath();
    ctx.fillStyle = C.blue; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 150, 1545); ctx.quadraticCurveTo(cx, 1640, cx + 150, 1545); ctx.quadraticCurveTo(cx, 1590, cx - 150, 1545); ctx.fillStyle = C.navy2; ctx.fill(); // hood collar
    ctx.strokeStyle = C.white; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 40, 1600); ctx.lineTo(cx - 48, 1700); ctx.moveTo(cx + 40, 1600); ctx.lineTo(cx + 48, 1690); ctx.stroke();
    rr(cx + 120, 1690, 70, 40, 10); ctx.fillStyle = C.amber; ctx.fill(); // name badge
    ctx.fillStyle = C.navy; ctx.font = fH(22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('S1', cx + 155, 1712);
    // neck
    ctx.fillStyle = C.skinD; ctx.fillRect(cx - 42, 1480, 84, 80);
    ctx.restore();
    // head
    ctx.save(); ctx.translate(hx, hy); ctx.rotate((extra.tilt || 0) * 0.15); const s = kPop; ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(-128, 10, 30, 0, TAU); ctx.arc(128, 10, 30, 0, TAU); ctx.fillStyle = C.skin; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.fillStyle = C.skin; ctx.fill();
    // hair
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.arc(0, -12, 136, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(110, -40, 70, -52); ctx.quadraticCurveTo(40, -20, 10, -62); ctx.quadraticCurveTo(-20, -30, -60, -58); ctx.quadraticCurveTo(-100, -40, -134, -30); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(40, -140, 30, 14, 0.5, 0, TAU); ctx.fill(); // tuft
    // blush
    ctx.fillStyle = 'rgba(255,120,140,0.35)'; ctx.beginPath(); ctx.ellipse(-82, 48, 24, 13, 0, 0, TAU); ctx.ellipse(82, 48, 24, 13, 0, 0, TAU); ctx.fill();
    // eyes
    ctx.fillStyle = C.navy; ctx.strokeStyle = C.navy; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const sx of [-48, 48]) {
      ctx.save(); ctx.translate(sx, 4);
      if (state === 'happy') { ctx.beginPath(); ctx.arc(0, 8, 15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      else if (state === 'shock') { ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fillStyle = C.white; ctx.fill(); ctx.beginPath(); ctx.arc(0, 2, 8, 0, TAU); ctx.fillStyle = C.navy; ctx.fill(); }
      else if (state === 'cringe') { ctx.beginPath(); const d = sx < 0 ? 1 : -1; ctx.moveTo(-12 * d, -12); ctx.lineTo(10 * d, 0); ctx.lineTo(-12 * d, 12); ctx.stroke(); }
      else if (state === 'facepalm') { ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(14, 2); ctx.stroke(); }
      else { const look = state === 'think' ? -6 : 0; ctx.beginPath(); ctx.arc(look, look, 12, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(look + 4, look - 4, 4, 0, TAU); ctx.fillStyle = C.white; ctx.fill(); ctx.fillStyle = C.navy; }
      ctx.restore();
    }
    // glasses
    ctx.strokeStyle = C.navy; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(-48, 4, 40, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(48, 4, 40, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, -8, 10, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-88, 0); ctx.lineTo(-124, -6); ctx.moveTo(88, 0); ctx.lineTo(124, -6); ctx.stroke();
    // brows
    ctx.lineWidth = 9;
    const bAng = state === 'shock' ? -0.25 : state === 'cringe' ? 0.3 : state === 'facepalm' ? 0.35 : state === 'happy' ? -0.1 : state === 'think' ? 0.15 : 0;
    const bY = state === 'shock' ? -70 : -56;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 30, bY - sx * bAng * 0 + (sx > 0 ? 0 : 0)); ctx.lineTo(sx * 72, bY + bAng * 30 * 1); ctx.stroke(); }
    // mouth
    ctx.save(); ctx.translate(0, 72);
    if (state === 'happy') { ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(0, 50, 34, -6); ctx.closePath(); ctx.fillStyle = '#7A2633'; ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 18, 14, 8, 0, 0, TAU); ctx.fillStyle = '#FF8C9C'; ctx.fill(); }
    else if (state === 'shock') { ctx.beginPath(); ctx.ellipse(0, 6, 20, 28, 0, 0, TAU); ctx.fillStyle = '#7A2633'; ctx.fill(); }
    else if (state === 'cringe') { rr(-38, -12, 76, 30, 10); ctx.fillStyle = C.white; ctx.fill(); ctx.strokeStyle = C.navy; ctx.lineWidth = 5; ctx.stroke(); ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 13, -12); ctx.lineTo(i * 13, 18); } ctx.moveTo(-38, 3); ctx.lineTo(38, 3); ctx.lineWidth = 3; ctx.stroke(); }
    else if (state === 'facepalm') { ctx.beginPath(); ctx.moveTo(-26, 8); ctx.quadraticCurveTo(0, -8, 26, 8); ctx.strokeStyle = C.navy; ctx.lineWidth = 8; ctx.stroke(); }
    else if (state === 'think') { ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(14, -6, 30, 4); ctx.strokeStyle = C.navy; ctx.lineWidth = 8; ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-24, -2); ctx.quadraticCurveTo(0, 18, 24, -2); ctx.strokeStyle = C.navy; ctx.lineWidth = 8; ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    // hands
    const hand = (x, y, r = 46, rot = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.15, 0, 0, TAU); ctx.fillStyle = C.skin; ctx.fill(); ctx.strokeStyle = C.skinD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.2); ctx.lineTo(-r * 0.4, r * 0.6); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.7); ctx.moveTo(r * 0.4, -r * 0.2); ctx.lineTo(r * 0.4, r * 0.6); ctx.stroke(); ctx.restore(); };
    const sleeve = (x1, y1, x2, y2) => { ctx.strokeStyle = C.blue; ctx.lineWidth = 92; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const k = extra.armK ?? 1;
    if (state === 'happy') { // thumbs up
      const x = cx + 300, y = lerp(1900, 1470, E.outBack(k));
      sleeve(cx + 250, 1800, x, y + 70);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.15);
      rr(-46, -30, 92, 82, 26); ctx.fillStyle = C.skin; ctx.fill();
      rr(-22, -100, 40, 84, 20); ctx.fill();
      ctx.strokeStyle = C.skinD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(30, 0); ctx.moveTo(-40, 22); ctx.lineTo(30, 22); ctx.stroke(); ctx.restore();
    } else if (state === 'shock') {
      const y = lerp(1900, 1480, E.outBack(k));
      sleeve(cx - 260, 1820, cx - 150, y + 90); sleeve(cx + 260, 1820, cx + 150, y + 90);
      hand(cx - 150, y + bob, 46, 0.3); hand(cx + 150, y + bob, 46, -0.3);
    } else if (state === 'facepalm') {
      const y = lerp(1900, 1370, E.outBack(k));
      sleeve(cx + 260, 1820, cx + 80, y + 120);
      hand(cx + 45, y + bob, 62, -0.5);
    } else if (state === 'think') {
      const y = lerp(1900, 1500, E.outBack(k));
      sleeve(cx + 250, 1820, cx + 60, y + 90);
      hand(cx + 52, y + bob, 40, -0.2);
    }
  }
  function reactionFx(t, state, ta, hx = 540, hy = 1390) {
    const a = t - ta;
    if (state === 'happy') for (let i = 0; i < 5; i++) {
      const ph = (a * 0.9 + i / 5) % 1, ang = -Math.PI / 2 + (i - 2) * 0.55;
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); icon('sparkle', hx + Math.cos(ang) * (190 + ph * 80), hy + Math.sin(ang) * (170 + ph * 80), 44 + 20 * Math.sin(ph * Math.PI), i % 2 ? C.amber : C.white); ctx.restore();
    }
    else if (state) {
      for (let i = 0; i < 2; i++) { // sweat drops
        const ph = (a * 1.3 + i / 2) % 1, sx = hx + (i ? 170 : -170), sy = hy - 90 + ph * 90;
        ctx.save(); ctx.globalAlpha = 1 - ph; ctx.fillStyle = '#9ED8FF'; ctx.beginPath(); ctx.moveTo(sx, sy - 28); ctx.quadraticCurveTo(sx + 18, sy, sx, sy + 12); ctx.quadraticCurveTo(sx - 18, sy, sx, sy - 28); ctx.fill(); ctx.restore();
      }
      const k = E.outBack(P(a, 0.05, 0.3));
      ctx.save(); ctx.translate(hx + 210, hy - 190); ctx.rotate(0.15); ctx.scale(k, k);
      rr(-60, -44, 120, 88, 30); ctx.fillStyle = C.white; ctx.fill();
      ctx.fillStyle = C.red; ctx.font = fH(64); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state === 'facepalm' ? '-_-' : '!?', 0, 4); ctx.restore();
    }
  }

  // =====================================================================
  //  scenes
  // =====================================================================
  function hook(t) {
    // flag slams: left already hitting on frame 0, right lands at 0.28
    const tiL = 0.0, tiR = 0.28;
    const dropL = 1 - E.inCubic(P(t, tiL - 0.25, tiL)), dropR = 1 - E.inCubic(P(t, tiR - 0.25, tiR));
    const wobL = t > tiL ? Math.sin((t - tiL) * 30) * 0.18 * Math.exp(-(t - tiL) * 5) : 0;
    const wobR = t > tiR ? Math.sin((t - tiR) * 30) * 0.18 * Math.exp(-(t - tiR) * 5) : 0;
    const ampL = 20 + 30 * Math.exp(-Math.max(0, t - tiL) * 2), ampR = 20 + 30 * Math.exp(-Math.max(0, t - tiR) * 2);
    // motion streak of the incoming right flag
    if (t < tiR) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = C.white; ctx.fillRect(POLE.R.x + 240 * dropR - 5, BASE_Y - 1100 * dropR - 500, 10, 500); ctx.restore(); }
    flag('L', t, { y: BASE_Y - 1100 * dropL, x: POLE.L.x - 240 * dropL, rot: -0.35 * dropL + wobL, amp: ampL, label: t > 0.5 });
    flag('R', t, { y: BASE_Y - 1100 * dropR, x: POLE.R.x + 240 * dropR, rot: 0.35 * dropR + wobR, amp: ampR, label: t > 0.6 });
    impactFx(POLE.L.x, BASE_Y, t, tiL, C.green);
    impactFx(POLE.R.x, BASE_Y, t, tiR, C.red);
    vsBadge(t, 0.35);
    // headline
    const out = P(t, 3.7, 4.0);
    if (out < 1) {
      ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 60);
      const k1 = E.outBack(lerp(0.45, 1, P(t, 0.0, 0.2))), k2 = E.outBack(lerp(0.3, 1, P(t, 0.0, 0.28))), k3 = E.outBack(lerp(0.2, 1, P(t, 0.0, 0.36)));
      shadowed(() => { rr(60, 640, 960, 430, 48); ctx.fillStyle = C.navy; ctx.fill(); }, 50, 20, 0.35);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
      const line = (k, y, parts, size) => {
        if (k <= 0) return;
        ctx.save(); ctx.translate(540, y); ctx.scale(lerp(1.4, 1, k), lerp(1.4, 1, k)); ctx.globalAlpha *= clamp(k * 2 + 0.5);
        ctx.font = fH(size); ctx.letterSpacing = '-2px';
        const ws = parts.map(p => ctx.measureText(p[0]).width), tot = ws.reduce((a, b) => a + b, 0);
        let x = -tot / 2; ctx.textAlign = 'left';
        parts.forEach(([s, col, bg], i) => {
          if (bg) { rr(x - 10, -size * 0.8, ws[i] + 6, size * 0.98, 18); ctx.fillStyle = bg; ctx.fill(); }
          ctx.fillStyle = col; ctx.fillText(s, x, 0); x += ws[i];
        });
        ctx.restore();
      };
      line(k1, 770, [['Green flag', C.white, C.green], [' vs', C.white]], 104);
      line(k2, 900, [['red flag', C.white, C.red]], 104);
      line(k3, 1020, [['semester akhir.', C.amber]], 96);
      ctx.restore();
    }
    student(t, t < 0.3 ? 'shock' : t < 2.2 ? 'shock' : 'neutral', 1 + 0.12 * bump(t, 0, 0.3), { armK: P(t, 0, 0.3) });
    if (t < 2.2) reactionFx(t, 'shock', 0);
  }

  function vsBadge(t, ta) {
    const k = E.outBack(P(t, ta, ta + 0.3)); if (k <= 0) return;
    const pulse = 1 + 0.06 * beat(t);
    ctx.save(); ctx.translate(540, 330); ctx.scale(k * pulse, k * pulse); ctx.rotate((1 - k) * 1.5);
    shadowed(() => { ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fillStyle = C.blue; ctx.fill(); }, 20, 8, 0.4);
    ctx.lineWidth = 7; ctx.strokeStyle = C.white; ctx.stroke();
    ctx.fillStyle = C.white; ctx.font = fH(62); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('VS', 0, 4);
    ctx.restore();
  }

  function pairs(t) {
    const i = pairAt(t), lt = t - pairStart(i);
    const focus = sideFocus(t);
    flag('L', t, { amp: 20 + 18 * Math.max(0, -focus) + 6 * beat(t), s: 1 + 0.04 * Math.max(0, -focus) });
    flag('R', t, { amp: 20 + 18 * (lt > T.RED_AT && lt < T.EXIT_AT ? 1 - P(lt, T.RED_AT, T.RED_AT + 1.5) * 0.5 : 0) + 6 * beat(t) });
    vsBadge(t, -1);
    progress(t, i, lt);
    card('g', i, t, lt);
    card('r', i, t, lt);
    // student reactions
    let state = 'neutral', ta = 0;
    if (lt >= 0.05 && lt < T.RED_AT) { state = 'happy'; ta = 0.05; }
    else if (lt >= T.RED_AT + 0.05 && lt < T.EXIT_AT + 0.2) { state = PAIRS[i].react; ta = T.RED_AT + 0.05; }
    const kPop = 1 + 0.1 * bump(lt, ta, ta + 0.25);
    student(t, state, kPop, { armK: P(lt, ta, ta + 0.3), tilt: state === 'cringe' ? -0.4 : state === 'happy' ? 0.2 : 0 });
    if (state !== 'neutral') reactionFx(t, state === 'happy' ? 'happy' : state, pairStart(i) + ta);
  }

  // ---------- 34 – 40: collision -> question ----------
  function finale(t) {
    const a = t - T.END3;
    const crash = T.CRASH;
    const fly = E.inCubic(P(t, T.END3, crash));
    const lift = E.outCubic(P(t, T.END3, T.END3 + 0.15)) * 40;
    if (t < crash) {
      flag('L', t, { x: lerp(POLE.L.x, 470, fly), y: BASE_Y - lift - fly * 60, rot: fly * 0.55, amp: 30, label: false });
      flag('R', t, { x: lerp(POLE.R.x, 610, fly), y: BASE_Y - lift - fly * 60, rot: -fly * 0.55, amp: 30, label: false });
      vsBadge(t, -1);
      student(t, 'shock', 1, { armK: P(t, T.END3, T.END3 + 0.3) });
      return;
    }
    // blue takes over from the crash point
    const wipe = E.outCubic(P(t, crash, crash + 0.45));
    ctx.save(); ctx.beginPath(); ctx.arc(540, 360, wipe * 2300, 0, TAU); ctx.clip();
    const g = ctx.createRadialGradient(540, 760, 100, 540, 900, 1400); g.addColorStop(0, '#2457B5'); g.addColorStop(1, C.blue);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = C.navy; const off = (t * 60) % 120;
    for (let x = -H; x < W + H; x += 120) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off + 50, 0); ctx.lineTo(x + off + 50 - H * 0.5, H); ctx.lineTo(x + off - H * 0.5, H); ctx.fill(); }
    ctx.restore();
    ctx.restore();
    // sparks green + red
    const sa = t - crash;
    for (let i = 0; i < 40; i++) {
      const ang = rnd(i * 3.3) * TAU, sp = 400 + rnd(i + 11) * 1100;
      const x = 540 + Math.cos(ang) * sp * E.outCubic(clamp(sa / 1.2)), y = 360 + Math.sin(ang) * sp * E.outCubic(clamp(sa / 1.2)) + 500 * sa * sa;
      if (sa > 1.4) break;
      ctx.save(); ctx.globalAlpha = 1 - P(sa, 0.7, 1.4); ctx.translate(x, y); ctx.rotate(sa * 8 + i);
      ctx.fillStyle = i % 3 === 0 ? C.white : i % 2 ? C.green : C.red; ctx.fillRect(-10, -10, 20, 20); ctx.restore();
    }
    if (sa < 0.5) { ctx.save(); ctx.globalAlpha = 1 - sa / 0.5; ctx.strokeStyle = C.white; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(540, 360, 40 + sa * 1400, 0, TAU); ctx.stroke(); ctx.restore(); }
    if (sa < 0.12) { ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - sa / 0.12)})`; ctx.fillRect(0, 0, W, H); }
    // two-tone flag waving on top (the merged flag)
    const mk = E.outBack(P(t, crash + 0.15, crash + 0.5));
    if (mk > 0) {
      ctx.save(); ctx.translate(540, 470); ctx.scale(mk, mk);
      // pole
      rr(-8, -330, 16, 330, 8); ctx.fillStyle = C.paper; ctx.fill(); ctx.beginPath(); ctx.arc(0, -340, 16, 0, TAU); ctx.fillStyle = C.amber; ctx.fill();
      ctx.save(); ctx.translate(8, -330);
      const N = 28;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N;
        const w0 = Math.sin(u0 * 7 - t * 9) * 20 * u0, w1 = Math.sin(u1 * 7 - t * 9) * 20 * u1, sh = Math.cos(u0 * 7 - t * 9) * u0;
        const top = u0 < 0.5;
        ctx.beginPath(); ctx.moveTo(u0 * 300, w0); ctx.lineTo(u1 * 300 + 0.6, w1); ctx.lineTo(u1 * 300 + 0.6, w1 + 190); ctx.lineTo(u0 * 300, w0 + 190); ctx.closePath();
        ctx.fillStyle = top ? (sh > 0.25 ? '#36D987' : sh < -0.25 ? C.greenD : C.green) : (sh > 0.25 ? '#FF6E74' : sh < -0.25 ? C.redD : C.red); ctx.fill();
      }
      const wv = Math.sin(0.5 * 7 - t * 9) * 20 * 0.5;
      ctx.beginPath(); ctx.arc(150, wv + 95, 50, 0, TAU); ctx.fillStyle = C.white; ctx.fill();
      ctx.fillStyle = C.navy; ctx.font = fH(70); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 150, wv + 100);
      ctx.restore(); ctx.restore();
    }
    // the question
    const q1 = E.outBack(P(t, crash + 0.35, crash + 0.65)), q2 = E.outBack(P(t, crash + 0.5, crash + 0.8));
    if (q1 > 0) {
      ctx.save(); ctx.translate(540, 680);
      shadowed(() => { rr(-480, -50 * q1, 960, 430 * q1, 48); ctx.fillStyle = C.white; ctx.fill(); }, 50, 20, 0.35);
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.save(); ctx.translate(540, 800); ctx.scale(q1, q1); ctx.font = fH(98); ctx.letterSpacing = '-2px'; ctx.fillStyle = C.navy; ctx.fillText('Kamu dapat berapa', 0, 0); ctx.restore();
      if (q2 > 0) {
        ctx.save(); ctx.translate(540, 935); ctx.scale(q2, q2); ctx.font = fH(112); ctx.letterSpacing = '-2px';
        const w = ctx.measureText('green flag?').width;
        rr(-w / 2 - 22, -96, w + 44, 124, 26); ctx.fillStyle = C.green; ctx.fill();
        ctx.fillStyle = C.white; ctx.fillText('green flag?', 0, 0); ctx.restore();
      }
      // 6 slots that keep flipping between check / x — the viewer decides
      for (let i = 0; i < 6; i++) {
        const k = E.outBack(P(t, crash + 0.9 + i * 0.1, crash + 1.15 + i * 0.1)); if (k <= 0) continue;
        const x = 540 + (i - 2.5) * 136, y = 1140;
        const isG = Math.floor((t - crash) * 4 + rnd(i) * 4) % 2 === 0;
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.beginPath(); ctx.arc(0, 0, 52, 0, TAU); ctx.fillStyle = C.white; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fillStyle = isG ? C.green : C.red; ctx.fill();
        icon(isG ? 'check' : 'x', 0, 0, 44, C.white); ctx.restore();
      }
      const ck = E.outBack(P(t, crash + 1.7, crash + 2.0));
      if (ck > 0) {
        ctx.save(); ctx.translate(540, 1262); ctx.scale(ck, ck);
        ctx.font = fB(800, 42); const s = 'Tulis jumlahnya di komentar', w = ctx.measureText(s).width + 110;
        rr(-w / 2, -42, w, 84, 42); ctx.fillStyle = C.navy; ctx.fill();
        icon('comment', -w / 2 + 50, 0, 38, C.amber);
        ctx.fillStyle = C.white; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, -w / 2 + 84, 2); ctx.restore();
      }
    }
    // the student thinking, counting with a ? bubble
    ctx.save(); ctx.translate(0, 110);
    student(t, 'think', 1 + 0.08 * bump(t, crash + 0.3, crash + 0.6), { armK: P(t, crash + 0.2, crash + 0.5), tilt: 0.15 });
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const ph = ((t - crash) * 0.6 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * clamp((t - crash - 0.6) * 3);
      ctx.fillStyle = C.white; ctx.font = fH(70 + i * 10); ctx.textAlign = 'center';
      ctx.fillText('?', 540 - 250 + i * 250 + Math.sin(ph * 6) * 20, 1470 - ph * 60 + (i === 1 ? -40 : 30)); ctx.restore();
    }
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = C.white;
    ctx.font = fB(600, 30); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    ctx.fillText('@taskkora__', W - 44, H - 46);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    // camera shake on impacts
    let sh = 0;
    for (const ti of [0, 0.28]) if (t >= ti && t - ti < 0.3) sh = Math.max(sh, 22 * (1 - (t - ti) / 0.3));
    if (t >= T.CRASH && t - T.CRASH < 0.5) sh = Math.max(sh, 30 * (1 - (t - T.CRASH) / 0.5));
    for (let i = 0; i < PAIRS.length; i++) for (const o of [0.25, T.RED_AT + 0.25]) { const ti = pairStart(i) + o; if (t >= ti && t - ti < 0.18) sh = Math.max(sh, 9 * (1 - (t - ti) / 0.18)); }
    const f = Math.floor(t * 60);
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate((rnd(f) - 0.5) * sh * 2, (rnd(f + 7) - 0.5) * sh * 2);
    if (sh) ctx.scale(1.02, 1.02);
    halves(t, sideFocus(t));
    if (t < T.HOOK) hook(t);
    else if (t < T.END3) pairs(t);
    else finale(t);
    ctx.restore();
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
