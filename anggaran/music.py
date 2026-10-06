"""Original groovy score + SFX for "uang bulanan segini cukup nggak?" (no voice-over).

    python3 anggaran/music.py   -> out/anggaran-music.wav

105 BPM groove in C (Dm9 - G13 - Cmaj9 - Am9): syncopated synth bass, light electric-piano stabs,
clav, tight drums. One budget category every 6 beats, exactly as in anggaran/anim.js (CAT_T):
coin "cring" + calculator key clicks for each, a funny descending "wah-wah" when the balance turns
red, hits zero, and when the calculator shows rp0. Breakdown for "ini cuma contoh", light groove out.
The hit + coin land at 0.000 s.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(105)
L = np.zeros(N)
R = np.zeros(N)

BEAT = 60 / 105
S16 = BEAT / 4
VALS = [600000, 500000, 150000, 75000, 50000, 50000, 75000]
CAT_T = [8 * BEAT + k * 6 * BEAT for k in range(7)]
SCENE3 = 52 * BEAT
FIELDS_T = 60 * BEAT


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def env(x, d, a=0.004, rel=0.04):
    return np.minimum(1, x / a) * np.clip((d - x) / rel, 0, 1)


def saw(f, x):
    return 2 * ((np.cumsum(np.broadcast_to(f, x.shape)) / SR) % 1.0) - 1


def noise(d):
    return rng.standard_normal(len(tt(d)))


# ---------------- instruments ----------------
def kick():
    x = tt(0.3); f = 48 + 120 * np.exp(-x / 0.03)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.13) * 1.5)


def snare():
    d = 0.22; x = tt(d)
    return filt(noise(d), 'band', [1200, 7000]) * np.exp(-x / 0.06) * 0.6 + np.sin(2 * np.pi * 190 * x) * np.exp(-x / 0.04) * 0.4


def hat(v=1.0, open_=False):
    d = 0.14 if open_ else 0.04; x = tt(d)
    return filt(noise(d), 'high', 7500) * np.exp(-x / (0.045 if open_ else 0.01)) * 0.45 * v


def bass(n, d):
    x = tt(d); f = midi(n)
    s = saw(f, x) * 0.6 + np.sin(2 * np.pi * f * x) * 0.9
    bright = filt(s, 'low', 1400) * np.exp(-x / 0.06); dark = filt(s, 'low', 380)
    return (bright * 0.7 + dark) * env(x, d, 0.003, 0.025)


def epiano(notes, d, vel=1.0):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n); ph = 2 * np.pi * f * x
        s += np.sin(ph + 1.3 * np.sin(ph) * np.exp(-x / 0.18)) * np.exp(-x / 0.8)
    return filt(s / len(notes), 'low', 3500) * vel * env(x, d, 0.004, 0.06)


def clav(n, d=0.12):
    x = tt(d); f = midi(n)
    s = np.where((f * x) % 1 < 0.3, 1.0, -1.0) * 0.5 + saw(f * 2, x) * 0.3
    return filt(s, 'band', [600, 4000]) * np.exp(-x / 0.05) * env(x, d, 0.002, 0.02)


# ---------------- SFX ----------------
def cring():
    """coin out: two bright metallic chimes with a short shimmer"""
    out = np.zeros(int(0.9 * SR))
    for k, (f, g) in enumerate(((2793, 1.0), (3951, 0.8))):
        x = tt(0.7)
        s = sum(np.sin(2 * np.pi * f * m * x + rng.uniform(0, 6)) / (j + 1) for j, m in enumerate((1, 2.41, 3.87, 5.3))) * np.exp(-x / 0.16) * g
        i = int(k * 0.07 * SR); out[i:i + len(s)] += s[: len(out) - i]
    jingle = filt(noise(0.25), 'high', 6000) * np.exp(-tt(0.25) / 0.05) * 0.3
    out[:len(jingle)] += jingle
    return out * 0.5


def calc_click(v=1.0):
    x = tt(0.04)
    return (filt(noise(0.04), 'band', [2500, 8000]) * np.exp(-x / 0.003) + np.sin(2 * np.pi * 1900 * x) * np.exp(-x / 0.006) * 0.4) * v


def calc_beep(f=2200, d=0.12):
    x = tt(d)
    return np.where((f * x) % 1 < 0.5, 1.0, -1.0) * env(x, d, 0.002, 0.01) * 0.25


def wah_down():
    """funny descending 'wah-wah-wah-waaah' (muted brass-ish)"""
    out = []
    for k, (n, d) in enumerate(((58, 0.32), (57, 0.32), (56, 0.32), (55, 0.9))):
        x = tt(d); f = midi(n) * (1 + (0.015 * np.sin(2 * np.pi * 6 * x) if k == 3 else 0))
        s = saw(f, x)
        wah = 0.5 - 0.5 * np.cos(2 * np.pi * np.clip(x / min(d, 0.35), 0, 1))
        bright = filt(s, 'low', 1600); dark = filt(s, 'low', 400)
        out.append((bright * wah + dark * (1 - wah)) * env(x, d, 0.02, 0.06))
    return np.concatenate(out) * 0.7


def ding(f=1760):
    x = tt(0.5)
    return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 2 * x) * np.exp(-x * 8)) * np.exp(-x / 0.15)


def hit0():
    d = 0.8; x = tt(d)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(40 + 110 * np.exp(-x / 0.05)) / SR) * np.exp(-x / 0.25) * 1.6) + filt(noise(d), 'low', 4000) * np.exp(-x / 0.04) * 0.4


def pop(f=900):
    x = tt(0.1)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.2 * np.exp(-x / 0.012))) / SR) * np.exp(-x / 0.03)


# ---------------- groove ----------------
CH = [(38, [62, 65, 69, 72, 76]), (43, [59, 64, 65, 69]), (36, [59, 62, 64, 67]), (45, [60, 64, 67, 71])]   # Dm9 G13 Cmaj9 Am9
BASS = [0, None, None, 0, None, None, 12, None, 0, None, 7, None, None, 10, 12, None]     # syncopated 16ths
nbars = int(np.ceil(DUR / (4 * BEAT)))
for bar in range(nbars):
    t0 = bar * 4 * BEAT
    root, ch = CH[bar % 4]
    breakdown = SCENE3 <= t0 < FIELDS_T
    for s in range(16):
        t = t0 + s * S16
        if t >= 39.3:
            break
        # drums
        if not breakdown:
            if s in (0, 6, 8, 11) and not (t >= 38.5):
                add(kick(), t, 0.65 if s in (0, 8) else 0.4)
            if s in (4, 12):
                add(snare(), t, 0.42)
            add(hat(1.0 if s % 2 == 0 else 0.55, open_=(s == 14)), t + (0.012 if s % 2 else 0), 0.25, pan=0.25)
        elif s % 4 == 2:
            add(hat(0.5), t, 0.18, pan=0.25)
        # bass
        b = BASS[s]
        if b is not None:
            add(bass(root + b - 12, S16 * (1.6 if s in (0, 8) else 0.9)), t, 0.5 if not breakdown else 0.35)
        # electric piano stabs on the off-beats, clav ghost notes
        if s in (2, 7, 10) and not breakdown:
            add(epiano(ch[1:], S16 * 2.2, 0.9), t, 0.2, pan=-0.15)
        if breakdown and s == 0:
            add(epiano(ch, 4 * BEAT * 0.95, 0.8), t, 0.22, pan=-0.1)
        if s in (3, 13) and not breakdown and t > 4.0:
            add(clav(ch[-1] + 12), t, 0.12, pan=0.35)
# ending chord
add(epiano([48, 59, 64, 67, 71, 74], 1.6), 38.4, 0.24)
add(bass(36 - 12, 1.2), 38.4, 0.5)
add(kick(), 38.4, 0.6)

# ---------------- SFX ----------------
add(hit0(), 0.0, 0.7)
add(cring(), 0.0, 0.7)
add(ding(1568), 0.06, 0.18, pan=0.2)
for k, (t, v) in enumerate(zip(CAT_T, VALS)):
    add(cring(), t + 0.1, 0.6, pan=-0.1 + 0.05 * k)
    digits = str(v).rstrip('0')
    keys = 2 + len(digits) + 3
    for i in range(keys):
        add(calc_click(0.9), t + 0.12 + i * 0.09, 0.35, pan=-0.45)
    add(calc_beep(2400, 0.06), t + 0.12 + keys * 0.09, 0.2, pan=-0.45)
add(wah_down(), CAT_T[3] + 0.95, 0.38)          # balance turns red ("hampir habis")
add(wah_down(), CAT_T[6] + 0.95, 0.42)          # balance hits rp0
# scene 3: calculator on stage
for dt in (0.2, 0.55, 0.95):
    add(calc_click(1.0), SCENE3 + dt, 0.45, pan=-0.2)
add(calc_beep(1800, 0.25), SCENE3 + 1.15, 0.25)
add(wah_down(), SCENE3 + 1.25, 0.4)
add(pop(800), SCENE3 + 1.3, 0.25); add(pop(950), SCENE3 + 1.6, 0.25)
add(pop(700), FIELDS_T, 0.3)
for i in range(3):
    add(pop(1000 + i * 120), FIELDS_T + 0.3 + i * 0.25, 0.28, pan=-0.2 + i * 0.2)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.027, 0.1), (0.043, 0.07), (0.071, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
mix = sosfilt(butter(2, 25, btype='high', fs=SR, output='sos'), mix, axis=0)
fi = int(0.001 * SR); fo = int(0.4 * SR)              # no fade-in: the hit is at 0.000 s
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/anggaran-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/anggaran-music.wav', f'{len(mix) / SR:.3f}s')
