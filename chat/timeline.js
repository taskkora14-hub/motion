/* "Chat a atau b yang bakal dibalas dosen?" — shared timeline (browser: window.CHAT_TL, node: require).
 * All names are placeholders; the lecturer is only "dosen pembimbing". */
(function (root) {
  'use strict';
  const HOOK = {
    a: 'p',
    b: 'selamat pagi pak, izin bertanya…',
    arrive: 0.0, ticks: 0.45, textOut: 3.7,
  };
  const ROUNDS = [
    {
      title: 'minta bimbingan',
      a: 'pak, kapan bisa bimbingan?',
      b: 'selamat siang pak, saya [nama] nim [nim]. saya ingin bimbingan bab 2. apakah bapak ada waktu hari kamis atau jumat? terima kasih.',
      reply: 'boleh, kamis jam 10 ya.',
      why: ['b menyebut identitas, tujuan jelas,', 'dan memberi pilihan waktu.'],
    },
    {
      title: 'minta maaf telat',
      a: 'maaf pak telat, kemarin banyak urusan.',
      b: 'mohon maaf pak atas keterlambatan revisi saya. revisi sudah saya lampirkan dan akan saya kirim ulang paling lambat besok pagi.',
      reply: 'baik, saya tunggu.',
      why: ['b mengakui, tidak beralasan,', 'dan memberi solusi + tenggat.'],
    },
    {
      title: 'tanya status',
      a: 'pak, sudah dicek belum?',
      b: 'selamat sore pak, izin menanyakan apakah revisi bab 3 yang saya kirim kemarin sudah sempat bapak cek? terima kasih.',
      reply: 'sudah, catatannya saya kirim nanti.',
      why: ['b menyapa, jelas revisi yang mana,', 'dan tetap sopan.'],
    },
  ];
  const rounds = ROUNDS.map((r, i) => {
    const s = 4 + i * 10;
    return {
      ...r, i, s,
      typeA: [s + 0.5, s + 1.3], sendA: s + 1.35, readA: s + 1.85,
      typeB: [s + 1.9, s + 3.0], sendB: s + 3.05, readB: s + 3.55,
      reactA: s + 4.2, reactB: s + 4.9, replyAt: s + 5.6,
      why: r.why, whyAt: s + 6.1, ask: s + 8.0, out: s + 9.6,
    };
  });
  const END = { in: 34.0, cards: [34.35, 34.75, 35.15], save: 35.9 };
  const API = { HOOK, rounds, END };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CHAT_TL = API;
})(typeof window !== 'undefined' ? window : globalThis);
