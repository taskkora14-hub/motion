/* "5 Kesalahan yang Sering Terjadi Saat Membuat Presentasi" — 40s, 1080x1920.
 * One slide is broken, then repaired mistake by mistake. Every frame is a pure function of time. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    stage: '#17171B', stage2: '#0E0E11', text: '#F5F3EE', dim: 'rgba(245,243,238,0.6)',
    yellow: '#FFE14D', red: '#FF4B4B', green: '#39D98A',
    ink: '#16181D', gray: '#6B7280', accent: '#FF6A2B', paper: '#FFFFFF', lightLine: '#ECEEF2',
  };
  const HEAD = '"BG", sans-serif', BODY = '"IN", sans-serif';

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
    outBack: x => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    inBack: x => { const c1 = 1.7; return (c1 + 1) * x * x * x - c1 * x * x; },
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixC = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    document.fonts.load(`800 40px ${HEAD}`), document.fonts.load(`500 40px ${HEAD}`),
    document.fonts.load(`400 40px ${BODY}`), document.fonts.load(`600 40px ${BODY}`), document.fonts.load(`800 40px ${BODY}`),
  ]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  const head = (w, s) => `${w} ${s}px ${HEAD}`, body = (w, s) => `${w} ${s}px ${BODY}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function tick(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function cross(x, y, s, c, w) { line(x - s / 2, y - s / 2, x + s / 2, y + s / 2, c, w); line(x + s / 2, y - s / 2, x - s / 2, y + s / 2, c, w); }

  // Kinetic line: words drop in on the beat with a short overshoot.
  function kLine(text, x, y, t, t0, o = {}) {
    const size = o.size || 100, stagger = o.stagger ?? 0.08, dur = o.dur || 0.5;
    ctx.save();
    ctx.font = head(o.weight || 800, size); ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.03)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' '), sp = ctx.measureText(' ').width;
    const ws = words.map(w => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    const fit = total > (o.maxW || 960) ? (o.maxW || 960) / total : 1;
    let cx = o.align === 'left' ? x : x - total * fit / 2;
    const pos = [];
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, p = P(t, a, a + dur);
      const pout = o.out != null ? E.inCubic(P(t, o.out + i * stagger * 0.4, o.out + i * stagger * 0.4 + 0.3)) : 0;
      const w = ws[i] * fit;
      pos.push([cx, w]);
      if (p > 0 && pout < 1) {
        const e = E.outBack(p);
        ctx.save(); ctx.translate(cx, y + (1 - e) * -size * 0.6 + pout * size * 0.5); ctx.scale(fit, fit);
        ctx.globalAlpha *= clamp(p * 3) * (1 - pout);
        if (o.marker && o.marker[i]) { // highlighter behind a word
          const mp = E.inOutCubic(P(t, a, a + 0.3));
          rr(-10, -size * 0.62, (ws[i] + 20) * mp, size * 0.7, 10); ctx.fillStyle = o.marker[i]; ctx.fill();
        }
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.text;
        ctx.fillText(words[i], 0, 0);
        ctx.restore();
      }
      cx += (ws[i] + sp) * fit;
    }
    ctx.restore();
    return { total: total * fit, pos };
  }
  function tag(text, x, y, t, t0, o = {}) {
    const p = E.outBack(P(t, t0, t0 + 0.3)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.2)) : 0;
    if (p <= 0 || out >= 1) return;
    ctx.save(); ctx.font = body(800, o.size || 28); ctx.letterSpacing = '3px';
    const tw = ctx.measureText(text).width, h = (o.size || 28) * 2, w = tw + 56;
    ctx.translate(x, y); ctx.scale(p * (1 - out), p * (1 - out));
    rr(-w / 2, -h / 2, w, h, 12); ctx.fillStyle = o.bg || C.red; ctx.fill();
    ctx.fillStyle = o.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 2, 2); ctx.restore();
  }

  // ---------- stage ----------
  function background(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.stage); g.addColorStop(1, C.stage2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // projector light cone behind the slide
    const cg = ctx.createRadialGradient(540, 1010, 100, 540, 1010, 900);
    cg.addColorStop(0, 'rgba(255,225,77,0.07)'); cg.addColorStop(1, 'rgba(255,225,77,0)');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
    // beat-synced floor grid lines (120 BPM)
    const beat = (t * 2) % 1, pulse = Math.exp(-beat * 6) * (t > 4 && t < 34 ? 1 : 0.3);
    ctx.save(); ctx.strokeStyle = `rgba(245,243,238,${0.04 + pulse * 0.03})`; ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 40, 1400); ctx.lineTo(540 + i * 260, H); ctx.stroke(); }
    for (let k = 0; k < 7; k++) { const y = 1400 + Math.pow(k / 6, 1.8) * 520 + ((t * 30) % 20); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }
  function finish(t) {
    const wa = P(t, 0.5, 1.2) * 0.9;
    if (wa > 0) { // logo used as-is, small, top-right
      const s = 76, x = W - 62 - s, y = 150;
      ctx.save(); ctx.globalAlpha = wa;
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      rr(x, y, s, s, 18); ctx.fillStyle = '#004FC6'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.clip(); ctx.drawImage(logo, x, y, s, s); ctx.restore();
    }
    const f = 1 - P(t, 0, 0.2) + P(t, 39.6, 40);
    if (f > 0) { ctx.fillStyle = `rgba(14,14,17,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }

  // =====================================================================
  // THE SLIDE (drawn in slide units 1600x900)
  // =====================================================================
  const SW = 1600, SH = 900;
  const LONG = [
    'Pada kuartal keempat tahun ini kami berencana untuk meningkatkan jumlah pengguna baru',
    'sebanyak kurang lebih dua puluh lima persen dengan berbagai strategi yang sudah kami',
    'diskusikan bersama tim marketing, tim produk, dan juga tim desain dalam rapat minggu lalu',
    'dimana fokus utama kampanye adalah media sosial terutama Instagram dan juga TikTok',
    'karena berdasarkan data yang kami kumpulkan sebagian besar audiens kami aktif di sana',
    'adapun untuk anggaran yang dibutuhkan diperkirakan sekitar lima puluh juta rupiah',
    'yang akan dialokasikan untuk konten, iklan berbayar, kolaborasi, serta evaluasi berkala',
    'setiap dua minggu sekali agar hasilnya dapat dipantau dan disesuaikan bila diperlukan.',
  ];
  const SHORT = [['Target', '+25% pengguna baru'], ['Fokus', 'Instagram & TikTok'], ['Budget', 'Rp50 juta']];
  const LOUD = ['#E6007E', '#0057FF', '#00A651', '#8E2DE2', '#FF6F00', '#00B5CC', '#D81B60', '#2E7D32'];

  /* s = {f: [f1..f5], t} — f1 text, f2 font size, f3 colors, f4 animation, f5 hierarchy */
  function slide(s) {
    const [f1, f2, f3, f4, f5] = s.f, t = s.t, A = 1 - f4; // A = animation chaos amount
    // background
    const bg = ctx.createLinearGradient(0, 0, SW, SH);
    bg.addColorStop(0, mixC('#FFE66D', '#FFFFFF', f3)); bg.addColorStop(1, mixC('#FF9ECF', '#FFFFFF', f3));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, SW, SH);
    if (f3 < 1) { // loud border
      ctx.save(); ctx.globalAlpha = 1 - f3; ctx.lineWidth = 18; ctx.setLineDash([40, 20]);
      ctx.strokeStyle = '#00C2FF'; ctx.strokeRect(9, 9, SW - 18, SH - 18); ctx.restore();
    }
    // accent bar (good design)
    if (f5 > 0) { ctx.fillStyle = C.accent; ctx.fillRect(110, 110, 90 * E.outCubic(f5), 12); }

    // title
    const tSize = lerp(46, 92, E.inOutCubic(f5));
    const tx = lerp(SW / 2, 110, E.inOutCubic(f5)), ty = lerp(95, 230, E.inOutCubic(f5));
    ctx.save(); ctx.translate(tx, ty);
    ctx.rotate(Math.sin(t * 5) * 0.05 * A); ctx.scale(1 + Math.sin(t * 7) * 0.06 * A, 1 + Math.sin(t * 7) * 0.06 * A);
    ctx.font = (f5 > 0.5 ? body(800, tSize) : body(400, tSize)); ctx.letterSpacing = f5 > 0.5 ? '-2px' : '0px';
    ctx.textBaseline = 'alphabetic';
    const title = 'Rencana Kampanye Q4';
    const tw = ctx.measureText(title).width;
    let x = -tw / 2 * (1 - E.inOutCubic(f5));
    for (let i = 0; i < title.length; i++) {
      const ch = title[i];
      ctx.fillStyle = mixC(LOUD[i % LOUD.length], C.ink, f3);
      if (f3 < 1) { ctx.lineWidth = 4 * (1 - f3); ctx.strokeStyle = `rgba(0,0,0,${0.6 * (1 - f3)})`; ctx.strokeText(ch, x, 0); }
      ctx.fillText(ch, x, 0);
      x += ctx.measureText(ch).width;
    }
    ctx.restore();
    // subtitle (hierarchy)
    if (f5 > 0) {
      ctx.save(); ctx.globalAlpha = E.outCubic(P(f5, 0.4, 1)); ctx.font = body(600, 34); ctx.fillStyle = C.gray; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Rapat tim · Oktober', 110, 295); ctx.restore();
    }

    // body
    const bs = lerp(21, 40, E.inOutCubic(f2));
    const bx = lerp(70, 110, E.inOutCubic(f5));
    const by = lerp(185, 420, E.inOutCubic(f5));
    const gap = lerp(lerp(36, 64, E.inOutCubic(f1)), 92, E.inOutCubic(f2));
    ctx.save(); ctx.textBaseline = 'alphabetic';
    LONG.forEach((ln, i) => {
      const keep = i < 3;
      const out = keep ? 0 : E.inCubic(clamp(f1 * 1.6 - (i - 3) * 0.12));
      if (out >= 1) return;
      const wig = Math.sin(t * 6 + i * 1.7) * 14 * A;
      const y = by + i * gap + wig * 0.5 + out * 120;
      ctx.save(); ctx.globalAlpha *= 1 - out;
      ctx.translate(bx + wig + out * (i % 2 ? 300 : -300), y);
      const col = mixC(LOUD[(i + 3) % LOUD.length], C.ink, f3);
      if (keep && f1 > 0.35) {
        const k = E.outCubic(P(f1, 0.35, 0.8));
        // bullet
        ctx.save(); ctx.globalAlpha *= k; circle(10, -bs * 0.34, bs * 0.2, mixC('#00A651', C.accent, f3));
        const [label, val] = SHORT[i];
        ctx.font = body(800, bs); ctx.fillStyle = col; ctx.fillText(label + ':', 40, 0);
        const lw = ctx.measureText(label + ': ').width;
        ctx.font = body(400, bs); ctx.fillStyle = mixC(LOUD[(i + 5) % 8], '#374151', f3); ctx.fillText(val, 40 + lw, 0);
        ctx.restore();
        ctx.globalAlpha *= 1 - k;
      }
      ctx.font = body(400, bs); ctx.fillStyle = col; ctx.fillText(ln, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // big-number callout (hierarchy)
    if (f5 > 0) {
      const k = E.outBack(P(f5, 0.3, 1));
      ctx.save(); ctx.translate(1230, 560); ctx.scale(k, k);
      ctx.fillStyle = '#FFF3EC'; rr(-230, -210, 460, 380, 36); ctx.fill();
      ctx.font = body(800, 150); ctx.letterSpacing = '-6px'; ctx.fillStyle = C.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('+25%', 0, 20);
      ctx.font = body(600, 36); ctx.letterSpacing = '0px'; ctx.fillStyle = C.gray; ctx.fillText('pengguna baru', 0, 95);
      ctx.restore();
    }

    // clip-art chaos (animation)
    if (f4 < 1) {
      const k = 1 - E.inBack(f4);
      // spinning star
      ctx.save(); ctx.translate(1380, 190); ctx.rotate(t * 4); ctx.scale(k * (1 + Math.sin(t * 9) * 0.15), k * (1 + Math.sin(t * 9) * 0.15));
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 50 : 120, a = i / 10 * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = mixC('#FF1493', '#9CA3AF', f3); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = mixC('#FFD700', '#6B7280', f3); ctx.stroke(); ctx.restore();
      // bouncing NEW!! badge
      ctx.save(); ctx.translate(1250, 470 - Math.abs(Math.sin(t * 6)) * 90 * A); ctx.rotate(-0.25 + Math.sin(t * 8) * 0.2 * A); ctx.scale(k, k);
      rr(-120, -50, 240, 100, 50); ctx.fillStyle = mixC('#00E676', '#E5E7EB', f3); ctx.fill();
      ctx.font = body(800, 54); ctx.fillStyle = mixC('#FF0000', C.ink, f3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NEW!!', 0, 4); ctx.restore();
      // flying arrow
      ctx.save(); const ax = 1150 + ((t * 500) % 700) * A, ay = 760 + Math.sin(t * 5) * 40 * A;
      ctx.translate(ax, ay); ctx.scale(k, k); ctx.fillStyle = mixC('#8E2DE2', '#9CA3AF', f3);
      ctx.beginPath(); ctx.moveTo(-80, -20); ctx.lineTo(20, -20); ctx.lineTo(20, -50); ctx.lineTo(80, 0); ctx.lineTo(20, 50); ctx.lineTo(20, 20); ctx.lineTo(-80, 20); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // motion trails (animation chaos)
    if (A > 0) {
      ctx.save(); ctx.globalAlpha = 0.25 * A;
      for (let k = 0; k < 6; k++) { const y = (t * 900 + k * 170) % SH; ctx.fillStyle = LOUD[k]; ctx.fillRect(0, y, SW, 6); }
      ctx.restore();
    }
    // page footer (hierarchy)
    if (f5 > 0) { ctx.save(); ctx.globalAlpha = f5; ctx.fillStyle = C.lightLine; ctx.fillRect(110, 820, SW - 220, 3); ctx.font = body(600, 24); ctx.fillStyle = '#9CA3AF'; ctx.fillText('03', SW - 140, 860); ctx.restore(); }
  }
  // screen placement
  const SLIDE = { cx: 540, cy: 1010, s: 0.6 };
  function drawSlideAt(cx, cy, sc, state, o = {}) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    if (o.rot) ctx.rotate(o.rot);
    ctx.translate(-SW / 2, -SH / 2);
    if (o.clipX == null) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SW, SH); ctx.shadowColor = 'transparent';
    }
    ctx.beginPath(); ctx.rect(0, 0, o.clipX ?? SW, SH); ctx.clip();
    slide(state);
    ctx.restore();
  }

  // =====================================================================
  // TIMELINE
  // =====================================================================
  const MISTAKES = [
    { a: 'Terlalu banyak teks', fix: 'Ringkas jadi poin', area: [50, 150, 1500, 700] },
    { a: 'Font terlalu kecil', fix: 'Perbesar font', area: [50, 140, 760, 170] },
    { a: 'Terlalu banyak warna', fix: 'Maks. 2–3 warna', area: [12, 12, 1576, 876] },
    { a: 'Animasi berlebihan', fix: 'Animasi seperlunya', area: [1040, 50, 520, 800] },
    { a: 'Tidak ada hierarchy', fix: 'Buat hierarchy jelas', area: [40, 40, 1520, 820] },
  ];
  const M0 = 8, MD = 4;
  const FIX_T = i => M0 + i * MD + 2.05; // fix starts on the second bar of each mistake
  function fixState(t) { return MISTAKES.map((_, i) => E.inOutCubic(P(t, FIX_T(i), FIX_T(i) + 0.85))); }

  // ---------- 1. hook (0 – 4) ----------
  function sHook(t) {
    background(t);
    const grow = E.inOutExpo(P(t, 3.45, 4.1));
    ctx.save(); ctx.globalAlpha = 1 - grow;
    kLine('Presentasimu', 540, 520, t, 0.1, { size: 116 });
    kLine('bikin ngantuk?', 540, 660, t, 0.45, { size: 124, hl: { 1: C.yellow } });
    kLine('Mungkin ini penyebabnya.', 540, 1420, t, 2.05, { size: 60, weight: 500, color: C.dim, stagger: 0.07 });
    ctx.restore();
    // the sleepy slide: dims as eyelids close
    const sc = lerp(0.42, SLIDE.s, grow), cy = lerp(1060, SLIDE.cy, grow);
    const pin = E.outBack(P(t, 0.8, 1.3));
    drawSlideAt(540, cy, sc * pin, { f: [0, 0, 0, 0, 0], t });
    if (pin > 0) {
      const lid = bump(t, 1.4, 2.6) * 0.55 * (1 - grow);
      ctx.save(); ctx.fillStyle = `rgba(14,14,17,${lid})`; ctx.fillRect(540 - SW * sc / 2, cy - SH * sc / 2, SW * sc, SH * sc); ctx.restore();
      // Zzz
      for (let k = 0; k < 3; k++) {
        const p = P(t, 1.2 + k * 0.35, 2.9 + k * 0.35);
        if (p <= 0 || p >= 1) continue;
        ctx.save(); ctx.globalAlpha = Math.sin(p * Math.PI) * (1 - grow);
        ctx.font = head(800, 60 + k * 18); ctx.fillStyle = C.yellow; ctx.textAlign = 'center';
        ctx.fillText('Z', 540 + 300 + k * 40 + Math.sin(p * 6) * 20, cy - 120 - p * 200 - k * 30); ctx.restore();
      }
    }
  }

  // ---------- 2. bad slide + 5 pins (4 – 8) ----------
  const PINS = [[520, 400], [300, 330], [1500, 820], [1380, 190], [800, 95]];
  function pinsAt(t) {
    PINS.forEach(([sx, sy], i) => {
      const t0 = 5.0 + i * 0.5, p = E.outBack(P(t, t0, t0 + 0.3)) * (1 - E.inCubic(P(t, 7.6, 7.95)));
      if (p <= 0) return;
      const x = SLIDE.cx + (sx - SW / 2) * SLIDE.s, y = SLIDE.cy + (sy - SH / 2) * SLIDE.s;
      const rp = P(t, t0, t0 + 0.6);
      if (rp < 1) { ctx.beginPath(); ctx.arc(x, y, 30 + rp * 60, 0, TAU); ctx.strokeStyle = `rgba(255,75,75,${1 - rp})`; ctx.lineWidth = 5; ctx.stroke(); }
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 14; circle(0, 0, 34, C.red); ctx.shadowColor = 'transparent';
      ctx.font = body(800, 36); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), 0, 2);
      ctx.restore();
    });
  }
  function sBad(t) {
    background(t);
    const shake = bump(t, 4.0, 4.35) * 10;
    drawSlideAt(SLIDE.cx + Math.sin(t * 80) * shake, SLIDE.cy, SLIDE.s, { f: [0, 0, 0, 0, 0], t });
    pinsAt(t);
    tag('SEBELUM', 540, 1380, t, 4.1, { bg: C.red, out: 7.7 });
    kLine('5 kesalahan', 540, 420, t, 4.2, { size: 130, hl: { 0: C.red }, out: 7.65 });
    kLine('yang sering terjadi', 540, 530, t, 4.45, { size: 64, weight: 500, color: C.dim, stagger: 0.06, out: 7.7 });
  }

  // ---------- 3. mistakes & fixes (8 – 28) ----------
  function sFix(t) {
    background(t);
    const i = clamp(Math.floor((t - M0) / MD), 0, 4), s = M0 + i * MD, m = MISTAKES[i];
    const fixing = t >= s + 2;
    const f = fixState(t);
    // camera: push toward the problem area on the first bar, settle on the fix
    const [ax, ay, aw, ah] = m.area;
    const zIn = E.inOutCubic(P(t, s + 0.1, s + 0.6)) * (1 - E.inOutCubic(P(t, s + 1.9, s + 2.4)));
    const zoom = 1 + 0.1 * zIn * (aw < 1400 ? 1 : 0.4);
    const fx = (ax + aw / 2 - SW / 2) * SLIDE.s, fy = (ay + ah / 2 - SH / 2) * SLIDE.s;
    ctx.save();
    const maxShift = Math.max(0, (SW * SLIDE.s * zoom - 1000) / 2);
    ctx.translate(SLIDE.cx + clamp(-fx * (zoom - 1), -maxShift, maxShift), SLIDE.cy - fy * (zoom - 1));
    drawSlideAt(0, 0, SLIDE.s * zoom, { f, t });
    // problem outline
    const ol = E.outCubic(P(t, s + 0.25, s + 0.55)) * (1 - P(t, s + 1.95, s + 2.15));
    if (ol > 0) {
      const S = SLIDE.s * zoom, x = (ax - SW / 2) * S, y = (ay - SH / 2) * S;
      ctx.save(); ctx.globalAlpha = ol; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 60;
      ctx.strokeStyle = C.red; ctx.lineWidth = 6; rr(x, y, aw * S, ah * S, 14); ctx.stroke(); ctx.setLineDash([]);
      ctx.translate(x + aw * S, y); ctx.scale(E.outBack(P(t, s + 0.35, s + 0.65)), E.outBack(P(t, s + 0.35, s + 0.65)));
      circle(0, 0, 36, C.red); cross(0, 0, 26, '#fff', 8); ctx.restore();
    }
    // fixed badge
    const ok = E.outBack(P(t, s + 3.0, s + 3.3));
    if (ok > 0) {
      const S = SLIDE.s * zoom;
      ctx.save(); ctx.translate(SW / 2 * S - 10, -SH / 2 * S + 10); ctx.scale(ok, ok);
      circle(0, 0, 40, C.green); tick(0, 0, 44, '#0E0E11', 9, P(t, s + 3.05, s + 3.35)); ctx.restore();
    }
    ctx.restore();

    // header: problem, then the fix
    const n = `0${i + 1}`;
    if (!fixing) {
      tag(`KESALAHAN ${n}`, 540, 300, t, s + 0.05, { bg: C.red, out: s + 1.85 });
      kLine(m.a, 540, 450, t, s + 0.1, { size: 104, out: s + 1.8, maxW: 960 });
      tag('SEBELUM', 540, 1380, t, s + 0.1, { bg: C.red, out: s + 1.85 });
    } else {
      tag('PERBAIKI', 540, 300, t, s + 2.05, { bg: C.green, color: '#0E0E11', out: s + 3.85 });
      kLine(m.fix, 540, 450, t, s + 2.1, { size: 104, hl: {}, out: i < 4 ? s + 3.8 : 27.8, maxW: 960, color: C.green });
      tag('SESUDAH', 540, 1380, t, s + 2.1, { bg: C.green, color: '#0E0E11', out: s + 3.85 });
    }
    // progress: 5 dots
    for (let k = 0; k < 5; k++) {
      const done = P(t, FIX_T(k) + 0.9, FIX_T(k) + 1.1), cur = k === i;
      const x = 540 + (k - 2) * 70, y = 1500;
      const pulse = cur ? 1 + 0.15 * Math.exp(-((t * 2) % 1) * 5) : 1;
      circle(x, y, (cur ? 16 : 12) * pulse, done > 0.5 ? C.green : cur ? C.red : 'rgba(245,243,238,0.18)');
    }
  }

  // ---------- 4. final slide + before/after (28 – 34) ----------
  const DONE = [1, 1, 1, 1, 1];
  function sFinal(t) {
    background(t);
    const up = E.inOutCubic(P(t, 28.0, 28.6));
    const sc = lerp(SLIDE.s, 0.64, up);
    const out = E.inOutExpo(P(t, 33.4, 34.0));
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 200);
    kLine('Clean. Jelas.', 540, 390, t, 28.1, { size: 116, hl: { 1: C.green }, out: 33.3 });
    kLine('Mudah dibaca.', 540, 520, t, 28.45, { size: 90, weight: 500, color: C.dim, out: 33.35 });
    drawSlideAt(540, SLIDE.cy + 20, sc, { f: DONE, t });
    // shine sweep across the finished slide
    const sh = P(t, 28.6, 29.3);
    if (sh > 0 && sh < 1) {
      const w = SW * sc, h = SH * sc, x0 = 540 - w / 2, y0 = SLIDE.cy + 20 - h / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
      const sx = x0 - 200 + sh * (w + 400);
      const g = ctx.createLinearGradient(sx - 120, 0, sx + 120, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h); ctx.restore();
    }
    // before / after wipe
    const wipeIn = E.inOutCubic(P(t, 29.6, 30.6)), wipeOut = E.inOutCubic(P(t, 32.2, 33.1));
    const frac = 0.5 * wipeIn * (1 - wipeOut) + (wipeIn > 0 && wipeOut < 1 ? 0.12 * Math.sin((t - 30.6) * 2.2) * P(t, 30.6, 31) * (1 - wipeOut) : 0);
    if (frac > 0.001) {
      const w = SW * sc, h = SH * sc, x0 = 540 - w / 2, y0 = SLIDE.cy + 20 - h / 2;
      drawSlideAt(540, SLIDE.cy + 20, sc, { f: [0, 0, 0, 0, 0], t }, { clipX: SW * frac });
      const dx = x0 + w * frac;
      line(dx, y0 - 20, dx, y0 + h + 20, C.yellow, 6);
      circle(dx, y0 + h / 2, 30, C.yellow);
      ctx.fillStyle = '#0E0E11'; ctx.beginPath(); ctx.moveTo(dx - 16, y0 + h / 2); ctx.lineTo(dx - 5, y0 + h / 2 - 10); ctx.lineTo(dx - 5, y0 + h / 2 + 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(dx + 16, y0 + h / 2); ctx.lineTo(dx + 5, y0 + h / 2 - 10); ctx.lineTo(dx + 5, y0 + h / 2 + 10); ctx.fill();
    }
    tag('SEBELUM', 300, 1400, t, 29.8, { bg: C.red, out: 32.3 });
    tag('SESUDAH', 780, 1400, t, 29.9, { bg: C.green, color: '#0E0E11', out: 32.35 });
    ctx.restore();
  }

  // ---------- 5. ending (34 – 40) ----------
  const CLUTTER = ['paragraf panjang', 'semua data', '7 warna', 'clip-art', 'font lucu', 'transisi', 'catatan', 'grafik', 'detail', 'WordArt', 'tabel', 'kutipan'];
  function sEnd(t) {
    background(t);
    kLine('Presentasi bukan tempat', 540, 560, t, 34.1, { size: 84, stagger: 0.07 });
    kLine('memasukkan semuanya.', 540, 670, t, 34.45, { size: 84, stagger: 0.07 });
    // clutter chips pile around, then fall away on the drop
    CLUTTER.forEach((c, i) => {
      const t0 = 34.6 + i * 0.07, p = E.outBack(P(t, t0, t0 + 0.3));
      if (p <= 0) return;
      const fall = P(t, 36.0 + rnd(i) * 0.3, 37.0 + rnd(i) * 0.3);
      if (fall >= 1) return;
      const x = 200 + (i % 3) * 340 + (rnd(i + 4) - 0.5) * 120, y = 820 + Math.floor(i / 3) * 130 + (rnd(i + 9) - 0.5) * 50 + E.inCubic(fall) * 1100;
      ctx.save(); ctx.translate(x, y); ctx.rotate((rnd(i + 2) - 0.5) * 0.4 + fall * (rnd(i) - 0.5) * 3); ctx.scale(p, p);
      ctx.font = body(600, 32); const w = ctx.measureText(c).width + 40;
      rr(-w / 2, -30, w, 60, 14); ctx.fillStyle = 'rgba(245,243,238,0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(245,243,238,0.25)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c, 0, 2); ctx.restore();
    });
    kLine('Pilih yang penting.', 540, 1060, t, 36.6, { size: 128, stagger: 0.12, marker: { 1: C.yellow, 2: C.yellow }, hl: { 1: '#0E0E11', 2: '#0E0E11' } });
    // single, clean slide thumbnail as the takeaway
    const th = E.outBack(P(t, 37.6, 38.1));
    if (th > 0) drawSlideAt(540, 1330, 0.26 * th, { f: DONE, t });
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    if (t < 4.0) sHook(t);
    else if (t < M0) sBad(t);
    else if (t < 28.0) sFix(t);
    else if (t < 34.0) sFinal(t);
    else sEnd(t);
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
