/* "5 hal yang boleh kamu lepas hari ini." — shared timeline (browser: window.LENTERA_TL, node: require). */
(function (root) {
  'use strict';
  const WORDS = [
    'takut dinilai orang',
    'membandingkan diri dengan orang lain',
    'harus sempurna sejak awal',
    'merasa tertinggal',
    'rasa bersalah karena istirahat',
  ];
  // where each released lantern ends up in the sky (x, y, final scale)
  const SKY = [[300, 640, 0.26], [790, 520, 0.24], [430, 330, 0.2], [700, 760, 0.27], [560, 470, 0.25]];
  const HOOK = { ignite: 0.0, textOut: 3.7 };
  const lanterns = WORDS.map((w, i) => {
    const s = 4 + i * 6;
    return {
      i, s, text: w, sky: SKY[i],
      rise: i === 0 ? null : s,          // a new lantern rises into the hands (the first one is the hook lantern)
      write: [s + 0.5, s + 2.2],         // handwriting appears on the paper
      release: s + 2.5,                  // hands open, lantern floats up
      settle: s + 2.5 + 9,               // reaches its sky spot
      caption: [s + 2.7, s + 5.7],
    };
  });
  const END = { sky: 34.0, text1: 34.6, text2: 35.6 };
  const API = { WORDS, HOOK, lanterns, END };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LENTERA_TL = API;
})(typeof window !== 'undefined' ? window : globalThis);
