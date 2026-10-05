/* "Level 1: Tugas Menyerang!" — 40s, 1080x1920, 8-bit arcade on a CRT.
 * The game world is drawn on a 270x480 pixel buffer (x4), then composited with CRT glow,
 * scanlines and bezel. Every frame is a pure function of time; the game itself lives in game.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, S = 4, DURATION = 40;
  const G = window.ARCADE, F = window.PIXFONT, T = G.T;
  const LW = G.LW, LH = G.LH;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const lo = Object.assign(document.createElement('canvas'), { width: LW, height: LH });
  const lx = lo.getContext('2d');

  const C = {
    blue: '#184AA1', blueHi: '#3A6BD0', blueLo: '#0F3275', sky: '#8FB8FF', laser: '#4C7FE0',
    white: '#F4F7FF', paper: '#E6ECF8', paperLo: '#AFBEDF',
    navy: '#0B1640', navy2: '#13245C', navy3: '#1D2E6E', bg: '#060B24', ink: '#03061A',
    amber: '#FFB627', amberHi: '#FFD27A', amberLo: '#C98500',
    skin: '#F2C79E', hair: '#1A1F45',
  };

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    outBack: x => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const blink = (t, hz) => Math.floor(t * hz * 2) % 2 === 0;
  const r = Math.round;

  // ---------- assets ----------
  const mark = new Image();
  const ready = new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; });

  // ---------- sprites ----------
  const PAL = { K: C.ink, H: C.hair, S: C.skin, W: C.white, B: C.blue, A: C.amber, N: C.navy3, L: C.blueHi };
  const BODY = [
    '....KKKKKKK.....',
    '...KHHHHHHHK....',
    '..KHHHHHHHHHK...',
    '..KHHSSSSHHHK...',
    '..KHSSSSSSSHK...',
    '..KSWWSSWWSSK...',
    '..KSWKSSWKSSK...',
    '..KSSSSSSSSSK...',
    '...KSSKKKSSK.KSK',
    '....KSSSSSK..KSK',
    '..KKBBWWWBBKKBK.',
    '.KBBBBWAWBBBBBK.',
    'KBKBBBWAWBBBKK..',
    'KSKBBBWAWBBBK...',
    'KSKBBBBBBBBBK...',
    '.K.KLBBBBBBLK...',
    '...KNNNNNNNNK...',
    '...KNNNKKNNNK...',
  ];
  const LEGS_A = ['...KNNK..KNNK...', '...KNNK..KNNK...', '..KWWWK..KWWWK..', '..KKKKK..KKKKK..'];
  const LEGS_B = ['...KNNK..KNNK...', '..KNNK....KNNK..', '.KWWWK....KWWWK.', '.KKKKK....KKKKK.'];
  const LEGS_J = ['...KNNK..KNNK...', '..KNNK....KNNK..', '..KWWK....KWWK..', '..KKK......KKK..'];

  const K = 2; // student is drawn at 2x so he reads on a phone
  function sprite(rows, x, y, tint, k = K) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '.') continue;
        lx.fillStyle = tint || PAL[c];
        lx.fillRect(x + i * k, y + j * k, k, k);
      }
    });
  }

  // pencil blaster, tip at (gx, gy)
  function pencil(gx, gy, glow) {
    const x = gx - 2;
    lx.fillStyle = C.ink; lx.fillRect(x - 1, gy + 2, 7, 34);
    lx.fillStyle = C.navy; lx.fillRect(gx - 1, gy, 2, 3);                 // lead
    lx.fillStyle = '#F3D7A8'; lx.fillRect(gx - 1, gy + 3, 2, 2); lx.fillRect(x, gy + 5, 5, 3); // wood
    lx.fillStyle = glow ? C.sky : C.amber; lx.fillRect(x, gy + 8, 5, 19);
    lx.fillStyle = glow ? C.white : C.amberLo; lx.fillRect(x + 2, gy + 8, 1, 19);
    lx.fillStyle = glow ? C.white : C.amberHi; lx.fillRect(x, gy + 8, 1, 19);
    lx.fillStyle = C.paperLo; lx.fillRect(x, gy + 27, 5, 3);
    lx.fillStyle = C.white; lx.fillRect(x, gy + 30, 5, 5);
  }

  // student: cx = sprite centre, feet on GROUND
  function student(t, cx, opts = {}) {
    const top = G.GROUND - 22 * K + (opts.dy || 0);
    const x = r(cx) - 8 * K;
    const legs = opts.jump ? LEGS_J : opts.walk && blink(t, 6) ? LEGS_B : LEGS_A;
    if (opts.glow) {
      const col = blink(t, 8) ? C.sky : C.laser;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { sprite(BODY, x + dx, top + dy, col); sprite(legs, x + dx, top + 18 * K + dy, col); }
    }
    const tint = opts.hurt ? C.white : null;
    pencil(r(cx) + G.GUN_DX, top - 4 + (opts.recoil ? 2 : 0), opts.glow);
    sprite(BODY, x, top, tint);
    sprite(legs, x, top + 18 * K, tint);
  }

  // ---------- blocks ----------
  const STYLE = {
    makalah: { f: C.blue, hi: C.blueHi, lo: C.blueLo, tx: C.white },
    laporan: { f: C.paper, hi: '#FFFFFF', lo: C.paperLo, tx: C.navy },
    presentasi: { f: C.amber, hi: C.amberHi, lo: C.amberLo, tx: C.navy },
    kuis: { f: C.navy3, hi: '#3150B0', lo: C.navy2, tx: C.amber },
  };
  function block(label, cx, y, flash) {
    const s = STYLE[label], x = r(cx - G.BW / 2); y = r(y);
    lx.fillStyle = C.ink; lx.fillRect(x - 1, y - 1, G.BW + 2, G.BH + 2);
    lx.fillStyle = flash ? C.white : s.f; lx.fillRect(x, y, G.BW, G.BH);
    if (flash) return;
    lx.fillStyle = s.hi; lx.fillRect(x, y, G.BW, 1); lx.fillRect(x, y, 1, G.BH);
    lx.fillStyle = s.lo; lx.fillRect(x, y + G.BH - 2, G.BW, 2); lx.fillRect(x + G.BW - 1, y, 1, G.BH);
    // rivets
    lx.fillStyle = s.lo; lx.fillRect(x + 2, y + 2, 1, 1); lx.fillRect(x + G.BW - 3, y + 2, 1, 1);
    F.text(lx, label, cx, y + 4, 1, s.tx, { align: 'center' });
  }

  // ---------- particles ----------
  function explosion(x, y, age, id, cols, big) {
    if (age < 0 || age > 0.7) return;
    if (age < 0.1) { // square shock ring
      const rr = r(4 + age * (big ? 260 : 170));
      lx.fillStyle = C.white;
      lx.fillRect(r(x) - rr, r(y) - rr, rr * 2, 2); lx.fillRect(r(x) - rr, r(y) + rr - 2, rr * 2, 2);
      lx.fillRect(r(x) - rr, r(y) - rr, 2, rr * 2); lx.fillRect(r(x) + rr - 2, r(y) - rr, 2, rr * 2);
    }
    const n = big ? 20 : 14;
    for (let k = 0; k < n; k++) {
      const a = rnd(id * 31 + k) * Math.PI * 2, sp = 50 + rnd(id * 17 + k * 3) * (big ? 150 : 110);
      const px = x + Math.cos(a) * sp * age, py = y + Math.sin(a) * sp * age * 0.8 + 170 * age * age;
      const sz = Math.max(1, r((big ? 4 : 3) * (1 - age / 0.7)));
      lx.fillStyle = cols[k % cols.length];
      lx.fillRect(r(px), r(py), sz, sz);
    }
  }
  function popText(str, x, y, age, col) {
    if (age < 0 || age > 0.75) return;
    if (age > 0.5 && blink(age, 10)) return;
    F.text(lx, str, x, y - 6 - r(age * 34), 1, col, { align: 'center', outline: C.ink });
  }

  // ---------- background ----------
  const STARS = Array.from({ length: 80 }, (_, i) => ({ x: rnd(i) * LW, y: rnd(i + 99) * LH, z: 0.3 + rnd(i + 7) * 0.7 }));
  const scroll = t => 10 * t + 0.6 * Math.pow(Math.max(0, Math.min(t, 26) - 8), 2);
  function stars(t, k = 1) {
    const sc = scroll(t) * k;
    for (const [i, s] of STARS.entries()) {
      const y = (s.y + sc * s.z) % LH;
      lx.fillStyle = s.z > 0.75 ? (blink(t + i * 0.13, 1.5) ? C.white : C.sky) : s.z > 0.5 ? C.laser : C.navy3;
      const streak = t > 16 && t < 26 && s.z > 0.6 ? 3 : 1;
      lx.fillRect(r(s.x), r(y), 1, streak);
    }
  }
  const BUILD = [];
  { let x = -4, i = 0; while (x < LW + 4) { const w = 18 + r(rnd(i + 3) * 26), h = 26 + r(rnd(i + 5) * 46); BUILD.push({ x, w, h, i }); x += w + 2; i++; } }
  function city(t) {
    for (const b of BUILD) {
      const y = G.GROUND - b.h;
      lx.fillStyle = '#0A1438'; lx.fillRect(b.x, y, b.w, b.h);
      lx.fillStyle = '#0E1B4A'; lx.fillRect(b.x, y, b.w, 1);
      for (let wy = y + 4; wy < G.GROUND - 6; wy += 6) for (let wx = b.x + 3; wx < b.x + b.w - 3; wx += 5) {
        const k = b.i * 97 + wx * 3 + wy * 7;
        if (rnd(k) < 0.35) { lx.fillStyle = rnd(k + Math.floor(t / 3)) < 0.8 ? '#3B3A3A' : '#6B5422'; lx.fillRect(wx, wy, 2, 2); }
      }
    }
  }
  function floor() {
    const y0 = G.GROUND;
    lx.fillStyle = C.blue; lx.fillRect(0, y0, LW, 2);
    lx.fillStyle = C.navy; lx.fillRect(0, y0 + 2, LW, LH - y0);
    lx.fillStyle = C.navy2;
    for (let row = 0; row * 8 + y0 + 4 < LH; row++) {
      const yy = y0 + 4 + row * 8;
      lx.fillRect(0, yy + 7, LW, 1);
      for (let x = (row % 2) * 12; x < LW; x += 24) lx.fillRect(x, yy, 1, 7);
    }
  }

  // ---------- HUD ----------
  function hud(t) {
    lx.fillStyle = 'rgba(4,8,30,0.92)'; lx.fillRect(0, 26, LW, G.HUD_B - 26);
    lx.fillStyle = C.blue; lx.fillRect(0, G.HUD_B, LW, 1); lx.fillRect(0, 26, LW, 1);
    F.text(lx, 'skor', 8, 31, 1, C.amber);
    F.text(lx, String(G.score(t)).padStart(6, '0'), 8, 42, 1, C.white);
    F.text(lx, 'level', LW / 2, 31, 1, C.amber, { align: 'center' });
    F.text(lx, '01', LW / 2, 42, 1, C.white, { align: 'center' });
    F.text(lx, 'nyawa', LW - 8, 31, 1, C.amber, { align: 'right' });
    const life = G.life(t), seg = 10, lit = Math.ceil(life / 10 - 0.001);
    const low = life < 35 && t < T.CATCH;
    for (let i = 0; i < seg; i++) {
      const x = LW - 8 - (seg - i) * 6 + 1;
      lx.fillStyle = C.navy2; lx.fillRect(x, 42, 5, 7);
      if (i < lit && !(low && blink(t, 4))) {
        lx.fillStyle = low ? C.amber : life < 60 ? C.amberHi : C.sky;
        lx.fillRect(x, 42, 5, 7);
        lx.fillStyle = C.white; lx.fillRect(x, 42, 5, 1);
      }
    }
  }

  function banner(str, t, t0, t1, y, col) {
    if (t < t0 || t > t1) return;
    if (t > t1 - 0.4 && blink(t, 6)) return;
    const w = F.measure(str) + 12;
    lx.fillStyle = 'rgba(4,8,30,0.85)'; lx.fillRect(r(LW / 2 - w / 2), y - 4, w, 15);
    F.text(lx, str, LW / 2, y, 1, col, { align: 'center' });
  }

  // =====================================================================
  // GAME WORLD (0–34s)
  function world(t) {
    lx.fillStyle = C.bg; lx.fillRect(0, 0, LW, LH);
    stars(t);
    city(t);
    floor();

    const pops = []; // explosions to draw on top
    for (const b of G.blocks) {
      if (t < b.ts) continue;
      const cols = [STYLE[b.label].f, STYLE[b.label].hi, C.white, C.amber];
      if (b.hit) {
        if (t < b.hit.th) {
          const y = G.yAt(b, t);
          if (b.v > 112) { lx.fillStyle = 'rgba(143,184,255,0.35)'; lx.fillRect(r(b.x - 20), r(y - 9), 1, 6); lx.fillRect(r(b.x + 19), r(y - 7), 1, 5); }
          block(b.label, b.x, y, t > b.hit.th - 0.035);
        } else pops.push(() => { explosion(b.x, b.hit.y + 8, t - b.hit.th, b.id, cols); popText('+100', b.x, b.hit.y, t - b.hit.th, C.amber); });
        continue;
      }
      if (b.land) {
        if (t < b.land.tl) { block(b.label, b.x, G.yAt(b, t), false); continue; }
        if (!b.land.stays) { pops.push(() => explosion(b.x, b.land.y + 8, t - b.land.tl, b.id, [C.amber, C.amberLo, C.white])); continue; }
        if (b.pop && t >= b.pop.t) { pops.push(() => { explosion(b.x, b.land.y + 8, t - b.pop.t, b.id, cols, true); popText('+500', b.x, b.land.y, t - b.pop.t, C.sky); }); continue; }
        // piled up: shudders on impact
        const j = t - b.land.tl < 0.15 ? (blink(t, 30) ? 1 : -1) : 0;
        block(b.label, b.x + j, b.land.y, false);
        continue;
      }
      if (b.laser) {
        const y = G.yAt(b, Math.min(t, b.pop.t));
        if (t < b.pop.t) block(b.label, b.x, y, t > b.pop.t - 0.04);
        else pops.push(() => { explosion(b.x, y + 8, t - b.pop.t, b.id, cols, true); popText('+500', b.x, y, t - b.pop.t, C.sky); });
      }
    }

    // bullets + muzzle flash
    for (const s of G.shots) {
      if (t >= s.tf && t < s.th) {
        const y = G.GUN_Y - G.VB * (t - s.tf);
        lx.fillStyle = 'rgba(255,182,39,0.5)'; lx.fillRect(s.x, r(y) + 6, 1, 8);
        lx.fillStyle = C.amber; lx.fillRect(s.x - 1, r(y), 3, 7);
        lx.fillStyle = C.white; lx.fillRect(s.x, r(y), 1, 5);
      }
      if (t >= s.tf && t < s.tf + 0.06) {
        lx.fillStyle = C.white; lx.fillRect(s.x - 1, G.GUN_Y - 6, 3, 5); lx.fillRect(s.x - 3, G.GUN_Y - 4, 7, 1);
        lx.fillStyle = C.amber; lx.fillRect(s.x, G.GUN_Y - 9, 1, 3);
      }
    }

    // power-up card
    if (t >= T.CARD && t < T.CATCH) {
      const p = (t - T.CARD) / (T.CATCH - T.CARD);
      const cy = lerp(G.Y0, G.CARD_Y_CATCH - 14, p), cx = G.CARD_X + r(Math.sin(t * 5) * 2);
      card(t, cx, cy);
    }

    // student
    const px = G.playerX(t);
    const recoil = G.shots.some(s => t >= s.tf && t < s.tf + 0.07);
    const hurt = G.landings.some(l => t >= l.tl && t < l.tl + 0.3 && l.tl < T.CATCH) && blink(t, 12);
    let dy = 0, jump = false;
    if (t > 30.9 && t < 33.9) { const h = ((t - 30.9) % 0.6) / 0.6; dy = -r(Math.sin(h * Math.PI) * 14); jump = dy < -2; }
    student(t, px, { walk: G.playerMoving(t), recoil, hurt, glow: t >= T.CATCH && t < 31.4, dy, jump });

    pops.forEach(f => f());

    // catch flash + charge + laser
    if (t >= T.CATCH && t < T.CATCH + 0.12) explosion(G.CARD_X, G.CARD_Y_CATCH, t - T.CATCH, 999, [C.sky, C.white], true);
    if (t >= T.CATCH + 0.2 && t < T.FIRE) charge(t);
    if (t >= T.FIRE && t < 31.3) laser(t);

    hud(t);

    // ---- texts ----
    hook(t);
    if (t >= 3.95 && t < 4.6 && !(t > 4.35 && blink(t, 8))) {
      F.text(lx, 'mulai!', LW / 2, 130, 3, C.amber, { align: 'center', outline: C.ink });
    }
    banner('kecepatan naik!', t, 15.6, 17.0, 64, C.amber);
    banner('tugas menumpuk!', t, 21.6, 23.0, 64, C.amber);
    if (G.life(t) < 45 && t > 23.2 && t < T.CARD && blink(t, 3)) banner('nyawa menipis!', t, 23.2, T.CARD, 64, C.white);
    if (t >= T.CATCH && t < T.CATCH + 1.0 && !(t > T.CATCH + 0.7 && blink(t, 8))) {
      F.text(lx, 'power up!', G.CARD_X, G.GROUND - 84, 2, C.amber, { align: 'center', outline: C.ink });
    }
    if (t >= 26.15 && t < 33.9) helpText(t);
  }

  function card(t, cx, cy) {
    const w = 54, h = 30, x = r(cx - w / 2), y = r(cy);
    // halo
    if (blink(t, 4)) { lx.fillStyle = 'rgba(143,184,255,0.35)'; lx.fillRect(x - 3, y - 3, w + 6, h + 6); }
    lx.fillStyle = C.ink; lx.fillRect(x - 1, y - 1, w + 2, h + 2);
    lx.fillStyle = C.white; lx.fillRect(x, y, w, h);
    lx.fillStyle = C.blue; lx.fillRect(x + 2, y + 2, w - 4, h - 4);
    lx.fillStyle = C.blueHi; lx.fillRect(x + 2, y + 2, w - 4, 1);
    // tiny check badge + star
    lx.fillStyle = C.amber; lx.fillRect(x + 5, y + 5, 5, 5);
    lx.fillStyle = C.navy; lx.fillRect(x + 6, y + 7, 1, 1); lx.fillRect(x + 7, y + 8, 1, 1); lx.fillRect(x + 8, y + 6, 1, 2);
    F.text(lx, 'mintask', cx, y + 15, 1, C.white, { align: 'center' });
    lx.fillStyle = C.sky; lx.fillRect(x + 13, y + 7, 30, 2);
    // sparkles orbiting
    for (let k = 0; k < 4; k++) {
      const a = t * 4 + k * Math.PI / 2, sx = r(cx + Math.cos(a) * 36), sy = r(y + h / 2 + Math.sin(a) * 22);
      lx.fillStyle = k % 2 ? C.amber : C.white;
      lx.fillRect(sx, sy - 1, 1, 3); lx.fillRect(sx - 1, sy, 3, 1);
    }
  }

  function charge(t) {
    const gx = G.CARD_X, gy = G.GUN_Y - 4, p = P(t, T.CATCH + 0.2, T.FIRE);
    for (let k = 0; k < 18; k++) {
      const a = rnd(k + 400) * Math.PI * 2, ph = (t * 1.8 + rnd(k + 500)) % 1;
      const d = (1 - ph) * 70;
      lx.fillStyle = k % 3 ? C.sky : C.white;
      lx.fillRect(r(gx + Math.cos(a) * d), r(gy + Math.sin(a) * d * 0.7), 2, 2);
    }
    const rr = r(2 + p * 7 + (blink(t, 14) ? 1 : 0));
    lx.fillStyle = C.laser; lx.fillRect(gx - rr - 1, gy - rr - 1, rr * 2 + 3, rr * 2 + 3);
    lx.fillStyle = C.white; lx.fillRect(gx - rr + 1, gy - rr + 1, rr * 2 - 1, rr * 2 - 1);
  }

  function laser(t) {
    const gx = G.CARD_X, gy = G.GUN_Y - 4;
    let hw;
    if (t < T.FIRE + 0.1) hw = 9 * P(t, T.FIRE, T.FIRE + 0.1);
    else if (t < T.FIRE + 0.45) hw = 9;
    else if (t < T.FIRE + 0.85) hw = lerp(9, 150, E.inCubic(P(t, T.FIRE + 0.45, T.FIRE + 0.85)));
    else hw = 150 * (1 - E.outCubic(P(t, T.FIRE + 0.95, 31.3)));
    const fullA = 1 - P(t, T.FIRE + 1.0, 31.3);
    if (hw < 0.5) return;
    for (let y = 0; y < gy; y += 2) {
      const j = (rnd(y * 13 + Math.floor(t * 60)) - 0.5) * 3;
      const w = hw + j;
      lx.globalAlpha = fullA;
      lx.fillStyle = C.laser; lx.fillRect(r(gx - w - 3), y, r(w * 2 + 6), 2);
      lx.fillStyle = C.sky; lx.fillRect(r(gx - w * 0.68), y, r(w * 1.36), 2);
      lx.fillStyle = C.white; lx.fillRect(r(gx - w * 0.32), y, r(w * 0.64) + 1, 2);
    }
    lx.globalAlpha = 1;
    // muzzle bloom
    lx.fillStyle = C.white; lx.fillRect(gx - 8, gy - 6, 17, 10);
  }

  function hook(t) {
    if (t >= 3.95) return;
    // panel collapses on exit
    const out = P(t, 3.7, 3.95);
    const y0 = 92, h = 84;
    const hh = r(h * (1 - E.inCubic(out)));
    const cy = y0 + h / 2;
    lx.fillStyle = 'rgba(4,8,30,0.88)'; lx.fillRect(10, r(cy - hh / 2), LW - 20, hh);
    lx.fillStyle = C.blue; lx.fillRect(10, r(cy - hh / 2), LW - 20, 2); lx.fillRect(10, r(cy + hh / 2) - 2, LW - 20, 2);
    lx.fillStyle = C.amber;
    for (const [x, y] of [[10, cy - hh / 2], [LW - 14, cy - hh / 2], [10, cy + hh / 2 - 4], [LW - 14, cy + hh / 2 - 4]]) lx.fillRect(x, r(y), 4, 4);
    if (out > 0.4) return;
    // slam: one step bigger on the very first frames
    const big = t < 0.1;
    F.text(lx, 'level 1:', LW / 2, big ? 96 : 100, big ? 4 : 3, C.amber, { align: 'center', outline: C.ink });
    const s2 = 2;
    const w = F.measure('tugas menyerang!') * s2;
    // second line shakes a little like it's under attack
    const jx = t < 1.2 ? (blink(t, 16) ? 1 : -1) : 0;
    F.text(lx, 'tugas menyerang!', LW / 2 + jx, 138, s2, (i) => (i === 15 && blink(t, 4) ? C.amber : C.white), { align: 'center', outline: C.ink });
    void w;
  }

  function helpText(t) {
    const n = (t - 26.15) * 22;
    const y = 104;
    const w = F.measure('bantuan datang.') * 2 + 20;
    const a = clamp((t - 26.15) / 0.1);
    lx.globalAlpha = a;
    lx.fillStyle = 'rgba(4,8,30,0.85)'; lx.fillRect(r(LW / 2 - w / 2), y - 8, w, 32);
    lx.fillStyle = C.blue; lx.fillRect(r(LW / 2 - w / 2), y - 8, w, 2); lx.fillRect(r(LW / 2 - w / 2), y + 22, w, 2);
    lx.globalAlpha = 1;
    F.text(lx, 'bantuan datang.', LW / 2, y, 2, C.white, { align: 'center', count: n, outline: C.ink });
    if (n < 15 && blink(t, 6)) { // cursor
      const shown = 'bantuan datang.'.slice(0, Math.floor(n));
      const x0 = LW / 2 - F.measure('bantuan datang.') + F.measure(shown) * 2 + 3;
      lx.fillStyle = C.amber; lx.fillRect(r(x0), y, 6, 14);
    }
    if (t > 31.2) {
      F.text(lx, 'semua tugas beres!', LW / 2, 138, 1, C.amber, { align: 'center', count: (t - 31.2) * 30, outline: C.ink });
    }
  }

  // =====================================================================
  // STAGE CLEAR (34–37)
  const FIREWORKS = [[34.3, 60, 90], [34.8, 210, 70], [35.3, 120, 300], [35.8, 230, 260], [36.3, 50, 240], [36.6, 160, 60]];
  function stageClear(t) {
    lx.fillStyle = C.bg; lx.fillRect(0, 0, LW, LH);
    stars(t, 0.3);
    floor();
    FIREWORKS.forEach(([t0, x, y], i) => {
      const age = t - t0;
      if (age < 0 || age > 0.9) return;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, d = E.outCubic(age / 0.9) * 46;
        lx.fillStyle = [C.amber, C.white, C.sky][(k + i) % 3];
        if (age > 0.6 && blink(age, 10)) continue;
        lx.fillRect(r(x + Math.cos(a) * d), r(y + Math.sin(a) * d + age * age * 30), 2, 2);
      }
    });
    const tt = t - T.STAGE;
    const hop = (tt % 0.5) / 0.5;
    student(t, LW / 2, { dy: -r(Math.sin(hop * Math.PI) * 18), jump: true });
    // title
    const s1 = tt < 0.08 ? 6 : 5;
    F.text(lx, 'stage', LW / 2, 104 - (s1 - 5) * 4, s1, (i) => (blink(t + i * 0.05, 4) ? C.amber : C.amberHi), { align: 'center', outline: C.ink });
    if (tt > 0.18) F.text(lx, 'clear!', LW / 2, tt < 0.26 ? 146 : 150, tt < 0.26 ? 6 : 5, C.white, { align: 'center', outline: C.ink });
    if (tt > 0.5) {
      F.text(lx, 'skor akhir', LW / 2, 222, 1, C.amber, { align: 'center' });
      const sc = String(G.score(t)).padStart(6, '0');
      F.text(lx, sc, LW / 2, 236, 3, C.white, { align: 'center', outline: C.blue });
    }
    if (tt > 1.9 && blink(t, 3)) F.text(lx, 'rekor baru!', LW / 2, 272, 2, C.amber, { align: 'center', outline: C.ink });
    hud(t);
    // row-wipe in from the game screen
    if (tt < 0.25) {
      const n = r(LH * (1 - tt / 0.25));
      lx.fillStyle = C.bg; lx.fillRect(0, LH - n, LW, n);
    }
  }

  // =====================================================================
  // LOGO (37–40)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function logoBg(t) {
    lx.fillStyle = C.blue; lx.fillRect(0, 0, LW, LH);
    lx.fillStyle = '#1D52AE';
    for (let y = 4; y < LH; y += 8) for (let x = 4; x < LW; x += 8) lx.fillRect(x, y, 1, 1);
    for (let k = 0; k < 14; k++) { // drifting pixels
      const x = r(rnd(k + 800) * LW), y = r((rnd(k + 900) * LH - (t - T.LOGO) * (14 + k * 2)) % LH + LH) % LH;
      lx.fillStyle = k % 3 ? 'rgba(244,247,255,0.35)' : 'rgba(255,182,39,0.6)';
      lx.fillRect(x, y, 2, 2);
    }
  }
  function ditherIn(p) { // ordered-dither cells of brand blue over the previous screen
    const cs = 10;
    lx.fillStyle = C.blue;
    for (let y = 0; y < LH; y += cs) for (let x = 0; x < LW; x += cs) {
      const b = BAYER[((y / cs) % 4) * 4 + ((x / cs) % 4)] / 16;
      if (b < p) lx.fillRect(x, y, cs, cs);
    }
  }

  const tmp = Object.assign(document.createElement('canvas'), { width: 440, height: 440 });
  const tx = tmp.getContext('2d');
  function logoFull(t) { // drawn on the full-res canvas, under the CRT layers
    const p = P(t, 37.4, 38.0);
    if (p <= 0) return;
    const size = 460, cx = W / 2, cy = 700;
    const sc = E.outBack(P(t, 37.4, 37.75));
    const bs = Math.max(1, r(lerp(46, 1, E.outCubic(p))));
    const n = Math.max(2, r(size / bs));
    tx.clearRect(0, 0, 440, 440);
    tx.imageSmoothingEnabled = true;
    tx.drawImage(mark, 0, 0, n, n);
    ctx.save();
    ctx.imageSmoothingEnabled = bs <= 1;
    ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,10,50,0.35)'; ctx.shadowOffsetY = 16; ctx.shadowBlur = 0;
    ctx.drawImage(tmp, 0, 0, n, n, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  function logoText(t) {
    if (t > 37.95) {
      const s = t < 38.03 ? 16 : 14;
      F.text(ctx, 'taskkora', W / 2, 1000 - (s - 14) * 4, s, C.white, { align: 'center', shadow: C.navy });
    }
    if (t > 38.35) F.text(ctx, 'ada task?', W / 2, 1150, 9, C.amber, { align: 'center', shadow: C.navy, count: (t - 38.35) * 26 });
    if (t > 38.8) F.text(ctx, 'taskkora-in aja.', W / 2, 1250, 9, C.white, { align: 'center', shadow: C.navy, count: (t - 38.8) * 26 });
  }

  // =====================================================================
  // CRT compositor
  const small = Object.assign(document.createElement('canvas'), { width: 90, height: 160 });
  const sx = small.getContext('2d');
  const scan = (() => {
    const c = Object.assign(document.createElement('canvas'), { width: 4, height: 4 }), g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 2, 4, 1);
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(0, 3, 4, 1);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(3, 0, 1, 4);
    return ctx.createPattern(c, 'repeat');
  })();
  const bezel = (() => {
    const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d');
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.beginPath(); g.rect(0, 0, W, H); g.roundRect(14, 14, W - 28, H - 28, 64); g.fill('evenodd');
    g.strokeStyle = 'rgba(143,184,255,0.10)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(16, 16, W - 32, H - 32, 62); g.stroke();
    const gl = g.createLinearGradient(0, 0, W * 0.6, H * 0.35);
    gl.addColorStop(0, 'rgba(255,255,255,0.07)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 64); g.fill();
    return c;
  })();

  function shake(t) {
    let a = 0;
    for (const l of G.landings) if (t >= l.tl && l.tl < T.CATCH) a += 3 * Math.max(0, 1 - (t - l.tl) / 0.3);
    for (const s of G.shots) if (t >= s.th) a += 1 * Math.max(0, 1 - (t - s.th) / 0.1);
    if (t < 0.3) a += 3 * (1 - t / 0.3);
    if (t >= T.CATCH) a += 2 * Math.max(0, 1 - (t - T.CATCH) / 0.3);
    if (t >= T.FIRE && t < 30.9) a += 3;
    if (t >= T.STAGE) a += 2 * Math.max(0, 1 - (t - T.STAGE) / 0.3);
    if (t >= T.LOGO + 0.4) a += 2 * Math.max(0, 1 - (t - T.LOGO - 0.4) / 0.25);
    a = Math.min(a, 5);
    const f = Math.floor(t * 30);
    return [r((rnd(f) - 0.5) * 2 * a), r((rnd(f + 50) - 0.5) * 2 * a)];
  }

  function render(t) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // ---- pixel world ----
    if (t < T.STAGE) world(t);
    else if (t < T.LOGO) stageClear(t);
    else { if (t < T.LOGO + 0.45) { stageClear(t); ditherIn(P(t, T.LOGO, T.LOGO + 0.45)); } else logoBg(t); }

    // ---- composite ----
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const [dx, dy] = shake(t);
    const on = t < 0.16 ? lerp(0.72, 1, E.outCubic(t / 0.16)) : 1; // CRT power-on: picture snaps open
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lo, dx * S, r(H / 2 - (H / 2) * on) + dy * S, W, r(H * on));
    if (t >= T.LOGO) { logoFull(t); logoText(t); }

    // glow
    sx.imageSmoothingEnabled = true; sx.clearRect(0, 0, 90, 160); sx.drawImage(canvas, 0, 0, 90, 160);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    const laserGlow = t >= T.FIRE && t < 31.3 ? 0.25 : 0;
    ctx.globalAlpha = 0.2 + laserGlow;
    ctx.drawImage(small, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // power-on flash
    if (t < 0.28) {
      ctx.fillStyle = `rgba(220,235,255,${0.3 * (1 - t / 0.28)})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.2})`; ctx.fillRect(0, H / 2 - 6, W, 12);
    }
    // damage tint
    let dmg = 0;
    for (const l of G.landings) if (t >= l.tl && l.tl < T.CATCH) dmg = Math.max(dmg, 1 - (t - l.tl) / 0.25);
    if (dmg > 0) { ctx.fillStyle = `rgba(255,182,39,${0.16 * dmg})`; ctx.fillRect(0, 0, W, H); }

    // scanlines, rolling band, flicker
    ctx.fillStyle = scan; ctx.globalAlpha = t >= T.LOGO + 0.5 ? 0.7 : 1; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const by = ((t * 300) % (H + 400)) - 200;
    const band = ctx.createLinearGradient(0, by - 120, 0, by + 120);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(200,220,255,0.035)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band; ctx.fillRect(0, by - 120, W, 240);
    ctx.fillStyle = `rgba(0,0,0,${0.025 * rnd(Math.floor(t * 60))})`; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(bezel, 0, 0);

    // watermark (on the glass, ~30% opacity, whole video)
    ctx.globalAlpha = 0.3;
    F.text(ctx, '@taskkora__', W - 46, H - 74, 3, '#FFFFFF', { align: 'right' });
    ctx.globalAlpha = 1;
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
