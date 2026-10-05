/* "Level kantuk kelas jam 7 pagi." — shared timeline (browser: window.KANTUK_TL, node: require).
 * The animation and music.py both read these instants, so every "duk", nod and ting lines up. */
(function (root) {
  'use strict';
  const HOOK = { duk: 0.0, jolt: 0.55, look: 1.3, smile: 2.6 };
  const LEVELS = [4, 10, 16, 22, 28];          // level n starts at LEVELS[n-1], 6 s each
  const LABELS = ['masih segar', 'mata mulai berat', 'mengangguk-angguk', 'tidur mata terbuka', 'tidur tegak'];
  const CLOCK = ['07.00', '07.12', '07.25', '07.38', '07.51', '08.04'];
  const level = t => (t < LEVELS[0] ? 0 : t < 34 ? Math.min(5, 1 + Math.floor((t - 4) / 6)) : 0);

  // level 2: heavy blinks + one big yawn
  const BLINKS = [10.8, 12.0, 14.2, 15.3];
  const YAWN = 12.6;
  // level 3: head sinks slowly, flops (sound), then jerks back up
  const NODS = [16.5, 18.0, 19.5, 20.9].map(t0 => ({ t0, flop: t0 + 0.9, up: t0 + 1.15 }));
  // level 5: snore cycle (inhale/exhale), snot bubble breathes with it
  const SNORE = { start: 28.3, period: 2.0 };
  // lecturer "wah-wah" phrases per level: [start, syllables]
  const WAH = [
    [4.5, 4], [7.4, 3],
    [10.5, 4], [13.6, 3],
    [16.4, 4], [19.4, 3],
    [22.5, 4], [25.5, 3],
    [28.6, 3], [31.6, 3],
  ];
  const END = { ask: 34.0, wake: 34.6, grid: 35.2, gridWake: 35.75, text: 36.25 };

  const API = { HOOK, LEVELS, LABELS, CLOCK, level, BLINKS, YAWN, NODS, SNORE, WAH, END };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.KANTUK_TL = API;
})(typeof window !== 'undefined' ? window : globalThis);
