/* "Pilih cepat! This or that mahasiswa." — shared timeline (browser: window.PILIH_TL, node: require). */
(function (root) {
  'use strict';
  const PAIRS = [
    ['kuliah pagi', 'kuliah malam'],
    ['kerja kelompok', 'sendirian'],
    ['kopi', 'teh'],
    ['ujian tulis', 'ujian lisan'],
    ['presentasi', 'laporan'],
    ['kelas online', 'kelas offline'],
    ['begadang', 'bangun subuh'],
    ['kos dekat kampus', 'rumah jauh tapi nyaman'],
  ];
  const PICK = [1, 1, 0, 0, 1, 1, 0, 0];         // 0 = top, 1 = bottom
  const HOOK = { hit: 0, ticks: [0, 1, 2], go: 3.0, out: 3.75 };
  const SLOT = 4;                                 // seconds per pair
  const pairs = PAIRS.map((p, i) => {
    const s = 4 + i * SLOT;
    return { i, s, labels: p, pick: PICK[i], inEnd: s + 0.3, t0: s + 0.3, lock: s + 3.3, out: s + 3.75 };
  });
  // timer ticks: every second, plus double-time in the last second ("tik-tik")
  const ticks = [];
  for (const p of pairs) { for (const k of [0, 1, 2, 2.5]) ticks.push({ t: p.t0 + k, strong: k % 1 === 0 }); }
  const RESULT = { in: 36.0, card: 36.15, chips: 36.6, text: 37.3, end: 40 };
  const API = { PAIRS, PICK, HOOK, SLOT, pairs, ticks, RESULT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PILIH_TL = API;
})(typeof window !== 'undefined' ? window : globalThis);
