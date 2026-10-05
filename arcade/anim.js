/* "Level 1: tugas menyerang!" — 8-bit arcade promo, 40s, 1080x1920.
 * CRT screen, a pixel student with a pencil blaster, falling task blocks, a MinTask power-up.
 * Gameplay comes from plan.js (shared with music.py); every frame is a pure function of time. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, U = 6; // U = one "pixel" of the 180x320 virtual screen
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const C = {
    blue: '#184AA1', blueL: '#2E6BD6', blueXL: '#8DB6FF', blueD: '#0F3274',
    navy: '#0A1633', navy2: '#060D22', navy3: '#13245A',
    white: '#F4F6FB', amber: '#FFB627', amberD: '#C98400',
    skin: '#F2C29B', skinD: '#D59C74',
  };
  const FONT = '"PX", monospace';

  const PL = window.ARCADE_PLAN;
  const plan = PL.makePlan();
  const { BW, BH, Y0, DEAD_Y, MUZZLE_Y, MUZZLE_DX, BULLET_V } = PL;
  const { CARD, LASER } = plan;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const q = v => Math.round(v / U) * U;                 // snap to the pixel grid
  const step = (x, n) => Math.floor(x * n) / n;         // stepped (8-bit) easing
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    outBack: x => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const blink = (t, hz) => Math.floor(t * hz * 2) % 2 === 0;
  const BEAT = 60 / 140;

  // ---------- assets ----------
  const mark = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load(`32px ${FONT}`),
  ]).then(() => document.fonts.ready).then(buildCaches);

  // ---------- drawing helpers ----------
  function fr(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function txt(s, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = `${size}px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = o.align || 'left';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.shadow !== false) {
      const d = o.sd || Math.max(U, Math.round(size / 8 / U) * U);
      ctx.fillStyle = o.shadow || C.navy2; ctx.fillText(s, Math.round(x + d), Math.round(y + d));
    }
    ctx.fillStyle = color; ctx.fillText(s, Math.round(x), Math.round(y));
    ctx.restore();
  }
  function sprite(rows, pal, x, y, s = U) {
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const k = rows[r][c]; if (k === '.') continue;
      ctx.fillStyle = pal[k]; ctx.fillRect(x + c * s, y + r * s, s, s);
    }
  }

  // ---------- sprites ----------
  const STUDENT = [
    '.....NNNNNN.....',
    '...NNNNNNNNNN...',
    '..NNNNNNNNNNNN..',
    '..NNNSSNNSSSNN..',
    '..NNSSSSSSSSNN..',
    '..NSSKSSSSKSSN..',
    '..NSSKSSSSKSSN..',
    '...SSSSSSSSSS...',
    '...SSSSKKSSSS...',
    '....SSSSSSSS....',
    '...WWWWSSWWWW...',
    '..ABBBWWWWBBBB..',
    '..ABBBBWWBBBBB..',
    '.SABBBBBBBBBBB..',
    '.SABBBBBBBBBBB..',
  ];
  const SPAL = { N: C.navy2, S: C.skin, K: C.navy2, W: C.white, B: C.blue, A: C.amber, D: C.blueD };

  // ---------- caches (CRT overlays, sky) ----------
  let scan, vign, sky;
  function buildCaches() {
    scan = document.createElement('canvas'); scan.width = W; scan.height = H;
    const s = scan.getContext('2d');
    s.fillStyle = 'rgba(0,0,0,0.30)';
    for (let y = 0; y < H; y += U) s.fillRect(0, y + 4, W, 2);
    s.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 0; x < W; x += 3) s.fillRect(x, 0, 1, H);           // faint aperture grille
    vign = document.createElement('canvas'); vign.width = W; vign.height = H;
    const v = vign.getContext('2d');
    v.fillStyle = '#000'; v.fillRect(0, 0, W, H);
    v.globalCompositeOperation = 'destination-out';                   // rounded tube corners
    v.beginPath(); v.roundRect(8, 8, W - 16, H - 16, 64); v.fill();
    v.globalCompositeOperation = 'source-over';
    const g = v.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.64);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
    // dithered navy sky bands
    sky = document.createElement('canvas'); sky.width = W; sky.height = H;
    const k = sky.getContext('2d');
    const bands = [C.navy2, '#08122B', C.navy, '#0D1C42', '#102350'];
    for (let i = 0; i < bands.length; i++) {
      const y0 = 1560 * i / bands.length, y1 = 1560 * (i + 1) / bands.length;
      k.fillStyle = bands[i]; k.fillRect(0, y0, W, y1 - y0 + 1);
      if (i > 0) { // checker dither on the seam
        k.fillStyle = bands[i - 1];
        for (let x = 0; x < W; x += U * 2) for (let r = 0; r < 3; r++) k.fillRect(x + (r % 2) * U, y0 + r * U, U, U);
      }
    }
    // campus skyline
    const bl = [[0, 1300, 150], [140, 1220, 130], [260, 1340, 120], [370, 1180, 170], [530, 1290, 110], [630, 1240, 160], [780, 1320, 120], [890, 1200, 190]];
    for (const [x, y, w] of bl) {
      k.fillStyle = '#0E1D47'; k.fillRect(x, y, w, 1560 - y);
      k.fillStyle = '#132A62'; k.fillRect(x, y, w, U);
      for (let wy = y + 24; wy < 1530; wy += 36) for (let wx = x + 18; wx < x + w - 18; wx += 30)
        if (rnd(wx * 0.7 + wy * 1.3) > 0.55) { k.fillStyle = rnd(wx + wy) > 0.8 ? '#5C4A1E' : '#1B3576'; k.fillRect(wx, wy, 12, 12); }
    }
    // clock tower
    k.fillStyle = '#0E1D47'; k.fillRect(450, 1110, 60, 80); k.fillRect(468, 1080, 24, 30);
    k.fillStyle = '#5C4A1E'; k.fillRect(468, 1128, 24, 24);
  }

  // ---------- state queries ----------
  const lastBefore = (arr, t, key = 't') => { let r = null; for (const e of arr) { if (e[key] <= t) r = e; else break; } return r; };
  function studentX(t) {
    const m = plan.moves;
    if (t <= m[0].t) return m[0].x;
    for (let i = 0; i < m.length - 1; i++) {
      if (t >= m[i].t && t <= m[i + 1].t) {
        const d = m[i + 1].t - m[i].t;
        return d <= 0 ? m[i + 1].x : lerp(m[i].x, m[i + 1].x, (t - m[i].t) / d);
      }
    }
    return m[m.length - 1].x;
  }
  function moving(t) { return Math.abs(studentX(t + 0.01) - studentX(t - 0.01)) > 1; }
  const lifeAt = t => plan.LIFE - plan.lands.filter(l => l.t <= t).length;
  function scoreAt(t) {
    let s = 0;
    for (const sh of plan.shots) if (sh.hitT <= t) s += 1500;
    for (const l of plan.laserHits) if (l.t <= t) s += 5000;
    return s;
  }
  const FINAL_SCORE = plan.shots.length * 1500 + plan.laserHits.length * 5000;
  const BONUS = 50000;

  function shake(t) {
    let a = 0;
    for (const l of plan.lands) { const d = t - l.t; if (d >= 0 && d < 0.22) a = Math.max(a, 12 * (1 - d / 0.22)); }
    const lz = t - LASER.t0;
    if (lz > 0 && lz < 1.4) a = Math.max(a, 22 * (1 - lz / 1.4));
    if (t < 0.25) a = Math.max(a, 14 * (1 - t / 0.25));
    if (a <= 0) return [0, 0];
    const f = Math.floor(t * 60);
    return [q((rnd(f) - 0.5) * 2 * a), q((rnd(f + 7) - 0.5) * 2 * a)];
  }

  // ---------- background ----------
  function starDist(t) { // stars scroll faster as the level heats up
    const a = Math.max(0, Math.min(t, 26) - 4);
    return t * 60 + a * a * 4 + Math.max(0, t - 26) * 120;
  }
  function background(t) {
    ctx.drawImage(sky, 0, 0);
    const d = starDist(t);
    for (let i = 0; i < 70; i++) {
      const layer = i % 3, sp = [0.35, 0.7, 1.3][layer];
      const y = ((rnd(i + 3) * 1500 + d * sp) % 1500 + 1500) % 1500 - 20;
      const x = q(rnd(i + 11) * W);
      if (y > 1200 - layer * 40 && rnd(i) > 0.3) continue;
      const tw = rnd(i + Math.floor(t * 4)) > 0.85;
      fr(x, q(y), layer === 2 ? 12 : U, layer === 2 ? 12 : U, tw ? C.amber : layer === 0 ? '#2B4A8F' : C.blueXL);
    }
    // ground: blue top row + navy bricks
    fr(0, 1560, W, 18, C.blue); fr(0, 1560, W, U, C.blueL);
    for (let r = 0; r < 4; r++) for (let x = -((r % 2) * 36); x < W; x += 72) {
      fr(x + 3, 1584 + r * 30, 66, 24, r === 0 ? C.blueD : '#0B1A44');
    }
    fr(0, 1704, W, H - 1704, C.navy2);
  }

  function deadline(t, top) {
    const danger = lifeAt(t) <= 6 && t < LASER.t0;
    const col = danger && blink(t, 3) ? C.white : C.amber;
    for (let x = 0; x < W; x += 48) fr(x + 6, DEAD_Y + U, 30, U, col);
    txt('deadline', 30, DEAD_Y + 24, 16, col, { sd: 4 });
  }

  // ---------- task blocks ----------
  const STYLE = {
    makalah: { bg: C.white, hi: '#FFFFFF', lo: '#C9D3E6', fg: C.navy },
    laporan: { bg: C.blue, hi: C.blueL, lo: C.blueD, fg: C.white },
    presentasi: { bg: C.amber, hi: '#FFD27A', lo: C.amberD, fg: C.navy },
    kuis: { bg: C.navy3, hi: '#22397A', lo: C.navy2, fg: C.amber },
  };
  function drawBlock(b, cx, y, sq = 0, flash = false) {
    const s = STYLE[b.label];
    const w = BW + sq * 24, h = BH - sq * 12, x = q(cx - w / 2), yy = q(y + (BH - h));
    fr(x, yy, w, h, C.navy2);
    fr(x + U, yy + U, w - 2 * U, h - 2 * U, flash ? C.white : s.bg);
    if (!flash) {
      fr(x + U, yy + U, w - 2 * U, U, s.hi);
      fr(x + U, yy + h - 2 * U, w - 2 * U, U, s.lo);
      fr(x + w - 2 * U, yy + U, U, h - 2 * U, s.lo);
      // folded page corner
      fr(x + w - 4 * U, yy + U, 2 * U, U, C.navy2); fr(x + w - 3 * U, yy + 2 * U, U, U, C.navy2);
    }
    txt(b.label, cx, yy + h / 2 - 12, 24, flash ? C.navy : s.fg, { align: 'center', shadow: false });
  }
  function blockY(b, t) {
    if (b.landT != null && t >= b.landT) return b.landY - BH;
    const tt = t >= LASER.t0 ? LASER.t0 : t; // the power-up freezes everything still falling
    return Y0 + b.v * (tt - b.ts);
  }
  function blocks(t) {
    for (const b of plan.blocks) {
      if (t < b.ts) continue;
      if (b.hitT != null && t >= b.hitT) continue;
      if (b.laserT != null && t >= b.laserT) continue;
      const y = blockY(b, t);
      if (y > 1500) continue;
      const sq = b.landT != null ? Math.max(0, 1 - (t - b.landT) / 0.12) * (t >= b.landT ? 1 : 0) : 0;
      const lit = b.laserT != null && t > b.laserT - 0.06;
      drawBlock(b, b.x, y, sq, lit);
    }
  }

  // ---------- fx ----------
  function burst(x, y, d, seed, big, col) {
    const n = big ? 26 : 16, dur = big ? 0.8 : 0.55;
    if (d < 0 || d > dur) return;
    // flash square
    if (d < 0.1) { const r = q(lerp(30, big ? 160 : 100, d / 0.1)); ctx.globalAlpha = 1 - d / 0.1; fr(x - r, y - r, r * 2, r * 2, C.white); ctx.globalAlpha = 1; }
    // ring of pixels
    if (d < 0.25) {
      const r = lerp(40, big ? 260 : 150, E.outCubic(d / 0.25));
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; fr(q(x + Math.cos(a) * r), q(y + Math.sin(a) * r), U * 2, U * 2, k % 2 ? C.amber : C.white); }
    }
    for (let k = 0; k < n; k++) {
      const a = rnd(seed * 31 + k) * Math.PI * 2, v = lerp(260, big ? 900 : 640, rnd(seed * 17 + k));
      const px = x + Math.cos(a) * v * d, py = y + Math.sin(a) * v * d + 900 * d * d;
      const sz = rnd(seed + k * 3) > 0.6 ? 18 : 12;
      const c = [C.white, C.amber, col || C.blueL, C.blueXL][(k + seed) % 4];
      if (d > dur * 0.7 && (k + Math.floor(d * 30)) % 2) continue;
      fr(q(px), q(py), sz, sz, c);
    }
  }
  function popup(s, x, y, d, col = C.amber) {
    if (d < 0 || d > 0.7) return;
    if (d > 0.45 && blink(d, 10)) return;
    txt(s, x, q(y - 90 * E.outCubic(d / 0.7)), 24, col, { align: 'center', sd: 4 });
  }
  function bullets(t) {
    for (const s of plan.shots) {
      const d = t - s.t;
      if (d < 0 || t > s.hitT) continue;
      const y = MUZZLE_Y - BULLET_V * d;
      for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.18 * (4 - k); fr(s.x - 6, q(y + k * 34), 12, 30, C.amber); }
      ctx.globalAlpha = 1;
      fr(s.x - 9, q(y), 18, 42, C.amber); fr(s.x - 3, q(y), 6, 42, '#FFF3C9'); fr(s.x - 6, q(y) - U, 12, U, C.white);
    }
    // muzzle flash
    const ls = lastBefore(plan.shots, t);
    if (ls && t - ls.t < 0.06) {
      const x = ls.x, y = MUZZLE_Y - 18;
      fr(x - 24, y - 6, 48, 12, C.white); fr(x - 6, y - 30, 12, 48, C.white); fr(x - 12, y - 12, 24, 24, C.amber);
    }
  }
  function explosions(t) {
    for (const s of plan.shots) {
      const d = t - s.hitT; if (d < 0 || d > 0.8) continue;
      const b = plan.blocks[s.id];
      burst(b.x, s.hitY - BH / 2, d, b.id, false, STYLE[b.label].bg);
      popup('+1500', b.x, s.hitY - BH, d);
    }
    for (const l of plan.lands) {
      const d = t - l.t; if (d < 0 || d > 0.35) continue;
      const b = plan.blocks[l.id];
      for (let k = 0; k < 8; k++) {
        const dir = k % 2 ? 1 : -1, px = b.x + dir * (BW / 2 - 10 + 260 * d * (0.5 + rnd(k + l.id))), py = b.landY - 12 - 120 * d + 500 * d * d;
        fr(q(px), q(py), 12, 12, k % 3 ? '#9AA6C4' : C.white);
      }
      popup('-1', b.x, b.landY - BH - 10, d * 2, C.white);
    }
    for (const l of plan.laserHits) {
      const d = t - l.t; if (d < 0 || d > 0.9) continue;
      const b = plan.blocks[l.id];
      burst(b.x, b.laserY + BH / 2, d, b.id + 100, true, STYLE[b.label].bg);
      popup('+5000', b.x, b.laserY, d * 0.9, C.white);
    }
  }

  // ---------- student ----------
  function student(t) {
    const cx = studentX(t);
    const x0 = q(cx - 48);
    let y0 = 1440;
    const ls = lastBefore(plan.shots, t);
    const recoil = ls && t - ls.t < 0.07 ? U : 0;
    const walking = moving(t);
    // victory hops on the beat after the screen is clear
    if (t > 29.9 && t < 34) { const ph = ((t - 29.9) / BEAT) % 1; y0 -= q(Math.sin(ph * Math.PI) * 42); }
    const powered = t >= CARD.catchT && t < 34;
    if (powered) { // pixel aura
      const pr = 1 + (Math.floor(t * 12) % 2);
      ctx.globalAlpha = 0.5; fr(x0 - U * 2 * pr, y0 - 24 - U * 2 * pr, 96 + U * 4 * pr, 144 + U * 4 * pr, C.blueL); ctx.globalAlpha = 1;
    }
    // legs
    const ph = walking ? Math.floor(t / 0.07) % 2 : 0;
    const lUp = walking && ph === 0 ? U : 0, rUp = walking && ph === 1 ? U : 0;
    const legY = y0 + 15 * U;
    fr(x0 + 2 * U, legY, 12 * U, U, C.navy2);
    fr(x0 + 2 * U, legY + U - lUp, 4 * U, 3 * U, C.navy2); fr(x0 + 10 * U, legY + U - rUp, 4 * U, 3 * U, C.navy2);
    fr(x0 + 1 * U, legY + 4 * U - lUp, 5 * U, U, C.white); fr(x0 + 10 * U, legY + 4 * U - rUp, 5 * U, U, C.white);
    fr(x0 + 1 * U, legY + 5 * U - lUp, 5 * U, U, C.navy2); fr(x0 + 10 * U, legY + 5 * U - rUp, 5 * U, U, C.navy2);
    // body
    sprite(STUDENT, SPAL, x0, y0 + recoil);
    // power-up flash: whole sprite briefly white
    if (t >= CARD.catchT && t < CARD.catchT + 0.3 && blink(t, 12)) { ctx.globalAlpha = 0.8; fr(x0 + U, y0, 14 * U, 20 * U, C.white); ctx.globalAlpha = 1; }
    // raised arm + pencil blaster (muzzle at cx + 42)
    const px = x0 + 14 * U, py = y0 - 4 * U + recoil;
    fr(x0 + 13 * U, y0 + 9 * U + recoil, 2 * U, 3 * U, C.blue);          // sleeve
    fr(x0 + 13 * U, y0 + 8 * U + recoil, 3 * U, 2 * U, C.skin);          // hand
    fr(px, py, 2 * U, U, C.navy2);                                      // lead
    fr(px, py + U, 2 * U, 2 * U, C.skin);                               // wood
    fr(px, py + 3 * U, 2 * U, 9 * U, powered ? C.blueL : C.amber);      // body
    fr(px + U, py + 3 * U, U, 9 * U, powered ? C.blueD : C.amberD);
    fr(px, py + 12 * U, 2 * U, U, C.white);
  }

  // ---------- HUD ----------
  function hud(t) {
    txt('skor', 60, 72, 24, C.amber, { sd: 4 });
    const sc = t < 34 ? scoreAt(t) : FINAL_SCORE;
    txt(String(sc).padStart(6, '0'), 60, 112, 40, C.white, { sd: U });
    const life = lifeAt(t);
    const low = life <= 6 && t < LASER.t0;
    txt('nyawa', 1020, 72, 24, low && blink(t, 3) ? C.white : C.amber, { align: 'right', sd: 4 });
    const segW = 18, gap = 6, x0 = 1020 - 20 * (segW + gap) + gap, y = 112;
    fr(x0 - 12, y - 12, 20 * (segW + gap) - gap + 24, 40 + 24, C.navy2);
    for (let i = 0; i < 20; i++) {
      const on = i < life;
      const justLost = plan.lands.some(l => t - l.t >= 0 && t - l.t < 0.3 && plan.LIFE - plan.lands.indexOf(l) - 1 === i);
      const c = on ? (low ? (blink(t, 3) ? C.amber : C.amberD) : C.white) : justLost && blink(t, 15) ? C.amber : '#1B2A55';
      fr(x0 + i * (segW + gap), y, segW, 40, c);
    }
    if (life <= 6 && t < LASER.t0 && blink(t, 2.5)) txt('bahaya!', 1020, 172, 24, C.amber, { align: 'right', sd: 4 });
  }

  // bottom console strip (no text in the TikTok-covered corner except the watermark)
  function consoleStrip(t) {
    txt('p1 mahasiswa', 60, 1756, 24, C.white, { sd: 4, alpha: 0.75 });
    txt('stage 1-1', 60, 1800, 20, C.amber, { sd: 4, alpha: 0.75 });
  }

  // ---------- hook text (0–4) ----------
  function hookText(t) {
    if (t > 4.1) return;
    const out = P(t, 3.65, 4.05);
    const sc = t < 0.3 ? 1 + 0.06 * (1 - step(t / 0.3, 4)) : 1;
    const dy = -q(E.inCubic(out) * 700);
    ctx.save(); ctx.translate(540, 560 + dy); ctx.scale(sc, sc); ctx.translate(-540, -560);
    // dark plate so the text reads over falling blocks
    ctx.globalAlpha = 0.72; fr(36, 376, 1008, 372, C.navy2); ctx.globalAlpha = 1;
    fr(36, 376, 1008, U, C.amber); fr(36, 742, 1008, U, C.amber);
    txt('level 1:', 540, 412, 64, blink(t, 4) || t > 1 ? C.amber : C.white, { align: 'center', sd: 8 });
    txt('tugas', 540, 504, 112, C.white, { align: 'center', sd: 12 });
    txt('menyerang!', 540, 634, 88, C.white, { align: 'center', sd: 10 });
    ctx.restore();
  }

  // "awas deadline!" warning banner as the stack grows
  function warning(t) {
    const a = 21.6, b = 25.4;
    if (t < a || t > b) return;
    if (!blink(t, 3)) return;
    fr(0, 300, W, 96, C.amber); fr(0, 300, W, U, '#FFD27A'); fr(0, 390, W, U, C.amberD);
    for (let x = -((t * 300) % 96); x < W; x += 96) { fr(x, 306, 36, 84, C.amberD); }
    fr(150, 318, 780, 60, C.amber);
    txt('awas deadline!', 540, 324, 48, C.navy, { align: 'center', shadow: false });
  }

  // ---------- power-up card ----------
  function card(t) {
    if (t < CARD.t0 || t >= CARD.catchT) return;
    const p = (t - CARD.t0) / (CARD.catchT - CARD.t0);
    const cy = lerp(-90, CARD.catchY, p), cx = CARD.x + q(Math.sin(t * 5) * 24);
    drawCard(cx, cy, 1, t);
    if (blink(t, 4)) txt('power-up!', cx, q(cy - 130), 24, C.amber, { align: 'center', sd: 4 });
  }
  function drawCard(cx, cy, s, t) {
    const w = 216 * s, h = 132 * s, x = q(cx - w / 2), y = q(cy - h / 2);
    // glow rings
    const g = (Math.floor(t * 10) % 3);
    ctx.globalAlpha = 0.35; fr(x - 18 - g * U, y - 18 - g * U, w + 36 + g * 12, h + 36 + g * 12, C.blueL); ctx.globalAlpha = 1;
    fr(x - U, y - U, w + 2 * U, h + 2 * U, C.white);
    fr(x, y, w, h, C.blue); fr(x, y, w, U, C.blueL); fr(x, y + h - U, w, U, C.blueD);
    fr(x + 12, y + 12, 36, 36, C.amber); fr(x + 24, y + 12, 12, 36, '#FFD27A');      // chip / star
    txt('mintask', cx, y + h - 54, 24 * s, C.white, { align: 'center', sd: 4 });
    // sparkles
    for (let k = 0; k < 4; k++) {
      if (rnd(k + Math.floor(t * 8)) < 0.5) continue;
      const sx = q(x + rnd(k * 5 + Math.floor(t * 8)) * w), sy = q(y + rnd(k * 9 + Math.floor(t * 8)) * h);
      fr(sx - U, sy, 3 * U, U, C.white); fr(sx, sy - U, U, 3 * U, C.white);
    }
  }

  // ---------- laser ----------
  function laser(t) {
    const d = t - LASER.t0;
    if (d < -0.7 || d > 1.4) return;
    const mx = studentX(t) + MUZZLE_DX;
    if (d < 0) { // charging: pixels converging on the muzzle
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + t * 3, r = 200 * (-d / 0.7);
        fr(q(mx + Math.cos(a) * r), q(MUZZLE_Y + Math.sin(a) * r), 12, 12, k % 2 ? C.white : C.blueXL);
      }
      return;
    }
    if (d < 1.3) {
      const grow = E.outCubic(P(d, 0, 0.15)), fade = 1 - P(d, 1.0, 1.3);
      const w = q(lerp(24, 240, grow) * fade + 6);
      ctx.globalAlpha = 0.18 * fade; fr(0, 0, W, 1560, C.blueL); ctx.globalAlpha = 1;
      for (let y = 0; y < MUZZLE_Y; y += 24) { // jagged pixel edges
        const j = (Math.floor(y / 24) + Math.floor(t * 30)) % 3 * U;
        fr(mx - w / 2 - 18 - j, y, w + 36 + 2 * j, 24, C.blue);
        fr(mx - w / 2 - j / 2, y, w + j, 24, C.blueL);
        fr(mx - w * 0.3, y, w * 0.6, 24, C.blueXL);
        fr(mx - w * 0.14, y, w * 0.28, 24, C.white);
      }
      fr(mx - 60, MUZZLE_Y - 30, 120, 60, C.white);
    }
    // shock walls sweeping out to both edges, clearing the screen
    const sw = P(d, 0.08, 0.6);
    if (sw > 0 && sw < 1) {
      for (const dir of [-1, 1]) {
        const x = 540 + dir * sw * 600;
        for (let y = 0; y < 1560; y += 24) {
          const j = rnd(y + Math.floor(t * 40)) * 30;
          fr(q(x - 18 - j * dir), y, 36, 24, C.blueL); fr(q(x - 6), y, 12, 24, C.white);
        }
      }
    }
    if (d < 0.08) { ctx.globalAlpha = 0.7 * (1 - d / 0.08); fr(0, 0, W, H, C.white); ctx.globalAlpha = 1; }
  }

  // typed "bantuan datang." (scene 3)
  function helpText(t) {
    if (t < 27.75 || t > 34) return;
    const s = 'bantuan datang.';
    const n = Math.min(s.length, Math.floor((t - 27.75) / 0.045));
    const shown = s.slice(0, n);
    ctx.globalAlpha = 0.72; fr(36, 470, 1008, 200, C.navy2); ctx.globalAlpha = 1;
    fr(36, 470, 1008, U, C.blueL); fr(36, 664, 1008, U, C.blueL);
    const tw1 = 96 * 7, tw2 = 80 * 8;
    const l1 = shown.slice(0, 7), l2 = shown.length > 8 ? shown.slice(8) : '';
    txt(l1, 540 - tw1 / 2, 496, 96, C.white, { sd: 10 });
    txt(l2, 540 - tw2 / 2, 600, 80, C.amber, { sd: 10 });
    if (n < s.length && blink(t, 6)) fr(540 - (n <= 7 ? tw1 / 2 - n * 96 : tw2 / 2 - (n - 8) * 80), n <= 7 ? 496 : 600, 24, n <= 7 ? 96 : 80, C.white);
    if (t > 29.9) {
      const b = Math.round(lerp(0, BONUS, P(t, 29.9, 31.2)));
      if (t < 33.6 || blink(t, 4)) txt('bonus mintask +' + b, 540, 712, 32, C.blueXL, { align: 'center', sd: 4 });
    }
  }

  // ---------- stage clear (34–37.2) ----------
  function stageClear(t) {
    fr(0, 0, W, H, C.navy2);
    // checker border
    for (let x = 0; x < W; x += 36) for (const y of [210, 1500]) fr(x, y + ((x / 36) % 2) * 18, 18, 18, C.blue);
    // falling confetti pixels
    for (let k = 0; k < 40; k++) {
      const y = ((rnd(k) * 1900 + (t - 34) * (200 + rnd(k + 3) * 300)) % 1900);
      fr(q(rnd(k + 9) * W), q(y), 12, 12, [C.amber, C.white, C.blueL][k % 3]);
    }
    const flick = blink(t, 3);
    txt('stage', 540, 330, 120, flick ? C.white : C.amber, { align: 'center', sd: 12 });
    txt('clear!', 540, 480, 120, flick ? C.amber : C.white, { align: 'center', sd: 12 });
    const rows = [['skor', FINAL_SCORE, 34.5], ['bonus', BONUS, 34.9], ['total', FINAL_SCORE + BONUS, 35.4]];
    rows.forEach(([k, v, a], i) => {
      if (t < a) return;
      const val = i === 2 ? Math.round(lerp(FINAL_SCORE, v, P(t, a, a + 0.9))) : v;
      const y = 760 + i * 110;
      txt(k, 140, y, 48, i === 2 ? C.amber : C.white, { sd: U });
      txt(String(val).padStart(6, '0'), 940, y, 48, i === 2 ? C.amber : C.white, { align: 'right', sd: U });
    });
    if (t > 36.3) {
      const s = E.outBack(P(t, 36.3, 36.55));
      ctx.save(); ctx.translate(540, 1210); ctx.scale(s, s); ctx.rotate(-0.06);
      fr(-330, -64, 660, 128, C.amber); fr(-318, -52, 636, 104, C.navy2);
      txt('hi-score!', 0, -24, 48, C.amber, { align: 'center', sd: U });
      ctx.restore();
    }
    // student cameo, celebrating
    const hop = q(Math.abs(Math.sin((t - 34) / BEAT * Math.PI)) * 36);
    sprite(STUDENT, SPAL, 492, 1330 - hop);
  }

  // ---------- end card (37.2–40) ----------
  let mosaic;
  function endCard(t) {
    // pixel-tile dissolve into brand blue
    const T = 60, cols = W / T, rows = Math.ceil(H / T);
    const p = P(t, 37.0, 37.45);
    if (p < 1) stageClear(t);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const order = (rnd(r * 31 + c * 7) * 0.6 + (r / rows) * 0.4);
      if (order < p) fr(c * T, r * T, T, T, C.blue);
    }
    if (t < 37.45) return;
    // logo mark: mosaic reveal (chunky -> crisp)
    const lp = P(t, 37.45, 38.15);
    const sz = 420, lx = 540 - sz / 2, ly = 520;
    const res = [6, 10, 16, 26, 44, 80, 140, 420][Math.min(7, Math.floor(lp * 8))];
    if (!mosaic) { mosaic = document.createElement('canvas'); }
    mosaic.width = res; mosaic.height = res;
    const m = mosaic.getContext('2d'); m.imageSmoothingEnabled = true; m.clearRect(0, 0, res, res);
    m.drawImage(mark, 0, 0, res, res);
    ctx.save(); ctx.imageSmoothingEnabled = res >= 420;
    const pop = lp < 1 ? 1 : 1 + 0.04 * Math.max(0, Math.sin((t - 38.15) * 12) * Math.exp(-(t - 38.15) * 5));
    ctx.translate(540, ly + sz / 2); ctx.scale(pop, pop);
    ctx.drawImage(mosaic, -sz / 2, -sz / 2, sz, sz);
    ctx.restore(); ctx.imageSmoothingEnabled = false;
    // wordmark + tagline
    if (t > 38.0) txt('taskkora', 540, 1010, 88, C.white, { align: 'center', sd: 10, shadow: C.blueD });
    if (t > 38.5) {
      const s = 'ada task? taskkora-in aja.';
      const n = Math.min(s.length, Math.floor((t - 38.5) / 0.03));
      const size = 36, x0 = 540 - s.length * size / 2;
      fr(x0 - 30, 1150, s.length * size + 60, 84, C.navy);
      txt(s.slice(0, n), x0, 1174, size, C.amber, { sd: 4, shadow: C.navy2 });
    }
  }

  // ---------- CRT post ----------
  function crt(t) {
    // rolling bright band
    const by = ((t * 260) % (H + 400)) - 200;
    const g = ctx.createLinearGradient(0, by - 120, 0, by + 120);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.045)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, by - 120, W, 240);
    ctx.drawImage(scan, 0, 0);
    // power-on: bright bloom + collapsing scan beam (frame 0 already shows the game)
    if (t < 0.35) {
      const k = 1 - t / 0.35;
      ctx.globalAlpha = 0.35 * k * k; fr(0, 0, W, H, '#DDE8FF'); ctx.globalAlpha = 1;
      const ly = q(H / 2 + (rnd(Math.floor(t * 60)) - 0.5) * 200);
      ctx.globalAlpha = k; fr(0, ly, W, 12, C.white); ctx.globalAlpha = 1;
    }
    // flicker
    ctx.globalAlpha = 0.02 * rnd(Math.floor(t * 60)); fr(0, 0, W, H, C.white); ctx.globalAlpha = 1;
    ctx.drawImage(vign, 0, 0);
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.3;
    ctx.font = `20px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.white;
    ctx.fillText('@taskkora__', 1036, 1860);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    fr(0, 0, W, H, '#000');
    if (t < 34) {
      const [sx, sy] = shake(t);
      ctx.save(); ctx.translate(sx, sy);
      background(t);
      deadline(t);
      blocks(t);
      card(t);
      bullets(t);
      laser(t);
      student(t);
      explosions(t);
      ctx.restore();
      hud(t);
      consoleStrip(t);
      warning(t);
      hookText(t);
      helpText(t);
      if (t > 33.75) { // horizontal shutter into the stage-clear screen
        const p = P(t, 33.75, 34.0);
        for (let y = 0; y < H; y += 60) fr(0, y, W, q(60 * p), C.navy2);
      }
    } else if (t < 37.0) stageClear(t);
    else endCard(t);
    crt(t);
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
