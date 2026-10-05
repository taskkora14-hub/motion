"""Original ambient-cinematic score + water SFX for the ink-in-water spot (no voice-over).

    python3 ink/music.py   -> out/ink-music.wav

D major, one chord every 4 s: soft felt piano (additive model with inharmonic partials),
warm detuned pads, glassy chimes on every completed shape, an underwater bed with bubbles.
It grows into a full swell (low strings, soft cinematic booms, chime cascades) as the ink
becomes the butterfly and opens up when it flies into the dusk sky. A plung + low hit land on
sample 0 (no fade-in). Timings come from ink/timeline.js.
"""
import json
import os
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(21)
L = np.zeros(N)
R = np.zeros(N)

TLJ = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'timeline.js'), '--json']))
T = TLJ['T']


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
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


# ---------------- instruments ----------------
def piano(n, d=3.5, vel=0.7):
    x = tt(d); f = midi(n); s = np.zeros_like(x)
    B = 0.0004
    for k in range(1, 12):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 12000:
            break
        amp = (1 / k ** 1.3) * (0.6 + 0.4 * vel) * (vel if k > 4 else 1)
        s += amp * np.sin(2 * np.pi * fk * x) * np.exp(-x * (0.6 + 0.35 * k) * (1.4 if n > 72 else 1))
    hammer = filt(rng.standard_normal(len(x)), 'band', [800, 3000]) * np.exp(-x / 0.006) * 0.03
    s = filt(s + hammer, 'low', 3000 + 3000 * vel)          # felt: soft and round
    return s * np.minimum(1, x / 0.004) * np.clip((d - x) / 0.3, 0, 1)


def pad(notes, d, cut=1300, att=1.5):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.09, 0.0, 0.09):
            ph = (midi(n) * 2 ** (det / 12) * x + rng.uniform()) % 1
            s += (2 * ph - 1) * 0.6 + np.sin(2 * np.pi * midi(n) * x) * 0.4
    s = filt(s / (3 * len(notes)), 'low', cut)
    s *= 1 + 0.08 * np.sin(2 * np.pi * 0.25 * x)
    return s * np.clip(x / att, 0, 1) ** 1.5 * np.clip((d - x) / 1.5, 0, 1)


def strings(notes, d, att=2.0):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * x + rng.uniform(0, 6)))
        for det in (-0.06, 0.06):
            ph = np.cumsum(f * 2 ** (det / 12)) / SR
            s += 2 * (ph % 1) - 1
    s = filt(s / (2 * len(notes)), 'band', [120, 2600])
    return s * np.clip(x / att, 0, 1) ** 2 * np.clip((d - x) / 1.8, 0, 1)


def chime(n, d=3.0):
    x = tt(d); f = midi(n)
    mod = np.sin(2 * np.pi * f * 3.5 * x) * 2.2 * np.exp(-x / 0.6)
    s = np.sin(2 * np.pi * f * x + mod) * np.exp(-x / 1.1) + 0.3 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x / 0.4)
    return s * np.minimum(1, x / 0.002)


def boom():
    x = tt(2.2); f = 38 + 30 * np.exp(-x / 0.12)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.7)
    return s + filt(rng.standard_normal(len(x)), 'low', 300) * np.exp(-x / 0.25) * 0.4


def sub(n, d):
    x = tt(d)
    return np.sin(2 * np.pi * midi(n) * x) * np.clip(x / 1.0, 0, 1) * np.clip((d - x) / 1.2, 0, 1)


# ---------------- water SFX ----------------
def plung(big=1.0):
    d = 0.5; x = tt(d)
    f = (380 + 900 * (1 - np.exp(-x / 0.03))) / (0.8 + 0.2 * big)          # rising "bloop"
    bloop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.07) * np.minimum(1, x / 0.002)
    splash = filt(rng.standard_normal(len(x)), 'band', [1500, 9000]) * np.exp(-x / 0.05) * 0.35
    return bloop + splash * big


