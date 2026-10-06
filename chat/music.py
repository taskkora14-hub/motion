"""Original light lo-fi score + chat SFX for "Chat a atau b yang bakal dibalas dosen?"

    python3 chat/music.py   -> out/chat-music.wav

95 BPM, soft and comfortable: felt piano chords and a little melody over a swung lo-fi
beat, round bass and vinyl crackle. SFX: chat "ting" notifications, "swoosh" on every send,
soft typing taps, a small buzz when the lecturer frowns, a pop when they smile.
All times come from chat/timeline.js.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.loads(subprocess.check_output(['node', '-e', """
const T = require('./chat/timeline.js');
process.stdout.write(JSON.stringify({ HOOK: T.HOOK, rounds: T.rounds, END: T.END }));"""], cwd=ROOT))

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(95)
L = np.zeros(N); R = np.zeros(N)
VL = np.zeros(N); VR = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0, verb=0.15):
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


# ---------------- instruments ----------------
def piano(note, d=2.4, vel=0.5):
    x = tt(d); f0 = midi(note); s = np.zeros_like(x)
    for k in range(1, 8):
        fk = f0 * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 7000:
            break
        dec = (1.0 + 1.6 * (60 / max(note, 30))) / (1 + 0.5 * (k - 1))
        s += (1 / k ** 1.5) * np.sin(2 * np.pi * fk * x + rng.uniform(0, 6)) * np.exp(-x / dec)
    s *= np.minimum(1, x / 0.006) * np.clip((d - x) / 0.3, 0, 1)
    return filt(s, 'low', 1600 + 2200 * vel) * vel      # felt-piano: darker


def kick():
    d = 0.3; x = tt(d)
    return filt(np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-x / 0.03)) / SR) * np.exp(-x / 0.12), 'low', 4000)


def snare():
    d = 0.22; x = tt(d)
    return filt(filt(rng.standard_normal(len(x)), 'band', [1200, 5000]) * np.exp(-x / 0.06) * 0.5 + np.sin(2 * np.pi * 190 * x) * np.exp(-x / 0.04) * 0.35, 'low', 5000)


def hat():
    d = 0.05; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'band', [6000, 11000]) * np.exp(-x / 0.012)


def bass(note, d):
    x = tt(d); f = midi(note)
    return (np.sin(2 * np.pi * f * x) + 0.2 * np.sin(4 * np.pi * f * x)) * np.exp(-x / 0.6) * np.minimum(1, x / 0.01) * np.clip((d - x) / 0.05, 0, 1)


BEAT = 60 / 95
S8 = BEAT / 2
CH = [(41, [57, 60, 64, 67]), (40, [55, 59, 62, 64]), (38, [57, 60, 62, 65]), (43, [55, 59, 62, 65])]   # Fmaj7 Em7 Dm7 G7
MEL = [[(0, 76), (1.5, 74), (2, 72)], [(0, 74), (1, 71), (2.5, 72)], [(0, 72), (0.5, 74), (1, 77), (3, 76)], [(0, 74), (2, 71)]]
END = DUR - 0.3
bar, t0 = 0, 0.0
while t0 < END:
    root, chord = CH[bar % 4]
    for k8 in range(8):
        ts = t0 + k8 * S8 + (0.07 * S8 if k8 % 2 else 0)
        if ts >= END: break
        if k8 in (0, 5): add(kick(), ts, 0.5)
        if k8 in (2, 6): add(snare(), ts, 0.32, verb=0.2)
        add(hat(), ts, 0.13 if k8 % 2 else 0.18, pan=0.35)
        if k8 in (0, 3):
            for j, n in enumerate(chord):
                add(piano(n, BEAT * (2.6 if k8 == 0 else 1.6), 0.42 if k8 == 0 else 0.3), ts + j * 0.018, 0.12, pan=-0.2 + j * 0.12, verb=0.3)
    for off, n in MEL[bar % 4]:
        ts = t0 + off * BEAT
        if ts < END: add(piano(n, 2.0, 0.55), ts, 0.2, pan=0.2, verb=0.35)
    add(bass(root - 12, BEAT * 1.8), t0, 0.4); add(bass(root - 5, BEAT * 1.2), t0 + 2.5 * BEAT, 0.3)
    bar += 1; t0 += 4 * BEAT
# vinyl crackle
crack = np.zeros(N); idx = rng.integers(0, N, 2200); crack[idx] = rng.uniform(-1, 1, len(idx))
add(filt(crack, 'band', [1000, 7000]) + filt(rng.standard_normal(N), 'band', [2000, 8000]) * 0.02, 0.0, 0.12, verb=0.0)

# =====================================================================
# SFX
def ting(note=88, d=0.9):
    x = tt(d); f = midi(note); s = np.zeros_like(x)
    for m, a, dec in ((1, 1, 0.35), (2.0, 0.35, 0.18), (3.0, 0.12, 0.08)):
        s += a * np.sin(2 * np.pi * f * m * x) * np.exp(-x / dec)
    return s * np.minimum(1, x / 0.001)


def notif():
    a = ting(88, 0.8); b = ting(93, 0.9)
    out = np.zeros(int(1.1 * SR)); out[:len(a)] += a; i = int(0.11 * SR); out[i:i + len(b)] += b
    return out


def swoosh(d=0.32):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n); seg = 8
    for k in range(seg):
        c = (k + 0.5) / seg; f = 700 * (9 ** c)
        out += filt(n, 'band', [f * 0.7, min(f * 1.4, 18000)]) * np.clip(1 - np.abs(x / d - c) * seg, 0, 1)
    return out * np.sin(np.pi * x / d) ** 1.4 * 0.6


def buzz(d=0.32):
    x = tt(d)
    s = np.sign(np.sin(2 * np.pi * 110 * x)) * 0.5 + np.sin(2 * np.pi * 220 * x) * 0.4
    return filt(s, 'low', 1800) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 18 * x))) * np.exp(-x / 0.25) * np.minimum(1, x / 0.005)


def pop():
    d = 0.12; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(320 + 600 * (1 - np.exp(-x / 0.02))) / SR) * np.exp(-x / 0.045)


def tap():
    d = 0.03; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'band', [1500, 6000]) * np.exp(-x / 0.004) + np.sin(2 * np.pi * 900 * x) * np.exp(-x / 0.006) * 0.4


def hit():
    d = 0.5; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(45 + 100 * np.exp(-x / 0.03)) / SR) * np.exp(-x / 0.16) + filt(rng.standard_normal(len(x)), 'low', 2500) * np.exp(-x / 0.04) * 0.5


# hook: hit + double ting on sample 0, read ticks
add(hit(), 0.0, 0.75)
add(notif(), 0.0, 0.42, pan=-0.2, verb=0.25)
add(notif(), 0.02, 0.36, pan=0.25, verb=0.25)
add(pop() * 0.5, TL['HOOK']['ticks'], 0.25)

for r in TL['rounds']:
    add(swoosh(0.35), r['s'], 0.22)                                   # panels slide in
    for (a, b) in (r['typeA'], r['typeB']):
        n = int((b - a) / 0.075)
        for k in range(n):
            add(tap(), a + k * 0.075 + rng.uniform(0, 0.02), 0.22, pan=rng.uniform(-0.2, 0.2))
    add(swoosh(), r['sendA'], 0.5, pan=0.2)
    add(swoosh(), r['sendB'], 0.5, pan=0.2)
    add(pop() * 0.4, r['readA'], 0.2); add(pop() * 0.4, r['readB'], 0.2)
    add(buzz(), r['reactA'], 0.5)                                    # bad message
    add(pop(), r['reactB'], 0.45)                                    # lecturer smiles
    add(notif(), r['replyAt'], 0.45, verb=0.25)                      # reply notification
    add(pop() * 0.6, r['whyAt'], 0.25)
    add(ting(91, 0.6), r['ask'], 0.3); add(pop(), r['ask'], 0.35)

E = TL['END']
add(swoosh(0.4), E['in'], 0.3)
for i, c in enumerate(E['cards']):
    add(pop(), c, 0.4, pan=-0.3 + 0.3 * i)
add(ting(88, 1.2), E['save'], 0.4, verb=0.3); add(ting(95, 1.2), E['save'] + 0.12, 0.3, verb=0.3)

# =====================================================================
ir_len = int(1.4 * SR); xi = np.arange(ir_len) / SR
irL = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.4), 'low', 5000)
irR = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.4), 'low', 5000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
mix = np.stack([L + fftconvolve(VL, irL)[:N] * 0.6, R + fftconvolve(VR, irR)[:N] * 0.6], axis=1)
mix = filt(mix.T, 'high', 30).T
fo = int(0.5 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]       # no fade-in: hit + ting on sample 0
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'chat-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out)
