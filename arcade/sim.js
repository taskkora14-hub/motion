/* Deterministic game script for the arcade video. Shared by anim.js (browser) and music.py
 * (via `node arcade/sim.js --json`), so every pew, hit and explosion in the soundtrack lands
 * on the exact frame it is drawn. Units are art pixels on a 270x480 field (x4 = 1080x1920). */
(function (root) {
  'use strict';

  const T = { HOOK: 4.0, POWER: 26.4, CATCH: 29.4, LASER: 29.75, CLEAR: 34.0, LOGO: 37.0, END: 40.0 };
  const FW = 270, GROUND = 440, GUN_Y = 374, BLOCK_W = 66, BLOCK_H = 16;
  const LABELS = ['MAKALAH', 'LAPORAN', 'PRESENTASI', 'KUIS'];
  const BULLET_V = 520, PLAYER_V = 420;
  const CARD_X = 196;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function build() {
    const rand = mulberry32(14002);
    // ---- spawn waves: interval shrinks and fall speed grows as the tasks pile up ----
    const interval = t => (t < T.HOOK ? 0.36 : t < 26 ? lerp(0.85, 0.19, Math.pow((t - T.HOOK) / 22, 0.75)) : 0.17);
    const speed = t => (t < T.HOOK ? 215 : t < 26 ? lerp(72, 150, (t - T.HOOK) / 22) : 160);
    const killP = t => (t < 7 ? 1 : t < 26 ? lerp(0.88, 0.5, (t - 7) / 19) : 0.4);

    const blocks = [];
    let t = 0.08, lastX = [135, 135], li = 0;
    while (t < T.LASER - 0.15) {
      let x;
      for (let k = 0; k < 12; k++) { x = 42 + rand() * (FW - 84); if (Math.abs(x - lastX[0]) > 46 && Math.abs(x - lastX[1]) > 30) break; }
      lastX = [x, lastX[0]];
      const label = LABELS[(li + Math.floor(rand() * 3)) % 4]; li++;
      const v = speed(t) * lerp(0.92, 1.1, rand());
      const b = { id: blocks.length, t0: t, x, v, label };
      b.tg = t + GROUND / v;
      b.yh = t < T.HOOK ? lerp(230, 320, rand()) : lerp(110, 320, rand()); // preferred hit height
      b.want = rand() < killP(t);
      blocks.push(b);
      t += interval(t) * lerp(0.8, 1.2, rand());
    }

    // ---- choose which shots the student can actually make (has to walk under each target) ----
    const keys = [{ t: 0, x: 135 }];
    const hitAt = (b, ts) => (ts + (GUN_Y + b.v * b.t0) / BULLET_V) / (1 + b.v / BULLET_V); // bullet meets the block's bottom edge
    for (const b of blocks) {
      if (!b.want) continue;
      const prev = keys[keys.length - 1];
      const pref = b.t0 + (b.yh + BLOCK_H) / b.v - (GUN_Y - b.yh - BLOCK_H) / BULLET_V;
      const ts = Math.max(pref, prev.t + Math.abs(b.x - prev.x) / PLAYER_V + 0.07, b.t0 + 0.12);
      const th = hitAt(b, ts), yb = b.v * (th - b.t0);
      if (yb > GROUND - 70 || ts > T.CATCH - 0.5) continue;
      b.ts = ts; b.th = th; b.kill = true;
      keys.push({ t: ts, x: b.x, shot: b.id });
    }
    keys.push({ t: T.CATCH, x: CARD_X, catch: true });
    keys.push({ t: 31.0, x: 135 });

    // ---- the laser wipe: everything still alive gets cleared, nearest first ----
    const pxL = CARD_X;
    for (const b of blocks) {
      const end0 = b.kill ? b.th : b.tg;
      const tc = T.LASER + 0.1 + Math.abs(b.x - pxL) / 520 + (b.id % 3) * 0.015;
      if (end0 > T.LASER) { const tcc = Math.min(tc, end0 - 0.01);
        b.clear = true; b.kill = false; b.end = tcc; } else if (false) { b.clear = true; b.kill = false; b.end = tc; }
      else b.end = end0;
      b.miss = !b.kill && !b.clear;
    }

    // ---- score + health over time ----
    const events = [];
    for (const b of blocks) {
      if (b.kill) { events.push({ t: b.ts, type: 'shot', x: b.x }); events.push({ t: b.th, type: 'kill', x: b.x, pts: 100 }); }
      else if (b.clear) events.push({ t: b.end, type: 'clear', x: b.x, pts: 250 });
      else events.push({ t: b.tg, type: 'crash', x: b.x });
    }
    events.push({ t: T.POWER, type: 'card' }, { t: T.CATCH, type: 'catch' }, { t: T.LASER, type: 'laser' });
    events.sort((a, b) => a.t - b.t);
    const misses = events.filter(e => e.type === 'crash' && e.t < T.LASER).length;
    let score = 0, hp = 1;
    for (const e of events) {
      if (e.pts) score += e.pts;
      if (e.type === 'crash' && e.t < T.LASER) hp -= 0.86 / misses;
      e.score = score; e.hp = hp;
    }
    return { blocks, keys, events, misses, finalScore: score };
  }

  const G = build();

  // player x at time t: idle at the last target, then dash to the next one just in time
  function playerX(t) {
    const k = G.keys;
    let i = 0;
    while (i < k.length - 1 && k[i + 1].t <= t) i++;
    if (i >= k.length - 1) return k[k.length - 1].x;
    const a = k[i], b = k[i + 1];
    const dur = Math.max(0.08, Math.abs(b.x - a.x) / PLAYER_V);
    const s = clamp((t - (b.t - dur - 0.03)) / dur);
    return lerp(a.x, b.x, s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2);
  }
  function playerMoving(t) { return Math.abs(playerX(t + 0.02) - playerX(t - 0.02)) > 0.3; }
  function stateAt(t) { // score / hp after every event up to t
    let s = 0, hp = 1;
    for (const e of G.events) { if (e.t > t) break; s = e.score; hp = e.hp; }
    return { score: s, hp };
  }

  const api = { T, FW, GROUND, GUN_Y, BLOCK_W, BLOCK_H, BULLET_V, CARD_X, G, playerX, playerMoving, stateAt };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module && process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify({ T, events: G.events, finalScore: G.finalScore }));
    }
  } else root.ARCADE_SIM = api;
})(this);
