/* "Kenapa desain terlihat tidak profesional?" — 40s educational motion piece, 1080x1920.
 * One poster, four fixes: every frame is a pure function of time, render(t). */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    bg: '#F4F2EE', ink: '#111827', ink2: '#6B7280', mute: '#B8BCC4', line: '#E3E1DC', card: '#FFFFFF',
    blue: '#2F6BFF', blueL: '#DCE6FF', red: '#F04438', redL: '#FEE4E2', green: '#12B76A', greenL: '#D1FADF',
  };
  // the "good" poster palette: exactly three colours
  const PC = { cream: '#F5EFE4', navy: '#172554', coral: '#FF5A3C', navy2: '#4B5577' };
  const UI = '"Inter", sans-serif';
  const FAM = { inter: '"Inter"', bebas: '"Bebas"', pac: '"Pacifico"', comic: '"Comic"', play: '"Playfair"' };
  const FNAME = { inter: 'Inter', bebas: 'Bebas Neue', pac: 'Pacifico', comic: 'Comic Neue', play: 'Playfair' };
  const FWT = { inter: 700, bebas: 400, pac: 400, comic: 700, play: 700 };

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, p) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], p))).join(',')})`; };
  // staggered local progress of item i out of n for a 0..1 driver
  const stag = (s, i, n, spread = 0.45) => clamp((s - (n > 1 ? spread * i / (n - 1) : 0)) / (1 - spread));

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    ...[[400, 'Inter'], [500, 'Inter'], [600, 'Inter'], [700, 'Inter'], [800, 'Inter'], [700, 'Playfair'], [900, 'Playfair'],
      [400, 'Bebas'], [400, 'Pacifico'], [700, 'Comic']].map(([w, f]) => document.fonts.load(`${w} 40px "${f}"`)),
  ]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  const font = (w, s) => `${w} ${s}px ${UI}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function shadow(a = 0.12, blur = 40, oy = 16) { ctx.shadowColor = `rgba(17,24,39,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy; }
  function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  function tick(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function cross(x, y, s, c, w, p = 1) {
    if (p <= 0) return;
    const a = clamp(p * 2), b = clamp(p * 2 - 1);
    line(x - s / 2, y - s / 2, x - s / 2 + s * a, y - s / 2 + s * a, c, w);
    if (b > 0) line(x + s / 2, y - s / 2, x + s / 2 - s * b, y - s / 2 + s * b, c, w);
  }
  // Kinetic line: each word slams in (scale down + fade), exits upward.
  function kLine(text, x, y, t, t0, o = {}) {
    const size = o.size || 100, stagger = o.stagger ?? 0.07, dur = o.dur || 0.45;
    ctx.save();
    ctx.font = font(o.weight || 800, size); ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.04)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' '), sp = ctx.measureText(' ').width * 0.9;
    const ws = words.map(w => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    const fit = total > (o.maxW || 960) ? (o.maxW || 960) / total : 1;
    let cx = x - (total * fit) / 2;
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, p = P(t, a, a + dur);
      const pout = o.out != null ? E.inCubic(P(t, o.out + i * stagger * 0.4, o.out + i * stagger * 0.4 + 0.3)) : 0;
      const w = ws[i] * fit;
      if (p > 0 && pout < 1) {
        const s = lerp(1.5, 1, E.outExpo(p)) * fit;
        ctx.save();
        ctx.translate(cx + w / 2, y - size * 0.35 - pout * 50);
        ctx.scale(s, s);
        ctx.globalAlpha *= clamp(p * 3) * (1 - pout);
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.ink;
        ctx.fillText(words[i], -ws[i] / 2, size * 0.35);
        ctx.restore();
      }
      cx += w + sp * fit;
    }
    ctx.restore();
    return total * fit;
  }
  function pill(text, x, y, t, t0, o = {}) {
    const p = E.outBack(P(t, t0, t0 + 0.35)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.22)) : 0;
    if (p <= 0 || out >= 1) return;
    ctx.save(); ctx.font = font(700, o.size || 26); ctx.letterSpacing = '4px';
    const tw = ctx.measureText(text).width, h = (o.size || 26) * 2.1, dot = o.dot ? 30 : 0, w = tw + 56 + dot;
    ctx.translate(x, y); ctx.scale(p * (1 - out), p * (1 - out));
    rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = o.bg || C.ink; ctx.fill();
    if (o.dot) circle(-w / 2 + 34, 0, 8, o.dot);
    ctx.fillStyle = o.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, dot / 2 + 2, 2); ctx.restore();
  }
  // A word whose letters keep re-rolling font, colour and angle — "berantakan" made visible.
  const CH_FAM = ['bebas', 'pac', 'comic', 'play', 'inter'];
  const CH_COL = ['#E8141C', '#1440FF', '#7B2CBF', '#FF7A00', '#00A3D9', '#D81BD2', '#0FA958'];
  function chaosWord(text, x, y, size, t, t0, o = {}) {
    const p = P(t, t0, t0 + 0.5), out = o.out != null ? P(t, o.out, o.out + 0.35) : 0;
    if (p <= 0 || out >= 1) return 0;
    const tick8 = Math.floor(t / 0.13), calm = o.calm || 0;
    const chars = [...text], meta = chars.map((ch, i) => {
      const r = k => rnd(i * 17.3 + k * 3.1 + tick8 * (1 - calm) * 7.7 + (o.seed || 0));
      const fam = CH_FAM[Math.floor(r(1) * CH_FAM.length)];
      ctx.font = `${FWT[fam]} ${size * (fam === 'bebas' ? 1.2 : fam === 'pac' ? 0.85 : 1)}px ${FAM[fam]}`; ctx.letterSpacing = '0px';
      return { ch, fam, f: ctx.font, w: ctx.measureText(ch).width, col: CH_COL[Math.floor(r(2) * CH_COL.length)], rot: (r(3) - 0.5) * 26 * DEG, dy: (r(4) - 0.5) * size * 0.22, ds: 0.85 + r(5) * 0.35 };
    });
    const gap = size * 0.02, total = meta.reduce((a, m) => a + m.w * m.ds + gap, -gap);
    let cx = x - total / 2;
    ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    meta.forEach((m, i) => {
      const pi = E.outBack(clamp(p * 1.6 - i * 0.05)), po = E.inCubic(clamp(out * 1.5 - i * 0.04));
      const w = m.w * m.ds;
      if (pi > 0 && po < 1) {
        ctx.save(); ctx.translate(cx + w / 2, y + m.dy + po * 220 * (0.6 + rnd(i))); ctx.rotate(m.rot + po * (rnd(i + 4) - 0.5) * 2); ctx.scale(pi * m.ds, pi * m.ds);
        ctx.globalAlpha *= (1 - po) * (o.alpha ?? 1); ctx.font = m.f; ctx.letterSpacing = '0px'; ctx.fillStyle = o.gray ? mix(m.col.length === 7 ? m.col : '#999999', '#9CA3AF', o.gray) : m.col;
        ctx.fillText(m.ch, 0, 0); ctx.restore();
      }
      cx += w + gap;
    });
    ctx.restore();
    return total;
  }

  // =====================================================================
  // THE POSTER — every property has a "bad" and a "good" value; four drivers
  // (f = font, c = colour, a = alignment, h = hierarchy) move it between them.
  // =====================================================================
  const PW = 760, PH = 950, M = 64;
  const TEXTS = [
    { id: 'tag', lines: ['WORKSHOP ONLINE'], fam: ['inter', 'inter'], wt: [800, 700], size: [40, 22], lh: [1.1, 1.1], ls: [0, 5],
      color: ['#E8141C', PC.coral], ax: [392, M], af: [0.5, 0], y: [40, 92], rot: [-2.5, 0] },
    { id: 'title', lines: ['Belajar', 'Desain', 'Grafis'], fam: ['bebas', 'play'], wt: [400, 700], size: [70, 112], lh: [0.95, 0.98], ls: [2, -2],
      color: ['#1440FF', PC.navy], ax: [300, M], af: [0.5, 0], y: [120, 138], rot: [2, 0], shadow: true },
    { id: 'sub', lines: ['Dari nol sampai bisa', 'bikin karya sendiri'], fam: ['pac', 'inter'], wt: [400, 500], size: [38, 30], lh: [1.45, 1.35], ls: [0, 0],
      color: ['#7B2CBF', PC.navy2], ax: [716, M], af: [1, 0], y: [352, 504], rot: [-3, 0] },
    { id: 'date', lines: ['Sabtu, 12 Oktober', '09.00 WIB · Online'], fam: ['comic', 'inter'], wt: [700, 600], size: [42, 26], lh: [1.2, 1.45], ls: [0, 0],
      color: ['#FF7A00', PC.navy], ax: [96, M], af: [0, 0], y: [505, 636], rot: [2.5, 0] },
    { id: 'cta', button: true, lines: ['Daftar Sekarang →'], fam: ['bebas', 'inter'], wt: [400, 700], size: [48, 27], lh: [1, 1], ls: [1, 0],
      color: ['#E8141C', PC.cream], fill: ['#00C2FF', PC.coral], ax: [470, M], af: [0.5, 0], y: [690, 792], rot: [-4, 0] },
  ];
  const BADGE = { text: 'GRATIS', fam: ['play', 'inter'], wt: [900, 800], size: [36, 17], ls: [0, 3], color: ['#7CFF00', PC.cream], fill: ['#D81BD2', PC.navy],
    cx: [602, 652], cy: [214, 116], r: [88, 56], rot: [-16, 0] };
  const ART = [
    { kind: 'circle', x: [132, 604], y: [836, 700], r: [84, 104], rot: [0, 0], color: ['#00C2FF', PC.navy] },
    { kind: 'semi', x: [566, 604], y: [566, 882], r: [92, 104], rot: [40, 0], color: ['#7CFF00', PC.coral] },
    { kind: 'ring', x: [150, 604], y: [388, 700], r: [44, 38], rot: [0, 0], color: ['#0FA958', PC.coral], lw: [12, 10] },
  ];
  const STARS = [[84, 96, '#FF7A00', 28], [700, 44, '#1440FF', 22], [396, 650, '#D81BD2', 26], [704, 872, '#E8141C', 30], [340, 902, '#7B2CBF', 20], [52, 640, '#1440FF', 18]];
  const BAD_BG = ['#FFE600', '#FF5FA2'];

  function textGeom(e, i, st) {
    const n = TEXTS.length;
    const sf = stag(st.f, i, n), sc = E.inOutCubic(stag(st.c, i, n)), sa = E.inOutCubic(stag(st.a, i, n)), sh = E.inOutCubic(stag(st.h, i, n, 0.12));
    const sameFam = e.fam[0] === e.fam[1];
    const k = sameFam ? 0 : sf < 0.5 ? 0 : 1;
    const wt = sameFam ? lerp(e.wt[0], e.wt[1], E.inOutCubic(sf)) : e.wt[k];
    const flip = sameFam ? 1 : sf < 0.5 ? 1 - E.inCubic(sf * 2) : E.outBack((sf - 0.5) * 2);
    const size = lerp(e.size[0], e.size[1], sh), lh = lerp(e.lh[0], e.lh[1], sh), ls = lerp(e.ls[0], e.ls[1], sh);
    const fs = size * (e.fam[k] === 'pac' ? 0.9 : 1);
    const f = `${Math.round(wt)} ${fs}px ${FAM[e.fam[k]]}`;
    ctx.font = f; ctx.letterSpacing = ls + 'px';
    const ax = lerp(e.ax[0], e.ax[1], sa), af = lerp(e.af[0], e.af[1], sa), y = lerp(e.y[0], e.y[1], sh), rot = lerp(e.rot[0], e.rot[1], sa) * DEG;
    const g = { id: e.id, i, f, fam: e.fam[k], size, ls, flip, rot, sc, sa, sh, sf, color: mix(e.color[0], e.color[1], sc), y };
    if (e.button) {
      const tw = ctx.measureText(e.lines[0]).width, padX = size * 0.95, bh = size * 2.4, bw = tw + padX * 2;
      g.x = ax - bw * af; g.w = bw; g.h = bh; g.lines = [{ text: e.lines[0], x: g.x + padX, w: tw }];
      g.fill = mix(e.fill[0], e.fill[1], sc); g.border = 1 - sc; g.radius = lerp(6, bh / 2, sc);
    } else {
      g.lines = e.lines.map(t => { const w = ctx.measureText(t).width; return { text: t, x: ax - w * af, w }; });
      g.x = Math.min(...g.lines.map(l => l.x)); g.w = Math.max(...g.lines.map(l => l.x + l.w)) - g.x;
      g.h = size * (lh * (e.lines.length - 1) + 1); g.lh = lh;
    }
    g.cx = g.x + g.w / 2; g.cy = y + g.h / 2;
    return g;
  }
  function badgeGeom(st) {
    const b = BADGE, sf = stag(st.f, 5, 6), sc = E.inOutCubic(stag(st.c, 5, 6)), sa = E.inOutCubic(stag(st.a, 5, 6)), sh = E.inOutCubic(stag(st.h, 5, 6));
    const k = sf < 0.5 ? 0 : 1, flip = sf < 0.5 ? 1 - E.inCubic(sf * 2) : E.outBack((sf - 0.5) * 2);
    const size = lerp(b.size[0], b.size[1], sh);
    return { k, flip, size, f: `${b.wt[k]} ${size}px ${FAM[b.fam[k]]}`, ls: lerp(b.ls[0], b.ls[1], sh), cx: lerp(b.cx[0], b.cx[1], sa), cy: lerp(b.cy[0], b.cy[1], sa),
      r: lerp(b.r[0], b.r[1], sh), rot: lerp(b.rot[0], b.rot[1], sa) * DEG, spikes: 1 - sc, color: mix(b.color[0], b.color[1], sc), fill: mix(b.fill[0], b.fill[1], sc) };
  }
  const geom = st => TEXTS.map((e, i) => textGeom(e, i, st));

  // Draw the poster in local coordinates (0..PW, 0..PH). `ap` = per-element appear (reveal).
  function drawPosterLocal(st, ap = null, t = 0) {
    const A = i => (ap ? ap(i) : 1);
    const sc = E.inOutCubic(st.c);
    // background
    const g = ctx.createLinearGradient(0, 0, PW * 0.3, PH);
    g.addColorStop(0, mix(BAD_BG[0], PC.cream, sc)); g.addColorStop(1, mix(BAD_BG[1], PC.cream, sc));
    ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    // bad diagonal stripes, gone with the colour fix
    if (sc < 1) {
      ctx.save(); ctx.globalAlpha = 0.18 * (1 - sc); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 22;
      for (let k = -8; k < 12; k++) { ctx.beginPath(); ctx.moveTo(k * 90, 0); ctx.lineTo(k * 90 + PH * 0.6, PH); ctx.stroke(); }
      ctx.restore();
    }
    // art
    ART.forEach((a, j) => {
      const idx = 6 + j, p = A(idx); if (p <= 0) return;
      const s_c = E.inOutCubic(stag(st.c, j + 1, 5)), s_a = E.inOutCubic(stag(st.a, j + 2, 6)), s_h = E.inOutCubic(stag(st.h, j + 2, 6));
      const x = lerp(a.x[0], a.x[1], s_a), y = lerp(a.y[0], a.y[1], s_a), r = lerp(a.r[0], a.r[1], s_h) * p, rot = lerp(a.rot[0], a.rot[1], s_a) * DEG;
      const col = mix(a.color[0], a.color[1], s_c);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      if (a.kind === 'circle') circle(0, 0, r, col);
      else if (a.kind === 'semi') { ctx.beginPath(); ctx.arc(0, 0, Math.max(0, r), 0, Math.PI); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, Math.max(0, r), 0, TAU); ctx.strokeStyle = col; ctx.lineWidth = lerp(a.lw[0], a.lw[1], s_h) * p; ctx.stroke(); }
      ctx.restore();
    });
    // sticker stars — pure noise, removed with the colour fix
    STARS.forEach(([x, y, c, r], j) => {
      const p = A(9 + j) * (1 - E.inOutCubic(stag(st.c, j, STARS.length, 0.5)));
      if (p <= 0) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.8 * (j % 2 ? 1 : -1) + j); ctx.scale(p, p);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const rr_ = k % 2 ? r * 0.42 : r, an = k * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(an) * rr_, Math.sin(an) * rr_); }
      ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.restore();
    });
    // text
    geom(st).forEach((g, i) => {
      const p = A(i); if (p <= 0) return;
      const e = TEXTS[i];
      ctx.save(); ctx.translate(g.cx, g.cy); ctx.rotate(g.rot); ctx.scale(p, p * g.flip); ctx.translate(-g.cx, -g.cy);
      ctx.font = g.f; ctx.letterSpacing = g.ls + 'px'; ctx.textAlign = 'left';
      if (e.button) {
        if (g.border > 0.01) { ctx.save(); ctx.globalAlpha *= g.border; rr(g.x - 6, g.y - 6, g.w + 12, g.h + 12, g.radius + 6); ctx.fillStyle = '#D81BD2'; ctx.fill(); ctx.restore(); }
        rr(g.x, g.y, g.w, g.h, g.radius); ctx.fillStyle = g.fill; ctx.fill();
        ctx.textBaseline = 'middle'; ctx.fillStyle = g.color; ctx.fillText(e.lines[0], g.lines[0].x, g.y + g.h / 2 + g.size * (g.fam === 'bebas' ? 0.06 : 0.02));
      } else {
        ctx.textBaseline = 'alphabetic';
        g.lines.forEach((l, k) => {
          const by = g.y + g.size * 0.8 + k * g.size * g.lh;
          if (e.shadow && g.sc < 1) { ctx.save(); ctx.globalAlpha *= 1 - g.sc; ctx.fillStyle = '#D81BD2'; ctx.fillText(l.text, l.x + 5, by + 5); ctx.restore(); }
          ctx.fillStyle = g.color; ctx.fillText(l.text, l.x, by);
        });
      }
      ctx.restore();
    });
    // badge
    const bp = A(5);
    if (bp > 0) {
      const b = badgeGeom(st);
      ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(b.rot + (b.spikes > 0 ? t * 0.3 * b.spikes : 0)); ctx.scale(bp, bp);
      ctx.beginPath();
      const N = 28;
      for (let k = 0; k < N; k++) { const an = k / N * TAU, rr_ = b.r * (k % 2 ? 1 - 0.16 * b.spikes : 1 + 0.06 * b.spikes); ctx.lineTo(Math.cos(an) * rr_, Math.sin(an) * rr_); }
      ctx.closePath(); ctx.fillStyle = b.fill; ctx.fill();
      ctx.rotate(-(b.spikes > 0 ? t * 0.3 * b.spikes : 0)); ctx.scale(1, b.flip);
      ctx.font = b.f; ctx.letterSpacing = b.ls + 'px'; ctx.fillStyle = b.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.k ? BADGE.text : BADGE.text + '!!', b.ls / 2, b.size * 0.06);
      ctx.restore();
    }
  }
  // Poster on screen: centred at (x, y), uniform scale s. clip = [x0, x1] in local x, for before/after.
  function drawPoster(POS, st, o = {}) {
    ctx.save(); ctx.translate(POS.x, POS.y); ctx.rotate(POS.rot || 0); ctx.scale(POS.s, POS.s); ctx.translate(-PW / 2, -PH / 2);
    ctx.globalAlpha *= POS.alpha ?? 1;
    if (!o.noShadow) { ctx.save(); shadow(0.16, 70, 30); rr(0, 0, PW, PH, 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
    rr(o.clip ? o.clip[0] : 0, 0, o.clip ? o.clip[1] - o.clip[0] : PW, PH, o.clip ? 0 : 22);
    ctx.save(); rr(0, 0, PW, PH, 22); ctx.clip();
    if (o.clip) { ctx.beginPath(); ctx.rect(o.clip[0], 0, o.clip[1] - o.clip[0], PH); ctx.clip(); }
    drawPosterLocal(st, o.appear, o.t || 0);
    ctx.restore(); ctx.restore();
  }
  const toScreen = (POS, lx, ly) => ({ x: POS.x + (lx - PW / 2) * POS.s, y: POS.y + (ly - PH / 2) * POS.s });
  // run fn inside the poster's local frame (for overlays)
  function inPoster(POS, fn) { ctx.save(); ctx.translate(POS.x, POS.y); ctx.scale(POS.s, POS.s); ctx.translate(-PW / 2, -PH / 2); fn(1 / POS.s); ctx.restore(); }

  // ---------- timeline ----------
  const T = { reveal: 4.3, causes: [9.6, 15.2, 20.8, 26.4], CD: 5.6, result: 32.0, end: 35.8 };
  const HOME = { x: 540, y: 905, s: 0.88 };
  const FIX0 = 2.8, FIXD = 1.5; // morph window inside each cause
  function state(t) {
    const d = T.causes.map(b => P(t, b + FIX0, b + FIX0 + FIXD));
    return { f: d[0], c: d[1], a: d[2], h: d[3] };
  }

  // ---------- atmosphere ----------
  function background(t) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const blobs = [[930, 260, 560, 'rgba(47,107,255,0.08)', 0.3], [100, 1600, 620, 'rgba(255,90,60,0.07)', 0.25]];
    for (const [x, y, r, c, s] of blobs) {
      const bx = x + Math.sin(t * s + y) * 50, by = y + Math.cos(t * s + x) * 50;
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      rg.addColorStop(0, c); rg.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    // design-canvas dot grid
    ctx.fillStyle = 'rgba(17,24,39,0.09)';
    const s = 48, oy = (t * 10) % s;
    for (let y = -s + oy; y < H + s; y += s) for (let x = 12; x < W; x += s) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
  }
  function finish(t) {
    const wa = P(t, 0.4, 1.1) * 0.92;
    if (wa > 0) { // uploaded logo, unaltered, as a small watermark (top-right)
      const s = 70, x = W - 58 - s, y = 146;
      ctx.save(); ctx.globalAlpha = wa; shadow(0.16, 16, 5);
      rr(x, y, s, s, 17); ctx.fillStyle = '#004FC7'; ctx.fill(); noShadow();
      rr(x, y, s, s, 17); ctx.clip();
      const ih = s * logo.height / logo.width; ctx.drawImage(logo, x, y + (s - ih) / 2, s, ih);
      ctx.restore();
    }
    const f = 1 - P(t, 0, 0.2) + P(t, 39.55, 40);
    if (f > 0) { ctx.fillStyle = `rgba(244,242,238,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }

  // =====================================================================
  // 1. HOOK (0 – 4.3)
  // =====================================================================
  function sHook(t) {
    const out = 3.85;
    kLine('Desainmu', 540, 700, t, 0.15, { size: 132, out });
    const w = kLine('bagus,', 540, 850, t, 0.5, { size: 132, color: C.blue, out });
    const u = E.inOutCubic(P(t, 0.85, 1.25)) * (1 - P(t, out, out + 0.2));
    if (u > 0) { // clean underline
      ctx.save(); line(540 - w / 2, 890, 540 - w / 2 + w * u, 890, C.blue, 10); ctx.restore();
    }
    kLine('tapi kok masih terlihat', 540, 1030, t, 1.35, { size: 62, weight: 600, color: C.ink2, spacing: -1, stagger: 0.06, out: out + 0.05 });
    chaosWord('berantakan?', 540, 1215, 132, t, 1.9, { out: out + 0.1 });
    // tiny warning marks flicking around the messy word
    for (let k = 0; k < 5; k++) {
      const p = E.outBack(P(t, 2.35 + k * 0.1, 2.7 + k * 0.1)) * (1 - P(t, out, out + 0.2));
      if (p <= 0) continue;
      const [px, py] = [[150, 1150], [935, 1135], [210, 1300], [880, 1295], [560, 1330]][k], x = px, y = py + Math.sin(t * 6 + k) * 6;
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.rotate((rnd(k + 2) - 0.5) * 0.6);
      ctx.font = font(900, 54); ctx.fillStyle = C.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 0); ctx.restore();
    }
  }

  // =====================================================================
  // 2. THE MESSY POSTER (4.3 – 9.6)
  // =====================================================================
  function posterPos(t) {
    const pin = E.outCubic(P(t, T.reveal, T.reveal + 0.8));
    const pos = { ...HOME, y: lerp(2500, HOME.y, pin), rot: (1 - pin) * 8 * DEG };
    // result: gentle zoom
    const z = E.inOutCubic(P(t, T.result, T.result + 0.6)) * (1 - E.inOutCubic(P(t, T.end, T.end + 0.5)));
    pos.s = HOME.s + z * 0.04;
    // exit before the ending line
    const ex = E.inOutExpo(P(t, T.end, T.end + 0.55));
    pos.y -= ex * 180; pos.s *= 1 - ex * 0.25; pos.alpha = 1 - ex;
    return pos;
  }
  const appear = t => i => E.outBack(P(t, 4.85 + i * 0.1, 5.25 + i * 0.1));

  function sReveal(t) {
    pill('CONTOH', 540, 262, t, 4.75, { bg: C.ink, out: 9.25 });
    kLine('Niatnya biar menarik…', 540, 390, t, 4.85, { size: 70, out: 6.55 });
    kLine('Hasilnya: ramai & bikin bingung.', 540, 390, t, 6.7, { size: 64, out: 7.95, hl: { 1: C.red, 3: C.red, 4: C.red } });
    kLine('Ada 4 penyebabnya:', 540, 390, t, 8.1, { size: 74, out: 9.3 });
    // warning pins around the poster
    const POS = posterPos(t);
    const pins = [[40, 90], [720, 330], [30, 520], [735, 700], [360, 930]];
    pins.forEach(([lx, ly], k) => {
      const p = E.outBack(P(t, 6.8 + k * 0.12, 7.15 + k * 0.12)) * (1 - E.inCubic(P(t, 9.2, 9.45)));
      if (p <= 0) return;
      const s = toScreen(POS, lx, ly);
      ctx.save(); ctx.translate(s.x, s.y + Math.sin(t * 5 + k) * 5); ctx.scale(p, p);
      shadow(0.25, 14, 5); circle(0, 0, 30, C.red); noShadow();
      ctx.font = font(900, 38); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 2); ctx.restore();
    });
  }

  // =====================================================================
  // 3. FOUR CAUSES, EACH FIXED ON THE SAME POSTER (9.6 – 32.0)
  // =====================================================================
  const CAUSES = [
    { tag: 'PENYEBAB 1', bad: 'Terlalu banyak font', fix: 'Cukup 2 font saja', chip: 'Font' },
    { tag: 'PENYEBAB 2', bad: 'Terlalu banyak warna', fix: 'Pakai 3 warna utama', chip: 'Warna' },
    { tag: 'PENYEBAB 3', bad: 'Alignment berantakan', fix: 'Sejajarkan ke satu garis', chip: 'Alignment' },
    { tag: 'PENYEBAB 4', bad: 'Tidak ada hierarchy', fix: 'Tonjolkan yang terpenting', chip: 'Hierarchy' },
  ];
  function captions(t) {
    CAUSES.forEach((c, i) => {
      const b = T.causes[i];
      pill(c.tag, 540, 262, t, b, { bg: C.red, dot: '#fff', out: b + 2.45 });
      const w = kLine(c.bad, 540, 390, t, b + 0.08, { size: 80, out: b + 2.45 });
      const sp = E.inOutCubic(P(t, b + 2.0, b + 2.35)) * (1 - P(t, b + 2.45, b + 2.7));
      if (sp > 0 && t < b + 2.8) line(540 - w / 2 - 10, 362, 540 - w / 2 - 10 + (w + 20) * sp, 362, C.red, 9);
      pill('SOLUSI', 540, 262, t, b + 2.6, { bg: C.green, dot: '#fff', out: b + 5.2 });
      kLine(c.fix, 540, 390, t, b + 2.7, { size: 78, out: b + 5.2, stagger: 0.06 });
    });
  }

  // tracker: 4 chips at the bottom, filling with checks as each cause is fixed
  function tracker(t) {
    const out = E.inOutExpo(P(t, T.end, T.end + 0.5));
    if (out >= 1) return;
    ctx.save(); ctx.font = font(700, 28); ctx.letterSpacing = '0px';
    const ws = CAUSES.map(c => ctx.measureText(c.chip).width + 96), gap = 16, total = ws.reduce((a, b) => a + b, 0) + gap * 3;
    let x = 540 - total / 2; const y = 1700 + out * 300;
    CAUSES.forEach((c, i) => {
      const p = E.outBack(P(t, 8.3 + i * 0.12, 8.65 + i * 0.12)), w = ws[i];
      if (p <= 0) { x += w + gap; return; }
      const b = T.causes[i], active = P(t, b - 0.1, b + 0.2) * (1 - P(t, b + T.CD - 0.3, b + T.CD)), done = P(t, b + 4.3, b + 4.6);
      const pulse = done > 0 && done < 1 ? Math.sin(done * Math.PI) * 0.12 : 0;
      ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(p * (1 + active * 0.06 + pulse), p * (1 + active * 0.06 + pulse));
      shadow(0.1 + active * 0.12, 24, 8);
      rr(-w / 2, -36, w, 72, 36);
      ctx.fillStyle = done > 0.5 ? mix('#FFFFFF', C.green, 1) : active > 0.5 ? C.ink : '#fff'; ctx.fill(); noShadow();
      const ic = -w / 2 + 38;
      if (done > 0) { circle(ic, 0, 18, '#fff'); tick(ic, 0, 22, C.green, 4.5, E.outCubic(done)); }
      else { circle(ic, 0, 18, active > 0.5 ? '#fff' : C.line); ctx.font = font(800, 20); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), ic, 1); }
      ctx.font = font(700, 28); ctx.fillStyle = done > 0.5 || active > 0.5 ? '#fff' : C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(c.chip, ic + 30, 2);
      ctx.restore();
      x += w + gap;
    });
    ctx.restore();
  }

  // --- overlay 1: fonts — Figma-like selection boxes labelled with each font ---
  function ovFonts(t, POS, st) {
    const b = T.causes[0], on = P(t, b + 0.35, b + 0.8), off = P(t, b + 5.0, b + 5.35);
    if (on <= 0 || off >= 1) return;
    const G = geom(st);
    G.forEach((g, i) => {
      const p = E.outCubic(clamp(on * 1.6 - i * 0.12)) * (1 - off);
      if (p <= 0) return;
      const good = g.sf >= 0.5, col = good ? C.green : C.blue;
      inPoster(POS, k => {
        ctx.save(); ctx.translate(g.cx, g.cy); ctx.rotate(g.rot); ctx.globalAlpha *= p;
        const pad = 8, w = g.w + pad * 2, h = g.h + pad * 2;
        ctx.strokeStyle = col; ctx.lineWidth = 3 * k; ctx.strokeRect(-w / 2, -h / 2, w, h);
        for (const [hx, hy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillStyle = '#fff'; ctx.fillRect(hx * w / 2 - 6 * k, hy * h / 2 - 6 * k, 12 * k, 12 * k); ctx.strokeRect(hx * w / 2 - 6 * k, hy * h / 2 - 6 * k, 12 * k, 12 * k); }
        ctx.restore();
      });
      // label chip written in that font, at the box's top-left corner
      const s = toScreen(POS, g.x - 8, g.y - 8);
      const name = FNAME[g.fam];
      ctx.save(); ctx.globalAlpha *= p;
      ctx.font = `${FWT[g.fam]} ${g.fam === 'bebas' ? 30 : g.fam === 'pac' ? 21 : 24}px ${FAM[g.fam]}`; ctx.letterSpacing = '0px';
      const tw = ctx.measureText(name).width;
      rr(s.x, s.y - 40, tw + 24, 38, 8); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(name, s.x + 12, s.y - 20 + (g.fam === 'pac' ? -2 : 1));
      ctx.restore();
    });
    // zone: the font inventory
    const fams = ['inter', 'bebas', 'pac', 'comic', 'play'], keep = { inter: 1, play: 1 };
    const fx = E.inOutCubic(P(t, b + 3.0, b + 3.9));
    const Z = 1485;
    fams.forEach((f, i) => {
      const p = E.outBack(P(t, b + 0.6 + i * 0.1, b + 0.95 + i * 0.1)) * (1 - E.inCubic(off));
      if (p <= 0) return;
      const drop = keep[f] ? 0 : E.inCubic(P(t, b + 2.85 + i * 0.05, b + 3.35 + i * 0.05));
      const ki = f === 'play' ? 0 : 1;
      const x0 = 540 + (i - 2) * 190, x1 = 540 + (ki - 0.5) * 200;
      const x = keep[f] ? lerp(x0, x1, fx) : x0, y = Z + drop * 160;
      const cross_ = P(t, b + 2.3 + i * 0.05, b + 2.6 + i * 0.05);
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.rotate(drop * (i % 2 ? 0.5 : -0.5)); ctx.globalAlpha *= 1 - drop;
      shadow(0.1, 24, 8); rr(-82, -70, 164, 140, 22); ctx.fillStyle = '#fff'; ctx.fill(); noShadow();
      if (keep[f] && fx > 0.5) { ctx.lineWidth = 4; ctx.strokeStyle = C.green; rr(-82, -70, 164, 140, 22); ctx.stroke(); }
      ctx.font = `${FWT[f]} ${f === 'bebas' ? 72 : f === 'pac' ? 48 : 60}px ${FAM[f]}`; ctx.letterSpacing = '0px'; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Aa', 0, 16);
      ctx.font = font(600, 19); ctx.fillStyle = C.ink2; ctx.fillText(FNAME[f], 0, 52);
      if (!keep[f]) { ctx.save(); ctx.globalAlpha *= 0.9; cross(0, -10, 70, C.red, 9, cross_); ctx.restore(); }
      ctx.restore();
    });
    counter(t, `${fx > 0.5 ? 2 : 5} font`, b, fx, Z + 110);
  }
  function counter(t, text, b, fx, y) {
    const p = E.outCubic(P(t, b + 1.1, b + 1.5)) * (1 - P(t, b + 5.0, b + 5.3));
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha *= p; ctx.font = font(800, 32); ctx.letterSpacing = '0px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const flash = Math.sin(clamp((fx - 0.4) / 0.3) * Math.PI);
    ctx.translate(540, y); ctx.scale(1 + flash * 0.15, 1 + flash * 0.15);
    ctx.fillStyle = fx > 0.5 ? C.green : C.red; ctx.fillText(text, 0, 0); ctx.restore();
  }

  // --- overlay 2: colours — eyedropper pulls swatches out, they merge into three ---
  const SW = [
    { c: '#FFE600', from: [70, 60], to: 0 }, { c: '#FF5FA2', from: [700, 930], to: 0 }, { c: '#E8141C', from: 'tag', to: 2 },
    { c: '#D81BD2', from: 'badge', to: 1 }, { c: '#7CFF00', from: [566, 600], to: 2 }, { c: '#1440FF', from: 'title', to: 1 },
    { c: '#7B2CBF', from: 'sub', to: 1 }, { c: '#FF7A00', from: 'date', to: 2 }, { c: '#00C2FF', from: 'cta', to: 2 },
  ];
  const GOOD3 = [PC.cream, PC.navy, PC.coral];
  function ovColors(t, POS, st) {
    const b = T.causes[1], off = P(t, b + 5.0, b + 5.35);
    if (t < b + 0.3 || off >= 1) return;
    const G = geom({ ...st, c: 0 }), Z = 1470;
    const mg = E.inOutCubic(P(t, b + 2.85, b + 3.7));
    SW.forEach((s, i) => {
      const fl = E.inOutCubic(P(t, b + 0.4 + i * 0.1, b + 1.0 + i * 0.1));
      if (fl <= 0) return;
      let lx, ly;
      if (Array.isArray(s.from)) [lx, ly] = s.from;
      else if (s.from === 'badge') { lx = BADGE.cx[0]; ly = BADGE.cy[0]; }
      else { const g = G.find(g => g.id === s.from); lx = g.cx; ly = g.cy; }
      const src = toScreen(POS, lx, ly);
      const rowX = 540 + (i - 4) * 104, gx = 540 + (s.to - 1) * 190;
      const tx = lerp(rowX, gx, mg), ty = Z;
      // arc from poster to row
      const x = lerp(src.x, tx, fl), y = lerp(src.y, ty, fl) - Math.sin(fl * Math.PI) * 120;
      const r = lerp(14, 40, E.outBack(fl)) * lerp(1, 1.5, mg) * (1 - E.inCubic(off));
      const col = mix(s.c, GOOD3[s.to], mg);
      if (fl < 1) { // eyedropper ring at the source
        const ring = Math.sin(fl * Math.PI);
        ctx.save(); ctx.globalAlpha *= ring; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(src.x, src.y, 34, 0, TAU); ctx.stroke();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(src.x, src.y, 38, 0, TAU); ctx.stroke(); ctx.restore();
      }
      ctx.save(); shadow(0.14, 16, 5); circle(x, y, r, col); noShadow();
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.stroke(); ctx.restore();
    });
    // hex labels under the merged three
    const lp = E.outCubic(P(t, b + 3.6, b + 4.0)) * (1 - off);
    if (lp > 0) GOOD3.forEach((c, k) => {
      ctx.save(); ctx.globalAlpha *= lp; ctx.font = font(600, 20); ctx.letterSpacing = '1px'; ctx.fillStyle = C.ink2; ctx.textAlign = 'center';
      ctx.fillText(c, 540 + (k - 1) * 190, Z + 92); ctx.restore();
    });
    counter(t, `${mg > 0.5 ? 3 : 9} warna`, b, mg, Z + (mg > 0.5 ? 140 : 90));
  }

  // --- overlay 3: alignment — scattered left edges snap onto one guide ---
  function ovAlign(t, POS, st) {
    const b = T.causes[2], on = P(t, b + 0.4, b + 0.9), off = P(t, b + 5.0, b + 5.35);
    if (on <= 0 || off >= 1) return;
    const G = geom(st), sa = st.a;
    inPoster(POS, k => {
      G.forEach((g, i) => {
        const p = E.outCubic(clamp(on * 1.5 - i * 0.1)) * (1 - off);
        if (p <= 0) return;
        const snapped = stag(sa, i, TEXTS.length) >= 1;
        // left edge of the (rotated) box
        ctx.save(); ctx.translate(g.cx, g.cy); ctx.rotate(g.rot);
        const x = -g.w / 2, h = g.h + 30;
        ctx.setLineDash([10 * k, 8 * k]); ctx.lineWidth = 3.5 * k; ctx.strokeStyle = snapped ? C.blue : C.red; ctx.globalAlpha *= p * (snapped ? 0.0 : 1);
        ctx.beginPath(); ctx.moveTo(x, -h / 2 * p); ctx.lineTo(x, h / 2 * p); ctx.stroke(); ctx.setLineDash([]);
        circle(x, -h / 2 * p, 6 * k, C.red); circle(x, h / 2 * p, 6 * k, C.red);
        ctx.restore();
      });
      // the single guide
      const gp = E.inOutCubic(P(t, b + 2.55, b + 3.0)) * (1 - off);
      if (gp > 0) {
        ctx.save(); ctx.globalAlpha *= 0.95;
        line(M, PH / 2 - PH / 2 * gp - 30, M, PH / 2 + PH / 2 * gp + 30, C.blue, 4 * k);
        // snap flashes
        G.forEach((g, i) => {
          const sp = stag(sa, i, TEXTS.length), fl = clamp((sp - 0.85) / 0.15) * (1 - P(sp >= 1 ? t : 0, b + FIX0 + FIXD * 0.6 + i * 0.12, b + FIX0 + FIXD * 0.6 + i * 0.12 + 0.5));
          if (sp > 0.85) { circle(M, g.y + g.h / 2, 12 * k * (1 + fl * 0.6), C.blue); circle(M, g.y + g.h / 2, 5 * k, '#fff'); }
        });
        ctx.restore();
      }
    });
    // zone: align-left icon — bars snap to one edge
    const Z = 1480, p = E.outBack(P(t, b + 0.6, b + 1.0)) * (1 - E.inCubic(off));
    if (p > 0) {
      ctx.save(); ctx.translate(540, Z); ctx.scale(p, p);
      shadow(0.1, 24, 8); rr(-230, -86, 460, 172, 26); ctx.fillStyle = '#fff'; ctx.fill(); noShadow();
      const snap = E.outBack(P(t, b + 3.0, b + 3.6));
      const bars = [[260, 60], [180, -40], [300, 25], [140, 85], [220, -70]];
      bars.forEach(([w, off_], i) => {
        const x = lerp(-150 + off_, -180, snap), y = -60 + i * 30;
        rr(x, y - 8, w * 0.95, 16, 8); ctx.fillStyle = snap > 0.5 ? C.ink : C.mute; ctx.fill();
      });
      ctx.globalAlpha *= clamp(snap * 2); line(-196, -76, -196, 76, C.blue, 5);
      ctx.restore();
    }
    counter(t, `${sa > 0.5 ? 1 : 5} garis`, b, sa, Z + 130);
  }

  // --- overlay 4: hierarchy — size chips on each element + a size bar chart ---
  function ovHier(t, POS, st) {
    const b = T.causes[3], on = P(t, b + 0.4, b + 0.9), off = P(t, b + 5.0, b + 5.35);
    if (on <= 0 || off >= 1) return;
    const G = geom(st), sh = st.h;
    const order = { title: 1, sub: 2, date: 3, cta: 4, tag: 5 };
    G.forEach((g, i) => {
      const p = E.outBack(clamp(on * 1.5 - i * 0.1)) * (1 - E.inCubic(off));
      if (p <= 0) return;
      const s = toScreen(POS, g.x + g.w, g.y + g.h / 2);
      const fixed = stag(sh, i, TEXTS.length, 0.12) > 0.5;
      const txt = `${Math.round(g.size)}px`;
      ctx.save(); ctx.translate(Math.min(s.x + 40, W - 90), s.y); ctx.scale(p, p);
      ctx.font = font(700, 22); ctx.letterSpacing = '0px';
      const tw = ctx.measureText(txt).width;
      rr(-tw / 2 - 14, -20, tw + 28, 40, 20); ctx.fillStyle = fixed ? (g.id === 'title' ? C.blue : C.ink) : C.red; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 1);
      ctx.restore();
    });
    // zone: bars — equal loudness → clear steps
    const Z = 1560, p = E.outBack(P(t, b + 0.6, b + 1.0)) * (1 - E.inCubic(off));
    if (p > 0) {
      ctx.save(); ctx.translate(540, Z); ctx.scale(p, p);
      shadow(0.1, 24, 8); rr(-300, -200, 600, 236, 26); ctx.fillStyle = '#fff'; ctx.fill(); noShadow();
      const items = [['Judul', 'title'], ['Sub', 'sub'], ['Info', 'date'], ['Tombol', 'cta']];
      items.forEach(([lab, id], i) => {
        const g = G.find(g => g.id === id);
        const hgt = g.size * 1.4, x = -225 + i * 150;
        rr(x - 40, -hgt - 20 + 0, 80, hgt, 12); ctx.fillStyle = sh > 0.5 && id === 'title' ? C.blue : sh > 0.5 ? C.ink : C.mute; ctx.fill();
        ctx.font = font(600, 21); ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(lab, x, 20);
      });
      ctx.restore();
    }
    // reading order numbers after the fix
    G.forEach(g => {
      const n = order[g.id]; if (!n || n > 3) return;
      const p = E.outBack(P(t, b + 4.0 + n * 0.15, b + 4.35 + n * 0.15)) * (1 - E.inCubic(off));
      if (p <= 0) return;
      const s = toScreen(POS, g.x, g.y);
      ctx.save(); ctx.translate(s.x - 30, s.y + 6); ctx.scale(p, p); shadow(0.2, 10, 4); circle(0, 0, 22, C.blue); noShadow();
      ctx.font = font(800, 24); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 0, 1); ctx.restore();
    });
  }

  // =====================================================================
  // 4. RESULT: before / after slider (32.0 – 35.8)
  // =====================================================================
  function sliderU(t) {
    const r = T.result;
    if (t < r + 0.5) return 0;
    if (t < r + 1.3) return E.inOutCubic(P(t, r + 0.5, r + 1.3));
    if (t < r + 1.6) return 1;
    if (t < r + 2.2) return lerp(1, 0.5, E.inOutCubic(P(t, r + 1.6, r + 2.2)));
    if (t < r + 2.9) return 0.5;
    return lerp(0.5, 0, E.inOutCubic(P(t, r + 2.9, r + 3.4)));
  }
  function sResultOverlay(t, POS) {
    const r = T.result;
    pill('HASIL AKHIR', 540, 262, t, r + 0.05, { bg: C.green, dot: '#fff', out: T.end - 0.1 });
    kLine('Sebelum vs sesudah', 540, 390, t, r + 0.12, { size: 80, out: T.end - 0.1, hl: { 2: C.blue } });
    const u = sliderU(t), vis = P(t, r + 0.35, r + 0.55) * (1 - P(t, r + 3.35, r + 3.55));
    if (vis > 0) {
      const lx = u * PW, a = toScreen(POS, lx, -10), bt = toScreen(POS, lx, PH + 10);
      ctx.save(); ctx.globalAlpha *= vis; shadow(0.3, 12, 0); line(a.x, a.y, bt.x, bt.y, '#fff', 6); noShadow();
      const my = (a.y + bt.y) / 2; shadow(0.25, 16, 4); circle(a.x, my, 34, '#fff'); noShadow();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(a.x - 8, my - 10); ctx.lineTo(a.x - 17, my); ctx.lineTo(a.x - 8, my + 10);
      ctx.moveTo(a.x + 8, my - 10); ctx.lineTo(a.x + 17, my); ctx.lineTo(a.x + 8, my + 10); ctx.stroke();
      ctx.restore();
    }
    const lp = E.outBack(P(t, r + 2.0, r + 2.35)) * (1 - E.inCubic(P(t, r + 2.9, r + 3.15)));
    if (lp > 0) {
      const tl = toScreen(POS, 0, 0), trr = toScreen(POS, PW, 0);
      [[tl.x + 110, 'SEBELUM', C.red], [trr.x - 110, 'SESUDAH', C.green]].forEach(([x, s, c]) => {
        ctx.save(); ctx.translate(x, tl.y + 44); ctx.scale(lp, lp); ctx.font = font(800, 22); ctx.letterSpacing = '3px';
        const w = ctx.measureText(s).width + 36; rr(-w / 2, -21, w, 42, 21); ctx.fillStyle = c; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 1.5, 1); ctx.restore();
      });
    }
    // shine + approval stamp
    const sh = P(t, r + 3.35, r + 3.85);
    if (sh > 0 && sh < 1) inPoster(POS, () => {
      ctx.save(); rr(0, 0, PW, PH, 22); ctx.clip();
      const x = lerp(-300, PW + 300, E.inOutCubic(sh));
      const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.translate(x, PH / 2); ctx.rotate(0.3); ctx.translate(-x, -PH / 2); ctx.fillRect(x - 120, -400, 240, PH + 800); ctx.restore();
    });
    const sp = E.outBack(P(t, r + 3.45, r + 3.8)) * (1 - E.inCubic(P(t, T.end, T.end + 0.3)));
    if (sp > 0) {
      const s = toScreen(POS, PW, PH);
      ctx.save(); ctx.translate(s.x - 10, s.y - 10); ctx.scale(sp, sp); ctx.rotate(-0.12); shadow(0.25, 20, 6); circle(0, 0, 58, C.green); noShadow();
      tick(0, 0, 58, '#fff', 10, P(t, r + 3.55, r + 3.85)); ctx.restore();
    }
    // closing chips in the zone
    ['2 font', '3 warna', '1 garis', 'Jelas'].forEach((s, i) => {
      const p = E.outBack(P(t, r + 0.6 + i * 0.1, r + 0.95 + i * 0.1)) * (1 - E.inCubic(P(t, T.end, T.end + 0.3)));
      if (p <= 0) return;
      const x = 540 + (i - 1.5) * 210, y = 1520;
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p); shadow(0.08, 18, 6); rr(-95, -34, 190, 68, 34); ctx.fillStyle = '#fff'; ctx.fill(); noShadow();
      circle(-60, 0, 16, C.greenL); tick(-60, 0, 20, C.green, 4, 1);
      ctx.font = font(700, 25); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, -36, 2); ctx.restore();
    });
  }

  // =====================================================================
  // 5. ENDING (35.8 – 40)
  // =====================================================================
  function sEnd(t) {
    const s = T.end + 0.4;
    kLine('Desain yang baik', 540, 690, t, s, { size: 104 });
    kLine('bukan yang paling', 540, 810, t, s + 0.55, { size: 60, weight: 600, color: C.ink2, spacing: -1, stagger: 0.06 });
    const calm = 0;
    const cw = chaosWord('ramai,', 540, 950, 118, t, s + 0.85, { calm, gray: E.inOutCubic(P(t, s + 1.55, s + 1.9)), seed: 5 });
    const st = E.inOutCubic(P(t, s + 1.4, s + 1.75));
    if (st > 0) line(540 - cw / 2 - 16, 918, 540 - cw / 2 - 16 + (cw + 32) * st, 918, C.red, 10);
    kLine('tapi yang paling', 540, 1085, t, s + 1.75, { size: 60, weight: 600, color: C.ink2, spacing: -1, stagger: 0.06 });
    // highlighter behind the key phrase
    ctx.save(); ctx.font = font(800, 108); ctx.letterSpacing = '-4px';
    const kw = ctx.measureText('mudah dipahami.').width; ctx.restore();
    const hp = E.inOutCubic(P(t, s + 2.55, s + 2.95));
    if (hp > 0) { rr(540 - kw / 2 - 18, 1170, (kw + 36) * hp, 64, 14); ctx.fillStyle = C.blueL; ctx.fill(); }
    kLine('mudah dipahami.', 540, 1230, t, s + 2.15, { size: 108, color: C.blue, stagger: 0.1 });
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px'; noShadow();
    background(t);
    if (t < 4.45) sHook(t);
    if (t >= T.reveal && t < T.end + 0.6) {
      const POS = posterPos(t), st = state(t);
      if (t >= T.result && t < T.end) {
        const u = sliderU(t);
        if (u > 0) drawPoster(POS, { f: 0, c: 0, a: 0, h: 0 }, { t, clip: [0, u * PW] });
        drawPoster(POS, st, { t, clip: [u * PW, PW], noShadow: u > 0 });
        if (u > 0) { ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.translate(POS.x, POS.y); ctx.scale(POS.s, POS.s); shadow(0.16, 70, 30); rr(-PW / 2, -PH / 2, PW, PH, 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
      } else drawPoster(POS, st, { t, appear: t < 7 ? appear(t) : null });
      if (t < T.causes[0]) sReveal(t);
      if (t >= T.causes[0] - 0.1 && t < T.result) {
        captions(t);
        ovFonts(t, POS, st); ovColors(t, POS, st); ovAlign(t, POS, st); ovHier(t, POS, st);
      }
      if (t >= T.result) sResultOverlay(t, POS);
      tracker(t);
    }
    if (t >= T.end) sEnd(t);
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
