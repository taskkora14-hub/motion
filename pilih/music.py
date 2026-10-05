"""Original upbeat pop-funk score + SFX for "Pilih cepat! This or that mahasiswa."

    python3 pilih/music.py   -> out/pilih-music.wav

118 BPM: slap bass, funky guitar chops, brass stabs, four-on-the-floor-ish drums with 16th
hats and claps, a short synth riff. Timer ticks ("tik-tik"), lock pops and whooshes are
placed from pilih/timeline.js so they land on the exact frame.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.loads(subprocess.check_output(['node', '-e', """
const T = require('./pilih/timeline.js');
process.stdout.write(JSON.stringify({ HOOK: T.HOOK, pairs: T.pairs, ticks: T.ticks, RESULT: T.RESULT }));"""], cwd=ROOT))

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(118)
L = np.zeros(N); R = np.zeros(N)
VL = np.zeros(N); VR = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0, verb=0.1):
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
def kick():
    d = 0.32; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-x / 0.025)) / SR) * np.exp(-x / 0.11) * 1.1


def snare():
    d = 0.2; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'band', [1500, 7000]) * np.exp(-x / 0.05) * 0.6 + np.sin(2 * np.pi * 200 * x) * np.exp(-x / 0.03) * 0.5


def clap():
    d = 0.2; x = tt(d); e = np.exp(-x / 0.05) * 0.5
    for k in (0.0, 0.009, 0.018):
        i = int(k * SR); e[i:i + int(0.005 * SR)] += 1
    return filt(rng.standard_normal(len(x)), 'band', [900, 4000]) * e * 0.5


def hat(open_=False):
    d = 0.16 if open_ else 0.04; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 7500) * np.exp(-x / (0.05 if open_ else 0.01)) * 0.5


def crash(d=1.4):
    x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 4000) * np.exp(-x / 0.45) * 0.45


def slap(note, d):
    x = tt(d); f = midi(note); s = np.zeros_like(x)
    for k in range(1, 14):
        if f * k > 6000:
            break
        s += np.sin(2 * np.pi * f * k * x) / k * np.exp(-x / (0.5 / (1 + 0.9 * (k - 1))))
    s += filt(rng.standard_normal(len(x)), 'band', [1500, 4000]) * np.exp(-x / 0.004) * 0.6   # thumb click
    return s * np.minimum(1, x / 0.002) * np.clip((d - x) / 0.02, 0, 1)


def gtr(notes, d=0.14, muted=False):
    x = tt(d)
    if muted:
        return filt(rng.standard_normal(len(x)), 'band', [1200, 3500]) * np.exp(-x / 0.012) * 0.6
    s = np.zeros_like(x)
    for j, n in enumerate(notes):
        f = midi(n)
        for k in range(1, 8):
            s += np.sin(2 * np.pi * f * k * (x - j * 0.004).clip(0)) * abs(np.sin(np.pi * k * 0.22)) / k * np.exp(-x / (0.12 / k ** 0.5))
    return filt(s, 'band', [300, 4500]) * np.clip((d - x) / 0.02, 0, 1) / len(notes)


def brass(notes, d=0.3):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.12, 0.12):
            f = midi(n) * (1 + det / 100)
            for k in range(1, 12):
                if f * k > 7000:
                    break
                s += np.sin(2 * np.pi * f * k * x) / k
    env = np.minimum(1, x / 0.015) * np.exp(-x / 0.18) * np.clip((d - x) / 0.04, 0, 1)
    return filt(s * env, 'low', 4500) / len(notes) * 0.5


def lead(note, d):
    x = tt(d); f = midi(note) * (1 + 0.006 * np.sin(2 * np.pi * 6 * x))
    ph = np.cumsum(f) / SR % 1
    s = np.where(ph < 0.35, 1.0, -1.0)
    return filt(s, 'low', 3500) * np.minimum(1, x / 0.005) * np.exp(-x / 0.3) * np.clip((d - x) / 0.02, 0, 1)


# ---------------- groove ----------------
BEAT = 60 / 118
S16 = BEAT / 4
# two-bar vamps: Em9 – A13, with a lift (Cmaj7 – D6) every 4th pair of bars
CH = {'Em9': (40, [62, 66, 67, 71]), 'A13': (45, [61, 66, 67, 71]), 'Cmaj7': (36, [59, 64, 67, 71]), 'D6': (38, [62, 66, 69, 71])}
BASS_PAT = [(0, 0), (3, 12), (4, 0), (6, 7), (8, 0), (10, 12), (11, 10), (14, 7)]   # (16th, interval)
GTR_STAB = [2, 6, 7, 10, 14]
RIFF = [(0, 79), (2, 78), (3, 76), (6, 74), (8, 76), (11, 79), (12, 81)]

END_GROOVE = TL['RESULT']['in']
nbars = int(END_GROOVE / (4 * BEAT)) + 1
for bar in range(nbars):
    t0 = bar * 4 * BEAT
    if t0 >= END_GROOVE:
        break
    blk = (bar // 2) % 4
    name = (['Cmaj7', 'D6'] if blk == 3 else ['Em9', 'A13'])[bar % 2]
    root, chord = CH[name]
    for k in range(16):
        ts = t0 + k * S16 + (0.012 if k % 2 else 0)          # light 16th swing
        if ts >= END_GROOVE:
            break
        if k in (0, 6, 8) or (k == 14 and bar % 2): add(kick(), ts, 0.75)
        if k in (4, 12): add(snare(), ts, 0.5); add(clap(), ts, 0.38, pan=0.1)
        add(hat(open_=(k == 10)), ts, 0.16 if k % 2 else 0.24, pan=0.35)
        add(gtr(chord, muted=True), ts, 0.1 if k % 2 else 0.06, pan=-0.45)
        if k in GTR_STAB: add(gtr(chord, 0.16), ts, 0.55, pan=-0.35)
    for k16, iv in BASS_PAT:
        ts = t0 + k16 * S16
        if ts < END_GROOVE: add(slap(root + iv, S16 * 1.6), ts, 0.42)
    if bar % 4 == 3:   # brass hits at the end of every 4 bars
        for k16 in (10, 12, 14):
            ts = t0 + k16 * S16
            if ts < END_GROOVE: add(brass(chord + [chord[0] + 12], 0.18), ts, 0.4, pan=0.2, verb=0.15)
    if bar % 4 in (1, 2) and t0 > 4:   # synth riff call
        for k16, n in RIFF:
            ts = t0 + k16 * S16
            if ts < END_GROOVE: add(lead(n, S16 * 1.8), ts, 0.13, pan=0.25, verb=0.2)

# ---------------- result: fanfare + outro ----------------
RS = TL['RESULT']
add(crash(1.8), RS['in'], 0.6)
add(brass([62, 66, 69, 74], 0.22), RS['in'], 0.55, verb=0.2)
add(brass([64, 67, 71, 76], 0.7), RS['in'] + 0.25, 0.6, verb=0.25)
t0 = RS['in'] + 0.25
bar = 0
while t0 < DUR - 0.6:
    root, chord = CH[['Em9', 'A13'][bar % 2]]
    for k in range(16):
        ts = t0 + k * S16
        if ts >= DUR - 0.55: break
        if k in (0, 8): add(kick(), ts, 0.75)
        if k in (4, 12): add(snare(), ts, 0.5); add(clap(), ts, 0.4)
        add(hat(), ts, 0.2 if k % 2 else 0.26, pan=0.35)
        if k in GTR_STAB: add(gtr(chord, 0.16), ts, 0.55, pan=-0.35)
    for k16, iv in BASS_PAT:
        ts = t0 + k16 * S16
        if ts < DUR - 0.55: add(slap(root + iv, S16 * 1.6), ts, 0.42)
    t0 += 4 * BEAT; bar += 1
# final button hit
add(kick(), 39.45, 0.9); add(crash(0.6), 39.45, 0.5)
add(brass([64, 67, 71, 76, 79], 0.5), 39.45, 0.6, verb=0.25)
add(slap(28, 0.5), 39.45, 0.5)

# =====================================================================
# SFX
def tick(strong=True):
    d = 0.05; x = tt(d); f = 2600 if strong else 3300
    return (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * f * 1.5 * x)) * np.exp(-x / 0.008) + \
        filt(rng.standard_normal(len(x)), 'high', 4000) * np.exp(-x / 0.002) * 0.5


def pop():
    d = 0.14; x = tt(d)
    s = np.sin(2 * np.pi * np.cumsum(280 + 700 * (1 - np.exp(-x / 0.02))) / SR) * np.exp(-x / 0.05)
    clink = np.zeros_like(x)
    for m, a in ((1, 1), (2.7, 0.5), (5.1, 0.3)):
        clink += a * np.sin(2 * np.pi * 2200 * m * x) * np.exp(-x / 0.03)
    return s * 1.2 + clink * 0.25


def whoosh(d=0.3, up=True):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n); seg = 8
    for k in range(seg):
        c = (k + 0.5) / seg; f = 500 * (12 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x / d - c) * seg, 0, 1)
    return out * np.sin(np.pi * x / d) ** 1.5 * 0.5


def impact():
    d = 0.6; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(45 + 120 * np.exp(-x / 0.03)) / SR) * np.exp(-x / 0.2) * 1.2 + \
        filt(rng.standard_normal(len(x)), 'low', 3000) * np.exp(-x / 0.06) * 0.6


# hook: hit on sample 0 + countdown + "mulai!"
add(impact(), 0.0, 0.85)
add(crash(1.6), 0.0, 0.5)
add(brass([64, 67, 71, 74], 0.35), 0.0, 0.55, verb=0.15)
for k in TL['HOOK']['ticks']:
    add(tick(True), k, 0.55, pan=0.0)
add(tick(False), 2.5, 0.4)
add(brass([66, 69, 74], 0.12), TL['HOOK']['go'], 0.45); add(brass([67, 71, 76], 0.4), TL['HOOK']['go'] + 0.13, 0.5)
add(whoosh(0.3, False), TL['HOOK']['out'], 0.45)

for p in TL['pairs']:
    add(whoosh(0.3, True), p['s'] - 0.02, 0.4)
    add(pop(), p['lock'], 0.75)
    add(impact(), p['lock'], 0.35)
    add(whoosh(0.25, False), p['out'], 0.35)
for tk in TL['ticks']:
    add(tick(tk['strong']), tk['t'], 0.5 if tk['strong'] else 0.38)
# result chips + prompt
for i in range(8):
    add(pop() * 0.6, RS['chips'] + i * 0.06, 0.25, pan=-0.4 + 0.1 * i)
add(pop(), RS['text'], 0.5); add(pop(), RS['text'] + 0.15, 0.45)

# =====================================================================
ir_len = int(1.0 * SR); xi = np.arange(ir_len) / SR
irL = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.25), 'low', 6000)
irR = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.25), 'low', 6000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
mix = np.stack([L + fftconvolve(VL, irL)[:N] * 0.6, R + fftconvolve(VR, irR)[:N] * 0.6], axis=1)
mix = filt(mix.T, 'high', 30).T
fo = int(0.3 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]       # no fade-in: the hit is on sample 0
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'pilih-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out)
