"""Cinematic score + sound design for "Kenapa Kita Sering Menunda Tugas?" (no voice-over).

    python3 menunda/music.py   -> out/menunda-music.wav

Tension (minor, heartbeat, stamps) for the hook and the three causes, then a lift to a
major-key pulse when the task breaks into small steps. Times match menunda/anim.js.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(21)
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


def adsr(d, a, r):
    x = tt(d)
    return np.minimum(1, x / a) * np.clip((d - x) / r, 0, 1)


# ---------------- voices ----------------
def pad(notes, d, bright=1800, a=1.2, r=1.2):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n)
        for det in (-0.15, 0.0, 0.15):
            ph = rng.uniform(0, 6)
            s += np.sin(2 * np.pi * f * (1 + det / 100) * x + ph) + 0.25 * np.sin(4 * np.pi * f * (1 + det / 100) * x + ph)
    s = filt(s, 'low', bright)
    return s / (len(notes) * 3) * adsr(d, a, r)


def piano(n, d=2.2, g=1.0):
    x = tt(d); f = midi(n)
    s = sum(a * np.sin(2 * np.pi * f * k * x) * np.exp(-x * (1.2 + k * 0.9)) for k, a in ((1, 1), (2, 0.45), (3, 0.18), (4, 0.08)))
    return s * np.minimum(1, x / 0.004) * g


def pluck(n, d=0.5):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x)
    return s * np.exp(-x / 0.16) * np.minimum(1, x / 0.003)


def sub_hit(d=1.8, f0=55):
    x = tt(d); f = f0 * 0.7 + f0 * 1.2 * np.exp(-x / 0.08)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.55)


def heartbeat():
    def thump(f0, dd):
        x = tt(dd); f = f0 + 40 * np.exp(-x / 0.03)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.07)
    s = np.zeros(int(0.5 * SR)); a = thump(60, 0.3); b = thump(52, 0.3)
    s[:len(a)] += a; i = int(0.16 * SR); s[i:i + len(b)] += b * 0.7
    return s


def whoosh(d=0.8, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(10):
        c = (k + 0.5) / 10; f = 250 * (24 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 10, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.7


def riser(d=2.0):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(14):
        c = (k + 0.5) / 14; f = 200 * (40 ** c)
        out += filt(n, 'band', [f * 0.8, min(f * 1.3, 18000)]) * np.clip(1 - np.abs(x - c) * 14, 0, 1)
    return out * x ** 2 * 0.5


def tick():
    return filt(rng.standard_normal(int(0.03 * SR)), 'high', 3000) * np.exp(-tt(0.03) / 0.004) * 0.6


def stamp():
    d = 0.6; x = tt(d)
    body = sub_hit(d, 70) * 0.8
    crack = filt(rng.standard_normal(len(x)), 'band', [800, 5000]) * np.exp(-x / 0.03)
    return body + crack * 0.6


def scribble(d):
    n = rng.standard_normal(int(d * SR)); x = tt(d)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 11 * x) ** 2
    return filt(n, 'band', [2500, 7000]) * am * adsr(d, 0.05, 0.08) * 0.25


def crack():
    d = 0.5; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 1200) * np.exp(-x / 0.06) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 37 * x)))


def chime(n, d=1.4):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 4)) * np.exp(-x / 0.5) * np.minimum(1, x / 0.002)


def kick():
    x = tt(0.3); f = 48 + 70 * np.exp(-x / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.11)


def shaker():
    return filt(rng.standard_normal(int(0.08 * SR)), 'high', 6000) * np.exp(-tt(0.08) / 0.02) * 0.3


# ---------------- 0–4.6 hook ----------------
add(pad([45, 52, 57, 59, 64], 5.2, bright=1200, a=0.8), 0.0, 0.5)           # Am(add9) bed
for k, n in enumerate([69, 72, 76]):
    add(piano(n, 2.5), 0.35 + k * 0.12, 0.10, pan=(k - 1) * 0.3)
add(sub_hit(), 0.9, 0.55)                                                    # "kamu malas."
add(piano(81, 2.0), 0.95, 0.08)
add(scribble(0.4), 2.0, 1.2, pan=0.2)                                        # strike-through
add(piano(64, 2.0), 2.7, 0.08)
add(whoosh(0.9), 3.75, 0.6)                                                  # push-in

# ---------------- 4.6–11 the big task ----------------
add(pad([38, 45, 50, 53, 57], 6.8, bright=900, a=1.5), 4.4, 0.6)           # Dm, dark
rum = filt(rng.standard_normal(int(1.6 * SR)), 'low', 120) * adsr(1.6, 0.6, 0.6)
add(rum, 4.8, 0.9)                                                           # block rising
add(sub_hit(2.2, 45), 6.05, 0.75)                                            # block lands
add(piano(62, 2.2), 6.5, 0.08); add(piano(65, 2.2), 6.9, 0.07)
add(stamp(), 6.9, 0.25, pan=0.4)                                             # deadline tag
for k in range(8):
    add(tick(), 7.5 + k * 0.4, 0.5, pan=0.5)                                 # clock ticking
add(riser(1.0), 9.8, 0.4)
add(whoosh(0.9), 10.25, 0.6)                                                 # zoom into block

# ---------------- 11–26 causes ----------------
add(pad([45, 52, 57, 60, 64], 5.2, bright=1100), 10.9, 0.45)                # cause 1: Am
# heartbeat synced to the ECG in anim.js: rate = lerp(1.1, 2.4, lt/4.5)
lt = 0.0; prev = 0.0
while lt < 4.9:
    rate = 1.1 + (2.4 - 1.1) * min(1, lt / 4.5)
    ph = lt * rate
    if int(ph) != int(prev) or lt == 0.0:
        add(heartbeat(), 11.0 + lt, 0.75)
    prev = ph; lt += 0.005
add(whoosh(0.7), 15.65, 0.55)

add(pad([41, 48, 53, 57, 60], 5.2, bright=1300), 15.9, 0.65)                 # cause 2: F, unresolved
for i in range(8):                                                           # "?" pops — scattered notes
    n = [76, 71, 79, 74, 81, 72, 77, 69][i]
    add(pluck(n), 16.35 + 1.2 + i * 0.18, 0.24, pan=(-0.6 if i % 2 else 0.6))
for k in range(12):
    add(tick(), 16.5 + k * 0.35, 0.35, pan=-0.5 + (k % 2))
add(whoosh(0.7), 20.65, 0.55)

add(pad([40, 47, 52, 55, 59], 5.4, bright=1000), 20.9, 0.45)                # cause 3: Em
for w0, w1, x0 in ((0.3, 1.5, 1.7), (2.5, 3.3, 3.5)):
    add(scribble(w1 - w0), 21.35 + w0, 0.9, pan=0.3)
    add(stamp(), 21.35 + x0, 0.6)
    add(piano(52, 1.5), 21.35 + x0, 0.1)
add(whoosh(0.8), 25.7, 0.6)
add(riser(1.6), 24.4, 0.45)

# ---------------- 26–34 solution (100 BPM, major) ----------------
BEAT = 0.6
add(sub_hit(1.6, 50), 26.45, 0.55)                                          # block drops
add(crack(), 26.9, 0.45, pan=-0.2)
add(crack(), 27.15, 0.35, pan=0.2)
shat = filt(rng.standard_normal(int(0.8 * SR)), 'high', 2000) * np.exp(-tt(0.8) / 0.18)
add(shat, 27.5, 0.35)
add(whoosh(0.7), 27.95, 0.4)
prog = [([48, 55, 60, 64], 36), ([43, 55, 59, 62], 31), ([45, 57, 60, 64], 33), ([41, 53, 57, 60], 29)]
for b in range(4):                                                           # C G Am F, one bar (2.4 s) each
    t0 = 28.0 + b * 4 * BEAT
    notes, root = prog[b]
    add(pad([n + 12 for n in notes], 4 * BEAT + 0.8, bright=2600, a=0.3, r=0.6), t0, 0.35)
    for k in range(8):
        add(pluck(notes[(k * 3) % 4] + 24), t0 + k * BEAT / 2, 0.08, pan=(0.3 if k % 2 else -0.3))
    for k in range(4):
        add(kick(), t0 + k * BEAT, 0.35)
        add(shaker(), t0 + k * BEAT + BEAT / 2, 0.8, pan=0.25)
        add(piano(root + 12, 0.8), t0 + k * BEAT, 0.1)
HOP0, HOPD = 29.35, 0.72
for i, n in enumerate([72, 74, 76, 79, 84]):                                # rising step chimes
    add(chime(n), HOP0 + i * HOPD + 0.45, 0.16, pan=-0.4 + i * 0.2)
for k, n in enumerate([84, 88, 91, 96]):
    add(chime(n, 1.2), HOP0 + 4 * HOPD + 0.55 + k * 0.06, 0.07)
add(whoosh(0.9), 33.3, 0.55)

# ---------------- 34–40 ending ----------------
add(pad([48, 55, 60, 64, 67, 71], 6.2, bright=2200, a=0.8, r=2.5), 33.9, 0.6)   # Cmaj7
add(piano(72, 3.0), 34.35, 0.1); add(piano(76, 3.0), 34.7, 0.1)
add(piano(79, 3.0), 36.0, 0.09); add(piano(84, 3.5), 36.3, 0.1)
add(pluck(72), 38.0, 0.12)                                                   # hop
add(chime(88, 2.0), 38.3, 0.2)                                               # check
add(chime(95, 2.0), 38.4, 0.08, pan=0.3)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
# short stereo "room" for a cinematic tail
for dly, g in ((0.043, 0.18), (0.071, 0.14), (0.113, 0.10), (0.167, 0.07)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 4000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 4000) * g
fade = np.ones(N); fi = int(0.2 * SR); fo = int(1.2 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/menunda-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/menunda-music.wav')
