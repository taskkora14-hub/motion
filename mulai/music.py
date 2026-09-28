"""Soundtrack for "Bingung mulai mengerjakan task dari mana?" (no voice-over).

    python3 mulai/music.py   -> out/mulai-music.wav

Fast, clean electronic groove (124 BPM): a filtered build under the hook, a tense pulse under
the tangled task, a drop when it untangles, then a full groove through the four steps with a
rising "check" chime on every ticked box. Times match mulai/anim.js.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
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


# ---------------- groove ----------------
BEAT = 60 / 124
PROG_MIN = [([57, 60, 64], 33), ([53, 57, 60], 29), ([48, 52, 55], 36), ([55, 59, 62], 31)]   # Am F C G
t = 0.0; b = 0
while t < DUR:
    notes, root = PROG_MIN[b % 4]
    for k in range(4):
        tk = t + k * BEAT
        if tk >= DUR:
            break
        full = 14.4 <= tk < 34.0 or 34.0 <= tk < 38.6
        tense = 5.0 <= tk < 12.2
        if full or tense:
            add(kick(), tk, 0.5 if full else 0.35)
        if full and k % 2 == 1:
            add(clap(), tk, 0.45)
        if full or tense or tk >= 2.5:
            add(hat(), tk + BEAT / 2, 0.8, pan=0.25)
        if full and k == 3:
            add(hat(True), tk + BEAT / 2, 0.6, pan=-0.2)
        # bass: eighths
        if full or tense:
            for e in range(2):
                add(subbass(root + (12 if e else 0) + 12, BEAT / 2 * 0.9), tk + e * BEAT / 2, 0.22 if full else 0.18)
        # stabs: off-beat chords, filter opening during the hook
        if tk < 5.0:
            cut = 500 + 2200 * (tk / 5.0)
        elif tense:
            cut = 1100
        else:
            cut = 2600 if tk < 38.6 else 900
        if tk < 39.2:
            add(stab([n + 12 for n in notes], cutoff=cut), tk + BEAT / 2, 0.16 if (full or tense) else 0.22, pan=0.15 * (1 if k % 2 else -1))
    t += 4 * BEAT; b += 1

# ---------------- SFX ----------------
for s in (0.2, 0.5, 0.8):                        # hook words slam
    add(impact() * 0.5, s, 0.55)
for i in range(6):                               # "?" chips appear
    add(pop(700 + i * 80), 1.3 + i * 0.1, 0.18, pan=-0.5 + i * 0.2)
for k in range(9):                               # pointer hovering between options
    add(click(2000 + (k % 3) * 300), 1.6 + k * 0.3, 0.15)
add(click(1600), 4.1, 0.3)
add(whoosh(0.5, up=False), 4.35, 0.45)
add(pop(500), 4.9, 0.35)                         # task card lands
for i in range(8):                               # sub-task chips pile on
    add(pop(900 + i * 60), 6.0 + i * 0.22, 0.16, pan=(-0.5 if i % 2 else 0.5))
scrib = filt(rng.standard_normal(int(3.3 * SR)), 'band', [2000, 6000]) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tt(3.3))) * 0.12
add(scrib, 5.3, 1.0)                             # knot drawing itself
add(riser(2.4), 9.9, 0.55)
add(impact(), 12.3, 0.55)                        # untangle drop
add(whoosh(0.9), 12.25, 0.4)
for i in range(4):
    add(click(1800 + i * 200), 13.3 + i * 0.1, 0.35)
add(whoosh(0.5), 14.0, 0.4)                      # list docks, panel pops in
for s in (18.25, 22.25, 26.25):                  # panel hand-offs
    add(whoosh(0.5), s, 0.4)
# step 1: highlighter strokes + takeaways
for k in range(3):
    add(marker(0.35), 14.8 + 0.5 + k * 0.45, 1.0)
    add(pop(1000 + k * 120), 14.8 + 0.85 + k * 0.45, 0.25)
# step 2: items land in tray
for k in range(5):
    add(whoosh(0.35), 18.6 + 0.4 + k * 0.4, 0.2, pan=-0.4 + k * 0.2)
    add(pop(600 + k * 90), 18.6 + 0.85 + k * 0.4, 0.3)
# step 3: typing bursts
for k in range(40):
    add(click(rng.uniform(2500, 3500)) * 0.7, 22.6 + 0.15 + k * 0.06, 0.25, pan=rng.uniform(-0.3, 0.3))
# step 4: review scan + fixes + toggle
add(riser(1.4) * 0.5, 27.5, 0.3)
for k in range(3):
    add(ding(88 + k * 2, 0.4), 27.6 + 0.9 + k * 0.5, 0.1)
add(click(1400), 26.6 + 2.45, 0.4)
# every checked box: rising chime
CHK = [14.5 + i * 4 + 3.2 for i in range(4)]
for i, s in enumerate(CHK):
    add(ding([76, 79, 83, 88][i]), s, 0.22)
    add(ding([88, 91, 95, 100][i], 0.6), s + 0.06, 0.07, pan=0.3)
# all done
add(whoosh(0.6), 30.35, 0.4)
sweep = np.sin(2 * np.pi * np.cumsum(400 * 2 ** (tt(0.8) / 0.8 * 1.5)) / SR) * np.sin(np.pi * tt(0.8) / 0.8) * 0.3
add(sweep, 31.2, 0.4)                            # progress ring filling
for k, n in enumerate([84, 88, 91, 96]):
    add(ding(n, 1.2), 32.0 + k * 0.05, 0.1)
spark = filt(rng.standard_normal(int(1.2 * SR)), 'high', 6000) * np.exp(-tt(1.2) / 0.3) * 0.25
add(spark, 32.0, 0.6)                            # confetti
add(whoosh(0.6), 33.7, 0.4)
# ending
for s in (34.1, 34.35, 34.75):
    add(impact() * 0.4, s, 0.3)
for i in range(4):
    add(pop(800 + i * 100), 35.4 + i * 0.12, 0.25)
add(ding(81, 1.6), 37.55, 0.16)
add(click(1800), 38.1, 0.3)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.029, 0.1), (0.053, 0.08), (0.083, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.03 * SR); fo = int(0.9 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/mulai-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/mulai-music.wav')
