"""Synthesises the 40 s soundtrack (music bed + SFX synced to the animation).

    python3 scripts/music.py            -> out/taskkora-music.wav

Light, upbeat 120 BPM pop bed (1 beat = 0.5 s, so every scene cut lands on a beat)
with whooshes on transitions, soft pops on element entrances and a chime on the logo.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    lg, rg = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
    L[i:i + len(sig)] += sig * gain * lg
    R[i:i + len(sig)] += sig * gain * rg


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, rel=None, decay=None):
    x = tt(d)
    e = np.minimum(1, x / max(a, 1e-4))
    if decay:
        e *= np.exp(-x / decay)
    if rel:
        e *= np.clip((d - x) / rel, 0, 1)
    return e


def bp(sig, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype='band', fs=SR, output='sos'), sig)


def hp(sig, f):
    return sosfilt(butter(2, f, btype='high', fs=SR, output='sos'), sig)


def lp(sig, f):
    return sosfilt(butter(2, f, btype='low', fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


# ---------------- instruments ----------------
def kick(g=1.0):
    d = 0.35; x = tt(d)
    f = 45 + 85 * np.exp(-x / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-x / 0.12) * g


def clap():
    d = 0.25; n = rng.standard_normal(int(d * SR))
    e = np.exp(-tt(d) / 0.06)
    for k in (0.0, 0.012, 0.024):
        i = int(k * SR); e[i:i + 200] += 0.6
    return bp(n, 900, 3500) * e * 0.5


def hat(open_=False):
    d = 0.18 if open_ else 0.06
    return hp(rng.standard_normal(int(d * SR)), 7000) * np.exp(-tt(d) / (0.05 if open_ else 0.015)) * 0.35


def pluck(freq, d=0.45):
    x = tt(d)
    s = np.sin(2 * np.pi * freq * x) + 0.35 * np.sin(2 * np.pi * 2 * freq * x) + 0.12 * np.sin(2 * np.pi * 3 * freq * x)
    return s * env(d, 0.003, decay=0.14)


def pad(freqs, d):
    x = tt(d)
    s = np.zeros_like(x)
    for f in freqs:
        for det in (-0.12, 0.12):
            s += np.sin(2 * np.pi * f * (1 + det / 100) * x + rng.uniform(0, 6))
            s += 0.3 * np.sin(2 * np.pi * 2 * f * (1 + det / 100) * x)
    s = lp(s, 2200)
    return s / len(freqs) * env(d, 0.35, rel=0.4)


def bass(freq, d):
    x = tt(d)
    s = np.sin(2 * np.pi * freq * x) + 0.25 * np.sin(2 * np.pi * 2 * freq * x)
    return s * env(d, 0.01, rel=0.08) * np.exp(-x / 0.9)


def whoosh(d=0.7, up=True):
    n = rng.standard_normal(int(d * SR))
    x = tt(d) / d
    out = np.zeros_like(n)
    seg = 12
    for k in range(seg):  # stepped band sweep, crossfaded
        a, b = k / seg, (k + 1) / seg
        c = (a + b) / 2
        f = 300 * (20 ** (c if up else 1 - c))
        w = np.clip(1 - np.abs(x - c) * seg, 0, 1)
        out += bp(n, f * 0.7, min(f * 1.6, 16000)) * w
    e = np.sin(np.pi * np.clip(x, 0, 1)) ** 1.5
    return out * e * 0.6


def pop(freq=900, g=1.0):
    d = 0.09; x = tt(d)
    f = freq * (1 + 0.6 * np.exp(-x / 0.01))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.025) * g


def chime(base=1318.5, d=1.6):
    x = tt(d); s = np.zeros_like(x)
    for m, a in ((1, 1), (2.01, 0.35), (3.02, 0.15), (4.2, 0.08)):
        s += a * np.sin(2 * np.pi * base * m * x)
    return s * env(d, 0.002, decay=0.45)


def boom(d=1.4):
    x = tt(d)
    f = 38 + 50 * np.exp(-x / 0.12)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.5)
    return s + lp(rng.standard_normal(len(x)), 400) * np.exp(-x / 0.15) * 0.3


# ---------------- music bed ----------------
# I–V–vi–IV in C, one chord per bar (2 s)
CHORDS = [
    ([48, 60, 64, 67, 71], 36),  # Cmaj7
    ([43, 59, 62, 67, 69], 43),  # G6
    ([45, 60, 64, 67, 69], 45),  # Am7
    ([41, 60, 65, 69, 72], 41),  # Fmaj7
]
BARS = int(DUR / (4 * BEAT))
for b in range(BARS):
    t0 = b * 4 * BEAT
    notes, root = CHORDS[b % 4]
    # pad throughout (quieter under intro/outro hits)
    add(pad([midi(n) for n in notes[1:]], 4 * BEAT + 0.4), t0, 0.10 if t0 >= 4 else 0.13)
    # arpeggio from 5 s
    if 5 <= t0 < 38:
        pattern = [1, 2, 3, 4, 3, 2, 4, 3]
        for k, idx in enumerate(pattern):
            n = notes[idx] + 12
            add(pluck(midi(n)), t0 + k * BEAT / 2, 0.11 if t0 < 12 else 0.13, pan=0.35 if k % 2 else -0.35)
    # bass from 5 s
    if 5 <= t0 < 36:
        for k in range(4):
            add(bass(midi(root), BEAT * 0.9), t0 + k * BEAT, 0.28 if k % 2 == 0 else 0.18)

for k in range(int(DUR / BEAT)):
    t = k * BEAT
    if 5 <= t < 36:
        add(kick(), t, 0.55)
        add(hat(open_=(k % 4 == 3)), t + BEAT / 2, 0.5, pan=0.2)
        if t >= 12 and k % 2 == 1:
            add(clap(), t, 0.45)
        if t >= 22 and t < 30:
            add(hat(), t + BEAT / 4, 0.25, pan=-0.3)
            add(hat(), t + 3 * BEAT / 4, 0.25, pan=-0.3)
    elif 2 <= t < 5 and k % 2 == 0:
        add(kick(0.8), t, 0.45)

# final chord ring-out
add(pad([midi(n) for n in [60, 64, 67, 71, 74]], 3.5), 36.5, 0.14)
for k, n in enumerate([72, 76, 79, 83]):
    add(pluck(midi(n), 1.2), 37.5 + k * 0.12, 0.12, pan=(k - 1.5) * 0.3)

# ---------------- SFX (times match src/anim.js) ----------------
add(whoosh(1.0), 0.05, 0.55)             # arrow flies in
add(boom(), 0.95, 0.5)                   # logo lands
add(pop(700), 1.0, 0.25)                 # check draws
add(chime(1318.5), 1.5, 0.18, pan=0.2)   # shine / sparkles
add(chime(1760), 1.62, 0.1, pan=-0.2)
for i in range(8):
    add(pop(1100 + i * 40), 2.0 + i * 0.03, 0.05)
add(pop(900), 3.2, 0.3)                  # tagline pill
add(pop(1500), 3.85, 0.22)               # little check
add(whoosh(0.65), 4.35, 0.6)             # circle wipe
for i in range(10):                       # task cards
    add(pop(750 + (i % 5) * 90, 0.9), 5.35 + i * 0.42 + 0.12, 0.2, pan=(-0.5 if i % 2 == 0 else 0.5))
add(pop(600), 6.25, 0.22)                # "task?" highlight
add(whoosh(0.9, up=False), 10.9, 0.45)   # cards swirl
add(pop(500), 12.1, 0.3)                 # card lands
for k in range(1, 5):                    # service flips
    add(whoosh(0.4), 12 + 2 * k - 0.25, 0.35)
    add(pop(1000 + k * 60), 12 + 2 * k, 0.12)
for i in range(5):
    add(pop(1300 + i * 70, 0.7), 12.5 + i * 0.07, 0.08)
add(whoosh(0.9), 21.45, 0.65)            # arrow wipe
for i in range(4):
    add(pop(800 + i * 80), 22.85 + i * 0.3 + 0.1, 0.25, pan=(-0.4 if i % 2 == 0 else 0.4))
for i in range(4):
    add(chime(1567.98 + i * 100, 0.6), 27.3 + i * 0.18, 0.06)
add(whoosh(0.9), 29.45, 0.65)            # arrow wipe
add(pop(600), 30.3, 0.3)                 # hub
for i in range(4):
    add(pop(900 + i * 90), 30.55 + i * 0.32 + 0.08, 0.25, pan=(-0.4 if i % 2 == 0 else 0.4))
add(whoosh(0.8, up=False), 35.7, 0.5)    # personas collapse
add(whoosh(0.8), 36.3, 0.5)              # badge expands
add(boom(), 36.95, 0.45)
add(chime(1318.5), 37.2, 0.16, pan=0.2)
add(chime(1975.5), 37.35, 0.08, pan=-0.2)
add(pop(1400), 38.0, 0.25)               # amber dot
add(pop(700), 38.3, 0.3)                 # CTA
add(pop(1800, 0.8), 39.05, 0.25)         # tap

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
fade = np.ones(N)
fi = int(0.05 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo = int(0.6 * SR); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # gentle soft-clip
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/taskkora-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/taskkora-music.wav')
