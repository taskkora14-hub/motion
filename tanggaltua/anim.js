/* "menu mahasiswa tanggal tua." — warm & silly flat lay, 40s, 1080x1920.
 * A tear-off calendar and one plate, seen from above: every torn page makes the plate humbler
 * (25 -> 29), until the transfer lands on the 30th. Pure function of time.
 * Tear and spoon-clink times are mirrored in tanggaltua/music.py. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueL: '#2F6BD3', blueD: '#123A80', navy: '#0B1A3D', navy2: '#081430',
    cream: '#FBF4E6', cream2: '#F1E6CF', cream3: '#E3D4B4', white: '#FFFFFF',
    amber: '#FFB627', amberD: '#D98E00', amberL: '#FFD77A',
    rice: '#FFFDF6', yolk: '#FFB627', green: '#6FA06A', greenD: '#4E7F4C', chili: '#C8452F', tempe: '#D9B77E', brown: '#9A5B2E', soy: '#2A1A14',
    skin: '#F1C49E', skinD: '#D9A07A',
  };
  const F = (w, s) => `${w} ${s}px "PP", sans-serif`;
  const HW = s => `700 ${s}px "HW", cursive`;

  // ---------- timeline ----------
  const DAYS = [[25, 0], [26, 9.6], [27, 15.2], [28, 20.8], [29, 26.4], [30, 32.0]];
  const TEAR = 0.6;
  const PLATE = { x: 540, y: 1300, r: 330 };
  const BEAT30 = 60 / 140;
  // spoon taps on the plate (mirrored in music.py)
  const CLINKS = [2.4, 6.1, 7.6, 11.9, 13.4, 17.6, 19.1, 23.3, 24.6, 28.3, 28.75, 29.2, 35.0, 35.43, 35.86, 36.29, 37.15, 38.0];

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const dayIndex = t => { let i = 0; for (let k = 0; k < DAYS.length; k++) if (t >= DAYS[k][1]) i = k; return i; };

  // ---------- assets ----------
  const ready = Promise.all(['900 40px "PP"', '800 40px "PP"', '600 40px "PP"', '700 40px "HW"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready);

  // ---------- helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function fillRR(x, y, w, h, r, c) { rr(x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }
  function circle(x, y, r, c) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function ell(x, y, rx, ry, c, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function seg(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function text(s, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = o.font || F(o.weight || 900, size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = '0px'; ctx.wordSpacing = Math.round(size * (o.ws ?? 0.12)) + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const w = ctx.measureText(s).width, max = o.maxW || 980;
    if (w > max) { ctx.translate(x, y); ctx.scale(max / w, max / w); ctx.translate(-x, -y); }
    if (o.stroke) { ctx.lineWidth = o.sw || Math.max(8, size * 0.16); ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(s, x, y + (o.sy ?? Math.max(6, size * 0.08))); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
    ctx.restore();
  }
  function withT(x, y, s, rot, fn) { if (s <= 0.001) return; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); fn(); ctx.restore(); }
  function shadow(fn, dx = 14, dy = 20, a = 0.22) { ctx.save(); ctx.translate(dx, dy); ctx.globalAlpha *= a; ctx.filter = 'blur(6px)'; fn(C.navy2); ctx.restore(); }

  // ---------- table ----------
  function table(t) {
    ctx.fillStyle = C.blue; ctx.fillRect(0, 0, W, H);
    // cream gingham tablecloth
    const s = 120;
    ctx.fillStyle = 'rgba(251,244,230,0.13)';
    for (let x = 0; x < W; x += s * 2) ctx.fillRect(x, 0, s, H);
    for (let y = 0; y < H; y += s * 2) ctx.fillRect(0, y, W, s);
    ctx.fillStyle = 'rgba(251,244,230,0.08)';
    for (let x = 0; x < W; x += s * 2) for (let y = 0; y < H; y += s * 2) ctx.fillRect(x, y, s, s);
    // linen placemat under the plate
    shadow(c => fillRR(120, 900, 840, 800, 60, c), 10, 14, 0.25);
    fillRR(120, 900, 840, 800, 60, C.cream2);
    ctx.strokeStyle = 'rgba(154,91,46,0.18)'; ctx.lineWidth = 3; rr(140, 920, 800, 760, 50); ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]);
  }

  // ---------- calendar ----------
  function calendarPage(d, cx, cy, s = 1) {
    const w = 420, h = 360;
    fillRR(cx - w / 2, cy - h / 2 + 30, w, h - 30, 18, C.cream);
    ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(cx - w / 2, cy - h / 2 + 30, w, 10);
    // perforation
    for (let x = cx - w / 2 + 14; x < cx + w / 2 - 10; x += 18) circle(x, cy - h / 2 + 40, 3, C.cream3);
    text('tanggal', cx, cy - 80, 40, C.amberD, { weight: 800 });
    text(String(d), cx, cy + 90, 190, d === 30 ? C.blue : C.navy, { weight: 900, ws: 0 });
    text(d === 30 ? 'hari kiriman!' : 'akhir bulan', cx, cy + 150, 34, d === 30 ? C.amberD : 'rgba(11,26,61,0.55)', { weight: 600 });
  }
  function calendar(t) {
    const cx = 540, cy = 690;
    shadow(c => fillRR(cx - 210, cy - 200, 420, 380, 18, c), 12, 16, 0.25);
    // pad thickness
    for (let k = 4; k >= 1; k--) fillRR(cx - 210 + k * 2, cy - 150 + k * 5, 420, 330, 18, k % 2 ? C.cream3 : C.cream2);
    const i = dayIndex(t), [d, T] = DAYS[i];
    calendarPage(d, cx, cy);
    // the page being torn off (previous day; on the hook it is the 24th)
    const t0 = i === 0 ? -0.4 : T - 0.15;              // the hook opens mid-tear: the 25th is already showing
    const p = P(t, t0, t0 + TEAR);
    if (p < 1 && t >= t0) {
      const prev = i === 0 ? 24 : DAYS[i - 1][0];
      const e = E.inOutCubic(p);
      ctx.save();
      ctx.translate(cx + 210, cy - 140);                     // pivot near the top-right corner
      ctx.rotate(-e * 0.9); ctx.translate(e * 300, -e * 520); ctx.globalAlpha = 1 - P(p, 0.7, 1);
      ctx.translate(-(cx + 210), -(cy - 140));
      // torn bottom-left curl
      calendarPage(prev, cx, cy);
      ctx.restore();
      tearHand(cx + 210 + e * 300, cy + 120 - e * 640, e);
    } else if (t < T + 0.3) {
      // little torn scraps stuck at the binding
      for (let k = 0; k < 6; k++) fillRR(cx - 200 + k * 70, cy - 150, 34, 10, 3, C.cream);
    }
    // binding with rings
    fillRR(cx - 220, cy - 200, 440, 60, 14, C.navy);
    for (let k = 0; k < 6; k++) { circle(cx - 175 + k * 70, cy - 170, 12, C.amber); circle(cx - 175 + k * 70, cy - 170, 5, C.navy); }
  }
  function tearHand(x, y, e) {
    // arm from the top-right edge grabbing the page corner
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.navy; ctx.lineWidth = 120; ctx.beginPath(); ctx.moveTo(1250, -200); ctx.lineTo(x + 60, y - 70); ctx.stroke();
    ctx.strokeStyle = C.amber; ctx.lineWidth = 120; ctx.beginPath(); ctx.moveTo(1250, -200); ctx.lineTo(1150, -80); ctx.stroke();
    ell(x + 20, y - 20, 60, 50, C.skin, -0.6);
    ell(x - 30, y + 10, 30, 16, C.skin, -0.3); ell(x - 20, y - 30, 30, 15, C.skin, -0.5);
    ctx.strokeStyle = C.skinD; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x + 20, y - 20, 60, 50, -0.6, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // ---------- cutlery / glass ----------
  function spoonTap(t) { let a = 0; for (const c of CLINKS) { const d = t - c; if (d > -0.25 && d < 0.2) a = Math.max(a, d < 0 ? 1 - Math.abs(d) / 0.25 : 1 - d / 0.2); } return a; }
  function cutlery(t) {
    const party = t > DAYS[5][1] + 1.6 ? Math.sin((t - 32) / BEAT30 * Math.PI) * 0.12 : 0;
    const tap = spoonTap(t);
    // fork (left)
    withT(110, 1300, 1, -0.05 + party, () => {
      shadow(c => { fillRR(-14, -260, 28, 520, 14, c); }, 10, 14, 0.25);
      fillRR(-16, -40, 32, 300, 16, C.cream3); fillRR(-12, -40, 24, 300, 12, '#EDE6D6');
      fillRR(-36, -230, 72, 200, 26, '#EDE6D6');
      for (let k = 0; k < 4; k++) fillRR(-30 + k * 17, -320, 10, 120, 5, '#EDE6D6');
    });
    // spoon (right) — dips toward the plate on every clink
    withT(970 - tap * 70, 1300 - tap * 20, 1 - tap * 0.04, 0.05 - tap * 0.35 - party, () => {
      shadow(c => { ell(0, -170, 64, 92, c); fillRR(-14, -90, 28, 380, 14, c); }, 10 + tap * 20, 14 + tap * 20, 0.25);
      fillRR(-15, -90, 30, 380, 15, '#EDE6D6');
      ell(0, -170, 64, 92, '#EDE6D6'); ell(-8, -180, 44, 66, '#FFFFFF'); ell(10, -150, 20, 30, 'rgba(0,0,0,0.05)');
    });
  }
  function glass(t) {
    const x = 900, y = 640;
    shadow(c => circle(x, y, 92, c), 12, 16, 0.25);
    circle(x, y, 92, 'rgba(255,255,255,0.55)'); circle(x, y, 80, 'rgba(200,225,255,0.55)');
    const lvl = lerp(1, 0.15, P(t, 4, 31));                  // the water keeps going down too
    if (t < DAYS[5][1] + 0.6) circle(x, y, 74 * Math.sqrt(lvl), 'rgba(140,190,255,0.5)');
    else { circle(x, y, 74, '#C88A3A'); circle(x - 20, y - 20, 18, 'rgba(255,255,255,0.6)'); circle(x + 16, y + 10, 14, 'rgba(255,255,255,0.6)'); }  // es teh on the 30th
    circle(x - 30, y - 34, 14, 'rgba(255,255,255,0.7)');
  }

  // ---------- food (plate-local, centre 0,0) ----------
  function nasi(s = 1) {
    ctx.save(); ctx.scale(s, s);
    const blobs = [[0, 0, 120], [-70, 30, 80], [70, 30, 84], [-30, -60, 80], [40, -55, 76], [0, 60, 90]];
    for (const [x, y, r] of blobs) circle(x + 6, y + 8, r, '#E8E1D0');
    for (const [x, y, r] of blobs) circle(x, y, r, C.rice);
    for (let k = 0; k < 60; k++) { const a = rnd(k) * TAU, r = Math.sqrt(rnd(k + 9)) * 140; ell(Math.cos(a) * r, Math.sin(a) * r * 0.9, 9, 4, '#EFE9DA', rnd(k + 3) * 3); }
    ctx.restore();
  }
  function telur() {
    ctx.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * TAU, r = 100 + Math.sin(k * 2.3) * 14; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); } ctx.closePath(); ctx.fillStyle = C.white; ctx.fill();
    ctx.strokeStyle = '#F3D9A6'; ctx.lineWidth = 6; ctx.stroke();
    circle(10, -6, 44, C.yolk); circle(-4, -20, 14, C.amberL);
  }
  function sayur() {
    for (let k = 0; k < 9; k++) { const a = k * 0.9, r = 30 + (k % 3) * 22; ell(Math.cos(a) * r, Math.sin(a) * r, 46, 20, k % 2 ? C.green : C.greenD, a + 0.6); }
    for (let k = 0; k < 6; k++) fillRR(-50 + rnd(k) * 100, -40 + rnd(k + 4) * 80, 22, 12, 4, C.amber);
  }
  function sambal() { circle(0, 0, 46, '#E9E0CF'); circle(0, 0, 38, C.chili); for (let k = 0; k < 7; k++) circle(-20 + rnd(k) * 40, -20 + rnd(k + 2) * 40, 4, '#F2A08A'); }
  function tempe() { for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate(k * 56, k * 22); ctx.rotate(0.3 + k * 0.2); fillRR(-60, -34, 120, 68, 10, C.tempe); fillRR(-60, -34, 120, 68, 10, 'rgba(154,91,46,0.15)'); for (let d = 0; d < 14; d++) circle(-50 + rnd(d + k * 20) * 100, -26 + rnd(d + k * 30) * 52, 5, '#F2DDB0'); ctx.restore(); } }
  function kerupuk() { for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate(k * 60, -k * 30); ctx.beginPath(); for (let j = 0; j <= 20; j++) { const a = j / 20 * TAU, r = 70 + Math.sin(j * 3.1 + k) * 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = '#FFF3D6'; ctx.fill(); ctx.strokeStyle = '#F0D9A8'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); } }
  function ayam(ghost = false, t = 0) {
    ctx.save(); ctx.rotate(-0.5);
    const body = () => { ctx.beginPath(); ctx.ellipse(0, 0, 110, 78, 0, 0, TAU); ctx.moveTo(90, -14); ctx.lineTo(190, -18); ctx.lineTo(190, 18); ctx.lineTo(90, 14); };
    if (ghost) {
      body(); ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = 'rgba(11,26,61,0.5)'; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]);
      circle(206, -20, 22, 'rgba(0,0,0,0)'); ctx.beginPath(); ctx.arc(206, -18, 22, 0, TAU); ctx.arc(206, 18, 22, 0, TAU); ctx.setLineDash([10, 10]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore(); return;
    }
    ell(6, 8, 110, 78, '#7E451F');
    ell(0, 0, 110, 78, '#C27A3A'); ell(-20, -18, 70, 40, '#D9924B');
    for (let k = 0; k < 10; k++) circle(-80 + rnd(k) * 160, -50 + rnd(k + 5) * 100, 8, '#E5A65E');
    fillRR(90, -14, 100, 28, 10, '#F6EBD3'); circle(206, -18, 22, '#F6EBD3'); circle(206, 18, 22, '#F6EBD3');
    ctx.restore();
  }
  function kecap(t, s0) {
    const p = E.outCubic(P(t, s0 + 0.5, s0 + 1.4));
    ctx.save(); ctx.beginPath();
    for (let k = 0; k <= 80 * p; k++) { const a = k / 80 * TAU * 2.2, r = 20 + k * 1.3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.85); }
    ctx.strokeStyle = C.soy; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }
  function mieHalf(t) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 240, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.clip();
    circle(0, 0, 240, '#F4D9A0');
    for (let k = 0; k < 26; k++) {
      ctx.beginPath(); const y0 = -230 + k * 18;
      for (let x = -240; x <= 0; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.08 + k) * 8);
      ctx.strokeStyle = k % 2 ? '#E7B75C' : '#F2C66E'; ctx.lineWidth = 9; ctx.stroke();
    }
    circle(-150, -60, 26, C.greenD); circle(-110, 90, 22, C.green);
    ctx.restore();
    // dividing line + labels
    ctx.setLineDash([20, 14]); seg(0, -270, 0, 270, C.navy, 6); ctx.setLineDash([]);
    text('1/2', -120, 20, 70, C.navy, { weight: 900, stroke: C.cream, sw: 12, ws: 0 });
    // sticky note on the empty half
    ctx.save(); ctx.translate(130, 0); ctx.rotate(0.08); fillRR(-90, -80, 180, 160, 8, C.amberL); text('buat', 0, -12, 52, C.navy, { font: HW(52), ws: 0 }); text('besok', 0, 46, 52, C.navy, { font: HW(52), ws: 0 }); ctx.restore();
    // steam
    for (let k = 0; k < 3; k++) { ctx.beginPath(); const x0 = -170 + k * 70; for (let y = 0; y < 140; y += 10) ctx.lineTo(x0 + Math.sin(y * 0.08 + t * 3 + k) * 14, -120 - y); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 8; ctx.stroke(); }
  }
  function mug(t) {
    circle(10, 14, 130, 'rgba(0,0,0,0.12)');
    fillRR(110, -24, 80, 48, 24, C.cream3);
    circle(0, 0, 130, C.white); circle(0, 0, 112, '#DDEBFA'); circle(0, 0, 112, 'rgba(255,255,255,0.4)');
    for (let k = 0; k < 3; k++) { ctx.beginPath(); const x0 = -50 + k * 50; for (let y = 0; y < 170; y += 10) ctx.lineTo(x0 + Math.sin(y * 0.07 + t * 2.5 + k) * 16, -40 - y); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 9; ctx.stroke(); }
  }

  // which items sit on the plate on each day: [id, x, y, scale]
  const MENU = {
    25: [['nasi', -60, 30, 1], ['telur', 110, -110, 1], ['sayur', 140, 120, 1], ['tempe', -150, -150, 0.9], ['sambal', -170, 170, 1], ['kerupuk', 60, 230, 0.8]],
    26: [['nasi', -60, 30, 1], ['kecap', -60, 30, 1]],
    27: [['mie', 0, 0, 1]],
    28: [['nasiS', -100, 20, 0.7], ['ghost', 110, -10, 0.9]],
    29: [['mug', 0, 0, 1]],
    30: [['nasi', -60, 50, 1], ['ayam', 120, -130, 0.95], ['telur', -150, -150, 0.8], ['sayur', 160, 130, 0.9], ['tempe', -40, 220, 0.75], ['sambal', -210, 140, 0.9], ['kerupuk', 200, -10, 0.7]],
  };
  function drawItem(id, t, s0) {
    switch (id) {
      case 'nasi': return nasi(1);
      case 'nasiS': return nasi(0.75);
      case 'telur': return telur();
      case 'sayur': return sayur();
      case 'tempe': return tempe();
      case 'sambal': return sambal();
      case 'kerupuk': return kerupuk();
      case 'kecap': return kecap(t, s0);
      case 'mie': return mieHalf(t);
      case 'ghost': ayam(true, t); return;
      case 'mug': return mug(t);
      case 'ayam': return ayam(false);
    }
  }
  function plate(t) {
    const i = dayIndex(t), [d, T] = DAYS[i];
    const glow = i === 5 ? E.outCubic(P(t, T + 0.5, T + 1.1)) : 0;
    // light rays on the 30th
    if (glow > 0) {
      ctx.save(); ctx.translate(PLATE.x, PLATE.y); ctx.rotate(t * 0.25);
      for (let k = 0; k < 14; k++) { ctx.rotate(TAU / 14); ctx.fillStyle = `rgba(255,215,122,${0.22 * glow})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, -110); ctx.lineTo(900, 110); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      const g = ctx.createRadialGradient(PLATE.x, PLATE.y, 200, PLATE.x, PLATE.y, 620); g.addColorStop(0, `rgba(255,236,190,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 600, W, 1320);
    }
    const bounce = i === 5 && t > T + 1.6 ? 1 + 0.02 * Math.exp(-(((t - T) / BEAT30) % 1) * 6) : 1;
    ctx.save(); ctx.translate(PLATE.x, PLATE.y); ctx.scale(bounce, bounce);
    shadow(c => circle(0, 0, PLATE.r, c), 14, 22, 0.28);
    circle(0, 0, PLATE.r, C.white); circle(0, 0, PLATE.r - 14, '#F6F8FC');
    ctx.strokeStyle = C.blue; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, PLATE.r - 30, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(24,74,161,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, PLATE.r - 46, 0, TAU); ctx.stroke();
    circle(0, 0, PLATE.r - 70, '#FAFBFE');
    // items: shared ones stay put, others pop out/in on the tear
    const cur = MENU[d], prev = i > 0 ? MENU[DAYS[i - 1][0]] : [];
    const has = (list, id) => list.some(e => e[0] === id);
    const outP = P(t, T, T + 0.3);
    if (i > 0 && outP < 1) prev.forEach(([id, x, y, s], k) => {
      if (has(cur, id)) return;
      const e = 1 - E.inCubic(clamp(outP * 1.4 - k * 0.06));
      withT(x, y, s * e, (1 - e) * 0.8, () => drawItem(id, t, DAYS[i - 1][1]));
    });
    cur.forEach(([id, x, y, s], k) => {
      const keep = i > 0 && has(prev, id);
      const p = keep ? 1 : E.outBack(P(t, T + 0.25 + k * 0.09, T + 0.55 + k * 0.09) * (i === 5 ? 1 : 1));
      const delay = i === 5 ? 0.45 : 0;
      const pp = keep ? 1 : E.outBack(P(t, T + 0.25 + delay + k * 0.12, T + 0.55 + delay + k * 0.12));
      withT(x, y, s * (i === 0 ? 1 : pp), 0, () => drawItem(id, t, T));
    });
    // "bayangan lauk" tag
    if (d === 28) {
      const q = E.outBack(P(t, T + 0.9, T + 1.2));
      withT(150, -170, q, -0.06, () => {
        fillRR(-170, -40, 340, 80, 40, C.navy); text('bayangan lauk', 0, 12, 34, C.cream, { weight: 800 });
        seg(-20, 40, -40, 120, C.navy, 5);
      });
    }
    ctx.restore();
    // sparkles on the 30th
    if (glow > 0) for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU + t * 0.4, r = 380 + 40 * Math.sin(t * 3 + k), x = PLATE.x + Math.cos(a) * r, y = PLATE.y + Math.sin(a) * r, z = (10 + 10 * Math.abs(Math.sin(t * 4 + k))) * glow;
      ctx.beginPath(); ctx.moveTo(x, y - z * 2); ctx.lineTo(x + z * 0.5, y - z * 0.5); ctx.lineTo(x + z * 2, y); ctx.lineTo(x + z * 0.5, y + z * 0.5); ctx.lineTo(x, y + z * 2); ctx.lineTo(x - z * 0.5, y + z * 0.5); ctx.lineTo(x - z * 2, y); ctx.lineTo(x - z * 0.5, y - z * 0.5); ctx.closePath(); ctx.fillStyle = k % 2 ? C.amberL : C.white; ctx.fill();
    }
  }

  // ---------- captions ----------
  const LINES = { 25: ['masih berasa', 'sultan.'], 26: ['kecap =', 'lauk utama.'], 27: ['mie dibagi dua,', 'sisanya buat besok.'], 28: ['lauknya pakai', 'imajinasi.'], 29: ['kenyang secara', 'spiritual.'], 30: ['tanggal 1,', 'sampai ketemu lagi.'] };
  function captions(t) {
    if (t < 4.0) {
      const s = 1 + 0.08 * (1 - E.outCubic(P(t, 0, 0.25)));
      withT(540, 300, s, 0, () => {
        text('menu mahasiswa', 0, -30, 112, C.cream, { stroke: C.navy, sw: 20, shadow: C.navy, maxW: 1000 });
        text('tanggal tua.', 0, 110, 128, C.amber, { stroke: C.navy, sw: 22, shadow: C.navy });
      });
      return;
    }
    const i = dayIndex(t), [d, T] = DAYS[i];
    const a = d === 25 ? 4.15 : d === 30 ? 33.8 : T + 0.6;
    const [l1, l2] = LINES[d];
    const p1 = E.outBack(P(t, a, a + 0.3)), p2 = E.outBack(P(t, a + 0.25, a + 0.55));
    const hi = d === 29 ? C.blueL : d === 30 ? C.amber : C.amber;
    withT(540, 260, p1, -0.02, () => text(l1, 0, 0, 92, C.cream, { stroke: C.navy, sw: 18, shadow: C.navy, maxW: 1000 }));
    withT(540, 380, p2, -0.02, () => text(l2, 0, 0, 100, hi, { stroke: C.navy, sw: 18, shadow: C.navy, maxW: 1000 }));
    // "spiritual" halo
    if (d === 29) {
      const q = P(t, a + 0.5, a + 1.0);
      ctx.save(); ctx.globalAlpha = q; ctx.strokeStyle = C.amberL; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(PLATE.x, PLATE.y - 200, 120, 30, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }

  // ---------- the transfer on the 30th ----------
  function transfer(t) {
    const T = DAYS[5][1];
    if (t < T + 0.1 || t > T + 1.9) return;
    const p = E.outBack(P(t, T + 0.1, T + 0.4)), out = E.inCubic(P(t, T + 1.5, T + 1.9));
    const y = lerp(-200, 180, p) - out * 420;
    ctx.save(); ctx.translate(540, y);
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 30;
    fillRR(-440, -10, 880, 200, 40, C.white); ctx.shadowBlur = 0;
    circle(-360, 90, 52, C.amber); text('rp', -360, 108, 44, C.navy, { weight: 900, ws: 0 });
    text('transfer masuk', -280, 70, 40, C.navy, { weight: 800, align: 'left' });
    text('+ rp1.500.000 dari mama', -280, 130, 38, C.blue, { weight: 800, align: 'left', maxW: 640 });
    text('baru saja', 400, 50, 26, '#7A869E', { weight: 600, align: 'right' });
    ctx.restore();
  }

  // mood: the room gets dimmer and bluer toward the 29th, warm again on the 30th
  function mood(t) {
    const dim = 0.26 * E.inOutCubic(P(t, 14, 31.6)) * (1 - E.outCubic(P(t, 32.0, 32.6)));
    if (dim > 0) { ctx.fillStyle = `rgba(8,20,48,${dim})`; ctx.fillRect(0, 0, W, H); }
    const v = ctx.createRadialGradient(540, 1100, 500, 540, 1100, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(8,20,48,${0.25 + dim * 0.5})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const w = E.outCubic(P(t, 32.5, 33.2));
    if (w > 0) { ctx.fillStyle = `rgba(255,190,90,${0.08 * w})`; ctx.fillRect(0, 0, W, H); }
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.25;
    ctx.font = F(600, 30); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.white;
    ctx.fillText('@taskkora__', 1040, 1872);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    table(t);
    glass(t);
    plate(t);
    cutlery(t);
    calendar(t);
    mood(t);
    captions(t);
    transfer(t);
    // the 30th: a flash as the transfer lands
    const fd = t - (DAYS[5][1] + 0.5); if (fd > 0 && fd < 0.15) { ctx.fillStyle = `rgba(255,240,200,${0.5 * (1 - fd / 0.15)})`; ctx.fillRect(0, 0, W, H); }
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
    const loop = () => {
      if (playing) tNow = ((performance.now() - start) / 1000) % DURATION;
      render(tNow); seek.value = tNow; tl.textContent = tNow.toFixed(2) + 's';
      requestAnimationFrame(loop);
    };
    loop();
  });
})();
