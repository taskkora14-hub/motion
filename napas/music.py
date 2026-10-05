"""Original ambient score + sound design for the box-breathing piece (no beat, ~60 BPM).

    python3 napas/music.py   -> out/napas-music.wav

Warm pad whose filter opens on the inhale and closes on the exhale, a soft piano on the
1-second grid, a small chime on every side of the breathing box, a gentle low "hit" on
sample 0, then a shimmer as the square turns into the logo. Times match napas/anim.js.
"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(60)
L = np.zeros(N)
R = np.zeros(N)
# reverb send
VL = np.zeros(N)
VR = np.zeros(N)

# timeline (napas/anim.js)
CYCLE0, PHASE = 4.0, 6.0
CYCLE1 = CYCLE0 + 4 * PHASE        # 28
BUBBLE, MESSAGE, LOGO = 28.4, 29.9, 35.0


def add(sig, t0, gain=1.0, pan=0.0, verb=0.35):
    i = int(round(t0 * SR))
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg, rg = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
    L[i:i + len(sig)] += sig * lg
    R[i:i + len(sig)] += sig * rg
    VL[i:i + len(sig)] += sig * lg * verb
    VR[i:i + len(sig)] += sig * rg * verb


def tt(d):
    return np.arange(int(d * SR)) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


# ---------------- voices ----------------
def piano(note, d=3.5, vel=1.0):
    x = tt(d); f0 = midi(note); s = np.zeros_like(x)
    B = 0.0004
    for k in range(1, 9):
        fk = f0 * k * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1 / k ** 1.3) * (0.6 + 0.4 * vel)
        dec = (1.6 + 2.0 * (60 / max(note, 30))) / (1 + 0.45 * (k - 1))
        s += amp * np.sin(2 * np.pi * fk * x + rng.uniform(0, 6)) * np.exp(-x / dec)
    s *= np.minimum(1, x / 0.004)
    hammer = filt(rng.standard_normal(len(x)), 'band', [800, 3000]) * np.exp(-x / 0.008) * 0.05
    s = s + hammer
    s *= np.clip((d - x) / 0.3, 0, 1)
    return filt(s, 'low', 2600 + 1800 * vel) * vel


def chime(note, d=3.0, g=1.0):
    x = tt(d); f0 = midi(note); s = np.zeros_like(x)
    for m, a, dec in ((1, 1.0, 1.4), (2.76, 0.35, 0.7), (5.40, 0.16, 0.35), (8.93, 0.07, 0.2)):
        s += a * np.sin(2 * np.pi * f0 * m * x) * np.exp(-x / dec)
    return s * np.minimum(1, x / 0.002) * g


def pad_layer(notes, d, bright):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f0 = midi(n)
        for det in (-0.09, 0.0, 0.09):
            ph = rng.uniform(0, 6)
            for k in range(1, 9):          # soft saw: few harmonics, 1/k
                if f0 * k > 5000:
                    break
                s += np.sin(2 * np.pi * f0 * (1 + det / 100) * k * x + ph * k) / (k ** (1.6 if not bright else 1.1))
    return s / (len(notes) * 3)


# ---------------- harmony: D major, 4 s per chord ----------------
CHORDS = [
    [50, 57, 61, 64, 66],   # Dmaj9 (D A C# E F#)
    [47, 54, 57, 61, 62],   # Bm9
    [43, 50, 54, 57, 59],   # Gmaj9 (G D F# A B)
    [45, 52, 57, 59, 62],   # Asus2/4
]
SEQ = [0, 1, 2, 3, 0, 1, 2, 3, 2, 0]   # 10 bars; last two: G -> D (logo resolves home)

# pad: dark + bright versions crossfaded by the breath (inhale opens, exhale closes)
dark = np.zeros(N); bright = np.zeros(N)
for bar, ci in enumerate(SEQ):
    t0 = bar * 4.0
    d = 5.5 if bar < 9 else 4.0
    x = tt(d)
    env = np.minimum(1, x / 1.2) * np.clip((d - x) / 1.6, 0, 1)
    if bar == 0:
        env = np.minimum(1, x / 0.05) * np.clip((d - x) / 1.6, 0, 1)   # present from the first frame
    if bar == 9:
        env = np.minimum(1, x / 1.0) * np.clip((d - x) / 2.0, 0, 1)
    notes = CHORDS[ci]
    for arr, br in ((dark, False), (bright, True)):
        s = pad_layer(notes, d, br) * env
        i = int(t0 * SR); s = s[: N - i]; arr[i:i + len(s)] += s
dark = filt(dark, 'low', 520, 4); bright = filt(bright, 'low', 2400, 2)

tg = np.arange(N) / SR
open_ = np.full(N, 0.35)
m = (tg >= CYCLE0) & (tg < CYCLE0 + PHASE); open_[m] = 0.35 + 0.65 * (1 - np.cos(np.pi * (tg[m] - CYCLE0) / PHASE)) / 2
m = (tg >= CYCLE0 + PHASE) & (tg < CYCLE0 + 2 * PHASE); open_[m] = 1.0
m = (tg >= CYCLE0 + 2 * PHASE) & (tg < CYCLE0 + 3 * PHASE); open_[m] = 1.0 - 0.8 * (1 - np.cos(np.pi * (tg[m] - CYCLE0 - 2 * PHASE) / PHASE)) / 2
m = (tg >= CYCLE0 + 3 * PHASE) & (tg < CYCLE1); open_[m] = 0.2
m = tg >= CYCLE1; open_[m] = np.clip(0.2 + (tg[m] - CYCLE1) / 3 * 0.4, 0, 0.6)
m = tg >= LOGO; open_[m] = np.clip(0.6 + (tg[m] - LOGO) / 1.5 * 0.4, 0, 1.0)
pad = dark * (1 - open_) * 1.0 + bright * open_ * 0.55
sw = 0.5 + 0.5 * open_                         # pad also swells with the breath
pad *= (0.75 + 0.25 * sw)
add(pad, 0.0, 0.55, verb=0.5)
# a slow stereo shimmer copy
add(np.roll(pad, int(0.013 * SR)) * 0.6, 0.0, 0.25, pan=0.7, verb=0.6)
add(np.roll(pad, int(0.021 * SR)) * 0.6, 0.0, 0.25, pan=-0.7, verb=0.6)

# ---------------- piano: sparse, on the 1 s grid ----------------
# (bar, beat, note, vel) — a quiet melody that leaves space
MEL = [
    (0, 0, 62, 0.55), (0, 0, 66, 0.4), (0, 2, 69, 0.42), (0, 3, 73, 0.35),
    (1, 0, 71, 0.45), (1, 2, 69, 0.38), (1, 3, 66, 0.32),
    (2, 0, 67, 0.42), (2, 1.5, 69, 0.34), (2, 3, 71, 0.36),
    (3, 0, 69, 0.42), (3, 2, 64, 0.34),
    (4, 0, 66, 0.42), (4, 2, 73, 0.36), (4, 3, 74, 0.3),
    (5, 0, 71, 0.38), (5, 2, 66, 0.32),
    (6, 0, 67, 0.36), (6, 2, 71, 0.32), (6, 3, 74, 0.3),
    (7, 0, 73, 0.4), (7, 2, 69, 0.34),
    (8, 0, 71, 0.38), (8, 1, 74, 0.32), (8, 2, 78, 0.3),
    (9, 0, 74, 0.45), (9, 0, 78, 0.38), (9, 1.5, 81, 0.3),
]
for bar, beat, n, v in MEL:
    add(piano(n, 4.0, v), bar * 4 + beat, 0.42, pan=(n - 68) / 30, verb=0.55)
# left hand: root + fifth on each bar (soft)
for bar, ci in enumerate(SEQ):
    r = CHORDS[ci][0]
    add(piano(r - 12 if r > 45 else r, 4.5, 0.4), bar * 4.0, 0.3, pan=-0.2, verb=0.5)
    add(piano(r - 5 if r > 45 else r + 7, 4.0, 0.3), bar * 4.0 + 1.0, 0.22, pan=-0.15, verb=0.5)

# ---------------- sound design ----------------
# hit at sample 0: soft low impact (sub thump + felt piano chord + air)
x = tt(2.5)
sub = np.sin(2 * np.pi * np.cumsum(42 + 60 * np.exp(-x / 0.05)) / SR) * np.exp(-x / 0.5)
air = filt(rng.standard_normal(len(x)), 'low', 900) * np.exp(-x / 0.25) * 0.25
add(sub + air, 0.0, 0.9, verb=0.25)
for n in (38, 50, 57):
    add(piano(n, 4.0, 0.75), 0.0, 0.45, verb=0.4)
# small chime on every side of the box (hook side at 0, then each phase), completion at 28
SIDE_NOTES = [(0.0, 86), (CYCLE0, 85), (CYCLE0 + PHASE, 88), (CYCLE0 + 2 * PHASE, 81), (CYCLE0 + 3 * PHASE, 83)]
for t0, n in SIDE_NOTES:
    add(chime(n, 3.5), t0, 0.16, pan=0.25, verb=0.7)
    add(chime(n + 7, 2.5), t0 + 0.02, 0.05, pan=-0.3, verb=0.7)
# completion: two chimes
add(chime(86, 4.0), CYCLE1, 0.16, pan=-0.2, verb=0.7)
add(chime(90, 4.0), CYCLE1 + 0.35, 0.13, pan=0.25, verb=0.7)
# mintask bubble: soft notification
add(chime(93, 1.8), BUBBLE + 0.1, 0.07, pan=0.1, verb=0.6)
add(chime(98, 1.8), BUBBLE + 0.24, 0.06, pan=0.1, verb=0.6)
add(piano(78, 2.5, 0.4), MESSAGE, 0.25, verb=0.6)
add(piano(81, 2.5, 0.35), MESSAGE + 0.25, 0.2, verb=0.6)
# logo: airy riser into a glowing chime chord
x = tt(1.6)
riser = filt(rng.standard_normal(len(x)), 'band', [1500, 7000]) * (x / 1.6) ** 2 * 0.08
add(riser, LOGO - 0.2, 1.0, verb=0.8)
for k, n in enumerate((74, 78, 81, 85, 86, 90)):
    add(chime(n, 4.0), LOGO + 0.4 + k * 0.11, 0.08, pan=(k - 2.5) * 0.15, verb=0.8)
add(chime(86, 4.5), LOGO + 1.0, 0.14, verb=0.8)
for n in (50, 62):
    add(piano(n, 5.0, 0.55), LOGO + 1.0, 0.32, verb=0.6)
add(piano(78, 3.0, 0.4), LOGO + 1.8, 0.22, verb=0.6)
add(piano(81, 3.0, 0.38), LOGO + 2.3, 0.2, verb=0.6)

# ---------------- reverb (exp-decay stereo IR) + master ----------------
ir_len = int(3.2 * SR); xi = np.arange(ir_len) / SR
irL = rng.standard_normal(ir_len) * np.exp(-xi / 0.9); irR = rng.standard_normal(ir_len) * np.exp(-xi / 0.9)
irL = filt(irL, 'low', 5000); irR = filt(irR, 'low', 5000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
wetL = fftconvolve(VL, irL)[:N]; wetR = fftconvolve(VR, irR)[:N]
mix = np.stack([L + wetL * 0.5, R + wetR * 0.5], axis=1)
mix = filt(mix.T, 'high', 30).T
fo = int(1.6 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5   # no fade-in: the hit is on sample 0
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/napas-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/napas-music.wav')
