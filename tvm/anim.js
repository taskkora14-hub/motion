/* "Memahami Time Value of Money (TVM)" — 60s, 1080x1920, no voice-over.
 * Every frame is a pure function of time, so preview and export are identical. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 60;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    bg0: '#040D12', bg1: '#0A232A', text: '#F3F1EA', dim: 'rgba(243,241,234,0.62)', faint: 'rgba(243,241,234,0.16)',
    mint: '#3EE6A0', gold: '#F7C548', sky: '#6CC6FF', coral: '#FF7B6B', ink: '#06141A',
    card: 'rgba(255,255,255,0.045)', stroke: 'rgba(255,255,255,0.12)',
  };
  const HEAD = '"OF", sans-serif', MONO = '"DM", monospace';
  // scene boundaries (seconds)
  const B = [0, 5, 12, 22, 35, 45, 53, 60];

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixC = (a, b, t) => { const A = hex(a), Bc = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, Bc[i], t))).join(',')})`; };
  const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const rp = v => 'Rp' + (Math.round(v / 1000) * 1000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    document.fonts.load(`800 40px ${HEAD}`), document.fonts.load(`600 40px ${HEAD}`), document.fonts.load(`500 40px ${HEAD}`),
    document.fonts.load(`400 40px ${MONO}`), document.fonts.load(`500 40px ${MONO}`),
  ]).then(() => document.fonts.ready);

  // ---------- drawing helpers ----------
  const head = (w, s) => `${w} ${s}px ${HEAD}`, mono = (w, s) => `${w} ${s}px ${MONO}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function ring(x, y, r, c, w, a0 = -Math.PI / 2, p = 1) { if (p <= 0) return; ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + TAU * p); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function line(x1, y1, x2, y2, c, w, p = 1) { if (p <= 0) return; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function text(s, x, y, o = {}) {
    ctx.save(); ctx.font = o.font || head(o.weight || 700, o.size || 40); ctx.letterSpacing = (o.spacing || 0) + 'px';
    ctx.fillStyle = o.color || C.text; ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.fillText(s, x, y); const w = ctx.measureText(s).width; ctx.restore(); return w;
  }
  function tick(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function arrowHead(x, y, ang, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath();
    ctx.moveTo(s * 0.2, 0); ctx.lineTo(-s * 0.8, -s * 0.55); ctx.lineTo(-s * 0.55, 0); ctx.lineTo(-s * 0.8, s * 0.55); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.restore();
  }
  function glow(x, y, r, c, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Kinetic line: each word rises out of its own mask (cinematic reveal), optional exit upward.
  function kLine(str, x, y, t, t0, o = {}) {
    const size = o.size || 100, stagger = o.stagger ?? 0.07, dur = o.dur || 0.6;
    ctx.save();
    ctx.font = o.mono ? mono(o.weight || 500, size) : head(o.weight || 800, size);
    ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.02)) + 'px';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const words = str.split(' '), sp = ctx.measureText(' ').width * 1.1;
    const ws = words.map(w => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    const fit = Math.min(1, (o.maxW || 960) / total);
    const left = o.align === 'left' ? x : x - (total * fit) / 2;
    let cx = left;
    const pos = [];
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, p = P(t, a, a + dur);
      const po = o.out != null ? E.inCubic(P(t, o.out + i * 0.03, o.out + i * 0.03 + 0.35)) : 0;
      const w = ws[i] * fit;
      pos.push({ x: cx, w });
      if (p > 0 && po < 1) {
        const e = E.outExpo(p);
        ctx.save();
        ctx.beginPath(); ctx.rect(cx - 30, y - size * 1.05 * fit, w + 60, size * 1.45 * fit); ctx.clip();
        ctx.translate(cx, y + (1 - e) * size * 1.1 * fit - po * size * 1.15 * fit); ctx.scale(fit, fit);
        ctx.globalAlpha *= clamp(p * 2.5);
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.text;
        ctx.fillText(words[i], 0, 0);
        ctx.restore();
      }
      if (o.under && o.under[i] != null) { // underline swipe under a word
        const up = E.inOutCubic(P(t, o.under[i], o.under[i] + 0.4)) * (1 - po);
        if (up > 0) { rr(cx, y + size * 0.14 * fit, w * up, Math.max(6, size * 0.07), 4); ctx.fillStyle = (o.hl && o.hl[i]) || C.mint; ctx.fill(); }
      }
      cx += (ws[i] + sp) * fit;
    }
    ctx.restore();
    return { left, total: total * fit, pos };
  }

  function pill(str, x, y, t, t0, o = {}) {
    const p = E.outBack(P(t, t0, t0 + 0.45)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.25)) : 0;
    if (p <= 0 || out >= 1) return 0;
    ctx.save();
    ctx.font = o.mono === false ? head(o.weight || 700, o.size || 30) : mono(500, o.size || 30); ctx.letterSpacing = (o.spacing ?? 4) + 'px';
    const tw = ctx.measureText(str).width, h = (o.size || 30) * 1.95, w = tw + (o.pad || 60) + (o.icon ? h * 0.8 : 0);
    ctx.translate(x, y); ctx.scale(p * (1 - out), p * (1 - out)); ctx.globalAlpha *= clamp(p * 2) * (1 - out);
    rr(-w / 2, -h / 2, w, h, h / 2);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 3; ctx.stroke(); }
    const tx = o.icon ? h * 0.4 : 0;
    if (o.icon) o.icon(-w / 2 + h * 0.62, 0, h * 0.5);
    ctx.fillStyle = o.color || C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, tx + (o.spacing ?? 4) / 2, 2);
    ctx.restore();
    return w;
  }

  // ---------- icons ----------
  function coin(x, y, r, o = {}) {
    if (r <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.04, Math.abs(Math.cos(o.spin || 0))), 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const c1 = o.c1 || '#FFE08A', c2 = o.c2 || '#E9A92A';
    const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, c1); g.addColorStop(1, c2);
    circle(0, 0, r, g);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.strokeStyle = 'rgba(120,70,0,0.35)'; ctx.lineWidth = Math.max(2, r * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.6); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(2, r * 0.06); ctx.stroke();
    const lab = o.label || 'Rp', fs = r * (lab.length > 2 ? 0.62 : 0.78);
    ctx.font = head(800, fs); ctx.letterSpacing = -Math.round(fs * 0.04) + 'px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = o.ink || '#7A4B00'; ctx.fillText(lab, 0, r * 0.05);
    ctx.restore();
  }
  function note(x, y, w, o = {}) {
    const h = w * 0.5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = w * 0.08; ctx.shadowOffsetY = w * 0.03;
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#46E3A5'); g.addColorStop(1, '#159A6B');
    rr(-w / 2, -h / 2, w, h, w * 0.05); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
    rr(-w / 2 + w * 0.04, -h / 2 + w * 0.04, w * 0.92, h - w * 0.08, w * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1.5, w * 0.012); ctx.stroke();
    circle(0, 0, h * 0.3, 'rgba(255,255,255,0.22)');
    ctx.font = head(800, h * 0.26); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#063B2A'; ctx.fillText('Rp', 0, h * 0.02);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    rr(-w * 0.4, -h * 0.28, w * 0.16, h * 0.08, 3); ctx.fill(); rr(w * 0.24, h * 0.2, w * 0.16, h * 0.08, 3); ctx.fill();
    ctx.restore();
  }
  function hourglass(x, y, s, t, c) {
    ctx.save(); ctx.translate(x, y);
    const flip = E.inOutCubic(P(t % 3, 2.6, 3)); ctx.rotate(flip * Math.PI);
    const k = flip > 0 ? 0 : (t % 3) / 2.6, hw = s * 0.36, hh = s * 0.5;
    ctx.strokeStyle = c; ctx.lineWidth = s * 0.07; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    line(-hw - s * 0.06, -hh, hw + s * 0.06, -hh, c, s * 0.08); line(-hw - s * 0.06, hh, hw + s * 0.06, hh, c, s * 0.08);
    ctx.beginPath(); ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(s * 0.05, 0); ctx.lineTo(hw, hh); ctx.lineTo(-hw, hh); ctx.lineTo(-s * 0.05, 0); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = c;
    const top = (1 - k) * 0.8; // sand in top bulb
    if (top > 0.02) { const yy = -s * 0.06 - top * (hh - s * 0.12); ctx.beginPath(); ctx.moveTo(-hw * (-yy / hh) * 0.9, yy); ctx.lineTo(hw * (-yy / hh) * 0.9, yy); ctx.lineTo(0, -s * 0.04); ctx.closePath(); ctx.fill(); }
    const bot = k * 0.8;
    if (bot > 0.02) { const yy = hh - s * 0.05 - bot * (hh - s * 0.14); ctx.beginPath(); ctx.moveTo(-hw * 0.88, hh - s * 0.05); ctx.lineTo(hw * 0.88, hh - s * 0.05); ctx.lineTo(hw * 0.88 * (yy / hh), yy); ctx.lineTo(-hw * 0.88 * (yy / hh), yy); ctx.closePath(); ctx.fill(); }
    if (flip === 0 && k < 1) line(0, 0, 0, hh - s * 0.06 - bot * (hh - s * 0.14), c, s * 0.03);
    ctx.restore();
  }
  function chart(x, y, s, p, c) {
    ctx.save(); ctx.translate(x - s / 2, y + s / 2);
    ctx.strokeStyle = rgba(C.text, 0.4); ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, 0); ctx.lineTo(s, 0); ctx.stroke();
    const pts = [[0.08, -0.18], [0.32, -0.4], [0.5, -0.32], [0.9, -0.84]];
    const n = pts.length - 1, q = p * n;
    ctx.beginPath(); ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
    let end = pts[0];
    for (let i = 1; i <= n; i++) {
      const f = clamp(q - (i - 1)); if (f <= 0) break;
      end = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
      ctx.lineTo(end[0] * s, end[1] * s);
    }
    ctx.strokeStyle = c; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round'; ctx.stroke();
    if (p > 0.98) arrowHead(0.9 * s, -0.84 * s, Math.atan2(-0.52, 0.4), s * 0.22, c);
    else circle(end[0] * s, end[1] * s, s * 0.06, c);
    ctx.restore();
  }
  function clock(x, y, r, a, c) {
    ctx.save();
    ring(x, y, r, c, r * 0.14);
    for (let i = 0; i < 12; i += 3) { const an = (i / 12) * TAU; line(x + Math.cos(an) * r * 0.62, y + Math.sin(an) * r * 0.62, x + Math.cos(an) * r * 0.74, y + Math.sin(an) * r * 0.74, c, r * 0.08); }
    line(x, y, x + Math.cos(a - Math.PI / 2) * r * 0.62, y + Math.sin(a - Math.PI / 2) * r * 0.62, c, r * 0.1);
    line(x, y, x + Math.cos(a / 12 - Math.PI / 2) * r * 0.4, y + Math.sin(a / 12 - Math.PI / 2) * r * 0.4, c, r * 0.12);
    circle(x, y, r * 0.1, c);
    ctx.restore();
  }
  function eyes(x, y, s, t, p) {
    if (p <= 0) return;
    const e = E.outBack(p);
    ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
    const look = Math.sin(t * 2.4) * 0.5 + (t > 3.2 && t < 4.4 ? 0.5 : 0);   // glance toward the handle
    const blink = 1 - bump(t, 2.55, 2.7) * 0.9 - bump(t, 4.2, 4.35) * 0.9;
    for (const dx of [-s * 0.3, s * 0.3]) {
      ctx.save(); ctx.translate(dx, 0); ctx.scale(1, blink);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.25, s * 0.34, 0, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      const lx = clamp(look, -1, 1) * s * 0.09 - 0.01 * s, ly = (t > 3.2 && t < 4.4 ? s * 0.12 : 0);
      circle(lx, ly, s * 0.13, '#101820'); circle(lx + s * 0.04, ly - s * 0.05, s * 0.035, '#FFFFFF');
      ctx.restore();
    }
    ctx.restore();
  }
  function cursor(x, y, s, press) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - press * 0.15), s * (1 - press * 0.15));
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.lineTo(11, 34); ctx.lineTo(19, 52); ctx.lineTo(27, 48); ctx.lineTo(19, 31); ctx.lineTo(33, 31); ctx.closePath();
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#06141A'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  function plusIcon(c) { return (x, y, s) => { line(x - s * 0.35, y, x + s * 0.35, y, c, s * 0.16); line(x, y - s * 0.35, x, y + s * 0.35, c, s * 0.16); }; }

  // ---------- background ----------
  const SYMS = ['Rp', '%', '+', '×', '÷', '$', '1', '0'];
  function background(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bg1); g.addColorStop(0.55, '#07181E'); g.addColorStop(1, C.bg0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // slow drifting accent glows
    glow(540 + Math.sin(t * 0.3) * 220, 700 + Math.cos(t * 0.23) * 160, 760, C.mint, 0.07);
    glow(540 + Math.cos(t * 0.21) * 260, 1400 + Math.sin(t * 0.27) * 120, 700, C.sky, 0.05);
    // dotted grid with a slow downward drift
    ctx.fillStyle = 'rgba(243,241,234,0.05)';
    const off = (t * 12) % 60;
    for (let yy = -60 + off; yy < H; yy += 60) for (let xx = 30; xx < W; xx += 60) ctx.fillRect(xx - 1.5, yy - 1.5, 3, 3);
    // floating finance glyphs
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 16; i++) {
      const sp = 18 + rnd(i) * 28, yy = ((rnd(i + 30) * (H + 200) - t * sp) % (H + 200) + H + 200) % (H + 200) - 100;
      const xx = 60 + rnd(i + 60) * (W - 120) + Math.sin(t * 0.5 + i) * 20;
      ctx.font = mono(500, 26 + rnd(i + 90) * 34); ctx.fillStyle = `rgba(243,241,234,${0.035 + rnd(i + 5) * 0.04})`;
      ctx.fillText(SYMS[i % SYMS.length], xx, yy);
    }
    ctx.restore();
    // vignette
    const v = ctx.createRadialGradient(540, 960, 500, 540, 960, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function sweep(t) { // light streak marking each scene change
    for (const b of B.slice(1, -1)) {
      const p = P(t, b - 0.32, b + 0.32);
      if (p <= 0 || p >= 1) continue;
      const y = lerp(H + 100, -100, E.inOutCubic(p)), a = Math.sin(p * Math.PI);
      const g = ctx.createLinearGradient(0, y - 160, 0, y + 160);
      g.addColorStop(0, rgba(C.mint, 0)); g.addColorStop(0.5, rgba(C.mint, 0.16 * a)); g.addColorStop(1, rgba(C.mint, 0));
      ctx.fillStyle = g; ctx.fillRect(0, y - 160, W, 320);
      ctx.fillStyle = rgba('#FFFFFF', 0.55 * a); ctx.fillRect(0, y - 1.5, W, 3);
    }
  }

  // =====================================================================
  // 1. HOOK (0 – 5)
  // =====================================================================
  function s1(t) {
    const flare = bump(t, 0.05, 1.2);
    glow(540, 640, 520, C.mint, 0.12 * flare);
    kLine('SEBELUM', 540, 560, t, 0.15, { size: 150 });
    kLine('LANJUT…', 540, 720, t, 0.38, { size: 150, color: C.mint });
    const lp = E.inOutCubic(P(t, 0.9, 1.5));
    line(540 - 280 * lp, 815, 540 + 280 * lp, 815, C.faint, 3);

    const r = kLine('FOLLOW', 455, 1000, t, 1.3, { size: 124 });
    eyes(r.left + r.total + 105, 955, 120, t, P(t, 1.55, 2.0));

    // handle pill: outline "+ @taskkora__" -> tapped -> filled with a check
    const tap = P(t, 3.35, 3.55), filled = tap > 0.5;
    const pw = pill('@taskkora__', 540, 1135, t, 1.85, {
      size: 58, spacing: 1, pad: 90, stroke: filled ? null : C.mint, fill: filled ? C.mint : 'rgba(62,230,160,0.08)',
      color: filled ? C.ink : C.mint,
      icon: filled ? (x, y, s) => tick(x, y, s * 1.2, C.ink, s * 0.18, P(t, 3.45, 3.75)) : plusIcon(C.mint),
    });
    if (tap > 0) { // ripple
      const rp2 = P(t, 3.4, 4.2);
      ctx.save(); ctx.globalAlpha = 1 - rp2; rr(540 - pw / 2 - rp2 * 40, 1135 - 57 - rp2 * 40, pw + rp2 * 80, 114 + rp2 * 80, 57 + rp2 * 40);
      ctx.strokeStyle = C.mint; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    kLine('Biar nggak ketinggalan', 540, 1330, t, 2.5, { size: 60, weight: 500, color: C.dim, stagger: 0.05 });
    kLine('konten edukasi!', 540, 1412, t, 2.7, { size: 64, weight: 700, stagger: 0.06, hl: { 1: C.mint } });

    // cursor glides in and taps the handle
    const cin = E.inOutCubic(P(t, 2.7, 3.3)), cout = E.inCubic(P(t, 4.0, 4.5));
    if (cin > 0 && cout < 1) cursor(lerp(900, 640, cin) + cout * 400, lerp(1480, 1150, cin) + cout * 200, 1.4, bump(t, 3.3, 3.55));
  }

  // =====================================================================
  // 2. PERTANYAAN (5 – 12)
  // =====================================================================
  function card(x, y, w, h, t, t0, o = {}) {
    const p = E.outCubic(P(t, t0, t0 + 0.6));
    if (p <= 0) return false;
    ctx.save(); ctx.globalAlpha *= p; ctx.translate(x, y + (1 - p) * 70); ctx.rotate(o.rot || 0);
    rr(-w / 2, -h / 2, w, h, 36);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(255,255,255,0.075)'); g.addColorStop(1, 'rgba(255,255,255,0.025)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = o.stroke || C.stroke; ctx.lineWidth = 2.5; ctx.stroke();
    if (o.draw) o.draw(w, h);
    ctx.restore();
    return true;
  }
  function amountCard(x, y, t, t0, label, lc, value, o = {}) {
    card(x, y, 920, o.h || 290, t, t0, {
      rot: o.rot, stroke: o.stroke,
      draw: (w, h) => {
        const lh = -h / 2 + 70;
        if (o.icon) o.icon(-w / 2 + 78, lh - 12);
        text(label, -w / 2 + (o.icon ? 124 : 60), lh, { font: mono(500, 34), color: lc, align: 'left', spacing: 5 });
        text(value, 0, lh + 138, { font: head(800, 124), color: o.vc || C.text, spacing: -3 });
        if (o.extra) o.extra(w, h);
      },
    });
  }
  function s2(t) {
    const q = P(t, 9.4, 11.7), wob = Math.sin((t - 9.4) * 5) * 0.022 * q * (1 - P(t, 11.2, 11.7));
    const cnt = E.outCubic(P(t, 5.3, 6.4)), cnt2 = E.outCubic(P(t, 6.8, 7.9));
    amountCard(540, 560, t, 5.1, 'HARI INI', C.mint, rp(1e6 * cnt), {
      rot: wob, icon: (x, y) => clock(x, y, 22, t * 3, C.mint),
    });
    amountCard(540, 1060, t, 6.6, '1 TAHUN LAGI', C.sky, rp(1e6 * cnt2), {
      rot: -wob, icon: (x, y) => clock(x, y, 22, 5 + E.inOutCubic(P(t, 7.2, 9.0)) * TAU * 12, C.sky),
      extra: (w, h) => { // year passing: 0 -> 12 months
        const yp = E.inOutCubic(P(t, 7.2, 9.0));
        text(`${Math.round(yp * 12)} / 12 BULAN`, w / 2 - 60, -h / 2 + 70, { font: mono(400, 26), color: C.dim, align: 'right', spacing: 2 });
      },
    });
    // "vs" badge -> "= ?"
    const vp = E.outBack(P(t, 6.3, 6.7));
    if (vp > 0) {
      ctx.save(); ctx.translate(540, 810); ctx.scale(vp, vp);
      const qm = E.inOutCubic(P(t, 9.25, 9.6));
      glow(0, 0, 160, C.gold, 0.25 * qm);
      circle(0, 0, 72, mixC('#16323A', C.gold, qm));
      ring(0, 0, 72, rgba(C.gold, 0.8), 3);
      ctx.globalAlpha = 1 - qm; text('vs', 0, 14, { font: head(800, 54), color: C.gold });
      ctx.globalAlpha = qm; ctx.rotate(Math.sin(t * 6) * 0.12 * qm); text('=?', 0, 20, { font: head(800, 62), color: C.ink });
      ctx.restore();
    }
    kLine('Apakah nilainya', 540, 1380, t, 9.35, { size: 92, stagger: 0.08 });
    kLine('sama?', 540, 1515, t, 9.6, { size: 140, color: C.gold });
  }

  // =====================================================================
  // 3. KONSEP (12 – 22)
  // =====================================================================
  const TL = { x0: 140, x1: 940, y: 1240 };
  const curveY = u => TL.y - 70 - ((Math.exp(2.1 * u) - 1) / (Math.exp(2.1) - 1)) * 330;
  function s3(t) {
    glow(540, 800, 600, C.mint, 0.14 * bump(t, 12.0, 13.6));
    const mv = E.inOutCubic(P(t, 14.4, 15.2));
    ctx.save(); ctx.translate(540, lerp(820, 385, mv)); const sc = lerp(1, 0.46, mv); ctx.scale(sc, sc);
    kLine('TIME', 0, -170, t, 12.05, { size: 240, color: C.mint });
    kLine('VALUE OF', 0, -5, t, 12.3, { size: 140 });
    kLine('MONEY', 0, 210, t, 12.55, { size: 240 });
    ctx.restore();
    const fl = E.inOutCubic(P(t, 12.6, 13.4)) * (1 - mv); // flare under title
    line(540 - 380 * fl, 1080, 540 + 380 * fl, 1080, rgba(C.mint, 0.6), 4);

    kLine('Nilai uang dipengaruhi', 540, 660, t, 15.1, { size: 72, weight: 600 });
    kLine('oleh waktu.', 540, 752, t, 15.35, { size: 72, weight: 800, hl: { 1: C.mint }, under: { 1: 15.9 } });

    // timeline with value growing as a coin travels along it
    const lp = E.inOutCubic(P(t, 16.0, 16.8));
    if (lp > 0) {
      line(TL.x0, TL.y, lerp(TL.x0, TL.x1 + 20, lp), TL.y, rgba(C.text, 0.5), 5);
      if (lp > 0.98) arrowHead(TL.x1 + 30, TL.y, 0, 26, rgba(C.text, 0.5));
    }
    const LBL = ['HARI INI', '1 TH', '2 TH', '3 TH'];
    const mp = E.inOutSine(P(t, 17.3, 21.2));
    for (let i = 0; i < 4; i++) {
      const u = i / 3, x = lerp(TL.x0, TL.x1, u), tp = E.outBack(P(t, 16.3 + i * 0.12, 16.7 + i * 0.12));
      if (tp <= 0) continue;
      const passed = P(mp, u - 0.02, u + 0.06);
      // value column under the curve, rising when the coin passes
      if (passed > 0 && i > 0) {
        const top = lerp(TL.y, curveY(u), E.outCubic(passed));
        const g = ctx.createLinearGradient(0, top, 0, TL.y); g.addColorStop(0, rgba(C.mint, 0.35)); g.addColorStop(1, rgba(C.mint, 0.02));
        rr(x - 34, top, 68, TL.y - top, [12, 12, 0, 0]); ctx.fillStyle = g; ctx.fill();
      }
      circle(x, TL.y, 12 * tp, passed > 0.5 ? C.mint : C.text);
      text(LBL[i], x, TL.y + 64, { font: mono(500, 30), color: passed > 0.5 ? C.mint : C.dim, alpha: tp, spacing: 2 });
    }
    // dashed growth path, then the trail behind the coin
    const dp = P(t, 16.7, 17.3);
    if (dp > 0) {
      ctx.save(); ctx.setLineDash([4, 14]); ctx.strokeStyle = rgba(C.text, 0.3 * dp); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); for (let k = 0; k <= 60; k++) { const u = k / 60; ctx[k ? 'lineTo' : 'moveTo'](lerp(TL.x0, TL.x1, u), curveY(u)); } ctx.stroke(); ctx.restore();
    }
    const cp = E.outBack(P(t, 17.0, 17.4));
    if (cp > 0) {
      ctx.save(); ctx.shadowColor = C.mint; ctx.shadowBlur = 20; ctx.strokeStyle = C.mint; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); for (let k = 0; k <= 80; k++) { const u = (k / 80) * mp; ctx[k ? 'lineTo' : 'moveTo'](lerp(TL.x0, TL.x1, u), curveY(u)); } ctx.stroke(); ctx.restore();
      const cx = lerp(TL.x0, TL.x1, mp), cy = curveY(mp);
      glow(cx, cy, 140, C.gold, 0.35);
      coin(cx, cy, lerp(38, 62, mp) * cp, { spin: t * 5 });
    }
    // clock spinning with the passing years
    const ck = E.outBack(P(t, 16.4, 16.8));
    if (ck > 0) { ctx.save(); ctx.translate(210, 960); ctx.scale(ck, ck); clock(0, 0, 50, mp * TAU * 36 + t * 0.5, C.sky); ctx.restore(); }
    text('WAKTU →', 210, 1050, { font: mono(500, 26), color: C.sky, spacing: 3, alpha: ck });
  }

  // =====================================================================
  // 4. CONTOH (22 – 35)
  // =====================================================================
  function s4(t) {
    pill('CONTOH', 540, 330, t, 22.05, { fill: C.gold, color: C.ink, size: 32, spacing: 6 });
    amountCard(540, 560, t, 22.25, 'HARI INI', C.mint, 'Rp1.000.000', { h: 270, icon: (x, y) => note(x, y, 58) });

    // flow arrow between the two cards
    const ap = E.inOutCubic(P(t, 24.0, 24.7));
    line(540, 705, 540, lerp(705, 885, ap), rgba(C.gold, 0.8), 6);
    if (ap > 0.98) arrowHead(540, 900, Math.PI / 2, 26, C.gold);
    // money in motion: notes drift from today into next year
    for (let i = 0; i < 6; i++) {
      const a = 25.3 + i * 0.5, p = P(t, a, a + 1.1);
      if (p <= 0 || p >= 1) continue;
      note(540 + Math.sin(p * Math.PI * 2 + i) * 120 * (i % 2 ? 1 : -1), lerp(700, 920, E.inOutSine(p)), 70, { rot: (p - 0.5) * (i % 2 ? 1.2 : -1.2), alpha: Math.sin(p * Math.PI) * 0.9 });
    }
    pill('return 10% / tahun', 540, 795, t, 24.4, {
      size: 40, spacing: 1, fill: '#1B2E22', stroke: C.gold, color: C.gold, mono: false, weight: 700, pad: 70,
      icon: (x, y, s) => chart(x + s * 0.1, y, s * 0.9, P(t, 24.7, 25.3), C.gold),
    });

    const gp = E.inOutCubic(P(t, 25.4, 28.6)), done = P(t, 28.55, 28.75);
    glow(540, 1080, 520, C.mint, 0.22 * bump(t, 28.5, 30.2));
    amountCard(540, 1085, t, 23.4, '1 TAHUN LAGI', C.sky, rp(1e6 + 1e5 * gp), {
      h: 270, vc: mixC('#F3F1EA', C.mint, done), stroke: done > 0 ? rgba(C.mint, 0.3 + 0.5 * done) : null,
      icon: (x, y) => clock(x, y, 22, 5 + gp * TAU * 12, C.sky),
      extra: (w, h) => {
        rr(-w / 2 + 60, h / 2 - 40, w - 120, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
        rr(-w / 2 + 60, h / 2 - 40, (w - 120) * gp, 8, 4); ctx.fillStyle = C.sky; ctx.fill();
        text(`${Math.round(gp * 12)} / 12 BULAN`, w / 2 - 60, -h / 2 + 70, { font: mono(400, 26), color: C.dim, align: 'right', spacing: 2 });
      },
    });
    // +Rp100.000 pops off the card
    const bp = P(t, 28.6, 29.2);
    if (bp > 0) {
      ctx.save(); ctx.translate(800, 945 - E.outCubic(bp) * 30); ctx.rotate(-0.06);
      pill('+Rp100.000', 0, 0, t, 28.6, { fill: C.mint, color: C.ink, size: 38, spacing: 1, mono: false, weight: 800 });
      ctx.restore();
      for (let i = 0; i < 10; i++) { // sparkle burst
        const a = (i / 10) * TAU + 0.3, d = E.outCubic(bp) * 150, al = 1 - P(t, 28.9, 29.6);
        circle(800 + Math.cos(a) * d, 945 + Math.sin(a) * d * 0.7, 6 * al, i % 2 ? C.gold : C.mint);
      }
    }
    kLine('1.000.000 × (1 + 10%) = 1.100.000', 540, 1290, t, 29.3, { size: 36, mono: true, weight: 400, color: C.dim, stagger: 0.05, spacing: 0 });

    kLine('Uang hari ini punya potensi', 540, 1430, t, 30.8, { size: 66, weight: 600, stagger: 0.06 });
    const r = kLine('untuk berkembang.', 540, 1518, t, 31.2, { size: 76, stagger: 0.08, hl: { 1: C.mint }, under: { 1: 31.8 } });
    const ic = P(t, 31.9, 32.6);
    if (ic > 0) chart(r.left + r.total + 60, 1488, 60, ic, C.mint);
  }

  // =====================================================================
  // 5. PRESENT VALUE (35 – 45)
  // =====================================================================
  function s5(t) {
    kLine('Kalau Rp1.100.000', 540, 400, t, 35.1, { size: 80, hl: { 1: C.gold } });
    kLine('diterima 1 tahun lagi…', 540, 492, t, 35.35, { size: 80, weight: 600 });

    const y = 790, x0 = 170, x1 = 910;
    const lp = E.inOutCubic(P(t, 35.8, 36.5));
    line(x0, y, lerp(x0, x1, lp), y, rgba(C.text, 0.5), 5);
    [[x0, 'HARI INI', C.mint], [x1, '1 TAHUN LAGI', C.gold]].forEach(([x, l, c], i) => {
      const p = E.outBack(P(t, 36.0 + i * 0.2, 36.4 + i * 0.2));
      if (p <= 0) return;
      circle(x, y, 13 * p, c);
      text(l, x, y + 70, { font: mono(500, 30), color: c, alpha: p, spacing: 2 });
    });
    // discount arrow: future -> today
    const dp = E.inOutCubic(P(t, 37.7, 38.4));
    if (dp > 0) {
      ctx.save(); ctx.setLineDash([16, 14]); ctx.lineDashOffset = t * 40;
      ctx.beginPath(); const ax = lerp(x1 - 40, x0 + 50, dp);
      ctx.moveTo(x1 - 40, y - 150); ctx.quadraticCurveTo((x1 + ax) / 2, y - 250, ax, y - 150);
      ctx.strokeStyle = rgba(C.sky, 0.85); ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
      if (dp > 0.97) arrowHead(x0 + 44, y - 146, Math.PI * 0.86, 26, C.sky);
      pill('diskonto 10%', 540, y - 240, t, 38.0, { fill: '#10283A', stroke: C.sky, color: C.sky, size: 30, spacing: 2 });
    }
    // "?" waiting at today
    const qp = E.outBack(P(t, 37.9, 38.3)) * (1 - P(t, 40.1, 40.35));
    if (qp > 0) {
      ctx.save(); ctx.translate(x0, y - 20); ctx.scale(qp, qp);
      ring(0, 0, 58 + Math.sin(t * 6) * 4, rgba(C.mint, 0.7), 4);
      text('?', 0, 26, { font: head(800, 76), color: C.mint });
      ctx.restore();
    }
    // the future amount travels back to today, losing its "extra"
    const cp = E.outBack(P(t, 36.4, 36.8));
    if (cp > 0) {
      const mp = E.inOutCubic(P(t, 38.6, 40.3)), arrived = P(t, 40.2, 40.45);
      const cx = lerp(x1, x0, mp), cy = y - 20 - Math.sin(mp * Math.PI) * 60;
      glow(cx, cy, 150, arrived > 0 ? C.mint : C.gold, 0.3);
      coin(cx, cy, 52 * cp * lerp(1, 0.9, mp), { spin: mp * TAU * 2 });
      const val = rp(1.1e6 - 1e5 * mp);
      ctx.save(); ctx.translate(cx, cy - 102);
      const pw = 290 * cp; rr(-pw / 2, -34, pw, 68, 34); ctx.fillStyle = mixC('#2A2410', '#0F3326', arrived); ctx.fill();
      ctx.strokeStyle = arrived > 0 ? C.mint : C.gold; ctx.lineWidth = 3; ctx.stroke();
      text(val, 0, 13, { font: head(800, 38), color: arrived > 0 ? C.mint : C.gold, alpha: cp });
      ctx.restore();
    }

    kLine('Berapa nilainya', 540, 1020, t, 38.0, { size: 90, weight: 600 });
    kLine('hari ini?', 540, 1125, t, 38.25, { size: 112, color: C.mint });

    // PV reveal
    text('PERKENALKAN', 540, 1232, { font: mono(500, 28), color: C.dim, spacing: 6, alpha: E.outCubic(P(t, 40.5, 40.9)) });
    const bp = P(t, 40.8, 41.4);
    if (bp > 0) {
      const s = E.outBack(bp);
      glow(540, 1325, 480, C.gold, 0.3 * bump(t, 40.8, 42.4) + 0.08);
      ctx.save(); ctx.translate(540, 1325); ctx.scale(s, s);
      rr(-440, -76, 880, 152, 76);
      const g = ctx.createLinearGradient(-440, 0, 440, 0); g.addColorStop(0, '#FFD66B'); g.addColorStop(1, '#F2A93B');
      ctx.fillStyle = g; ctx.fill();
      text('PRESENT VALUE', -54, 26, { font: head(800, 72), color: C.ink, spacing: -1 });
      rr(250, -46, 150, 92, 46); ctx.fillStyle = C.ink; ctx.fill();
      text('PV', 325, 22, { font: head(800, 58), color: C.gold });
      ctx.restore();
      // shine sweep across the badge
      const sh = P(t, 41.3, 42.0);
      if (sh > 0 && sh < 1) {
        ctx.save(); rr(100, 1249, 880, 152, 76); ctx.clip();
        const sx = lerp(0, 1100, sh); const sg = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(sx - 80, 1249, 160, 152); ctx.restore();
      }
    }
    kLine('PV = 1.100.000 ÷ (1 + 10%)', 540, 1480, t, 42.2, { size: 44, mono: true, weight: 500, color: C.text, stagger: 0.06, spacing: 0 });
    kLine('= Rp1.000.000', 540, 1560, t, 43.0, { size: 60, mono: true, weight: 500, color: C.mint, stagger: 0.1, spacing: 0 });
  }

  // =====================================================================
  // 6. INTI (45 – 53)
  // =====================================================================
  const CEN = { x: 540, y: 945 };
  const NODES = [
    { key: 'TIME', x: 540, y: 655, c: C.sky, t0: 45.15 },
    { key: 'RATE', x: 245, y: 1085, c: C.gold, t0: 45.85 },
    { key: 'VALUE', x: 835, y: 1085, c: C.mint, t0: 46.55 },
  ];
  function s6(t) {
    kLine('TIME + RATE + VALUE', 540, 400, t, 45.15, { size: 98, stagger: 0.35, hl: { 0: C.sky, 1: C.dim, 2: C.gold, 3: C.dim, 4: C.mint } });

    // connections: node -> centre, with value flowing inward
    NODES.forEach((n, i) => {
      const lp = E.inOutCubic(P(t, 47.3 + i * 0.12, 47.9 + i * 0.12));
      if (lp <= 0) return;
      const d = Math.hypot(CEN.x - n.x, CEN.y - n.y), ux = (CEN.x - n.x) / d, uy = (CEN.y - n.y) / d;
      const ax = n.x + ux * 112, ay = n.y + uy * 112, bx = CEN.x - ux * 88, by = CEN.y - uy * 88;
      line(ax, ay, bx, by, rgba(n.c, 0.55), 5, lp);
      if (lp >= 1) for (let k = 0; k < 3; k++) {
        const f = ((t - 47.9) * 0.9 + k / 3) % 1;
        circle(lerp(ax, bx, f), lerp(ay, by, f), 7 * Math.sin(f * Math.PI), n.c);
      }
    });
    // centre: the value of money
    const cp = E.outBack(P(t, 47.7, 48.2));
    if (cp > 0) {
      const pulse = 1 + 0.06 * Math.exp(-((t - 48.2) % 1.2) * 5) * (t > 48.2 ? 1 : 0);
      glow(CEN.x, CEN.y, 260, C.gold, 0.35 * cp);
      ctx.save(); ctx.setLineDash([6, 12]); ctx.lineDashOffset = -t * 30;
      ring(CEN.x, CEN.y, 108 * cp, rgba(C.gold, 0.5), 3); ctx.restore();
      coin(CEN.x, CEN.y, 76 * cp * pulse, { spin: Math.sin(t * 1.5) * 0.5 });
      text('NILAI UANG', CEN.x, CEN.y + 158, { font: mono(500, 28), color: C.gold, spacing: 4, alpha: P(t, 48.1, 48.5) });
    }
    // nodes
    NODES.forEach((n, i) => {
      const p = E.outBack(P(t, n.t0, n.t0 + 0.5));
      if (p <= 0) return;
      ctx.save(); ctx.translate(n.x, n.y); ctx.scale(p, p);
      glow(0, 0, 200, n.c, 0.18);
      circle(0, 0, 112, '#0C2229'); ring(0, 0, 112, n.c, 5);
      const lt = t - n.t0;
      if (i === 0) hourglass(0, -22, 92, lt, n.c);
      else if (i === 1) chart(0, -24, 84, P(lt, 0.3, 1.1), n.c);
      else { note(-6, -12, 96, { rot: -0.18 }); note(6, -30, 96, { rot: 0.08 }); }
      text(n.key, 0, 72, { font: mono(500, 30), color: n.c, spacing: 4 });
      ctx.restore();
    });

    kLine('Ketiganya memengaruhi', 540, 1390, t, 49.3, { size: 74, weight: 600 });
    kLine('nilai uang.', 540, 1500, t, 49.6, { size: 100, color: C.mint, under: { 1: 50.2 } });
  }

  // =====================================================================
  // 7. KESIMPULAN (53 – 60)
  // =====================================================================
  function s7(t) {
    const cp = E.outBack(P(t, 53.1, 53.6)), cp2 = E.outBack(P(t, 53.3, 53.8));
    const fade = E.inOutCubic(P(t, 54.0, 55.0)); // the future Rp1 loses value
    if (cp > 0) {
      glow(290, 590, 240, C.gold, 0.3 * cp);
      coin(290, 590, 120 * cp, { label: 'Rp1', spin: Math.sin(t * 1.2) * 0.25 });
      text('HARI INI', 290, 770, { font: mono(500, 30), color: C.mint, spacing: 4, alpha: cp });
    }
    if (cp2 > 0) {
      coin(790, 590, 120 * cp2 * lerp(1, 0.84, fade), { label: 'Rp1', c1: mixC('#FFE08A', '#8C9AA0', fade), c2: mixC('#E9A92A', '#56646B', fade), ink: mixC('#7A4B00', '#2A3338', fade), spin: Math.sin(t * 1.2 + 1) * 0.25 });
      ctx.save(); ctx.translate(880, 500); ctx.scale(cp2, cp2); circle(0, 0, 34, '#10283A'); clock(0, 0, 24, t * 4, C.sky); ctx.restore();
      text('MASA DEPAN', 790, 770, { font: mono(500, 30), color: C.dim, spacing: 4, alpha: cp2 });
    }
    // not-equal sign
    const ne = P(t, 53.5, 54.0);
    if (ne > 0) {
      const e = E.outBack(ne);
      ctx.save(); ctx.translate(540, 590); ctx.scale(e, e);
      line(-44, -18, 44, -18, C.coral, 14); line(-44, 18, 44, 18, C.coral, 14);
      line(26, -56, -26, 56, C.coral, 14, E.inOutCubic(P(t, 53.8, 54.2)));
      ctx.restore();
    }
    kLine('Rp1 hari ini ≠', 540, 930, t, 53.4, { size: 92, hl: { 0: C.gold, 3: C.coral } });
    kLine('Rp1 di masa depan.', 540, 1035, t, 53.65, { size: 92, hl: { 0: C.gold } });

    kLine('TVM membantu membandingkan', 540, 1170, t, 55.1, { size: 54, weight: 500, color: C.dim, stagger: 0.05 });
    kLine('nilai uang pada waktu berbeda.', 540, 1240, t, 55.3, { size: 54, weight: 700, stagger: 0.05, hl: { 3: C.mint, 4: C.mint } });

    // closing CTA
    const tap = P(t, 58.1, 58.3), filled = tap > 0.5;
    const pw = pill('Follow @taskkora__', 540, 1400, t, 56.8, {
      size: 50, spacing: 0, pad: 90, mono: false, weight: 800,
      fill: filled ? C.mint : 'rgba(62,230,160,0.1)', stroke: filled ? null : C.mint, color: filled ? C.ink : C.mint,
      icon: filled ? (x, y, s) => tick(x, y, s * 1.2, C.ink, s * 0.18, P(t, 58.2, 58.5)) : plusIcon(C.mint),
    });
    if (tap > 0) {
      const r = P(t, 58.15, 59.0);
      ctx.save(); ctx.globalAlpha = 1 - r; rr(540 - pw / 2 - r * 40, 1400 - 49 - r * 40, pw + r * 80, 98 + r * 80, 49 + r * 40);
      ctx.strokeStyle = C.mint; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    kLine('untuk konten edukasi berikutnya.', 540, 1520, t, 57.1, { size: 46, weight: 500, color: C.dim, stagger: 0.05 });
    const cin = E.inOutCubic(P(t, 57.5, 58.1)), cout = E.inCubic(P(t, 58.8, 59.4));
    if (cin > 0 && cout < 1) cursor(lerp(960, 700, cin) + cout * 400, lerp(1660, 1415, cin) + cout * 300, 1.4, bump(t, 58.1, 58.35));
  }

  // =====================================================================
  const SCENES = [s1, s2, s3, s4, s5, s6, s7];
  function finish(t) {
    const wa = P(t, 0.4, 1.0) * 0.92;
    if (wa > 0) { // logo used as-is: small watermark, top-right
      const s = 72, x = W - 60 - s, y = 140;
      ctx.save(); ctx.globalAlpha = wa;
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      rr(x, y, s, s, 16); ctx.fillStyle = '#004FC6'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 16); ctx.clip(); ctx.drawImage(logo, x, y, s, s); ctx.restore();
    }
    const f = 1 - P(t, 0, 0.15) + P(t, 59.7, 60);
    if (f > 0) { ctx.fillStyle = `rgba(4,13,18,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    background(t);
    let i = 0; while (i < SCENES.length - 1 && t >= B[i + 1]) i++;
    const out = i < SCENES.length - 1 ? E.inCubic(P(t, B[i + 1] - 0.35, B[i + 1])) : 0;
    const inn = i > 0 ? 1 - E.outCubic(P(t, B[i], B[i] + 0.4)) : 0;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    const s = 1 + out * 0.06 - inn * 0.04;
    ctx.translate(540, 960); ctx.scale(s, s); ctx.translate(-540, -960 - out * 40 + inn * 30);
    SCENES[i](t);
    ctx.restore();
    sweep(t);
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
