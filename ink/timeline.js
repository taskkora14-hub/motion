/* Shared script for the ink-in-water spot. Read by anim.js (browser) and by music.py
 * (`node ink/timeline.js --json`) so drips, whooshes and chimes land on their frames. */
(function (root) {
  'use strict';

  const T = { DROP: 0.0, AMBER: 4.6, BFLY: 30.0, LIFT: 33.0, SKY: 35.0, END: 40.0 };
  // shape keys: [time, plume, cloud, flower, bird, butterfly] — weights are blended between keys
  const KEYS = [
    [0.0, 1, 0, 0, 0, 0],
    [4.2, 1, 0, 0, 0, 0],
    [7.4, 0, 1, 0, 0, 0],
    [9.0, 0, 1, 0, 0, 0],
    [12.4, 0, 0, 1, 0, 0],
    [15.2, 0, 0, 1, 0, 0],
    [18.4, 0, 0, 0, 1, 0],
    [21.2, 0, 0, 0, 1, 0],
    [24.6, 0, 0, 0, 0, 1],
    [40.0, 0, 0, 0, 0, 1],
  ];
  // morph turbulence: calm while a shape holds, swirling during each transformation
  const MORPHS = [[4.2, 7.4], [9.0, 12.4], [15.2, 18.4], [21.2, 24.6]];
  const EVENTS = [
    { t: 0.0, type: 'plung' },
    { t: T.AMBER, type: 'drip' },
    ...MORPHS.map(([a]) => ({ t: a, type: 'whoosh' })),
    { t: 7.4, type: 'chime', n: 0 }, { t: 12.4, type: 'chime', n: 1 }, { t: 18.4, type: 'chime', n: 2 }, { t: 24.6, type: 'chime', n: 3 },
    { t: T.BFLY, type: 'reveal' }, { t: T.LIFT, type: 'lift' }, { t: T.SKY, type: 'sky' },
  ];
  const FLAP_HZ = t => (t < T.BFLY ? 0 : t < T.LIFT ? 0.9 : 1.6);

  const api = { T, KEYS, MORPHS, EVENTS, FLAP_HZ };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module && process.argv.includes('--json')) process.stdout.write(JSON.stringify({ T, EVENTS, MORPHS }));
  } else root.INK = api;
})(this);
