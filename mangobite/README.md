# Mangobite: Maskot & Motion 30 detik (9:16)

- `mangobite-mascot.svg`: maskot vektor dan lembar 4 ekspresi (grup `<g>` per bagian tubuh).
- `index.html`: motion graphic 30 detik, satu file mandiri (SVG + JS, tanpa library). Bisa langsung dibuka di browser.
  - Kontrol: Play/Pause, Replay, scrubber, kecepatan 0.25×–2×, **Mode rekam** (kontrol disembunyikan, jeda 1 detik, lalu animasi diputar dari awal).
  - Keyboard: `Spasi` play/pause · `H` sembunyikan/tampilkan kontrol · `R` ulang · `F` layar penuh · `←/→` geser 1 detik.
  - URL: `?autoplay` langsung main, `?t=12.5` bekukan di detik tertentu.
- `dist/mangobite-30s-9x16.mp4`: hasil render 1080×1920, 60 fps, H.264 (tanpa audio).

## Render ulang ke MP4

```bash
node mangobite/render.mjs                    # -> mangobite/dist/mangobite-30s-9x16.mp4
node mangobite/render.mjs --fps 30           # file lebih kecil
node mangobite/render.mjs --stills 5,15,30   # cek frame tertentu
```

Butuh Playwright (Chromium) dan ffmpeg dengan libx264.

## Mengubah timing

Seluruh animasi adalah fungsi murni dari waktu `render(t)` di `index.html`. Timing diatur di blok `TIMELINE`:
`jump(...)` untuk lompatan, `MOUTH`/`EYES` untuk pergantian ekspresi, `BLINKS` untuk kedipan, `BITES` untuk gigitan,
`wave(t, mulai, selesai)` untuk lambaian, dan `WM_START` untuk munculnya teks.
