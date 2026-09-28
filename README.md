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
