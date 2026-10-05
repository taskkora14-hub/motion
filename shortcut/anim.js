/* "5 shortcut yang jarang kamu tahu." — 40s, 1080x1920, clean animated tutorial.
 * A big keyboard (pressed keys glow amber), a screen window above it showing what the
 * shortcut does, and a small guide mascot (mintask, blue jacket) in the corner.
 * Every frame is a pure function of time; shared timing lives in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, TAU = Math.PI * 2;
  const TL = window.SC_TL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueHi: '#2F63C4', blueLo: '#123A80', navy: '#0E1A44', navy2: '#16265C',
    white: '#FFFFFF', bg: '#EEF3FC', bg2: '#DCE6F8', line: '#C9D6F2', amber: '#FFB627', amberHi: '#FFD27A', amberLo: '#E09A10',
    skin: '#FFD3B0', grey: '#8C9AC0', sky: '#9CC0FF', green: '#3DBE7A',
  };
  const FONT = '"Jakarta", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const ready = Promise.all([document.fonts.load(`800 60px ${FONT}`), document.fonts.load(`700 60px ${FONT}`), document.fonts.load(`500 60px ${FONT}`)]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); };
  function fill(c) { ctx.fillStyle = c; ctx.fill(); }
  function stroke(c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function line(pts, w, c) { ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]); stroke(c, w); }
  function text(str, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 700} ${size}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.01)) + 'px';
    const w = ctx.measureText(str).width, max = o.maxW || 960;
    ctx.translate(x, y); if (w > max) ctx.scale(max / w, max / w);
    if (o.scale != null) ctx.scale(o.scale, o.scale);
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.fillStyle = color; ctx.fillText(str, 0, 0);
    ctx.restore();
    return Math.min(w, max);
  }
  function shadowed(fn, blur = 30, y = 12, a = 0.18) {
    ctx.save(); ctx.shadowColor = `rgba(14,26,68,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; fn(); ctx.restore();
  }
  function cursor(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 40); ctx.lineTo(10, 30); ctx.lineTo(18, 46); ctx.lineTo(25, 43); ctx.lineTo(17, 27); ctx.lineTo(30, 27); ctx.closePath();
    fill(C.white); stroke(C.navy, 3.5); ctx.restore();
  }

  // =====================================================================
  // KEYBOARD
  const KB = { x: 60, y: 1150, u: 64, gap: 8 };
  const ROWS = [
    [['`', 1], ...'1234567890'.split('').map(c => [c, 1]), ['-', 1], ['=', 1], ['backspace', 2]],
    [['tab', 1.5], ...'qwertyuiop'.split('').map(c => [c, 1]), ['[', 1], [']', 1], ['\\', 1.5]],
    [['caps', 1.75], ...'asdfghjkl'.split('').map(c => [c, 1]), [';', 1], ["'", 1], ['enter', 2.25]],
    [['shift', 2.25, 'shift_l'], ...'zxcvbnm'.split('').map(c => [c, 1]), [',', 1], ['.', 1], ['/', 1], ['shift', 2.75, 'shift_r']],
    [['ctrl', 1.5, 'ctrl_l'], ['win', 1.25, 'win_l'], ['alt', 1.25, 'alt_l'], ['', 6, 'space'], ['alt', 1.25, 'alt_r'], ['win', 1.25, 'win_r'], ['menu', 1.25], ['ctrl', 1.25, 'ctrl_r']],
  ];
  const KEYS = {};
  ROWS.forEach((row, r) => {
    let x = KB.x;
    row.forEach(([label, w, id]) => {
      const k = { label, x: x + KB.gap / 2, y: KB.y + r * (KB.u + 8), w: w * KB.u - KB.gap, h: KB.u, id: id || label };
      KEYS[k.id] = k; x += w * KB.u;
      (KEYS.__list = KEYS.__list || []).push(k);
    });
  });

  function pressedAmount(id, t) {
    let a = 0;
    if (TL.HOOK.keys.includes(id) && t < TL.HOOK.release) a = 1;
    for (const k of TL.tricks) {
      k.keys.forEach((kid, j) => { if (kid === id && t >= k.down[j] && t < k.release) a = 1; });
      if (id === 'tab' && k.extra.length) k.extra.forEach(e => { if (t >= e && t < e + 0.14) a = 1; });
    }
    return a;
  }
  function litAmount(id, t) { // stays warm for a moment after release
    let a = pressedAmount(id, t);
    for (const k of TL.tricks) if (k.keys.includes(id) && t >= k.release) a = Math.max(a, 1 - P(t, k.release, k.release + 0.5));
    if (TL.HOOK.keys.includes(id) && t >= TL.HOOK.release) a = Math.max(a, 1 - P(t, TL.HOOK.release, TL.HOOK.release + 0.5));
    return a;
  }

  function keyboard(t, o = {}) {
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    shadowed(() => { rr(KB.x - 26, KB.y - 26, 15 * KB.u + 52, 5 * (KB.u + 8) + 44, 34); fill(C.navy); }, 40, 18, 0.3);
    for (const k of KEYS.__list) {
      const p = pressedAmount(k.id, t), lit = litAmount(k.id, t);
      const dy = p * 6;
      // key skirt
      rr(k.x, k.y + 6, k.w, k.h - 2, 12); fill(lit > 0 ? C.amberLo : '#B9C6E4');
      // key top
      ctx.save();
      if (lit > 0) { ctx.shadowColor = `rgba(255,182,39,${0.9 * lit})`; ctx.shadowBlur = 40 * lit; }
      rr(k.x, k.y + dy, k.w, k.h - 6, 12); fill(lit > 0 ? (lit > 0.5 ? C.amber : '#FFE2A3') : C.white);
      ctx.restore();
      if (lit === 0) { rr(k.x + 4, k.y + 4 + dy, k.w - 8, 10, 6); fill('rgba(255,255,255,0.0)'); }
      if (k.label) {
        const big = k.label.length === 1;
        text(k.label, k.x + k.w / 2, k.y + dy + (k.h - 6) / 2 + 1, big ? 30 : 21, lit > 0.5 ? C.navy : '#3A4A7A', { weight: lit > 0.5 ? 800 : 700, maxW: k.w - 10 });
      }
    }
    ctx.restore();
  }
  const keyCenter = id => { const k = KEYS[id]; return [k.x + k.w / 2, k.y + k.h / 2]; };

  // =====================================================================
  // SCREEN WINDOW
  const SC = { x: 100, y: 500, w: 880, h: 540 };
  function monitor(t, content) {
    shadowed(() => { rr(SC.x - 22, SC.y - 22, SC.w + 44, SC.h + 44, 30); fill(C.navy); }, 40, 16, 0.28);
    rr(SC.x + SC.w / 2 - 70, SC.y + SC.h + 22, 140, 36, 6); fill(C.navy2);
    ctx.save(); rr(SC.x, SC.y, SC.w, SC.h, 12); ctx.clip();
    const g = ctx.createLinearGradient(0, SC.y, 0, SC.y + SC.h); g.addColorStop(0, '#D8E4FA'); g.addColorStop(1, '#BCD0F4');
    ctx.fillStyle = g; ctx.fillRect(SC.x, SC.y, SC.w, SC.h);
    content();
    // taskbar
    ctx.fillStyle = 'rgba(14,26,68,0.88)'; ctx.fillRect(SC.x, SC.y + SC.h - 40, SC.w, 40);
    for (let i = 0; i < 5; i++) { rr(SC.x + SC.w / 2 - 120 + i * 50, SC.y + SC.h - 32, 32, 24, 6); fill(i === 0 ? C.sky : 'rgba(255,255,255,0.35)'); }
    text('09.41', SC.x + SC.w - 50, SC.y + SC.h - 20, 18, C.white, { weight: 500 });
    ctx.restore();
  }
  function appWindow(x, y, w, h, title, o = {}) {
    shadowed(() => { rr(x, y, w, h, 12); fill(C.white); }, 24, 10, 0.2);
    ctx.save(); rr(x, y, w, h, 12); ctx.clip();
    ctx.fillStyle = o.bar || C.blue; ctx.fillRect(x, y, w, 40);
    text(title, x + 20, y + 21, 19, C.white, { align: 'left', weight: 700 });
    for (let i = 0; i < 3; i++) { ell(x + w - 24 - i * 26, y + 20, 7, 7); fill(i === 0 ? '#FF7A7A' : 'rgba(255,255,255,0.6)'); }
    ctx.restore();
  }
  function lines(x, y, w, n, gap = 26, col = C.line, seed = 0) {
    for (let i = 0; i < n; i++) { rr(x, y + i * gap, w * (0.55 + 0.45 * rnd(seed + i)), 12, 6); fill(col); }
  }

  // ---------- trick contents ----------
  const SCREENS = [
    // 1 — ctrl + shift + t
    (t, k) => {
      const lt = t - k.s, x = SC.x + 20, y = SC.y + 20, w = SC.w - 40, h = SC.h - 80;
      shadowed(() => { rr(x, y, w, h, 12); fill(C.white); }, 24, 10, 0.2);
      ctx.save(); rr(x, y, w, h, 12); ctx.clip();
      ctx.fillStyle = C.bg2; ctx.fillRect(x, y, w, 56);
      const closed = lt >= 0.8 && t < k.result;
      const back = t >= k.result;
      const tabs = [['materi kuliah', 0], ['jurnal.pdf', 1], ['kalkulator', 2]];
      let tx = x + 14;
      tabs.forEach(([name, i]) => {
        let tw = 230, sc = 1;
        if (i === 0) {
          if (closed) return;
          if (back) sc = E.outBack(P(t, k.result, k.result + 0.35));
          if (lt > 0.55 && lt < 0.8) sc = 1 - P(lt, 0.55, 0.8);
        }
        const active = (i === 0 && (back || lt < 0.55)) || (i === 1 && closed);
        ctx.save(); ctx.translate(tx + tw / 2, y + 32); ctx.scale(sc, sc);
        rr(-tw / 2, -22, tw, 46, 10); fill(active ? C.white : '#C9D6F2');
        text(name, -tw / 2 + 18, 0, 19, C.navy, { align: 'left', weight: 700 });
        text('×', tw / 2 - 22, -1, 24, C.grey, { weight: 700 });
        ctx.restore();
        tx += tw * sc + 8;
      });
      // address bar + page
      rr(x + 16, y + 66, w - 32, 36, 18); fill(C.bg);
      const page = closed ? 'jurnal.pdf' : 'materi kuliah';
      text(closed ? 'jurnal-ilmiah.pdf' : 'kampus.ac.id/materi/pekan-5', x + 40, y + 84, 17, C.grey, { align: 'left', weight: 500 });
      text(page, x + 40, y + 150, 34, C.blue, { align: 'left', weight: 800 });
      lines(x + 40, y + 190, 560, 6, 30, C.line, closed ? 10 : 0);
      if (!closed) { rr(x + 620, y + 140, 180, 170, 12); fill(C.bg2); text('slide 5', x + 710, y + 225, 22, C.blue); }
      if (back) { const p = 1 - P(t, k.result + 0.3, k.result + 1.4); rr(x, y, w, h, 12); ctx.lineWidth = 8; ctx.strokeStyle = `rgba(255,182,39,${p})`; ctx.stroke(); }
      ctx.restore();
      // cursor closes the tab
      if (lt < 1.0) { const cx = lerp(x + 420, x + 222, E.inOut(P(lt, 0.0, 0.5))), cy = lerp(y + 230, y + 30, E.inOut(P(lt, 0.0, 0.5))); cursor(cx, cy); }
    },
    // 2 — win + v
    (t, k) => {
      appWindow(SC.x + 30, SC.y + 30, 560, 430, 'catatan.txt');
      lines(SC.x + 60, SC.y + 100, 460, 4, 32, C.line, 20);
      const pasted = t >= k.s + 3.2;
      if (pasted) { const p = E.outCubic(P(t, k.s + 3.2, k.s + 3.5)); rr(SC.x + 56, SC.y + 236, 400 * p, 34, 8); fill('rgba(255,182,39,0.35)'); text('link zoom kelas jam 9', SC.x + 64, SC.y + 253, 20, C.navy, { align: 'left', weight: 700, alpha: p }); }
      if (t >= k.result) {
        const p = E.outBack(P(t, k.result, k.result + 0.4));
        const px = SC.x + SC.w - 400, py = SC.y + SC.h - 40 - 420 * p;
        shadowed(() => { rr(px, py, 370, 400, 16); fill(C.white); }, 30, 12, 0.3);
        text('riwayat clipboard', px + 22, py + 34, 22, C.navy, { align: 'left', weight: 800 });
        const items = ['NIM: 2201 0034 77', 'link zoom kelas jam 9', 'daftar pustaka (apa)…'];
        const sel = t >= k.s + 2.6 ? 1 : -1;
        items.forEach((it, i) => {
          const iy = py + 70 + i * 104;
          rr(px + 16, iy, 338, 90, 12); fill(i === sel ? '#FFF1D2' : C.bg);
          if (i === sel) { rr(px + 16, iy, 338, 90, 12); stroke(C.amber, 4); }
          text(it, px + 34, iy + 32, 19, C.navy, { align: 'left', weight: 700, maxW: 300 });
          rr(px + 34, iy + 56, 180, 10, 5); fill(C.line);
        });
        if (t >= k.s + 2.2 && t < k.s + 3.2) cursor(lerp(px + 300, px + 200, P(t, k.s + 2.2, k.s + 2.6)), py + 230);
      }
    },
    // 3 — win + shift + s
    (t, k) => snipScreen(t, k.result, k.s),
    // 4 — ctrl + shift + v
    (t, k) => {
      const lt = t - k.s;
      // source (web)
      appWindow(SC.x + 24, SC.y + 24, 400, 330, 'browser', { bar: '#2B3E80' });
      ctx.save(); ctx.font = `800 italic 34px Georgia, serif`; ctx.fillStyle = '#E2463C'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      if (lt > 0.3) { rr(SC.x + 44, SC.y + 92, 360 * E.outCubic(P(lt, 0.3, 0.7)), 96, 6); fill('rgba(156,192,255,0.55)'); }
      ctx.fillStyle = '#E2463C'; ctx.fillText('deadline: jumat', SC.x + 52, SC.y + 120);
      ctx.font = `800 26px Georgia, serif`; ctx.fillStyle = '#8A2BE2'; ctx.fillText('pukul 23.59 wib', SC.x + 52, SC.y + 164);
      ctx.restore();
      lines(SC.x + 52, SC.y + 214, 330, 4, 28, C.line, 40);
      if (lt > 0.5 && lt < 1.0) text('ctrl + c', SC.x + 224, SC.y + 320, 20, C.blue, { weight: 800 });
      // destination doc
      appWindow(SC.x + 450, SC.y + 24, 406, 430, 'tugas.docx');
      lines(SC.x + 476, SC.y + 92, 340, 3, 30, C.line, 50);
      if (t >= k.result) {
        const p = E.outCubic(P(t, k.result, k.result + 0.3));
        rr(SC.x + 470, SC.y + 184, 360, 64, 8); fill(`rgba(255,182,39,${0.3 * p})`);
        text('deadline: jumat pukul 23.59 wib', SC.x + 478, SC.y + 216, 19, C.navy, { align: 'left', weight: 500, alpha: p, maxW: 350 });
        lines(SC.x + 476, SC.y + 270, 340, 3, 30, C.line, 60);
        const b = E.outBack(P(t, k.result + 0.5, k.result + 0.85));
        ctx.save(); ctx.translate(SC.x + 653, SC.y + 400); ctx.scale(b, b); rr(-140, -24, 280, 48, 24); fill(C.green); text('tanpa format ✓', 0, 1, 22, C.white, { weight: 800 }); ctx.restore();
      }
      text('berlaku di browser & banyak aplikasi', SC.x + 237, SC.y + 420, 17, C.navy, { weight: 700, maxW: 380, alpha: 0.75 });
    },
    // 5 — alt + tab
    (t, k) => {
      const done = t >= k.release;
      const NAMES = ['dokumen', 'browser', 'presentasi', 'spreadsheet'];
      if (!done) { appWindow(SC.x + 60, SC.y + 40, 760, 420, 'dokumen.docx'); lines(SC.x + 100, SC.y + 110, 620, 8, 34, C.line, 70); }
      else {
        const p = E.outBack(P(t, k.release, k.release + 0.35));
        ctx.save(); ctx.translate(SC.x + 440, SC.y + 250); ctx.scale(lerp(0.85, 1, p), lerp(0.85, 1, p)); ctx.translate(-(SC.x + 440), -(SC.y + 250));
        appWindow(SC.x + 60, SC.y + 40, 760, 420, 'nilai.xlsx', { bar: C.green });
        for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) { rr(SC.x + 80 + c * 120, SC.y + 100 + r * 48, 114, 42, 4); fill(r === 0 ? '#D7F2E4' : C.bg); }
        ctx.restore();
      }
      if (t >= k.result && !done) {
        const sel = 1 + k.extra.filter(e => t >= e).length;
        const p = E.outBack(P(t, k.result, k.result + 0.25));
        ctx.save(); ctx.translate(SC.x + SC.w / 2, SC.y + 240); ctx.scale(p, p);
        rr(-410, -130, 820, 250, 22); fill('rgba(14,26,68,0.85)');
        NAMES.forEach((n, i) => {
          const x = -390 + i * 198;
          if (i === sel) { rr(x - 6, -116, 186, 222, 16); stroke(C.amber, 6); }
          rr(x, -100, 174, 130, 10); fill(C.white);
          rr(x, -100, 174, 24, 10); fill([C.blue, '#2B3E80', C.amberLo, C.green][i]);
          for (let j = 0; j < 3; j++) { rr(x + 14, -60 + j * 22, 140 - j * 30, 10, 5); fill(C.line); }
          text(n, x + 87, 74, 21, C.white, { weight: 700 });
        });
        ctx.restore();
      }
    },
  ];
  function snipScreen(t, at, s0) {
    // desktop with a chart window; win+shift+s dims it and lets you drag a region
    appWindow(SC.x + 40, SC.y + 30, 800, 430, 'laporan-praktikum.pdf');
    text('grafik hasil', SC.x + 80, SC.y + 105, 26, C.blue, { align: 'left', weight: 800 });
    [120, 200, 160, 260, 220].forEach((h, i) => { rr(SC.x + 100 + i * 80, SC.y + 400 - h, 52, h, 6); fill(i === 3 ? C.amber : C.blue); });
    lines(SC.x + 560, SC.y + 140, 240, 7, 34, C.line, 90);
    if (t < at) return;
    const p = P(t, at, at + 0.15);
    ctx.fillStyle = `rgba(14,26,68,${0.5 * p})`; ctx.fillRect(SC.x, SC.y, SC.w, SC.h);
    // snip toolbar
    const tb = E.outBack(P(t, at, at + 0.3));
    ctx.save(); ctx.translate(SC.x + SC.w / 2, SC.y + 40); ctx.scale(tb, tb);
    rr(-150, -28, 300, 56, 14); fill(C.white);
    for (let i = 0; i < 4; i++) { rr(-130 + i * 66, -18, 50, 36, 8); fill(i === 0 ? '#FFE2A3' : C.bg); rr(-118 + i * 66, -8, 26, 16, 3); stroke(C.navy, 3); }
    ctx.restore();
    // selection drag
    const ds = at + 0.6, de = at + 1.5;
    if (t >= ds) {
      const q = E.inOut(P(t, ds, de));
      const x0 = SC.x + 90, y0 = SC.y + 120, x1 = lerp(x0, SC.x + 520, q), y1 = lerp(y0, SC.y + 420, q);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
      ctx.fillStyle = `rgba(255,255,255,${0.5 * p})`; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
      ctx.setLineDash([12, 8]); ctx.strokeStyle = C.amber; ctx.lineWidth = 4; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
      if (t < de + 0.1) { line([[x1 - 18, y1], [x1 + 18, y1]], 4, C.white); line([[x1, y1 - 18], [x1, y1 + 18]], 4, C.white); }
      if (t >= de + 0.1 && t < de + 0.3) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - P(t, de + 0.1, de + 0.3))})`; ctx.fillRect(SC.x, SC.y, SC.w, SC.h); }
      if (t >= de + 0.2) { // toast
        const tp = E.outBack(P(t, de + 0.2, de + 0.5));
        const tx = SC.x + SC.w - 360 + (1 - tp) * 380, ty = SC.y + SC.h - 170;
        shadowed(() => { rr(tx, ty, 340, 112, 14); fill(C.white); }, 24, 8, 0.3);
        rr(tx + 14, ty + 14, 110, 84, 6); fill(C.bg); [30, 50, 40, 64].forEach((h, i) => { rr(tx + 26 + i * 24, ty + 90 - h, 16, h, 3); fill(i === 3 ? C.amber : C.blue); });
        text('tangkapan layar', tx + 140, ty + 40, 19, C.navy, { align: 'left', weight: 800 });
        text('disalin ke clipboard', tx + 140, ty + 72, 17, C.grey, { align: 'left', weight: 500 });
      }
    }
  }

  // =====================================================================
  // MASCOT (mintask, blue jacket) — guide only
  function mascot(x, y, s, pose, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const bob = Math.sin(t * 3) * 3;
    ctx.translate(0, bob);
    // legs
    rr(-34, 70, 26, 70, 12); fill(C.navy); rr(8, 70, 26, 70, 12); fill(C.navy);
    rr(-42, 130, 40, 18, 9); fill(C.white); rr(4, 130, 40, 18, 9); fill(C.white);
    // jacket
    rr(-62, -20, 124, 110, 40); fill(C.blue);
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(0, 10); ctx.lineTo(14, -18); ctx.closePath(); fill(C.white);
    line([[0, 12], [0, 84]], 4, 'rgba(255,255,255,0.7)');
    // arms
    const armL = pose === 'thumbs' ? [[-56, 0], [-100, -40]] : [[-56, 0], [-80, 60]];
    const armR = pose === 'point' ? [[56, 0], [120, -26 + Math.sin(t * 6) * 6]] : pose === 'thumbs' ? [[56, 0], [100, -40]] : [[56, 0], [84, 60]];
    for (const a of [armL, armR]) { line(a, 30, C.blue); ell(a[1][0], a[1][1], 16, 16); fill(C.skin); }
    if (pose === 'thumbs') for (const a of [armL, armR]) { rr(a[1][0] - 7, a[1][1] - 40, 14, 30, 7); fill(C.skin); }
    if (pose === 'point') { rr(armR[1][0], armR[1][1] - 6, 30, 12, 6); fill(C.skin); }
    // head
    ell(0, -78, 58, 56); fill(C.skin);
    ctx.beginPath(); ctx.ellipse(0, -96, 62, 42, 0, Math.PI, 0); fill(C.navy);
    ell(6, -146, 24, 22); fill(C.navy);
    ell(-20, -74, 7, 9); fill(C.navy); ell(20, -74, 7, 9); fill(C.navy);
    ctx.beginPath(); ctx.arc(0, -58, 16, 0.15 * Math.PI, 0.85 * Math.PI); stroke(C.navy, 5);
    ell(-36, -56, 10, 6); fill('rgba(255,159,128,0.6)'); ell(36, -56, 10, 6); fill('rgba(255,159,128,0.6)');
    ctx.restore();
  }
  function tipBubble(x, y, str, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(lerp(0.8, 1, a), lerp(0.8, 1, a));
    ctx.font = `700 30px ${FONT}`; const w = ctx.measureText(str).width + 50;
    shadowed(() => { rr(0, -36, w, 72, 36); fill(C.white); ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(-22, 36); ctx.lineTo(34, 24); fill(C.white); }, 20, 6, 0.18);
    text(str, w / 2, 1, 30, C.navy, { weight: 700 });
    ctx.restore();
  }

  // =====================================================================
  // TITLES
  function keycapRow(combo, y, t, k) {
    ctx.font = `800 52px ${FONT}`;
    const widths = combo.map(c => Math.max(96, ctx.measureText(c).width + 56));
    const plusW = 64, total = widths.reduce((a, b) => a + b, 0) + plusW * (combo.length - 1);
    let x = 540 - total / 2;
    combo.forEach((c, j) => {
      const on = k ? (t >= k.down[j] && t < k.release + 0.5) : true;
      const pop = k ? E.outBack(P(t, k.s + 0.15 + j * 0.08, k.s + 0.45 + j * 0.08)) : 1;
      ctx.save(); ctx.translate(x + widths[j] / 2, y); ctx.scale(pop, pop);
      rr(-widths[j] / 2, -40 + 8, widths[j], 84, 18); fill(on ? C.amberLo : '#B9C6E4');
      rr(-widths[j] / 2, -40 + (on ? 6 : 0), widths[j], 78, 18); fill(on ? C.amber : C.white);
      text(c, 0, (on ? 6 : 0) - 1, 46, C.navy, { weight: 800 });
      ctx.restore();
      x += widths[j];
      if (j < combo.length - 1) { text('+', x + plusW / 2, y, 52, C.blue, { weight: 800, alpha: pop }); x += plusW; }
    });
  }
  function trickTitle(t, k) {
    const out = E.inCubic(P(t, k.out, k.s + 6));
    ctx.save(); ctx.globalAlpha = 1 - out;
    const a = E.outBack(P(t, k.s, k.s + 0.35));
    ctx.save(); ctx.translate(540, 150); ctx.scale(a, a);
    rr(-210, -32, 250, 64, 32); fill(C.blue); text(`trik ${k.i + 1}/5`, -85, 1, 30, C.white, { weight: 800 });
    rr(56, -32, 160, 64, 32); fill(C.white); text('windows', 136, 1, 26, C.blue, { weight: 800 });
    ctx.restore();
    keycapRow(k.combo, 262, t, k);
    const d = E.outCubic(P(t, k.s + 0.3, k.s + 0.7));
    text(k.desc, 540, 400 + (1 - d) * 16, 54, C.navy, { weight: 800, alpha: d });
    ctx.restore();
  }
  function saveBadge(t, k) {
    const a = E.outBack(P(t, k.save, k.save + 0.3)) * (1 - E.inCubic(P(t, k.out, k.s + 6)));
    if (a <= 0) return;
    ctx.save(); ctx.translate(SC.x + SC.w - 30, SC.y - 4); ctx.rotate(0.06); ctx.scale(a, a);
    shadowed(() => { rr(-250, -40, 270, 80, 40); fill(C.amber); }, 20, 8, 0.25);
    // bookmark icon
    ctx.beginPath(); ctx.moveTo(-222, -22); ctx.lineTo(-194, -22); ctx.lineTo(-194, 24); ctx.lineTo(-208, 12); ctx.lineTo(-222, 24); ctx.closePath(); fill(C.navy);
    text('simpan ini.', -82, 1, 36, C.navy, { weight: 800 });
    ctx.restore();
  }

  // =====================================================================
  function background(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#C9D6F2';
    for (let y = 60; y < H; y += 60) for (let x = 30; x < W; x += 60) ctx.fillRect(x, y, 3, 3);
    ctx.restore();
  }

  function hook(t) {
    // the screen snaps from a calm desktop into snip mode the instant the keys land
    monitor(t, () => snipScreen(t, 0.08, 0));
    keyboard(t);
    mascot(150, 1710, 0.9, 'point', t);
    // a hand slams win + shift + s with three fingers, then pulls back down out of frame
    const press = t < TL.HOOK.release;
    const lift = E.inCubic(P(t, TL.HOOK.release, TL.HOOK.release + 0.45));
    const ids = TL.HOOK.keys;
    const drop = lift * 900 + (press ? 0 : 10);
    const palm = [330, 1660 + drop];
    ctx.save();
    ids.forEach((id, j) => {
      const [kx, ky] = keyCenter(id);
      const tip = [kx + 4, ky + 12 + (t < 0.08 ? 10 : 4) + drop];
      const root = [palm[0] - 60 + j * 70, palm[1] - 40];
      line([root, tip], 70, '#E8B48E'); line([root, tip], 58, C.skin);
      ell(tip[0], tip[1] + 6, 20, 15); fill('#FFE9DA');
    });
    ctx.beginPath(); ctx.ellipse(palm[0], palm[1] + 60, 150, 120, -0.35, 0, TAU); fill('#E8B48E');
    ctx.beginPath(); ctx.ellipse(palm[0], palm[1] + 60, 140, 110, -0.35, 0, TAU); fill(C.skin);
    // thumb + sleeve
    line([[palm[0] + 110, palm[1] + 20], [palm[0] + 190, palm[1] - 50]], 66, '#E8B48E'); line([[palm[0] + 110, palm[1] + 20], [palm[0] + 190, palm[1] - 50]], 54, C.skin);
    ctx.beginPath(); ctx.ellipse(palm[0] + 40, palm[1] + 230, 190, 110, -0.35, 0, TAU); fill(C.blue);
    ctx.restore();
    // impact rings
    if (t < 0.6) ids.forEach(id => {
      const [kx, ky] = keyCenter(id), p = P(t, 0, 0.6);
      ctx.save(); ctx.globalAlpha = 1 - p; ell(kx, ky, 40 + 140 * p, 30 + 100 * p); stroke(C.amber, 10 * (1 - p) + 2); ctx.restore();
    });
    // hook text — on screen from frame 0
    const out = E.inCubic(P(t, TL.HOOK.textOut, 4.0));
    const s0 = (t < 0.1 ? 1.08 : 1) * (1 - out);
    if (s0 > 0) {
      text('5 shortcut yang', 540, 210, 104, C.navy, { weight: 800, scale: s0 });
      ctx.save(); ctx.translate(540, 345); ctx.scale(s0, s0);
      ctx.font = `800 104px ${FONT}`; const w = ctx.measureText('jarang kamu tahu.').width + 50;
      rr(-w / 2, -64, w, 128, 26); fill(C.amber);
      text('jarang kamu tahu.', 0, 4, 104, C.navy, { weight: 800 });
      ctx.restore();
    }
  }

  function trickScene(t, k) {
    const out = E.inCubic(P(t, k.out, k.s + 6)), inn = E.outCubic(P(t, k.s, k.s + 0.3));
    monitor(t, () => { ctx.save(); ctx.globalAlpha = inn * (1 - out); SCREENS[k.i](t, k); ctx.restore(); });
    keyboard(t);
    trickTitle(t, k);
    saveBadge(t, k);
    mascot(150, 1710, 0.9, t >= k.down[0] && t < k.release ? 'point' : 'idle', t);
    tipBubble(250, 1640, k.tip, E.outCubic(P(t, k.s + 0.5, k.s + 0.9)) * (1 - E.inCubic(P(t, k.out - 0.2, k.out + 0.2))));
  }

  function recap(t) {
    const R = TL.RECAP;
    monitor(t, () => {
      appWindow(SC.x + 60, SC.y + 26, SC.w - 120, SC.h - 90, 'rangkuman');
      TL.tricks.forEach((k, i) => {
        const a = E.outBack(P(t, R.in + 0.1 + i * 0.16, R.in + 0.4 + i * 0.16));
        if (a <= 0) return;
        const y = SC.y + 110 + i * 76;
        ctx.save(); ctx.translate(SC.x + 100, y); ctx.scale(a, a);
        ell(16, 0, 18, 18); fill(C.green); line([[8, 0], [14, 7], [25, -7]], 4, C.white);
        text(k.combo.join(' + '), 50, 0, 28, C.navy, { align: 'left', weight: 800 });
        text(k.desc, 360, 0, 22, C.grey, { align: 'left', weight: 700, maxW: 330 });
        ctx.restore();
      });
    });
    keyboard(t);
    text('5 shortcut tadi', 540, 260, 84, C.navy, { weight: 800, scale: E.outBack(P(t, R.in, R.in + 0.3)) });
    mascot(150, 1710, 0.9, 'idle', t);
  }

  function outro(t) {
    const O = TL.OUTRO;
    const p = E.inOut(P(t, O.in, O.in + 0.5));
    ctx.save(); ctx.globalAlpha = 1 - 0.8 * p;
    monitor(t, () => {}); keyboard(t);
    ctx.restore();
    ctx.fillStyle = `rgba(238,243,252,${0.6 * p})`; ctx.fillRect(0, 0, W, H);
    const mx = lerp(150, 540, p), my = lerp(1710, 1180, p), ms = lerp(0.9, 2.6, p);
    // glow behind
    ctx.save(); ctx.globalAlpha = p; const g = ctx.createRadialGradient(540, 1100, 0, 540, 1100, 520); g.addColorStop(0, 'rgba(255,182,39,0.35)'); g.addColorStop(1, 'rgba(255,182,39,0)'); ctx.fillStyle = g; ctx.fillRect(0, 500, W, 1200); ctx.restore();
    mascot(mx, my, ms, t >= O.thumbs ? 'thumbs' : 'idle', t);
    if (t >= O.thumbs) for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU, age = t - O.thumbs, d = 230 + age * 160;
      if (age > 0.9) break;
      ctx.save(); ctx.globalAlpha = 1 - age / 0.9; ctx.translate(540 + Math.cos(a) * d, 1000 + Math.sin(a) * d * 0.8); ctx.rotate(a); rr(-6, -18, 12, 36, 6); fill(C.amber); ctx.restore();
    }
    const a1 = E.outBack(P(t, O.text, O.text + 0.35)), a2 = E.outBack(P(t, O.text + 0.15, O.text + 0.5));
    if (a1 > 0) text('simpan video ini', 540, 260, 96, C.navy, { weight: 800, scale: a1 });
    if (a2 > 0) {
      ctx.save(); ctx.translate(540, 395); ctx.scale(a2, a2);
      ctx.font = `800 96px ${FONT}`; const w = ctx.measureText('biar nggak lupa.').width + 50;
      rr(-w / 2, -60, w, 120, 26); fill(C.amber); text('biar nggak lupa.', 0, 4, 96, C.navy, { weight: 800 });
      ctx.restore();
    }
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    background(t);
    const shake = t < 0.35 ? (rnd(Math.floor(t * 60)) - 0.5) * 22 * (1 - t / 0.35) : 0;
    ctx.translate(shake, shake * 0.5);
    if (t < 4) hook(t);
    else if (t < TL.RECAP.in) trickScene(t, TL.tricks[Math.min(4, Math.floor((t - 4) / 6))]);
    else if (t < TL.OUTRO.in) recap(t);
    else outro(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // watermark
    ctx.save(); ctx.globalAlpha = 0.25; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.navy; ctx.fillText('@taskkora__', W - 44, H - 52); ctx.restore();
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
