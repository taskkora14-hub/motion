/* Taskkora — 40s portrait motion graphic (1080x1920).
 * Every frame is a pure function of time: render(t). The same code drives the
 * live preview in the browser and the frame-by-frame export (scripts/render.mjs). */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  // ---------- palette (from the logo) ----------
  const C = {
    blue: '#004FC6', blueD: '#003B99', blueDD: '#002B75', blueL: '#2F74E6', blueXL: '#7FB2FF',
    sky: '#DCE8FF', sky2: '#EEF3FF', cream: '#FAF8F4', white: '#FFFFFF',
    ink: '#0B1B3F', gray: '#8A96AD', line: '#D9E1EF', soft: '#F3F6FC',
    amber: '#FFC247', coral: '#FF6B6B', mint: '#3DBE8B', skin: '#F5CBA7', skin2: '#C98E6A', hair: '#1B2340',
  };
  const FONT = '"Jakarta", "Plus Jakarta Sans", sans-serif';

  // ---------- math / easing ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: x => 1 - Math.pow(1 - x, 4),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outBackS: x => { const c1 = 2.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inBack: x => { const c1 = 1.70158; return (c1 + 1) * x * x * x - c1 * x * x; },
  };
  const bump = (t, a, b) => { const p = P(t, a, b); return Math.sin(p * Math.PI); };

  // ---------- assets ----------
  const img = {};
  function loadImg(name, src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => { img[name] = i; res(); }; i.onerror = rej; i.src = src; });
  }
  const ready = Promise.all([
    loadImg('mark', 'assets/mark.png'),
    loadImg('t', 'assets/mark-t.png'),
    loadImg('a', 'assets/mark-arrow.png'),
    loadImg('c', 'assets/mark-check.png'),
    document.fonts.load(`800 40px ${FONT}`), document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 40px ${FONT}`),
  ]).then(() => document.fonts.ready);

  // ---------- drawing helpers ----------
  const font = (w, s) => `${w} ${s}px ${FONT}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function shadow(color = 'rgba(0,43,117,0.16)', blur = 40, oy = 18) {
    ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy;
  }
  function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function card(x, y, w, h, r, fill = C.white, sh = true) {
    ctx.save(); if (sh) shadow(); rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, color, w) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  }
  function checkPath(x, y, s) { // unit check centered at x,y spanning s
    ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
  }
  function drawCheck(x, y, s, color, w, p = 1) {
    ctx.save(); checkPath(x, y, s); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p); ctx.stroke(); ctx.restore();
  }
  function sparkle(x, y, r, color, alpha = 1) {
    if (r <= 0 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.28, Math.sin(a + Math.PI / 4) * r * 0.28);
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }

  // Masked kinetic line: each word rises from behind an invisible baseline mask.
  // opts: {size, weight, color, align, stagger, dur, out, hl:{wordIndex: {bg, color}}, spacing}
  function kLine(text, x, y, t, t0, opts = {}) {
    const size = opts.size || 80, weight = opts.weight || 800, stagger = opts.stagger ?? 0.07, dur = opts.dur || 0.7;
    ctx.save();
    ctx.font = font(weight, size);
    ctx.letterSpacing = (opts.spacing ?? -Math.round(size * 0.02)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' ');
    const sp = ctx.measureText(' ').width;
    const widths = words.map(w => ctx.measureText(w).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let cx = opts.align === 'left' ? x : x - total / 2;
    const top = y - size * 1.02, bot = y + size * 0.34;
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger;
      const pin = E.outExpo(P(t, a, a + dur));
      let pout = 0;
      if (opts.out != null) pout = E.inCubic(P(t, opts.out + i * stagger * 0.6, opts.out + i * stagger * 0.6 + 0.45));
      if (pin <= 0 || pout >= 1) { cx += widths[i] + sp; continue; }
      const dy = (1 - pin) * size * 1.25 - pout * size * 1.25;
      const hl = opts.hl && opts.hl[i];
      ctx.save();
      if (hl && hl.bg) {
        const hp = E.outBack(P(t, a + 0.15, a + 0.6)) * (1 - pout);
        const padX = size * 0.22, bh = size * 1.18;
        ctx.save();
        ctx.translate(cx - padX, y - size * 0.82 + bh / 2);
        ctx.scale(hp, hp); ctx.rotate(-0.03);
        rr(0, -bh / 2, widths[i] + padX * 2, bh, bh * 0.28); ctx.fillStyle = hl.bg; ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.rect(cx - size, top, widths[i] + size * 2, bot - top); ctx.clip();
      ctx.fillStyle = (hl && hl.color) || opts.color || C.ink;
      ctx.globalAlpha *= clamp(pin * 1.5) * (1 - pout * 0.3);
      ctx.fillText(words[i], cx, y + dy);
      ctx.restore();
      cx += widths[i] + sp;
    }
    ctx.restore();
    return total;
  }

  // Pill label (e.g. section headers)
  function pill(text, x, y, t, t0, o = {}) {
    const size = o.size || 36, p = E.outBackS(P(t, t0, t0 + 0.55)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.35)) : 0;
    if (p <= 0 || out >= 1) return;
    ctx.save();
    ctx.font = font(o.weight || 700, size); ctx.letterSpacing = (o.spacing ?? 1) + 'px';
    const tw = ctx.measureText(text).width, iconW = o.dot ? size * 0.9 : 0;
    const w = tw + size * 1.4 + iconW, h = size * 1.9;
    ctx.translate(x, y); ctx.scale(p * (1 - out * 0.2), p * (1 - out * 0.2)); ctx.globalAlpha *= clamp(p) * (1 - out);
    if (o.shadow) shadow('rgba(0,43,117,0.18)', 30, 10);
    rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = o.bg || C.white; ctx.fill(); noShadow();
    if (o.border) { ctx.lineWidth = 3; ctx.strokeStyle = o.border; ctx.stroke(); }
    if (o.dot) circle(-w / 2 + size * 0.95, 0, size * 0.2, o.dot);
    ctx.fillStyle = o.color || C.blue; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(text, -w / 2 + size * 0.7 + iconW, size * 0.04);
    ctx.restore();
  }

  // ---------- backgrounds ----------
  function bgBlue(t) {
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, '#0B5DDA'); g.addColorStop(0.55, C.blue); g.addColorStop(1, '#003A9C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // soft moving light
    const lx = W * 0.5 + Math.sin(t * 0.35) * 260, ly = H * 0.36 + Math.cos(t * 0.27) * 180;
    const rg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 900);
    rg.addColorStop(0, 'rgba(120,175,255,0.30)'); rg.addColorStop(1, 'rgba(120,175,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    // floating translucent shapes (depth)
    const shapes = [[160, 300, 180, 0.05, 0.4], [960, 520, 240, 0.045, 0.3], [120, 1500, 260, 0.04, 0.25], [930, 1650, 200, 0.05, 0.45], [600, 120, 120, 0.035, 0.5]];
    for (const [x, y, r, a, s] of shapes) {
      circle(x + Math.sin(t * s + x) * 40, y + Math.cos(t * s * 1.3 + y) * 50, r, `rgba(255,255,255,${a})`);
    }
    dotGrid(t, 'rgba(255,255,255,0.07)');
  }
  function bgCream(t) {
    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
    const blobs = [[W * 0.92, 260, 520, 'rgba(0,79,198,0.08)'], [W * 0.05, 1700, 600, 'rgba(0,79,198,0.07)'], [W * 0.2, 500, 380, 'rgba(255,194,71,0.07)']];
    for (const [x, y, r, c] of blobs) {
      const bx = x + Math.sin(t * 0.3 + y) * 50, by = y + Math.cos(t * 0.25 + x) * 50;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, c); g.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    dotGrid(t, 'rgba(0,79,198,0.07)');
  }
  function dotGrid(t, color) {
    ctx.fillStyle = color;
    const s = 64, off = (t * 8) % s;
    for (let y = -s + off; y < H + s; y += s) for (let x = s / 2; x < W; x += s) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); }
  }

  // ---------- logo ----------
  // The mark images share a 600x590 frame; visual centre ~ (299, 295).
  const MARK_W = 600, MARK_H = 590, MCX = 299, MCY = 295;
  const off = document.createElement('canvas'); off.width = MARK_W; off.height = MARK_H;
  const octx = off.getContext('2d');
  /* parts: {t:{x,y,a,s}, a:{x,y,a}, c:{reveal, s, a}, shine:0..1, tint} */
  function drawMark(cx, cy, scale, parts = {}, alpha = 1) {
    octx.clearRect(0, 0, MARK_W, MARK_H);
    const pa = parts.a || {}, pt = parts.t || {}, pc = parts.c || {};
    const drawPart = (im, st, trail) => {
      const a = st.a ?? 1; if (a <= 0) return;
      if (trail) for (let k = 3; k >= 1; k--) {
        octx.globalAlpha = a * 0.13 * (4 - k) / 3;
        octx.drawImage(im, (st.x || 0) - trail[0] * k, (st.y || 0) - trail[1] * k);
      }
      octx.globalAlpha = a;
      octx.save();
      const s = st.s ?? 1;
      octx.translate(MCX + (st.x || 0), MCY + (st.y || 0)); octx.rotate(st.r || 0); octx.scale(s, s); octx.translate(-MCX, -MCY);
      octx.drawImage(im, 0, 0);
      octx.restore();
    };
    drawPart(img.a, pa, pa.trail);
    drawPart(img.t, pt, pt.trail);
    const rev = pc.reveal ?? 1;
    if (rev > 0 && (pc.a ?? 1) > 0) {
      octx.save(); octx.beginPath();
      octx.rect(300, 300, 5 + (230 * rev), 260); octx.clip();
      const s = pc.s ?? 1; octx.globalAlpha = pc.a ?? 1;
      octx.translate(415, 437); octx.scale(s, s); octx.translate(-415, -437);
      octx.drawImage(img.c, 0, 0); octx.restore();
    }
    octx.globalAlpha = 1;
    if (parts.tint) { octx.globalCompositeOperation = 'source-atop'; octx.fillStyle = parts.tint; octx.fillRect(0, 0, MARK_W, MARK_H); }
    if (parts.shine > 0 && parts.shine < 1) {
      octx.globalCompositeOperation = 'source-atop';
      const sx = lerp(-300, 900, parts.shine);
      const g = octx.createLinearGradient(sx - 160, 0, sx + 160, 0);
      g.addColorStop(0, 'rgba(160,200,255,0)'); g.addColorStop(0.5, 'rgba(160,200,255,0.75)'); g.addColorStop(1, 'rgba(160,200,255,0)');
      octx.save(); octx.translate(300, 295); octx.rotate(-0.6); octx.translate(-300, -295);
      octx.fillStyle = g; octx.fillRect(-400, -400, 1400, 1400); octx.restore();
    }
    octx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    if (parts.shadow) { shadow('rgba(0,20,70,0.35)', 60, 24); }
    ctx.drawImage(off, -MCX, -MCY);
    ctx.restore();
  }
  // screen position of the check-mark centre for a mark drawn at (cx,cy,scale)
  const checkPos = (cx, cy, s) => [cx + (415 - MCX) * s, cy + (437 - MCY) * s];

  // ---------- icons (line icons, centred on x,y, size s) ----------
  const ICON = {
    pen(x, y, s, c) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 4); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round';
      rr(-s * 0.12, -s * 0.42, s * 0.24, s * 0.56, s * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.14); ctx.lineTo(0, s * 0.42); ctx.lineTo(s * 0.12, s * 0.14); ctx.closePath(); ctx.stroke();
      ctx.restore();
    },
    chart(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
      [[-0.28, 0.1], [0, -0.12], [0.28, -0.32]].forEach(([dx, top]) => line(x + dx * s, y + s * 0.34, x + dx * s, y + top * s, c, s * 0.13));
      ctx.restore();
    },
    phone(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; rr(x - s * 0.22, y - s * 0.38, s * 0.44, s * 0.76, s * 0.09); ctx.stroke();
      line(x - s * 0.06, y + s * 0.26, x + s * 0.06, y + s * 0.26, c, s * 0.08); ctx.restore();
    },
    film(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; rr(x - s * 0.38, y - s * 0.28, s * 0.76, s * 0.56, s * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - s * 0.08, y - s * 0.13); ctx.lineTo(x + s * 0.16, y); ctx.lineTo(x - s * 0.08, y + s * 0.13); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.restore();
    },
    printer(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round';
      rr(x - s * 0.4, y - s * 0.12, s * 0.8, s * 0.36, s * 0.08); ctx.stroke();
      ctx.strokeRect(x - s * 0.22, y - s * 0.4, s * 0.44, s * 0.28);
      ctx.fillStyle = C.white; ctx.fillRect(x - s * 0.22, y + s * 0.08, s * 0.44, s * 0.32); ctx.strokeRect(x - s * 0.22, y + s * 0.08, s * 0.44, s * 0.32);
      ctx.restore();
    },
    doc(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; rr(x - s * 0.3, y - s * 0.38, s * 0.6, s * 0.76, s * 0.08); ctx.stroke();
      [-0.14, 0.02, 0.18].forEach((d, i) => line(x - s * 0.14, y + d * s, x + s * (i === 2 ? 0.02 : 0.14), y + d * s, c, s * 0.08)); ctx.restore();
    },
    table(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.08; rr(x - s * 0.38, y - s * 0.32, s * 0.76, s * 0.64, s * 0.08); ctx.stroke();
      line(x - s * 0.38, y - s * 0.08, x + s * 0.38, y - s * 0.08, c, s * 0.07); line(x - s * 0.38, y + s * 0.12, x + s * 0.38, y + s * 0.12, c, s * 0.07);
      line(x - s * 0.08, y - s * 0.32, x - s * 0.08, y + s * 0.32, c, s * 0.07); ctx.restore();
    },
    calendar(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; rr(x - s * 0.36, y - s * 0.3, s * 0.72, s * 0.66, s * 0.1); ctx.stroke();
      line(x - s * 0.36, y - s * 0.08, x + s * 0.36, y - s * 0.08, c, s * 0.08);
      line(x - s * 0.18, y - s * 0.4, x - s * 0.18, y - s * 0.22, c, s * 0.09); line(x + s * 0.18, y - s * 0.4, x + s * 0.18, y - s * 0.22, c, s * 0.09);
      circle(x + s * 0.12, y + s * 0.14, s * 0.07, c); ctx.restore();
    },
    image(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round'; rr(x - s * 0.38, y - s * 0.3, s * 0.76, s * 0.6, s * 0.1); ctx.stroke();
      circle(x + s * 0.14, y - s * 0.1, s * 0.07, c);
      ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.22); ctx.lineTo(x - s * 0.08, y); ctx.lineTo(x + s * 0.12, y + s * 0.2); ctx.stroke(); ctx.restore();
    },
    mail(x, y, s, c) {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round'; rr(x - s * 0.38, y - s * 0.26, s * 0.76, s * 0.52, s * 0.08); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - s * 0.34, y - s * 0.2); ctx.lineTo(x, y + s * 0.06); ctx.lineTo(x + s * 0.34, y - s * 0.2); ctx.stroke(); ctx.restore();
    },
    chat(x, y, s, c) {
      ctx.save(); ctx.fillStyle = c; ctx.beginPath();
      ctx.roundRect(x - s * 0.42, y - s * 0.34, s * 0.84, s * 0.6, s * 0.2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 0.22, y + s * 0.2); ctx.lineTo(x - s * 0.3, y + s * 0.42); ctx.lineTo(x + s * 0.02, y + s * 0.22); ctx.fill();
      [-0.18, 0, 0.18].forEach(d => circle(x + d * s, y - s * 0.04, s * 0.055, C.white)); ctx.restore();
    },
  };

  // =====================================================================
  // SCENE 1 — Logo reveal + tagline (0–5s)
  // =====================================================================
  function logoIntroParts(t, t0) {
    const pA = E.outExpo(P(t, t0 + 0.2, t0 + 1.05));
    const pT = E.outBack(P(t, t0 + 0.6, t0 + 1.15));
    const pC = E.outCubic(P(t, t0 + 1.0, t0 + 1.4));
    const d = (1 - pA) * 620;
    return {
      a: { x: -d, y: d, a: P(t, t0 + 0.2, t0 + 0.4), trail: pA < 0.98 ? [-(1 - pA) * 120, (1 - pA) * 120] : null },
      t: { x: (1 - pT) * -260, a: P(t, t0 + 0.6, t0 + 0.8) },
      c: { reveal: pC, s: 1 + 0.18 * bump(t, t0 + 1.3, t0 + 1.65) },
      shine: P(t, t0 + 1.55, t0 + 2.35),
      shadow: true,
    };
  }
  function scene1(t) {
    bgBlue(t);
    const lift = E.inOutCubic(P(t, 1.85, 2.6));
    const cx = 540, cy = lerp(880, 760, lift);
    const sc = lerp(0.72, 0.6, lift) * (1 + 0.02 * Math.sin(t * 1.4));
    // glow + rings behind the mark
    const gp = P(t, 0.9, 2.2);
    if (gp > 0) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 520);
      g.addColorStop(0, `rgba(140,190,255,${0.35 * Math.min(1, gp * 2)})`); g.addColorStop(1, 'rgba(140,190,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    for (let k = 0; k < 2; k++) {
      const rp = P(t, 1.35 + k * 0.18, 2.3 + k * 0.18);
      if (rp > 0 && rp < 1) {
        ctx.beginPath(); ctx.arc(cx, cy, 200 + E.outCubic(rp) * 420, 0, TAU);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - rp)})`; ctx.lineWidth = 6 * (1 - rp) + 1; ctx.stroke();
      }
    }
    // exit: slight anticipation before the circle wipe
    const ex = E.inBack(P(t, 4.25, 4.9));
    drawMark(cx, cy - ex * 40, sc * (1 - ex * 0.15), logoIntroParts(t, 0), 1);
    // sparkles
    const sp = [[-250, -210, 0], [260, -250, 0.1], [330, 40, 0.2], [-330, 30, 0.15], [-120, -300, 0.25], [120, -330, 0.3]];
    sp.forEach(([dx, dy, d]) => { const b = bump(t, 1.45 + d, 2.4 + d); sparkle(cx + dx, cy + dy - lift * 20, 26 * b, C.white, b); });

    // wordmark
    const wy = cy + 310;
    ctx.save(); ctx.globalAlpha = 1 - ex;
    kLine('Taskkora', 540, wy, t, 2.0, { size: 150, color: C.white, stagger: 0, dur: 0.8, spacing: -4 });
    kLine('Ada Task?', 540, wy + 115, t, 2.75, { size: 64, weight: 700, color: 'rgba(255,255,255,0.88)', stagger: 0.1 });
    ctx.restore();
    // tagline pill
    const pp = E.outBackS(P(t, 3.15, 3.7));
    if (pp > 0) {
      ctx.save(); ctx.globalAlpha *= 1 - ex;
      ctx.font = font(800, 70); ctx.letterSpacing = '-1px';
      const tw = ctx.measureText('Taskkora-in Aja!').width;
      const pw = tw + 110, ph = 128, py = wy + 250;
      ctx.translate(540, py); ctx.scale(lerp(0.2, 1, pp), pp); ctx.rotate(-0.025 * (1 - P(t, 3.7, 4.2)));
      shadow('rgba(0,20,70,0.35)', 50, 20); rr(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fillStyle = C.white; ctx.fill(); noShadow();
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= 1 - ex;
      kLine('Taskkora-in Aja!', 540, py + 25, t, 3.35, { size: 70, color: C.blue, stagger: 0.08, spacing: -1 });
      // little check that pops at the end of the pill
      const cp = E.outBackS(P(t, 3.8, 4.15));
      if (cp > 0) {
        ctx.save(); ctx.translate(540 + pw / 2 - 8, py - ph / 2 + 8); ctx.scale(cp, cp);
        circle(0, 0, 36, C.amber); drawCheck(0, 0, 38, C.white, 8, P(t, 3.9, 4.2)); ctx.restore();
      }
      ctx.restore();
    }
  }

  // =====================================================================
  // SCENE 2 — "Punya banyak task?" (5–12s)
  // =====================================================================
  const TASKS = [
    { icon: 'pen', x: 205, y: 700, r: -8, from: [-1, -0.4] },
    { icon: 'chart', x: 880, y: 690, r: 7, from: [1, -0.5] },
    { icon: 'film', x: 165, y: 890, r: 5, from: [-1, 0] },
    { icon: 'printer', x: 915, y: 885, r: -6, from: [1, 0.1] },
    { icon: 'doc', x: 540, y: 760, r: 3, from: [0, -1] },
    { icon: 'phone', x: 215, y: 1080, r: -5, from: [-1, 0.3] },
    { icon: 'table', x: 870, y: 1075, r: 6, from: [1, 0.3] },
    { icon: 'calendar', x: 175, y: 1265, r: 4, from: [-1, 0.6] },
    { icon: 'mail', x: 905, y: 1260, r: -7, from: [1, 0.6] },
    { icon: 'image', x: 540, y: 1575, r: -3, from: [0, 1] },
  ];
  const TASK_IN = i => 5.35 + i * 0.42;
  const CARD_W = 250, CARD_H = 118;
  function taskCard(icon, w, h, stress = 0) {
    card(-w / 2, -h / 2, w, h, 28);
    rr(-w / 2 + 18, -h / 2 + 18, h - 36, h - 36, 20); ctx.fillStyle = C.sky; ctx.fill();
    ICON[icon](-w / 2 + h / 2, 0, (h - 36) * 0.72, C.blue);
    const lx = -w / 2 + h + 2;
    rr(lx, -22, w * 0.42, 14, 7); ctx.fillStyle = C.ink; ctx.globalAlpha *= 0.85; ctx.fill(); ctx.globalAlpha /= 0.85;
    rr(lx, 6, w * 0.3, 12, 6); ctx.fillStyle = C.line; ctx.fill();
    circle(w / 2 - 22, -h / 2 + 22, 9 + stress * 2, C.coral);
  }
  function person(t, dy) {
    ctx.save(); ctx.translate(0, dy);
    const cx = 540, desk = 1420;
    const look = Math.sin(t * 1.3) * 10 + Math.sin(t * 3.1) * 3 * P(t, 8.5, 10);
    const stress = P(t, 7.5, 10);
    // chair back
    rr(cx - 175, 1100, 350, 360, 70); ctx.fillStyle = '#C9D7F1'; ctx.fill();
    // torso
    ctx.beginPath(); ctx.moveTo(cx - 150, desk); ctx.lineTo(cx - 150, 1250); ctx.quadraticCurveTo(cx - 150, 1150, cx - 60, 1150);
    ctx.lineTo(cx + 60, 1150); ctx.quadraticCurveTo(cx + 150, 1150, cx + 150, 1250); ctx.lineTo(cx + 150, desk); ctx.closePath();
    ctx.fillStyle = C.blue; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 40, 1150); ctx.quadraticCurveTo(cx, 1195, cx + 40, 1150); ctx.fillStyle = C.blueD; ctx.fill();
    // neck
    rr(cx - 24, 1105, 48, 55, 16); ctx.fillStyle = C.skin2; ctx.fill();
    // head
    const hx = cx + look, hy = 1040 + Math.sin(t * 2) * 3;
    circle(hx - 78, hy + 8, 16, C.skin); circle(hx + 78, hy + 8, 16, C.skin);
    circle(hx, hy, 80, C.skin);
    // hair
    ctx.beginPath(); ctx.arc(hx, hy - 6, 84, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(hx + 40, hy - 50, hx - 10, hy - 42);
    ctx.quadraticCurveTo(hx - 60, hy - 36, hx - 82, hy + 4); ctx.closePath(); ctx.fillStyle = C.hair; ctx.fill();
    // eyes (blink)
    const blink = [6.2, 8.1, 9.6, 10.6].some(b => t > b && t < b + 0.14) ? 0.15 : 1;
    const ex = look * 0.35;
    ctx.save(); ctx.fillStyle = C.hair;
    [[-28, 10], [28, 10]].forEach(([dx, dyy]) => { ctx.beginPath(); ctx.ellipse(hx + dx + ex, hy + dyy, 8, 10 * blink, 0, 0, TAU); ctx.fill(); });
    ctx.restore();
    // brows get worried
    const bt = lerp(0, 0.35, stress);
    ctx.save(); ctx.strokeStyle = C.hair; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 42 + ex, hy - 16 + bt * 20); ctx.lineTo(hx - 16 + ex, hy - 18 - bt * 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 42 + ex, hy - 16 + bt * 20); ctx.lineTo(hx + 16 + ex, hy - 18 - bt * 14); ctx.stroke();
    // mouth: smile -> wavy
    ctx.beginPath();
    if (stress < 0.5) { ctx.arc(hx + ex, hy + 32, 16, 0.15 * Math.PI, 0.85 * Math.PI); }
    else { ctx.moveTo(hx - 16 + ex, hy + 44); ctx.bezierCurveTo(hx - 6 + ex, hy + 36, hx + 6 + ex, hy + 52, hx + 16 + ex, hy + 44); }
    ctx.stroke(); ctx.restore();
    // cheeks
    circle(hx - 50 + ex, hy + 30, 11, 'rgba(255,120,120,0.25)'); circle(hx + 50 + ex, hy + 30, 11, 'rgba(255,120,120,0.25)');
    // sweat drop
    const sw = P(t, 8.2, 9.4);
    if (sw > 0) {
      const sx = hx + 92, sy = hy - 30 + E.inCubic(sw) * 70; const a = sw < 0.85 ? 1 : (1 - sw) / 0.15;
      ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.moveTo(sx, sy - 22); ctx.quadraticCurveTo(sx + 14, sy, sx, sy + 8); ctx.quadraticCurveTo(sx - 14, sy, sx, sy - 22);
      ctx.fillStyle = C.blueXL; ctx.fill(); ctx.restore();
    }
    // stress scribble
    const sc = P(t, 8.6, 9.2);
    if (sc > 0) {
      ctx.save(); ctx.translate(hx, hy - 150); ctx.rotate(t * 3); ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.globalAlpha *= 0.75;
      ctx.beginPath();
      for (let a = 0; a < TAU * 3 * E.outCubic(sc); a += 0.1) { const r = 26 + Math.sin(a * 2.3) * 10; ctx.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 0.7); }
      ctx.stroke(); ctx.restore();
    }
    // desk
    ctx.save(); shadow('rgba(0,43,117,0.12)', 30, 10);
    rr(70, desk, 940, 44, 22); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
    const dg = ctx.createLinearGradient(0, desk + 44, 0, desk + 260);
    dg.addColorStop(0, 'rgba(0,79,198,0.10)'); dg.addColorStop(1, 'rgba(0,79,198,0)');
    ctx.fillStyle = dg; ctx.fillRect(110, desk + 44, 860, 220);
    // laptop (back facing us)
    ctx.save(); shadow('rgba(0,43,117,0.15)', 20, 6);
    rr(cx - 170, desk - 185, 340, 190, 22); ctx.fillStyle = '#E4EBF8'; ctx.fill(); ctx.restore();
    rr(cx - 190, desk - 6, 380, 12, 6); ctx.fillStyle = '#C9D7F1'; ctx.fill();
    drawMark(cx, desk - 92, 0.12, { tint: C.blue }, 0.9);
    // hands
    circle(cx - 205, desk - 6, 26, C.skin); circle(cx + 205, desk - 6, 26, C.skin);
    // notification badge
    const n = Math.round(lerp(1, 99, E.inCubic(P(t, 5.3, 9.6))));
    let pulse = 0; TASKS.forEach((_, i) => { pulse = Math.max(pulse, bump(t, TASK_IN(i) + 0.25, TASK_IN(i) + 0.5)); });
    const bs = 1 + pulse * 0.25;
    ctx.save(); ctx.translate(cx + 160, desk - 180); ctx.scale(bs, bs);
    const label = n >= 99 ? '99+' : String(n);
    ctx.font = font(800, 38); const bw = Math.max(64, ctx.measureText(label).width + 36);
    shadow('rgba(255,80,80,0.4)', 20, 6); rr(-bw / 2, -32, bw, 64, 32); ctx.fillStyle = C.coral; ctx.fill(); noShadow();
    ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2); ctx.restore();
    // mug with steam
    const mx = 880;
    rr(mx - 38, desk - 88, 76, 88, 16); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.sky; ctx.stroke();
    rr(mx - 38, desk - 60, 76, 18, 0); ctx.fillStyle = C.blueXL; ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 42, desk - 46, 18, -Math.PI / 2, Math.PI / 2); ctx.lineWidth = 9; ctx.strokeStyle = C.white; ctx.stroke();
    for (let k = 0; k < 2; k++) {
      ctx.beginPath(); const sx = mx - 12 + k * 24;
      for (let yy = 0; yy < 60; yy += 4) ctx.lineTo(sx + Math.sin(yy * 0.12 + t * 4 + k) * 7, desk - 100 - yy);
      ctx.strokeStyle = `rgba(138,150,173,0.45)`; ctx.lineWidth = 5; ctx.stroke();
    }
    // plant
    const px = 195;
    [[-0.5, 70], [0, 90], [0.5, 70], [-0.9, 55], [0.9, 55]].forEach(([a, l]) => {
      ctx.save(); ctx.translate(px, desk - 70); ctx.rotate(a * 0.6 + Math.sin(t * 1.5 + a) * 0.05);
      ctx.beginPath(); ctx.ellipse(0, -l / 2, 16, l / 2, 0, 0, TAU); ctx.fillStyle = C.mint; ctx.fill(); ctx.restore();
    });
    rr(px - 44, desk - 80, 88, 80, [8, 8, 24, 24]); ctx.fillStyle = C.amber; ctx.fill();
    ctx.restore();
  }
  function scene2(t) {
    bgCream(t);
    const pDy = (1 - E.outCubic(P(t, 4.6, 5.5))) * 500 + E.inCubic(P(t, 10.7, 11.5)) * 1400;
    person(t, pDy);
    // title
    kLine('Punya banyak', 540, 420, t, 5.9, { size: 104, color: C.ink, out: 10.8 });
    kLine('task?', 540, 548, t, 6.25, { size: 116, color: C.white, out: 10.9, hl: { 0: { bg: C.blue, color: C.white } } });
    // flying task cards
    const merge = P(t, 10.95, 11.85);
    TASKS.forEach((c, i) => {
      const t0 = TASK_IN(i), p = E.outBack(P(t, t0, t0 + 0.6));
      if (p <= 0) return;
      const jit = P(t, 8.4, 10) * (1 - merge);
      let x = c.x + c.from[0] * (1 - p) * 700 + Math.sin(t * 17 + i * 3) * 4 * jit;
      let y = c.y + c.from[1] * (1 - p) * 700 + Math.sin(t * 1.6 + i) * 10 + Math.cos(t * 19 + i) * 3 * jit;
      let r = (c.r + (1 - p) * c.from[0] * 30) * Math.PI / 180;
      let s = 1;
      const m = E.inOutCubic(clamp(merge * 1.25 - i * 0.025));
      x = lerp(x, 540, m); y = lerp(y, 860, m); r = lerp(r, r + (i % 2 ? 1 : -1) * 1.2, m); s = lerp(1, 0.35, m);
      if (m >= 1) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.scale(s, s); ctx.globalAlpha *= clamp(P(t, t0, t0 + 0.2)) * (1 - E.inCubic(m));
      taskCard(c.icon, CARD_W, CARD_H, jit);
      ctx.restore();
    });
  }

  // =====================================================================
  // SCENE 3 — Services (12–22s)
  // =====================================================================
  const SERVICES = ['Design', 'Data', 'Digital', 'Editing', 'Printing'];
  const SV0 = 12, SVD = 2; // start, per-service duration
  const CARD = { x: 540, y: 830, s: 680 };

  function svDesign(lt) {
    rr(70, 100, 540, 480, 34); ctx.fillStyle = C.soft; ctx.fill();
    // shapes
    const s1 = E.outBackS(P(lt, 0.15, 0.55)); circle(190, 220, 62 * s1, C.sky);
    const s2 = E.outBackS(P(lt, 0.3, 0.7));
    ctx.save(); ctx.translate(500, 450); ctx.rotate((1 - s2) * 1.2 + 0.2); ctx.scale(s2, s2); rr(-50, -50, 100, 100, 22); ctx.fillStyle = C.amber; ctx.fill(); ctx.restore();
    // bezier stroke drawn by a pen
    const p0 = [130, 470], c1 = [220, 110], c2 = [460, 560], p1 = [560, 190];
    const bz = u => { const v = 1 - u; return [0, 1].map(k => v * v * v * p0[k] + 3 * v * v * u * c1[k] + 3 * v * u * u * c2[k] + u * u * u * p1[k]); };
    const pd = E.inOutCubic(P(lt, 0.2, 1.15));
    ctx.save(); ctx.beginPath(); ctx.moveTo(...p0);
    for (let u = 0; u <= pd + 1e-6; u += 0.01) ctx.lineTo(...bz(Math.min(u, pd)));
    ctx.strokeStyle = C.blue; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
    // handles
    const hp = E.outCubic(P(lt, 1.0, 1.35));
    if (hp > 0) {
      ctx.save(); ctx.globalAlpha *= hp; ctx.setLineDash([10, 10]);
      line(p0[0], p0[1], c1[0], c1[1], C.gray, 3); line(p1[0], p1[1], c2[0], c2[1], C.gray, 3); ctx.setLineDash([]);
      [p0, p1].forEach(([x, y]) => { ctx.fillStyle = C.white; ctx.strokeStyle = C.blue; ctx.lineWidth = 5; ctx.fillRect(x - 14, y - 14, 28, 28); ctx.strokeRect(x - 14, y - 14, 28, 28); });
      [c1, c2].forEach(([x, y]) => { circle(x, y, 12, C.blue); });
      ctx.restore();
    }
    // pen following the stroke
    if (pd > 0 && lt < 1.5) {
      const [x, y] = bz(pd), a = 1 - P(lt, 1.2, 1.5);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(-0.5);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -44); ctx.lineTo(20, -44); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
      rr(-20, -130, 40, 90, 10); ctx.fillStyle = C.ink; ctx.fill(); rr(-20, -130, 40, 22, [10, 10, 0, 0]); ctx.fillStyle = C.amber; ctx.fill();
      ctx.restore();
    }
    // swatches
    [C.blue, C.blueXL, C.amber, C.coral].forEach((c, i) => {
      const s = E.outBackS(P(lt, 1.1 + i * 0.08, 1.45 + i * 0.08));
      ctx.save(); shadow('rgba(0,43,117,0.15)', 12, 4); circle(130 + i * 70, 640, 26 * s, c); ctx.restore();
    });
  }
  function svData(lt) {
    line(100, 560, 590, 560, C.line, 6); line(100, 150, 100, 560, C.line, 6);
    const hs = [150, 230, 190, 300, 380];
    const tops = [];
    hs.forEach((h, i) => {
      const p = E.outBackS(P(lt, 0.15 + i * 0.1, 0.65 + i * 0.1));
      const x = 150 + i * 90, hh = h * p;
      rr(x, 560 - hh, 60, Math.max(0, hh), [16, 16, 4, 4]); ctx.fillStyle = i === 4 ? C.blue : i % 2 ? C.blueXL : C.sky; ctx.fill();
      tops.push([x + 30, 560 - h - 36]);
    });
    const lp = E.inOutCubic(P(lt, 0.75, 1.35));
    if (lp > 0) {
      ctx.save(); ctx.beginPath();
      const n = tops.length - 1, upto = lp * n;
      ctx.moveTo(...tops[0]);
      for (let i = 1; i <= Math.ceil(upto); i++) { const f = Math.min(1, upto - (i - 1)); ctx.lineTo(lerp(tops[i - 1][0], tops[i][0], f), lerp(tops[i - 1][1], tops[i][1], f)); }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
      tops.forEach(([x, y], i) => { if (upto >= i - 0.01) { circle(x, y, 13, C.white); ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.stroke(); } });
    }
    // donut
    const dp = E.outCubic(P(lt, 0.25, 1.2));
    ctx.save(); ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(200, 210, 58, 0, TAU); ctx.strokeStyle = C.sky; ctx.stroke();
    ctx.beginPath(); ctx.arc(200, 210, 58, -Math.PI / 2, -Math.PI / 2 + TAU * 0.72 * dp); ctx.strokeStyle = C.amber; ctx.stroke(); ctx.restore();
    // growth badge
    const bp = E.outBackS(P(lt, 1.25, 1.6));
    if (bp > 0) {
      ctx.save(); ctx.translate(500, 130); ctx.scale(bp, bp); shadow('rgba(0,43,117,0.2)', 20, 8);
      rr(-90, -40, 180, 80, 40); ctx.fillStyle = C.blue; ctx.fill(); noShadow();
      ctx.beginPath(); ctx.moveTo(-58, 14); ctx.lineTo(-40, -14); ctx.lineTo(-22, 14); ctx.closePath(); ctx.fillStyle = C.amber; ctx.fill();
      ctx.font = font(800, 38); ctx.fillStyle = C.white; ctx.textBaseline = 'middle'; ctx.fillText('48%', -8, 3); ctx.restore();
    }
  }
  function svDigital(lt) {
    // browser window behind
    const bp = E.outCubic(P(lt, 0, 0.45));
    ctx.save(); ctx.translate((1 - bp) * -200, 0); ctx.globalAlpha *= bp;
    card(60, 150, 400, 300, 28, C.soft, false);
    rr(60, 150, 400, 56, [28, 28, 0, 0]); ctx.fillStyle = C.sky; ctx.fill();
    [0, 1, 2].forEach(i => circle(96 + i * 30, 178, 9, [C.coral, C.amber, C.mint][i]));
    rr(90, 230, 160, 110, 16); ctx.fillStyle = C.blueXL; ctx.fill();
    [0, 1, 2].forEach(i => { rr(270, 240 + i * 34, 150 - i * 30, 16, 8); ctx.fillStyle = C.line; ctx.fill(); });
    rr(90, 370, 330, 50, 14); ctx.fillStyle = C.line; ctx.fill();
    ctx.restore();
    // phone
    const pp = E.outBackS(P(lt, 0.1, 0.55));
    ctx.save(); ctx.translate(0, (1 - pp) * 300); ctx.globalAlpha *= clamp(pp * 2);
    ctx.save(); shadow('rgba(0,43,117,0.25)', 40, 16); rr(330, 110, 270, 500, 46); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
    rr(344, 124, 242, 472, 36); ctx.fillStyle = C.white; ctx.fill();
    rr(425, 136, 80, 18, 9); ctx.fillStyle = C.ink; ctx.fill();
    const ui = [
      [0.35, () => { rr(364, 172, 202, 60, 16); ctx.fillStyle = C.blue; ctx.fill(); circle(394, 202, 14, C.white); rr(418, 195, 80, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill(); }],
      [0.5, () => { rr(364, 248, 202, 150, 18); ctx.fillStyle = C.sky; ctx.fill(); circle(520, 290, 22, C.amber); ctx.beginPath(); ctx.moveTo(364, 398); ctx.lineTo(430, 320); ctx.lineTo(480, 370); ctx.lineTo(510, 345); ctx.lineTo(566, 398); ctx.closePath(); ctx.fillStyle = C.blueXL; ctx.fill(); }],
      [0.65, () => { rr(364, 418, 170, 16, 8); ctx.fillStyle = C.ink; ctx.fill(); rr(364, 448, 120, 14, 7); ctx.fillStyle = C.line; ctx.fill(); }],
      [0.8, () => { rr(364, 500, 202, 64, 32); ctx.fillStyle = C.blue; ctx.fill(); rr(415, 525, 100, 14, 7); ctx.fillStyle = C.white; ctx.fill(); }],
    ];
    ui.forEach(([st, f]) => { const p = E.outCubic(P(lt, st, st + 0.3)); if (p <= 0) return; ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 30); f(); ctx.restore(); });
    // tap ripple on button
    const tp = P(lt, 1.15, 1.6);
    if (tp > 0 && tp < 1) { ctx.beginPath(); ctx.arc(465, 532, 20 + tp * 90, 0, TAU); ctx.strokeStyle = `rgba(0,79,198,${0.6 * (1 - tp)})`; ctx.lineWidth = 6; ctx.stroke(); }
    const fp = E.outCubic(P(lt, 0.9, 1.15)) * (1 - P(lt, 1.5, 1.8));
    if (fp > 0) { ctx.save(); ctx.globalAlpha *= fp; circle(470 + (1 - fp) * 80, 545 + (1 - fp) * 80, 30, 'rgba(11,27,63,0.25)'); circle(470 + (1 - fp) * 80, 545 + (1 - fp) * 80, 18, C.white); ctx.restore(); }
    ctx.restore();
    // notification toast
    const np = E.outBackS(P(lt, 1.3, 1.65));
    if (np > 0) {
      ctx.save(); ctx.translate(250, 560); ctx.scale(np, np); shadow('rgba(0,43,117,0.22)', 30, 10);
      rr(-170, -48, 340, 96, 26); ctx.fillStyle = C.white; ctx.fill(); noShadow();
      circle(-118, 0, 30, C.blue); drawCheck(-118, 0, 32, C.white, 7, P(lt, 1.45, 1.75));
      rr(-72, -18, 180, 14, 7); ctx.fillStyle = C.ink; ctx.fill(); rr(-72, 8, 120, 12, 6); ctx.fillStyle = C.line; ctx.fill();
      ctx.restore();
    }
  }
  function svEditing(lt) {
    // monitor
    ctx.save(); rr(70, 90, 540, 300, 30); ctx.clip();
    const g = ctx.createLinearGradient(0, 90, 0, 390); g.addColorStop(0, C.blueL); g.addColorStop(1, C.blueXL);
    ctx.fillStyle = g; ctx.fillRect(70, 90, 540, 300);
    const ph = P(lt, 0.2, 1.9);
    circle(470 - ph * 60, 190 + ph * 20, 40, C.amber);
    ctx.beginPath(); ctx.moveTo(70, 390); ctx.lineTo(210 - ph * 30, 240); ctx.lineTo(320 - ph * 30, 340); ctx.lineTo(420 - ph * 50, 260); ctx.lineTo(640, 390); ctx.closePath(); ctx.fillStyle = C.blueD; ctx.fill();
    ctx.beginPath(); ctx.moveTo(70, 390); ctx.lineTo(150 - ph * 70, 320); ctx.lineTo(290 - ph * 70, 390); ctx.closePath(); ctx.fillStyle = C.blueDD; ctx.fill();
    ctx.restore();
    // play icon
    const pl = 1 - P(lt, 0.15, 0.4);
    if (pl > 0) { ctx.save(); ctx.globalAlpha *= pl; circle(340, 240, 46, 'rgba(255,255,255,0.9)'); ctx.beginPath(); ctx.moveTo(328, 218); ctx.lineTo(362, 240); ctx.lineTo(328, 262); ctx.closePath(); ctx.fillStyle = C.blue; ctx.fill(); ctx.restore(); }
    // progress bar in monitor
    rr(100, 360, 480, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    rr(100, 360, 480 * ph, 8, 4); ctx.fillStyle = C.white; ctx.fill();
    // timeline tracks
    const cut = E.outCubic(P(lt, 0.95, 1.25));
    const tracks = [
      [[100, 250, C.blue], [360, 220, C.blue]],
      [[100, 160, C.blueXL], [280, 300, C.blueXL]],
      [[100, 480, C.amber]],
    ];
    tracks.forEach((clips, r) => {
      const y = 430 + r * 58;
      rr(100, y, 480, 44, 12); ctx.fillStyle = C.soft; ctx.fill();
      clips.forEach(([x, w, c], k) => {
        let xx = x, ww = w;
        if (r === 0) { if (k === 0) ww -= 0; else { xx += cut * 18; ww -= cut * 18; } }
        const ap = E.outCubic(P(lt, 0.05 + r * 0.08 + k * 0.05, 0.4 + r * 0.08 + k * 0.05));
        rr(xx, y + 4, Math.max(0, (ww - 6) * ap), 36, 10); ctx.fillStyle = c; ctx.fill();
      });
    });
    // playhead
    const px = 100 + ph * 480;
    line(px, 418, px, 610, C.coral, 5); ctx.beginPath(); ctx.moveTo(px - 14, 408); ctx.lineTo(px + 14, 408); ctx.lineTo(px, 426); ctx.closePath(); ctx.fillStyle = C.coral; ctx.fill();
    // scissors at the cut
    const sp = bump(lt, 0.8, 1.5);
    if (sp > 0) {
      ctx.save(); ctx.translate(360, 410); ctx.scale(sp, sp); circle(0, 0, 38, C.ink);
      ctx.strokeStyle = C.white; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const o = Math.sin(lt * 20) * 0.25 + 0.3;
      [-1, 1].forEach(sg => { ctx.save(); ctx.rotate(sg * o); line(-16, 0, 18, 0, C.white, 6); ctx.beginPath(); ctx.arc(-20, sg * 8, 7, 0, TAU); ctx.stroke(); ctx.restore(); });
      ctx.restore();
    }
  }
  function svPrinting(lt) {
    const out = E.inOutCubic(P(lt, 0.35, 1.3));
    // paper tray (in)
    rr(210, 110, 260, 120, 12); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.line; ctx.stroke();
    // printed paper coming out (drawn before body front so it emerges from slot)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 360, 680, 400); ctx.clip();
    const py = 330 + out * 240;
    ctx.save(); shadow('rgba(0,43,117,0.15)', 16, 6); rr(200, py - 220, 280, 240, 12); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
    rr(222, py - 200, 236, 70, 10); ctx.fillStyle = C.blue; ctx.fill();
    circle(262, py - 165, 18, C.amber);
    rr(222, py - 115, 180, 14, 7); ctx.fillStyle = C.ink; ctx.fill();
    rr(222, py - 88, 236, 12, 6); ctx.fillStyle = C.line; ctx.fill();
    rr(222, py - 64, 200, 12, 6); ctx.fillStyle = C.line; ctx.fill();
    rr(222, py - 38, 110, 34, 12); ctx.fillStyle = C.blueXL; ctx.fill();
    ctx.restore();
    // printer body
    ctx.save(); shadow('rgba(0,43,117,0.2)', 30, 12); rr(110, 190, 460, 190, 40); ctx.fillStyle = '#E4EBF8'; ctx.fill(); ctx.restore();
    rr(110, 190, 460, 60, [40, 40, 0, 0]); ctx.fillStyle = C.sky; ctx.fill();
    rr(170, 340, 340, 22, 11); ctx.fillStyle = C.ink; ctx.fill();
    const blink = Math.sin(lt * 14) > 0 && lt < 1.3;
    circle(510, 290, 13, blink ? C.mint : '#B8C4DA');
    rr(150, 280, 110, 16, 8); ctx.fillStyle = '#C9D7F1'; ctx.fill();
    // done badge
    const bp = E.outBackS(P(lt, 1.35, 1.7));
    if (bp > 0) { ctx.save(); ctx.translate(500, 540); ctx.scale(bp, bp); shadow('rgba(0,43,117,0.25)', 20, 8); circle(0, 0, 42, C.blue); noShadow(); drawCheck(0, 0, 46, C.white, 9, P(lt, 1.45, 1.75)); ctx.restore(); }
  }
  const SV_FN = [svDesign, svData, svDigital, svEditing, svPrinting];

  function scene3(t, noBg = false) {
    if (!noBg) bgCream(t);
    // section pill
    pill('Jasa Digital & Kreatif', 540, 330, t, 12.15, { size: 40, bg: C.white, color: C.blue, shadow: true, dot: C.amber, out: 21.45 });
    // card morph from task card
    const m = E.inOutCubic(P(t, 11.45, 12.25));
    const exit = E.inBack(P(t, 21.3, 21.9));
    const w = lerp(CARD_W, CARD.s, m), h = lerp(CARD_H, CARD.s, m);
    const cy = lerp(860, CARD.y, m);
    // flip between services
    let idx = clamp(Math.floor((t - SV0) / SVD), 0, 4), sx = 1, skew = 0, shade = 0;
    for (let k = 1; k < 5; k++) {
      const b = SV0 + k * SVD, f = P(t, b - 0.22, b + 0.22);
      if (f > 0 && f < 1) { const ang = E.inOutCubic(f) * Math.PI; sx = Math.abs(Math.cos(ang)); skew = Math.sin(ang) * 0.08 * (f < 0.5 ? 1 : -1); shade = Math.sin(ang) * 0.25; idx = f < 0.5 ? k - 1 : k; }
    }
    const lt = t - (SV0 + idx * SVD) + (idx === 0 ? 0 : 0.0);
    ctx.save();
    ctx.translate(CARD.x, cy - exit * 40); ctx.scale(1 - exit * 0.25, 1 - exit * 0.25); ctx.globalAlpha *= 1 - exit;
    ctx.rotate(lerp(0.05, 0, m) + Math.sin(t * 1.2) * 0.008);
    ctx.transform(sx, skew, 0, 1, 0, 0);
    ctx.save(); shadow('rgba(0,43,117,0.18)', 70, 30); rr(-w / 2, -h / 2, w, h, lerp(28, 60, m)); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
    if (m < 1) { ctx.save(); ctx.globalAlpha *= 1 - m; taskCard('pen', CARD_W, CARD_H); ctx.restore(); }
    if (m > 0.6) {
      ctx.save(); ctx.globalAlpha *= P(m, 0.6, 1); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 60); ctx.clip();
      ctx.translate(-CARD.s / 2, -CARD.s / 2);
      SV_FN[idx](Math.max(0, lt - (idx === 0 ? 0.25 : 0)));
      ctx.restore();
      // small index tag
      ctx.save(); ctx.globalAlpha *= P(m, 0.8, 1); ctx.font = font(800, 30); ctx.fillStyle = C.gray; ctx.textBaseline = 'top';
      ctx.fillText(`0${idx + 1}`, -CARD.s / 2 + 34, -CARD.s / 2 + 28); ctx.restore();
    }
    if (shade > 0) { rr(-w / 2, -h / 2, w, h, 60); ctx.fillStyle = `rgba(0,43,117,${shade})`; ctx.fill(); }
    ctx.restore();

    // big label (kinetic swap)
    SERVICES.forEach((name, i) => {
      const s = SV0 + i * SVD;
      kLine(name, 540, 1330, t, s + (i === 0 ? 0.35 : 0.02), { size: 132, color: C.blue, stagger: 0, dur: 0.55, out: i < 4 ? s + SVD - 0.28 : 21.35, spacing: -4 });
    });

    // chip row with sliding active indicator
    ctx.save();
    ctx.font = font(700, 32); ctx.letterSpacing = '0px';
    const padX = 24, gap = 12, ch = 64;
    const ws = SERVICES.map(s => ctx.measureText(s).width + padX * 2);
    const total = ws.reduce((a, b) => a + b, 0) + gap * 4;
    let x = 540 - total / 2; const cyc = 1480;
    const xs = ws.map(w0 => { const r = x; x += w0 + gap; return r; });
    const fi = clamp((t - SV0 - 0.0) / SVD, 0, 4.999);
    const i0 = Math.floor(fi), fr = E.inOutCubic(P(fi - i0, 0.89, 1));
    const i1 = Math.min(4, i0 + 1);
    const ax = lerp(xs[i0], xs[i1], fr), aw = lerp(ws[i0], ws[i1], fr);
    const rowOut = E.inCubic(P(t, 21.45, 21.85));
    SERVICES.forEach((s, i) => {
      const p = E.outBackS(P(t, 12.5 + i * 0.07, 12.95 + i * 0.07)) * (1 - rowOut);
      if (p <= 0) return;
      ctx.save(); ctx.translate(xs[i] + ws[i] / 2, cyc); ctx.scale(p, p);
      rr(-ws[i] / 2, -ch / 2, ws[i], ch, ch / 2); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.line; ctx.stroke();
      ctx.restore();
    });
    const ap = E.outCubic(P(t, 12.9, 13.2)) * (1 - rowOut);
    if (ap > 0) { ctx.save(); ctx.globalAlpha *= ap; shadow('rgba(0,79,198,0.3)', 16, 6); rr(ax, cyc - ch / 2, aw, ch, ch / 2); ctx.fillStyle = C.blue; ctx.fill(); ctx.restore(); }
    SERVICES.forEach((s, i) => {
      const p = E.outBackS(P(t, 12.5 + i * 0.07, 12.95 + i * 0.07)) * (1 - rowOut);
      if (p <= 0) return;
      const onA = clamp(1 - Math.abs((xs[i] + ws[i] / 2) - (ax + aw / 2)) / (ws[i] * 0.6)) * ap;
      ctx.save(); ctx.translate(xs[i] + ws[i] / 2, cyc); ctx.scale(p, p);
      ctx.fillStyle = C.gray; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 2);
      if (onA > 0) { ctx.globalAlpha *= onA; ctx.fillStyle = C.white; ctx.fillText(s, 0, 2); }
      ctx.restore();
    });
    ctx.restore();
  }

  // =====================================================================
  // Brand-arrow wipe: the new scene is revealed behind a chevron edge that
  // travels bottom-left -> top-right (the direction of the logo arrow).
  // =====================================================================
  function arrowWipe(p, drawNew, bandColor) {
    if (p <= 0) return;
    const diag = Math.hypot(W, H);
    const front = lerp(-diag * 0.75, diag * 0.75 + 700, p);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 4);
    const tip = 420, span = diag;
    const shape = (f) => { ctx.beginPath(); ctx.moveTo(-diag * 2, -span); ctx.lineTo(f - tip, -span); ctx.lineTo(f, 0); ctx.lineTo(f - tip, span); ctx.lineTo(-diag * 2, span); ctx.closePath(); };
    // accent band slightly ahead
    shape(front + 90); ctx.fillStyle = bandColor; ctx.fill();
    shape(front); ctx.rotate(Math.PI / 4); ctx.translate(-W / 2, -H / 2); ctx.clip();
    drawNew();
    ctx.restore();
  }

  // =====================================================================
  // SCENE 4 — Digital products (22–30s)
  // =====================================================================
  const PRODUCTS = [
    { name: 'Templates', x: 310, y: 820 },
    { name: 'Planners', x: 770, y: 820 },
    { name: 'Spreadsheets', x: 310, y: 1290 },
    { name: 'Productivity\nTools', x: 770, y: 1290 },
  ];
  const PC_W = 420, PC_H = 440;
  const PROD_IN = i => 22.85 + i * 0.3;
  function prTemplates(lt) {
    // fanned template sheets
    [[-0.18, -60, C.sky], [0.14, 60, '#E9F0FF']].forEach(([r, dx, c]) => {
      ctx.save(); ctx.translate(210 + dx, 150); ctx.rotate(r); card(-80, -100, 160, 200, 16, c, false); ctx.restore();
    });
    ctx.save(); ctx.translate(210, 145); ctx.rotate(Math.sin(lt * 1.5) * 0.03);
    card(-95, -115, 190, 230, 18, C.white);
    ctx.lineWidth = 3; ctx.strokeStyle = C.line; rr(-95, -115, 190, 230, 18); ctx.stroke();
    const blocks = [[-75, -95, 150, 26, C.blue], [-75, -58, 150, 70, C.blueXL], [-75, 24, 100, 12, C.ink], [-75, 46, 150, 10, C.line], [-75, 64, 120, 10, C.line], [-75, 84, 60, 20, C.amber]];
    blocks.forEach(([x, y, w, h, c], i) => {
      const cyc = (lt % 3.2);
      const p = E.outBackS(P(cyc, 0.1 + i * 0.1, 0.45 + i * 0.1));
      ctx.save(); ctx.globalAlpha *= clamp(p); ctx.translate(x + w / 2, y + h / 2); ctx.scale(p, p); rr(-w / 2, -h / 2, w, h, Math.min(8, h / 2)); ctx.fillStyle = c; ctx.fill(); ctx.restore();
    });
    ctx.restore();
  }
  function prPlanners(lt) {
    card(70, 50, 280, 210, 22, C.white); ctx.lineWidth = 3; ctx.strokeStyle = C.line; rr(70, 50, 280, 210, 22); ctx.stroke();
    rr(70, 50, 280, 50, [22, 22, 0, 0]); ctx.fillStyle = C.blue; ctx.fill();
    for (let i = 0; i < 5; i++) { rr(100 + i * 52, 36, 12, 30, 6); ctx.fillStyle = C.ink; ctx.fill(); }
    const cyc = lt % 3.2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = 92 + c * 42, y = 116 + r * 46, k = r * 6 + c;
      rr(x, y, 32, 34, 8); ctx.fillStyle = k === 8 ? C.amber : C.soft; ctx.fill();
      const p = P(cyc, 0.2 + k * 0.07, 0.4 + k * 0.07);
      if (p > 0 && k % 3 !== 2) drawCheck(x + 16, y + 17, 22, C.blue, 5, p);
    }
  }
  function prSheets(lt) {
    card(60, 45, 300, 220, 18, C.white); ctx.lineWidth = 3; ctx.strokeStyle = C.line; rr(60, 45, 300, 220, 18); ctx.stroke();
    ctx.save(); rr(60, 45, 300, 220, 18); ctx.clip();
    ctx.fillStyle = C.blue; ctx.fillRect(60, 45, 300, 40);
    ctx.fillStyle = C.soft; ctx.fillRect(60, 85, 44, 180);
    for (let i = 1; i < 5; i++) line(60, 85 + i * 36, 360, 85 + i * 36, C.line, 2);
    for (let i = 0; i < 4; i++) line(104 + i * 64, 45, 104 + i * 64, 265, C.line, 2);
    const cyc = lt % 3.2;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      const k = r * 4 + c, p = E.outCubic(P(cyc, 0.1 + k * 0.05, 0.35 + k * 0.05));
      const w = (c === 3 ? 30 : 40) * p * (0.5 + ((k * 37) % 10) / 20);
      if (p > 0) { rr(114 + c * 64, 97 + r * 36, w, 12, 6); ctx.fillStyle = c === 3 ? C.amber : C.blueXL; ctx.fill(); }
    }
    ctx.restore();
    // moving selection
    const sel = Math.floor((lt * 2.2) % 12), sr = sel % 4, sc = Math.floor(sel / 4) + 1;
    ctx.lineWidth = 5; ctx.strokeStyle = C.blue; ctx.strokeRect(104 + sc * 64 - 64 + 64, 85 + sr * 36, 64, 36);
  }
  function prTools(lt) {
    const cyc = lt % 3.2;
    for (let i = 0; i < 3; i++) {
      const y = 70 + i * 62, p = P(cyc, 0.3 + i * 0.35, 0.55 + i * 0.35);
      rr(50, y, 200, 48, 14); ctx.fillStyle = C.soft; ctx.fill();
      rr(62, y + 10, 28, 28, 8); ctx.fillStyle = p > 0 ? C.blue : C.white; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.blue; ctx.stroke();
      if (p > 0) drawCheck(76, y + 24, 20, C.white, 5, p);
      rr(104, y + 18, 120 - i * 20, 12, 6); ctx.fillStyle = p >= 1 ? '#B8C4DA' : C.ink; ctx.fill();
    }
    // timer ring
    const tp = (lt % 3.2) / 3.2;
    ctx.save(); ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(318, 110, 52, 0, TAU); ctx.strokeStyle = C.sky; ctx.stroke();
    ctx.beginPath(); ctx.arc(318, 110, 52, -Math.PI / 2, -Math.PI / 2 + TAU * tp); ctx.strokeStyle = C.amber; ctx.stroke(); ctx.restore();
    line(318, 110, 318 + Math.cos(tp * TAU - Math.PI / 2) * 28, 110 + Math.sin(tp * TAU - Math.PI / 2) * 28, C.ink, 6);
    // toggle
    const on = E.inOutCubic(P(cyc, 1.3, 1.6));
    rr(262, 205, 110, 56, 28); ctx.fillStyle = on > 0.5 ? C.blue : '#C9D3E6'; ctx.fill();
    circle(lerp(290, 344, on), 233, 22, C.white);
  }
  const PR_FN = [prTemplates, prPlanners, prSheets, prTools];

  function scene4(t) {
    bgBlue(t);
    kLine('Produk Digital', 540, 360, t, 22.35, { size: 104, color: C.white, out: 29.45 });
    pill('Siap Pakai', 540, 455, t, 22.7, { size: 50, weight: 800, bg: C.amber, color: C.ink, out: 29.5, spacing: 0 });
    PRODUCTS.forEach((pr, i) => {
      const t0 = PROD_IN(i), p = E.outBack(P(t, t0, t0 + 0.75));
      if (p <= 0) return;
      const ang = (1 - p) * 1.1;
      const exit = E.inBack(P(t, 29.35 + i * 0.05, 29.85 + i * 0.05));
      const bob = Math.sin(t * 1.8 + i * 1.3) * 8;
      ctx.save();
      ctx.translate(pr.x, pr.y + (1 - p) * 220 + bob + exit * 80);
      ctx.globalAlpha *= clamp(P(t, t0, t0 + 0.25)) * (1 - exit);
      ctx.transform(1, 0, Math.sin(ang) * 0.25 * (i % 2 ? -1 : 1), Math.max(0.05, Math.cos(ang)), 0, 0);
      ctx.scale(1 - exit * 0.3, 1 - exit * 0.3);
      ctx.rotate((i % 2 ? 1 : -1) * 0.012 * Math.sin(t * 1.3 + i));
      ctx.save(); shadow('rgba(0,20,70,0.35)', 60, 28); rr(-PC_W / 2, -PC_H / 2, PC_W, PC_H, 44); ctx.fillStyle = C.white; ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(-PC_W / 2, -PC_H / 2 + 12); PR_FN[i](Math.max(0, t - t0 - 0.3)); ctx.restore();
      // label
      ctx.font = font(800, 42); ctx.letterSpacing = '-1px'; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const ls = pr.name.split('\n');
      ls.forEach((l, k) => ctx.fillText(l, 0, (ls.length === 1 ? 160 : 132) + k * 48));
      // ready badge
      const bp = E.outBackS(P(t, 27.2 + i * 0.18, 27.6 + i * 0.18));
      if (bp > 0) {
        ctx.save(); ctx.translate(PC_W / 2 - 20, -PC_H / 2 + 20); ctx.scale(bp, bp); shadow('rgba(0,20,70,0.3)', 16, 6);
        circle(0, 0, 38, C.amber); noShadow(); drawCheck(0, 0, 40, C.ink, 8, P(t, 27.35 + i * 0.18, 27.7 + i * 0.18)); ctx.restore();
      }
      ctx.restore();
    });
  }

  // =====================================================================
  // SCENE 5 — Target users (30–36s)
  // =====================================================================
  const HUB = { x: 540, y: 955 };
  const PERSONAS = [
    { name: 'Students', x: 265, y: 690, draw: avStudent },
    { name: 'Researchers', x: 815, y: 690, draw: avResearcher },
    { name: 'Small Businesses', x: 280, y: 1235, draw: avBusiness },
    { name: 'More', x: 815, y: 1235, draw: avMore },
  ];
  const PER_IN = i => 30.55 + i * 0.32;
  function face(x, y, s, hairColor = C.hair, shirt = C.blue, t = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-70, 120); ctx.quadraticCurveTo(-70, 40, 0, 40); ctx.quadraticCurveTo(70, 40, 70, 120); ctx.closePath(); ctx.fillStyle = shirt; ctx.fill();
    rr(-14, 10, 28, 40, 10); ctx.fillStyle = C.skin2; ctx.fill();
    circle(0, -18, 46, C.skin);
    ctx.beginPath(); ctx.arc(0, -24, 48, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(10, -50, -30, -40); ctx.quadraticCurveTo(-44, -30, -47, -12); ctx.closePath(); ctx.fillStyle = hairColor; ctx.fill();
    const bl = (Math.sin(t * 2.3 + x) > 0.985) ? 0.15 : 1;
    ctx.fillStyle = C.hair; [-16, 16].forEach(dx => { ctx.beginPath(); ctx.ellipse(dx, -14, 5, 6 * bl, 0, 0, TAU); ctx.fill(); });
    ctx.beginPath(); ctx.arc(0, 2, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = C.hair; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    circle(-28, 4, 7, 'rgba(255,120,120,0.25)'); circle(28, 4, 7, 'rgba(255,120,120,0.25)');
    ctx.restore();
  }
  function avStudent(t) {
    face(0, 20, 1, '#3A2A20', C.blue, t);
    // graduation cap
    ctx.save(); ctx.translate(0, -44); ctx.rotate(Math.sin(t * 2) * 0.05);
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(0, -26); ctx.lineTo(70, 0); ctx.lineTo(0, 26); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
    rr(-34, 4, 68, 26, [0, 0, 12, 12]); ctx.fill();
    line(50, 4, 56 + Math.sin(t * 3) * 4, 44, C.amber, 5); circle(56 + Math.sin(t * 3) * 4, 48, 7, C.amber);
    ctx.restore();
  }
  function avResearcher(t) {
    face(0, 20, 1, '#6B4A3A', '#E9EEF7', t);
    // coat lapels
    ctx.beginPath(); ctx.moveTo(-22, 62); ctx.lineTo(0, 110); ctx.lineTo(22, 62); ctx.strokeStyle = C.gray; ctx.lineWidth = 4; ctx.stroke();
    // glasses
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-16, 6, 13, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(16, 6, 13, 0, TAU); ctx.stroke(); line(-3, 6, 3, 6, C.ink, 4);
    // flask badge
    ctx.save(); ctx.translate(62, 70); ctx.rotate(Math.sin(t * 2) * 0.1); circle(0, 0, 30, C.amber);
    ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-6, -4); ctx.lineTo(-15, 12); ctx.lineTo(15, 12); ctx.lineTo(6, -4); ctx.lineTo(6, -16); ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    const by = (t * 30) % 16; circle(2, 4 - by * 0.3, 3, C.ink);
    ctx.restore();
  }
  function avBusiness(t) {
    // storefront
    rr(-72, -20, 144, 118, 10); ctx.fillStyle = C.white; ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(-84 + i * 28, -30); ctx.lineTo(-56 + i * 28, -30); ctx.lineTo(-56 + i * 28, -8); ctx.arc(-70 + i * 28, -8, 14, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = i % 2 ? C.white : C.blue; ctx.fill();
    }
    rr(-84, -58, 168, 30, [12, 12, 0, 0]); ctx.fillStyle = C.ink; ctx.fill();
    rr(-58, 22, 50, 76, [8, 8, 0, 0]); ctx.fillStyle = C.blueXL; ctx.fill();
    rr(6, 22, 52, 40, 8); ctx.fillStyle = C.sky; ctx.fill();
    // open sign swinging
    ctx.save(); ctx.translate(32, 70); ctx.rotate(Math.sin(t * 3) * 0.12); rr(-22, 0, 44, 22, 6); ctx.fillStyle = C.amber; ctx.fill(); ctx.restore();
  }
  function avMore(t) {
    const pts = [[-40, 30, 0.62, '#3A2A20', C.blueL], [40, 30, 0.62, C.hair, C.amber], [0, 10, 0.72, '#6B4A3A', C.blue]];
    pts.forEach(([x, y, s, h, sh], i) => face(x, y + Math.sin(t * 2 + i) * 4, s, h, sh, t + i));
    const pp = 1 + Math.sin(t * 4) * 0.06;
    ctx.save(); ctx.translate(62, -52); ctx.scale(pp, pp); circle(0, 0, 28, C.blue); line(-12, 0, 12, 0, C.white, 6); line(0, -12, 0, 12, C.white, 6); ctx.restore();
  }
  function hubBadge(x, y, size, t, markScale = 0.24, shine = 0) {
    ctx.save(); shadow('rgba(0,43,117,0.3)', 50, 20); rr(x - size / 2, y - size / 2, size, size, size * 0.28); ctx.fillStyle = C.blue; ctx.fill(); ctx.restore();
    drawMark(x, y, markScale, { shine }, 1);
  }
  function scene5(t, collapse = 0) {
    bgCream(t);
    pill('Cocok untuk', 540, 330, t, 30.3, { size: 44, bg: C.blue, color: C.white, dot: C.amber, out: 35.6 });
    // connectors
    PERSONAS.forEach((pe, i) => {
      const p = E.inOutCubic(P(t, PER_IN(i) + 0.1, PER_IN(i) + 0.6)) * (1 - collapse);
      if (p <= 0) return;
      const ex = lerp(HUB.x, pe.x, p), ey = lerp(HUB.y, pe.y, p);
      ctx.save(); ctx.setLineDash([4, 22]); ctx.lineDashOffset = -t * 60; line(HUB.x, HUB.y, ex, ey, C.blue, 8); ctx.restore();
      const f = ((t * 0.7 + i * 0.25) % 1);
      if (p >= 1) circle(lerp(HUB.x, pe.x, f), lerp(HUB.y, pe.y, f), 9, C.amber);
    });
    // hub
    const hp = E.outBackS(P(t, 30.2, 30.75));
    if (hp > 0) {
      const pulse = 1 + 0.03 * Math.sin(t * 4);
      const hs = 210 * hp * pulse;
      for (let k = 0; k < 2; k++) { const rp = ((t * 0.6 + k * 0.5) % 1); ctx.beginPath(); ctx.roundRect(HUB.x - hs / 2 - rp * 80, HUB.y - hs / 2 - rp * 80, hs + rp * 160, hs + rp * 160, 60 + rp * 40); ctx.strokeStyle = `rgba(0,79,198,${0.25 * (1 - rp)})`; ctx.lineWidth = 4; ctx.stroke(); }
      hubBadge(HUB.x, HUB.y, hs, t, 0.25 * hp * pulse);
    }
    // personas
    PERSONAS.forEach((pe, i) => {
      const t0 = PER_IN(i), p = E.outBackS(P(t, t0, t0 + 0.55));
      if (p <= 0) return;
      const c = E.inBack(clamp(collapse * 1.3 - i * 0.08));
      const x = lerp(pe.x, HUB.x, c) + Math.sin(t * 1.4 + i * 2) * 6 * (1 - c), y = lerp(pe.y, HUB.y, c) + Math.cos(t * 1.2 + i) * 8 * (1 - c);
      const s = p * (1 - c);
      if (s <= 0.01) return;
      // burst ring
      const rp = P(t, t0 + 0.1, t0 + 0.7);
      if (rp > 0 && rp < 1) { ctx.beginPath(); ctx.arc(x, y, 130 + rp * 70, 0, TAU); ctx.strokeStyle = `rgba(0,79,198,${0.4 * (1 - rp)})`; ctx.lineWidth = 5; ctx.stroke(); }
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.save(); shadow('rgba(0,43,117,0.2)', 40, 16); circle(0, 0, 128, C.white); ctx.restore();
      circle(0, 0, 112, C.sky);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 112, 0, TAU); ctx.clip(); pe.draw(t); ctx.restore();
      ctx.restore();
      // label
      const lp = E.outCubic(P(t, t0 + 0.25, t0 + 0.7)) * (1 - E.inCubic(clamp(collapse * 2)));
      if (lp > 0) {
        ctx.save(); ctx.globalAlpha *= lp; ctx.font = font(800, 46); ctx.letterSpacing = '-1px'; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
        const above = pe.y < HUB.y;
        ctx.fillText(pe.name, x, above ? y - 162 - (1 - lp) * 30 : y + 188 + (1 - lp) * 30); ctx.restore();
      }
    });
  }

  // =====================================================================
  // SCENE 6 — Resolve to logo + CTA (36–40s)
  // =====================================================================
  function scene6(t) {
    const collapse = P(t, 35.7, 36.45);
    const grow = E.inOutExpo(P(t, 36.3, 37.1));
    if (grow < 1) scene5(t, collapse);
    // hub badge expands into the full blue background
    const size = lerp(210, 2600, grow), r = lerp(58, 0, grow);
    ctx.save(); rr(HUB.x - size / 2, lerp(HUB.y, 960, grow) - size / 2, size, size, r); ctx.clip();
    bgBlue(t);
    ctx.restore();
    // logo travels from hub centre to its final place
    const mv = E.inOutCubic(P(t, 36.4, 37.3));
    const cx = 540, cy = lerp(HUB.y, 720, mv), sc = lerp(0.25, 0.56, mv) * (1 + 0.015 * Math.sin(t * 1.6));
    const rp = P(t, 37.1, 37.9);
    if (rp > 0 && rp < 1) { ctx.beginPath(); ctx.arc(cx, cy, 180 + E.outCubic(rp) * 360, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - rp)})`; ctx.lineWidth = 5; ctx.stroke(); }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 500); g.addColorStop(0, `rgba(140,190,255,${0.3 * mv})`); g.addColorStop(1, 'rgba(140,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawMark(cx, cy, sc, { shine: P(t, 37.2, 37.9), shadow: true, c: { s: 1 + 0.2 * bump(t, 37.15, 37.5) } }, 1);
    [[-230, -200, 0], [240, -230, 0.1], [260, 150, 0.2], [-270, 120, 0.15]].forEach(([dx, dy, d]) => { const b = bump(t, 37.2 + d, 38.1 + d); sparkle(cx + dx, cy + dy, 24 * b, C.white, b); });

    // headline
    kLine('TASKKORA', 540, 962, t, 37.0, { size: 40, weight: 800, color: 'rgba(255,255,255,0.8)', spacing: 12, dur: 0.6 });
    kLine('Dari Task', 540, 1120, t, 37.2, { size: 118, color: C.white, stagger: 0.09 });
    const tw = kLine('Jadi Beres', 540 - 16, 1250, t, 37.5, { size: 118, color: C.white, stagger: 0.09 });
    // amber swoosh under "Beres."
    const sp = E.inOutCubic(P(t, 37.95, 38.4));
    if (sp > 0) {
      ctx.save(); ctx.font = font(800, 118); ctx.letterSpacing = '-2px';
      const bw = ctx.measureText('Beres').width, bx = 540 - 16 + tw / 2 - bw;
      ctx.beginPath(); ctx.moveTo(bx, 1285); ctx.quadraticCurveTo(bx + bw * 0.5, 1267, bx + bw * 0.95, 1279);
      ctx.strokeStyle = C.amber; ctx.lineWidth = 16; ctx.lineCap = 'round';
      const L = bw * 1.05; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - sp); ctx.stroke(); ctx.restore();
    }
    // the full stop is an amber dot that pops in
    const dp = E.outBackS(P(t, 37.95, 38.3));
    if (dp > 0) circle(540 - 16 + tw / 2 + 26, 1236, 15 * dp, C.amber);
    // CTA button
    const cp = E.outBackS(P(t, 38.25, 38.8));
    if (cp > 0) {
      const press = 1 - 0.06 * bump(t, 39.05, 39.35);
      const by = 1460;
      ctx.save(); ctx.font = font(800, 60); ctx.letterSpacing = '-1px';
      const tw2 = ctx.measureText('Chat MinTask').width, bw = tw2 + 190, bh = 136;
      // pulse rings
      for (let k = 0; k < 2; k++) {
        const pr = ((t - 38.8 + k * 0.6) % 1.2) / 1.2;
        if (t > 38.8) { ctx.save(); ctx.globalAlpha *= 0.4 * (1 - pr); rr(540 - bw / 2 - pr * 40, by - bh / 2 - pr * 40, bw + pr * 80, bh + pr * 80, bh / 2 + pr * 40); ctx.strokeStyle = C.white; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
      }
      ctx.translate(540, by); ctx.scale(cp * press, cp * press);
      shadow('rgba(0,20,70,0.4)', 50, 22); rr(-bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fillStyle = C.white; ctx.fill(); noShadow();
      ICON.chat(-bw / 2 + 88, 2, 64, C.blue);
      ctx.fillStyle = C.blue; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('Chat MinTask', -bw / 2 + 140, 4);
      ctx.restore();
      // tap finger
      const fp = E.outCubic(P(t, 38.75, 39.05)) * (1 - E.inCubic(P(t, 39.5, 39.85)));
      if (fp > 0) {
        const fx = 540 + 225 + (1 - fp) * 120, fy = by + 34 + (1 - fp) * 160;
        ctx.save(); ctx.globalAlpha *= fp; circle(fx, fy, 40, 'rgba(255,255,255,0.35)'); circle(fx, fy, 24, C.white); ctx.restore();
        const rp2 = P(t, 39.05, 39.6);
        if (rp2 > 0 && rp2 < 1) { ctx.beginPath(); ctx.arc(fx, fy, 30 + rp2 * 90, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - rp2)})`; ctx.lineWidth = 5; ctx.stroke(); }
      }
    }
  }

  // =====================================================================
  // master timeline
  // =====================================================================
  function render(t) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; noShadow(); ctx.letterSpacing = '0px'; ctx.setLineDash([]);
    if (t < 4.45) scene1(t);
    else if (t < 5.1) {
      scene1(t);
      const [kx, ky] = checkPos(540, 760 - 40 * E.inBack(P(t, 4.25, 4.9)), 0.6 * (1 - 0.15 * E.inBack(P(t, 4.25, 4.9))));
      const r = E.inOutCubic(P(t, 4.45, 5.1)) * 2300;
      ctx.save(); ctx.beginPath(); ctx.arc(kx, ky, r + 40, 0, TAU); ctx.fillStyle = C.amber; ctx.fill();
      ctx.beginPath(); ctx.arc(kx, ky, r, 0, TAU); ctx.clip(); scene2(t); ctx.restore();
    }
    else if (t < 11.45) scene2(t);
    else if (t < 12.0) { scene2(t); scene3(t, true); }
    else if (t < 21.55) scene3(t);
    else if (t < 22.45) { scene3(t); arrowWipe(E.inOutCubic(P(t, 21.55, 22.45)), () => scene4(t), C.amber); }
    else if (t < 29.55) scene4(t);
    else if (t < 30.45) { scene4(t); arrowWipe(E.inOutCubic(P(t, 29.55, 30.45)), () => scene5(t), C.white); }
    else if (t < 35.7) scene5(t);
    else scene6(t);
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
