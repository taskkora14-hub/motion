# Taskkora — Motion Graphic 40s (9:16)

Video promosi Taskkora untuk TikTok & Instagram Reels.

**Hasil:** [`dist/taskkora-40s-9x16.mp4`](dist/taskkora-40s-9x16.mp4) — 1080×1920, 60 fps, H.264 + AAC, 40 detik.

| Waktu | Scene |
|---|---|
| 0–5s | Logo tersusun (panah → T → centang) + shine, wordmark, tagline **“Ada Task? Taskkora-in Aja!”** |
| 5–12s | Karakter di meja, task berdatangan (badge notifikasi 1 → 99+) → **“Punya banyak task?”** |
| 12–22s | Task menyatu jadi kartu layanan yang flip: **Design • Data • Digital • Editing • Printing** |
| 22–30s | Wipe berbentuk panah logo → **Produk Digital Siap Pakai**: Templates • Planners • Spreadsheets • Productivity Tools |
| 30–36s | **Cocok untuk**: Students • Researchers • Small Businesses • More (terhubung ke hub Taskkora) |
| 36–40s | Semua menyatu ke badge → logo → **“Dari Task Jadi Beres.”** → tombol **Chat MinTask** |

## Struktur

- `index.html` + `src/anim.js` — seluruh animasi (Canvas 2D). Tiap frame adalah fungsi murni dari waktu, jadi preview dan export identik. Buka lewat server lokal (mis. `npx serve .`) untuk preview; `?t=14.5` untuk membekukan di detik tertentu.
- `assets/` — logo asli + tiga bagian simbol (T, panah, centang) hasil ekstraksi dengan alpha, dipakai untuk animasi logo.
- `fonts/` — Plus Jakarta Sans (OFL).
- `scripts/music.py` — sintesis musik latar 120 BPM + SFX yang sinkron dengan animasi.
- `scripts/render.mjs` — export frame-by-frame via Playwright → ffmpeg.

## Render ulang

```bash
pip install numpy scipy pillow imageio-ffmpeg
python3 scripts/music.py                 # -> out/taskkora-music.wav
node scripts/render.mjs --fps 60         # -> out/taskkora.mp4
node scripts/render.mjs --stills 2,14,38 # still frame untuk cek cepat
```

Warna mengikuti logo: biru `#004FC6`, putih hangat `#FAF8F4`, aksen amber `#FFC247`.

---

# Video Edukasi — “Kenapa Kita Sering Menunda Tugas?” (9:16, ±40s)

**Hasil:** [`dist/menunda-tugas-40s-9x16.mp4`](dist/menunda-tugas-40s-9x16.mp4) — 1080×1920, 60 fps, tanpa voice-over (hanya musik & SFX). Proyek terpisah di folder `menunda/` (visual, font Sora, palet, dan musik sendiri). Logo dipakai apa adanya sebagai watermark kecil di pojok kanan atas.

| Waktu | Scene |
|---|---|
| 0–4.6s | Hook: “Bukan karena **kamu malas.**” — kata *malas* dicoret → “Ada alasan lain.” |
| 4.6–11s | Kamera mundur memperlihatkan balok **TUGAS** raksasa (tag DEADLINE) di depan sosok kecil: “Satu tugas… terasa sebesar ini.” |
| 11–16s | Penyebab 01 — **Terasa terlalu besar**: balok terus membesar, detak jantung (EKG) makin cepat |
| 16–21s | Penyebab 02 — **Bingung mulai dari mana**: jalur kusut ke banyak “?”, ikon loading di atas kepala |
| 21–26s | Penyebab 03 — **Takut hasilnya salah**: menulis → cap X merah → dihapus, berulang |
| 26–34s | **Solusinya**: balok retak & pecah jadi 5 anak tangga (Buka file → 1 kalimat → 10 menit → Rehat → Lanjut), sosok naik satu per satu |
| 34–40s | “Jangan tunggu **siap.** Mulai dari **1** langkah kecil.” — sosok naik satu anak tangga, centang ✓ |

```bash
python3 menunda/music.py
node scripts/render.mjs --page menunda/index.html --audio out/menunda-music.wav --out out/menunda.mp4 --crf 18
```

---

# Video Edukasi — “File tugasmu masih begini?” (9:16, ±40s)

