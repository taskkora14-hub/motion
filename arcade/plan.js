/* Gameplay plan for the arcade video — a deterministic, offline "replay".
 * Shared by arcade/anim.js (browser) and arcade/music.py (via `node arcade/plan.js`),
 * so every pew, explosion and landing in the soundtrack lands on the exact frame it is drawn. */
(function (root) {
  'use strict';

  const LANES = [135, 405, 675, 945];
  const BW = 264, BH = 84;            // task block size
  const Y0 = -BH;                      // spawn: block top just above the frame
  const DEAD_Y = 1380;                 // "deadline" line = bottom of the pile
  const MUZZLE_Y = 1420;               // bullet origin (tip of the pencil blaster)
  const MUZZLE_DX = 42;                // muzzle sits right of the student's centre
  const BULLET_V = 2600;               // px/s
  const MOVE_V = 2300;                 // student run speed, px/s
  const COOLDOWN = 0.17;
  const LABELS = ['makalah', 'laporan', 'presentasi', 'kuis'];

  const SPAWN_END = 26.6;              // last task block
  const SHOOT_END = 26.15;             // student stops shooting to grab the power-up
  const CARD = { t0: 26.0, x: 540, catchT: 27.7, catchY: 1440 };
  const LASER = { t0: 28.4, full: 29.0, off: 29.7 };

  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // spawn interval (s) and fall speed (px/s) as the level heats up
  function pace(t) {
    if (t < 4) return { gap: 0.42, v: 780 };                        // hook: fast drop
    const k = clamp((t - 4) / 21.5);
    return { gap: lerp(0.78, 0.2, Math.pow(k, 0.9)), v: lerp(470, 900, k) };
  }

  function makePlan() {
    // ---- spawns ----
    const blocks = [];
    const laneLast = [-9, -9, -9, -9];
    let t = -0.55, i = 0, prevLane = -1;
    while (t < SPAWN_END) {
      const { gap, v } = pace(Math.max(0, t));
      let lane = Math.floor(rnd(i * 3 + 1) * 4);
      for (let k = 0; k < 4 && (lane === prevLane || t - laneLast[lane] < 0.42); k++) lane = (lane + 1) % 4;
      laneLast[lane] = t; prevLane = lane;
      blocks.push({ id: i, ts: t, lane, x: LANES[lane], v, label: LABELS[(i * 7 + Math.floor(rnd(i + 50) * 4)) % 4] });
      t += gap * (0.8 + 0.4 * rnd(i * 5 + 2)); i++;
    }

    // ---- greedy shooter (knows the future, but is human: run speed + cooldown) ----
    const pile = [0, 0, 0, 0];
    const pileTop = lane => DEAD_Y - pile[lane] * BH;
    const landT = b => b.ts + (pileTop(b.lane) - (Y0 + BH)) / b.v;
    let sx = 540, tFree = 0.25;
    const shots = [], moves = [{ t: -1, x: 540 }];
    const pending = blocks.slice();
    while (pending.length) {
      pending.sort((a, b) => landT(a) - landT(b));
      const b = pending.shift();
      const tl = landT(b);
      const mx = b.x - MUZZLE_DX;
      const travel = Math.abs(mx - sx) / MOVE_V;
      const tf = Math.max(tFree + travel, b.ts + 0.12);
      const th = (MUZZLE_Y - Y0 - BH + b.v * b.ts + BULLET_V * tf) / (b.v + BULLET_V);
      const yHit = Y0 + BH + b.v * (th - b.ts);
      // fatigue: as the stack grows, some tasks slip past the student
      const slip = b.ts > 11 && rnd(b.id + 200) < lerp(0.06, 0.34, clamp((b.ts - 11) / 14));
      if (!slip && tf < SHOOT_END && th < tl - 0.04 && yHit > 230) {
        if (travel > 0) moves.push({ t: tf - travel, x: sx }, { t: tf, x: mx });
        sx = mx; tFree = tf + COOLDOWN;
        b.shotT = tf; b.hitT = th; b.hitY = yHit;
        shots.push({ t: tf, x: b.x, hitT: th, hitY: yHit, id: b.id });
      } else if (tl < LASER.t0) {
        b.landT = tl; b.landY = pileTop(b.lane); b.stack = pile[b.lane];
        pile[b.lane]++;
      }
    }

    // ---- power-up + laser: everything still on screen at the beam goes boom ----
    const cardMx = CARD.x - MUZZLE_DX;
    moves.push({ t: Math.max(sx === cardMx ? 0 : 26.5, tFree + 0.05), x: sx }, { t: 27.45, x: CARD.x });
    const laserHits = [];
    for (const b of blocks) {
      if (b.hitT != null || b.ts > LASER.t0) continue;
      const y = b.landT != null && b.landT <= LASER.t0 ? b.landY - BH : Y0 + b.v * (LASER.t0 - b.ts);
      if (y > 1500) continue;
      const delay = 0.08 + Math.abs(b.x - 540) / 540 * 0.45 + rnd(b.id + 90) * 0.06;
      b.laserT = LASER.t0 + delay; b.laserY = y;
      laserHits.push({ t: b.laserT, x: b.x, id: b.id });
    }

    const lands = blocks.filter(b => b.landT != null).map(b => ({ t: b.landT, x: b.x, id: b.id })).sort((a, b) => a.t - b.t);
    moves.sort((a, b) => a.t - b.t);
    return { blocks, shots: shots.sort((a, b) => a.t - b.t), lands, laserHits, moves, CARD, LASER, LIFE: 20 };
  }

  const api = { makePlan, LANES, BW, BH, Y0, DEAD_Y, MUZZLE_Y, MUZZLE_DX, BULLET_V, SPAWN_END, SHOOT_END };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module) {
      const p = makePlan();
      const ev = { shots: p.shots.map(s => +s.t.toFixed(4)), hits: p.shots.map(s => [+s.hitT.toFixed(4), s.x]),
        lands: p.lands.map(l => [+l.t.toFixed(4), l.x]), laser: p.laserHits.map(l => [+l.t.toFixed(4), l.x]),
        moves: p.moves.map(m => [+m.t.toFixed(4), m.x]) };
      if (process.argv.includes('--stats')) {
        const secs = {};
        p.blocks.forEach(b => { const s = Math.floor(b.ts / 2) * 2; secs[s] = secs[s] || [0, 0, 0]; secs[s][0]++; if (b.hitT != null) secs[s][1]++; if (b.landT != null) secs[s][2]++; });
        console.log('blocks', p.blocks.length, 'shot', p.shots.length, 'landed', p.lands.length, 'laser', p.laserHits.length);
        console.log('per 2s [spawned, shot, landed]:', JSON.stringify(secs));
        console.log('lands at', p.lands.map(l => l.t.toFixed(2)).join(' '));
      } else process.stdout.write(JSON.stringify(ev));
    }
  } else root.ARCADE_PLAN = api;
})(typeof window !== 'undefined' ? window : globalThis);
