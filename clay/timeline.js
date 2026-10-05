/* "Tugas numpuk? Ya dibentuk." — shared timeline (browser: window.CLAY_TL, node: require).
 * Every plop / tek / squish in music.py comes from here, so sound and picture stay locked. */
(function (root) {
  'use strict';
  const FPS_STOP = 12;                         // animation is shot "on twos": 12 poses per second
  const q = t => Math.floor(t * FPS_STOP + 1e-6) / FPS_STOP;

  // ---- hook: hand shapes the lump in three moves ----
  const HOOK = { slap: 0.0, pinch: 1.2, poke: 2.4, blink: 3.3, wave: 3.4, textOut: 3.75 };

  // ---- paper sheets: stack A (left, front) and B (left, back) ----
  const sheets = [];
  {
    let t = 4.4, i = 0;
    while (t < 25.6) {
      const stack = t > 13.5 && i % 3 === 2 ? 'B' : 'A';
      sheets.push({ i, stack, t0: t, land: q(t + 0.25) });
      const k = (t - 4.4) / 21.2;                // 0 → 1
      t += 1.0 - 0.74 * Math.pow(k, 0.8);        // 1.0 s → 0.26 s between sheets
      i++;
    }
  }
  // ---- coffee ----
  const COFFEE = { knock: 12.5, spill: 12.75, full: 14.25 };
  // ---- stress steps (face droops in discrete stop-motion steps, a squish each) ----
  const DROOP = [[6.5, 0.15], [9.5, 0.3], [13.0, 0.5], [16.0, 0.66], [19.5, 0.83], [22.0, 1.0]];
  const REFORM = [[31.9, 0.6], [32.2, 0.25], [32.5, 0.0]];
  function stress(t) {
    let s = 0;
    for (const [tt, v] of DROOP) if (t >= tt) s = v;
    for (const [tt, v] of REFORM) if (t >= tt) s = v;
    return s;
  }
  // ---- wall clock: minute-hand revolutions ----
  function clockRev(t) {
    if (t < 4) return 0;
    if (t < 26) return 0.04 * (t - 4) * (t - 4);
    const r26 = 0.04 * 22 * 22, v = 0.08 * 22;     // speed at 26 s = 1.76 rev/s
    const d = Math.min(t, 31) - 26;
    return r26 + v * d - v / 10 * d * d;           // decelerates to a stop at 31 s
  }
  const clockTicks = [];
  for (let t = 4, last = 0; t < 31; t += 1 / FPS_STOP) {
    const k = Math.floor(clockRev(q(t)) * 4);
    if (k !== last) { clockTicks.push(q(t)); last = k; }
  }
  // ---- mintask ----
  const MINTASK = { hops: [26.0, 26.33, 26.67, 27.0, 27.33], wave: 27.7, bursts: [28.2, 28.9, 29.6, 30.3], wipe: [30.9, 31.1, 31.3], mugUp: 31.5, smile: 32.6, thumbs: 33.2 };
  // ---- finale ----
  const END = { cut: 34.0, press: 35.0, lift: 35.7, blue: [36.5, 36.67, 36.83, 37.0], logo: 37.2, tag1: 37.6, tag2: 38.0, sparkle: 38.4 };

  const API = { FPS_STOP, q, HOOK, sheets, COFFEE, DROOP, REFORM, stress, clockRev, clockTicks, MINTASK, END };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CLAY_TL = API;
})(typeof window !== 'undefined' ? window : globalThis);
