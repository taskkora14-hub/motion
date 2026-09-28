"""Soundtrack for "5 Kesalahan Saat Membuat Presentasi" (no voice-over).

    python3 presentasi/music.py   -> out/presentasi-music.wav

Neo-soul electric-piano groove at 120 BPM: one bar = 2 s, so every "mistake" bar and "fix" bar
in presentasi/anim.js starts on a downbeat. Sleepy detuned intro, a sour cluster on each mistake,
a resolving chord + chime on each fix, a breakdown and drop for the ending.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(5)
L = np.zeros(N)
R = np.zeros(N)
BEAT = 0.5


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


# ---------------- voices ----------------
def epiano(notes, d=0.9, bend=0.0):
    """FM-ish electric piano chord; bend (semitones) slides the pitch over the note."""
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n) * 2 ** (bend * (x / d) / 12)
        ph = 2 * np.pi * np.cumsum(f) / SR
        mod = np.sin(ph * 1.0) * 1.6 * np.exp(-x / 0.25)
        s += np.sin(ph + mod) * np.exp(-x / 0.6)
    s /= len(notes)
    return s * np.minimum(1, x / 0.004) * np.clip((d - x) / 0.05, 0, 1)


def pad(notes, d, cut=1400):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.2, 0.2):
            s += np.sin(2 * np.pi * midi(n) * (1 + det / 100) * x + rng.uniform(0, 6))
    s = filt(s / (2 * len(notes)), 'low', cut)
    return s * np.minimum(1, x / 0.5) * np.clip((d - x) / 0.6, 0, 1)


def bass(n, d):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x)
    return s * np.minimum(1, x / 0.006) * np.clip((d - x) / 0.04, 0, 1) * np.exp(-x / 0.5)


def kick():
    x = tt(0.3); f = 48 + 80 * np.exp(-x / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12)


def snare():
    d = 0.22; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'band', [1200, 6000]) * np.exp(-x / 0.06) * 0.6 + np.sin(2 * np.pi * 190 * x) * np.exp(-x / 0.04) * 0.4


def hat(v=1.0):
    return filt(rng.standard_normal(int(0.05 * SR)), 'high', 7500) * np.exp(-tt(0.05) / 0.012) * 0.35 * v


def whoosh(d=0.5, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 350 * (22 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.6


def pop(f=800):
    x = tt(0.09); ff = f * (1 + 0.7 * np.exp(-x / 0.01))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.025)


def ding(n, d=1.0):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 3 * x) * np.exp(-x * 6)) * np.exp(-x / 0.35) * np.minimum(1, x / 0.002)


def sour():
    """dissonant 'wrong' stab for each mistake"""
    x = tt(0.45)
    s = sum(np.sign(np.sin(2 * np.pi * midi(n) * x)) for n in (58, 59, 64)) / 3
    return filt(s, 'low', 2200) * np.exp(-x / 0.14) * 0.6


def hit():
    x = tt(0.9); f = 42 + 70 * np.exp(-x / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.3) + filt(rng.standard_normal(len(x)), 'low', 1200) * np.exp(-x / 0.06) * 0.3


# chords (Dm9 G13 Cmaj9 Am9), one per bar
CH = [([50, 53, 57, 60, 64], 38), ([55, 59, 64, 65, 69], 43), ([48, 52, 55, 59, 62], 36), ([45, 48, 52, 55, 59], 33)]

# ---------------- 0–4: sleepy intro ----------------
add(pad([53, 57, 60, 64], 4.3, cut=900), 0.0, 0.5)
for k, (notes, _) in enumerate(CH[:2]):
    add(epiano([n + 12 for n in notes[1:4]], 1.8, bend=-0.8), k * 2.0 + 0.05, 0.25)   # droopy, "yawning" chords
add(epiano([69, 72, 76], 1.2, bend=-2.0), 1.4, 0.12)                                   # yawn slide
add(whoosh(0.6), 3.45, 0.4)
add(hit(), 4.0, 0.6)                                                                    # slide slams in

# ---------------- 4–34: groove ----------------
bar = 2
t = 4.0
while t < 34.0 - 1e-6:
    notes, root = CH[bar % 4]
    # comp: EP on beat 1 and the "and" of 2
    add(epiano([n + 12 for n in notes[1:]], 0.7), t, 0.2, pan=-0.15)
    add(epiano([n + 12 for n in notes[1:]], 0.4), t + 1.5 * BEAT, 0.13, pan=0.15)
    add(pad([n + 12 for n in notes[1:4]], 2.2, cut=1800), t, 0.12)
    for k in range(4):
        tk = t + k * BEAT
        if k in (0, 2):
            add(kick(), tk, 0.5)
        if k == 2:
            add(kick(), tk + 0.75 * BEAT, 0.3)
        if k in (1, 3):
            add(snare(), tk, 0.42)
        for e in range(2):
            add(hat(1.0 if e else 0.6), tk + e * BEAT / 2 + (0.03 if e else 0), 0.8, pan=0.3)
        add(bass(root + 12, BEAT * (0.9 if k != 3 else 0.45)), tk, 0.26)
    t += 2.0; bar += 1

# ---------------- SFX: bad slide + pins ----------------
add(sour(), 4.1, 0.25)
for i in range(5):
    add(pop(700 + i * 110), 5.0 + i * 0.5, 0.35, pan=-0.4 + i * 0.2)
add(whoosh(0.4, up=False), 7.55, 0.3)

# ---------------- SFX: mistakes & fixes ----------------
for i in range(5):
    s = 8.0 + i * 4.0
    add(whoosh(0.45), s - 0.2, 0.35)
    add(sour(), s + 0.35, 0.35)                     # the problem outline + red X
    add(whoosh(0.5), s + 1.85, 0.3)                 # hand-off to the fix
    fixed = [([62, 65, 69, 72], 0), ([67, 71, 74, 77], 0), ([64, 67, 71, 74], 0), ([60, 64, 67, 71], 0), ([62, 65, 69, 74], 0)][i][0]
    add(epiano([n + 12 for n in fixed], 1.0), s + 2.05, 0.18)
    sweep = filt(rng.standard_normal(int(0.85 * SR)), 'band', [3000, 9000]) * np.sin(np.pi * tt(0.85) / 0.85) * 0.12
    add(sweep, s + 2.05, 0.8)                        # the transformation itself
    add(ding([79, 81, 83, 84, 86][i]), s + 3.0, 0.22) # green check
    add(ding([91, 93, 95, 96, 98][i], 0.5), s + 3.06, 0.07, pan=0.3)

# ---------------- SFX: final slide ----------------
add(hit(), 28.0, 0.45)
spark = filt(rng.standard_normal(int(0.8 * SR)), 'high', 6000) * np.exp(-tt(0.8) / 0.2) * 0.3
add(spark, 28.6, 0.6)
for k, n in enumerate([84, 88, 91]):
    add(ding(n, 1.0), 28.62 + k * 0.08, 0.08)
add(whoosh(1.0), 29.6, 0.35)
add(whoosh(0.9, up=False), 32.2, 0.35)
add(whoosh(0.6), 33.4, 0.4)

# ---------------- 34–40: breakdown + drop ----------------
add(pad([50, 57, 60, 64, 69], 2.6, cut=1200), 34.0, 0.5)
add(epiano([62, 65, 69, 72], 1.6), 34.1, 0.2)
for i in range(12):
    add(pop(900 + (i % 4) * 120), 34.6 + i * 0.07, 0.12, pan=rng.uniform(-0.5, 0.5))
riser = filt(rng.standard_normal(int(1.4 * SR)), 'band', [800, 7000]) * (tt(1.4) / 1.4) ** 2 * 0.25
add(riser, 35.0, 0.8)
add(whoosh(1.0, up=False), 36.0, 0.5)             # clutter falls away
for k in range(3):
    add(hit() * 0.6, 36.6 + k * 0.12, 0.35)
add(epiano([60, 64, 67, 71, 74], 3.0), 36.6, 0.24)   # Cmaj9 — the clean resolution
add(pad([48, 55, 60, 64, 67, 71], 3.4, cut=2200), 36.6, 0.3)
add(ding(84, 1.8), 37.6, 0.15)
for k in range(6):                                    # light outro groove
    tk = 36.6 + k * BEAT * 2
    add(kick(), tk, 0.4)
    add(hat(), tk + BEAT, 0.7, pan=0.3)
    add(bass(36 + 12, BEAT * 1.6), tk, 0.22)
    if k % 2:
        add(snare(), tk, 0.3)
add(epiano([62, 67, 71, 74], 2.0), 38.6, 0.18)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.033, 0.11), (0.061, 0.08), (0.097, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.05 * SR); fo = int(0.9 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/presentasi-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/presentasi-music.wav')