**Hasil:** [`dist/file-rapi-40s-9x16.mp4`](dist/file-rapi-40s-9x16.mp4) — 1080×1920, 60 fps, tanpa voice-over. Proyek terpisah di `filerapi/` (tampilan terang ala file-explorer, font Manrope + JetBrains Mono, musik sendiri). Logo dipakai apa adanya sebagai watermark kecil di pojok kanan atas.

| Waktu | Scene |
|---|---|
| 0–7s | Hook: file di-rename live — `FINAL.docx` → `FINAL FIX.docx` → `FINAL FIX BANGET.docx` → `FINAL FIX TERBARU.docx`, versi lama menumpuk → “File tugasmu masih begini?” |
| 7–14s | Folder “Tugas” makin berantakan (0 → 47 item), cari “final” → 7 hasil → “Makin banyak, makin susah dicari.” |
| 14–18s | Masalah 01 — nama file tidak jelas (nama ter-scramble jadi acak) |
| 18–22s | Masalah 02 — terlalu banyak versi (8 versi mengipas, “yang mana yang benar?”) |
| 22–26s | Masalah 03 — folder tidak terorganisir (pohon folder kusut, file penting hilang) |
| 26–34s | Solusi: `01_NamaProyek` → `02_Data` → `03_Draft` → `04_Final`, file-file terbang masuk ke foldernya, lalu dicentang |
| 34–40s | “File rapi = lebih gampang dicari, diedit, dan dikirim.” + “Rapikan sebelum makin banyak.” |

```bash
python3 filerapi/music.py
node scripts/render.mjs --page filerapi/index.html --audio out/filerapi-music.wav --out out/filerapi.mp4 --crf 18
```

---

# Video Edukasi — “Bingung mulai mengerjakan task dari mana?” (9:16, ±40s)

**Hasil:** [`dist/mulai-dari-mana-40s-9x16.mp4`](dist/mulai-dari-mana-40s-9x16.mp4) — 1080×1920, 60 fps, tanpa voice-over. Proyek terpisah di `mulai/` (gaya UI app lilac, font Space Grotesk, musik elektronik 124 BPM). Logo dipakai apa adanya sebagai watermark kecil di pojok kanan atas.

| Waktu | Scene |
|---|---|
| 0–5s | Hook: “Bingung mulai dari mana?” — kursor ragu di antara pilihan “?” |
| 5–12s | Kartu “Makalah 3.000 kata” berisi benang kusut + sub-task berputar: “Kelihatan rumit banget.” |
| 12–14.5s | Benang terurai jadi 4 garis lurus → checklist 4 langkah: “Pecah jadi 4 langkah.” |
| 14.5–30.5s | 01 Pahami tugas → 02 Kumpulkan bahan → 03 Kerjakan bagian utama → 04 Review; tiap langkah tercentang, progress 0 → 100% |
| 30.5–34s | Checklist lengkap, ring 100%, confetti |
| 34–40s | “Task besar jadi lebih ringan kalau dipecah.” + “Mulai dari langkah pertama.” |

```bash
python3 mulai/music.py
node scripts/render.mjs --page mulai/index.html --audio out/mulai-music.wav --out out/mulai.mp4 --crf 18
```

---

# Video Edukasi — “5 Kesalahan Saat Membuat Presentasi” (9:16, ±40s)

**Hasil:** [`dist/presentasi-5-kesalahan-40s-9x16.mp4`](dist/presentasi-5-kesalahan-40s-9x16.mp4) — 1080×1920, 60 fps, tanpa voice-over. Proyek terpisah di `presentasi/` (panggung graphite, satu slide yang diperbaiki bertahap, font Bricolage Grotesque + Inter, groove 120 BPM — 1 bar = 2 detik). Logo dipakai apa adanya sebagai watermark kecil di pojok kanan atas.

| Waktu | Scene |
|---|---|
| 0–4s | Hook: “Presentasimu bikin ngantuk?” — slide meredup, Zzz → “Mungkin ini penyebabnya.” |
| 4–8s | Slide buruk (teks padat, font kecil, warna-warni, clip-art bergerak) + 5 pin merah: “5 kesalahan” |
| 8–28s | Tiap kesalahan 2 bar: bar 1 = SEBELUM (area ditandai X merah), bar 2 = SESUDAH (slide berubah, centang hijau): teks → poin, font diperbesar, warna 2–3, animasi dihapus, hierarchy jelas |
| 28–34s | Slide final “Clean. Jelas. Mudah dibaca.” + slider sebelum/sesudah |
| 34–40s | “Presentasi bukan tempat memasukkan semuanya.” — tumpukan elemen berjatuhan → “Pilih yang penting.” |

