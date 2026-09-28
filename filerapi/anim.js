/* "File tugasmu masih begini?" — 40s educational motion piece, 1080x1920.
 * Every frame is a pure function of time: render(t). */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    bg: '#F3F4F7', bg2: '#E8EBF1', card: '#FFFFFF', ink: '#111827', ink2: '#4B5563', mute: '#9CA3AF', line: '#E5E7EB',
    chaos: '#FF5A36', tidy: '#12B76A', sel: '#3B82F6', folder: '#F5B83D', folderD: '#E19E1B',
    doc: '#3B82F6', pdf: '#EF4444', img: '#A855F7', xls: '#16A34A', zip: '#6B7280',
  };
  const SANS = '"Manrope", sans-serif', MONO = '"JBMono", monospace';

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

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    document.fonts.load(`800 40px ${SANS}`), document.fonts.load(`700 40px ${SANS}`), document.fonts.load(`500 40px ${SANS}`),
    document.fonts.load(`500 40px ${MONO}`), document.fonts.load(`700 40px ${MONO}`),
  ]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  const sans = (w, s) => `${w} ${s}px ${SANS}`, mono = (w, s) => `${w} ${s}px ${MONO}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function shadow(a = 0.12, blur = 40, oy = 16) { ctx.shadowColor = `rgba(17,24,39,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy; }
  function noShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function panel(x, y, w, h, r, fill = C.card, a = 0.1) { ctx.save(); shadow(a, 44, 18); rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
  function drawCheck(x, y, s, c, w, p = 1) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }

  // Kinetic line: words slide up from a mask, quick & snappy.
  function kLine(text, x, y, t, t0, o = {}) {
    const size = o.size || 90, weight = o.weight || 800, stagger = o.stagger ?? 0.06, dur = o.dur || 0.55;
    ctx.save();
    ctx.font = o.mono ? mono(weight, size) : sans(weight, size);
    ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.035)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' '), sp = ctx.measureText(' ').width;
    const ws = words.map(w => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let cx = o.align === 'left' ? x : x - total / 2;
    const pos = [];
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, pin = E.outExpo(P(t, a, a + dur));
      const pout = o.out != null ? E.inCubic(P(t, o.out + i * stagger * 0.4, o.out + i * stagger * 0.4 + 0.3)) : 0;
      pos.push([cx, ws[i]]);
      if (pin > 0 && pout < 1) {
        ctx.save(); ctx.beginPath(); ctx.rect(cx - size, y - size * 1.05, ws[i] + size * 2, size * 1.4); ctx.clip();
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.ink;
        ctx.fillText(words[i], cx, y + (1 - pin) * size * 1.15 - pout * size * 1.15);
        ctx.restore();
      }
      cx += ws[i] + sp;
    }
    ctx.restore();
    return { total, pos };
  }
  function pillTag(text, x, y, t, t0, o = {}) {
    const p = E.outBack(P(t, t0, t0 + 0.4)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.25)) : 0;
    if (p <= 0 || out >= 1) return;
    ctx.save(); ctx.font = mono(700, 30); ctx.letterSpacing = '2px';
    const tw = ctx.measureText(text).width, h = 60, w = tw + 56;
    ctx.translate(x, y); ctx.scale(p, p); ctx.globalAlpha *= clamp(p) * (1 - out);
    rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = o.bg || C.ink; ctx.fill();
    ctx.fillStyle = o.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 2, 2); ctx.restore();
  }

  // ---------- file / folder glyphs ----------
  const TYPE = { docx: C.doc, pdf: C.pdf, jpg: C.img, xlsx: C.xls, zip: C.zip };
  function fileIcon(x, y, s, kind = 'docx', o = {}) {
    // (x, y) centre; s = height
    const w = s * 0.78, h = s, f = s * 0.26;
    ctx.save(); ctx.translate(x, y);
    if (o.shadow !== false) shadow(0.12, 16, 6);
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + 8); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 8, -h / 2);
    ctx.lineTo(w / 2 - f, -h / 2); ctx.lineTo(w / 2, -h / 2 + f); ctx.lineTo(w / 2, h / 2 - 8); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 8, h / 2);
    ctx.lineTo(-w / 2 + 8, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 8); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); noShadow();
    ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.5, s * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - f, -h / 2); ctx.lineTo(w / 2 - f, -h / 2 + f); ctx.lineTo(w / 2, -h / 2 + f); ctx.fillStyle = C.line; ctx.fill();
    const c = TYPE[kind] || C.doc;
    rr(-w / 2 - s * 0.06, s * 0.08, w * 0.78, s * 0.24, s * 0.05); ctx.fillStyle = c; ctx.fill();
    ctx.font = mono(700, s * 0.14); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(kind.toUpperCase().slice(0, 4), -w / 2 - s * 0.02, s * 0.205);
    for (let i = 0; i < 3; i++) { rr(-w / 2 + s * 0.12, -h / 2 + s * (0.2 + i * 0.1), w * (i === 2 ? 0.4 : 0.62), s * 0.04, s * 0.02); ctx.fillStyle = '#E5E7EB'; ctx.fill(); }
    ctx.restore();
  }
  function folderIcon(x, y, s, color = C.folder, o = {}) {
    const w = s * 1.25, h = s;
    ctx.save(); ctx.translate(x, y);
    if (o.shadow !== false) shadow(0.12, 16, 6);
    rr(-w / 2, -h / 2, w * 0.45, h * 0.3, s * 0.08); ctx.fillStyle = o.back || shade(color, -0.12); ctx.fill();
    rr(-w / 2, -h / 2 + h * 0.14, w, h * 0.86, s * 0.1); ctx.fillStyle = o.back || shade(color, -0.12); ctx.fill(); noShadow();
    const open = o.open || 0;
    ctx.save(); ctx.transform(1, 0, -0.25 * open, 1 - 0.12 * open, 0, h * 0.05 * open);
    rr(-w / 2, -h / 2 + h * 0.26, w, h * 0.74, s * 0.1); ctx.fillStyle = color; ctx.fill(); ctx.restore();
    ctx.restore();
  }
  function shade(hex, k) {
    const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).map(c => Math.round(clamp(k < 0 ? c * (1 + k) : c + (255 - c) * k, 0, 255)));
    return `rgb(${v.join(',')})`;
  }
  function kindOf(name) { const m = name.match(/\.(\w+)$/); return m ? m[1] : 'folder'; }
  function magnifier(x, y, s, c, w) { ctx.beginPath(); ctx.arc(x - s * 0.08, y - s * 0.08, s * 0.3, 0, TAU); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); line(x + s * 0.14, y + s * 0.14, x + s * 0.38, y + s * 0.38, c, w); }
  function pencil(x, y, s, c, w) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
    rr(-s * 0.1, -s * 0.42, s * 0.2, s * 0.6, s * 0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.18); ctx.lineTo(0, s * 0.4); ctx.lineTo(s * 0.1, s * 0.18); ctx.stroke(); ctx.restore();
  }
  function plane(x, y, s, c, w) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.02); ctx.lineTo(s * 0.4, -s * 0.34); ctx.lineTo(s * 0.12, s * 0.38); ctx.lineTo(-s * 0.02, s * 0.08); ctx.closePath(); ctx.stroke();
    line(-s * 0.02, s * 0.08, s * 0.4, -s * 0.34, c, w); ctx.restore();
  }

  // ---------- atmosphere & overlays ----------
  function background(t, tint = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, tint > 0 ? mix('#F3F4F7', '#EEF8F2', tint) : C.bg); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(17,24,39,0.05)';
    const s = 54, oy = (t * 10) % s;
    for (let y = -s + oy; y < H; y += s) for (let x = s / 2; x < W; x += s) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
  }
  function mix(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
  }
  function finish(t) {
    // logo, unmodified, as a small watermark (top-right)
    const wa = P(t, 0.6, 1.3) * 0.9;
    if (wa > 0) {
      const s = 76, x = W - 62 - s, y = 150;
      ctx.save(); ctx.globalAlpha = wa; shadow(0.18, 18, 6);
      rr(x, y, s, s, 18); ctx.fillStyle = '#004FC6'; ctx.fill(); noShadow();
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.clip(); ctx.drawImage(logo, x, y, s, s); ctx.restore();
    }
    const f = 1 - P(t, 0, 0.25) + P(t, 39.6, 40);
    if (f > 0) { ctx.fillStyle = `rgba(243,244,247,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }

  // =====================================================================
  // 1. HOOK — renaming spiral  (0 – 7)
  // =====================================================================
  const NAMES = [['FINAL', 0.35], ['FINAL FIX', 1.55], ['FINAL FIX BANGET', 2.75], ['FINAL FIX TERBARU', 4.05]];
  const BS = 0.035, TY = 0.055; // backspace / type speed per char
  function stemAt(t) {
    let text = '', typing = false;
    for (let k = 0; k < NAMES.length; k++) {
      const [name, s] = NAMES[k];
      if (t < s) break;
      const prev = k ? NAMES[k - 1][0] : '';
      let pre = 0; while (pre < prev.length && pre < name.length && prev[pre] === name[pre]) pre++;
      const del = prev.length - pre, add = name.length - pre;
      const lt = t - s;
      if (lt < del * BS) { text = prev.slice(0, prev.length - Math.floor(lt / BS)); typing = true; }
      else if (lt < del * BS + add * TY) { text = name.slice(0, pre + Math.floor((lt - del * BS) / TY) + 1); typing = true; }
      else { text = name; typing = false; }
    }
    return { text, typing };
  }
  const CARD = { x: 540, y: 1180, w: 940, h: 250 };
  function fileCard(x, y, s, name, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.rot || 0);
    ctx.globalAlpha *= o.a ?? 1;
    panel(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 40, '#fff', o.shadowA ?? 0.1);
    fileIcon(-CARD.w / 2 + 110, 0, 150, 'docx', { shadow: false });
    ctx.font = mono(700, 50); ctx.letterSpacing = '-1px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const x0 = -CARD.w / 2 + 215;
    const tw = ctx.measureText(name).width;
    if (o.select) { rr(x0 - 6, -38, tw + 12, 76, 10); ctx.fillStyle = 'rgba(59,130,246,0.22)'; ctx.fill(); }
    ctx.fillStyle = o.color || C.ink; ctx.fillText(name, x0, 2);
    const ext = '.docx';
    ctx.fillStyle = C.mute; ctx.fillText(ext, x0 + tw, 2);
    if (o.caret) { rr(x0 + tw + 1, -34, 5, 68, 2); ctx.fillStyle = C.sel; ctx.fill(); }
    if (o.edited) { ctx.font = sans(700, 26); ctx.letterSpacing = '0px'; ctx.fillStyle = C.mute; ctx.fillText(o.edited, x0, 70); }
    ctx.restore();
  }
  function sHook(t) {
    background(t);
    const ex = E.inOutExpo(P(t, 6.35, 7.05));
    ctx.save();
    ctx.translate(540, CARD.y); ctx.scale(1 - ex * 0.75, 1 - ex * 0.75); ctx.translate(-540, -CARD.y);
    ctx.globalAlpha = 1 - P(t, 6.8, 7.05);
    // older versions pile up behind as ghost copies
    for (let k = NAMES.length - 1; k >= 1; k--) {
      const [, s] = NAMES[k];
      if (t < s) continue;
      const age = NAMES.filter(([, s2]) => s2 <= t).length - k; // 1 = newest ghost
      const p = E.outBack(P(t, s, s + 0.45));
      const dy = -age * 165 * p, sc = 1 - age * 0.06 * p, rot = (k % 2 ? -1 : 1) * 0.035 * age * p;
      fileCard(540 + (k % 2 ? -1 : 1) * age * 16 * p, CARD.y + dy, sc, NAMES[k - 1][0], { rot, a: 1 - age * 0.18, color: C.ink2, shadowA: 0.06 });
    }
    const pin = E.outBack(P(t, 0.05, 0.45));
    const { text, typing } = stemAt(t);
    const blink = typing || Math.floor(t * 2.4) % 2 === 0;
    const bumpS = 1 + 0.03 * Math.max(...NAMES.map(([, s]) => bump(t, s, s + 0.25)));
    fileCard(540, CARD.y, pin * bumpS, text, { caret: blink && t < 6.3, edited: t > 0.4 ? `v${Math.max(1, NAMES.filter(([, s]) => s <= t).length)} · baru saja diubah` : '' });
    ctx.restore();

    // question (after the last rename)
    ctx.save(); ctx.globalAlpha = 1 - P(t, 6.5, 6.9);
    kLine('File tugasmu', 540, 380, t, 5.15, { size: 88 });
    const q = kLine('masih begini?', 540, 510, t, 5.35, { size: 110, hl: { 1: C.chaos } });
    const up = E.inOutCubic(P(t, 5.8, 6.15));
    if (up > 0) {
      const [bx, bw] = q.pos[1];
      ctx.beginPath();
      for (let i = 0; i <= 40 * up; i++) { const u = i / 40; ctx.lineTo(bx + bw * u, 542 + Math.sin(u * 18) * 6); }
      ctx.strokeStyle = C.chaos; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
    ctx.restore();
  }

  // =====================================================================
  // 2. MESSY FOLDER  (7 – 14)
  // =====================================================================
  const MESS = [
    'FINAL FIX TERBARU.docx', 'final.docx', 'final2.docx', 'revisi baru.docx', 'Untitled (3).docx', 'IMG_2031.jpg',
    'fix banget.pdf', 'copy of copy.docx', 'tugas REAL.docx', 'New Folder (4)', 'data fix.xlsx', 'final (1).docx',
    'scan0012.pdf', 'asdf.docx', 'pakai ini.docx', 'baru.zip', 'final rev.pdf', 'Screenshot 3.jpg', 'data2 (2).xlsx',
    'FINAL!!.docx', 'New Folder', 'draft lama.docx', 'yg bener.docx', 'final_final.pdf', 'dok1.docx', 'IMG_2032.jpg',
    'revisi (5).docx', 'tabel.xlsx',
  ];
  const WIN = { x: 60, y: 420, w: 960, h: 1180 };
  const MESS_IN = i => 7.25 + i * 0.1;
  function messPos(i) {
    const cols = 4, cw = 222, ch = 205;
    const c = i % cols, r = Math.floor(i / cols);
    return {
      x: WIN.x + 120 + c * cw + (rnd(i) - 0.5) * 70,
      y: WIN.y + 290 + r * ch * 0.62 + (rnd(i + 40) - 0.5) * 60,
      rot: (rnd(i + 80) - 0.5) * 0.5,
    };
  }
  function fileTile(x, y, name, s = 1, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s); ctx.globalAlpha *= o.a ?? 1;
    const k = kindOf(name);
    if (o.hit) { rr(-92, -88, 184, 190, 22); ctx.fillStyle = 'rgba(255,90,54,0.12)'; ctx.fill(); ctx.strokeStyle = C.chaos; ctx.lineWidth = 4; ctx.stroke(); }
    if (k === 'folder') folderIcon(0, -20, 92); else fileIcon(0, -22, 110, k);
    ctx.font = mono(500, 21); ctx.letterSpacing = '-0.5px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink2;
    let lab = name; while (ctx.measureText(lab).width > 176 && lab.length > 4) lab = lab.slice(0, -2);
    if (lab !== name) lab = lab.slice(0, -1) + '…';
    ctx.fillText(lab, 0, 70);
    ctx.restore();
  }
  function sMess(t) {
    background(t);
    const zin = E.inExpo(P(t, 13.35, 14.0));
    const pop = E.outBack(P(t, 6.9, 7.4));
    const shake = bump(t, 12.6, 13.3) * 8;
    ctx.save();
    ctx.translate(540 + Math.sin(t * 70) * shake, 1010); ctx.scale(pop * (1 + zin * 0.6), pop * (1 + zin * 0.6)); ctx.translate(-540, -1010 - zin * 900);
    ctx.globalAlpha = 1 - zin;
    // window chrome
    panel(WIN.x, WIN.y, WIN.w, WIN.h, 40, '#fff', 0.12);
    ctx.save(); ctx.beginPath(); ctx.roundRect(WIN.x, WIN.y, WIN.w, WIN.h, 40); ctx.clip();
    ctx.fillStyle = '#F8F9FB'; ctx.fillRect(WIN.x, WIN.y, WIN.w, 100);
    line(WIN.x, WIN.y + 100, WIN.x + WIN.w, WIN.y + 100, C.line, 2);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => circle(WIN.x + 50 + i * 36, WIN.y + 50, 12, c));
    folderIcon(WIN.x + 200, WIN.y + 50, 34, C.folder, { shadow: false });
    ctx.font = sans(800, 34); ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.fillText('Tugas', WIN.x + 236, WIN.y + 52);
    // item counter
    const shown = MESS.filter((_, i) => t >= MESS_IN(i)).length;
    const count = Math.round(lerp(0, 47, P(t, 7.25, MESS_IN(MESS.length - 1) + 0.2)));
    ctx.font = mono(700, 28); ctx.textAlign = 'right'; ctx.fillStyle = count > 30 ? C.chaos : C.mute;
    ctx.fillText(`${count} item`, WIN.x + WIN.w - 40, WIN.y + 52); ctx.textAlign = 'left';
    // search bar
    rr(WIN.x + 40, WIN.y + 130, WIN.w - 80, 84, 42); ctx.fillStyle = '#F1F3F6'; ctx.fill();
    magnifier(WIN.x + 94, WIN.y + 172, 40, C.mute, 5);
    const q = 'final', qn = Math.floor(clamp((t - 10.55) / 0.09, 0, q.length));
    ctx.font = mono(500, 34); ctx.fillStyle = qn ? C.ink : C.mute;
    ctx.fillText(qn ? q.slice(0, qn) : 'Cari file…', WIN.x + 140, WIN.y + 174);
    if (qn && t < 11.4 && Math.floor(t * 4) % 2 === 0) { const w = ctx.measureText(q.slice(0, qn)).width; rr(WIN.x + 142 + w, WIN.y + 150, 4, 46, 2); ctx.fillStyle = C.sel; ctx.fill(); }
    const searching = P(t, 11.1, 11.35);
    const hits = MESS.filter(n => /final/i.test(n)).length;
    if (searching > 0) {
      const p = E.outBack(searching);
      ctx.save(); ctx.translate(WIN.x + WIN.w - 150, WIN.y + 172); ctx.scale(p, p);
      rr(-100, -28, 200, 56, 28); ctx.fillStyle = C.chaos; ctx.fill();
      ctx.font = mono(700, 28); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${hits} hasil`, 0, 2); ctx.restore();
    }
    // the mess
    MESS.forEach((name, i) => {
      const t0 = MESS_IN(i), p = E.outBack(P(t, t0, t0 + 0.35));
      if (p <= 0) return;
      const m = messPos(i);
      const hit = searching > 0 && /final/i.test(name);
      const jig = hit ? Math.sin(t * 30 + i) * 2 * bump(t, 11.2, 12.4) : 0;
      fileTile(m.x + jig + (1 - p) * (rnd(i + 5) - 0.5) * 400, m.y - (1 - p) * 300, name, 0.92 * p, { rot: m.rot, hit, a: searching > 0 && !hit ? lerp(1, 0.3, searching) : 1 });
    });
    ctx.restore();
    ctx.restore();
    // headline
    ctx.save(); ctx.globalAlpha = 1 - zin;
    kLine('Makin banyak,', 540, 250, t, 8.0, { size: 76, weight: 700, color: C.ink2 });
    kLine('makin susah dicari.', 540, 356, t, 8.3, { size: 86, hl: { 2: C.chaos } });
    ctx.restore();
  }

  // =====================================================================
  // 3. PROBLEMS  (14 – 26)
  // =====================================================================
  const PROBS = [
    { tag: 'MASALAH 01', a: 'Nama file', b: 'tidak jelas', t0: 14.0, draw: pNames },
    { tag: 'MASALAH 02', a: 'Terlalu banyak', b: 'versi', t0: 18.0, draw: pVersions },
    { tag: 'MASALAH 03', a: 'Folder tidak', b: 'terorganisir', t0: 22.0, draw: pFolders },
  ];
  const GLYPH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz0123456789#?_';
  function scramble(target, p, seed) {
    // p: 0 -> random chars, 1 -> target
    let s = '';
    for (let i = 0; i < target.length; i++) {
      const settle = i / target.length * 0.7;
      if (p >= settle + 0.3 || target[i] === '.' || target[i] === ' ') s += target[i];
      else s += GLYPH[Math.floor(rnd(seed * 31 + i * 7 + Math.floor(p * 40)) * GLYPH.length)];
    }
    return s;
  }
  function pNames(t, lt) {
    const rows = ['asdf.docx', 'Untitled (7).docx', 'baru baru.docx', 'tugas???.docx', 'dokumen1 (copy).docx'];
    rows.forEach((name, i) => {
      const t0 = 0.3 + i * 0.12, p = E.outCubic(P(lt, t0, t0 + 0.4));
      if (p <= 0) return;
      const y = 800 + i * 150;
      ctx.save(); ctx.translate((1 - p) * 300, 0); ctx.globalAlpha *= p;
      panel(110, y - 58, 860, 116, 28, '#fff', 0.07);
      fileIcon(185, y, 76, 'docx', { shadow: false });
      const sp = P(lt, t0 + 0.2, t0 + 1.3);
      ctx.font = mono(700, 40); ctx.letterSpacing = '-1px'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
      ctx.fillText(scramble(name, sp, i), 250, y + 2);
      // "?" badge wobbles once settled
      const qb = E.outBack(P(lt, t0 + 1.35, t0 + 1.65));
      if (qb > 0) {
        ctx.save(); ctx.translate(905, y); ctx.rotate(Math.sin(t * 6 + i) * 0.15); ctx.scale(qb, qb);
        circle(0, 0, 30, C.chaos); ctx.font = sans(800, 38); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('?', 0, 3); ctx.restore();
      }
      ctx.restore();
    });
  }
  function pVersions(t, lt) {
    const labels = ['final', 'final2', 'final_rev', 'final fix', 'FINAL!!', 'final (1)', 'pakai ini', 'yg bener'];
    const n = labels.length, cx = 540, cy = 1380;
    labels.forEach((lab, i) => {
      const p = E.outBack(P(lt, 0.3 + i * 0.13, 0.75 + i * 0.13));
      if (p <= 0) return;
      const ang = lerp(-0.62, 0.62, i / (n - 1)) * p;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(0, -360); ctx.scale(1.25, 1.25);
      ctx.save(); shadow(0.12, 22, 8); rr(-110, -150, 220, 290, 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      rr(-110, -150, 220, 290, 22); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 5; k++) { rr(-80, -100 + k * 34, k === 4 ? 80 : 160, 12, 6); ctx.fillStyle = '#E5E7EB'; ctx.fill(); }
      rr(-80, 80, 160, 40, 10); ctx.fillStyle = i === n - 1 ? C.chaos : '#F1F3F6'; ctx.fill();
      ctx.font = mono(700, 22); ctx.fillStyle = i === n - 1 ? '#fff' : C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, 0, 101);
      ctx.restore();
    });
    // counter
    const c = Math.round(lerp(1, n, P(lt, 0.3, 0.3 + (n - 1) * 0.13 + 0.3)));
    const cp = E.outBack(P(lt, 0.3, 0.6));
    ctx.save(); ctx.translate(540, 1500); ctx.scale(cp, cp);
    ctx.font = sans(800, 96); ctx.letterSpacing = '-3px'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.chaos;
    ctx.fillText(`${c} versi`, 0, 30); ctx.restore();
    ctx.font = sans(700, 34); ctx.fillStyle = C.ink2; ctx.textAlign = 'center';
    ctx.globalAlpha *= P(lt, 1.7, 2.0); ctx.fillText('yang mana yang benar?', 540, 1590); ctx.globalAlpha = 1;
  }
  function pFolders(t, lt) {
    const nodes = [
      ['Tugas', 540, 760], ['New Folder', 250, 930], ['Baru', 820, 900], ['New Folder (2)', 380, 1110], ['Download', 780, 1090],
      ['lama', 200, 1290], ['Tugas (2)', 620, 1270], ['fix', 880, 1320], ['New Folder (3)', 420, 1470],
    ];
    const edges = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [2, 7], [6, 8], [5, 6], [1, 4], [3, 7]];
    edges.forEach(([a, b], i) => {
      const p = E.inOutCubic(P(lt, 0.3 + i * 0.1, 0.9 + i * 0.1));
      if (p <= 0) return;
      const [, ax, ay] = nodes[a], [, bx, by] = nodes[b];
      const mx = (ax + bx) / 2 + (rnd(i + 3) - 0.5) * 300, my = (ay + by) / 2 + (rnd(i + 9) - 0.5) * 160;
      ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay);
      for (let k = 1; k <= 30 * p; k++) { const u = k / 30, v = 1 - u; ctx.lineTo(v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by); }
      ctx.strokeStyle = 'rgba(17,24,39,0.22)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.stroke(); ctx.restore();
    });
    nodes.forEach(([name, x, y], i) => {
      const p = E.outBack(P(lt, 0.2 + i * 0.12, 0.55 + i * 0.12));
      if (p <= 0) return;
      const jx = Math.sin(t * 5 + i * 2) * 4, jy = Math.cos(t * 4 + i) * 4;
      ctx.save(); ctx.translate(x + jx, y + jy); ctx.scale(p, p); ctx.rotate((rnd(i + 30) - 0.5) * 0.2);
      folderIcon(0, -14, 84);
      ctx.font = mono(700, 22); ctx.textAlign = 'center'; ctx.fillStyle = C.ink2; ctx.fillText(name, 0, 60);
      ctx.restore();
    });
    // the one file you need — lost somewhere
    const lp = E.outBack(P(lt, 1.8, 2.1));
    if (lp > 0) {
      const x = 900, y = 1520;
      ctx.save(); ctx.translate(x, y); ctx.scale(lp, lp); fileIcon(0, 0, 90, 'docx');
      ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 6); circle(0, 0, 70 + Math.sin(t * 6) * 6, 'rgba(255,90,54,0.15)'); ctx.restore();
    }
  }
  function sProblems(t) {
    background(t);
    PROBS.forEach((pr, i) => {
      const inP = i === 0 ? E.outCubic(P(t, 13.8, 14.3)) : E.inOutExpo(P(t, pr.t0 - 0.3, pr.t0 + 0.3));
      const nx = PROBS[i + 1];
      const outP = nx ? E.inOutExpo(P(t, nx.t0 - 0.3, nx.t0 + 0.3)) : E.inOutExpo(P(t, 25.7, 26.3));
      if (inP <= 0 || outP >= 1) return;
      const y = i === 0 ? (1 - inP) * 400 : (1 - inP) * H - outP * H;
      const yy = i === 0 ? y - outP * H : y;
      const lt = t - pr.t0 + (i === 0 ? 0 : 0.3);
      ctx.save(); ctx.translate(0, yy); ctx.globalAlpha = i === 0 ? clamp(inP * 2) : 1;
      pillTag(pr.tag, 540, 300, t, pr.t0 - (i === 0 ? 0 : 0.1), { bg: C.chaos });
      kLine(pr.a, 540, 450, t, pr.t0 + 0.05, { size: 84, weight: 700, color: C.ink2 });
      kLine(pr.b, 540, 560, t, pr.t0 + 0.2, { size: 100 });
      pr.draw(t, Math.max(0, lt));
      ctx.restore();
    });
  }

  // =====================================================================
  // 4. TRANSFORMATION — the tidy system  (26 – 34)
  // =====================================================================
  const TIDY = [
    { name: '01_NamaProyek', color: '#6366F1' },
    { name: '02_Data', color: '#0EA5E9' },
    { name: '03_Draft', color: '#F59E0B' },
    { name: '04_Final', color: C.tidy },
  ];
  const ROW = { x: 110, w: 860, h: 150, y0: 760, gap: 200 };
  const rowY = i => ROW.y0 + i * ROW.gap;
  const ROW_IN = i => 26.75 + i * 0.28;
  // files that get sorted: [name, target row]
  const SORT = [
    ['brief.pdf', 0], ['data fix.xlsx', 1], ['IMG_2031.jpg', 1], ['tabel.xlsx', 1], ['draft lama.docx', 2],
    ['revisi (5).docx', 2], ['final2.docx', 2], ['asdf.docx', 2], ['FINAL FIX TERBARU.docx', 3],
  ];
  const SORT_T = i => 28.45 + i * 0.28;
  function sTidy(t) {
    const tint = P(t, 26.3, 27.5);
    background(t, tint);
    const out = E.inOutExpo(P(t, 33.35, 34.05));
    ctx.save(); ctx.translate(0, -out * 380); ctx.globalAlpha = 1 - out;
    pillTag('SOLUSI', 540, 300, t, 26.35, { bg: C.tidy });
    kLine('Rapikan jadi', 540, 450, t, 26.5, { size: 84, weight: 700, color: C.ink2 });
    kLine('satu sistem.', 540, 560, t, 26.7, { size: 100, hl: { 1: C.tidy } });
    // connector arrows between rows
    for (let i = 0; i < 3; i++) {
      const p = E.inOutCubic(P(t, ROW_IN(i + 1) + 0.1, ROW_IN(i + 1) + 0.4));
      if (p <= 0) continue;
      const x = ROW.x + 90, y1 = rowY(i) + ROW.h / 2 - 6, y2 = rowY(i + 1) - ROW.h / 2 + 6;
      line(x, y1, x, lerp(y1, y2, p), C.mute, 4);
      if (p > 0.95) { ctx.beginPath(); ctx.moveTo(x - 10, y2 - 12); ctx.lineTo(x, y2); ctx.lineTo(x + 10, y2 - 12); ctx.strokeStyle = C.mute; ctx.lineWidth = 4; ctx.stroke(); }
    }
    // rows
    TIDY.forEach((f, i) => {
      const p = E.outBack(P(t, ROW_IN(i), ROW_IN(i) + 0.45));
      if (p <= 0) return;
      const y = rowY(i);
      const n = SORT.filter(([, r], k) => r === i && t >= SORT_T(k) + 0.32).length;
      const last = SORT.map(([, r], k) => (r === i ? SORT_T(k) + 0.32 : -9)).filter(v => v <= t);
      const pulse = last.length ? bump(t, Math.max(...last), Math.max(...last) + 0.22) : 0;
      const done = E.outBack(P(t, 31.4 + i * 0.16, 31.75 + i * 0.16));
      ctx.save(); ctx.translate((1 - p) * 700, y); ctx.scale(1 + pulse * 0.03, 1 + pulse * 0.03);
      ctx.save(); shadow(0.08 + pulse * 0.08, 30, 12); rr(ROW.x, -ROW.h / 2, ROW.w, ROW.h, 34); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      rr(ROW.x, -ROW.h / 2, 12, ROW.h, [34, 0, 0, 34]); ctx.fillStyle = f.color; ctx.fill();
      folderIcon(ROW.x + 90, 0, 72, f.color, { open: pulse, shadow: false });
      ctx.font = mono(700, 46); ctx.letterSpacing = '-1px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
      ctx.fillText(f.name, ROW.x + 160, 2);
      // file count
      if (n > 0) {
        ctx.font = mono(700, 28); ctx.letterSpacing = '0px'; ctx.textAlign = 'right'; ctx.fillStyle = C.mute;
        ctx.fillText(`${n} file`, ROW.x + ROW.w - (done > 0 ? 110 : 40), 2);
      }
      if (done > 0) { ctx.save(); ctx.translate(ROW.x + ROW.w - 56, 0); ctx.scale(done, done); circle(0, 0, 30, C.tidy); drawCheck(0, 0, 34, '#fff', 6, P(t, 31.5 + i * 0.16, 31.8 + i * 0.16)); ctx.restore(); }
      ctx.restore();
    });
    // flying files: start scattered (the old mess), arc into their folder
    SORT.forEach(([name, r], k) => {
      const t0 = SORT_T(k), p = P(t, t0, t0 + 0.34);
      const appear = E.outBack(P(t, 27.9 + k * 0.04, 28.2 + k * 0.04));
      if (appear <= 0 || p >= 1) return;
      const sx = 120 + rnd(k + 11) * 840, sy = k % 2 ? 1620 + rnd(k) * 120 : 660 + rnd(k + 2) * 60;
      const sy2 = sy < 1000 ? 1650 + rnd(k) * 100 : sy;
      const tx = ROW.x + 90, ty = rowY(r);
      const e = E.inOutCubic(p);
      const x = lerp(sx, tx, e), y = lerp(sy2, ty, e) - Math.sin(e * Math.PI) * 180;
      const idle = Math.sin(t * 3 + k) * 6 * (1 - e);
      fileTile(x, y + idle, name, lerp(1.05, 0.25, e) * appear, { rot: (rnd(k + 60) - 0.5) * 0.6 * (1 - e) });
    });
    ctx.restore();
  }

  // =====================================================================
  // 5. ENDING  (34 – 40)
  // =====================================================================
  function sEnd(t) {
    background(t, 1);
    kLine('File rapi =', 540, 560, t, 34.15, { size: 112, hl: { 2: C.tidy } });
    kLine('lebih gampang', 540, 690, t, 34.55, { size: 72, weight: 700, color: C.ink2 });
    const items = [
      ['dicari,', magnifier, 35.0], ['diedit,', pencil, 35.45], ['dan dikirim.', plane, 35.9],
    ];
    items.forEach(([word, icon, t0], i) => {
      const y = 880 + i * 160;
      const p = E.outBack(P(t, t0, t0 + 0.45));
      if (p <= 0) return;
      ctx.save(); ctx.font = sans(800, 92); ctx.letterSpacing = '-3px';
      const tw = ctx.measureText(word).width, bw = 120 + 28 + tw, x0 = 540 - bw / 2;
      ctx.restore();
      ctx.save(); ctx.translate(x0 + 60, y - 30); ctx.scale(p, p);
      ctx.save(); shadow(0.12, 20, 8); rr(-60, -60, 120, 120, 34); ctx.fillStyle = i === 2 ? C.tidy : '#fff'; ctx.fill(); ctx.restore();
      icon(0, 0, 70, i === 2 ? '#fff' : C.ink, 7);
      ctx.restore();
      kLine(word, x0 + 148, y + 4, t, t0 + 0.08, { size: 92, align: 'left', stagger: 0.05, hl: i === 2 ? { 1: C.tidy } : {} });
    });
    // closing small line
    const cp = E.outCubic(P(t, 37.6, 38.1));
    if (cp > 0) {
      ctx.save(); ctx.globalAlpha = cp;
      line(540 - 60 * cp, 1330, 540 + 60 * cp, 1330, C.line, 4);
      ctx.restore();
      kLine('Rapikan sebelum makin banyak.', 540, 1410, t, 37.75, { size: 42, weight: 700, color: C.ink2, stagger: 0.04, spacing: 0 });
    }
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.letterSpacing = '0px'; noShadow();
    if (t < 6.9) sHook(t);
    else if (t < 7.05) { sHook(t); sMessNoBg(t); }
    else if (t < 13.8) sMess(t);
    else if (t < 14.0) { sMess(t); sProblemsNoBg(t); }
    else if (t < 25.7) sProblems(t);
    else if (t < 26.3) { sTidy(t); sProblemsNoBg(t); }
    else if (t < 34.05) sTidy(t);
    else sEnd(t);
    // hand-off: ending text enters over the tidy scene's exit
    if (t >= 33.7 && t < 34.05) { ctx.globalAlpha = P(t, 33.7, 34.05); sEndNoBg(t); ctx.globalAlpha = 1; }
    finish(t);
    ctx.restore();
  }
  const noBg = fn => t => { const b = background; background = () => {}; try { fn(t); } finally { background = b; } };
  const sMessNoBg = noBg(sMess), sProblemsNoBg = noBg(sProblems), sEndNoBg = noBg(sEnd);

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
