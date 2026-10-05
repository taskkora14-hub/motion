/* "LEVEL 1: TUGAS MENYERANG!" — 8-bit arcade spot, 40s, 1080x1920.
 * Everything is drawn on a 270x480 art-pixel grid (1 art px = 4 screen px) with a hand-made 5x7
 * pixel font, then a CRT pass (scanlines, glow, vignette). Every frame is a pure function of time;
 * the game itself (spawns, shots, hits, damage) is scripted in sim.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, U = 4, DURATION = 40;
  const S = window.ARCADE_SIM, { T, FW, GROUND, GUN_Y, BLOCK_W, BLOCK_H, BULLET_V, CARD_X, G } = S;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    navy: '#0A1638', navy2: '#060E26', navy3: '#13245A', blue: '#184AA1', blueL: '#3D73D6', blueD: '#0F2F6E',
    sky: '#8DB5FF', white: '#FFFFFF', cream: '#F4F1EA', amber: '#FFB627', amberD: '#C9800C', amberL: '#FFD877',
    ink: '#050A1C', skin: '#F2C39B', skinD: '#D59A70', hair: '#1A1F3D',
  };

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const outBack = x => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const outCubic = x => 1 - Math.pow(1 - x, 3);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const blink = (t, hz) => Math.floor(t * hz * 2) % 2 === 0;

  // ---------- assets ----------
  const mark = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load('500 30px "WM"'),
  ]).then(() => document.fonts.ready);

  // ---------- pixel primitives (art-pixel coordinates) ----------
  let OX = 0, OY = 0; // screen shake, in whole art pixels
  function R(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect((Math.round(x) + OX) * U, (Math.round(y) + OY) * U, Math.round(w) * U, Math.round(h) * U); }

  // 5x7 pixel font (original glyphs)
  const FONT = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
    G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
    J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
    S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
    V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
    Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
    0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
    3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
    6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
    9: '01110100011000101111000010001001100',
    ':': '00000011000110000000011000110000000', '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100',
    '.': '00000000000000000000000000110001100', ',': '00000000000000000000011000010001000', '-': '00000000000000011111000000000000000',
    '+': '00000001000010011111001000010000000', '*': '00000100010101000100010101000100000', '<': '01010111111111111111011100010000000',
    ' ': '00000000000000000000000000000000000',
  };
  const textW = (s, sc) => (s.length * 6 - 1) * sc;
  function text(str, x, y, sc, col, o = {}) {
    str = String(str).toUpperCase();
    const w = textW(str, sc);
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
    cx = Math.round(cx);
    const draw = (dx, dy, c) => {
      for (let i = 0; i < str.length; i++) {
        const g = FONT[str[i]] || FONT[' '];
        if (o.reveal != null && i >= o.reveal) break;
        for (let p = 0; p < 35; p++) if (g[p] === '1') R(cx + i * 6 * sc + (p % 5) * sc + dx, y + Math.floor(p / 5) * sc + dy, sc, sc, c);
      }
    };
    if (o.shadow) draw(o.sd || sc, o.sd || sc, o.shadow);
    draw(0, 0, col);
    return w;
  }

  // sprite from string rows + palette
  function sprite(rows, x, y, sc, pal, flip = false) {
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) {
      const ch = rows[r][flip ? w - 1 - c : c];
      if (ch !== '.') R(x + c * sc, y + r * sc, sc, sc, pal[ch]);
    }
  }

  // ---------- student (12x18 sprite, drawn at 2x) ----------
  const STUDENT_TOP = [
    '...kkkkkk...',
    '..khhhhhhk..',
    '.khhhhhhhhk.',
    '.khhhhhhhhk.',
    '.khssssssshk',
    '.kskssssksk.',
    '.kssssssssk.',
    '..kssmmssk..',
    '...kkkkkk...',
    '..kwbbbbwk..',
    '.kbabbbbabk.',
    'kbbabbbbabbk',
  ];
  const STUDENT_HANDS = ['ksbabbbbabsk', 'kskbbbbbbksk'];
  const STUDENT_SHOOT = ['kbbabbbbabk.', 'kskbbbbbbk..'];
  const LEGS = [
    ['.kkddddddkk.', '..kdddkddk..', '..kdddkddk..', '..kkk..kkk..'],
    ['.kkddddddkk.', '..kddk.kddk.', '.kddk...kk..', '.kkk........'],
    ['.kkddddddkk.', '.kddk.kddk..', '..kk...kddk.', '........kkk.'],
  ];
  const SPAL = { m: '#C8695A', k: C.ink, h: C.hair, s: C.skin, w: C.white, b: C.blue, a: C.amber, d: C.navy3 };

  function student(x, t, o = {}) {
    const sc = 3, top = GROUND - 18 * sc - (o.jump || 0);
    const left = Math.round(x - (o.aim ? 6.5 * sc : 0)) - 6 * sc; // aim: x is the gun column
    const moving = o.moving, shooting = o.shooting;
    const legs = moving ? LEGS[1 + (Math.floor(t * 10) % 2)] : LEGS[0];
    const bob = moving && Math.floor(t * 10) % 2 ? 1 : 0;
    sprite(STUDENT_TOP, left, top + bob, sc, SPAL);
    sprite(shooting ? STUDENT_SHOOT : STUDENT_HANDS, left, top + 12 * sc + bob, sc, SPAL);
    sprite(legs, left, top + 14 * sc, sc, SPAL);
    // pencil blaster held up in the right hand (sprite-pixel units)
    const Q = (c, r, w, h, col) => R(left + c * sc, top + bob + r * sc + (shooting && r < 7 ? 1 : 0), w * sc, h * sc, col);
    Q(12, -4, 1, 1, C.ink);                                      // graphite tip
    Q(12, -3, 1, 1, C.skinD);                                    // sharpened wood
    Q(12, -2, 1, 7, C.amber);                                    // body
    R(left + 12 * sc + sc - 1, top + bob - 2 * sc, 1, 7 * sc, C.amberD);
    Q(12, 5, 1, 1, C.sky);                                       // ferrule
    Q(12, 6, 1, 1, C.cream);                                     // eraser
    Q(11, 7, 2, 2, C.skin);                                      // hand
    Q(11, 9, 1, 2, C.blue);                                      // raised sleeve
    return { gunX: left + 12 * sc + sc / 2, gunY: top + bob - 4 * sc };
  }

  // ---------- background ----------
  function background(t, inten) {
    R(0, 0, FW, 480, C.navy);
    // gradient bands toward the horizon
    for (let i = 0; i < 6; i++) R(0, 300 + i * 22, FW, 22, ['#0B1A42', '#0C1C48', '#0E1F4E', '#102354', '#12265A', '#13285E'][i]);
    // falling star field — faster as the pressure rises
    for (let i = 0; i < 70; i++) {
      const sp = (14 + rnd(i) * 40) * (1 + inten * 3);
      const y = ((rnd(i + 50) * 480 + t * sp + i * 7 * inten * 0) % 480);
      const x = Math.floor(rnd(i + 99) * FW);
      const big = rnd(i + 7) > 0.85;
      R(x, y, 1, big ? 2 + Math.round(inten * 3) : 1 + Math.round(inten * 2), big ? C.sky : C.blueL);
    }
    // campus skyline
    const sky = [[0, 34, 28], [26, 50, 22], [46, 26, 40], [84, 62, 30], [112, 38, 20], [130, 80, 36], [164, 44, 30], [192, 58, 24], [214, 30, 26], [238, 48, 32]];
    for (const [x, h, w] of sky) {
      R(x, GROUND - h, w, h, C.navy3);
      for (let wy = GROUND - h + 6; wy < GROUND - 6; wy += 8) for (let wx = x + 4; wx < x + w - 4; wx += 7) {
        const on = rnd(wx * 3 + wy) > 0.55;
        if (on) R(wx, wy, 3, 3, rnd(wx + wy * 7) > 0.8 ? C.amberD : '#1E3878');
      }
    }
    R(130 + 14, GROUND - 92, 8, 12, C.navy3); R(130 + 17, GROUND - 100, 2, 8, C.navy3); // clock tower spire
    R(130 + 15, GROUND - 88, 6, 6, C.amberD);
    // ground: brick floor
    R(0, GROUND, FW, 480 - GROUND, C.blueD);
    R(0, GROUND, FW, 2, C.blueL);
    for (let r = 0; r < 5; r++) for (let c = -1; c < 20; c++) {
      const bx = c * 16 + (r % 2) * 8, by = GROUND + 4 + r * 8;
      R(bx, by, 15, 7, r % 2 ? '#123A84' : '#143F8E');
    }
  }

  // ---------- task block ----------
  function block(b, t) {
    const yb = b.v * (t - b.t0), y = yb - BLOCK_H, x = b.x - BLOCK_W / 2;
    R(x, y, BLOCK_W, BLOCK_H, C.ink);
    R(x + 1, y + 1, BLOCK_W - 2, BLOCK_H - 2, C.blue);
    R(x + 1, y + 1, BLOCK_W - 2, 2, C.blueL);
    R(x + 1, y + BLOCK_H - 3, BLOCK_W - 2, 2, C.blueD);
    R(x + 1, y + 1, 2, BLOCK_H - 2, C.blueL);
    // a folded corner like a document
    R(x + BLOCK_W - 6, y + 1, 5, 5, C.white); R(x + BLOCK_W - 6, y + 1, 4, 4, C.blueD);
    R(x + BLOCK_W - 3, y + 1, 2, 2, C.navy);
    text(b.label, b.x - 3, y + 5, 1, C.white, { shadow: C.blueD, sd: 1 });
    // a danger flash right before it hits the floor
    if (!b.kill && !b.clear && b.tg - t < 0.35 && blink(t, 8)) R(x + 1, y + 1, BLOCK_W - 2, BLOCK_H - 2, 'rgba(255,182,39,0.45)');
  }

  // ---------- bursts ----------
  function burst(x, y, age, seed, n, size, cols) {
    if (age < 0 || age > 0.8) return;
    for (let i = 0; i < n; i++) {
      const a = rnd(seed * 13 + i) * Math.PI * 2, sp = 40 + rnd(seed * 7 + i) * 110 * size;
      const px = x + Math.cos(a) * sp * age, py = y + Math.sin(a) * sp * age + 160 * age * age;
      const s = Math.max(1, Math.round((1 - age / 0.8) * (2 + rnd(i + seed) * 3)));
      R(px, py, s, s, cols[i % cols.length]);
    }
    if (age < 0.12) { const r = Math.round(4 + age * 120 * size); R(x - r, y - 1, r * 2, 2, C.white); R(x - 1, y - r, 2, r * 2, C.white); }
    if (age < 0.08) R(x - 6 * size, y - 6 * size, 12 * size, 12 * size, 'rgba(255,255,255,0.8)');
  }
  function popup(str, x, y, age, col) {
    if (age < 0 || age > 0.7) return;
    if (age > 0.5 && blink(age, 12)) return;
    text(str, x, y - age * 30, 1, col, { shadow: C.ink, sd: 1 });
  }

  // ---------- HUD ----------
  const pad6 = n => String(Math.round(n)).padStart(6, '0');
  function hud(t, st, hp) {
    R(0, 0, FW, 28, 'rgba(6,14,38,0.85)');
    R(0, 28, FW, 1, C.blueL);
    text('SKOR', 8, 5, 1, C.amber, { align: 'left' });
    text(pad6(st.score), 8, 15, 1, C.white, { align: 'left' });
    text('HI 050000', 135, 5, 1, C.sky);
    text('LV 1', 135, 15, 1, C.white);
    // health bar
    const bx = 190, bw = 72;
    text('HP', bx, 5, 1, C.amber, { align: 'left' });
    R(bx + 13, 4, bw - 13, 9, C.ink);
    const segs = 10, filled = Math.ceil(clamp(hp) * segs - 0.001), low = hp < 0.35;
    for (let i = 0; i < segs; i++) {
      const on = i < filled;
      const col = !on ? C.navy3 : low ? (blink(t, 4) ? C.amber : C.white) : C.amber;
      R(bx + 14 + i * 5.7, 5, 5, 7, col);
    }
    text(low ? 'BAHAYA!' : 'NYAWA', bx + 41, 16, 1, low && blink(t, 3) ? C.amber : C.sky);
  }

  // ---------- power-up card ----------
  function card(x, y, t, sc = 1) {
    const w = 50 * sc, h = 22 * sc, gl = blink(t, 6);
    R(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, gl ? C.amber : C.amberL);
    R(x - w / 2, y - h / 2, w, h, C.white);
    R(x - w / 2 + sc, y - h / 2 + sc, w - 2 * sc, h - 2 * sc, C.blue);
    R(x - w / 2 + sc, y - h / 2 + sc, w - 2 * sc, 2 * sc, C.blueL);
    text('MINTASK', x, y - 2 * sc, sc, C.white, { shadow: C.blueD, sd: sc });
    R(x - 10 * sc, y + 7 * sc, 20 * sc, sc, C.amber);
  }
  function sparkle(x, y, s, col) { R(x - s, y, s * 2 + 1, 1, col); R(x, y - s, 1, s * 2 + 1, col); }

  // =====================================================================
  //  GAME (0 – 34)
  // =====================================================================
  function game(t) {
    const inten = clamp((t - T.HOOK) / (26 - T.HOOK)) * (t < T.LASER ? 1 : clamp(1 - (t - T.LASER) / 0.6));
    const st = S.stateAt(t);
    let hp = st.hp;
    if (t > T.CATCH) hp = lerp(hp, 1, outCubic(P(t, T.CATCH + 0.05, T.CATCH + 0.7)));

    // shake on crashes and laser
    let shake = 0;
    for (const e of G.events) {
      if (e.t > t) break;
      if (e.type === 'crash' && t - e.t < 0.25) shake = Math.max(shake, 3 * (1 - (t - e.t) / 0.25));
    }
    if (t > T.LASER && t < T.LASER + 0.8) shake = Math.max(shake, 4 * (1 - (t - T.LASER) / 0.8));
    if (t < 0.25) shake = Math.max(shake, 4 * (1 - t / 0.25));
    OX = shake ? Math.round((rnd(Math.floor(t * 60)) - 0.5) * 2 * shake) : 0;
    OY = shake ? Math.round((rnd(Math.floor(t * 60) + 3) - 0.5) * 2 * shake) : 0;

    background(t, inten);

    // blocks
    for (const b of G.blocks) if (t >= b.t0 && t < b.end) block(b, t);

    // bullets
    for (const b of G.blocks) {
      if (!b.kill || t < b.ts || t >= b.th) continue;
      const y = GUN_Y - (t - b.ts) * BULLET_V;
      R(b.x - 1, y, 3, 8, C.amberL); R(b.x, y - 2, 1, 12, C.white);
    }

    // power-up card falling, then caught
    if (t >= T.POWER && t < T.CATCH) {
      const p = P(t, T.POWER, T.CATCH);
      const y = lerp(-14, GROUND - 40, p), x = CARD_X + Math.sin(t * 5) * 6 * (1 - p);
      card(x, y, t);
      for (let i = 0; i < 4; i++) { const a = t * 4 + i * 1.57; sparkle(x + Math.cos(a) * 34, y + Math.sin(a) * 18, 2, i % 2 ? C.amberL : C.white); }
      if (t < T.POWER + 1.4 && blink(t, 5)) text('POWER-UP!', x, y - 26, 1, C.amber, { shadow: C.ink, sd: 1 });
    }

    // player
    const px = S.playerX(t);
    const shooting = G.keys.some(k => k.shot != null && t >= k.t && t - k.t < 0.09) || (t > T.LASER && t < T.LASER + 1.1);
    const jump = t > 31.1 && t < 34 ? Math.abs(Math.sin((t - 31.1) * Math.PI * 1.75)) * 14 : t > T.CATCH && t < T.CATCH + 0.3 ? Math.sin(P(t, T.CATCH, T.CATCH + 0.3) * Math.PI) * 8 : 0;
    const powered = t > T.CATCH && t < 31.2;
    if (powered && blink(t, 10)) { // power aura
      R(px - 40, GROUND - 66 - jump, 50, 66, 'rgba(61,115,214,0.35)');
    }
    const gun = student(px, t, { aim: true, moving: S.playerMoving(t) && t < 31.1, shooting, jump });

    // muzzle flashes
    for (const k of G.keys) if (k.shot != null && t >= k.t && t - k.t < 0.06) { R(gun.gunX - 3, gun.gunY - 5, 7, 5, C.amberL); R(gun.gunX - 1, gun.gunY - 8, 3, 3, C.white); }

    // laser wipe
    if (t >= T.LASER - 0.05 && t < T.LASER + 1.3) laser(t, gun);

    // explosions + score popups
    for (const b of G.blocks) {
      if (b.kill) { const age = t - b.th, yb = b.v * (b.th - b.t0) - BLOCK_H / 2; burst(b.x, yb, age, b.id, 14, 1, [C.amber, C.white, C.amberL, C.blueL]); popup('+100', b.x, yb - 12, age, C.amberL); }
      else if (b.clear) { const age = t - b.end, yb = b.v * (b.end - b.t0) - BLOCK_H / 2; burst(b.x, yb, age, b.id, 18, 1.3, [C.sky, C.white, C.blueL, C.amberL]); popup('+250', b.x, yb - 12, age, C.white); }
      else { const age = t - b.tg; burst(b.x, GROUND - 4, age, b.id, 20, 1.2, [C.amber, C.amberD, C.white]); popup('-HP', b.x, GROUND - 24, age, C.amber); }
    }

    // catch flash + text
    if (t >= T.CATCH && t < T.CATCH + 0.6) {
      const a = 1 - P(t, T.CATCH, T.CATCH + 0.4);
      R(0, 0, FW, 480, `rgba(255,255,255,${0.5 * a})`);
      for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, r = 10 + (t - T.CATCH) * 160; sparkle(px - 19 + Math.cos(ang) * r, GROUND - 30 + Math.sin(ang) * r, 3, i % 2 ? C.amber : C.white); }
    }

    // danger vignette when HP is low
    if (hp < 0.4 && t < T.CATCH) {
      const a = (0.4 - hp) * 0.9 * (0.6 + 0.4 * Math.sin(t * 14));
      ctx.save(); ctx.globalAlpha = clamp(a);
      R(0, 29, 4, 480, C.amber); R(FW - 4, 29, 4, 480, C.amber); R(0, 29, FW, 3, C.amber); R(0, GROUND - 3, FW, 3, C.amber);
      ctx.restore();
    }

    hud(t, st, hp);

    // warning banner as the pile-up peaks
    if (t > 21 && t < T.POWER - 0.2 && blink(t, 2.5)) {
      R(60, 38, 150, 15, 'rgba(6,14,38,0.85)');
      text('!! DEADLINE !!', 135, 42, 1, C.amber);
    }

    // ---- hook text 0–4 ----
    if (t < 3.85) hookText(t);
    // ---- "bantuan datang." 30.6–34 ----
    if (t > 30.6) helpText(t);

    OX = OY = 0;
  }

  function hookText(t) {
    const gl = t > 3.55; // glitch out
    if (gl && blink(t, 14)) return;
    R(0, 82, FW, 112, 'rgba(6,14,38,0.78)');
    R(0, 82, FW, 2, C.amber); R(0, 192, FW, 2, C.amber);
    const jit = gl ? Math.round((rnd(Math.floor(t * 30)) - 0.5) * 8) : 0;
    // slam: each line drops in, frame 0 already shows the first line
    const l1 = Math.round((1 - outBack(P(t, 0, 0.16))) * -8);
    const l2 = Math.round((1 - outBack(P(t, 0, 0.22))) * -12);
    const l3 = Math.round((1 - outBack(P(t, 0, 0.28))) * -16);
    text('LEVEL 1:', 135 + jit, 92 + l1, 3, C.amber, { shadow: C.ink, sd: 2 });
    text('TUGAS', 135 - jit, 120 + l2, 4, C.white, { shadow: C.blue, sd: 3 });
    text('MENYERANG!', 135 + jit, 154 + l3, 4, C.white, { shadow: C.blue, sd: 3 });
  }

  function helpText(t) {
    const p = P(t, 30.6, 30.9);
    R(0, 92, FW, 92 * outCubic(p), 'rgba(6,14,38,0.78)');
    if (p < 1) return;
    R(0, 92, FW, 2, C.blueL); R(0, 182, FW, 2, C.blueL);
    const n = Math.floor((t - 30.9) / 0.06);
    text('BANTUAN', 135, 104, 4, C.white, { shadow: C.blue, sd: 3, reveal: n });
    text('DATANG.', 135, 142, 4, C.amber, { shadow: C.ink, sd: 3, reveal: Math.max(0, n - 7) });
    if (t > 32.0) for (let i = 0; i < 6; i++) if (blink(t + i * 0.13, 3)) sparkle(20 + i * 46, 98 + (i % 2) * 78, 2, i % 2 ? C.amberL : C.white);
  }

  function laser(t, gun) {
    const t0 = T.LASER, x = gun.gunX;
    const grow = outCubic(P(t, t0, t0 + 0.1));
    const spread = outCubic(P(t, t0 + 0.12, t0 + 0.65));
    const fade = 1 - P(t, t0 + 0.9, t0 + 1.3);
    const top = 29, bot = gun.gunY;
    const halfW = lerp(4, Math.max(x, FW - x) + 10, spread);
    const l = Math.max(0, x - halfW), r = Math.min(FW, x + halfW);
    ctx.save(); ctx.globalAlpha = fade;
    // wide sweep: blue band with pixel scan
    if (spread > 0) {
      R(l, top, r - l, bot - top, 'rgba(24,74,161,0.55)');
      for (let y = top; y < bot; y += 4) R(l, y, r - l, 1, 'rgba(141,181,255,0.35)');
      R(l, top, 3, bot - top, C.sky); R(r - 3, top, 3, bot - top, C.sky);
    }
    // core beam
    const cw = Math.round(lerp(2, 14, grow) + Math.sin(t * 60) * 2);
    const ytop = lerp(bot, top, grow);
    R(x - cw - 4, ytop, (cw + 4) * 2, bot - ytop, C.blue);
    R(x - cw, ytop, cw * 2, bot - ytop, C.blueL);
    R(x - Math.max(1, cw / 2), ytop, Math.max(2, cw), bot - ytop, C.white);
    // muzzle bloom
    R(x - 10, bot - 6, 20, 8, C.white);
    ctx.restore();
    if (t < t0 + 0.08) R(0, 0, FW, 480, 'rgba(255,255,255,0.7)');
  }

  // =====================================================================
  //  STAGE CLEAR (34 – 37)  →  LOGO (37 – 40)
  // =====================================================================
  function stageClear(t) {
    background(t, 0);
    student(135, t, { jump: Math.abs(Math.sin((t - 34) * Math.PI * 1.75)) * 12 });
    // fireworks
    for (let i = 0; i < 5; i++) {
      const tb = 34.2 + i * 0.5, x = 40 + rnd(i + 3) * 190, y = 230 + rnd(i + 9) * 120;
      burst(x, y, t - tb, 300 + i, 22, 1.4, [C.amber, C.white, C.sky, C.amberL]);
    }
    R(0, 70, FW, 150, 'rgba(6,14,38,0.82)');
    R(0, 70, FW, 2, C.amber); R(0, 218, FW, 2, C.amber);
    const s1 = outBack(P(t, 34.0, 34.25)), s2 = outBack(P(t, 34.12, 34.37));
    if (s1 > 0) text('STAGE', 135, 82 + Math.round((1 - s1) * -24), 5, C.white, { shadow: C.blue, sd: 3 });
    if (s2 > 0) text('CLEAR!', 135, 124 + Math.round((1 - s2) * -24), 5, blink(t, 4) ? C.amber : C.amberL, { shadow: C.ink, sd: 3 });
    // score tally
    const base = G.finalScore, bonus = 50000;
    const p = P(t, 34.7, 36.0), sc = Math.round(base + bonus * p);
    text('SKOR', 70, 176, 2, C.sky);
    text(pad6(sc), 70, 196, 2, C.white, { shadow: C.blue, sd: 1 });
    text('BONUS', 200, 176, 2, C.sky);
    text('+' + Math.round(bonus * (1 - p)), 200, 196, 2, C.amberL);
    if (t > 36.05 && blink(t, 3)) { R(64, 232, 142, 18, C.amber); text('NEW HI-SCORE!', 135, 237, 1, C.ink); }
    hud(t, { score: sc }, 1);
  }

  const lowres = document.createElement('canvas');
  function logoCard(t) {
    // pixel dissolve from the stage into brand blue
    const pd = P(t, T.LOGO, T.LOGO + 0.45);
    if (pd < 1) {
      stageClear(t);
      for (let gy = 0; gy < 30; gy++) for (let gx = 0; gx < 17; gx++) {
        const d = (Math.abs(gx - 8) + Math.abs(gy - 15)) / 23 * 0.6 + rnd(gx * 31 + gy) * 0.4;
        if (d < pd) R(gx * 16, gy * 16, 16, 16, C.blue);
      }
      return;
    }
    R(0, 0, FW, 480, C.blue);
    // pixel border + corner brackets
    for (let i = 0; i < FW; i += 8) { R(i, 12, 4, 2, 'rgba(255,255,255,0.18)'); R(i + 4, 466, 4, 2, 'rgba(255,255,255,0.18)'); }
    // logo: resolves from chunky pixels to crisp
    const steps = [6, 10, 16, 28, 48, 96];
    const k = Math.floor((t - (T.LOGO + 0.45)) / 0.08);
    const size = 440, cx = W / 2, cy = 700, sp = outBack(P(t, T.LOGO + 0.45, T.LOGO + 0.75));
    ctx.save();
    ctx.translate(cx + OX * U, cy); ctx.scale(sp, sp);
    const ar = mark.naturalHeight / mark.naturalWidth;
    if (k < steps.length) {
      const n = steps[Math.max(0, k)];
      lowres.width = n; lowres.height = Math.round(n * ar);
      const lc = lowres.getContext('2d'); lc.imageSmoothingEnabled = true; lc.clearRect(0, 0, n, n); lc.drawImage(mark, 0, 0, lowres.width, lowres.height);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(lowres, -size / 2, -size * ar / 2, size, size * ar);
    } else {
      ctx.imageSmoothingEnabled = true; ctx.drawImage(mark, -size / 2, -size * ar / 2, size, size * ar);
    }
    ctx.restore();
    const tw = P(t, T.LOGO + 0.9, T.LOGO + 1.3);
    if (tw > 0) text('TASKKORA', 135, 248, 4, C.white, { shadow: C.blueD, sd: 2, reveal: Math.ceil(tw * 8) });
    if (t > T.LOGO + 1.45) {
      const n = Math.floor((t - T.LOGO - 1.45) / 0.035);
      R(18, 296, 234, 54, C.blueD); R(18, 296, 234, 2, C.amber); R(18, 348, 234, 2, C.amber);
      text('ADA TASK?', 135, 304, 2, C.amber, { reveal: n });
      text('TASKKORA-IN AJA.', 135, 326, 2, C.white, { reveal: Math.max(0, n - 9) });
    }
    if (t > T.LOGO + 2.2 && blink(t, 1.6)) text('INSERT COIN', 135, 380, 1, C.sky);
    for (let i = 0; i < 6; i++) if (t > T.LOGO + 0.8 && blink(t + i * 0.21, 2)) sparkle(40 + i * 38 + (i % 2) * 10, 90 + (i % 3) * 50 + (i > 2 ? 320 : 0), 2, i % 2 ? C.amberL : C.white);
  }

  // =====================================================================
  //  CRT pass
  // =====================================================================
  const crt = document.createElement('canvas'); crt.width = W; crt.height = H;
  (() => {
    const c = crt.getContext('2d');
    for (let y = 0; y < H; y += U) { c.fillStyle = 'rgba(0,0,0,0.26)'; c.fillRect(0, y + U - 1, W, 1); c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, y + U - 2, W, 1); }
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // rounded tube edge
    c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, W, H); c.roundRect(10, 10, W - 20, H - 20, 46); c.fill('evenodd');
  })();

  function crtPass(t) {
    // soft phosphor glow: blurred copy added on top
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; ctx.filter = 'blur(10px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    ctx.drawImage(crt, 0, 0);
    // rolling refresh band + tiny flicker
    const by = ((t * 0.35) % 1.2 - 0.1) * H;
    const g = ctx.createLinearGradient(0, by - 90, 0, by + 90);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.035)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, by - 90, W, 180);
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rnd(Math.floor(t * 60)) * 0.025})`; ctx.fillRect(0, 0, W, H);
  }

  // CRT power-on: frame 0 is already a bright, half-open picture snapping to full height (no fade-in)
  function powerOn(t) {
    if (t >= 0.14) return;
    const p = outCubic(P(t, 0, 0.14));
    const sy = lerp(0.3, 1, p);
    ctx.save();
    ctx.drawImage(canvas, 0, 0); // keep a copy in place via temp canvas below
    ctx.restore();
    const tmp = powerOn.tmp || (powerOn.tmp = Object.assign(document.createElement('canvas'), { width: W, height: H }));
    const tc = tmp.getContext('2d'); tc.clearRect(0, 0, W, H); tc.drawImage(canvas, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tmp, 0, H / 2 - (H * sy) / 2, W, H * sy);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - p)})`; ctx.fillRect(0, H / 2 - (H * sy) / 2, W, H * sy);
  }

  function watermark() {
    ctx.save();
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#FFFFFF';
    ctx.font = '500 30px "WM", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('@taskkora__', W - 44, H - 46);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.imageSmoothingEnabled = false;
    if (t < T.CLEAR) game(t);
    else if (t < T.LOGO) stageClear(t);
    else logoCard(t);
    crtPass(t);
    powerOn(t);
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
