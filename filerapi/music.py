"""Soundtrack for "File tugasmu masih begini?" (no voice-over).

    python3 filerapi/music.py   -> out/filerapi-music.wav

Playful marimba groove (110 BPM, D major) with UI sound design synced to filerapi/anim.js:
keyboard typing, popping files, an error buzz on search, and satisfying snaps while sorting.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
L = np.zeros(N)
R = np.zeros(N)


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
def marimba(n, d=0.6):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.22) + 0.35 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x / 0.03)
    return s * np.minimum(1, x / 0.002)


def bass(n, d):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.2 * np.sin(4 * np.pi * f * x)
    return s * np.minimum(1, x / 0.01) * np.clip((d - x) / 0.06, 0, 1) * np.exp(-x / 0.6)


def pad(notes, d):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.1, 0.1):
            s += np.sin(2 * np.pi * midi(n) * (1 + det / 100) * x + rng.uniform(0, 6))
    s = filt(s, 'low', 1600) / (2 * len(notes))
    return s * np.minimum(1, x / 0.4) * np.clip((d - x) / 0.5, 0, 1)


def kick():
    x = tt(0.25); f = 50 + 80 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.09)


def snap():
    d = 0.12; n = rng.standard_normal(int(d * SR))
    return filt(n, 'band', [1500, 6000]) * np.exp(-tt(d) / 0.02) * 0.6


def shaker(g=0.3):
    return filt(rng.standard_normal(int(0.07 * SR)), 'high', 7000) * np.exp(-tt(0.07) / 0.018) * g


def key():
    # mechanical keyboard click: short noise + tiny body
    d = 0.05; x = tt(d)
    return (filt(rng.standard_normal(len(x)), 'band', [2000, 8000]) * np.exp(-x / 0.006)
            + 0.4 * np.sin(2 * np.pi * rng.uniform(300, 420) * x) * np.exp(-x / 0.01))


def pop(f=800, g=1.0):
    x = tt(0.08); ff = f * (1 + 0.8 * np.exp(-x / 0.008))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.022) * g


def whoosh(d=0.5, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 400 * (18 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.6


def buzz():
    d = 0.42; x = tt(d)
    s = np.sign(np.sin(2 * np.pi * 150 * x)) * 0.5 + np.sign(np.sin(2 * np.pi * 158 * x)) * 0.5
    s = filt(s, 'low', 1800)
    return s * (np.floor(x / 0.14) % 2 == 0) * np.exp(-x / 0.4) * 0.5


def glitch(d=0.06):
    return filt(rng.standard_normal(int(d * SR)), 'band', [800, 4000]) * np.sign(np.sin(2 * np.pi * 60 * tt(d))) * 0.4


def ding(n, d=0.9):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * f * 3 * x) * np.exp(-x * 6)) * np.exp(-x / 0.3) * np.minimum(1, x / 0.002)


def snapclick(f):
    s = pop(f, 0.8)
    c = filt(rng.standard_normal(int(0.02 * SR)), 'high', 5000) * np.exp(-tt(0.02) / 0.004) * 0.5
    s[:len(c)] += c
    return s


# ---------------- groove: 110 BPM, D major ----------------
BEAT = 60 / 110
CH = [([62, 66, 69, 73], 38), ([59, 62, 66, 69], 35), ([55, 59, 62, 66], 31), ([57, 61, 64, 69], 33)]  # Dmaj7 Bm7 Gmaj7 A
bar = 0
t = 0.0
while t < DUR:
    notes, root = CH[bar % 4]
    lift = t >= 26.0
    add(pad([n + (12 if lift else 0) for n in notes[:3]], 4 * BEAT + 0.3), t, 0.12 if t < 26 else 0.16)
    patt = [0, 2, 1, 3, 2, 0, 3, 1]
    for k in range(8):
        tk = t + k * BEAT / 2
        if tk >= 38.8:
            break
        if t < 7 and k % 2:
            continue
        n = notes[patt[k]] + 12
        add(marimba(n), tk, 0.2 if tk < 7 else 0.13, pan=0.3 if k % 2 else -0.3)
    for k in range(4):
        tk = t + k * BEAT
        if 7 <= tk < 38.5:
            add(kick(), tk, 0.45)
            add(bass(root + 12, BEAT * 0.9), tk, 0.2)
        if 7 <= tk < 38.5 and k % 2 == 1:
            add(snap(), tk, 0.5)
        if tk < 38.5:
            add(shaker(), tk + BEAT / 2, 0.8, pan=0.3)
    t += 4 * BEAT; bar += 1
add(pad([62, 66, 69, 73, 76], 3.2), 37.3, 0.2)
for k, n in enumerate([74, 78, 81, 85]):
    add(marimba(n, 1.2), 38.2 + k * 0.1, 0.13)

# ---------------- SFX: hook ----------------
NAMES = [('FINAL', 0.35), ('FINAL FIX', 1.55), ('FINAL FIX BANGET', 2.75), ('FINAL FIX TERBARU', 4.05)]
BS, TY = 0.035, 0.055
prev = ''
for name, s in NAMES:
    pre = 0
    while pre < len(prev) and pre < len(name) and prev[pre] == name[pre]:
        pre += 1
    dl, ad = len(prev) - pre, len(name) - pre
    for i in range(dl):
        add(key(), s + i * BS, 0.35, pan=0.2)
    for i in range(ad):
        add(key(), s + dl * BS + i * TY, 0.45, pan=(rng.uniform(-0.3, 0.3)))
    if prev:
        add(whoosh(0.35), s - 0.05, 0.25)
        add(pop(420), s + 0.3, 0.3)          # old version drops into the pile
    prev = name
add(whoosh(0.5), 5.05, 0.3)
add(glitch(0.3) * 0.5, 5.8, 0.3)             # squiggle underline
add(whoosh(0.7, up=False), 6.35, 0.4)
add(pop(600), 6.95, 0.4)

# ---------------- SFX: mess ----------------
for i in range(28):
    add(pop(rng.uniform(600, 1400), 0.8), 7.25 + i * 0.1 + 0.05, 0.16, pan=rng.uniform(-0.6, 0.6))
for i in range(5):
    add(key(), 10.55 + i * 0.09, 0.45)
add(buzz(), 11.12, 0.5)
rum = filt(rng.standard_normal(int(0.7 * SR)), 'low', 150) * np.sin(np.pi * tt(0.7) / 0.7)
add(rum, 12.6, 0.8)
add(whoosh(0.6), 13.3, 0.5)

# ---------------- SFX: problems ----------------
for s in (14.0, 18.0, 22.0):
    add(pop(900), s, 0.3)
    add(buzz() * 0.4, s + 0.05, 0.25)
for i in range(5):                            # scrambling names
    for k in range(10):
        add(glitch(0.03), 14.5 + i * 0.12 + k * 0.1, 0.12, pan=rng.uniform(-0.5, 0.5))
    add(pop(1500), 14.3 + i * 0.12 + 1.35, 0.15)
for i in range(8):                            # version cards fanning out
    add(whoosh(0.18), 18.3 + i * 0.13, 0.15, pan=-0.6 + i * 0.17)
    add(pop(500 + i * 60), 18.35 + i * 0.13, 0.15)
for i in range(9):                            # folders popping into a tangle
    add(pop(rng.uniform(500, 900)), 22.2 + i * 0.12, 0.18, pan=rng.uniform(-0.6, 0.6))
add(ding(88, 0.5), 23.8, 0.08); add(ding(88, 0.5), 24.3, 0.06)
for s in (17.7, 21.7, 25.7):
    add(whoosh(0.6), s, 0.45)

# ---------------- SFX: tidy ----------------
add(ding(74, 1.2), 26.35, 0.14)
for i in range(4):
    add(whoosh(0.3), 26.7 + i * 0.28, 0.2, pan=0.5)
    add(pop(700 + i * 90), 26.9 + i * 0.28, 0.2)
for k in range(9):                             # files arc into folders: swish + ascending snap
    s = 28.45 + k * 0.28
    add(whoosh(0.3), s, 0.14, pan=-0.4)
    add(snapclick(midi(74 + [0, 2, 4, 5, 7, 9, 11, 12, 14][k])), s + 0.32, 0.35)
for i in range(4):
    add(ding([81, 83, 85, 86][i]), 31.4 + i * 0.16, 0.15, pan=-0.3 + i * 0.2)
add(whoosh(0.7), 33.3, 0.45)

# ---------------- SFX: ending ----------------
add(pop(700), 34.15, 0.25)
for i, s in enumerate((35.0, 35.45, 35.9)):
    add(pop(900 + i * 150), s, 0.3)
add(ding(90, 1.4), 37.75, 0.12)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.031, 0.12), (0.057, 0.09), (0.089, 0.06)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.05 * SR); fo = int(0.8 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/filerapi-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/filerapi-music.wav')
