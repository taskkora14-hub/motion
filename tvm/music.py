"""Soundtrack for "Memahami Time Value of Money (TVM)" (no voice-over).

    python3 tvm/music.py   -> out/tvm-music.wav

Cinematic half-time pulse at 120 BPM (1 bar = 2 s): warm pad, glassy pluck arpeggio and sub bass
over Bm-G-D-A. SFX follow tvm/anim.js: counter ticks, coin chimes, ka-ching on +10%, impacts on the
TIME VALUE OF MONEY title and the PRESENT VALUE reveal, taps on the follow buttons.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 60.0
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
def pad(notes, d, cut=1600):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.12, 0.0, 0.12):
            f = midi(n) * (1 + det / 100)
            s += 2 * ((x * f + rng.uniform(0, 1)) % 1) - 1  # saw
    s = filt(s / (3 * len(notes)), 'low', cut)
    return s * np.minimum(1, x / 0.7) * np.clip((d - x) / 0.8, 0, 1)


def pluck(n, d=0.45):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * 2 * f * x) * np.exp(-x / 0.05) + 0.2 * np.sin(2 * np.pi * 3.01 * f * x) * np.exp(-x / 0.03)
    return s * np.exp(-x / 0.14) * np.minimum(1, x / 0.002)


def sub(n, d):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.15 * np.sin(4 * np.pi * f * x)
    return s * np.minimum(1, x / 0.01) * np.clip((d - x) / 0.08, 0, 1)


def kick():
    x = tt(0.4); f = 44 + 90 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.16)


def clap():
    x = tt(0.3); n = filt(rng.standard_normal(len(x)), 'band', [900, 5000])
    env = sum(np.exp(-np.clip(x - k * 0.011, 0, None) / 0.008) * (x >= k * 0.011) for k in range(3)) + np.exp(-x / 0.09) * 0.6
    return n * env * 0.5


def hat(v=1.0):
    return filt(rng.standard_normal(int(0.06 * SR)), 'high', 8000) * np.exp(-tt(0.06) / 0.014) * 0.3 * v


def whoosh(d=0.6, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 300 * (25 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.6


def pop(f=800):
    x = tt(0.1); ff = f * (1 + 0.6 * np.exp(-x / 0.01))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.03)


def click():
    x = tt(0.03)
    return filt(rng.standard_normal(len(x)), 'band', [2000, 9000]) * np.exp(-x / 0.004)


def tickc(f=3200):
    x = tt(0.03)
    return np.sin(2 * np.pi * f * x) * np.exp(-x / 0.006)


def chime(n, d=1.2):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 5) + 0.2 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x * 9)
    return s * np.exp(-x / 0.4) * np.minimum(1, x / 0.002)


def impact():
    x = tt(1.6); f = 36 + 70 * np.exp(-x / 0.06)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.45)
    noise = filt(rng.standard_normal(len(x)), 'low', 2500) * np.exp(-x / 0.12) * 0.4
    return body + noise


def riser(d):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n)
    for k in range(10):
        c = (k + 0.5) / 10; f = 400 * (18 ** c)
        out += filt(n, 'band', [f * 0.8, min(f * 1.3, 18000)]) * np.clip(1 - np.abs(x / d - c) * 6, 0, 1)
    return out * (x / d) ** 2 * 0.5


def kaching():
    s = chime(88, 0.9) * 0.6 + chime(93, 0.9) * 0.5
    n = int(0.25 * SR)
    s[:n] += filt(rng.standard_normal(n), 'high', 6000) * np.exp(-tt(0.25) / 0.05) * 0.4
    return s


# Bm - G - D - A, one chord per bar
CH = [([59, 62, 66], 35), ([55, 59, 62], 31), ([62, 66, 69], 38), ([57, 61, 64], 33)]
ARP = [0, 1, 2, 1, 2, 0, 2, 1]


def bar_music(t, k, level):
    """level 0: pad only, 1: + arp + sub, 2: + drums"""
    notes, root = CH[k % 4]
    add(pad([n for n in notes] + [notes[0] + 12], 2.3, cut=1300 + 600 * level), t, 0.16)
    if level >= 1:
        for j in range(8):
            add(pluck(notes[ARP[j]] + 12, 0.4), t + j * 0.25, 0.09 + 0.02 * (j % 2 == 0), pan=(-0.35 if j % 2 else 0.35))
        add(sub(root, 1.9), t, 0.3)
    if level >= 2:
        add(kick(), t, 0.55); add(kick(), t + 1.5, 0.35)
        add(clap(), t + 1.0, 0.35)
        for j in range(8):
            add(hat(1.0 if j % 2 else 0.5), t + j * 0.25 + (0.02 if j % 2 else 0), 0.7, pan=0.25)


# ---------------- music bed ----------------
levels = {}
for b in range(30):
    t = b * 2.0
    if t < 4: lv = 1
    elif t < 12: lv = 1
    elif t < 34: lv = 2
    elif t < 40: lv = 1
    elif t < 52: lv = 2
    elif t < 54: lv = 0
    else: lv = 2 if t < 58 else 1
    bar_music(t, b, lv)

# ---------------- transitions ----------------
for b in (5, 12, 22, 35, 45, 53):
    add(whoosh(0.6), b - 0.45, 0.35)

# ---------------- 0–5 hook ----------------
add(impact(), 0.12, 0.45)
add(chime(78, 1.5), 0.15, 0.12)
add(pop(700), 1.3, 0.3); add(pop(1000), 1.6, 0.25); add(pop(850), 1.85, 0.3)
add(pop(600), 2.5, 0.15); add(pop(760), 2.7, 0.15)
add(click(), 3.35, 0.6); add(chime(86, 0.8), 3.45, 0.2); add(chime(90, 0.8), 3.53, 0.12)

# ---------------- 5–12 question ----------------
for k in range(22):
    add(tickc(2800 + k * 30), 5.3 + (k / 22) ** 1.6 * 1.1, 0.12)
add(pop(520), 6.3, 0.3)
for k in range(22):
    add(tickc(2600 + k * 30), 6.8 + (k / 22) ** 1.6 * 1.1, 0.12)
for k in range(12):   # a year of clock ticks
    add(tickc(1800), 7.2 + k * 0.15, 0.14, pan=0.3)
add(chime(71, 0.8), 9.3, 0.18); add(chime(76, 1.2), 9.55, 0.2)   # "?"

# ---------------- 12–22 concept ----------------
add(impact(), 12.05, 0.6)
add(chime(74, 2.0), 12.05, 0.12); add(chime(81, 2.0), 12.1, 0.08)
add(whoosh(0.7), 14.4, 0.3)
for i in range(4):
    add(pop(650 + i * 120), 16.3 + i * 0.12, 0.22, pan=-0.4 + i * 0.27)
# coin passes each year mark (mp = inOutSine over 17.3–21.2)
for u, n in ((0.0, 74), (1 / 3, 78), (2 / 3, 81), (1.0, 86)):
    tp = 17.3 + np.arccos(1 - 2 * u) / np.pi * 3.9
    add(chime(n, 1.2), tp, 0.18, pan=-0.5 + u)
shimmer = filt(rng.standard_normal(int(3.9 * SR)), 'band', [5000, 12000]) * np.sin(np.pi * tt(3.9) / 3.9) * 0.05
add(shimmer, 17.3, 1.0)

# ---------------- 22–35 example ----------------
add(pop(900), 22.05, 0.3)
add(whoosh(0.4), 24.0, 0.2); add(pop(700), 24.4, 0.3)
for i in range(6):
    add(whoosh(0.5), 25.3 + i * 0.5, 0.08, pan=(-0.4 if i % 2 else 0.4))
for k in range(36):
    add(tickc(2400 + k * 25), 25.4 + (k / 36) ** 1.3 * 3.2, 0.1)
add(kaching(), 28.6, 0.4)
add(pop(500), 29.3, 0.15)
add(chime(81, 1.4), 31.2, 0.12); add(chime(86, 1.4), 31.85, 0.12)

# ---------------- 35–45 present value ----------------
for i, f in enumerate((600, 750, 900)):
    add(pop(f), 36.0 + i * 0.2, 0.25)
add(whoosh(0.7, up=False), 37.7, 0.3)
add(pop(1100), 38.0, 0.2)
for k, n in enumerate((86, 83, 81, 78, 76, 74)):  # coin travels back, value shrinks
    add(chime(n, 0.6), 38.6 + k * 0.3, 0.1, pan=0.5 - k * 0.2)
add(chime(74, 1.2), 40.25, 0.2)
add(riser(1.0), 39.8, 0.35)
add(impact(), 40.8, 0.6)
for k, n in enumerate((78, 83, 86, 90)):
    add(chime(n, 1.6), 40.82 + k * 0.07, 0.1)
add(pop(600), 42.2, 0.2); add(pop(800), 43.0, 0.25)

# ---------------- 45–53 core ----------------
for i, n in enumerate((74, 78, 81)):
    add(pop(700 + i * 150), 45.15 + i * 0.7, 0.3)
    add(chime(n, 1.2), 45.2 + i * 0.7, 0.14)
add(whoosh(0.6), 47.25, 0.25)
add(impact() * 0.6, 48.2, 0.35); add(chime(86, 1.8), 48.2, 0.16)
add(pop(500), 49.3, 0.15)
add(riser(1.4), 51.6, 0.3)

# ---------------- 53–60 conclusion ----------------
add(impact(), 53.1, 0.5)
x = tt(0.5); add(np.sin(2 * np.pi * 110 * x) * np.exp(-x / 0.2), 53.8, 0.2)  # the "≠" slash
add(whoosh(1.2, up=False), 54.0, 0.15)
add(pop(900), 56.8, 0.3)
add(click(), 58.1, 0.6); add(chime(86, 1.2), 58.2, 0.2); add(chime(90, 1.2), 58.28, 0.14)
add(pad([59, 62, 66, 71, 74], 2.2, cut=2400), 58.0, 0.15)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.037, 0.12), (0.071, 0.09), (0.113, 0.06), (0.167, 0.04)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 4500) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 4500) * g
fade = np.ones(N); fi = int(0.05 * SR); fo = int(1.2 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/tvm-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/tvm-music.wav')
