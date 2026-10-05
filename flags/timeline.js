/* Shared script for "Green flag vs red flag semester akhir". Read by anim.js (browser) and by
 * music.py (`node flags/timeline.js --json`) so every ding / buzz / whoosh lands on its frame.
 * 120 BPM: one beat = 0.5 s; every pair starts on a downbeat. */
(function (root) {
  'use strict';

  const T = { HOOK: 4.0, PAIR0: 4.0, PAIR_LEN: 5.0, RED_AT: 2.0, EXIT_AT: 4.5, END3: 34.0, CRASH: 34.5, DUR: 40.0 };
  const PAIRS = [
    { ic: 'calendar', g: 'Bimbingan rutin dan catat revisi', r: 'Baru muncul H-3 sidang', react: 'shock' },
    { ic: 'folder', g: 'Backup file di dua tempat', r: ['Nama file', 'final_revisi_fix_banget'], react: 'cringe' },
    { ic: 'chat', g: 'Tanya dosen kalau bingung', r: 'Diam lalu panik sendiri', react: 'facepalm' },
    { ic: 'book', g: 'Simpan jurnal sejak awal', r: 'Cari referensi jam 2 pagi', react: 'shock' },
    { ic: 'moon', g: 'Istirahat cukup', r: 'Begadang tiap malam', react: 'cringe' },
    { ic: 'list', g: 'Mulai dari kerangka kecil', r: 'Nunggu mood sempurna', react: 'facepalm' },
  ];
  const pairStart = i => T.PAIR0 + i * T.PAIR_LEN;

  const api = { T, PAIRS, pairStart };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module && process.argv.includes('--json')) {
      const events = [];
      PAIRS.forEach((p, i) => {
        const s = pairStart(i);
        events.push({ t: s + 0.05, type: 'green', i }, { t: s + T.RED_AT + 0.05, type: 'red', i }, { t: s + T.EXIT_AT, type: 'exit', i });
      });
      process.stdout.write(JSON.stringify({ T, events }));
    }
  } else root.FLAGS = api;
})(this);
