"""Original light tech-pop score + SFX for "5 shortcut yang jarang kamu tahu."

    python3 shortcut/music.py   -> out/shortcut-music.wav

115 BPM, kept light so it sits under the tutorial: plucky synth arpeggios, soft kick, claps,
round sub bass and bell chords. Mechanical keyboard clicks on every key-down/up, a "ting"
when each trick is done ("simpan ini."), UI whooshes/pops and a shutter for the screenshot.
All event times come from shortcut/timeline.js.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.loads(subprocess.check_output(['node', '-e', """
const T = require('./shortcut/timeline.js');
process.stdout.write(JSON.stringify({ HOOK: T.HOOK, tricks: T.tricks, RECAP: T.RECAP, OUTRO: T.OUTRO, clicks: T.clicks }));"""], cwd=ROOT))

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(115)
L = np.zeros(N); R = np.zeros(N)
VL = np.zeros(N); VR = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0, verb=0.12):
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
    d = 0.28; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-x / 0.025)) / SR) * np.exp(-x / 0.1)


def clap():
    d = 0.18; x = tt(d); e = np.exp(-x / 0.045) * 0.5
    for k in (0.0, 0.009, 0.018):
        i = int(k * SR); e[i:i + int(0.005 * SR)] += 1
    return filt(rng.standard_normal(len(x)), 'band', [1000, 4500]) * e * 0.45


def hat():
    d = 0.04; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 8000) * np.exp(-x / 0.009) * 0.5


def pluck(note, d=0.25):
    x = tt(d); f = midi(note)
    ph = np.cumsum(np.full(len(x), f)) / SR % 1
    saw = 2 * ph - 1
    sq = np.where(ph < 0.5, 1.0, -1.0)
    s = 0.6 * saw + 0.4 * sq
    # quick filter "pluck": blend a bright and a dark copy
    bright, dark = filt(s, 'low', 5000), filt(s, 'low', 900)
    e = np.exp(-x / 0.05)
    return (bright * e + dark * (1 - e)) * np.exp(-x / 0.12) * np.minimum(1, x / 0.002)


def bell(note, d=1.2):
    x = tt(d); f = midi(note); s = np.zeros_like(x)
    for m, a, dec in ((1, 1, 0.7), (2.0, 0.35, 0.35), (3.0, 0.15, 0.2), (4.07, 0.08, 0.1)):
        s += a * np.sin(2 * np.pi * f * m * x) * np.exp(-x / dec)
    return s * np.minimum(1, x / 0.002)


def sub(note, d):
    x = tt(d); f = midi(note)
    return np.sin(2 * np.pi * f * x) * np.minimum(1, x / 0.01) * np.clip((d - x) / 0.04, 0, 1) * np.exp(-x / 0.8)


def pad(notes, d):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.1, 0.1):
            s += np.sin(2 * np.pi * midi(n) * (1 + det / 100) * x) + 0.3 * np.sin(4 * np.pi * midi(n) * x)
    env = np.minimum(1, x / 0.3) * np.clip((d - x) / 0.4, 0, 1)
    return filt(s, 'low', 2500) * env / len(notes)


# ---------------- groove (kept light) ----------------
BEAT = 60 / 115
S16 = BEAT / 4
PROG = [(45, [57, 60, 64, 67]), (41, [57, 60, 64, 65]), (36, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]   # Am7 Fmaj7 C G
END = DUR - 0.25
nbars = int(DUR / (4 * BEAT)) + 1
for bar in range(nbars):
    t0 = bar * 4 * BEAT
    if t0 >= END:
        break
    root, chord = PROG[bar % 4]
    outro = t0 >= TL['OUTRO']['in'] - 0.2
    add(pad(chord, 4 * BEAT + 0.3), t0, 0.12, verb=0.3)
    for k in range(16):
        ts = t0 + k * S16
        if ts >= END:
            break
        if k in (0, 8) or (k == 10 and bar % 2): add(kick(), ts, 0.55)
        if k in (4, 12): add(clap(), ts, 0.32, pan=0.1)
        if k % 2 == 0: add(hat(), ts, 0.14 if k % 4 else 0.2, pan=0.35)
        arp = chord[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]] + 12
        add(pluck(arp, S16 * 1.6), ts, 0.075 if not outro else 0.1, pan=-0.3 + 0.6 * ((k % 4) / 3), verb=0.25)
    add(sub(root - 12, BEAT * 1.9), t0, 0.4); add(sub(root - 12, BEAT * 1.6), t0 + 2.5 * BEAT, 0.32)
    if bar % 2 == 1:
        for k, n in enumerate([chord[3] + 12, chord[2] + 12]):
            add(bell(n, 0.8), t0 + (2 + k) * BEAT, 0.07, pan=0.3, verb=0.35)

# =====================================================================
# SFX
def click(down=True):
    """Mechanical key: sharp click + plastic 'thock'."""
    d = 0.09; x = tt(d)
    clk = filt(rng.standard_normal(len(x)), 'band', [2500, 9000]) * np.exp(-x / (0.0025 if down else 0.002))
    thock = np.sin(2 * np.pi * (520 if down else 700) * x) * np.exp(-x / 0.015) + np.sin(2 * np.pi * 180 * x) * np.exp(-x / 0.02) * 0.6
    s = clk * 1.2 + thock * (0.9 if down else 0.5)
    return s


def ting():
    s = bell(88, 1.4)
    b = bell(95, 1.0); s[:len(b)] += 0.5 * b
    return s


def whoosh(d=0.3):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n); seg = 8
    for k in range(seg):
        c = (k + 0.5) / seg; f = 600 * (10 ** c)
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x / d - c) * seg, 0, 1)
    return out * np.sin(np.pi * x / d) ** 1.5 * 0.5


def pop():
    d = 0.12; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(300 + 700 * (1 - np.exp(-x / 0.02))) / SR) * np.exp(-x / 0.04)


def shutter():
    d = 0.18; x = tt(d)
    s = filt(rng.standard_normal(len(x)), 'band', [1500, 6000]) * (np.exp(-x / 0.01) + 0.7 * np.exp(-np.maximum(0, x - 0.07) / 0.012) * (x > 0.07))
    return s


def impact():
    d = 0.6; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(42 + 110 * np.exp(-x / 0.03)) / SR) * np.exp(-x / 0.2) * 1.2 + \
        filt(rng.standard_normal(len(x)), 'low', 3000) * np.exp(-x / 0.05) * 0.7


# hook: three keys slam on sample 0
add(impact(), 0.0, 0.85)
for j in range(3):
    add(click(True), 0.0 + j * 0.004, 0.55, pan=-0.3 + 0.3 * j)
add(whoosh(0.25), 0.06, 0.35)
add(shutter(), 1.55, 0.5)                                  # hook snip completes
for c in TL['clicks']:
    if c['t'] == 0: continue
    add(click(c['down']), c['t'], 0.55 if c['down'] else 0.35, pan=-0.2)

for k in TL['tricks']:
    add(whoosh(0.3), k['s'], 0.3)                            # title slides in
    for j in range(len(k['combo'])):
        add(pop() * 0.6, k['s'] + 0.15 + j * 0.08, 0.18, pan=-0.3 + 0.3 * j)
    add(pop(), k['result'], 0.35)                            # result appears
    if k['i'] == 0:
        add(click(True), k['s'] + 0.55, 0.3); add(whoosh(0.2), k['s'] + 0.6, 0.15)   # mouse closes the tab
    if k['i'] == 2:
        add(shutter(), k['result'] + 1.6, 0.55)
    if k['i'] == 1:
        add(pop(), k['s'] + 3.2, 0.25)
    add(ting(), k['save'], 0.45, pan=0.3, verb=0.3)          # trick done → "simpan ini."
    add(whoosh(0.3), k['out'], 0.2)

RC = TL['RECAP']
for i in range(5):
    add(pop(), RC['in'] + 0.1 + i * 0.16, 0.25, pan=-0.4 + 0.2 * i)
O = TL['OUTRO']
add(whoosh(0.5), O['in'], 0.35)
add(ting(), O['thumbs'], 0.5, verb=0.35)
add(pop(), O['text'], 0.4); add(pop(), O['text'] + 0.15, 0.35)
for k, n in enumerate((72, 76, 79, 84)):
    add(bell(n, 1.5), 38.6 + k * 0.08, 0.1, verb=0.4)

# =====================================================================
ir_len = int(1.2 * SR); xi = np.arange(ir_len) / SR
irL = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.3), 'low', 6000)
irR = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.3), 'low', 6000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
mix = np.stack([L + fftconvolve(VL, irL)[:N] * 0.6, R + fftconvolve(VR, irR)[:N] * 0.6], axis=1)
mix = filt(mix.T, 'high', 30).T
fo = int(0.4 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]       # no fade-in: the hit is on sample 0
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'shortcut-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out)