```bash
python3 presentasi/music.py
node scripts/render.mjs --page presentasi/index.html --audio out/presentasi-music.wav --out out/presentasi.mp4 --crf 18
```

---

# Video Arcade — “Level 1: Tugas Menyerang!” (9:16, 40s)

**Hasil:** [`dist/tugas-menyerang-arcade-40s-9x16.mp4`](dist/tugas-menyerang-arcade-40s-9x16.mp4) — 1080×1920, 60 fps, H.264 + AAC, tepat 40 detik, dengan musik & SFX. Proyek terpisah di `arcade/`: dunia game digambar di buffer pixel 270×480 (×4), lalu dikomposit dengan glow, scanline, rolling band, dan bezel CRT. Font bitmap 5×8 dibuat sendiri (`arcade/font.js`). Palet: biru `#184AA1`, putih, navy, aksen amber.

| Waktu | Scene |
|---|---|
| 0–4s | Frame pertama langsung aksi: CRT menyala (snap + flash), bunyi coin + hit di detik 0, teks “level 1: tugas menyerang!” di tengah atas, blok tugas turun cepat → “mulai!” |
| 4–26s | Mahasiswa pixel menembak blok “makalah”, “laporan”, “presentasi”, “kuis”; blok makin banyak & cepat (banner “kecepatan naik!”, “tugas menumpuk!”), blok yang lolos menumpuk, bar nyawa menipis, skor naik |
| 26–34s | Kartu biru “mintask” jatuh, ditangkap → “power up!”, waktu melambat, laser biru membersihkan seluruh layar, teks “bantuan datang.” |
| 34–40s | “stage clear!” + skor akhir & “rekor baru!” → dither ke biru, logo Taskkora + “ada task? taskkora-in aja.” |

Watermark “@taskkora__” di pojok kanan bawah (opacity 30%) sepanjang video.

Semua kejadian game (tembakan, ledakan, blok jatuh, ledakan laser) dihitung deterministik di `arcade/game.js`; `arcade/music.py` membaca event yang sama, jadi SFX jatuh tepat di frame-nya. Musik chiptune orisinal: pulse wave, triangle 4-bit, noise drum; 140 BPM lalu makin cepat sampai 172 BPM saat tugas menumpuk, suspense saat power-up, lalu fanfare kemenangan.

```bash
python3 arcade/music.py
node scripts/render.mjs --page arcade/index.html --audio out/arcade-music.wav --out out/arcade.mp4 --crf 18
```

---

# Video Meditasi — “Tugas numpuk? Tarik napas 20 detik.” (9:16, 40s)

**Hasil:** [`dist/napas-kotak-40s-9x16.mp4`](dist/napas-kotak-40s-9x16.mp4) — 1080×1920, 60 fps, H.264 + AAC, tepat 40 detik, dengan musik & SFX. Proyek terpisah di `napas/` (latar gradien navy → biru, partikel cahaya lembut, font Sora). Palet: biru `#184AA1`, putih, navy, aksen amber.

| Waktu | Scene |
|---|---|
| 0–4s | Frame pertama langsung aksi: garis cahaya amber mulai menggambar sisi pertama kotak, hit lembut + chime di detik 0, teks “tugas numpuk? tarik napas 20 detik.” di tengah atas |
| 4–28s | Box breathing terpandu, satu sisi per fase: tarik → tahan → buang → tahan (6 detik per sisi, hitungan 1–4 tiap 1,5 detik). Kotak mengembang/menyusut & berpendar, latar makin tenang. Teks “satu hal dulu.” lalu “bukan semuanya sekaligus.” |
| 28–35s | Kotak selesai dan bersinar, gelembung chat mintask muncul di tengah: “yang berat, kami bantu ambil.” |
| 35–40s | Kotak berputar & menyusut jadi logo Taskkora yang bersinar, layar berubah biru, tagline “ada task? taskkora-in aja.” |

Watermark “@taskkora__” di pojok kanan bawah (opacity 25%) sepanjang video. Musik ambient orisinal ±60 BPM tanpa beat: piano lembut, pad hangat yang filternya membuka saat tarik napas dan menutup saat buang napas, chime kecil di tiap sisi kotak.

```bash
python3 napas/music.py
node scripts/render.mjs --page napas/index.html --audio out/napas-music.wav --out out/napas.mp4 --crf 18
```
