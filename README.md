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

# Video Arcade — “level 1: tugas menyerang!” (9:16, 40s)

**Hasil:** [`dist/arcade-tugas-menyerang-40s-9x16.mp4`](dist/arcade-tugas-menyerang-40s-9x16.mp4) — 1080×1920, 60 fps, H.264 + AAC, tepat 40 detik. Musik chiptune orisinal + SFX arcade sudah tertanam. Proyek terpisah di `arcade/` (gaya 8-bit pixel art, layar CRT dengan scanline, font Press Start 2P (OFL), palet biru `#184AA1`, putih, navy, aksen amber). Watermark `@taskkora__` (opacity 30%) di pojok kanan bawah sepanjang video.

| Waktu | Scene |
|---|---|
| 0–4s | Hook: CRT menyala (hit + coin tepat di 0.000s), “level 1: tugas menyerang!”, blok tugas turun cepat |
| 4–26s | Mahasiswa pixel menembak blok “makalah”, “laporan”, “presentasi”, “kuis”; blok makin banyak & cepat, yang lolos menumpuk di garis deadline, bar nyawa menipis (20 → 3), skor naik, banner “awas deadline!” |
| 26–34s | Kartu biru “mintask” jatuh → ditangkap (power-up) → laser biru membersihkan seluruh layar, “bantuan datang.” + bonus |
| 34–40s | “stage clear!” + skor/hi-score → layar biru, logo Taskkora (mosaic reveal), “ada task? taskkora-in aja.” |

Gameplay (spawn, tembakan, ledakan, blok yang lolos) dihitung sekali secara deterministik di `arcade/plan.js`; dipakai oleh animasi **dan** musik, jadi tiap “pew”/ledakan sinkron dengan frame. Musik 140 BPM, makin cepat sampai 172 BPM saat tugas menumpuk, break untuk power-up, groove C mayor saat laser, lalu fanfare kemenangan.

```bash
python3 arcade/music.py
node scripts/render.mjs --page arcade/index.html --audio out/arcade-music.wav --out out/arcade.mp4 --crf 18
```

---

# Video Snap Transition — “snap! semester kemarin vs sekarang.” (9:16, 40s)

**Hasil:** [`dist/snap-semester-40s-9x16.mp4`](dist/snap-semester-40s-9x16.mp4) — 1080×1920, 60 fps, H.264 + AAC, tepat 40 detik, musik electro-pop orisinal 125 BPM + SFX snap/whoosh tertanam. Proyek terpisah di `snap/` (ilustrasi flat, kamera terkunci, satu karakter di posisi tetap, font Poppins (OFL), palet biru `#184AA1`, putih, navy, amber). Watermark `@taskkora__` (opacity 30%) di pojok kanan bawah sepanjang video.

| Waktu | Snap (tepat di ketukan) | Scene |
|---|---|---|
| 0–4.32s | 0.00 (hit + snap) | Hook: mahasiswa kusut berhoodie, kantung mata, sticky note panik → “snap! semester kemarin vs sekarang.” |
| 4.32–26.88s | 4.32 · 8.64 · 12.96 · 17.28 · 21.60 | semester 1 kamar berantakan → semester 3 presentasi → semester 5 perpustakaan → semester 7 seminar (jas almamater) → lulus (toga, konfeti) |
| 26.88–34.56s | 26.88 (drop) | Kartu biru “mintask” muncul di tangan, “snap terbaik: serahkan yang bukan keahlianmu.”, chip tugas terbang masuk ke kartu |
| 34.56–40s | 34.56 | Layar biru, logo Taskkora, “ada task? taskkora-in aja.” |

Setiap snap = wipe lingkaran dari tangan yang menjentik (0.16 s) + kilat + garis burst; karakter mengangguk tiap ketukan. Musik: F#m–D–A–E, bass tebal ber-sidechain, build dengan snare roll + riser, drop di 26.88 s.

```bash
python3 snap/music.py
node scripts/render.mjs --page snap/index.html --audio out/snap-music.wav --out out/snap.mp4 --crf 18
```
