/* "Level 1: Tugas Menyerang!" — deterministic game script.
 * Shared by the animation (browser, window.ARCADE) and the soundtrack (node, require), so every
 * shot, hit, crash and explosion lands on exactly the same instant in picture and sound.
 * World units are logical pixels of a 270x480 screen (x4 = 1080x1920). */
(function (root) {
  'use strict';

  const LW = 270, LH = 480;
  const HUD_B = 54;              // bottom edge of the HUD band
  const Y0 = HUD_B - 16;         // blocks emerge from under the HUD
  const GROUND = 380;            // floor line (feet of the student)
  const GUN_Y = 332;             // muzzle height of the pencil blaster
  const LANES = [39, 103, 167, 231];
  const BW = 62, BH = 16, STACK_MAX = 2;
  const VB = 640;                // bullet speed (px/s)
  const LABELS = ['makalah', 'laporan', 'presentasi', 'kuis'];
  const GUN_DX = 13;             // gun sits right of the student's centre

  const T = {
    HOOK_END: 4.0,
    SPAWN_END: 28.1,
    LAST_SHOT: 27.2,
    CARD: 26.0,                  // power-up card appears
    CATCH: 28.4,                 // student grabs it
    FIRE: 29.6,                  // laser
    CLEAR: 30.6,                 // screen fully cleared
    STAGE: 34.0,                 // "stage clear"
    LOGO: 37.0,                  // blue logo screen
    END: 40.0,
  };
  const CARD_X = 135, CARD_Y_CATCH = GUN_Y - 4;
  const PLAYER_CATCH_X = CARD_X - GUN_DX;

  // ---------- seeded rng ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = mulberry32(140);

  // difficulty curve
  const interval = t => (t < 4 ? 0.42 : t < 10 ? 0.6 : t < 16 ? 0.55 : t < 22 ? 0.48 : 0.34);
  const speed = t => (t < 4 ? 150 : 72 + Math.min(1, (t - 4) / 22) * 58);
  const hitChance = t => (t < 4 ? 1 : t < 10 ? 0.97 : t < 15 ? 0.8 : t < 21 ? 0.66 : 0.55);

  // ---------- spawn blocks, picking a lane where they never overlap an earlier block ----------
  const blocks = [];
  // the power-up freezes time: falling blocks crawl in slow motion until the laser hits
  const warp = t => (t < 28.4 ? t : 28.4 + (t - 28.4) * 0.06);
  const yAt = (b, t) => b.y0 + b.v * (warp(t) - b.ts);
  function laneGap(lane, ts, v) {
    let gap = 1e9;
    for (const p of blocks) {
      if (p.lane !== lane) continue;
      const te = p.end ?? (p.ts + (GROUND - p.y0) / p.v);
      if (te <= ts) continue;
      const n = { y0: Y0, v, ts };
      gap = Math.min(gap, yAt(p, ts) - yAt(n, ts), yAt(p, te) - yAt(n, te));
    }
    return gap;
  }

  let ts = -0.95;
  let li = 0;
  while (ts < T.SPAWN_END) {
    const v = speed(Math.max(0, ts)) * (0.9 + R() * 0.2);
    // try lanes in random order, keep the one with the widest clearance
    const order = [0, 1, 2, 3].sort(() => R() - 0.5);
    let best = order[0], bestGap = -1e9;
    for (const l of order) { const g = laneGap(l, ts, v); if (g > bestGap) { bestGap = g; best = l; } }
    if (bestGap < BH + 6) { ts += 0.05; continue; }
    const b = { id: blocks.length, ts, v, y0: Y0, lane: best, x: LANES[best], label: LABELS[li++ % 4] };
    b.end = b.ts + (GROUND - Y0) / v; // provisional (refined below)
    blocks.push(b);
    ts += interval(Math.max(0, ts)) * (0.85 + R() * 0.3);
  }
  // labels: shuffle a little so the four kinds mix without long runs
  for (let i = blocks.length - 1; i > 0; i--) { if (R() < 0.35) { const j = i - 1; [blocks[i].label, blocks[j].label] = [blocks[j].label, blocks[i].label]; } }

  // ---------- schedule shots ----------
  const shots = [];
  const laneResolved = [-1e9, -1e9, -1e9, -1e9];
  const laneStack = [0, 0, 0, 0];
  const stackTop = c => GROUND - (BH + 1) * (c + 1) + 1;
  const landings = [];

  function shotFits(tf, lane) {
    for (const s of shots) {
      const gap = Math.abs(s.tf - tf);
      if (gap < (s.lane === lane ? 0.13 : 0.2)) return false;
    }
    return true;
  }

  for (const b of blocks) {
    const tNow = Math.max(0, b.ts);
    const want = R() < hitChance(tNow);
    let done = false;
    if (want) {
      const lo = b.ts < 4 ? 150 : 115, hi = b.ts < 4 ? 260 : 300;
      const yh0 = lo + R() * (hi - lo);
      for (let yh = yh0; yh < 312; yh += 6) {
        const th = b.ts + (yh - b.y0) / b.v;
        const tf = th - (GUN_Y - yh) / VB;
        if (tf < 0.35 || tf > T.LAST_SHOT) continue;
        if (tf < laneResolved[b.lane] + 0.04) continue;
        if (!shotFits(tf, b.lane)) continue;
        b.hit = { tf, th, y: yh };
        b.end = th;
        shots.push({ tf, th, x: b.x, y: yh, lane: b.lane, id: b.id });
        laneResolved[b.lane] = th;
        done = true;
        break;
      }
    }
    if (!done) {
      // falls to the floor: stacks (up to STACK_MAX) or shatters on a full lane; laser can pre-empt it
      const c = laneStack[b.lane];
      const yl = c < STACK_MAX ? stackTop(c) : stackTop(STACK_MAX - 1) - BH - 1;
      const tl = b.ts + (yl - b.y0) / b.v;
      if (tl >= T.CATCH) { b.end = T.FIRE; b.laser = true; continue; }
      b.land = { tl, y: yl, stays: c < STACK_MAX };
      if (c < STACK_MAX) laneStack[b.lane]++;
      b.end = tl;
      laneResolved[b.lane] = tl;
      landings.push({ tl, x: b.x, y: yl, stays: c < STACK_MAX, id: b.id });
    }
  }
  shots.sort((a, b) => a.tf - b.tf);
  landings.sort((a, b) => a.tl - b.tl);

  // ---------- laser clears everything left on screen ----------
  const laserPops = [];
  function laserTime(x, y) {
    const dx = Math.abs(x - CARD_X);
    if (dx < BW / 2 + 10) return T.FIRE + 0.12 + (GUN_Y - y) / 1800;
    return T.FIRE + 0.5 + (dx - BW / 2) / 135 * 0.42 + (GROUND - y) / 3000;
  }
  for (const b of blocks) {
    const alive = (b.laser) || (b.land && b.land.stays);
    if (!alive) continue;
    const piled = !!(b.land && b.land.stays);
    const y = piled ? b.land.y : yAt(b, T.FIRE);
    const tp = laserTime(b.x, y);
    b.pop = { t: tp, y: piled ? y : null };
    laserPops.push({ t: tp, x: b.x, id: b.id });
  }
  laserPops.sort((a, b) => a.t - b.t);

  // ---------- life & score ----------
  const DMG = 7;
  function life(t) {
    if (t >= T.CATCH) { const b = lifeAt(T.CATCH - 1e-6); return b + (100 - b) * Math.min(1, (t - T.CATCH) / 0.6); }
    return lifeAt(t);
  }
  function lifeAt(t) {
    let l = 100;
    for (const d of landings) if (d.tl <= t && d.tl < T.CATCH) l -= DMG;
    return Math.max(6, l);
  }
  function score(t) {
    let s = 0;
    for (const sh of shots) if (sh.th <= t) s += 100;
    for (const p of laserPops) if (p.t <= t) s += 500;
    if (t >= T.STAGE + 0.6) s += Math.round(Math.min(1, (t - T.STAGE - 0.6) / 1.2) * 50000 / 100) * 100;
    return s;
  }

  // ---------- student position ----------
  const keys = [{ t: -10, x: 135 - GUN_DX }];
  for (const s of shots) keys.push({ t: s.tf, x: s.x - GUN_DX });
  keys.push({ t: T.CATCH - 0.35, x: PLAYER_CATCH_X });
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  function playerX(t) {
    if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].x;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
    const a = keys[i], b = keys[i + 1];
    if (a.x === b.x) return a.x;
    const span = b.t - a.t, mv = Math.min(0.24, Math.max(0.06, span - 0.05));
    const s = b.t - 0.02 - mv;
    if (t <= s) return a.x;
    return a.x + (b.x - a.x) * ease(Math.min(1, (t - s) / mv));
  }
  function playerMoving(t) { return Math.abs(playerX(t + 0.02) - playerX(t - 0.02)) > 0.3; }

  const API = {
    LW, LH, HUD_B, Y0, GROUND, GUN_Y, GUN_DX, LANES, BW, BH, VB, T, CARD_X, CARD_Y_CATCH,
    blocks, shots, landings, laserPops, life, score, playerX, playerMoving, yAt, warp,
    events() { return { T, shots, landings, laserPops, hookShots: shots.filter(s => s.tf < T.HOOK_END).length }; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.ARCADE = API;
})(typeof window !== 'undefined' ? window : globalThis);
