/* "Simple Budget Tracker" — 30s promo (Taskkora). Every frame is a pure function of time.
 *   ?format=9x16 (1080x1920, default) | 16x9 (1920x1080) | cover (1920x1080 still) | thumb (1080x1080 still)
 * The story is drawn once in an "object space" (900x960) plus a caption zone; each format only changes
 * where those two zones sit, so the 9:16 and 16:9 cuts stay in sync with the same soundtrack. */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const FMT = { '16x9': '16x9', cover: 'cover', thumb: 'thumb' }[params.get('format')] || '9x16';
  const [W, H] = { '9x16': [1080, 1920], '16x9': [1920, 1080], cover: [1920, 1080], thumb: [1080, 1080] }[FMT];
  const WIDE = FMT === '16x9';
  const DURATION = 30;
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // palette: electric blue taken from the logo, navy, white, light blue, soft gray
  const C = {
    blue: '#004FC6', blueHi: '#2A74F0', navy: '#0B1F4B', navy2: '#1C3470', white: '#FFFFFF',
    light: '#E2ECFF', light2: '#F3F7FF', gray: '#EEF1F6', gray2: '#D6DDE8', gray3: '#7C879B',
    mid: '#6E9FF2', pale: '#BCD1F4', bgTop: '#F9FBFF', bgBot: '#E3ECFC',
  };
  const F = (w, s) => `${w} ${s}px "PJS", sans-serif`;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.jpg'; }),
    document.fonts.load(F(500, 40)), document.fonts.load(F(700, 40)), document.fonts.load(F(800, 40)),
  ]).then(() => document.fonts.ready);

  // ---------- layout per format ----------
  const LAY = WIDE ? {
    logo: { x: 110, y: 72, h: 118 }, wm: { x: W - 110, y: H - 72, size: 26 },
    obj: { cx: 1350, cy: 540, s: 0.86 },
    cap: { x: 120, cy: 540, align: 'left', maxW: 740, k: 0.86 },
  } : {
    logo: { x: 60, y: 64, h: 132 }, wm: { x: W - 60, y: H - 64, size: 30 },
    obj: { cx: 540, cy: 1010, s: 1 },
    cap: { x: 540, top: 262, align: 'center', maxW: 960, k: 1 },
  };

  // ---------- drawing helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function shadow(level = 1) {
    ctx.shadowColor = `rgba(11,31,75,${0.13 * level})`; ctx.shadowBlur = 44 * level; ctx.shadowOffsetY = 18 * level;
  }
  function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function card(x, y, w, h, r, fill = C.white, lvl = 1) {
    ctx.save(); shadow(lvl); rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function text(s, x, y, font, color, align = 'left', base = 'alphabetic', spacing = 0) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.letterSpacing = spacing + 'px'; ctx.fillText(s, x, y); ctx.letterSpacing = '0px';
  }
  function measure(s, font, spacing = 0) { ctx.font = font; ctx.letterSpacing = spacing + 'px'; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }
  function check(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.34, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.26); ctx.lineTo(x + s * 0.36, y - s * 0.24);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  // The logo is drawn exactly as supplied (full 1024x1280 JPG, aspect kept, no crop/recolor).
  function drawLogo(x, y, h, alpha = 1, shadowLvl = 0.6) {
    if (alpha <= 0) return;
    const w = h * logo.naturalWidth / logo.naturalHeight;
    ctx.save(); ctx.globalAlpha *= alpha; if (shadowLvl) shadow(shadowLvl); ctx.drawImage(logo, x, y, w, h); ctx.restore();
    return w;
  }
  function inObj(fn) {
    const { cx, cy, s } = LAY.obj;
    ctx.save(); ctx.translate(cx - 450 * s, cy - 480 * s); ctx.scale(s, s); fn(); ctx.restore();
  }

  // ---------- money ----------
  const CUR = {
    USD: { sym: '$', group: ',', dec: '.' },
    IDR: { sym: 'Rp', group: '.', dec: ',' },
    EUR: { sym: '€', group: '.', dec: ',' },
  };
  function money(v, code, sign = '') {
    const c = CUR[code], [i, d] = Math.abs(v).toFixed(2).split('.');
    return sign + c.sym + i.replace(/\B(?=(\d{3})+(?!\d))/g, c.group) + c.dec + d;
  }
  // The template only relabels the currency (it does not convert), so a switch re-labels every amount.
  const FLIPS = [{ t: 15.6, to: 'IDR' }, { t: 18.6, to: 'EUR' }];
  function curAt(t, delay = 0) {
    let prev = 'USD', cur = 'USD', p = 1;
    for (const f of FLIPS) if (t >= f.t + delay) { prev = cur; cur = f.to; p = E.inOutCubic(P(t, f.t + delay, f.t + delay + 0.42)); }
    return { prev, cur, p };
  }
  // Vertical roll between two labels (used for every number when the currency changes).
  function roll(a, b, p, x, y, font, color, align = 'left', lh = 60) {
    if (p >= 1 || a === b) { text(b, x, y, font, color, align); return; }
    const w = Math.max(measure(a, font), measure(b, font)) + 24;
    const x0 = align === 'right' ? x - w + 12 : align === 'center' ? x - w / 2 : x - 12;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y - lh * 0.95, w, lh * 1.25); ctx.clip();
    ctx.globalAlpha *= 1 - p; text(a, x, y - p * lh, font, color, align);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y - lh * 0.95, w, lh * 1.25); ctx.clip();
    ctx.globalAlpha *= p; text(b, x, y + (1 - p) * lh, font, color, align); ctx.restore();
  }
  function moneyRoll(v, t, delay, x, y, font, color, align, lh, sign = '') {
    const c = curAt(t, delay);
    roll(money(v, c.prev, sign), money(v, c.cur, sign), c.p, x, y, font, color, align, lh);
  }

  // ---------- data (sample rows shown in the sheet) ----------
  const INCOME = { desc: 'Monthly allowance', cat: 'Allowance', amt: 800 };
  const ROWS = [
    { desc: 'Coffee', cat: 'Food', amt: 18.5 },
    { desc: 'Ride to campus', cat: 'Transport', amt: 42 },
    { desc: 'Snacks', cat: 'Food', amt: 26.8 },
    { desc: 'Streaming plan', cat: 'Subscriptions', amt: 12.99 },
    { desc: 'Groceries', cat: 'Food', amt: 96.4 },
    { desc: 'Phone plan', cat: 'Bills', amt: 25 },
  ];
  const SPENT = ROWS.reduce((a, r) => a + r.amt, 0);            // 221.69
  const LEFT = INCOME.amt - SPENT;                              // 578.31
  const CATS = [
    { name: 'Food', color: C.blue }, { name: 'Transport', color: C.navy },
    { name: 'Bills', color: C.mid }, { name: 'Subscriptions', color: C.pale },
  ].map(c => ({ ...c, amt: ROWS.filter(r => r.cat === c.name).reduce((a, r) => a + r.amt, 0) }));

  // =====================================================================
  // background, logo, watermark
  function background(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bgTop); g.addColorStop(1, C.bgBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint spreadsheet grid
    ctx.save(); ctx.strokeStyle = 'rgba(0,79,198,0.05)'; ctx.lineWidth = 1.5;
    const step = 72, ox = (W / 2) % step, oy = (t * 6) % step;
    ctx.beginPath();
    for (let x = ox; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -step + oy; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke(); ctx.restore();
    // soft light-blue glows, breathing on the beat
    const pulse = 1 + 0.025 * Math.pow(Math.max(0, Math.cos(TAU * t)), 8) * (t > 5 && t < 26 ? 1 : 0);
    [[0.18, 0.28, 0.55, 0.2], [0.85, 0.72, 0.6, 0.16]].forEach(([fx, fy, fr, a], i) => {
      const x = W * fx + Math.sin(t * 0.35 + i * 2) * 60, y = H * fy + Math.cos(t * 0.3 + i) * 60;
      const r = Math.max(W, H) * fr * 0.6 * pulse;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(42,116,240,${a})`); rg.addColorStop(1, 'rgba(42,116,240,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    });
  }
  function brand(t) {
    const a = E.outCubic(P(t, 0.0, 0.5));
    drawLogo(LAY.logo.x, LAY.logo.y, LAY.logo.h, a, 0.5);
    ctx.save(); ctx.globalAlpha = 0.3;
    text('Made by Taskkora', LAY.wm.x, LAY.wm.y, F(700, LAY.wm.size), C.navy, 'right', 'alphabetic', 0.5);
    ctx.restore();
  }

  // Caption zone: centered under the logo on 9:16, left column on 16:9. Words rise in one by one.
  function caption(lines, t, t0, tOut, o = {}) {
    const k = LAY.cap.k, gap = o.gap || 1.16;
    const sizes = lines.map(l => (l.size || 76) * k);
    const totalH = sizes.reduce((a, s) => a + s * gap, 0);
    let y = WIDE ? LAY.cap.cy - totalH / 2 : LAY.cap.top;
    let wi = 0;
    lines.forEach((l, li) => {
      const s = sizes[li], font = F(l.weight || 800, s), sp = -s * 0.025;
      y += s * gap;
      const words = l.text.split(' '), spc = measure(' ', font, sp);
      const ws = words.map(w => measure(w, font, sp));
      const total = ws.reduce((a, b) => a + b, 0) + spc * (words.length - 1);
      const fit = total > LAY.cap.maxW ? LAY.cap.maxW / total : 1;
      let x = LAY.cap.align === 'center' ? LAY.cap.x - total * fit / 2 : LAY.cap.x;
      words.forEach((w, i) => {
        const a = t0 + (l.delay || 0) + wi * 0.07, p = P(t, a, a + 0.45);
        const q = tOut != null ? E.inCubic(P(t, tOut + wi * 0.02, tOut + wi * 0.02 + 0.32)) : 0;
        if (p > 0 && q < 1) {
          ctx.save(); ctx.globalAlpha *= clamp(p * 2.5) * (1 - q);
          ctx.translate(x, y + (1 - E.outBack(p)) * s * 0.45 - q * s * 0.35); ctx.scale(fit, fit);
          text(w, 0, 0, font, l.color || C.navy, 'left', 'alphabetic', sp);
          if (l.underline) {
            const up = E.inOutCubic(P(t, a + 0.25, a + 0.7));
            rr(0, s * 0.14, ws[i] * up, s * 0.1, s * 0.05); ctx.fillStyle = C.blueHi; ctx.fill();
          }
          ctx.restore();
        }
        x += (ws[i] + spc) * fit; wi++;
      });
    });
  }

  // ---------- objects ----------
  // Wallet in its own coordinates (≈420x300). f = how full (0..1); `inside` draws between back and front pocket.
  function wallet(x, y, s, f, squash = 0, inside = null) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + squash * 0.05), s * (1 - squash * 0.05) * (1 + 0.04 * f));
    ctx.save(); shadow(1.1); rr(-210, -150, 420, 300, 46); ctx.fillStyle = C.navy; ctx.fill(); ctx.restore();
    // cards / cash peeking out, rising with f
    const top = -70 - 120 * f;
    rr(-172, top - 26, 250, 170, 16); ctx.fillStyle = C.pale; ctx.fill();
    rr(-120, top, 260, 170, 16); ctx.fillStyle = C.white; ctx.fill();
    circle(-70, top + 44, 16, C.light); rr(-38, top + 34, 130, 18, 9); ctx.fillStyle = C.light; ctx.fill();
    if (inside) inside();
    // front pocket
    rr(-210, -80, 420, 230, 46); ctx.fillStyle = C.blue; ctx.fill();
    ctx.save(); ctx.setLineDash([12, 12]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 4;
    rr(-190, -60, 380, 190, 34); ctx.stroke(); ctx.restore();
    // clasp
    ctx.save(); shadow(0.5); rr(118, -38, 130, 92, 30); ctx.fillStyle = C.navy2; ctx.fill(); ctx.restore();
    circle(186, 8, 17, C.white); circle(186, 8, 7, C.navy2);
    ctx.restore();
  }
  function coin(x, y, r, spin = 0, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(0.55 + 0.45 * Math.abs(Math.cos(spin)), 1);
    ctx.save(); shadow(0.45); circle(0, 0, r, C.white); ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, TAU); ctx.fillStyle = C.light; ctx.fill();
    ctx.lineWidth = r * 0.14; ctx.strokeStyle = C.blue; ctx.stroke();
    rr(-r * 0.1, -r * 0.42, r * 0.2, r * 0.84, r * 0.1); ctx.fillStyle = C.blue; ctx.fill();
    ctx.restore();
  }
  function icon(kind, x, y, r, rot = 0, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.save(); shadow(0.6); circle(0, 0, r, C.white); ctx.restore();
    ctx.strokeStyle = C.blue; ctx.fillStyle = C.blue; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'coffee') {
      ctx.beginPath(); ctx.moveTo(-r * 0.36, -r * 0.12); ctx.lineTo(r * 0.26, -r * 0.12); ctx.lineTo(r * 0.18, r * 0.42); ctx.lineTo(-r * 0.28, r * 0.42); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.1, r * 0.14, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      for (const sx of [-0.16, 0.06]) { ctx.beginPath(); ctx.moveTo(r * sx, -r * 0.26); ctx.bezierCurveTo(r * (sx - 0.1), -r * 0.36, r * (sx + 0.1), -r * 0.44, r * sx, -r * 0.54); ctx.stroke(); }
    } else if (kind === 'ride') {
      ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.22); ctx.lineTo(-r * 0.5, r * 0.0); ctx.lineTo(-r * 0.3, -r * 0.06); ctx.lineTo(-r * 0.16, -r * 0.3);
      ctx.lineTo(r * 0.2, -r * 0.3); ctx.lineTo(r * 0.34, -r * 0.06); ctx.lineTo(r * 0.5, 0); ctx.lineTo(r * 0.5, r * 0.22); ctx.closePath(); ctx.fill();
      rr(-r * 0.12, -r * 0.24, r * 0.26, r * 0.16, r * 0.03); ctx.fillStyle = C.white; ctx.fill();
      for (const wx of [-0.28, 0.28]) { circle(r * wx, r * 0.24, r * 0.15, C.white); circle(r * wx, r * 0.24, r * 0.1, C.navy); }
    } else if (kind === 'snack') {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.28, r * 0.2, 0, 0, TAU); ctx.fill();
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * r * 0.24, 0); ctx.lineTo(d * r * 0.5, -r * 0.18); ctx.lineTo(d * r * 0.5, r * 0.18); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = C.white; ctx.lineWidth = r * 0.06;
      for (const sx of [-0.08, 0.08]) { ctx.beginPath(); ctx.moveTo(r * sx - r * 0.04, -r * 0.16); ctx.lineTo(r * sx + r * 0.04, r * 0.16); ctx.stroke(); }
    } else if (kind === 'sub') {
      rr(-r * 0.44, -r * 0.32, r * 0.88, r * 0.6, r * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.16); ctx.lineTo(r * 0.18, -r * 0.02); ctx.lineTo(-r * 0.1, r * 0.12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.44); ctx.lineTo(r * 0.2, r * 0.44); ctx.stroke();
    }
    ctx.restore();
  }
  function chip(label, x, y, h, fill, color, scale = 1, align = 'left') {
    if (scale <= 0) return 0;
    const font = F(700, h * 0.46), w = measure(label, font) + h * 0.9;
    ctx.save(); ctx.translate(align === 'left' ? x + w / 2 : x, y); ctx.scale(scale, scale);
    rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
    text(label, 0, 1, font, color, 'center', 'middle'); ctx.restore();
    return w;
  }
  function caret(x, y, h, t) { if (Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = C.blue; ctx.fillRect(x + 3, y - h * 0.8, 3, h); } }

  // Transactions sheet — object space, 900 wide. p(t) state is derived from the absolute time.
  const SHEET_T0 = 6.05, ROW_DT = 0.9;
  function sheet(t, still = false) {
    const x = 0, y = 40, w = 900, h = 880;
    card(x, y, w, h, 38);
    // title bar
    rr(x, y, w, 118, [38, 38, 0, 0]); ctx.fillStyle = C.light2; ctx.fill();
    circle(52, y + 59, 9, C.gray2); circle(80, y + 59, 9, C.gray2); circle(108, y + 59, 9, C.gray2);
    text('Transactions', 140, y + 71, F(800, 36), C.navy);
    chip('USD', 852, y + 59, 50, C.light, C.blue, 1, 'center');
    // column headers
    const hy = y + 118;
    ctx.fillStyle = C.gray; ctx.fillRect(x, hy, w, 58);
    const hf = F(700, 21);
    text('DESCRIPTION', 44, hy + 37, hf, C.gray3, 'left', 'alphabetic', 1.5);
    text('CATEGORY', 440, hy + 37, hf, C.gray3, 'left', 'alphabetic', 1.5);
    text('AMOUNT', 856, hy + 37, hf, C.gray3, 'right', 'alphabetic', 1.5);
    // income row
    const iy = hy + 58, rh = 96;
    const ip = still ? 1 : E.outCubic(P(t, 5.45, 5.95));
    if (ip > 0) {
      ctx.save(); ctx.globalAlpha *= ip; ctx.translate((1 - ip) * -40, 0);
      ctx.fillStyle = C.light; ctx.fillRect(x, iy, w, rh);
      ctx.fillStyle = C.blue; ctx.fillRect(x, iy, 8, rh);
      text(INCOME.desc, 44, iy + rh / 2 + 11, F(700, 31), C.navy);
      chip('Income', 440, iy + rh / 2, 46, C.navy, C.white, still ? 1 : E.outBack(P(t, 5.6, 5.95)));
      const v = still ? INCOME.amt : INCOME.amt * E.outCubic(P(t, 5.6, 6.1));
      text(money(v, 'USD', '+'), 856, iy + rh / 2 + 11, F(800, 32), C.blue, 'right');
      ctx.restore();
    }
    // expense rows typing in
    ROWS.forEach((r, i) => {
      const ry = iy + rh + i * rh, t0 = SHEET_T0 + i * ROW_DT;
      ctx.fillStyle = C.gray; ctx.fillRect(x + 32, ry + rh - 1, w - 64, 2);
      if (!still && t < t0) return;
      const pd = still ? 1 : P(t, t0, t0 + 0.38);
      const s = r.desc.slice(0, Math.round(r.desc.length * pd));
      const flash = still ? 0 : bump(t, t0 + 0.62, t0 + 1.1) * 0.8;
      if (flash > 0) { ctx.save(); ctx.globalAlpha *= flash; ctx.fillStyle = C.light2; ctx.fillRect(x, ry, w, rh - 1); ctx.restore(); }
      text(s, 44, ry + rh / 2 + 11, F(700, 31), C.navy);
      if (!still && pd < 1) caret(44 + measure(s, F(700, 31)), ry + rh / 2 + 11, 34, t);
      chip(r.cat, 440, ry + rh / 2, 46, C.blue, C.white, still ? 1 : E.outBack(P(t, t0 + 0.36, t0 + 0.62)));
      const pa = still ? 1 : P(t, t0 + 0.48, t0 + 0.68);
      if (pa > 0) {
        const full = money(r.amt, 'USD', '-');
        text(full.slice(0, Math.max(1, Math.round(full.length * pa))), 856, ry + rh / 2 + 11, F(700, 31), C.navy, 'right');
      }
    });
  }

  // Donut: spending by category.
  function donut(cx, cy, r, th, p) {
    ctx.save(); ctx.lineWidth = th; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.strokeStyle = C.gray; ctx.stroke();
    let a = -Math.PI / 2; const gap = 0.035;
    CATS.forEach((c, i) => {
      const frac = c.amt / SPENT, seg = frac * TAU;
      const sp = clamp(p * CATS.length - i);                   // segments sweep in one after another
      if (sp > 0) {
        ctx.beginPath(); ctx.arc(cx, cy, r, a + gap / 2, a + gap / 2 + Math.max(0, seg - gap) * E.outCubic(sp));
        ctx.strokeStyle = c.color; ctx.stroke();
      }
      a += seg;
    });
    ctx.restore();
  }

  // Dashboard card — object space 900x960.
  function dashboard(t, still = false) {
    card(0, 0, 900, 960, 40);
    text('This month', 48, 84, F(800, 38), C.navy);
    // currency selector (label rolls on each switch)
    const c = still ? { prev: 'USD', cur: 'USD', p: 1 } : curAt(t);
    const press = still ? 0 : FLIPS.reduce((a, f) => a + bump(t, f.t - 0.62, f.t - 0.42), 0);
    ctx.save(); ctx.translate(732, 68); ctx.scale(1 - press * 0.06, 1 - press * 0.06);
    rr(-120, -34, 240, 68, 34); ctx.fillStyle = C.light2; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.blue; ctx.stroke();
    circle(-84, 0, 23, C.blue);
    roll(CUR[c.prev].sym, CUR[c.cur].sym, c.p, -84, 8, F(800, c.cur === 'IDR' || c.prev === 'IDR' ? 17 : 22), C.white, 'center', 30);
    roll(c.prev, c.cur, c.p, -48, 11, F(800, 30), C.navy, 'left', 44);
    ctx.beginPath(); ctx.moveTo(72, -6); ctx.lineTo(84, 6); ctx.lineTo(96, -6); ctx.strokeStyle = C.navy; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    text('CURRENCY', 732, 128, F(700, 17), C.gray3, 'center', 'alphabetic', 2);

    // stat tiles
    const tv = still ? 1 : E.outCubic(P(t, 12.7, 13.6));
    [['Income', INCOME.amt, 48, C.blue, '+'], ['Expenses', SPENT, 462, C.navy, '-']].forEach(([lab, v, x, col, sign], i) => {
      rr(x, 156, 390, 150, 26); ctx.fillStyle = C.light2; ctx.fill();
      text(lab, x + 30, 208, F(700, 24), C.gray3);
      if (still || tv >= 1) moneyRoll(v, t, i * 0.04, x + 30, 270, F(800, 44), col, 'left', 56, sign);
      else text(money(v * tv, 'USD', sign), x + 30, 270, F(800, 44), col);
    });

    // donut + legend
    const dp = still ? 1 : P(t, 12.9, 14.1);
    donut(236, 516, 148, 56, dp);
    text('spent', 236, 506, F(700, 24), C.gray3, 'center');
    text(`${CATS.length} categories`, 236, 540, F(800, 24), C.navy, 'center');
    CATS.forEach((cat, i) => {
      const ly = 420 + i * 66, lp = still ? 1 : E.outCubic(P(t, 13.1 + i * 0.12, 13.5 + i * 0.12));
      if (lp <= 0) return;
      ctx.save(); ctx.globalAlpha *= lp; ctx.translate((1 - lp) * 30, 0);
      circle(462, ly - 8, 11, cat.color);
      text(cat.name, 486, ly, F(700, 25), C.navy);
      moneyRoll(cat.amt, t, 0.08 + i * 0.04, 852, ly, F(700, 25), C.gray3, 'right', 36);
      ctx.restore();
    });

    // remaining balance tile
    rr(48, 716, 804, 196, 30); ctx.fillStyle = C.blue; ctx.fill();
    text('remaining balance', 88, 780, F(700, 27), 'rgba(255,255,255,0.78)');
    const cnt = still ? 1 : E.outCubic(P(t, 13.6, 15.0));
    if (cnt >= 1) moneyRoll(LEFT, t, 0.26, 88, 870, F(800, 74), C.white, 'left', 86);
    else text(money(LEFT * cnt, 'USD'), 88, 870, F(800, 74), C.white);
    // share-left ring on the tile
    const share = LEFT / INCOME.amt;
    ctx.save(); ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(772, 814, 44, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(772, 814, 44, -Math.PI / 2, -Math.PI / 2 + TAU * share * cnt); ctx.strokeStyle = C.white; ctx.stroke();
    ctx.restore();
    text(`${Math.round(share * 100 * cnt)}%`, 772, 822, F(800, 22), C.white, 'center');
    text('left', 772, 888, F(700, 20), 'rgba(255,255,255,0.7)', 'center');

    if (!still) selectorUI(t);
  }

  // Cursor + dropdown for each currency switch.
  function selectorUI(t) {
    const opts = ['USD', 'IDR', 'EUR'];
    FLIPS.forEach((f, fi) => {
      const open = P(t, f.t - 0.45, f.t - 0.3) * (1 - P(t, f.t - 0.02, f.t + 0.12));
      if (open > 0) {
        const hov = t < f.t - 0.22 ? opts.indexOf(fi ? 'IDR' : 'USD') : opts.indexOf(f.to);
        ctx.save(); ctx.globalAlpha *= open; ctx.translate(0, (1 - open) * -14);
        card(612, 112, 240, 206, 22, C.white, 0.8);
        opts.forEach((o, i) => {
          const oy = 122 + i * 62;
          if (i === hov) { rr(622, oy, 220, 56, 14); ctx.fillStyle = C.light; ctx.fill(); }
          text(CUR[o].sym, 654, oy + 38, F(800, 24), C.blue, 'center');
          text(o, 688, oy + 38, F(800, 26), i === hov ? C.blue : C.navy);
        });
        ctx.restore();
      }
    });
    // cursor path: in → tap pill → tap option → rest; twice
    const keys = [
      [14.5, 930, 300], [14.95, 740, 84], [15.12, 740, 84], [15.35, 740, 84], [15.45, 730, 216], [15.6, 730, 216], [16.1, 850, 330],
      [17.9, 850, 330], [18.12, 740, 84], [18.35, 740, 84], [18.45, 730, 278], [18.6, 730, 278], [19.2, 940, 420],
    ];
    if (t < keys[0][0] || t > 19.6) return;
    let x = keys[0][1], y = keys[0][2];
    for (let i = 1; i < keys.length; i++) {
      const [ta, xa, ya] = keys[i - 1], [tb, xb, yb] = keys[i];
      if (t >= ta && t <= tb) { const e = E.inOutCubic(P(t, ta, tb)); x = lerp(xa, xb, e); y = lerp(ya, yb, e); break; }
      if (t > tb) { x = xb; y = yb; }
    }
    const a = P(t, 14.5, 14.8) * (1 - P(t, 19.2, 19.6));
    const taps = [15.18, 15.52, 18.18, 18.52].reduce((s, tp) => s + bump(t, tp - 0.08, tp + 0.12), 0);
    // tap ripple
    [15.18, 15.52, 18.18, 18.52].forEach(tp => {
      const rp = P(t, tp - 0.05, tp + 0.4);
      if (rp > 0 && rp < 1) { ctx.save(); ctx.globalAlpha *= a * (1 - rp); ctx.beginPath(); ctx.arc(x, y, 12 + rp * 46, 0, TAU); ctx.strokeStyle = C.blueHi; ctx.lineWidth = 5; ctx.stroke(); ctx.restore(); }
    });
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(1.25 - taps * 0.18, 1.25 - taps * 0.18);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.lineTo(11, 33); ctx.lineTo(19, 51); ctx.lineTo(27, 47); ctx.lineTo(19, 30); ctx.lineTo(34, 30); ctx.closePath();
    ctx.save(); shadow(0.5); ctx.fillStyle = C.navy; ctx.fill(); ctx.restore();
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.white; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }

  function badge(t, t0) {
    const p = E.outBack(P(t, t0, t0 + 0.5)), q = P(t, 25.6, 25.95);
    if (p <= 0 || q >= 1) return;
    const k = LAY.cap.k, s = 58 * k, font = F(800, s), label = 'day 30: still okay';
    const tw = measure(label, font, -1), bh = s * 2.1, bw = tw + bh + s * 1.1;
    const cx = WIDE ? LAY.cap.x + bw / 2 : LAY.cap.x, cy = WIDE ? LAY.cap.cy : LAY.cap.top + 150;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2) * (1 - q); ctx.translate(cx, cy + q * -30); ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p);
    card(-bw / 2, -bh / 2, bw, bh, bh / 2, C.white, 1);
    const ccx = -bw / 2 + bh / 2 + 4;
    circle(ccx, 0, bh * 0.34, C.blue);
    check(ccx, 2, bh * 0.4, C.white, bh * 0.07, P(t, t0 + 0.25, t0 + 0.6));
    text(label, ccx + bh * 0.52, s * 0.35, font, C.navy, 'left', 'alphabetic', -1);
    ctx.restore();
    // sparkles
    for (let i = 0; i < 8; i++) {
      const sp = P(t, t0 + 0.2, t0 + 1.2); if (sp <= 0 || sp >= 1) continue;
      const ang = i / 8 * TAU + 0.3, d = bw * 0.36 + sp * 90;
      const sx = cx + Math.cos(ang) * d, sy = cy + Math.sin(ang) * d * 0.45;
      ctx.save(); ctx.globalAlpha *= (1 - sp); ctx.translate(sx, sy); ctx.rotate(ang);
      rr(-3, -12, 6, 24, 3); ctx.fillStyle = i % 2 ? C.blueHi : C.mid; ctx.fill(); ctx.restore();
    }
  }

  // =====================================================================
  // Scenes
  const DRIFT = [
    { k: 'coin', t: 1.0, dx: -290, dy: -300 }, { k: 'coffee', t: 1.3, dx: 320, dy: -330 },
    { k: 'coin', t: 1.6, dx: 120, dy: -440 }, { k: 'ride', t: 1.95, dx: -350, dy: -110 },
    { k: 'coin', t: 2.25, dx: 380, dy: -80 }, { k: 'snack', t: 2.55, dx: -170, dy: -420 },
    { k: 'sub', t: 2.9, dx: 300, dy: -250 }, { k: 'coin', t: 3.25, dx: -400, dy: -280 },
    { k: 'coin', t: 3.55, dx: 40, dy: -360 },
  ];
  function sHook(t) {
    caption([
      { text: 'my monthly allowance', size: 70 },
      { text: 'is gone by the 20th...', size: 70 },
      { text: 'why?', size: 124, color: C.blue, delay: 1.5, underline: true },
    ], t, 0.3, 4.55, { gap: 1.2 });
    const inP = E.outBack(P(t, 0.1, 0.65)), outP = E.inCubic(P(t, 4.6, 5.1));
    if (inP <= 0 || outP >= 1) return;
    inObj(() => {
      const f = 1 - E.inOutCubic(P(t, 1.0, 4.0));
      const shake = Math.sin(t * 38) * 6 * bump(t, 3.9, 4.35);
      ctx.save(); ctx.globalAlpha *= 1 - outP;
      DRIFT.forEach((d, i) => {
        const p = P(t, d.t, d.t + 2.3); if (p <= 0 || p >= 1) return;
        const e = E.outCubic(p), mx = 450 + (rnd(i) - 0.5) * 120, my = 560;
        const x = mx + d.dx * e + Math.sin(p * 5 + i) * 18, y = my + d.dy * e;
        const sc = 0.35 + 0.65 * E.outBack(P(t, d.t, d.t + 0.45)), al = 1 - P(p, 0.6, 1);
        if (d.k === 'coin') coin(x, y, 38 * sc, t * 5 + i, al);
        else icon(d.k, x, y, 56 * sc, Math.sin(p * 3 + i) * 0.35, al);
      });
      wallet(450 + shake, 700 + outP * 60, (0.6 + 0.4 * inP) * (1 - outP * 0.3), f);
      ctx.restore();
    });
  }

  function sSheet(t) {
    caption([{ text: 'track income', size: 80 }, { text: 'and expenses', size: 80, color: C.blue }], t, 5.25, 11.85);
    const inP = E.outCubic(P(t, 5.0, 5.6)), outP = E.inCubic(P(t, 11.9, 12.45));
    if (inP <= 0 || outP >= 1) return;
    inObj(() => {
      ctx.save(); ctx.globalAlpha *= inP * (1 - outP);
      ctx.translate(450, 480 + (1 - inP) * 140 - outP * 80); ctx.scale(1 - outP * 0.08, 1 - outP * 0.08); ctx.translate(-450, -480);
      sheet(t); ctx.restore();
    });
  }

  function sDash(t) {
    caption([{ text: 'see where', size: 80 }, { text: 'it goes', size: 80, color: C.blue }], t, 12.4, 14.55);
    caption([{ text: 'switch currency', size: 80 }, { text: 'anytime', size: 80, color: C.blue }], t, 15.15, 21.6);
    const inP = E.outCubic(P(t, 12.3, 12.95)), outP = E.inCubic(P(t, 21.7, 22.25));
    if (inP <= 0 || outP >= 1) return;
    inObj(() => {
      ctx.save(); ctx.globalAlpha *= inP * (1 - outP);
      ctx.translate(450, 480 + (1 - inP) * 160); ctx.scale(1 - outP * 0.25, 1 - outP * 0.25); ctx.translate(-450, -480);
      dashboard(t); ctx.restore();
    });
  }

  const DROPS = [0, 1, 2, 3, 4, 5, 6].map(i => ({ t: 22.55 + i * 0.15, x: (rnd(i + 9) - 0.5) * 220, spin: rnd(i + 3) * 6 }));
  function sRefill(t) {
    badge(t, 23.7);
    const inP = E.outBack(P(t, 22.15, 22.6)), outP = E.inCubic(P(t, 25.7, 26.2));
    if (inP <= 0 || outP >= 1) return;
    inObj(() => {
      const f = E.outCubic(P(t, 22.6, 23.8));
      const squash = DROPS.reduce((a, d) => a + bump(t, d.t + 0.3, d.t + 0.5), 0);
      ctx.save(); ctx.globalAlpha *= 1 - outP;
      wallet(450, 640 + outP * 50, (0.4 + 0.6 * inP) * 1.08 * (1 - outP * 0.3), f, Math.min(1, squash), () => {
        DROPS.forEach((d, i) => {
          const p = P(t, d.t, d.t + 0.42); if (p <= 0 || p >= 1) return;
          coin(d.x * (1 - p), lerp(-640, -20, E.inCubic(p)), 36, d.spin + t * 7, 1);
        });
      });
      ctx.restore();
    });
  }

  function sEnd(t) {
    const pl = E.outBack(P(t, 26.2, 26.85)), al = P(t, 26.2, 26.5);
    const L = WIDE ? { cx: 960, cy: 396, h: 380, ty: 704, py: 800, my: 900, ts: 72, ps: 38 }
                   : { cx: 540, cy: 800, h: 470, ty: 1196, py: 1300, my: 1418, ts: 78, ps: 40 };
    if (al > 0) {
      const h = L.h * (0.85 + 0.15 * pl), w = h * logo.naturalWidth / logo.naturalHeight;
      drawLogo(L.cx - w / 2, L.cy - h / 2, h, al, 1.1);
    }
    const tp = E.outCubic(P(t, 26.7, 27.2));
    if (tp > 0) { ctx.save(); ctx.globalAlpha *= tp; text('Simple Budget Tracker', L.cx, L.ty + (1 - tp) * 30, F(800, L.ts), C.navy, 'center', 'alphabetic', -L.ts * 0.02); ctx.restore(); }
    const pp = E.outBack(P(t, 27.0, 27.45));
    if (pp > 0) chip('Free on Gumroad', L.cx, L.py, L.ps * 2.1, C.blue, C.white, pp, 'center');
    const mp = E.outCubic(P(t, 27.35, 27.8));
    if (mp > 0) { ctx.save(); ctx.globalAlpha *= mp; text('Made by Taskkora', L.cx, L.my, F(700, L.ps * 0.8), C.gray3, 'center', 'alphabetic', 0.5); ctx.restore(); }
  }

  // =====================================================================
  // Stills: cover (16:9) and thumbnail (1:1)
  function cover() {
    background(0);
    drawLogo(150, 170, 250, 1, 0.9);
    text('Simple Budget', 146, 560, F(800, 104), C.navy, 'left', 'alphabetic', -2);
    text('Tracker', 146, 676, F(800, 104), C.blue, 'left', 'alphabetic', -2);
    chip('Free Excel template', 150, 786, 76, C.white, C.navy);
    mockup(1000, 170, 780);
  }
  // Spreadsheet window with a donut panel (cover image right side). x,y top-left, width w (height = 0.9w).
  function mockup(x, y, w) {
    const s = w / 820;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    card(0, 0, 820, 740, 30, C.white, 1.2);
    rr(0, 0, 820, 64, [30, 30, 0, 0]); ctx.fillStyle = C.light2; ctx.fill();
    circle(34, 32, 8, C.gray2); circle(58, 32, 8, C.gray2); circle(82, 32, 8, C.gray2);
    text('Simple Budget Tracker', 410, 41, F(700, 22), C.gray3, 'center');
    // column letters + row numbers
    ctx.fillStyle = C.gray; ctx.fillRect(0, 64, 562, 40); ctx.fillRect(0, 64, 44, 460);
    const cols = [[44, 'A'], [270, 'B'], [420, 'C']];
    ctx.fillStyle = C.gray2; ctx.fillRect(560, 64, 2, 460);
    cols.forEach(([cx, l], i) => { const nx = i < 2 ? cols[i + 1][0] : 560; text(l, (cx + nx) / 2, 91, F(700, 18), C.gray3, 'center'); ctx.fillStyle = C.gray2; ctx.fillRect(cx, 64, 2, 460); });
    const rh = 52, y0 = 104;
    for (let i = 0; i < 8; i++) {
      text(String(i + 1), 22, y0 + i * rh + 33, F(700, 17), C.gray3, 'center');
      ctx.fillStyle = C.gray; ctx.fillRect(44, y0 + (i + 1) * rh - 1, 516, 2);
    }
    // header + rows
    text('Description', 60, y0 + 33, F(800, 19), C.navy); text('Category', 286, y0 + 33, F(800, 19), C.navy); text('Amount', 544, y0 + 33, F(800, 19), C.navy, 'right');
    ctx.fillStyle = C.light; ctx.fillRect(46, y0 + rh, 514, rh - 1);
    text(INCOME.desc, 60, y0 + rh + 33, F(700, 19), C.navy); chip('Income', 286, y0 + rh * 1.5, 30, C.navy, C.white);
    text(money(INCOME.amt, 'USD', '+'), 544, y0 + rh + 33, F(800, 19), C.blue, 'right');
    ROWS.forEach((r, i) => {
      const ry = y0 + (i + 2) * rh;
      text(r.desc, 60, ry + 33, F(700, 19), C.navy); chip(r.cat, 286, ry + rh / 2, 30, C.blue, C.white);
      text(money(r.amt, 'USD', '-'), 544, ry + 33, F(700, 19), C.navy, 'right');
    });
    // donut panel
    rr(584, 88, 212, 420, 22); ctx.fillStyle = C.light2; ctx.fill();
    text('Spending', 690, 128, F(800, 20), C.navy, 'center');
    donut(690, 236, 74, 30, 1);
    CATS.forEach((c, i) => { const ly = 352 + i * 38; circle(612, ly - 6, 8, c.color); text(c.name, 628, ly, F(700, 17), C.navy); });
    // remaining tile
    rr(44, 548, 752, 164, 24); ctx.fillStyle = C.blue; ctx.fill();
    text('remaining balance', 80, 604, F(700, 24), 'rgba(255,255,255,0.78)');
    text(money(LEFT, 'USD'), 80, 680, F(800, 60), C.white);
    ctx.save(); ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(716, 630, 40, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(716, 630, 40, -Math.PI / 2, -Math.PI / 2 + TAU * LEFT / INCOME.amt); ctx.strokeStyle = C.white; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function thumb() {
    background(0);
    const h = 340, w = h * logo.naturalWidth / logo.naturalHeight;
    drawLogo(540 - w / 2, 110, h, 1, 0.9);
    text('Simple Budget', 540, 604, F(800, 112), C.navy, 'center', 'alphabetic', -2);
    text('Tracker', 540, 724, F(800, 112), C.blue, 'center', 'alphabetic', -2);
    // one simple icon: a donut chart
    const cy = 878;
    const cw = measure('Free Excel template', F(700, 38)) + 38 * 0.9;
    const iconX = 540 - (104 + 24 + cw) / 2 + 52;
    ctx.save(); shadow(0.6); circle(iconX, cy, 52, C.white); ctx.restore();
    ctx.save(); ctx.lineWidth = 16;
    [[0, 0.52, C.blue], [0.52, 0.76, C.navy], [0.76, 1, C.mid]].forEach(([a, b, c]) => {
      ctx.beginPath(); ctx.arc(iconX, cy, 28, -Math.PI / 2 + a * TAU + 0.06, -Math.PI / 2 + b * TAU - 0.06); ctx.strokeStyle = c; ctx.stroke();
    });
    ctx.restore();
    chip('Free Excel template', iconX + 52 + 24, cy, 84, C.white, C.navy);
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px'; noShadow();
    if (FMT === 'cover') { cover(); ctx.restore(); return; }
    if (FMT === 'thumb') { thumb(); ctx.restore(); return; }
    background(t);
    if (t < 5.2) sHook(t);
    if (t >= 4.9 && t < 12.6) sSheet(t);
    if (t >= 12.2 && t < 22.4) sDash(t);
    if (t >= 21.9 && t < 26.3) sRefill(t);
    if (t >= 26.0) sEnd(t);
    brand(t);
    const fo = P(t, 29.3, 30.0);                                  // fade out
    if (fo > 0) { ctx.globalAlpha = E.inOutCubic(fo); ctx.fillStyle = C.bgTop; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  // ---------- runtime ----------
  window.TASKKORA = { render, ready, DURATION, W, H };
  if (params.has('render')) { document.body.classList.add('render'); return; }
  const btn = document.getElementById('play'), seek = document.getElementById('seek'), tl = document.getElementById('time');
  let playing = true, start = performance.now(), tNow = 0;
  if (params.has('t') || FMT === 'cover' || FMT === 'thumb') { tNow = parseFloat(params.get('t') || 0); playing = false; btn.textContent = 'Play'; }
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
