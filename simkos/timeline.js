/* Shared script for the "kamar kos" life-sim spot. Read by anim.js (browser) and by music.py
 * (`node simkos/timeline.js --json`) so every ting / buzz / mumble lands on its frame. */
(function (root) {
  'use strict';

  const T = { HOOK: 4.0, MENU: 26.0, CLICK: 27.9, FILL: 28.7, CLEAR: 34.0, LOGO: 37.0, END: 40.0 };
  const BARS = ['energi', 'fokus', 'mood', 'tugas'];
  const START = { energi: 0.32, fokus: 0.4, mood: 0.3, tugas: 0.24 };

  // need-bar steps: each one animates over STEP_DUR and fires a ting (up) or buzz (down)
  const STEP_DUR = 0.38;
  const STEPS = [
    { t: 0.0, bar: 'tugas', to: 0.08 },                                   // hook: tugas crashes into the red
    // --- tidur: energi up, tugas down ---
    ...[6.4, 7.2, 8.0, 8.8, 9.6].map((t, i) => ({ t, bar: 'energi', to: 0.32 + 0.12 * (i + 1) })),
    { t: 7.6, bar: 'tugas', to: 0.05 }, { t: 9.2, bar: 'tugas', to: 0.025 },
    // --- makan mie: mood up ---
    ...[13.0, 13.8, 14.6, 15.4, 16.2].map((t, i) => ({ t, bar: 'mood', to: 0.3 + 0.126 * (i + 1) })),
    // --- scroll medsos: fokus down ---
    ...[19.8, 20.6, 21.4, 22.2, 23.0].map((t, i) => ({ t, bar: 'fokus', to: 0.4 - 0.068 * (i + 1) })),
    { t: 23.8, bar: 'energi', to: 0.74 },
    // --- MINTASK ---
    { t: T.FILL, bar: 'tugas', to: 1.0, big: true },
    { t: 29.5, bar: 'energi', to: 1.0 }, { t: 29.8, bar: 'fokus', to: 1.0 }, { t: 30.1, bar: 'mood', to: 1.0 },
  ];

  // character blocking: where the student is and what they are doing
  const SPOT = { rug: [0.4, 0.6], bed: [-2.55, -2.35], bedside: [-1.15, -1.6], eat: [2.05, 0.25], bag: [0.55, 2.55], sofa: [2.0, -3.05], front: [1.15, 3.2] };
  const ACTS = [
    { a: 0.0, b: 4.25, act: 'panic', at: 'rug' },
    { a: 4.25, b: 5.5, act: 'walk', from: 'rug', to: 'bedside' },
    { a: 5.5, b: 10.3, act: 'sleep', at: 'bed' },
    { a: 10.3, b: 10.9, act: 'stretch', at: 'bedside' },
    { a: 10.9, b: 12.0, act: 'walk', from: 'bedside', to: 'eat' },
    { a: 12.0, b: 17.2, act: 'eat', at: 'eat' },
    { a: 17.2, b: 18.4, act: 'walk', from: 'eat', to: 'bag' },
    { a: 18.4, b: 25.2, act: 'phone', at: 'bag' },
    { a: 25.2, b: 28.6, act: 'think', at: 'bag' },
    { a: 28.6, b: 32.4, act: 'cheer', at: 'bag' },
    { a: 32.4, b: 34.0, act: 'walk', from: 'front', to: 'sofa' },
    { a: 34.0, b: 40.0, act: 'lounge', at: 'sofa' },
  ];

  // gibberish lines: mood drives pitch contour in the synth
  const VOICE = [
    { t: 0.12, n: 7, mood: 'panic' },
    { t: 1.75, n: 6, mood: 'panic' },
    { t: 4.45, n: 3, mood: 'yawn' },
    { t: 10.35, n: 4, mood: 'happy' },
    { t: 12.6, n: 3, mood: 'yum' }, { t: 14.2, n: 3, mood: 'yum' }, { t: 15.8, n: 4, mood: 'happy' },
    { t: 19.3, n: 4, mood: 'giggle' }, { t: 21.0, n: 4, mood: 'meh' }, { t: 22.9, n: 5, mood: 'meh' },
    { t: 25.3, n: 5, mood: 'sigh' },
    { t: 28.75, n: 6, mood: 'excited' }, { t: 30.6, n: 5, mood: 'happy' },
    { t: 34.4, n: 4, mood: 'content' },
  ];

  const api = { T, BARS, START, STEPS, STEP_DUR, SPOT, ACTS, VOICE };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module && process.argv.includes('--json')) {
      // resolve each step's direction for the soundtrack
      const cur = { ...START };
      const steps = [...STEPS].sort((a, b) => a.t - b.t).map(s => { const up = s.to > cur[s.bar]; cur[s.bar] = s.to; return { ...s, up }; });
      process.stdout.write(JSON.stringify({ T, STEPS: steps, VOICE }));
    }
  } else root.SIMKOS = api;
})(this);
