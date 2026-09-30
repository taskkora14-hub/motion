"""Soundtrack for "Simple Budget Tracker" (30 s, no voice-over).

    python3 budget/music.py   -> out/budget-music.wav

Light, bright pluck groove at 120 BPM (one beat = 0.5 s, so every scene cut in budget/anim.js
lands on a beat). SFX are timed to the animation: items drifting out of the wallet, typing,
category chips, currency taps/flips, coins dropping back in, the badge chime and the end card.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
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
def pluck(n, d=0.45):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x) * np.exp(-x / 0.05) + 0.15 * np.sin(6 * np.pi * f * x) * np.exp(-x / 0.03)
    return s * np.exp(-x / 0.16) * np.minimum(1, x / 0.003)


def pad(notes, d, cut=1600):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.15, 0.15):
            s += np.sin(2 * np.pi * midi(n) * (1 + det / 100) * x + rng.uniform(0, 6))
    s = filt(s / (2 * len(notes)), 'low', cut)
    return s * np.minimum(1, x / 0.4) * np.clip((d - x) / 0.5, 0, 1)


def bass(n, d):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x)
    return s * np.minimum(1, x / 0.006) * np.clip((d - x) / 0.04, 0, 1) * np.exp(-x / 0.4)


def kick():
    x = tt(0.25); f = 50 + 70 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.09)


def clap():
    x = tt(0.18); n = filt(rng.standard_normal(len(x)), 'band', [1000, 5000])
    env = sum(np.exp(-np.clip(x - k * 0.011, 0, None) / 0.012) * (x >= k * 0.011) for k in range(3)) / 3
    return n * (env + np.exp(-x / 0.05) * 0.5) * 0.5


def hat(v=1.0):
    return filt(rng.standard_normal(int(0.04 * SR)), 'high', 8000) * np.exp(-tt(0.04) / 0.01) * 0.3 * v


def shaker():
    return filt(rng.standard_normal(int(0.07 * SR)), 'band', [5000, 11000]) * np.sin(np.pi * tt(0.07) / 0.07) * 0.12


def whoosh(d=0.5, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 350 * (22 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.55


def pop(f=800):
    x = tt(0.09); ff = f * (1 + 0.7 * np.exp(-x / 0.01))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.025)


def blip_down(n):
    x = tt(0.35); f = midi(n) * 2 ** (-7 * x / 0.35 / 12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.1) * np.minimum(1, x / 0.003)


def key():
    x = tt(0.035)
    return filt(rng.standard_normal(len(x)), 'band', [2000, 7000]) * np.exp(-x / 0.006) * 0.5 + np.sin(2 * np.pi * 1800 * x) * np.exp(-x / 0.004) * 0.2


def clink(n):
    x = tt(0.5); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.6 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x / 0.05)) * np.exp(-x / 0.12)


def ding(n, d=1.0):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 3 * x) * np.exp(-x * 6)) * np.exp(-x / 0.35) * np.minimum(1, x / 0.002)


def hit():
    x = tt(0.8); f = 44 + 60 * np.exp(-x / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.25) + filt(rng.standard_normal(len(x)), 'low', 1500) * np.exp(-x / 0.05) * 0.25


# Fmaj7 – Dm7 – Bbmaj7 – C6, one chord per bar (2 s)
CH = [([53, 57, 60, 64], 41), ([50, 53, 57, 60], 38), ([46, 50, 53, 57], 34), ([48, 52, 55, 57], 36)]

# ---------------- 0–5: intro (sparse plucks, items drifting out) ----------------
add(pad([57, 60, 64, 67], 5.2, cut=1000), 0.0, 0.35)
for k in range(10):
    notes, _ = CH[(k // 4) % 4]
    add(pluck(notes[k % 4] + 24), k * BEAT, 0.12, pan=0.3 if k % 2 else -0.3)
for i, t in enumerate([1.0, 1.3, 1.6, 1.95, 2.25, 2.55, 2.9, 3.25, 3.55]):
    add(blip_down(84 - i), t, 0.12, pan=rng.uniform(-0.5, 0.5))   # money slipping away
add(pop(520), 2.3, 0.35)                                            # "why?"
add(whoosh(0.55), 4.5, 0.35)

# ---------------- 5–26: groove ----------------
t = 5.0; bar = 0
while t < 26.0 - 1e-6:
    notes, root = CH[bar % 4]
    add(pad([n + 12 for n in notes], 2.1, cut=1800), t, 0.12)
    for k in range(4):
        tk = t + k * BEAT
        add(kick(), tk, 0.42)
        if k in (1, 3):
            add(clap(), tk, 0.3)
        add(hat(), tk + BEAT / 2, 0.8, pan=0.35)
        for e in range(4):
            add(shaker(), tk + e * BEAT / 4, 0.8 if e % 2 else 0.4, pan=-0.3)
        add(bass(root if k != 2 else root + 12, BEAT * 0.8), tk, 0.24)
        for e in range(2):                                           # light 8th-note pluck arp
            add(pluck(notes[(k * 2 + e) % 4] + 24), tk + e * BEAT / 2, 0.08, pan=-0.2 + 0.4 * e)
    t += 2.0; bar += 1

# ---------------- SFX: sheet ----------------
add(pop(700), 5.6, 0.3)                                             # income row
for i, desc in enumerate(['Coffee', 'Ride to campus', 'Snacks', 'Streaming plan', 'Groceries', 'Phone plan']):
    t0 = 6.05 + i * 0.9
    for c in range(len(desc)):
        add(key(), t0 + 0.38 * c / len(desc), 0.35, pan=rng.uniform(-0.3, 0.3))
    add(pop(820 + i * 60), t0 + 0.42, 0.28)                         # category chip
add(whoosh(0.5), 11.9, 0.3)

# ---------------- SFX: dashboard + currency ----------------
for i in range(4):
    add(pluck(72 + [0, 4, 7, 12][i], 0.5), 12.9 + i * 0.3, 0.14)    # donut segments
for i in range(10):
    add(key(), 13.6 + i * 0.14, 0.2)                                # balance counting up
add(ding(84, 0.8), 15.0, 0.1)
for tp in (15.18, 15.52, 18.18, 18.52):
    add(pop(1200), tp, 0.22)                                        # taps
for tf in (15.6, 18.6):
    add(whoosh(0.35, up=False), tf, 0.25)
    for i in range(8):
        add(key(), tf + 0.03 * i, 0.25)                             # every number rolls
    add(ding(88, 0.6), tf + 0.4, 0.08)
add(whoosh(0.5, up=False), 21.7, 0.3)

# ---------------- SFX: refill + badge ----------------
for i in range(7):
    add(clink(88 + (i % 3) * 2), 22.97 + i * 0.15, 0.16, pan=rng.uniform(-0.4, 0.4))
for k, n in enumerate([77, 81, 84, 89]):
    add(ding(n, 1.0), 23.75 + k * 0.07, 0.12)
add(whoosh(0.5), 25.6, 0.3)

# ---------------- 26–30: end card ----------------
add(hit(), 26.2, 0.45)
add(pad([53, 60, 64, 67, 72], 3.8, cut=2200), 26.2, 0.4)
add(ding(84, 1.6), 26.25, 0.12)
for k in range(5):
    add(kick(), 26.2 + k * BEAT, 0.3 * (1 - k / 6))
    add(hat(), 26.2 + k * BEAT + BEAT / 2, 0.6)
for k, n in enumerate([72, 76, 79, 84]):
    add(pluck(n, 0.8), 27.0 + k * 0.25, 0.1)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.031, 0.1), (0.057, 0.07), (0.089, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.03 * SR); fo = int(1.2 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/budget-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/budget-music.wav')
