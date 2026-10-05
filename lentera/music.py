"""Original piano + strings score and ambience for "5 hal yang boleh kamu lepas hari ini."

    python3 lentera/music.py   -> out/lentera-music.wav

70 BPM, emotional but calm: soft arpeggiated piano with a sparse melody over a string
ensemble that grows warmer (louder, brighter, more voices) towards the end, resolving on a
major chord over the lantern-filled sky. Ambience: wind, gentle water lapping, paper rustles
when each lantern is written on and released, a soft chime + low hit on sample 0.
Times come from lentera/timeline.js.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.loads(subprocess.check_output(['node', '-e', """
const T = require('./lentera/timeline.js');
process.stdout.write(JSON.stringify({ HOOK: T.HOOK, lanterns: T.lanterns, END: T.END }));"""], cwd=ROOT))

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(70)
L = np.zeros(N); R = np.zeros(N)
VL = np.zeros(N); VR = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0, verb=0.4):
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    lg, rg = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
    L[i:i + len(sig)] += sig * lg; R[i:i + len(sig)] += sig * rg
    VL[i:i + len(sig)] += sig * lg * verb; VR[i:i + len(sig)] += sig * rg * verb


def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def warmth(t):
    """0 → 1 across the piece; drives string level/brightness."""
    return float(np.clip((t - 2) / 34, 0, 1)) ** 0.9


# ---------------- instruments ----------------
def piano(note, d=3.0, vel=0.6):
    x = tt(d); f0 = midi(note); s = np.zeros_like(x)
    for k in range(1, 9):
        fk = f0 * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 8000:
            break
        dec = (1.4 + 1.8 * (60 / max(note, 30))) / (1 + 0.5 * (k - 1))
        s += (1 / k ** 1.4) * np.sin(2 * np.pi * fk * x + rng.uniform(0, 6)) * np.exp(-x / dec)
    s *= np.minimum(1, x / 0.005) * np.clip((d - x) / 0.4, 0, 1)
    s += filt(rng.standard_normal(len(x)), 'band', [700, 2500]) * np.exp(-x / 0.006) * 0.03
    return filt(s, 'low', 1800 + 2600 * vel) * vel


def strings(notes, d, t0, level=1.0):
    w = warmth(t0)
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.14, 0.0, 0.14):
            f = midi(n) * (1 + det / 100) * (1 + 0.004 * np.sin(2 * np.pi * (5 + rng.uniform(-0.4, 0.4)) * x + rng.uniform(0, 6)))
            ph = np.cumsum(f) / SR
            for k in range(1, 10):
                if midi(n) * k > 6000:
                    break
                s += np.sin(2 * np.pi * k * ph) / k
    env = np.minimum(1, x / 1.1) * np.clip((d - x) / 1.2, 0, 1)
    s = filt(s * env, 'low', 1200 + 3000 * w) / (len(notes) * 3)
    return s * level


# ---------------- harmony (bar = 4 beats at 70 BPM) ----------------
BEAT = 60 / 70
BAR = 4 * BEAT
CH = {
    'Am': (45, [57, 60, 64]), 'F': (41, [57, 60, 65]), 'C': (36, [55, 60, 64]), 'G': (43, [55, 59, 62]),
    'Em': (40, [55, 59, 64]), 'Fmaj7': (41, [57, 60, 64]), 'Csus': (36, [55, 60, 65]),
}
SEQ = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'Em', 'F', 'G', 'C', 'C']   # 12 bars ≈ 41 s; ends home on C
MEL = {  # (bar, beat, note, beats)
    0: [(2, 76, 2)], 1: [(0, 77, 1.5), (2, 76, 1), (3, 72, 1)], 2: [(0, 74, 2), (2.5, 72, 1.5)], 3: [(0, 71, 3)],
    4: [(0, 76, 1), (1, 79, 1), (2, 81, 2)], 5: [(0, 79, 1.5), (2, 77, 1), (3, 76, 1)], 6: [(0, 76, 2), (2, 74, 1), (3, 72, 1)],
    7: [(0, 71, 3)], 8: [(0, 72, 1), (1, 77, 1), (2, 81, 2)], 9: [(0, 83, 2), (2, 81, 1), (3, 79, 1)],
    10: [(0, 79, 2), (2, 84, 2)], 11: [(0, 84, 4)],
}
for b, name in enumerate(SEQ):
    t0 = b * BAR
    if t0 >= DUR:
        break
    root, tri = CH[name]
    w = warmth(t0)
    # piano: rolling 8th-note arpeggio (root, 5th, triad up)
    arp = [root, root + 7, tri[0] + 12 - 12, tri[1], tri[2], tri[1], tri[0] + 12, tri[1]]
    for k, n in enumerate(arp):
        add(piano(n, 3.0, 0.38 + 0.08 * (k == 0)), t0 + k * BEAT / 2, 0.3, pan=-0.25 + 0.06 * k)
    for beat, n, dur in MEL.get(b, []):
        add(piano(n, max(2.0, dur * BEAT + 1.0), 0.62), t0 + beat * BEAT, 0.34, pan=0.15)
    # strings: low pad from the start, cellos from bar 4, violins doubling the top from bar 8
    add(strings([n - 12 for n in tri], BAR + 1.4, t0, 1.0), t0 - 0.2, 0.18 + 0.32 * w, pan=-0.2, verb=0.55)
    if b >= 4: add(strings([root], BAR + 1.4, t0), t0 - 0.2, 0.2 + 0.25 * w, pan=-0.35, verb=0.5)
    if b >= 8: add(strings([n + 12 for n in tri], BAR + 1.4, t0), t0 - 0.2, 0.12 + 0.2 * w, pan=0.35, verb=0.6)

# final swell + held C major over the full sky (34 s →)
E = TL['END']
add(strings([48, 55, 60, 64, 67, 72, 76], 6.2, 34), E['sky'] - 0.3, 0.45, verb=0.7)
add(piano(36, 6.0, 0.6), 37.7, 0.3); add(piano(60, 5.0, 0.5), 37.7, 0.22); add(piano(79, 4.0, 0.5), 38.2, 0.22)

# =====================================================================
# SFX / ambience
def chime(note, d=3.0):
    x = tt(d); f = midi(note); s = np.zeros_like(x)
    for m, a, dec in ((1, 1, 1.3), (2.76, 0.3, 0.6), (5.4, 0.12, 0.25)):
        s += a * np.sin(2 * np.pi * f * m * x) * np.exp(-x / dec)
    return s * np.minimum(1, x / 0.002)


def soft_hit():
    d = 2.0; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(40 + 50 * np.exp(-x / 0.06)) / SR) * np.exp(-x / 0.5)
    air = filt(rng.standard_normal(len(x)), 'low', 800) * np.exp(-x / 0.2) * 0.3
    return sub + air


def ignite():
    d = 0.7; x = tt(d)
    n = rng.standard_normal(len(x))
    s = filt(n, 'band', [300, 2500]) * np.exp(-x / 0.18) * (1 - np.exp(-x / 0.02))
    s += filt(n, 'high', 3000) * np.exp(-x / 0.03) * 0.3     # match-strike crackle
    return s


def rustle(d=0.8):
    """Paper: grainy bursts of band-passed noise."""
    x = tt(d); n = rng.standard_normal(len(x))
    grains = np.zeros_like(x)
    for _ in range(int(d * 40)):
        i = rng.integers(0, len(x) - 800)
        grains[i:i + 800] += np.hanning(800) * rng.uniform(0.3, 1.0)
    return filt(n, 'band', [1500, 7000]) * grains * np.sin(np.pi * x / d) * 0.5


def whoosh_up(d=1.6):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n); seg = 8
    for k in range(seg):
        c = (k + 0.5) / seg; f = 300 * (6 ** c)
        out += filt(n, 'band', [f * 0.7, f * 1.5]) * np.clip(1 - np.abs(x / d - c) * seg, 0, 1)
    return out * np.sin(np.pi * x / d) ** 2 * 0.4


# wind bed with slow gusts
x = tt(DUR)
gust = 0.55 + 0.45 * np.sin(2 * np.pi * x / 9.0) * np.sin(2 * np.pi * x / 4.1 + 1)
wind = filt(rng.standard_normal(N), 'band', [200, 1400]) * gust
add(wind, 0.0, 0.11, verb=0.2)
add(filt(rng.standard_normal(N), 'band', [2000, 6000]) * gust ** 2, 0.0, 0.025, pan=0.4, verb=0.1)
# water lapping: low filtered swells + little droplet plinks
lap = filt(rng.standard_normal(N), 'low', 500) * (0.5 + 0.5 * np.sin(2 * np.pi * x / 2.7) ** 2)
add(lap, 0.0, 0.12, verb=0.15)
for k in range(46):
    t0 = rng.uniform(0.3, DUR - 0.5)
    d = 0.08; xx = tt(d); f = rng.uniform(700, 1500)
    drop = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * xx / d)) / SR) * np.exp(-xx / 0.025)
    add(drop, t0, 0.05, pan=rng.uniform(-0.6, 0.6), verb=0.4)

# hook: soft hit + chime on sample 0, the lantern flares
add(soft_hit(), 0.0, 0.7, verb=0.2)
add(chime(84, 3.5), 0.0, 0.3, pan=0.1, verb=0.6)
add(chime(91, 3.0), 0.12, 0.16, pan=-0.2, verb=0.6)
add(ignite(), 0.0, 0.35)
for Ln in TL['lanterns']:
    if Ln['rise'] is not None:
        add(rustle(0.6), Ln['rise'], 0.35, pan=-0.1)
        add(ignite(), Ln['rise'] + 0.3, 0.3)
    w0, w1 = Ln['write']
    add(rustle(w1 - w0), w0, 0.4, pan=0.1)                  # pen on paper / rustle while writing
    add(rustle(0.9), Ln['release'], 0.45)                   # paper lifts out of the hands
    add(whoosh_up(2.2), Ln['release'] + 0.1, 0.25, verb=0.4)
    add(chime(79 + [0, 2, 4, 5, 7][Ln['i']], 3.0), Ln['release'] + 0.3, 0.12, pan=0.2, verb=0.7)
# end: a soft chime cluster under the closing words
for k, n in enumerate((79, 84, 88)):
    add(chime(n, 3.5), E['text1'] + k * 0.25, 0.12, pan=-0.2 + 0.2 * k, verb=0.7)
add(chime(91, 3.5), E['text2'], 0.12, verb=0.7)

# =====================================================================
ir_len = int(3.0 * SR); xi = np.arange(ir_len) / SR
irL = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.8), 'low', 5000)
irR = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.8), 'low', 5000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
mix = np.stack([L + fftconvolve(VL, irL)[:N] * 0.55, R + fftconvolve(VR, irR)[:N] * 0.55], axis=1)
mix = filt(mix.T, 'high', 30).T
fo = int(1.4 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5       # no fade-in: hit + chime on sample 0
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'lentera-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out)
