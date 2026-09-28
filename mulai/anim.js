/* "Bingung mulai mengerjakan task dari mana?" — 40s educational motion piece, 1080x1920.
 * Every frame is a pure function of time: render(t). */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    bg: '#EFEBFF', bg2: '#E1D9FF', ink: '#1B1640', ink2: '#5B5486', mute: '#A49EC4', line: '#E6E1FA',
    card: '#FFFFFF', violet: '#6D4AFF', violetL: '#D9CFFF', coral: '#FF4D6D', lime: '#B6F24C', yellow: '#FFD23F',
  };
  const F = '"SG", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inBack: x => { const c1 = 1.7; return (c1 + 1) * x * x * x - c1 * x * x; },
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const lerpRect = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    document.fonts.load(`700 40px ${F}`), document.fonts.load(`500 40px ${F}`),
  ]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  const font = (w, s) => `${w} ${s}px ${F}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function shadow(a = 0.12, blur = 40, oy = 16) { ctx.shadowColor = `rgba(27,22,64,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy; }
  function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function card(x, y, w, h, r, fill = C.card, a = 0.1) { ctx.save(); shadow(a, 50, 20); rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
  function tick(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  // Kinetic line: each word "slams" in (scale down + rise) — punchy, fast.
  function kLine(text, x, y, t, t0, o = {}) {
    const size = o.size || 100, stagger = o.stagger ?? 0.07, dur = o.dur || 0.45;
    ctx.save();
    ctx.font = font(o.weight || 700, size); ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.04)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' '), sp = ctx.measureText(' ').width * 0.85;
    let ws = words.map(w => ctx.measureText(w).width);
    let total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    const maxW = o.maxW || 960;
    let fit = total > maxW ? maxW / total : 1;
    let cx = o.align === 'left' ? x : x - (total * fit) / 2;
    const pos = [];
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, p = P(t, a, a + dur);
      const pout = o.out != null ? E.inCubic(P(t, o.out + i * stagger * 0.4, o.out + i * stagger * 0.4 + 0.28)) : 0;
      const w = ws[i] * fit;
      pos.push([cx, w]);
      if (p > 0 && pout < 1) {
        const s = lerp(1.6, 1, E.outExpo(p)) * fit * (1 - pout * 0.4);
        ctx.save();
        ctx.translate(cx + w / 2, y - size * 0.35 - pout * 60);
        ctx.scale(s, s);
        ctx.globalAlpha *= clamp(p * 3) * (1 - pout);
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.ink;
        ctx.fillText(words[i], -ws[i] / 2, size * 0.35);
        ctx.restore();
      }
      cx += w + sp * fit;
    }
    ctx.restore();
    return { total: total * fit, pos };
  }
  function tagPill(text, x, y, t, t0, o = {}) {
    const p = E.outBack(P(t, t0, t0 + 0.35)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.22)) : 0;
    if (p <= 0 || out >= 1) return;
    ctx.save(); ctx.font = font(700, o.size || 30); ctx.letterSpacing = '3px';
    const tw = ctx.measureText(text).width, h = (o.size || 30) * 2, w = tw + 60;
    ctx.translate(x, y); ctx.scale(p * (1 - out), p * (1 - out));
    rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = o.bg || C.ink; ctx.fill();
    ctx.fillStyle = o.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 2, 2); ctx.restore();
  }

  // ---------- atmosphere ----------
  function background(t) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.bg); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const blobs = [[900, 300, 520, 'rgba(255,77,109,0.10)', 0.3], [120, 1500, 600, 'rgba(109,74,255,0.12)', 0.25], [980, 1700, 380, 'rgba(182,242,76,0.14)', 0.35]];
    for (const [x, y, r, c, s] of blobs) {
      const bx = x + Math.sin(t * s + y) * 60, by = y + Math.cos(t * s + x) * 60;
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      rg.addColorStop(0, c); rg.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    // plus-sign texture
    ctx.strokeStyle = 'rgba(27,22,64,0.06)'; ctx.lineWidth = 3;
    const s = 90, ox = (t * 14) % s;
    for (let y = -s; y < H + s; y += s) for (let x = -s + ox; x < W + s; x += s) {
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
    }
  }
  function finish(t) {
    const wa = P(t, 0.5, 1.2) * 0.9;
    if (wa > 0) { // logo used as-is, small, top-right
      const s = 76, x = W - 62 - s, y = 150;
      ctx.save(); ctx.globalAlpha = wa; shadow(0.18, 18, 6);
      rr(x, y, s, s, 18); ctx.fillStyle = '#004FC6'; ctx.fill(); noShadow();
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.clip(); ctx.drawImage(logo, x, y, s, s); ctx.restore();
    }
    const f = 1 - P(t, 0, 0.2) + P(t, 39.6, 40);
    if (f > 0) { ctx.fillStyle = `rgba(239,235,255,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- pointer ----------
  function pointer(x, y, s = 1, press = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - press * 0.12), s * (1 - press * 0.12));
    shadow(0.25, 12, 4);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 62); ctx.lineTo(15, 48); ctx.lineTo(27, 74); ctx.lineTo(38, 69); ctx.lineTo(26, 44); ctx.lineTo(46, 44); ctx.closePath();
    ctx.fillStyle = C.ink; ctx.fill(); noShadow(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  function pathAt(pts, u) { // Catmull-Rom through points
    const n = pts.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)), s = f - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const cr = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s * s + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s * s * s);
    return [cr(0), cr(1)];
  }

  // =====================================================================
  // 1. HOOK (0 – 5)
  // =====================================================================
  const GHOSTS = [[200, 420], [830, 470], [150, 1330], [880, 1290], [300, 1560], [760, 1600]];
  const CURSOR = [[1150, 1900], [860, 1330], [240, 1360], [820, 480], [210, 440], [720, 1590], [320, 1560], [880, 1300], [540, 1300]];
  function sHook(t) {
    background(t);
    const sq = E.inBack(P(t, 4.35, 4.95));
    ctx.save(); ctx.translate(540, 1000); ctx.scale(1 - sq * 0.8, 1 - sq * 0.8); ctx.translate(-540, -1000); ctx.globalAlpha = 1 - P(t, 4.75, 4.95);
    // ghost "?" options the pointer can't decide between
    GHOSTS.forEach(([x, y], i) => {
      const p = E.outBack(P(t, 1.3 + i * 0.1, 1.65 + i * 0.1));
      if (p <= 0) return;
      const u = P(t, 1.5, 4.2), [cx, cy] = pathAt(CURSOR, u);
      const hover = clamp(1 - Math.hypot(cx - x, cy - y) / 170);
      ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + i) * 8); ctx.scale(p * (1 + hover * 0.12), p * (1 + hover * 0.12)); ctx.rotate(Math.sin(t * 20) * 0.08 * hover);
      ctx.save(); shadow(0.1, 24, 8); rr(-110, -48, 220, 96, 48); ctx.fillStyle = hover > 0.2 ? C.violetL : '#fff'; ctx.fill(); ctx.restore();
      rr(-110, -48, 220, 96, 48); ctx.setLineDash([10, 8]); ctx.strokeStyle = hover > 0.2 ? C.violet : C.mute; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      ctx.font = font(700, 50); ctx.fillStyle = hover > 0.2 ? C.violet : C.mute; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 3);
      ctx.restore();
    });
    kLine('Bingung', 540, 820, t, 0.2, { size: 170 });
    kLine('mulai', 540, 990, t, 0.5, { size: 170 });
    kLine('dari mana?', 540, 1160, t, 0.8, { size: 150, stagger: 0.12, hl: { 1: C.coral } });
    // pointer wandering
    const u = P(t, 1.5, 4.2);
    if (t > 1.5) { const [x, y] = pathAt(CURSOR, u); pointer(x, y, 1.1, bump(t, 4.05, 4.3)); }
    ctx.restore();
  }

  // =====================================================================
  // 2–3. BIG TASK -> untangle into 4 lines -> checklist  (5 – 14.6)
  // =====================================================================
  const STEPS = ['Pahami tugas', 'Kumpulkan bahan', 'Kerjakan bagian utama', 'Review'];
  const S0 = 14.5, SD = 4; // steps start / duration
  const CHK = i => S0 + i * SD + 3.2;
  const BIG = { x: 90, y: 520, w: 900, h: 1020 };
  const LIST_L = { x: 90, y: 560, w: 900, h: 760 };
  const LIST_S = { x: 110, y: 1200, w: 860, h: 380 };
  const CHIPS = ['riset', 'outline', 'sumber', 'data', 'kutipan', 'format', 'revisi', 'kesimpulan'];
  const KN = 480;
  const knot = [];
  for (let k = 0; k < KN; k++) {
    const u = k / (KN - 1), a = u * TAU * 7.3;
    const r = 150 + 70 * Math.sin(u * TAU * 5.1) + 30 * Math.sin(u * TAU * 13);
    knot.push([540 + r * Math.cos(a) * 1.25, 1060 + r * Math.sin(a * 1.07 + 0.6)]);
  }
  // checklist layout for any moment
  function listRect(t) {
    const toS = E.inOutExpo(P(t, 14.0, 14.7)), toL = E.inOutExpo(P(t, 30.4, 31.1));
    const grow = E.inOutCubic(P(t, 12.2, 13.1));
    let r = lerpRect(BIG, LIST_L, grow);
    if (toS > 0) r = lerpRect(LIST_L, LIST_S, toS);
    if (toL > 0) r = lerpRect(LIST_S, LIST_L, toL);
    return r;
  }
  function rowGeom(r, i) {
    const big = clamp((r.h - LIST_S.h) / (LIST_L.h - LIST_S.h));
    const head = lerp(132, 230, big), gap = lerp(66, 130, big), h = lerp(54, 104, big);
    return { x: r.x + lerp(24, 40, big), y: r.y + head + i * gap, w: r.w - lerp(48, 80, big), h, fs: lerp(28, 44, big), big };
  }
  const progressAt = t => STEPS.reduce((s, _, i) => s + 25 * E.inOutCubic(P(t, CHK(i), CHK(i) + 0.5)), 0);
  function drawList(t, o = {}) {
    const r = listRect(t), a = o.a ?? 1;
    ctx.save(); ctx.globalAlpha *= a;
    card(r.x, r.y, r.w, r.h, 44);
    const g = rowGeom(r, 0), big = g.big;
    // header: title + progress
    ctx.font = font(700, lerp(30, 54, big)); ctx.letterSpacing = '-1px'; ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('Makalah 3.000 kata', r.x + lerp(24, 40, big), r.y + lerp(42, 70, big));
    const prog = progressAt(t);
    const bx = r.x + lerp(24, 40, big), by = r.y + lerp(78, 128, big), bw = r.w - lerp(48, 80, big);
    rr(bx, by, bw, 14, 7); ctx.fillStyle = C.line; ctx.fill();
    if (prog > 0) { rr(bx, by, bw * prog / 100, 14, 7); ctx.fillStyle = prog >= 99.5 ? C.lime : C.violet; ctx.fill(); }
    ctx.font = font(700, lerp(30, 44, big)); ctx.letterSpacing = '0px'; ctx.textAlign = 'right'; ctx.fillStyle = prog >= 99.5 ? '#1E9E6A' : C.violet;
    ctx.fillText(`${Math.round(prog)}%`, r.x + r.w - lerp(24, 40, big), r.y + lerp(42, 70, big));
    // rows
    const active = t >= S0 && t < S0 + 4 * SD ? Math.floor((t - S0) / SD) : -1;
    STEPS.forEach((name, i) => {
      const rg = rowGeom(r, i);
      const appear = o.rowsIn ? E.outBack(P(t, o.rowsIn + i * 0.1, o.rowsIn + 0.35 + i * 0.1)) : 1;
      if (appear <= 0) return;
      const done = P(t, CHK(i), CHK(i) + 0.35);
      ctx.save(); ctx.translate(rg.x, rg.y); ctx.globalAlpha *= clamp(appear);
      if (i === active && done < 1) { rr(-8, -rg.h / 2 - 4, rg.w + 16, rg.h + 8, rg.h / 2); ctx.fillStyle = 'rgba(109,74,255,0.10)'; ctx.fill(); ctx.strokeStyle = C.violet; ctx.lineWidth = 3; ctx.stroke(); }
      // checkbox
      const cb = rg.h * 0.62, pop = 1 + 0.25 * bump(t, CHK(i), CHK(i) + 0.3);
      ctx.save(); ctx.translate(cb / 2 + 8, 0); ctx.scale(appear * pop, appear * pop);
      rr(-cb / 2, -cb / 2, cb, cb, cb * 0.3);
      if (done > 0) { ctx.fillStyle = C.lime; ctx.fill(); tick(0, 0, cb * 0.8, C.ink, cb * 0.13, E.outCubic(done)); }
      else { ctx.strokeStyle = C.mute; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore();
      // burst ring
      const br = P(t, CHK(i), CHK(i) + 0.5);
      if (br > 0 && br < 1) { ctx.beginPath(); ctx.arc(cb / 2 + 8, 0, cb * 0.6 + br * cb * 1.4, 0, TAU); ctx.strokeStyle = `rgba(182,242,76,${1 - br})`; ctx.lineWidth = 5; ctx.stroke(); }
      // number + label
      const lx = cb + 34;
      ctx.font = font(700, rg.fs); ctx.letterSpacing = '0px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = C.violet; ctx.fillText(`0${i + 1}`, lx, 2);
      const nx = lx + ctx.measureText('00').width + rg.fs * 0.5;
      const reveal = o.typeIn ? clamp((t - (o.typeIn + i * 0.12)) / 0.35) : 1;
      const label = name.slice(0, Math.round(name.length * reveal));
      ctx.fillStyle = done > 0.5 ? C.ink2 : C.ink; ctx.fillText(label, nx, 2);
      if (done > 0) { const lw = ctx.measureText(name).width; line(nx - 4, 2, nx - 4 + (lw + 8) * E.inOutCubic(P(t, CHK(i) + 0.1, CHK(i) + 0.4)), 2, C.ink2, 4); }
      ctx.restore();
    });
    ctx.restore();
  }
  function sBig(t) {
    background(t);
    const pin = E.outBack(P(t, 4.8, 5.4));
    const un = E.inOutCubic(P(t, 12.3, 13.4));           // untangle
    const r = listRect(t);
    ctx.save();
    ctx.translate(540, 1030); ctx.scale(lerp(0.2, 1, pin), lerp(0.2, 1, pin)); ctx.translate(-540, -1030);
    // card shell (turns into the checklist card)
    if (t < 13.4) {
      card(r.x, r.y, r.w, r.h, 44);
      ctx.save(); ctx.globalAlpha *= 1 - un;
      ctx.font = font(700, 30); ctx.letterSpacing = '3px'; ctx.fillStyle = C.violet; ctx.textBaseline = 'middle';
      ctx.fillText('TUGAS BESAR', BIG.x + 44, BIG.y + 56);
      // due chip
      rr(BIG.x + BIG.w - 250, BIG.y + 30, 206, 54, 27); ctx.fillStyle = C.coral; ctx.fill();
      ctx.font = font(700, 26); ctx.letterSpacing = '0px'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('3 hari lagi', BIG.x + BIG.w - 147, BIG.y + 58);
      ctx.textAlign = 'left'; ctx.font = font(700, 64); ctx.letterSpacing = '-2px'; ctx.fillStyle = C.ink;
      ctx.fillText('Makalah 3.000 kata', BIG.x + 44, BIG.y + 140);
      rr(BIG.x + 44, BIG.y + BIG.h - 70, BIG.w - 200, 14, 7); ctx.fillStyle = C.line; ctx.fill();
      ctx.font = font(700, 34); ctx.textAlign = 'right'; ctx.fillText('0%', BIG.x + BIG.w - 44, BIG.y + BIG.h - 62);
      ctx.restore();
    }
    // checklist appears where the lines land
    if (t >= 13.2) drawList(t, { rowsIn: 13.3, typeIn: 13.5 });
    // the knot: draws itself tighter and tighter, then straightens into 4 lines
    const draw = E.inOutCubic(P(t, 5.3, 8.6));
    const tight = 1 + 0.05 * Math.sin(t * 9) * P(t, 9.5, 12.2);
    if (draw > 0 && t < 14.0) {
      const Rr = rowGeom(listRect(Math.max(t, 13.2)), 0);
      ctx.save(); ctx.beginPath();
      const upto = Math.floor(KN * draw);
      for (let k = 0; k < upto; k++) {
        let [x, y] = knot[k];
        x = 540 + (x - 540) * tight; y = 1060 + (y - 1060) * tight;
        if (un > 0) {
          const seg = Math.floor(k / (KN / 4)), u = (k % (KN / 4)) / (KN / 4 - 1);
          const rg = rowGeom(listRect(Math.max(t, 13.2)), seg);
          const tx = rg.x + 90 + u * (rg.w - 130), ty = rg.y + rg.h * 0.45;
          const e = E.inOutCubic(clamp(un * 1.3 - (k / KN) * 0.3));
          x = lerp(x, tx, e); y = lerp(y, ty, e);
          if (k % (KN / 4) === 0) { ctx.moveTo(x, y); continue; }
        }
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = un > 0.5 ? C.violet : C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha *= 1 - P(t, 13.4, 13.75); ctx.stroke(); ctx.restore();
      void Rr;
    }
    // sub-task chips orbiting (overwhelm), flung out on untangle
    CHIPS.forEach((c, i) => {
      const p = E.outBack(P(t, 6.0 + i * 0.22, 6.35 + i * 0.22));
      if (p <= 0) return;
      const fling = E.inCubic(P(t, 12.1 + i * 0.03, 12.7 + i * 0.03));
      if (fling >= 1) return;
      const speed = lerp(0.6, 1.8, P(t, 7, 12));
      const a = i / CHIPS.length * TAU + t * speed * (i % 2 ? 1 : -1) * 0.7;
      const rx = 330 + (i % 3) * 20, ry = 300 + (i % 2) * 40;
      const x = 540 + Math.cos(a) * rx * (1 + fling * 1.6), y = 1060 + Math.sin(a) * ry * (1 + fling * 1.6);
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.rotate(Math.sin(a * 2) * 0.12); ctx.globalAlpha *= 1 - fling;
      ctx.font = font(700, 32); ctx.letterSpacing = '0px';
      const w = ctx.measureText(c).width + 44;
      ctx.save(); shadow(0.14, 18, 6); rr(-w / 2, -30, w, 60, 30); ctx.fillStyle = i % 3 === 0 ? C.yellow : '#fff'; ctx.fill(); ctx.restore();
      ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c, 0, 2);
      ctx.restore();
    });
    ctx.restore();
    // headline
    kLine('Kelihatan', 540, 290, t, 5.6, { size: 84, weight: 500, color: C.ink2, out: 12.0 });
    kLine('rumit banget.', 540, 410, t, 5.85, { size: 110, hl: { 0: C.coral }, out: 12.05 });
    kLine('Pecah jadi', 540, 290, t, 12.5, { size: 84, weight: 500, color: C.ink2, out: 14.0 });
    kLine('4 langkah.', 540, 410, t, 12.7, { size: 110, hl: { 0: C.violet }, out: 14.05 });
  }

  // =====================================================================
  // 4. THE FOUR STEPS  (14.5 – 30.5)
  // =====================================================================
  const PANEL = { x: 90, y: 480, w: 900, h: 680 };
  function docSheet(x, y, w, h, lines = 9) {
    ctx.save(); shadow(0.1, 24, 8); rr(x, y, w, h, 24); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    rr(x, y, w, h, 24); ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
    const out = [];
    for (let i = 0; i < lines; i++) { const lw = (w - 80) * (0.55 + rnd(i + 3) * 0.45); out.push([x + 40, y + 60 + i * ((h - 100) / (lines - 1)), lw]); }
    return out;
  }
  function stUnderstand(lt) {
    const L = docSheet(90, 70, 470, 540, 9);
    L.forEach(([x, y, w]) => { rr(x, y - 7, w, 14, 7); ctx.fillStyle = '#E9E6F7'; ctx.fill(); });
    // highlighter on 3 key lines
    [1, 4, 7].forEach((li, k) => {
      const p = E.inOutCubic(P(lt, 0.5 + k * 0.45, 0.85 + k * 0.45));
      if (p <= 0) return;
      const [x, y, w] = L[li];
      rr(x - 8, y - 18, (w + 16) * p, 36, 8); ctx.fillStyle = 'rgba(255,210,63,0.75)'; ctx.fill();
      rr(x, y - 7, w, 14, 7); ctx.fillStyle = C.ink; ctx.fill();
    });
    // lens scanning
    const [lx, ly] = pathAt([[150, 150], [460, 190], [200, 330], [470, 380], [220, 520], [420, 560]], P(lt, 0.2, 2.2));
    if (lt < 2.6) {
      ctx.save(); ctx.globalAlpha *= 1 - P(lt, 2.3, 2.6);
      ctx.beginPath(); ctx.arc(lx, ly, 64, 0, TAU); ctx.fillStyle = 'rgba(109,74,255,0.08)'; ctx.fill(); ctx.lineWidth = 12; ctx.strokeStyle = C.ink; ctx.stroke();
      line(lx + 46, ly + 46, lx + 100, ly + 100, C.ink, 18); ctx.restore();
    }
    // key takeaways
    ['topik', 'format', 'deadline'].forEach((w, k) => {
      const p = E.outBack(P(lt, 0.85 + k * 0.45, 1.2 + k * 0.45));
      if (p <= 0) return;
      const y = 170 + k * 150;
      ctx.save(); ctx.translate(730, y); ctx.scale(p, p);
      ctx.save(); shadow(0.12, 20, 8); rr(-140, -50, 280, 100, 28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      circle(-92, 0, 22, C.yellow);
      ctx.font = font(700, 38); ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(w, -56, 2);
      ctx.restore();
    });
  }
  function glyph(kind, x, y, s, c) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'link') { [-1, 1].forEach(d => { ctx.save(); ctx.rotate(-0.8); rr(d * s * 0.16 - s * 0.24, -s * 0.13, s * 0.48, s * 0.26, s * 0.13); ctx.stroke(); ctx.restore(); }); }
    else if (kind === 'book') { ctx.beginPath(); ctx.moveTo(0, -s * 0.25); ctx.quadraticCurveTo(-s * 0.2, -s * 0.35, -s * 0.4, -s * 0.28); ctx.lineTo(-s * 0.4, s * 0.3); ctx.quadraticCurveTo(-s * 0.2, s * 0.22, 0, s * 0.32); ctx.quadraticCurveTo(s * 0.2, s * 0.22, s * 0.4, s * 0.3); ctx.lineTo(s * 0.4, -s * 0.28); ctx.quadraticCurveTo(s * 0.2, -s * 0.35, 0, -s * 0.25); ctx.lineTo(0, s * 0.32); ctx.stroke(); }
    else if (kind === 'quote') { ctx.font = font(700, s * 0.9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('“', 0, s * 0.2); }
    else if (kind === 'chart') { [[-0.25, 0.1], [0, -0.1], [0.25, -0.3]].forEach(([dx, tp]) => line(dx * s, s * 0.3, dx * s, tp * s, c, s * 0.14)); }
    else if (kind === 'photo') { rr(-s * 0.35, -s * 0.27, s * 0.7, s * 0.54, s * 0.08); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.2); ctx.lineTo(-s * 0.05, -s * 0.03); ctx.lineTo(s * 0.12, s * 0.14); ctx.stroke(); circle(s * 0.15, -s * 0.1, s * 0.06, c); }
    ctx.restore();
  }
  function stGather(lt) {
    // tray
    const tx = 450, ty = 560;
    const items = [['link', C.violet, [-300, -200]], ['book', C.coral, [1100, -100]], ['quote', C.ink, [-200, 700]], ['chart', '#1E9E6A', [1100, 600]], ['photo', '#C98A00', [450, -300]]];
    const got = items.filter((_, k) => lt >= 0.4 + k * 0.4 + 0.45).length;
    // stack inside tray
    items.forEach(([kind, col, from], k) => {
      const t0 = 0.4 + k * 0.4, p = E.inOutCubic(P(lt, t0, t0 + 0.45));
      if (lt < t0 - 0.2) return;
      const sx = from[0], sy = from[1];
      const ex = tx - 180 + k * 90, ey = ty - 120 - (k % 2) * 30;
      const x = lerp(sx, ex, p), y = lerp(sy, ey, p) - Math.sin(p * Math.PI) * 120;
      const land = bump(lt, t0 + 0.45, t0 + 0.65);
      ctx.save(); ctx.translate(x, y); ctx.rotate((1 - p) * (k % 2 ? 0.8 : -0.8) + (k - 2) * 0.08); ctx.scale(1 + land * 0.1, 1 - land * 0.1);
      ctx.save(); shadow(0.14, 20, 8); rr(-80, -80, 160, 160, 36); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      glyph(kind, 0, 0, 110, col);
      ctx.restore();
    });
    // tray front
    ctx.save(); shadow(0.14, 30, 10); rr(tx - 330, ty - 60, 660, 150, 40); ctx.fillStyle = C.violet; ctx.fill(); ctx.restore();
    ctx.font = font(700, 48); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '-1px';
    ctx.fillText('Bahan', tx - 280, ty + 16);
    const cp = 1 + 0.2 * Math.max(0, ...items.map((_, k) => bump(lt, 0.85 + k * 0.4, 1.1 + k * 0.4)));
    ctx.save(); ctx.translate(tx + 240, ty + 15); ctx.scale(cp, cp); rr(-56, -34, 112, 68, 34); ctx.fillStyle = C.lime; ctx.fill();
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.font = font(700, 40); ctx.fillText(`${got}`, 0, 3); ctx.restore();
  }
  function stWork(lt) {
    // editor window
    ctx.save(); shadow(0.1, 24, 8); rr(60, 40, 780, 600, 30); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    rr(60, 40, 780, 70, [30, 30, 0, 0]); ctx.fillStyle = '#F6F4FF'; ctx.fill();
    [C.coral, C.yellow, C.lime].forEach((c, i) => circle(100 + i * 32, 75, 10, c));
    // sections: intro (short), BODY (main, highlighted), closing
    const secs = [[140, 2, 0.15], [260, 6, 0.4], [520, 2, 1.9]];
    secs.forEach(([y, n, st], s) => {
      const main = s === 1;
      if (main) { rr(84, y - 30, 732, n * 40 + 28, 18); ctx.fillStyle = 'rgba(109,74,255,0.07)'; ctx.fill(); rr(84, y - 30, 8, n * 40 + 28, 4); ctx.fillStyle = C.violet; ctx.fill(); }
      for (let i = 0; i < n; i++) {
        const full = 640 * (0.6 + rnd(i + s * 10) * 0.4);
        const p = P(lt, st + i * (main ? 0.22 : 0.18), st + i * (main ? 0.22 : 0.18) + (main ? 0.3 : 0.2));
        if (p <= 0) continue;
        rr(120, y + i * 40 - 7, full * p, 14, 7); ctx.fillStyle = main ? C.ink : '#CFCAE6'; ctx.fill();
        if (p < 1) { rr(124 + full * p, y + i * 40 - 18, 4, 36, 2); ctx.fillStyle = C.violet; ctx.fill(); }
      }
    });
    // word counter
    const n = Math.round(lerp(0, 1800, E.inOutCubic(P(lt, 0.2, 2.6))));
    ctx.save(); ctx.translate(700, 75); rr(-110, -26, 220, 52, 26); ctx.fillStyle = C.ink; ctx.fill();
    ctx.font = font(700, 28); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${n.toLocaleString('id-ID')} kata`, 0, 2); ctx.restore();
  }
  function stReview(lt) {
    const L = docSheet(90, 50, 720, 560, 8);
    const issues = [1, 4, 6];
    const scan = P(lt, 0.9, 2.3);
    L.forEach(([x, y, w], i) => {
      rr(x, y - 7, w, 14, 7); ctx.fillStyle = '#D9D5EE'; ctx.fill();
      if (!issues.includes(i)) return;
      const k = issues.indexOf(i);
      const seen = P(lt, 0.2 + k * 0.18, 0.45 + k * 0.18);
      const fixed = P(lt, 0.9 + (y - 50) / 560 * 1.4, 1.1 + (y - 50) / 560 * 1.4);
      if (seen > 0 && fixed < 1) { // coral squiggle
        ctx.save(); ctx.globalAlpha *= 1 - fixed; ctx.beginPath();
        for (let q = 0; q <= 30 * seen; q++) ctx.lineTo(x + w * q / 30, y + 18 + Math.sin(q * 1.3) * 5);
        ctx.strokeStyle = C.coral; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
      }
      if (fixed > 0) {
        const s = E.outBack(fixed);
        ctx.save(); ctx.translate(x + w + 40, y); ctx.scale(s, s); circle(0, 0, 22, C.lime); tick(0, 0, 26, C.ink, 5, fixed); ctx.restore();
      }
    });
    // scan bar
    if (scan > 0 && scan < 1) {
      const y = 50 + scan * 560;
      const g = ctx.createLinearGradient(0, y - 60, 0, y);
      g.addColorStop(0, 'rgba(109,74,255,0)'); g.addColorStop(1, 'rgba(109,74,255,0.22)');
      ctx.fillStyle = g; ctx.fillRect(90, y - 60, 720, 60); line(90, y, 810, y, C.violet, 5);
    }
    // ready toggle
    const on = E.inOutCubic(P(lt, 2.45, 2.75));
    ctx.save(); ctx.translate(450, 660);
    ctx.font = font(700, 38); ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('Siap kirim', -20, 2);
    rr(10, -32, 120, 64, 32); ctx.fillStyle = on > 0.5 ? C.lime : '#D9D5EE'; ctx.fill();
    circle(lerp(42, 98, on), 0, 25, on > 0.5 ? C.ink : '#fff'); ctx.restore();
  }
  const ST_FN = [stUnderstand, stGather, stWork, stReview];

  function sSteps(t) {
    background(t);
    // illustration panel with horizontal hand-offs between steps
    STEPS.forEach((name, i) => {
      const s = S0 + i * SD;
      const inP = i === 0 ? E.outBack(P(t, 14.3, 14.9)) : E.inOutExpo(P(t, s - 0.25, s + 0.25));
      const outP = i < 3 ? E.inOutExpo(P(t, s + SD - 0.25, s + SD + 0.25)) : E.inOutExpo(P(t, 30.3, 30.8));
      if (inP <= 0 || outP >= 1) return;
      const x = i === 0 ? 0 : (1 - inP) * W;
      ctx.save(); ctx.translate(x - outP * W, 0);
      if (i === 0) { ctx.translate(540, PANEL.y + PANEL.h / 2); ctx.scale(inP, inP); ctx.translate(-540, -(PANEL.y + PANEL.h / 2)); }
      ctx.translate(PANEL.x, PANEL.y);
      ST_FN[i](Math.max(0, t - s - (i === 0 ? 0.3 : 0.1)));
      ctx.restore();
      // step tag + title
      tagPill(`LANGKAH 0${i + 1}`, 540, 230, t, s + (i === 0 ? 0.1 : -0.05), { bg: C.violet, out: s + SD - 0.25 });
      kLine(name, 540, 380, t, s + 0.05, { size: 92, out: s + SD - 0.3, maxW: 940 });
    });
    drawList(t);
  }

  // =====================================================================
  // 5. ALL DONE  (30.5 – 34.2)  +  6. ENDING (34 – 40)
  // =====================================================================
  function sDone(t) {
    background(t);
    const out = E.inOutExpo(P(t, 33.7, 34.3));
    ctx.save(); ctx.translate(0, out * -300); ctx.globalAlpha = 1 - out;
    drawList(t);
    // 100% ring
    const rp = E.outBack(P(t, 31.0, 31.5));
    if (rp > 0) {
      const cx = 540, cy = 1520, r = 120;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rp, rp);
      ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * E.inOutCubic(P(t, 31.2, 32.0))); ctx.strokeStyle = C.lime; ctx.stroke();
      ctx.font = font(700, 64); ctx.letterSpacing = '-2px'; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(100 * P(t, 31.2, 32.0))}%`, 0, 4); ctx.restore();
    }
    // confetti
    const cf = P(t, 32.0, 33.6);
    if (cf > 0 && cf < 1) for (let k = 0; k < 36; k++) {
      const a = rnd(k) * TAU, v = 300 + rnd(k + 5) * 500;
      const x = 540 + Math.cos(a) * v * cf, y = 1520 + Math.sin(a) * v * cf + 700 * cf * cf;
      ctx.save(); ctx.translate(x, y); ctx.rotate(cf * 12 * (rnd(k + 9) - 0.5)); ctx.globalAlpha *= 1 - cf;
      ctx.fillStyle = [C.lime, C.coral, C.violet, C.yellow][k % 4]; ctx.fillRect(-9, -5, 18, 10); ctx.restore();
    }
    ctx.restore();
  }
  function sEnd(t) {
    background(t);
    kLine('Task besar', 540, 560, t, 34.1, { size: 110 });
    kLine('jadi lebih ringan', 540, 700, t, 34.35, { size: 100, hl: { 2: C.violet }, stagger: 0.06 });
    kLine('kalau dipecah.', 540, 840, t, 34.75, { size: 100, hl: { 1: C.coral } });
    // four light, floating step chips
    for (let i = 0; i < 4; i++) {
      const p = E.outBack(P(t, 35.4 + i * 0.12, 35.8 + i * 0.12));
      if (p <= 0) continue;
      const x = 540 + (i - 1.5) * 206, y = 1110 + Math.sin(t * 2.2 + i * 1.2) * 16 - (1 - p) * 120;
      const first = i === 0 ? P(t, 37.5, 37.9) : 0;
      ctx.save(); ctx.translate(x, y); ctx.scale(p * (1 + first * 0.12 + first * 0.04 * Math.sin(t * 6)), p * (1 + first * 0.12 + first * 0.04 * Math.sin(t * 6)));
      ctx.rotate(Math.sin(t * 1.7 + i) * 0.05);
      ctx.save(); shadow(first > 0 ? 0.25 : 0.12, 30, 10); rr(-88, -70, 176, 140, 36); ctx.fillStyle = first > 0 ? C.violet : '#fff'; ctx.fill(); ctx.restore();
      ctx.font = font(700, 52); ctx.letterSpacing = '-1px'; ctx.fillStyle = first > 0 ? '#fff' : C.violet; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`0${i + 1}`, -16, 4);
      circle(48, -34, 20, C.lime); tick(48, -34, 22, C.ink, 4, 1);
      ctx.restore();
    }
    kLine('Mulai dari langkah pertama.', 540, 1330, t, 37.6, { size: 46, weight: 500, color: C.ink2, stagger: 0.05, spacing: 0 });
    const ap = E.inOutCubic(P(t, 38.1, 38.5));
    if (ap > 0) { // tiny arrow pointing back up to 01
      const x = 540 - 1.5 * 206;
      ctx.save(); ctx.globalAlpha = ap; line(x, 1270, x, 1270 - 60 * ap, C.violet, 6);
      ctx.beginPath(); ctx.moveTo(x - 14, 1226); ctx.lineTo(x, 1208); ctx.lineTo(x + 14, 1226); ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    }
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px'; noShadow();
    if (t < 4.8) sHook(t);
    else if (t < 4.95) { sHook(t); sBigNoBg(t); }
    else if (t < 14.3) sBig(t);
    else if (t < 30.5) sSteps(t);
    else if (t < 34.0) sDone(t);
    else if (t < 34.3) { sDone(t); sEndNoBg(t); }
    else sEnd(t);
    finish(t);
    ctx.restore();
  }
  const noBg = fn => t => { const b = background; background = () => {}; try { fn(t); } finally { background = b; } };
  const sBigNoBg = noBg(sBig), sEndNoBg = noBg(sEnd);

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
