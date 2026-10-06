/* "uang bulanan segini cukup nggak?" — animated budget infographic, 40s, 1080x1920.
 * A donut chart fills category by category (illustrative numbers only), a counter ticks, the
 * balance in the corner drains and turns red, a calculator types along. Pure function of time.
 * Category times mirror anggaran/music.py (105 BPM: one category every 6 beats). */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueL: '#2F6BD3', navy: '#0B1A3D', ink2: '#4A5675', muted: '#7D88A3',
    white: '#FFFFFF', bg: '#EEF3FB', track: '#E3E9F4', amber: '#FFB627', amberD: '#C98500',
    low: '#D6302F', lowBg: '#FDE8E7',
  };
  const F = (w, s) => `${w} ${s}px "PP", sans-serif`;

  // ---------- data (illustrative example, not official figures) ----------
  const TOTAL = 1500000;
  // categorical order validated for adjacency incl. the donut's wrap-around (dataviz validate_palette, light, #FFFFFF)
  const CATS = [
    { id: 'kos', label: 'kos', v: 600000, c: '#184AA1' },
    { id: 'makan', label: 'makan', v: 500000, c: '#E08A00' },
    { id: 'transport', label: 'transport', v: 150000, c: '#8A5CD6' },
    { id: 'kuota', label: 'kuota & pulsa', v: 75000, c: '#1BAF7A' },
    { id: 'fotokopi', label: 'fotokopi & atk', v: 50000, c: '#B0457A' },
    { id: 'tabungan', label: 'tabungan', v: 50000, c: '#2FA4C9' },
    { id: 'hiburan', label: 'hiburan', v: 75000, c: '#E34948' },
  ];
  const BEAT = 60 / 105;
  const CAT_T = CATS.map((_, k) => 8 * BEAT + k * 6 * BEAT);      // 4.571, 8.0, 11.43 ... 25.14
  const SCENE3 = 52 * BEAT;                                        // 29.71
  const FIELDS_T = 60 * BEAT;                                      // 34.29

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rp = n => 'rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const num = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const ready = Promise.all(['900 40px "PP"', '800 40px "PP"', '600 40px "PP"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready);

  // ---------- helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function fillRR(x, y, w, h, r, c) { rr(x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }
  function circle(x, y, r, c) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function seg(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function text(s, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = F(o.weight || 800, size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'alphabetic';
    ctx.wordSpacing = Math.round(size * 0.1) + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const w = ctx.measureText(s).width, max = o.maxW || 980;
    if (w > max) { ctx.translate(x, y); ctx.scale(max / w, max / w); ctx.translate(-x, -y); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
    ctx.restore();
  }
  function withS(x, y, s, fn) { if (s <= 0.001) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y); fn(); ctx.restore(); }
  function card(x, y, w, h, r = 28) { ctx.save(); ctx.shadowColor = 'rgba(11,26,61,0.12)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; fillRR(x, y, w, h, r, C.white); ctx.restore(); }

  // ---------- flat icons (drawn at 0,0, size ~ 1 = 100px box) ----------
  function icon(id, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const W_ = '#FFFFFF';
    circle(0, 0, 50, col);
    ctx.fillStyle = W_; ctx.strokeStyle = W_; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (id) {
      case 'kos': ctx.beginPath(); ctx.moveTo(-26, -2); ctx.lineTo(0, -26); ctx.lineTo(26, -2); ctx.stroke(); ctx.fillRect(-18, -4, 36, 28); ctx.fillStyle = col; ctx.fillRect(-6, 8, 12, 16); break;
      case 'makan': ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI); ctx.closePath(); ctx.fill(); seg(-28, 0, 28, 0, W_, 6); seg(8, -8, 26, -28, W_, 4); seg(14, -6, 32, -24, W_, 4); ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI, 0); ctx.fill(); break;
      case 'transport': rr(-24, -24, 48, 40, 8); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(-18, -18, 36, 14); circle(-13, 20, 7, W_); circle(13, 20, 7, W_); circle(-13, 20, 3, col); circle(13, 20, 3, col); break;
      case 'kuota': rr(-14, -26, 28, 50, 6); ctx.stroke(); circle(0, 16, 3, W_); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(22, -18, 6 + k * 7, -0.9, 0.1); ctx.stroke(); } break;
      case 'fotokopi': ctx.fillRect(-22, -24, 30, 40); ctx.fillStyle = col; for (let k = 0; k < 3; k++) ctx.fillRect(-16, -16 + k * 10, 18, 4); ctx.save(); ctx.translate(14, 4); ctx.rotate(0.6); ctx.fillStyle = W_; ctx.fillRect(-4, -26, 8, 40); ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(4, 14); ctx.lineTo(0, 22); ctx.closePath(); ctx.fill(); ctx.restore(); break;
      case 'tabungan': ctx.beginPath(); ctx.ellipse(0, 4, 26, 19, 0, 0, TAU); ctx.fill(); ctx.fillRect(-16, 16, 8, 10); ctx.fillRect(8, 16, 8, 10); ctx.beginPath(); ctx.ellipse(26, 2, 7, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(-8, -12, 16, 4); circle(10, -2, 3, col); circle(0, -26, 7, W_); break;
      case 'hiburan': rr(-26, -16, 52, 32, 14); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(-18, -3, 14, 6); ctx.fillRect(-14, -7, 6, 14); circle(12, -4, 4, col); circle(19, 4, 4, col); break;
    }
    ctx.restore();
  }

  // ---------- state ----------
  const spentAt = t => CATS.reduce((s, c, k) => s + c.v * E.inOutCubic(P(t, CAT_T[k] + 0.1, CAT_T[k] + 0.9)), 0);
  const balanceAt = t => TOTAL - spentAt(t);
  const lowAt = t => balanceAt(t) <= 0.15 * TOTAL;

  // ---------- donut ----------
  const D = { x: 540, y: 900, r: 270, w: 104 };
  function donut(t) {
    const appear = E.outBack(P(t, -0.2, 0.25));
    withS(D.x, D.y, appear, () => {
      ctx.beginPath(); ctx.arc(D.x, D.y, D.r, 0, TAU); ctx.strokeStyle = C.track; ctx.lineWidth = D.w; ctx.stroke();
      let a0 = -Math.PI / 2;
      CATS.forEach((c, k) => {
        const p = E.inOutCubic(P(t, CAT_T[k] + 0.1, CAT_T[k] + 0.9));
        if (p <= 0) return;
        const sweep = c.v / TOTAL * TAU * p;
        const gap = 0.012;                                           // 2px surface gap between segments
        const pop = k === activeCat(t) ? 10 * Math.sin(P(t, CAT_T[k] + 0.85, CAT_T[k] + 1.2) * Math.PI) : 0;
        ctx.beginPath(); ctx.arc(D.x, D.y, D.r + pop * 0.5, a0 + gap, a0 + Math.max(gap, sweep - gap));
        ctx.strokeStyle = c.c; ctx.lineWidth = D.w + pop; ctx.lineCap = 'butt'; ctx.stroke();
        // direct label (percentage) for the big slices
        if (p >= 1 && c.v / TOTAL >= 0.09) {
          const mid = a0 + sweep / 2, lx = D.x + Math.cos(mid) * D.r, ly = D.y + Math.sin(mid) * D.r;
          text(Math.round(c.v / TOTAL * 100) + '%', lx, ly + 12, 34, C.white, { weight: 800 });
        }
        a0 += c.v / TOTAL * TAU;
      });
    });
  }
  function activeCat(t) { let k = -1; CAT_T.forEach((c, i) => { if (t >= c) k = i; }); return k; }

  // centre of the donut: hook amount, then the category being paid, then the result
  function centre(t) {
    if (t < CAT_T[0]) {
      const v = TOTAL * (0.62 + 0.38 * E.outCubic(P(t, 0, 0.45)));     // already big on frame 0, ticks up to the full amount
      text('uang kiriman masuk', D.x, D.y - 60, 34, C.ink2, { weight: 600 });
      withS(D.x, D.y, 1 + 0.06 * Math.max(0, 1 - t / 0.3), () => text(rp(v), D.x, D.y + 30, 74, C.navy, { weight: 900, maxW: 410 }));
      text('contoh', D.x, D.y + 90, 28, C.muted, { weight: 600 });
      return;
    }
    if (t < SCENE3) {
      const k = activeCat(t), c = CATS[k], p = E.outBack(P(t, CAT_T[k], CAT_T[k] + 0.3));
      withS(D.x, D.y, p, () => {
        icon(c.id, D.x, D.y - 85, 0.9, c.c);
        text(c.label, D.x, D.y + 10, 40, C.navy, { weight: 800, maxW: 360 });
        const v = c.v * E.outCubic(P(t, CAT_T[k] + 0.1, CAT_T[k] + 0.9));
        text('-' + rp(v), D.x, D.y + 72, 52, C.navy, { weight: 900, maxW: 380 });
      });
    }
  }

  // ---------- legend (identity never by colour alone: icon + name + value) ----------
  function legend(t) {
    const x = 410, y0 = 1290, rowH = 76;
    CATS.forEach((c, k) => {
      const p = E.outBack(P(t, CAT_T[k] + 0.05, CAT_T[k] + 0.4));
      if (p <= 0) return;
      const y = y0 + k * rowH;
      ctx.save(); ctx.globalAlpha = clamp(p); ctx.translate((1 - clamp(p)) * 60, 0);
      icon(c.id, x + 30, y + 30, 0.5, c.c);
      text(c.label, x + 76, y + 42, 34, C.navy, { align: 'left', weight: 600, maxW: 330 });
      const v = c.v * E.outCubic(P(t, CAT_T[k] + 0.1, CAT_T[k] + 0.9));
      text(num(v), 1030, y + 42, 34, C.navy, { align: 'right', weight: 800 });
      if (k < CATS.length - 1) { ctx.fillStyle = C.track; ctx.fillRect(x, y + rowH - 6, 620, 2); }
      ctx.restore();
    });
  }

  // ---------- balance chip (top-right corner) ----------
  function balance(t) {
    const b = Math.max(0, balanceAt(t)), low = lowAt(t);
    const shake = low && t < SCENE3 ? Math.sin(t * 40) * 3 * Math.exp(-((t - 14.86) % 3.43) * 3) : 0;
    const x = 600, y = 450, w = 440, h = 120;
    ctx.save(); ctx.translate(shake, 0);
    card(x, y, w, h, 24);
    if (low) fillRR(x, y, w, h, 24, C.lowBg);
    text('sisa saldo', x + 28, y + 44, 28, low ? C.low : C.ink2, { align: 'left', weight: 600 });
    if (low) { // warning icon + label: never colour alone
      ctx.save(); ctx.translate(x + w - 44, y + 34); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(18, 14); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fillStyle = C.low; ctx.fill();
      ctx.fillStyle = C.white; ctx.fillRect(-2, -6, 4, 11); ctx.fillRect(-2, 8, 4, 4); ctx.restore();
      text('hampir habis', x + w - 70, y + 44, 24, C.low, { align: 'right', weight: 800 });
    }
    text(rp(b), x + 28, y + 100, 50, low ? C.low : C.navy, { align: 'left', weight: 900, maxW: w - 56 });
    // thin bar
    fillRR(x + 28, y + h - 10, w - 56, 6, 3, C.track);
    fillRR(x + 28, y + h - 10, (w - 56) * b / TOTAL, 6, 3, low ? C.low : C.blue);
    ctx.restore();
  }

  // ---------- calculator ----------
  const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '=', '+'];
  // keys typed per category: "-", digits..., then the running display
  function calcPresses(t) {
    // returns the key being pressed now (for highlight) and the display string
    let disp = num(TOTAL), pressed = null;
    for (let k = 0; k < CATS.length; k++) {
      const s = CAT_T[k] + 0.12, digits = String(CATS[k].v).replace(/0+$/, '');
      const seq = ['-', ...digits.split(''), '0', '0', '0', '='].slice(0, 2 + digits.length + 3);
      for (let i = 0; i < seq.length; i++) { const tk = s + i * 0.09; if (t >= tk && t < tk + 0.08) pressed = seq[i]; }
      if (t >= s) disp = t < s + seq.length * 0.09 ? '-' + num(CATS[k].v) : num(Math.max(0, TOTAL - CATS.slice(0, k + 1).reduce((a, c) => a + c.v, 0)));
    }
    return { disp, pressed };
  }
  function calculator(t, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.save(); ctx.shadowColor = 'rgba(11,26,61,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; fillRR(0, 0, 320, 440, 34, C.navy); ctx.restore();
    fillRR(22, 24, 276, 96, 16, '#DCE7D2');
    const { disp, pressed } = t < SCENE3 ? calcPresses(t) : finalCalc(t);
    ctx.font = F(800, disp.length > 11 ? 30 : 42); ctx.textAlign = 'right'; ctx.fillStyle = '#1D2B1A'; ctx.fillText(disp, 282, 92);
    ctx.font = F(600, 16); ctx.textAlign = 'left'; ctx.fillStyle = '#5C6B57'; ctx.fillText('contoh', 36, 48);
    KEYS.forEach((k, i) => {
      const cx = 22 + (i % 4) * 70, cy = 140 + Math.floor(i / 4) * 72, on = pressed === k;
      const col = k === '=' ? C.amber : '+-×÷'.includes(k) ? C.blueL : '#24356A';
      fillRR(cx, cy + (on ? 4 : 0), 60, 60, 14, on ? '#FFFFFF' : col);
      ctx.font = F(800, 28); ctx.textAlign = 'center'; ctx.fillStyle = on ? C.navy : k === '=' ? C.navy : '#FFFFFF'; ctx.fillText(k, cx + 30, cy + 41 + (on ? 4 : 0));
    });
    ctx.restore();
  }
  function finalCalc(t) {
    const s = SCENE3 + 0.2;
    const steps = [[0, num(TOTAL), '1'], [0.35, '- ' + num(TOTAL), '-'], [0.75, '=', '='], [0.95, '0', null]];
    let disp = num(TOTAL), pressed = null;
    for (const [dt, d, k] of steps) { if (t >= s + dt) disp = d; if (k && t >= s + dt && t < s + dt + 0.1) pressed = k; }
    if (t >= s + 0.95) disp = 'rp0';
    return { disp, pressed };
  }

  // ---------- disclaimer (persistent) ----------
  function disclaimer() {
    ctx.save();
    ctx.font = F(600, 24); const w = ctx.measureText('contoh, bukan data resmi').width + 44;
    fillRR(40, 488, w, 44, 22, '#FFF4D6'); ctx.lineWidth = 2; ctx.strokeStyle = C.amberD; rr(40, 488, w, 44, 22); ctx.stroke();
    ctx.fillStyle = '#7A5300'; ctx.textAlign = 'left'; ctx.fillText('contoh, bukan data resmi', 62, 518);
    ctx.restore();
  }

  // ---------- captions ----------
  function headline(t) {
    if (t < CAT_T[0]) {
      const s = 1 + 0.06 * (1 - E.outCubic(P(t, 0, 0.25)));
      withS(540, 300, s, () => { text('uang bulanan segini', 540, 260, 92, C.navy, { weight: 900 }); text('cukup nggak?', 540, 380, 110, C.blue, { weight: 900 }); });
      return;
    }
    if (t < SCENE3) {
      const q = E.outCubic(P(t, CAT_T[0], CAT_T[0] + 0.4));
      text('ke mana aja uangnya?', 540, 300, 76, C.navy, { weight: 900, alpha: q });
      const k = activeCat(t);
      text(`${k + 1} dari ${CATS.length} pos`, 540, 380, 40, C.ink2, { weight: 600, alpha: q });
    }
  }

  // ---------- scene 3 ----------
  function scene3(t) {
    const k = E.inOutCubic(P(t, SCENE3, SCENE3 + 0.5));
    const out = E.inOutCubic(P(t, FIELDS_T - 0.4, FIELDS_T));
    // calculator moves from the corner to centre stage
    const cx = lerp(40, 540 - 160 * 1.6, k), cy = lerp(1460, 640, k), cs = lerp(1, 1.6, k);
    ctx.save(); ctx.globalAlpha = 1 - out;
    calculator(t, cx, cy - out * 200, cs);
    const p1 = E.outBack(P(t, SCENE3 + 1.3, SCENE3 + 1.6)), p2 = E.outBack(P(t, SCENE3 + 1.6, SCENE3 + 1.9));
    withS(540, 260, p1, () => text('ini cuma contoh.', 540, 280, 88, C.navy, { weight: 900 }));
    withS(540, 390, p2, () => text('punyamu berapa?', 540, 400, 100, C.blue, { weight: 900 }));
    const z = E.outBack(P(t, SCENE3 + 1.0, SCENE3 + 1.3));
    withS(540, 1460, z, () => text('sisa: rp0', 540, 1480, 80, C.low, { weight: 900 }));
    ctx.restore();
    if (t >= FIELDS_T - 0.1) fields(t);
  }
  function fields(t) {
    withS(540, 330, E.outBack(P(t, FIELDS_T, FIELDS_T + 0.35)), () => {
      text('punyamu berapa?', 540, 300, 96, C.navy, { weight: 900 });
      text('isi di komentar, tanpa data pribadi', 540, 380, 38, C.ink2, { weight: 600 });
    });
    ['kota', 'uang bulanan', 'kos'].forEach((lab, i) => {
      const p = E.outBack(P(t, FIELDS_T + 0.3 + i * 0.25, FIELDS_T + 0.65 + i * 0.25));
      if (p <= 0) return;
      const y = 620 + i * 300;
      withS(540, y + 100, p, () => {
        text(lab, 120, y + 40, 44, C.navy, { align: 'left', weight: 800 });
        card(110, y + 70, 860, 130, 26);
        ctx.lineWidth = 4; ctx.strokeStyle = i === Math.floor((t - FIELDS_T) / 1.4) % 3 ? C.blue : '#C9D5EA'; rr(110, y + 70, 860, 130, 26); ctx.stroke();
        if (i === Math.floor((t - FIELDS_T) / 1.4) % 3 && Math.floor(t * 2) % 2 === 0) fillRR(150, y + 105, 6, 60, 3, C.blue);
        text(['contoh: kota kamu', 'contoh: rp...', 'contoh: rp...'][i], 172, y + 152, 36, '#A8B3C9', { align: 'left', weight: 600 });
      });
    });
    const q = E.outCubic(P(t, FIELDS_T + 1.3, FIELDS_T + 1.7));
    text('format: kota - uang bulanan - biaya kos', 540, 1560, 38, C.ink2, { weight: 600, alpha: q });
  }

  // ---------- money-in card (hook) ----------
  function moneyIn(t) {
    if (t > CAT_T[0]) return;
    const p = E.outBack(P(t, -0.1, 0.25)), out = P(t, 3.9, CAT_T[0]);
    ctx.save(); ctx.globalAlpha = 1 - out;
    withS(540, 1340, p, () => {
      card(170, 1270, 740, 140, 30);
      circle(250, 1340, 46, C.amber); text('rp', 250, 1356, 40, C.navy, { weight: 900 });
      text('uang kiriman masuk', 320, 1326, 36, C.navy, { align: 'left', weight: 800 });
      text('+' + rp(TOTAL) + ' (contoh)', 320, 1378, 34, C.blue, { align: 'left', weight: 800 });
    });
    // coins bursting
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k - 4.5) * 0.32, d = P(t, 0, 0.8), r = 330 + 260 * E.outCubic(d);   // coins fly out around the ring, not over the amount
      if (d >= 1) continue;
      const x = 540 + Math.cos(a) * r * 1.4, y = 900 + Math.sin(a) * r + 600 * d * d;
      ctx.globalAlpha = (1 - d) * (1 - out);
      circle(x, y, 22, C.amber); circle(x, y, 14, '#FFD27A');
    }
    ctx.restore();
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.25; ctx.font = F(600, 30); ctx.textAlign = 'right'; ctx.fillStyle = C.navy;
    ctx.fillText('@taskkora__', 1040, 1872); ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // soft decorative blobs
    circle(1000, 160, 220, 'rgba(24,74,161,0.05)'); circle(60, 1700, 260, 'rgba(255,182,39,0.07)');
    if (t < SCENE3) {
      card(40, 580, 1000, 670, 40);
      donut(t);
      centre(t);
      legend(t);
      calculator(t, 40, 1460, 1);
      moneyIn(t);
      headline(t);
      balance(t);
    } else {
      // donut + legend slide away as the calculator takes over
      const k = E.inOutCubic(P(t, SCENE3, SCENE3 + 0.5));
      if (k < 1) { ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(0, k * 120); card(40, 580, 1000, 670, 40); donut(t); legend(t); ctx.restore(); }
      scene3(t);
      if (t < FIELDS_T) balance(t);
    }
    disclaimer();
    // impact flash on frame 0
    if (t < 0.08) { ctx.fillStyle = `rgba(255,214,122,${0.15 * (1 - t / 0.08)})`; ctx.fillRect(0, 0, W, H); }
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
    const loop = () => { if (playing) tNow = ((performance.now() - start) / 1000) % DURATION; render(tNow); seek.value = tNow; tl.textContent = tNow.toFixed(2) + 's'; requestAnimationFrame(loop); };
    loop();
  });
})();
