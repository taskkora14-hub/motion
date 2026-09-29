/* "1 task, 5 masalah" — 60s, 1080x1920, 120 BPM (1 beat = 0.5 s, 1 bar = 2 s).
 * One task hides five problems; they pile up, explode into chaos, then get split and checked off
 * one by one. Every frame is a pure function of time, so preview and export are identical. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 60;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    paper: '#F3F1EC', night: '#16111A', ink: '#15171D', sub: '#6A707C', faint: 'rgba(21,23,29,0.08)',
    white: '#FFFFFF', blue: '#004FC6', green: '#14B06A', red: '#FF3B30', amber: '#FF9F1C',
  };
  // the five problems — one colour + icon each, used everywhere they appear
  const PB = [
    { key: 'desain', a: 'desain', b: 'berantakan', col: '#FF4F8B' },
    { key: 'data', a: 'data', b: 'belum diolah', col: '#FF9F1C' },
    { key: 'file', a: 'file', b: 'belum rapi', col: '#12B5A6' },
    { key: 'revisi', a: 'revisi', b: 'belum selesai', col: '#8B5CF6' },
    { key: 'deadline', a: 'deadline', b: 'semakin dekat', col: '#FF3B30' },
  ];
  const FONT = '"OF", "Noto Color Emoji", sans-serif', MONO = '"DM", monospace';
  const F = (w, s) => `${w} ${s}px ${FONT}`, M = s => `500 ${s}px ${MONO}`;

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
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inBack: x => { const c1 = 1.7; return (c1 + 1) * x * x * x - c1 * x * x; },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixC = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(t)))).join(',')})`; };
  const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  const beat = t => Math.exp(-((t * 2) % 1) * 5);          // 120 BPM pulse, 1 at every beat

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    ...[500, 700, 900].map(w => document.fonts.load(F(w, 40))),
    document.fonts.load(M(40)), document.fonts.load(`40px "Noto Color Emoji"`),
  ]).then(() => document.fonts.ready);

  // ---------- drawing helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function card(x, y, w, h, r, fill, sh = 0.12, blur = 40) {
    ctx.save(); ctx.shadowColor = `rgba(20,20,30,${sh})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = blur * 0.35;
    rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function tick(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.15; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - clamp(p));
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function text(s, x, y, font, fill, align = 'center', base = 'middle') {
    ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, x, y);
  }

  // white line icon for each problem, centred at (x, y), size s
  function icon(i, x, y, s, col = '#fff') {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (i === 0) { // shapes: square + circle overlapping, a little off
      ctx.save(); ctx.rotate(-0.18); ctx.strokeRect(-0.34, -0.34, 0.42, 0.42); ctx.restore();
      ctx.beginPath(); ctx.arc(0.12, 0.12, 0.22, 0, TAU); ctx.fill();
    } else if (i === 1) { // bar chart
      [[-0.3, 0.3], [-0.06, 0.55], [0.18, 0.4]].forEach(([bx, bh]) => { ctx.beginPath(); ctx.roundRect(bx, 0.3 - bh, 0.16, bh, 0.03); ctx.fill(); });
      line(-0.4, 0.36, 0.42, 0.36, col, 0.08);
    } else if (i === 2) { // folder
      ctx.beginPath(); ctx.moveTo(-0.4, -0.24); ctx.lineTo(-0.12, -0.24); ctx.lineTo(-0.04, -0.14); ctx.lineTo(0.4, -0.14);
      ctx.lineTo(0.4, 0.3); ctx.lineTo(-0.4, 0.3); ctx.closePath(); ctx.stroke();
      line(-0.4, -0.02, 0.4, -0.02, col, 0.08);
    } else if (i === 3) { // speech bubble with lines
      ctx.beginPath(); ctx.roundRect(-0.4, -0.32, 0.8, 0.52, 0.1); ctx.moveTo(-0.18, 0.2); ctx.lineTo(-0.26, 0.38); ctx.lineTo(0.0, 0.2); ctx.stroke();
      line(-0.24, -0.14, 0.24, -0.14, col, 0.07); line(-0.24, 0.02, 0.1, 0.02, col, 0.07);
    } else { // clock
      ctx.beginPath(); ctx.arc(0, 0.04, 0.34, 0, TAU); ctx.stroke();
      line(0, 0.04, 0, -0.16, col, 0.08); line(0, 0.04, 0.15, 0.1, col, 0.08); line(-0.08, -0.4, 0.08, -0.4, col, 0.08);
    }
    ctx.restore();
  }
  function tile(i, x, y, s, a = 1) {
    if (s <= 0 || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    card(x - s / 2, y - s / 2, s, s, s * 0.26, PB[i].col, 0.18, s * 0.2);
    icon(i, x, y, s * 0.62);
    ctx.restore();
  }

  // Kinetic line: each word rises out of its own mask. o.pill / o.hl colour single words,
  // o.pop turns a word (emoji) into a bouncy pop, o.glitch splits RGB.
  function words(str, x, y, t, t0, o = {}) {
    const size = o.size || 110, st = o.stagger ?? 0.07, dur = o.dur ?? 0.55;
    ctx.save();
    ctx.font = F(o.w || 900, size); ctx.letterSpacing = (o.ls ?? -Math.round(size * 0.03)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const ws = str.split(' '), sp = size * 0.26;
    const wd = ws.map(s => ctx.measureText(s).width);
    const total = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    const k = total > (o.maxW || 960) ? (o.maxW || 960) / total : 1;
    let cx = o.align === 'left' ? x : x - total * k / 2;
    for (let i = 0; i < ws.length; i++) {
      const a = t0 + i * st, p = P(t, a, a + dur);
      const po = o.out != null ? E.inCubic(P(t, o.out + i * 0.035, o.out + i * 0.035 + 0.32)) : 0;
      if (p > 0 && po < 1) {
        ctx.save(); ctx.translate(cx, y); ctx.scale(k, k);
        if (o.pop && o.pop[i]) {
          const e = E.outBack(P(t, a, a + 0.45)) * (1 - po);
          ctx.translate(wd[i] / 2, -size * 0.36); ctx.rotate(Math.sin((t - a) * 7) * 0.12 * Math.exp(-(t - a) * 1.5)); ctx.scale(e, e);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(ws[i], 0, 0);
        } else {
          if (o.pill && o.pill[i]) {
            const pp = E.outExpo(P(t, a + 0.05, a + 0.45));
            ctx.save(); ctx.globalAlpha *= 1 - po;
            rr(-size * 0.13, -size * 0.8 - po * size * 0.5, (wd[i] + size * 0.26) * pp, size * 1.0, size * 0.22); ctx.fillStyle = o.pill[i]; ctx.fill(); ctx.restore();
          }
          ctx.beginPath(); ctx.rect(-size * 0.4, -size * 1.05, wd[i] + size * 0.8, size * 1.38); ctx.clip();
          const dy = (1 - E.outExpo(p)) * size * 1.1 - po * size * 1.1;
          if (o.glitch) {
            const g = o.glitch, j = Math.floor(t * 24) + i * 7;
            const gx = (rnd(j) - 0.5) * 26 * g, gy = (rnd(j + 3) - 0.5) * 8 * g;
            ctx.fillStyle = 'rgba(255,40,90,0.85)'; ctx.fillText(ws[i], gx - 5 * g, dy + gy);
            ctx.fillStyle = 'rgba(0,225,255,0.85)'; ctx.fillText(ws[i], -gx + 5 * g, dy - gy);
          }
          ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.ink;
          ctx.fillText(ws[i], 0, dy);
        }
        ctx.restore();
      }
      cx += (wd[i] + sp) * k;
    }
    ctx.restore();
  }
  function monoLabel(s, x, y, t, t0, col, out) {
    const p = E.outExpo(P(t, t0, t0 + 0.4)), po = out != null ? P(t, out, out + 0.25) : 0;
    if (p <= 0 || po >= 1) return;
    ctx.save(); ctx.globalAlpha *= (1 - po) * clamp(p * 2); ctx.font = M(30); ctx.letterSpacing = '2px';
    const w = ctx.measureText(s).width;
    ctx.translate(x - (w + 44) / 2, y);
    circle(12, 0, 10 * p, col);
    ctx.fillStyle = C.sub; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.beginPath(); ctx.rect(30, -30, (w + 20) * p, 60); ctx.clip(); ctx.fillText(s, 40, 2);
    ctx.restore();
  }

  // ---------- background ----------
  const dark = t => (t < 40 ? E.inOutCubic(P(t, 31.7, 32.35)) : 0);
  function background(t) {
    const d = dark(t);
    ctx.fillStyle = mixC(C.paper, C.night, d); ctx.fillRect(0, 0, W, H);
    const b = beat(t), on = t > 5 ? 1 : 0.4;
    const off = (t * 10) % 60;
    ctx.fillStyle = d > 0.5 ? `rgba(255,255,255,${0.06 + 0.04 * b * on})` : `rgba(21,23,29,${0.07 + 0.03 * b * on})`;
    for (let y = -60 + off; y < H + 60; y += 60) for (let x = 30; x < W; x += 60) ctx.fillRect(x - 2, y - 2, 4, 4);
    if (d > 0) { // red pressure vignette, pulsing on the beat
      const g = ctx.createRadialGradient(540, 960, 300, 540, 960, 1250);
      g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${d * (0.22 + 0.2 * b * P(t, 34, 39))})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  // =====================================================================
  // 0–5  HOOK — "1 task." / "5 masalah. 😭"
  // =====================================================================
  const CHIP = [[280, 660, -0.08], [800, 650, 0.07], [220, 1100, 0.06], [860, 1110, -0.07], [540, 1190, 0.03]];
  function taskCard(cx, cy, s, t, o = {}) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    const w = 780, h = 230;
    card(-w / 2, -h / 2, w, h, 44, C.white, 0.14, 50);
    if (o.warn > 0) { rr(-w / 2, -h / 2, w, h, 44); ctx.strokeStyle = rgba(C.red, o.warn); ctx.lineWidth = 6; ctx.stroke(); }
    rr(-w / 2 + 50, -38, 76, 76, 22); ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.stroke();
    text('tugas besar', -w / 2 + 160, -24, F(800, 60), C.ink, 'left');
    text(o.sub || '1 task · belum dimulai', -w / 2 + 162, 42, M(26), C.sub, 'left');
    rr(w / 2 - 150, -30, 104, 60, 30); ctx.fillStyle = C.faint; ctx.fill();
    text('0%', w / 2 - 98, 2, M(28), C.ink);
    if (o.badge > 0) { // notification counter
      const bs = E.outBack(clamp(o.pop)) * 1;
      ctx.save(); ctx.translate(w / 2 - 20, -h / 2 + 10); ctx.scale(bs, bs);
      circle(0, 0, 44, C.red); text(String(o.badge), 0, 3, F(900, 48), '#fff'); ctx.restore();
    }
    ctx.restore();
  }
  function chip(i, x, y, rot, s) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.font = F(800, 38); const w = ctx.measureText(PB[i].key).width + 104;
    card(-w / 2, -38, w, 76, 38, PB[i].col, 0.2, 24);
    icon(i, -w / 2 + 40, 0, 40);
    text(PB[i].key, -w / 2 + 70, 2, F(800, 38), '#fff', 'left');
    ctx.restore();
  }
  function sHook(t) {
    const out = E.inCubic(P(t, 4.55, 4.95));
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(540, 960); ctx.scale(1 - out * 0.12, 1 - out * 0.12); ctx.translate(-540, -960);
    words('1 task.', 540, 470, t, 0.2, { size: 180, hl: { 0: C.blue } });
    // the one task
    const cp = E.outBack(P(t, 0.55, 1.05));
    const n = [0, 1, 2, 3, 4].filter(i => t >= 2.0 + i * 0.25).length;
    const sh = t > 2.0 ? Math.sin(t * 60) * 7 * Math.exp(-((t - 2) % 0.25) * 12) * (t < 3.3 ? 1 : 0.3) : 0;
    const heavy = P(t, 2.0, 3.2);
    if (cp > 0) taskCard(540 + sh, 880 + heavy * 10, cp, t, { badge: n, pop: n ? (t - (2.0 + (n - 1) * 0.25)) / 0.25 : 0, warn: heavy, sub: n ? `1 task · ${n} masalah` : '1 task · belum dimulai' });
    // five problems burst out of it, one per 8th note
    for (let i = 0; i < 5; i++) {
      const a = 2.0 + i * 0.25, p = E.outBack(P(t, a, a + 0.4));
      if (p <= 0) continue;
      const [x, y, r] = CHIP[i];
      const bob = Math.sin(t * 3 + i) * 6;
      chip(i, lerp(540, x, p), lerp(880, y, p) + bob, r * p, clamp(p * 1.2));
    }
    words('5 masalah. 😭', 540, 1420, t, 3.0, { size: 150, stagger: 0.12, hl: { 0: C.red }, pop: { 2: true } });
    ctx.restore();
  }

  // =====================================================================
  // 5–12  "satu tugas bisa bikin pusing karena…"
  // =====================================================================
  const SLOT = i => [540 + (i - 2) * 156, 1310];
  const SLOT_S = 128;
  function sPusing(t) {
    const out = 11.2;
    words('satu tugas', 540, 430, t, 5.1, { size: 116, out });
    words('bisa bikin pusing', 540, 560, t, 5.5, { size: 116, out, pill: { 2: C.amber } });
    words('karena…', 540, 690, t, 6.6, { size: 116, out, color: C.sub });
    // mental-load ring
    const rin = E.outBack(P(t, 6.0, 6.6)) * (1 - E.inCubic(P(t, 10.9, 11.4)));
    const cx = 540, cy = 1060;
    if (rin > 0) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rin, rin);
      const v = clamp(lerp(0.08, 0.91, E.inOutCubic(P(t, 6.5, 10.6))) + Math.sin(t * 11) * 0.015 * P(t, 8, 9));
      card(-190, -190, 380, 380, 190, C.white, 0.1, 50);
      ctx.beginPath(); ctx.arc(0, 0, 160, 0, TAU); ctx.strokeStyle = C.faint; ctx.lineWidth = 30; ctx.stroke();
      const col = v < 0.5 ? mixC(C.green, C.amber, v * 2) : mixC(C.amber, C.red, (v - 0.5) * 2);
      ctx.beginPath(); ctx.arc(0, 0, 160, -Math.PI / 2, -Math.PI / 2 + TAU * v); ctx.strokeStyle = col; ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.stroke();
      text('beban', 0, -52, M(28), C.sub);
      text(Math.round(v * 100) + '%', 0, 18, F(900, 104), C.ink);
      ctx.restore();
    }
    // five unknowns orbit the task, then drop into the tray
    for (let i = 0; i < 5; i++) {
      const a = 7.4 + i * 0.3, p = E.outBack(P(t, a, a + 0.4));
      if (p <= 0) continue;
      const ang = -Math.PI / 2 + i * TAU / 5 + (t - 7) * 0.7;
      const ox = cx + Math.cos(ang) * 290, oy = cy + Math.sin(ang) * 290;
      const f = E.inOutExpo(P(t, 10.9 + i * 0.08, 11.6 + i * 0.08));
      const [sx, sy] = SLOT(i);
      const x = lerp(ox, sx, f), y = lerp(oy, sy, f);
      if (f < 1) {
        const r = 40 * p * (1 - f * 0.3);
        circle(x, y, r, C.ink); text('?', x, y + 3, F(900, 50 * p), '#fff');
      }
    }
    if (t > 11.3) tray(t);
  }

  // tray of five slots + the load meter under it
  function tray(t, o = {}) {
    const a = (o.a ?? 1) * E.outCubic(P(t, 11.3, 11.8));
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    let filled = 0;
    for (let i = 0; i < 5; i++) {
      const [x, y] = SLOT(i);
      const land = 12 + i * 4 + 3.85;
      ctx.save(); ctx.setLineDash([10, 10]); rr(x - SLOT_S / 2, y - SLOT_S / 2, SLOT_S, SLOT_S, 34);
      ctx.strokeStyle = 'rgba(21,23,29,0.22)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
      text('0' + (i + 1), x, y + 2, M(30), 'rgba(21,23,29,0.3)');
      if (t >= land && !(o.hide && o.hide[i])) {
        filled++;
        const s = E.outBack(P(t, land, land + 0.3));
        tile(i, x, y, SLOT_S * s);
      }
    }
    // load meter
    const target = filled / 5;
    const lastLand = 12 + (filled - 1) * 4 + 3.85;
    const v = filled ? lerp((filled - 1) / 5, target, E.outCubic(P(t, lastLand, lastLand + 0.5))) : 0;
    text('beban', 190, 1440, M(28), C.sub, 'left');
    rr(320, 1428, 520, 24, 12); ctx.fillStyle = C.faint; ctx.fill();
    if (v > 0) { rr(320, 1428, 520 * v, 24, 12); ctx.fillStyle = v < 0.5 ? mixC(C.green, C.amber, v * 2) : mixC(C.amber, C.red, (v - 0.5) * 2); ctx.fill(); }
    text(Math.round(v * 100) + '%', 890, 1441, M(30), C.ink, 'right');
    ctx.restore();
  }

  // =====================================================================
  // WINDOWS — one mini app per problem, content is a function of local time lt
  // =====================================================================
  const WW = 800, WH = 540, CH = 60;
  const winTitle = (i, lt) => ['desain_poster.fig', 'data_mentah.xlsx', 'folder tugas', `draft_v${Math.min(7, 1 + Math.floor(Math.max(0, lt) / 0.55))}.docx`, 'pengingat'][i];
  function win(i, cx, cy, s, rot, lt, a = 1) {
    if (s <= 0 || a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-WW / 2, -WH / 2);
    card(0, 0, WW, WH, 30, C.white, 0.16, 60);
    ctx.save(); rr(0, 0, WW, WH, 30); ctx.clip();
    ctx.fillStyle = PB[i].col; ctx.fillRect(0, 0, WW, 8);
    [0, 1, 2].forEach(k => circle(36 + k * 28, CH / 2 + 4, 8, '#DADCE2'));
    text(winTitle(i, lt), WW / 2, CH / 2 + 5, M(24), C.sub);
    ctx.fillStyle = '#ECEDF1'; ctx.fillRect(0, CH, WW, 2);
    ctx.save(); ctx.translate(0, CH + 2); ctx.beginPath(); ctx.rect(0, 0, WW, WH - CH - 2); ctx.clip();
    CONTENT[i](lt, WW, WH - CH - 2);
    ctx.restore(); ctx.restore(); ctx.restore();
  }
  function redTag(s, x, y, a, col = C.red) {
    if (a <= 0) return;
    ctx.save(); ctx.font = F(800, 26); const w = ctx.measureText(s).width + 36;
    ctx.translate(x, y); ctx.scale(E.outBack(clamp(a)), E.outBack(clamp(a)));
    rr(-w / 2, -22, w, 44, 22); ctx.fillStyle = col; ctx.fill(); text(s, 0, 2, F(800, 26), '#fff'); ctx.restore();
  }

  // 01 desain berantakan
  const POSTER = [
    { k: 'rect', x: 28, y: 26, w: 344, h: 60, c: '#FF4F8B', off: [46, -14, 0.1] },
    { k: 'img', x: 28, y: 104, w: 206, h: 140, c: '#FFD166', off: [-34, 30, -0.16] },
    { k: 'circ', x: 300, y: 175, r: 50, c: '#06D6A0', off: [-80, 46, 0.3] },
    { k: 'lines', x: 28, y: 280, w: 344, off: [30, -12, 0.06] },
    { k: 'btn', x: 28, y: 372, w: 150, h: 40, c: '#3A86FF', off: [90, 18, -0.2] },
  ];
  const SWATCH = ['#FF4F8B', '#00E5FF', '#FFE600', '#7CFF00', '#FF6A00', '#9D00FF', '#00B37E', '#FF00C8', '#8B4513'];
  function drawDesain(lt, w, h) {
    ctx.fillStyle = '#F4F5F7'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(34, 30); card(0, 0, 400, 420, 14, '#fff', 0.08, 16);
    const m = E.outBack(P(lt, 0.25, 1.3));
    POSTER.forEach((e, i) => {
      const wob = Math.sin(lt * 4 + i * 2) * 6 * m;
      ctx.save(); ctx.translate(e.x + e.off[0] * m + wob, e.y + e.off[1] * m - wob * 0.5); ctx.rotate(e.off[2] * m);
      if (e.k === 'rect') { rr(0, 0, e.w, e.h, 8); ctx.fillStyle = e.c; ctx.fill(); text('judul', 22, e.h / 2 + 2, F(900, 34), '#fff', 'left'); }
      if (e.k === 'img') {
        rr(0, 0, e.w, e.h, 8); ctx.fillStyle = e.c; ctx.fill(); circle(e.w - 40, 34, 16, '#fff');
        ctx.beginPath(); ctx.moveTo(10, e.h - 8); ctx.lineTo(80, 50); ctx.lineTo(150, e.h - 8); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      }
      if (e.k === 'circ') circle(0, 0, e.r, e.c);
      if (e.k === 'lines') [1, 0.86, 0.7].forEach((f, k) => { rr(k * 14 * m, k * 26, e.w * f, 13, 6); ctx.fillStyle = '#C9CCD3'; ctx.fill(); });
      if (e.k === 'btn') { rr(0, 0, e.w, e.h, 20); ctx.fillStyle = e.c; ctx.fill(); text('klik', e.w / 2, e.h / 2 + 2, F(800, 22), '#fff'); }
      ctx.restore();
    });
    // alignment guides that nothing lines up with
    const g = P(lt, 1.2, 1.4) * (0.55 + 0.45 * beat(lt));
    if (g > 0) {
      ctx.save(); ctx.setLineDash([10, 8]); ctx.globalAlpha *= g;
      line(28, -10, 28, 430, C.red, 3); line(-10, 104, 410, 104, C.red, 3); ctx.restore();
    }
    ctx.restore();
    redTag('tidak rata', 330, 40, P(lt, 1.4, 1.7));
    // clashing palette + too many fonts
    text('warna', 470, 48, M(22), C.sub, 'left');
    SWATCH.forEach((c, k) => {
      const s = E.outBack(P(lt, 0.4 + k * 0.08, 0.7 + k * 0.08));
      const x = 470 + (k % 3) * 94 + 38, y = 76 + Math.floor(k / 3) * 76 + 30;
      if (s > 0) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); rr(-34, -30, 68, 60, 14); ctx.fillStyle = c; ctx.fill(); ctx.restore(); }
    });
    text('font', 470, 336, M(22), C.sub, 'left');
    ['700 46px serif', '500 44px monospace', 'italic 400 46px serif', `900 46px ${FONT}`].forEach((fnt, k) => {
      const s = E.outBack(P(lt, 1.0 + k * 0.15, 1.3 + k * 0.15));
      if (s > 0) { ctx.save(); ctx.translate(494 + k * 74, 398); ctx.scale(s, s); ctx.rotate((k % 2 ? 1 : -1) * 0.1); text('Aa', 0, 0, fnt, [C.ink, '#FF4F8B', '#3A86FF', '#FF9F1C'][k]); ctx.restore(); }
    });
  }

  // 02 data belum diolah
  const SHEET = [
    ['nama', 'nilai', 'tanggal', 'kota', 'ket'],
    ['andi', '8O', '12/3', 'bdg', '??'],
    ['Budi ', '85,5', '3-12-24', 'Bandung', ''],
    ['citra', '#N/A', '', 'BDG', 'ok?'],
    ['dina', '9.0', '12 mar', 'jkt', 'dobel'],
    ['andi', '8O', '12/3', 'bdg', '??'],
    ['eko', '', '2024/3', 'Jakarta', '#REF!'],
    ['fajar', '100+', '?', 'sby', 'cek'],
  ];
  const BAD = new Set(['8O', '#N/A', '', '??', '?', '#REF!', '100+', 'dobel', 'ok?']);
  function drawData(lt, w, h) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    const x0 = 25, y0 = 18, cw = 150, rh = 50;
    const flash = P(lt, 2.0, 2.2) * (0.5 + 0.5 * beat(lt));
    SHEET.forEach((row, r) => {
      if (r === 0) { ctx.fillStyle = '#F2F3F6'; ctx.fillRect(x0, y0, cw * 5, rh); }
      if (r === 5 && flash > 0) { ctx.fillStyle = rgba(C.amber, 0.25 * flash); ctx.fillRect(x0, y0 + r * rh, cw * 5, rh); }
      row.forEach((v, c) => {
        const k = (r - 1) * 5 + c, at = 0.15 + k * 0.045;
        const x = x0 + c * cw, y = y0 + r * rh;
        if (r > 0 && BAD.has(v) && flash > 0) { ctx.fillStyle = rgba(C.red, 0.2 * flash); ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4); }
        if (r === 0) text(v, x + 14, y + rh / 2 + 2, F(800, 24), C.ink, 'left');
        else if (lt > at) {
          const n = Math.min(v.length, Math.floor((lt - at) / 0.03) + 1);
          text(v.slice(0, n), x + 14, y + rh / 2 + 2, M(24), r > 0 && BAD.has(v) && flash > 0 ? C.red : C.ink, 'left');
        }
      });
    });
    ctx.strokeStyle = '#E3E5EA'; ctx.lineWidth = 2;
    for (let r = 0; r <= SHEET.length; r++) line(x0, y0 + r * rh, x0 + cw * 5, y0 + r * rh, '#E3E5EA', 2);
    for (let c = 0; c <= 5; c++) line(x0 + c * cw, y0, x0 + c * cw, y0 + SHEET.length * rh, '#E3E5EA', 2);
    // typing cursor
    const k = clamp(Math.floor((lt - 0.15) / 0.045), 0, 34), r = 1 + Math.floor(k / 5), c = k % 5;
    if (lt < 2.0) { ctx.strokeStyle = C.amber; ctx.lineWidth = 4; ctx.strokeRect(x0 + c * cw, y0 + r * rh, cw, rh); }
    // endless rows
    const n = Math.floor(lerp(0, 1248, E.inCubic(P(lt, 0.4, 3.0))) + Math.max(0, lt - 3) * 97);
    ctx.save(); ctx.font = M(24); const label = `${n.toLocaleString('id-ID')} baris belum diolah`, lw = ctx.measureText(label).width + 40;
    rr(w / 2 - lw / 2, 438, lw, 46, 23); ctx.fillStyle = rgba(C.amber, 0.18); ctx.fill(); text(label, w / 2, 462, M(24), '#B86B00'); ctx.restore();
  }

  // 03 file belum rapi
  const FILES = [
    ['dok1.docx', 'DOC', '#2B6CF6'], ['baru (2).pdf', 'PDF', '#F04438'], ['Untitled-3.png', 'PNG', '#12B5A6'], ['copy of data.xlsx', 'XLS', '#17A34A'],
    ['scan_0021.jpg', 'JPG', '#F79009'], ['tugas.zip', 'ZIP', '#6B7280'], ['gbr.png', 'PNG', '#12B5A6'], ['catatan.txt', 'TXT', '#6B7280'],
    ['new doc.docx', 'DOC', '#2B6CF6'], ['ss_0912.png', 'PNG', '#12B5A6'], ['data (1).xlsx', 'XLS', '#17A34A'], ['bahan.pdf', 'PDF', '#F04438'],
    ['draft.docx', 'DOC', '#2B6CF6'], ['aaa.png', 'PNG', '#12B5A6'],
  ];
  function fileIcon(x, y, rot, f, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.moveTo(-40, -52); ctx.lineTo(18, -52); ctx.lineTo(40, -30); ctx.lineTo(40, 52); ctx.lineTo(-40, 52); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(18, -52); ctx.lineTo(18, -30); ctx.lineTo(40, -30); ctx.closePath(); ctx.fillStyle = '#E3E5EA'; ctx.fill();
    ctx.fillStyle = f[2]; ctx.fillRect(-40, 8, 80, 28); text(f[1], 0, 23, M(18), '#fff');
    text(f[0], 0, 74, M(17), C.ink);
    ctx.restore();
  }
  function drawFile(lt, w, h) {
    ctx.fillStyle = '#F4F5F7'; ctx.fillRect(0, 0, w, h);
    let n = 0;
    FILES.forEach((f, j) => {
      const a = 0.1 + j * 0.16, p = P(lt, a, a + 0.5);
      if (p <= 0) return; n++;
      const tx = 80 + rnd(j * 3.1 + 1) * 640, ty = 120 + rnd(j * 7.7 + 2) * 250, r = (rnd(j * 5.3) - 0.5) * 0.9;
      const e = E.outBack(p);
      fileIcon(tx, lerp(-140, ty, e), r * e + (1 - p) * 0.8, f);
    });
    ctx.save(); ctx.font = M(22); const label = `${n} file · 0 folder`, lw = ctx.measureText(label).width + 36;
    rr(w - lw - 20, 16, lw, 42, 21); ctx.fillStyle = rgba('#12B5A6', 0.16); ctx.fill(); text(label, w - lw / 2 - 20, 38, M(22), '#0B7F74'); ctx.restore();
    redTag('yang mana, ya?', 150, 38, P(lt, 1.9, 2.2), '#12B5A6');
  }

  // 04 revisi belum selesai
  const NOTES = ['ganti font', 'cek lagi ya', 'grafiknya?', 'revisi lagi 🙏'];
  function drawRevisi(lt, w, h) {
    ctx.fillStyle = '#F4F5F7'; ctx.fillRect(0, 0, w, h);
    card(34, 22, 420, 434, 12, '#fff', 0.08, 16);
    rr(64, 52, 220, 22, 8); ctx.fillStyle = C.ink; ctx.fill();
    const LW = [340, 320, 350, 280, 330, 350, 300, 260, 320];
    LW.forEach((lw, k) => { rr(64, 104 + k * 36, lw, 12, 6); ctx.fillStyle = '#D5D8DE'; ctx.fill(); });
    [[1, 0.45], [4, 0.85], [6, 1.25], [2, 1.65]].forEach(([k, a]) => {
      const p = E.outCubic(P(lt, a, a + 0.3)); if (p > 0) line(58, 110 + k * 36, 58 + (LW[k] + 12) * p, 110 + k * 36, C.red, 5);
    });
    const sc = P(lt, 1.9, 2.3);
    if (sc > 0) { ctx.save(); ctx.beginPath(); ctx.ellipse(210, 110 + 8 * 36, 170, 30, -0.04, 0, TAU * sc); ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
    NOTES.forEach((s, j) => {
      const p = E.outBack(P(lt, 0.35 + j * 0.45, 0.7 + j * 0.45)); if (p <= 0) return;
      ctx.save(); ctx.translate(620, 60 + j * 92); ctx.scale(p, p);
      card(-150, -36, 300, 72, 20, '#fff', 0.1, 14); circle(-116, 0, 18, ['#8B5CF6', '#FF4F8B', '#FF9F1C', '#12B5A6'][j]);
      text(s, -86, 2, F(700, 27), C.ink, 'left'); ctx.restore();
    });
    // progress that never reaches the end
    const pv = 0.62 + 0.26 * Math.abs(Math.sin(lt * 1.6)) - 0.2 * P(lt, 2.5, 2.7);
    text('progress', 480, 420, M(20), C.sub, 'left');
    rr(480, 436, 290, 16, 8); ctx.fillStyle = '#E3E5EA'; ctx.fill();
    rr(480, 436, 290 * pv, 16, 8); ctx.fillStyle = '#8B5CF6'; ctx.fill();
    redTag('belum selesai', 690, 400, P(lt, 1.2, 1.5) * (0.9 + 0.1 * beat(lt)), '#8B5CF6');
  }

  // 05 deadline semakin dekat
  const DAYS = ['sen', 'sel', 'rab', 'kam', 'jum'];
  function drawDeadline(lt, w, h) {
    const b = beat(lt) * P(lt, 1.0, 1.5);
    ctx.fillStyle = mixC('#FFFFFF', '#FFE3E1', b * 0.8); ctx.fillRect(0, 0, w, h);
    const frac = 1 - 0.96 * E.inCubic(P(lt, 0.1, 3.3));
    const secs = Math.max(0, frac * 72 * 3600 - Math.max(0, lt - 3.3) * 1800);
    const cx = 400, cy = 210;
    ctx.beginPath(); ctx.arc(cx, cy, 160, 0, TAU); ctx.strokeStyle = '#F0F1F4'; ctx.lineWidth = 22; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 160, -Math.PI / 2, -Math.PI / 2 + TAU * (secs / (72 * 3600))); ctx.strokeStyle = C.red; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.stroke();
    const hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60, ss = Math.floor(secs) % 60;
    const pad = v => String(v).padStart(2, '0');
    text('sisa waktu', cx, cy - 58, M(24), C.sub);
    ctx.save(); ctx.translate(cx, cy + 16); const sc = 1 + b * 0.06; ctx.scale(sc, sc);
    text(`${pad(hh)}:${pad(mm)}:${pad(ss)}`, 0, 0, M(64), secs < 12 * 3600 ? C.red : C.ink); ctx.restore();
    const day = Math.min(4, Math.floor((1 - frac) * 4.6));
    DAYS.forEach((d, k) => {
      const x = 400 + (k - 2) * 142, y = 436;
      rr(x - 62, y - 30, 124, 60, 18);
      ctx.fillStyle = k === day ? C.red : '#F2F3F6'; ctx.fill();
      if (k === 4) { ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.stroke(); }
      text(d, x, y + 2, F(800, 28), k === day ? '#fff' : C.ink);
    });
    redTag('deadline', 400 + 2 * 142, 380, 1);
  }
  const CONTENT = [drawDesain, drawData, drawFile, drawRevisi, drawDeadline];

  // =====================================================================
  // 12–32  the five problems, one per 2 bars
  // =====================================================================
  function sProblems(t) {
    const i = Math.min(4, Math.floor((t - 12) / 4)), s = 12 + i * 4, lt = t - s;
    monoLabel(`masalah 0${i + 1} / 05`, 540, 290, t, s + 0.05, PB[i].col, s + 3.4);
    words(PB[i].a, 540, 440, t, s + 0.1, { size: 124, out: s + 3.35 });
    words(PB[i].b, 540, 568, t, s + 0.25, { size: 124, out: s + 3.35, color: PB[i].col });
    // window slides in, plays, then shrinks into its tray slot
    const inp = E.outExpo(P(lt, 0.0, 0.6));
    const fly = E.inOutCubic(P(lt, 3.25, 3.85));
    const [sx, sy] = SLOT(i);
    const x = lerp(lerp(1400, 540, inp), sx, fly), y = lerp(910, sy, fly);
    const sc = lerp(lerp(0.9, 1, inp), SLOT_S / WW, fly);
    const rot = lerp((1 - inp) * 0.12, 0, fly) + Math.sin(lt * 2) * 0.006;
    if (lt < 3.85) win(i, x, y, sc, rot, lt, 1 - P(lt, 3.6, 3.85));
    tray(t);
  }

  // =====================================================================
  // 32–40  CHAOS — everything at once
  // =====================================================================
  const SPOT = [[285, 790, -0.1], [800, 720, 0.09], [545, 1030, -0.04], [300, 1290, 0.12], [790, 1300, -0.08]];
  const TOASTS = [
    ['revisi lagi ya 🙏', 3], ['deadline besok!', 4], ['file-nya yang mana?', 2], ['datanya belum masuk', 1], ['layout-nya geser', 0],
    ['cek ulang dong', 3], ['sisa 2 jam lagi', 4], ['ada revisi baru', 3], ['format tabel kacau', 1], ['warnanya tabrakan', 0],
    ['file dobel lagi', 2], ['udah dikirim belum?', 4],
  ];
  function toast(k, x, y, s, a) {
    if (s <= 0 || a <= 0) return;
    const [msg, i] = TOASTS[k % TOASTS.length];
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s, s);
    ctx.font = F(800, 30); const w = Math.max(360, ctx.measureText(msg).width + 130);
    card(-w / 2, -48, w, 96, 26, '#fff', 0.35, 30);
    tile(i, -w / 2 + 50, 0, 60);
    text(msg, -w / 2 + 96, -10, F(800, 30), C.ink, 'left');
    text('baru saja', -w / 2 + 96, 26, M(18), C.sub, 'left');
    ctx.restore();
  }
  // tangled scribble — the "knot" the chaos collapses into
  function knot(cx, cy, R, p, col, lw) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath();
    const n = 70, pts = [];
    for (let k = 0; k < n; k++) { const a = k * 2.39 + rnd(k) * 0.8, r = R * (0.25 + 0.75 * rnd(k + 50)); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < n - 1; k++) { const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2; ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my); }
    const L = 9000; ctx.setLineDash([L * p, L]);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function sChaos(t) {
    const I = E.inCubic(P(t, 32.2, 38.8));                    // intensity ramps up
    const imp = E.inCubic(P(t, 39.0, 39.85));                 // implosion into the knot
    const b = beat(t);
    const shake = (6 + 18 * I) * (0.3 + b) * (1 - imp);
    ctx.save();
    ctx.translate((rnd(Math.floor(t * 30)) - 0.5) * shake, (rnd(Math.floor(t * 30) + 9) - 0.5) * shake);
    tray(t, { a: 1 - P(t, 32.1, 32.6), hide: [0, 1, 2, 3, 4].map(i => t > 32.05 + i * 0.1) });
    words('semua masalah', 540, 330, t, 32.2, { size: 104, color: '#fff', out: 35.6, glitch: 0.4 + I });
    words('muncul bersamaan.', 540, 450, t, 32.45, { size: 104, color: '#fff', out: 35.6, glitch: 0.4 + I, hl: { 1: '#FF5A6E' } });
    // implosion transform
    ctx.translate(540, 960); ctx.rotate(imp * 1.4); ctx.scale(1 - imp * 0.92, 1 - imp * 0.92); ctx.translate(-540, -960);
    ctx.globalAlpha = 1 - P(t, 39.5, 39.9);
    for (let i = 0; i < 5; i++) {
      const a = 32.05 + i * 0.1, p = E.outBack(P(t, a, a + 0.55));
      if (p <= 0) continue;
      const [sx, sy] = SLOT(i), [x, y, r] = SPOT[i];
      const dx = Math.sin(t * (1.1 + i * 0.2) + i) * 40 * I, dy = Math.cos(t * (0.9 + i * 0.15) + i * 2) * 30 * I;
      const jr = Math.sin(t * (2 + i * 0.3)) * 0.07 * I + (rnd(Math.floor(t * 8) + i) - 0.5) * 0.06 * I;
      const sc = lerp(SLOT_S / WW, 0.5 + 0.06 * I, p);
      win(i, lerp(sx, x + dx, p), lerp(sy, y + dy, p), sc, r * p + jr, 1.4 + (t - 32) * 1.6);
    }
    // notifications pile up, faster and longer as it builds
    for (let k = 0; k < 40; k++) {
      const tk = 33.0 + k * (0.25 - k * 0.003);
      if (t < tk || tk > 39.2) continue;
      const life = 1.3 + (tk - 33) * 0.4;
      const p = E.outBack(P(t, tk, tk + 0.25)), f = 1 - P(t, tk + life, tk + life + 0.2);
      toast(k, 230 + rnd(k * 1.7) * 620, 620 + rnd(k * 2.3 + 4) * 860, 0.78 + rnd(k) * 0.2, p * f);
    }
    ctx.restore();
    // overload word
    words('overload 🤯', 540, 1600, t, 36.0, { size: 150, color: '#fff', out: 39.1, glitch: 1.2, pop: { 1: true } });
    // the knot
    knot(540, 960, 170 * (0.6 + 0.4 * imp), E.inOutCubic(P(t, 38.9, 39.95)), '#fff', 7);
  }

  // =====================================================================
  // 40–52  STRUCTURE — split it, do it one by one
  // =====================================================================
  const ROW_Y = i => 690 + i * 146;
  const CHECK = i => 44 + i * 1.5;
  function sSolve(t) {
    // knot still there for a moment, then splits into five tiles
    const kf = 1 - E.inCubic(P(t, 40.8, 41.15));
    if (kf > 0) { ctx.save(); ctx.globalAlpha = kf; knot(540, 960, 170, 1, C.ink, 7); ctx.restore(); }
    words('pecah masalahnya.', 540, 380, t, 40.35, { size: 112, pill: { 0: C.blue }, hl: { 0: '#fff' }, out: 51.4 });
    words('kerjakan satu per satu.', 540, 510, t, 42.6, { size: 80, w: 700, hl: { 1: C.blue, 2: C.blue, 3: C.blue }, out: 51.4 });
    const done = [0, 1, 2, 3, 4].filter(i => t >= CHECK(i)).length;
    const outp = E.inCubic(P(t, 51.35, 51.9));
    for (let i = 0; i < 5; i++) {
      const a = 40.95 + i * 0.09, p = E.outBack(P(t, a, a + 0.6)), cp = E.outExpo(P(t, a + 0.3, a + 0.9));
      if (p <= 0) continue;
      const y = ROW_Y(i) - outp * 60, x0 = 130, w = 820, h = 120;
      const tc = CHECK(i), focus = P(t, tc - 0.6, tc - 0.4) * (1 - P(t, tc + 0.35, tc + 0.6));
      const isDone = t >= tc;
      ctx.save(); ctx.globalAlpha = 1 - P(t, 51.4 + i * 0.04, 51.8 + i * 0.04);
      if (cp > 0) {
        ctx.save(); ctx.translate(540, y); const fs = 1 + focus * 0.035; ctx.scale(fs, fs); ctx.translate(-540, -y);
        ctx.globalAlpha *= cp;
        card(x0, y - h / 2, w, h, 30, C.white, 0.08 + focus * 0.1, 30);
        if (focus > 0) { rr(x0, y - h / 2, w, h, 30); ctx.strokeStyle = rgba('#004FC6', focus); ctx.lineWidth = 5; ctx.stroke(); }
        ctx.font = F(800, 56); const lw = ctx.measureText(PB[i].key).width;
        text(PB[i].key, x0 + 150, y + 3, F(800, 56), isDone ? C.sub : C.ink, 'left');
        const tp = P(t, tc, tc + 0.35);
        if (tp > 0) { ctx.save(); ctx.translate(x0 + 150 + lw + 44, y); const s = E.outBack(tp); ctx.scale(s, s); tick(0, 0, 50, C.green, 9, tp * 1.4); ctx.restore(); }
        // checkbox
        const bx = x0 + w - 90, bp = E.outBack(P(t, tc, tc + 0.3));
        rr(bx - 32, y - 32, 64, 64, 18); ctx.strokeStyle = isDone ? C.green : 'rgba(21,23,29,0.25)'; ctx.lineWidth = 5; ctx.stroke();
        if (bp > 0) { ctx.save(); ctx.translate(bx, y); ctx.scale(bp, bp); rr(-32, -32, 64, 64, 18); ctx.fillStyle = C.green; ctx.fill(); tick(0, 2, 40, '#fff', 8, P(t, tc + 0.05, tc + 0.3)); ctx.restore(); }
        ctx.restore();
      }
      // the tile flies from the knot into the row
      const tx = lerp(540, x0 + 78, p), ty = lerp(960, y, p);
      tile(i, tx, ty, lerp(40, 84, clamp(p)));
      ctx.restore();
    }
    // progress
    const pa = E.outCubic(P(t, 42.9, 43.4)) * (1 - P(t, 51.4, 51.8));
    if (pa > 0) {
      ctx.save(); ctx.globalAlpha = pa;
      const v = done ? lerp((done - 1) / 5, done / 5, E.outCubic(P(t, CHECK(done - 1), CHECK(done - 1) + 0.4))) : 0;
      const y = 1450;
      text('progress', 130, y - 44, M(28), C.sub, 'left');
      text(Math.round(v * 100) + '%', 950, y - 44, M(28), C.ink, 'right');
      rr(130, y - 14, 820, 28, 14); ctx.fillStyle = C.faint; ctx.fill();
      if (v > 0) { rr(130, y - 14, 820 * v, 28, 14); ctx.fillStyle = v >= 1 ? C.green : C.blue; ctx.fill(); }
      const bd = E.outBack(P(t, 50.35, 50.75));
      if (bd > 0) { ctx.save(); ctx.translate(540, y + 84); ctx.scale(bd, bd); rr(-230, -40, 460, 80, 40); ctx.fillStyle = rgba('#14B06A', 0.14); ctx.fill(); tick(-150, 0, 40, C.green, 8, 1); text('1 task beres', 30, 3, F(800, 38), '#0B7A48'); ctx.restore(); }
      ctx.restore();
    }
    const fl = 1 - P(t, 40.0, 40.4);
    if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H); }
  }

  // =====================================================================
  // 52–60  TAKEAWAY + CTA
  // =====================================================================
  function sOutro(t) {
    if (t < 56) {
      const out = 55.55;
      words('task besar', 540, 470, t, 52.05, { size: 112, out });
      words('terasa lebih ringan', 540, 600, t, 52.4, { size: 112, out, pill: { 1: C.blue, 2: C.blue }, hl: { 1: '#fff', 2: '#fff' } });
      words('kalau masalahnya', 540, 730, t, 52.95, { size: 112, out });
      words('dipecah.', 540, 860, t, 53.25, { size: 112, out, color: C.blue });
      // one heavy block → five light pieces that float
      const a = 1 - P(t, 55.5, 55.9);
      const sp = E.outBack(P(t, 53.5, 54.2));
      ctx.save(); ctx.globalAlpha = a;
      line(200, 1400, 880, 1400, 'rgba(21,23,29,0.2)', 4);
      const bin = E.outBack(P(t, 52.2, 52.6)) * (1 - P(t, 53.5, 53.65));
      if (bin > 0) {
        const sq = 1 + Math.sin((t - 52.2) * 18) * 0.04 * Math.exp(-(t - 52.2) * 3);
        ctx.save(); ctx.translate(540, 1400); ctx.scale(bin / sq, bin * sq);
        card(-170, -300, 340, 300, 44, C.ink, 0.25, 40); text('task', 0, -175, F(900, 70), '#fff'); text('berat', 0, -105, M(28), 'rgba(255,255,255,0.6)');
        ctx.restore();
      }
      for (let i = 0; i < 5; i++) {
        if (sp <= 0) break;
        const x = lerp(540, 540 + (i - 2) * 150, sp), y = lerp(1250, 1150 + Math.sin(t * 2.4 + i * 1.3) * 22, sp);
        tile(i, x, y, 112 * clamp(sp));
      }
      ctx.restore();
    } else if (t < 58.3) {
      const out = 58.0;
      words('jangan kerjakan', 540, 640, t, 56.0, { size: 116, out });
      words('semuanya', 540, 770, t, 56.3, { size: 116, out });
      words('sekaligus.', 540, 900, t, 56.5, { size: 116, out, color: C.red });
      // one at a time: a cursor walks across the five tiles
      const a = E.outCubic(P(t, 56.4, 56.8)) * (1 - P(t, 57.9, 58.2));
      ctx.save(); ctx.globalAlpha = a;
      const cur = clamp((t - 56.8) / 0.25, 0, 4.99);
      for (let i = 0; i < 5; i++) {
        const x = 540 + (i - 2) * 156, y = 1160, on = i <= Math.floor(cur);
        if (on) tile(i, x, y, 112 * (Math.floor(cur) === i ? 1.08 : 1));
        else { rr(x - 56, y - 56, 112, 112, 30); ctx.fillStyle = C.faint; ctx.fill(); }
      }
      const ax = 540 + (Math.floor(cur) - 2) * 156;
      ctx.beginPath(); ctx.moveTo(ax - 18, 1260); ctx.lineTo(ax + 18, 1260); ctx.lineTo(ax, 1236); ctx.closePath(); ctx.fillStyle = C.blue; ctx.fill();
      text('satu per satu', 540, 1320, M(30), C.sub);
      ctx.restore();
    } else {
      words('follow', 540, 760, t, 58.35, { size: 120 });
      words('@taskkora__', 540, 900, t, 58.5, { size: 120, pill: { 0: C.blue }, hl: { 0: '#fff' } });
      words('untuk konten edukasi lainnya.', 540, 1010, t, 58.7, { size: 54, w: 500, color: C.sub, stagger: 0.04 });
      // follow button with a tap
      const bp = E.outBack(P(t, 58.8, 59.15));
      if (bp > 0) {
        const tap = P(t, 59.3, 59.4), press = 1 - Math.sin(P(t, 59.3, 59.5) * Math.PI) * 0.08;
        ctx.save(); ctx.translate(540, 1180); ctx.scale(bp * press, bp * press);
        const followed = t >= 59.4;
        rr(-190, -52, 380, 104, 52); ctx.fillStyle = followed ? C.white : C.blue; ctx.fill();
        if (followed) { ctx.strokeStyle = C.blue; ctx.lineWidth = 5; ctx.stroke(); tick(-118, 0, 40, C.blue, 8, P(t, 59.4, 59.6)); text('following', 22, 3, F(800, 44), C.blue); }
        else text('+ follow', 0, 3, F(800, 46), '#fff');
        ctx.restore();
        // finger/cursor dot
        const cp = P(t, 58.95, 59.3);
        if (cp > 0 && t < 59.9) { ctx.save(); ctx.globalAlpha = 1 - P(t, 59.6, 59.9); circle(lerp(760, 600, E.inOutCubic(cp)), lerp(1380, 1210, E.inOutCubic(cp)), 34 - tap * 6, 'rgba(21,23,29,0.25)'); ctx.restore(); }
      }
    }
  }

  // ---------- watermark (logo used exactly as supplied, small, top-right) ----------
  function watermark(t) {
    const a = P(t, 0.3, 0.9) * 0.9;
    if (a <= 0) return;
    const s = 72, x = W - 60 - s, y = 140;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    rr(x, y, s, s, 16); ctx.fillStyle = '#004FC6'; ctx.fill(); ctx.shadowColor = 'transparent';
    rr(x, y, s, s, 16); ctx.clip(); ctx.drawImage(logo, x, y, s, s);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    background(t);
    if (t < 5) sHook(t);
    else if (t < 12) sPusing(t);
    else if (t < 32) sProblems(t);
    else if (t < 40) sChaos(t);
    else if (t < 52) sSolve(t);
    else sOutro(t);
    watermark(t);
    const f = 1 - P(t, 0, 0.15);
    if (f > 0) { ctx.fillStyle = `rgba(243,241,236,${f})`; ctx.fillRect(0, 0, W, H); }
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
