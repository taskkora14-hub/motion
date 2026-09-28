"""Soundtrack for "Kenapa desain terlihat tidak profesional?" (no voice-over).

    python3 desain/music.py   -> out/desain-music.wav

Hook: detuned, wobbly stabs and glitchy ticks under the chaotic word "berantakan?". The groove
tightens up as the poster gets fixed: a clean 108 BPM house pulse through the four fixes, with a
flip / eyedropper / snap / grow sound for each fix and a rising chime for every ticked chip.
Ends on a calm sustained chord. Times match desain/anim.js.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(23)
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
BEAT = 60 / 108
PROG = [([65, 69, 72, 76], 41), ([57, 60, 64, 67], 33), ([62, 65, 69, 72], 38), ([60, 64, 67, 71], 36)]   # Fmaj7 Am7 Dm7 Cmaj7
REVEAL, CAUSES, RESULT, END = 4.3, [9.6, 15.2, 20.8, 26.4], 32.0, 35.8
t = 0.0; b = 0
while t < END:
    notes, root = PROG[b % 4]
    for k in range(4):
        tk = t + k * BEAT
        if tk >= END:
            break
        hook = tk < REVEAL
        build = REVEAL <= tk < CAUSES[0]
        full = tk >= CAUSES[0]
        # hook: messy, detuned off-beat stabs that drift
        if hook:
            wob = [n + rng.choice([-1, 0, 0, 1]) * 0.35 for n in notes[:3]]
            add(stab([n + 12 for n in wob], cutoff=1500), tk + BEAT / 2 + rng.uniform(-0.03, 0.03), 0.16, pan=rng.uniform(-0.6, 0.6))
            continue
        if build or full:
            add(kick(), tk, 0.5 if full else 0.34)
        if full and k % 2 == 1:
            add(clap(), tk, 0.36)
        add(hat(), tk + BEAT / 2, 0.7 if full else 0.45, pan=0.25)
        if full:
            add(hat(), tk + BEAT / 4, 0.3, pan=-0.25)
            add(hat(), tk + 3 * BEAT / 4, 0.3, pan=-0.25)
        # bass
        if full:
            for e in range(2):
                add(subbass(root + 12 + (7 if e and k == 3 else 0), BEAT / 2 * 0.85), tk + e * BEAT / 2, 0.22)
        elif build:
            add(subbass(root + 12, BEAT * 0.9), tk, 0.16)
        # clean stabs
        cut = 1200 + 1600 * np.clip((tk - REVEAL) / 5.3, 0, 1) if build else 2800
        add(stab([n + 12 for n in notes], cutoff=cut), tk + BEAT / 2, 0.13, pan=0.15 * (1 if k % 2 else -1))
    t += 4 * BEAT; b += 1
# pads: hook wobbly, rest clean
add(pad([53, 60, 64, 69], 4.6, cutoff=900, detune=0.9), 0.0, 0.3)
add(pad([53, 57, 60, 64], 5.5, cutoff=1300), 4.2, 0.2)
# ending: breakdown + held chord
add(pad([53, 60, 64, 67, 72], 4.4, cutoff=2200), END - 0.1, 0.34)
for k, n in enumerate([65, 69, 72, 76, 81]):
    add(ding(n, 2.8), 38.35 + k * 0.06, 0.08)
add(subbass(41, 3.6), END + 0.4, 0.2)

# ---------------- SFX ----------------
add(impact() * 0.55, 0.15, 0.5); add(impact() * 0.45, 0.5, 0.45)
add(whoosh(0.4), 0.85, 0.3)                                  # underline
for i in range(4):
    add(pop(900 + i * 70), 1.35 + i * 0.06, 0.14)
for k in range(int((3.85 - 1.9) / 0.13)):                    # letters re-rolling
    add(glitch(), 1.9 + k * 0.13, 0.4, pan=rng.uniform(-0.5, 0.5))
for k in range(5):
    add(buzz(0.12), 2.35 + k * 0.1, 0.25, pan=-0.6 + k * 0.3)
add(whoosh(0.5), 3.85, 0.45)
# reveal
add(whoosh(0.7, up=False), REVEAL, 0.5)
for i in range(15):
    add(pop(500 + (i * 97) % 900), 4.85 + i * 0.1, 0.2, pan=rng.uniform(-0.6, 0.6))
for s in (4.85, 6.7, 8.1):
    add(click(1800), s, 0.3)
for k in range(5):
    add(buzz(), 6.8 + k * 0.12, 0.3, pan=-0.5 + k * 0.25)
add(riser(1.2) * 0.6, 8.3, 0.35)
for i in range(4):
    add(pop(700 + i * 120), 8.3 + i * 0.12, 0.3)
# each cause: problem hit → strike → solution → morph → check
CHK = [76, 79, 83, 88]
for i, b in enumerate(CAUSES):
    add(pop(620), b, 0.3); add(impact() * 0.35, b + 0.08, 0.35)
    add(marker(0.35), b + 2.0, 1.2)                          # strike-through
    add(whoosh(0.4), b + 2.45, 0.3)
    add(ding(84, 0.5), b + 2.6, 0.08); add(pop(1000), b + 2.6, 0.25)
    add(riser(1.4) * 0.5, b + 2.8, 0.22)
    add(ding(CHK[i]), b + 4.3, 0.22); add(ding(CHK[i] + 12, 0.6), b + 4.36, 0.07, pan=0.3)
    add(whoosh(0.5), b + 5.2, 0.35)
b = CAUSES[0]                                                # fonts
for i in range(5):
    add(pop(800 + i * 90), b + 0.35 + i * 0.12, 0.2); add(pop(600 + i * 60), b + 0.6 + i * 0.1, 0.2)
for i in range(3):
    add(click(1300), b + 2.3 + (i + 1) * 0.05, 0.3)
add(whoosh(0.5, up=False), b + 2.85, 0.35)
for i in range(6):
    add(flip(), b + 2.8 + 1.5 * (0.275 + 0.09 * i), 0.5, pan=-0.4 + i * 0.16)
b = CAUSES[1]                                                # colours
for i in range(9):
    add(pop(500 + i * 110), b + 1.0 + i * 0.1, 0.25, pan=-0.6 + i * 0.15)
sweep = np.sin(2 * np.pi * np.cumsum(900 * 2 ** (-tt(0.85) / 0.85)) / SR) * np.sin(np.pi * tt(0.85) / 0.85) * 0.25
add(sweep, b + 2.85, 0.5)
for k in range(3):
    add(pop(900 + k * 200), b + 3.65 + k * 0.08, 0.3)
b = CAUSES[2]                                                # alignment
for i in range(5):
    add(click(1500 + i * 150), b + 0.45 + i * 0.1, 0.25)
add(whoosh(0.4), b + 2.55, 0.3)
for i in range(5):
    add(snap(), b + 2.8 + 1.5 * (0.55 + 0.1125 * i), 0.45, pan=-0.3 + i * 0.15)
add(snap(), b + 3.25, 0.4)
b = CAUSES[3]                                                # hierarchy
for i in range(5):
    add(pop(700 + i * 80), b + 0.45 + i * 0.1, 0.22)
grow = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (tt(1.3) / 1.3 * 1.6)) / SR) * np.sin(np.pi * tt(1.3) / 1.3) * 0.28
add(grow, b + 2.85, 0.45)
for n in range(3):
    add(pop(900 + n * 150), b + 4.15 + n * 0.15, 0.3)
# result
for i in range(4):
    add(pop(800 + i * 100), RESULT + 0.6 + i * 0.1, 0.25)
add(whoosh(0.8), RESULT + 0.5, 0.35); add(whoosh(0.6, up=False), RESULT + 1.6, 0.3); add(whoosh(0.5), RESULT + 2.9, 0.3)
add(pop(700), RESULT + 2.0, 0.3); add(pop(900), RESULT + 2.08, 0.3)
spark = filt(rng.standard_normal(int(1.0 * SR)), 'high', 6000) * np.exp(-tt(1.0) / 0.25) * 0.25
add(spark, RESULT + 3.35, 0.6)
for k, n in enumerate([84, 88, 91]):
    add(ding(n, 1.0), RESULT + 3.5 + k * 0.05, 0.1)
# ending
add(whoosh(0.6, up=False), END, 0.4)
add(impact() * 0.4, END + 0.4, 0.3)
add(click(1500), END + 0.95, 0.25)
for k in range(6):
    add(glitch(), END + 1.25 + k * 0.13, 0.3, pan=rng.uniform(-0.4, 0.4))
add(marker(0.35), END + 1.8, 1.2)
add(click(1500), END + 2.15, 0.25)
add(impact() * 0.35, END + 2.55, 0.3)
add(marker(0.4), END + 2.95, 0.7)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.031, 0.1), (0.057, 0.08), (0.089, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.03 * SR); fo = int(0.9 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/desain-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/desain-music.wav')
