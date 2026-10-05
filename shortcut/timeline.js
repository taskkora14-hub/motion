/* "5 shortcut yang jarang kamu tahu." — shared timeline (browser: window.SC_TL, node: require). */
(function (root) {
  'use strict';
  const TRICKS = [
    { keys: ['ctrl_l', 'shift_l', 't'], combo: ['ctrl', 'shift', 't'], desc: 'buka lagi tab yang ketutup', tip: 'tab ketutup? tenang.' },
    { keys: ['win_l', 'v'], combo: ['win', 'v'], desc: 'buka riwayat clipboard', tip: 'semua copy-an tersimpan!' },
    { keys: ['win_l', 'shift_l', 's'], combo: ['win', 'shift', 's'], desc: 'screenshot sebagian layar', tip: 'potong yang perlu aja.' },
    { keys: ['ctrl_l', 'shift_l', 'v'], combo: ['ctrl', 'shift', 'v'], desc: 'paste teks tanpa format', tip: 'rapi, ikut gaya dokumen.' },
    { keys: ['alt_l', 'tab'], combo: ['alt', 'tab'], desc: 'pindah jendela dengan cepat', tip: 'tahan alt, tekan tab.' },
  ];
  const HOOK = { hit: 0, keys: ['win_l', 'shift_l', 's'], release: 1.2, textOut: 3.7 };
  const tricks = TRICKS.map((k, i) => {
    const s = 4 + i * 6;
    // modifiers go down one by one, the last key completes the combo
    const down = k.keys.map((_, j) => s + 1.0 + j * 0.22);
    const last = down[down.length - 1];
    const extra = i === 4 ? [last + 0.55, last + 1.1] : [];          // alt+tab: tab tapped again (alt held)
    return { ...k, i, s, down, extra, result: last + 0.05, release: i === 4 ? last + 1.9 : last + 1.0, save: s + 4.3, out: s + 5.6 };
  });
  const RECAP = { in: 34.0, out: 35.9 };
  const OUTRO = { in: 36.0, thumbs: 36.35, text: 36.6 };
  // every key-down and key-up, for the mechanical clicks
  const clicks = [];
  HOOK.keys.forEach(() => clicks.push({ t: 0, down: true }));
  clicks.push({ t: HOOK.release, down: false });
  for (const k of tricks) {
    k.down.forEach(t => clicks.push({ t, down: true }));
    k.extra.forEach(t => { clicks.push({ t, down: true }); clicks.push({ t: t + 0.14, down: false }); });
    clicks.push({ t: k.release, down: false });
  }
  const API = { TRICKS, HOOK, tricks, RECAP, OUTRO, clicks };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SC_TL = API;
})(typeof window !== 'undefined' ? window : globalThis);