def hit():
    x = tt(1.6); f = 34 + 70 * np.exp(-x / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.45)


def bubble(f=900):
    x = tt(0.07)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 2.5 * x / 0.07)) / SR) * np.exp(-x / 0.02) * np.minimum(1, x / 0.003)


def swell(d=2.6, bright=1.0):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d
    out = filt(n, 'band', [200, 1200 + 2500 * bright]) * np.sin(np.pi * x) ** 2
    return out * 0.5


def splash_out():
    d = 0.9; x = tt(d)
    pour = filt(rng.standard_normal(len(x)), 'band', [800, 7000]) * np.exp(-x / 0.18) * 0.6
    drops = np.zeros_like(x)
    for k in range(10):
        i = int(rng.uniform(0.08, 0.7) * SR)
        b = bubble(rng.uniform(900, 2200)); drops[i:i + len(b)] += b[: len(x) - i] * rng.uniform(0.2, 0.5)
    return pour + drops


def flutter(d, hz):
    x = tt(d)
    env = np.abs(np.sin(np.pi * hz * x)) ** 4
    return filt(rng.standard_normal(len(x)), 'band', [300, 1800]) * env * 0.4


# ---------------- harmony ----------------
CH = {
    'Dmaj9': (38, [62, 66, 69, 73, 76]), 'Bm9': (35, [59, 62, 66, 69, 73]), 'Gmaj9': (31, [59, 62, 66, 69, 74]),
    'Asus2': (33, [57, 59, 64, 69, 71]), 'F#m7': (42, [61, 64, 69, 73]), 'Em9': (40, [59, 62, 66, 67, 71]),
}
PLAN = [(0, 'Dmaj9'), (4, 'Bm9'), (8, 'Gmaj9'), (12, 'Dmaj9'), (16, 'Asus2'), (20, 'Bm9'), (24, 'Em9'),
        (28, 'Asus2'), (30, 'Dmaj9'), (34, 'Gmaj9'), (37, 'Dmaj9')]
ends = [p[0] for p in PLAN[1:]] + [DUR]

for (t0, name), t1 in zip(PLAN, ends):
    root, notes = CH[name]
    d = t1 - t0
    grand = t0 >= 30
    add(pad(notes, d + 1.6, cut=1100 if not grand else 2200, att=1.2 if t0 > 0 else 0.4), max(0, t0 - 0.4), 0.16 if not grand else 0.2, pan=-0.1)
    add(sub(root, d + 0.5), t0, 0.22 if t0 >= 4 else 0.12)
    if t0 >= 24:
        add(strings([n + 12 for n in notes[1:4]], d + 1.2, att=1.5 if t0 < 30 else 0.8), t0 - 0.3, 0.07 if t0 < 30 else 0.12)
        add(strings([root + 12, root + 19], d + 1.2), t0 - 0.3, 0.06 if t0 < 30 else 0.11)
    # felt piano: broken chord, one note every 0.5 s (slow-motion feel), lighter during morph swirls
    step = 0.5 if not grand else 0.25
    k = 0; t = t0 + 0.05
    while t < t1 - 0.1:
        n = notes[[0, 2, 1, 3, 2, 4, 3, 1][k % 8] % len(notes)] + (12 if grand and k % 4 == 3 else 0)
        add(piano(n, 3.2, vel=0.45 + 0.15 * (k % 4 == 0) + (0.2 if grand else 0)), t, 0.16 if not grand else 0.13, pan=-0.3 + 0.6 * ((k % 5) / 4))
        t += step; k += 1

# a simple rising motif (the butterfly theme) — once in scene 2, full in the finale
MOTIF = [(0, 74), (0.5, 76), (1.0, 78), (2.0, 81), (3.0, 78), (3.5, 83), (4.5, 81)]
for off, n in MOTIF:
    add(piano(n, 3.0, vel=0.6), 12.6 + off * 1.0, 0.12, pan=0.2)
