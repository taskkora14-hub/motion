"""Soundtrack for "Kenapa Tugas Terlihat Susah Padahal Sebenarnya Nggak?" (no voice-over).

    python3 ringan/music.py   -> out/ringan-music.wav

120 BPM, cinematic: a pulse that speeds up and a riser while the pages multiply, a hit + near
silence on "Bukan selalu karena tugasnya susah.", a dark minor groove through the three causes,
then a bright major groove for the five steps (one chime per check, on the beat) and a soft outro.
Times match ringan/anim.js.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(41)
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


def saw(f, x):
    return 2 * ((f * x) % 1) - 1


# ---------------- voices ----------------
def stab(notes, d=0.22, cutoff=2400):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.08, 0.08):
            s += saw(midi(n) * (1 + det / 100), x)
    s = filt(s / (2 * len(notes)), 'low', cutoff)
    return s * np.exp(-x / 0.09) * np.minimum(1, x / 0.003)


def subbass(n, d):
    x = tt(d)
    return np.sin(2 * np.pi * midi(n) * x) * np.minimum(1, x / 0.005) * np.clip((d - x) / 0.03, 0, 1)


def kick():
    x = tt(0.28); f = 45 + 95 * np.exp(-x / 0.028)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.1)


def clap():
    d = 0.2; n = rng.standard_normal(int(d * SR)); e = np.exp(-tt(d) / 0.05)
    for k in (0.0, 0.01, 0.02):
        i = int(k * SR); e[i:i + 150] += 0.7
    return filt(n, 'band', [1000, 4500]) * e * 0.5


def hat(open_=False):
    d = 0.16 if open_ else 0.045
    return filt(rng.standard_normal(int(d * SR)), 'high', 8000) * np.exp(-tt(d) / (0.045 if open_ else 0.012)) * 0.35


def whoosh(d=0.45, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 350 * (22 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.6


def riser(d):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(14):
        c = (k + 0.5) / 14; f = 200 * (45 ** c)
        out += filt(n, 'band', [f * 0.8, min(f * 1.3, 18000)]) * np.clip(1 - np.abs(x - c) * 14, 0, 1)
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (x * 2)) / SR) * 0.15
    return (out * 0.5 + tone) * x ** 2


def click(f=2400):
    x = tt(0.025)
    return np.sin(2 * np.pi * f * x) * np.exp(-x / 0.004)


def pop(f=800):
    x = tt(0.08); ff = f * (1 + 0.8 * np.exp(-x / 0.008))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.022)


def ding(n, d=1.0):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2 * x) * np.exp(-x * 5)) * np.exp(-x / 0.35) * np.minimum(1, x / 0.002)


def impact():
    x = tt(1.2); f = 40 + 70 * np.exp(-x / 0.06)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.4) + filt(rng.standard_normal(len(x)), 'low', 900) * np.exp(-x / 0.08) * 0.4


def marker(d):
    n = rng.standard_normal(int(d * SR))
    return filt(n, 'band', [1500, 5000]) * 0.18 * np.minimum(1, tt(d) / 0.02) * np.clip((d - tt(d)) / 0.03, 0, 1)


def pad(notes, d, cutoff=1800, detune=0.12):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-detune, 0, detune):
            s += saw(midi(n) * (1 + det / 100), x + rng.uniform(0, 1))
    s = filt(s / (3 * len(notes)), 'low', cutoff)
    return s * np.minimum(1, x / 0.4) * np.clip((d - x) / 0.8, 0, 1)


def glitch():
    d = 0.05; x = tt(d)
    return np.sign(np.sin(2 * np.pi * rng.uniform(300, 1400) * x)) * np.exp(-x / 0.012) * 0.3


def snap():
    s = pop(1500) * 0.6; c = click(3200); s[:len(c)] += c * 0.8
    return s


def flip():
    d = 0.09; x = tt(d)
    s = filt(rng.standard_normal(len(x)), 'band', [1800, 7000]) * np.exp(-x / 0.02) * 0.8
    c = click(2600); s[:len(c)] += c * 0.5
    return s


def buzz(d=0.18):
    x = tt(d)
    return np.sign(np.sin(2 * np.pi * 180 * x)) * 0.25 * np.exp(-x / 0.08) * np.minimum(1, x / 0.004)


# ---------------- music ----------------
BEAT = 0.5
MINOR = [([57, 60, 64], 33), ([53, 57, 60], 29), ([55, 59, 62], 31), ([52, 55, 59], 28)]      # Am F G Em
MAJOR = [([60, 64, 67, 71], 36), ([57, 60, 64, 67], 33), ([53, 57, 60, 64], 29), ([55, 59, 62, 65], 31)]  # Cmaj7 Am7 Fmaj7 G7
HIT, CAUSE, STEPS, S0, SD, END = 5.0, 9.0, 24.0, 25.0, 1.5, 33.5

# hook: ticking pulse that accelerates + heartbeat kick
t = 0.25
while t < 4.8:
    add(click(2200) * 0.6, t, 0.25, pan=0.2)
    t += 0.5 - 0.3 * min(1, t / 4.8) ** 1.5
for k in range(8):
    add(kick() * 0.8, 1.0 + k * 0.5, 0.35); add(kick() * 0.5, 1.0 + k * 0.5 + 0.18, 0.25)
add(pad([45, 52, 57, 60], 5.0, cutoff=700, detune=0.3), 0.0, 0.3)
add(riser(2.8), 2.0, 0.55)
# split: hit then a floating pad
add(impact(), HIT, 0.7)
add(pad([48, 55, 60, 64, 67], 4.3, cutoff=1500), HIT, 0.3)
for k, n in enumerate([72, 76, 79, 84, 88]):                 # pieces separating
    add(ding(n, 0.8), 6.9 + k * 0.12, 0.08, pan=-0.5 + k * 0.25)

t = CAUSE; b = 0                                               # causes: minor groove
while t < STEPS:
    notes, root = MINOR[b % 4]
    for k in range(4):
        tk = t + k * BEAT
        add(kick(), tk, 0.45)
        if k % 2: add(clap(), tk, 0.3)
        add(hat(), tk + 0.25, 0.5, pan=0.25)
        add(subbass(root + 12, 0.22), tk, 0.2); add(subbass(root + 12, 0.2), tk + 0.25, 0.14)
        add(stab([n + 12 for n in notes], cutoff=1400), tk + 0.25, 0.1, pan=0.15 * (1 if k % 2 else -1))
    t += 4 * BEAT; b += 1
t = STEPS; b = 0                                               # steps: bright major groove
while t < END:
    notes, root = MAJOR[b % 4]
    for k in range(4):
        tk = t + k * BEAT
        full = tk >= S0
        add(kick(), tk, 0.5 if full else 0.3)
        if full and k % 2: add(clap(), tk, 0.34)
        add(hat(), tk + 0.25, 0.7, pan=0.25)
        if full: add(hat(), tk + 0.125, 0.25, pan=-0.3); add(hat(), tk + 0.375, 0.25, pan=-0.3)
        add(subbass(root + 12, 0.22), tk, 0.22); add(subbass(root + 24, 0.2), tk + 0.25, 0.14)
        add(stab([n + 12 for n in notes], cutoff=3000), tk + 0.25, 0.12, pan=0.2 * (1 if k % 2 else -1))
    t += 4 * BEAT; b += 1
add(pad([48, 55, 64, 67, 72], 6.8, cutoff=2400), END - 0.3, 0.32)   # outro
for k, n in enumerate([72, 76, 79, 84]):
    add(ding(n, 2.5), 37.35 + k * 0.08, 0.08)
add(subbass(36, 4.0), END, 0.18)

# ---------------- SFX ----------------
add(pop(600), 0.1, 0.35)
for s in (0.15, 0.55, 2.0, 2.35):
    add(whoosh(0.35), s, 0.25)
for k in range(100):                                           # pages landing
    ta = 1.9 + 2.3 * np.sqrt(k / 99)
    if k % 2 == 0: add(filt(rng.standard_normal(int(0.06 * SR)), 'band', [1500, 6000]) * np.exp(-tt(0.06) / 0.015), ta + 0.2, 0.18, pan=rng.uniform(-0.7, 0.7))
add(pop(500), 2.9, 0.4); add(buzz(0.25), 3.0, 0.2)             # crying face
add(whoosh(0.3, up=False), 4.8, 0.5)                           # implode
add(whoosh(0.5), 5.35, 0.3); add(whoosh(0.5), 5.7, 0.3)
add(whoosh(0.8, up=False), 8.7, 0.35)
for i, b in enumerate([9.0, 14.0, 19.0]):
    add(whoosh(0.5), b - 0.25, 0.45); add(pop(700), b + 0.1, 0.35); add(impact() * 0.3, b + 0.2, 0.3)
    add(whoosh(0.5, up=False), b + 4.75, 0.3)
b = 9.0
for k in range(15): add(pop(600 + k * 45), b + 0.35 + k * 0.05, 0.13, pan=-0.5 + (k % 3) * 0.5)
for k in range(15): add(buzz(0.06), b + 1.2 + 1.5 * np.sqrt(((k * 7) % 15) / 15), 0.18, pan=rng.uniform(-0.6, 0.6))
add(buzz(0.5), b + 2.8, 0.4)
b = 14.0
add(pop(500), b + 0.2, 0.35)
for k in range(8): add(pop(800 + k * 60), b + 0.4 + k * 0.06, 0.14)
for k in range(28): add(click(3000 + (k % 4) * 300) * 0.6, b + 0.6 + k * 0.15, 0.18)   # compass ticking
b = 19.0
add(riser(3.0) * 0.6, b + 0.7, 0.35)
add(pop(900), b + 2.0, 0.25)
# steps
add(pop(400), STEPS + 0.1, 0.4)
for i in range(5): add(pop(700 + i * 90), STEPS + 0.3 + i * 0.08, 0.2)
add(whoosh(0.6), STEPS + 0.6, 0.45)
for i in range(4): add(click(1400), STEPS + 0.9 + i * 0.05, 0.3)
CHK = [72, 74, 76, 79, 84]
for i in range(5):
    s = S0 + i * SD
    add(whoosh(0.35), s, 0.3); add(pop(900), s + 0.1, 0.2)
    add(pop(1200), s + 1.0, 0.4)
    add(ding(CHK[i] + 12), s + 1.0, 0.2); add(ding(CHK[i] + 24, 0.5), s + 1.05, 0.06, pan=0.3)
    spark = filt(rng.standard_normal(int(0.5 * SR)), 'high', 6000) * np.exp(-tt(0.5) / 0.12) * 0.25
    add(spark, s + 1.0, 0.4)
for k, n in enumerate([84, 88, 91, 96]): add(ding(n, 1.2), S0 + SD * 5 + k * 0.05, 0.1)
# ending
add(whoosh(0.7), END, 0.4)
for s in (END + 0.25, END + 0.5, END + 0.95, END + 1.25, 36.55, 36.8, 37.35, 37.6):
    add(whoosh(0.3), s, 0.18)
add(impact() * 0.35, 37.35, 0.3)
add(pop(800), 38.2, 0.35); add(ding(84, 1.0), 38.6, 0.18)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.031, 0.1), (0.057, 0.08), (0.089, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.03 * SR); fo = int(1.0 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/ringan-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/ringan-music.wav')