for off, n in MOTIF:
    add(piano(n + 12 if off > 2 else n, 3.5, vel=0.85), 30.1 + off * 0.75, 0.15, pan=0.15)
    add(chime(n + 12, 2.5), 30.1 + off * 0.75, 0.04, pan=-0.2)
add(piano(86, 4.0, vel=0.9), 37.0, 0.16); add(piano(90, 4.0, vel=0.8), 37.35, 0.12); add(piano(93, 3.5, vel=0.8), 37.7, 0.1)

# grand swell: booms + chime cascades
for t in (30.0, 32.0, 33.0, 34.5, 37.0):
    add(boom(), t, 0.4 if t != 30.0 else 0.5)
for k in range(24):
    add(chime([86, 88, 90, 93, 95, 98][k % 6], 2.0), 30.05 + k * 0.125, 0.025 + 0.02 * (k % 6 == 0), pan=-0.6 + (k % 7) * 0.2)
for k in range(16):
    add(chime([93, 95, 98, 100][k % 4], 2.5), 35.0 + k * 0.18, 0.03, pan=-0.5 + (k % 5) * 0.25)

# ---------------- SFX ----------------
add(hit(), 0.0, 0.55)                       # the hit on frame 0
add(plung(1.0), 0.0, 0.6)                   # the ink drop
for k in range(6):
    add(bubble(rng.uniform(700, 1500)), 0.15 + k * 0.09 + rng.uniform(0, 0.05), 0.12, pan=rng.uniform(-0.3, 0.3))
add(swell(3.6, 0.6), 0.2, 0.35)             # the bloom of ink
add(plung(0.6) * 0.8, T['AMBER'], 0.4, pan=0.2)
for a, b in TLJ['MORPHS']:
    add(swell(b - a + 0.6, 1.0), a - 0.3, 0.3, pan=rng.uniform(-0.3, 0.3))
for e in TLJ['EVENTS']:
    if e['type'] == 'chime':
        n = [81, 83, 85, 86][e['n']]
        add(chime(n, 3.0), e['t'], 0.08, pan=-0.2); add(chime(n + 7, 2.5), e['t'] + 0.12, 0.05, pan=0.3)
add(swell(2.0, 1.4), T['BFLY'] - 1.6, 0.35)
add(flutter(T['LIFT'] - T['BFLY'], 0.9 * 2), T['BFLY'], 0.12)
add(flutter(DUR - T['LIFT'], 1.6 * 2), T['LIFT'], 0.1)
add(splash_out(), 34.4, 0.45)
add(swell(2.4, 1.6), T['SKY'] - 0.6, 0.3)
# underwater bed + random bubbles until the sky, then a light air bed
bed = filt(rng.standard_normal(N), 'low', 500) * 0.08
air = filt(rng.standard_normal(N), 'band', [600, 4000]) * 0.03
k_air = np.clip((tt(DUR) - 35.0) / 2.0, 0, 1)
bedmix = bed * (1 - k_air) + air * k_air
L += bedmix; R += np.roll(bedmix, 300)
t = 0.8
while t < 35.5:
    add(bubble(rng.uniform(600, 1800)), t, rng.uniform(0.03, 0.08), pan=rng.uniform(-0.6, 0.6))
    t += rng.uniform(0.35, 1.3)

# ---------------- master: long hall ----------------
ir_t = tt(3.0)
ir = filt(rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.9), 'low', 6000)
ir *= 0.32 / np.sqrt((ir ** 2).sum())
mix = np.stack([L + fftconvolve(L, ir)[:N], R + fftconvolve(R, np.roll(ir, 53))[:N]], axis=1)
mix = np.stack([filt(mix[:, 0], 'high', 25), filt(mix[:, 1], 'high', 25)], axis=1)
fade = np.ones(N)
fi = int(0.001 * SR)                         # 1 ms de-click only: the hit lands on frame 0
fo = int(0.6 * SR)
fade[:fi] = np.linspace(0.6, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/ink-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/ink-music.wav', f'{N / SR:.2f}s')
