"""Original warm, playful score + stop-motion foley for "Tugas numpuk? Ya dibentuk."

    python3 clay/music.py   -> out/clay-music.wav

Ukulele strums, glockenspiel, hand claps and a soft plucked bass at 110 BPM (C major),
a comic minor turn while the papers pile up, a bright return when mintask arrives and a
final strum on the logo. Foley (plop, tek, squish, thunk) is placed from clay/timeline.js,
so every paper landing, clock tick and face droop is heard on its exact pose.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.loads(subprocess.check_output(['node', '-e', """
const T = require('./clay/timeline.js');
process.stdout.write(JSON.stringify({ HOOK: T.HOOK, sheets: T.sheets, COFFEE: T.COFFEE, DROOP: T.DROOP,
  REFORM: T.REFORM, clockTicks: T.clockTicks, MINTASK: T.MINTASK, END: T.END }));"""], cwd=ROOT))

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(110)
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
def uke(note, d=1.2, vel=1.0):
    x = tt(d); f0 = midi(note); s = np.zeros_like(x)
    for k in range(1, 13):
        if f0 * k > 9000:
            break
        a = abs(np.sin(np.pi * k * 0.17)) / k
        s += a * np.sin(2 * np.pi * f0 * k * x * (1 + 0.0004 * k)) * np.exp(-x / (0.75 / (1 + 0.55 * (k - 1))))
    s *= np.minimum(1, x / 0.002)
    s += filt(rng.standard_normal(len(x)), 'band', [1500, 5000]) * np.exp(-x / 0.004) * 0.12   # nail/string noise
    return filt(s, 'low', 5500) * vel * np.clip((d - x) / 0.05, 0, 1)


VOICING = {
    'C': [67, 60, 64, 72], 'Am': [69, 60, 64, 69], 'F': [69, 60, 65, 69], 'G': [67, 62, 67, 71],
    'E7': [68, 62, 64, 71], 'D7': [69, 62, 66, 72], 'Dm': [69, 62, 65, 69],
}
ROOT_NOTE = {'C': 36, 'Am': 45, 'F': 41, 'G': 43, 'E7': 40, 'D7': 38, 'Dm': 38}


def strum(chord, t0, down=True, vel=1.0, d=1.0, pan=0.0):
    notes = VOICING[chord] if down else VOICING[chord][::-1]
    for k, n in enumerate(notes):
        add(uke(n, d, vel * (1.0 if down else 0.7)), t0 + k * 0.011, 0.2, pan=pan - 0.15 + k * 0.1)


def glock(note, d=1.6, vel=1.0):
    x = tt(d); f0 = midi(note); s = np.zeros_like(x)
    for m, a, dec in ((1, 1.0, 0.9), (2.76, 0.32, 0.25), (5.40, 0.12, 0.08)):
        s += a * np.sin(2 * np.pi * f0 * m * x) * np.exp(-x / dec)
    s += np.sin(2 * np.pi * f0 * 4 * x) * np.exp(-x / 0.01) * 0.2     # mallet tick
    return s * np.minimum(1, x / 0.0015) * vel


def bass(note, d=0.5):
    x = tt(d); f0 = midi(note)
    s = np.sin(2 * np.pi * f0 * x) + 0.3 * np.sin(2 * np.pi * 2 * f0 * x) + 0.1 * np.sin(2 * np.pi * 3 * f0 * x)
    return s * np.exp(-x / 0.35) * np.minimum(1, x / 0.004) * np.clip((d - x) / 0.04, 0, 1)


def clap(g=1.0):
    d = 0.22; x = tt(d); n = rng.standard_normal(len(x))
    e = np.exp(-x / 0.05) * 0.5
    for k in (0.0, 0.009, 0.019):
        i = int(k * SR); e[i:i + int(0.006 * SR)] += 1.0
    return filt(n, 'band', [900, 3800]) * e * 0.45 * g


def thump():
    d = 0.18; x = tt(d)
    return np.sin(2 * np.pi * np.cumsum(55 + 50 * np.exp(-x / 0.02)) / SR) * np.exp(-x / 0.07)


def shaker():
    d = 0.07; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 5000) * np.sin(np.pi * x / d) ** 2 * 0.25


# ---------------- foley ----------------
def plop(f0=260, f1=900, d=0.12):
    x = tt(d)
    f = f0 + (f1 - f0) * (1 - np.exp(-x / 0.025))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.045) * np.minimum(1, x / 0.002)


def tek(f=1900):
    d = 0.06; x = tt(d)
    s = (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * f * 1.48 * x)) * np.exp(-x / 0.012)
    return s + filt(rng.standard_normal(len(x)), 'high', 3000) * np.exp(-x / 0.002) * 0.4


def squish(d=0.32, low=1.0, f_from=500, f_to=1600):
    x = tt(d); n = rng.standard_normal(len(x))
    out = np.zeros_like(n); seg = 10
    for k in range(seg):                      # wet, moving resonance
        c = (k + 0.5) / seg
        f = f_from * (f_to / f_from) ** c
        w = np.clip(1 - np.abs(x / d - c) * seg, 0, 1)
        out += filt(n, 'band', [f * 0.8, f * 1.25]) * w
    wob = 0.6 + 0.4 * np.sin(2 * np.pi * 23 * x) ** 2
    s = out * wob * np.sin(np.pi * np.clip(x / d, 0, 1)) ** 0.6 * 1.6
    s += np.sin(2 * np.pi * np.cumsum(120 * np.exp(-x / 0.06) + 60) / SR) * np.exp(-x / 0.08) * 0.6 * low
    return s


def thunk():
    d = 0.6; x = tt(d)
    s = np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-x / 0.03)) / SR) * np.exp(-x / 0.18) * 1.3
    s[: int(0.35 * SR)] += squish(0.35, 0.3, 300, 900) * 0.6
    return s


def boing(f0=300, f1=520, d=0.4):
    x = tt(d)
    f = f0 + (f1 - f0) * x / d
    f = f * (1 + 0.07 * np.sin(2 * np.pi * 14 * x) * np.exp(-x / 0.25))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.18)


def paper_tap():
    d = 0.09; x = tt(d)
    s = filt(rng.standard_normal(len(x)), 'band', [700, 4000]) * np.exp(-x / 0.02) * 0.8
    p = plop(380, 700, 0.07); s[:len(p)] += p * 0.5
    return s


def whoosh(d=0.3):
    x = tt(d); n = rng.standard_normal(len(x))
    return filt(n, 'band', [800, 5000]) * np.sin(np.pi * x / d) ** 2 * 0.5


# =====================================================================
# MUSIC
BEAT = 60 / 110
BAR = 4 * BEAT
PROG = []
for b in range(19):
    t0 = b * BAR
    if t0 < 13.0: PROG.append(['C', 'Am', 'F', 'G'][b % 4])
    elif t0 < 26.0: PROG.append(['Am', 'F', 'D7', 'E7'][b % 4])
    elif t0 < 34.0: PROG.append(['C', 'F', 'G', 'C'][b % 4])
    else: PROG.append(['F', 'G', 'C'][min(2, b - 16)] if b >= 16 else 'G')

MEL_HAPPY = [[(0, 76), (0.5, 79), (1, 84), (2, 81), (2.5, 79), (3, 76)],
             [(0, 72), (1, 76), (1.5, 79), (2, 81), (3, 79)],
             [(0, 77), (0.5, 81), (1, 84), (2, 83), (2.5, 81), (3, 79)],
             [(0, 79), (1, 83), (1.5, 86), (2, 84), (3, 79), (3.5, 74)]]
MEL_UHOH = [[(0, 81), (1, 80), (2, 79), (3, 78)],
            [(0, 77), (0.5, 81), (1.5, 84), (3, 81)],
            [(0, 78), (1, 81), (2, 84), (2.5, 83), (3, 81)],
            [(0, 80), (0.5, 83), (1, 86), (2, 83), (3, 80), (3.5, 76)]]
MEL_MINTASK = [[(0, 84), (0.5, 79), (1, 76), (1.5, 79), (2, 84), (3, 88)],
               [(0, 89), (1, 88), (1.5, 86), (2, 84), (3, 81)],
               [(0, 83), (0.5, 84), (1, 86), (2, 91), (3, 89), (3.5, 86)],
               [(0, 88), (0.5, 86), (1, 84), (2, 79), (2.5, 84), (3, 88)]]

for b, ch in enumerate(PROG):
    t0 = b * BAR
    if t0 >= 34.8:      # finale is scored by hand below
        break
    frantic = 19.0 <= t0 < 26.0
    stamp_hold = 32.73 <= t0 < 34.9      # bar before the stamp: suspense
    # ukulele: D . D U . U D U (16ths when frantic)
    if stamp_hold:
        for k in range(8):                                   # tremolo on the dominant, rising tension
            tk = t0 + k * BEAT / 2
            if tk < 34.0: strum('G', tk, k % 2 == 0, 0.7 + 0.04 * k, 0.4)
        for k in range(8):
            tk = 34.0 + k * 0.11
            add(uke(VOICING['G'][k % 4] + 12, 0.15, 0.6), tk, 0.12)
    else:
        steps = [(0, 1), (1, 1), (1.5, 0), (2.5, 0), (3, 1), (3.5, 0)]
        if frantic:
            steps = [(k * 0.25, k % 2 == 0) for k in range(16)]
        for off, dn in steps:
            strum(ch, t0 + off * BEAT, bool(dn), 0.95 if dn else 0.7, 0.9 if not frantic else 0.35)
        # bass on 1 and 3
        r = ROOT_NOTE[ch]
        add(bass(r, BEAT * 1.6), t0, 0.5)
        add(bass(r + 7 if ch not in ('E7',) else r + 7, BEAT * 1.6), t0 + 2 * BEAT, 0.42)
        # claps on 2 and 4, soft thump on 1 and 3
        for k in (1, 3):
            add(clap(1.0 if t0 >= 26 else 0.85), t0 + k * BEAT, 0.55, pan=0.15, verb=0.2)
        for k in (0, 2):
            add(thump(), t0 + k * BEAT, 0.35, verb=0.0)
        if t0 >= 26.0:                                        # shaker joins with mintask
            for k in range(8):
                add(shaker(), t0 + k * BEAT / 2, 0.5 if k % 2 else 0.3, pan=-0.4)
        # glockenspiel melody
        if t0 < 13.0: mel = MEL_HAPPY[b % 4] if b >= 1 else MEL_HAPPY[0][:3]
        elif t0 < 26.0: mel = MEL_UHOH[b % 4]
        elif t0 < 34.0: mel = MEL_MINTASK[b % 4]
        else: mel = []
        for off, n in mel:
            add(glock(n, 1.4, 0.9), t0 + off * BEAT, 0.16, pan=0.3, verb=0.3)

# finale cadence: F (stamp) – G – C on the logo, then a last ring-out
FIN = [(35.0, 'F'), (36.09, 'G'), (37.2, 'C')]
for tc, ch in FIN:
    strum(ch, tc, True, 1.0, 1.4)
    add(bass(ROOT_NOTE[ch], 1.2), tc, 0.55)
for k, tk in enumerate([37.2 + j * BEAT / 2 for j in range(10)]):
    strum('C', tk, k % 2 == 0, 0.85 if k % 2 == 0 else 0.6, 0.6)
    if k % 2 == 1: add(clap(), tk, 0.45, pan=0.15, verb=0.25)
for k, n in enumerate((72, 76, 79, 84, 88, 91, 96)):
    add(glock(n, 2.0, 0.9), 38.4 + k * 0.07, 0.13, pan=-0.3 + k * 0.1, verb=0.4)
strum('C', 39.0, True, 1.0, 1.0)
add(bass(36, 1.0), 39.0, 0.55)
add(glock(84, 1.0, 1.0), 39.0, 0.2, verb=0.4)

# =====================================================================
# FOLEY (loud and clear)
H = TL['HOOK']
add(squish(0.35, 1.4, 250, 900), H['slap'], 0.95)          # hit on sample 0: hand slaps the clay
add(thunk(), H['slap'], 0.6)
strum('C', 0.0, True, 1.0, 1.0)
add(glock(84, 1.2), 0.0, 0.14, verb=0.3)
add(squish(0.4, 0.4, 600, 2200), H['pinch'], 0.75)       # pinched upward
add(boing(260, 620, 0.35), H['pinch'] + 0.05, 0.25)
add(plop(300, 1200, 0.14), H['poke'], 0.8)                 # poke: he pops into shape
add(squish(0.25, 0.5, 900, 1800), H['poke'], 0.4)
add(tek(2600), H['blink'], 0.3)
for k in range(3):
    add(plop(500 + k * 120, 1300, 0.08), H['textOut'] + k * 0.08, 0.35)

for s in TL['sheets']:
    add(paper_tap(), s['land'], 0.5, pan=-0.45 if s['stack'] == 'A' else -0.6)
    add(whoosh(0.22), s['t0'], 0.12, pan=-0.3)
for k, tk in enumerate(TL['clockTicks']):
    add(tek(1800 if k % 2 else 2200), tk, 0.32, pan=0.55)

CF = TL['COFFEE']
add(tek(900), CF['knock'], 0.7); add(tek(700), CF['knock'] + 0.09, 0.5)
add(squish(0.55, 0.8, 400, 1400), CF['spill'], 0.9, pan=0.35)
for k in range(3):
    add(plop(220, 600, 0.09), CF['spill'] + 0.1 + k * 0.1, 0.4, pan=0.3)
for tt_, _v in TL['DROOP']:
    add(squish(0.45, 0.9, 1400, 350), tt_, 0.85)             # face sags (downward squish)
    add(boing(420, 260, 0.35), tt_ + 0.03, 0.12)

MT = TL['MINTASK']
for h in MT['hops']:
    add(plop(200, 520, 0.1), h + 0.33, 0.6, pan=0.4)
add(plop(500, 1200, 0.1), MT['wave'], 0.5, pan=0.4)
for b in MT['bursts']:
    add(whoosh(0.3), b, 0.4, pan=-0.2)
    add(squish(0.22, 0.4, 900, 2000), b, 0.45, pan=-0.2)
    add(plop(260, 800, 0.1), b + 0.33, 0.7, pan=-0.35)
    add(tek(1500), b + 0.34, 0.35, pan=-0.35)
for w in MT['wipe']:
    add(squish(0.2, 0.2, 1200, 2500), w, 0.5, pan=0.2)
add(tek(1200), MT['mugUp'], 0.6, pan=0.3)
for tt_, _v in TL['REFORM']:
    add(squish(0.3, 0.6, 350, 1300), tt_, 0.75)              # face pops back up
add(boing(300, 700, 0.4), TL['REFORM'][-1][0] + 0.05, 0.3)
for k, n in enumerate((84, 88, 91, 96)):
    add(glock(n, 1.2), MT['smile'] + k * 0.08, 0.14, verb=0.4)
add(plop(400, 1100, 0.1), MT['thumbs'], 0.55)

EN = TL['END']
add(plop(150, 380, 0.2), EN['cut'], 0.9)                   # clay slab lands
add(whoosh(0.6), EN['cut'] + 0.3, 0.3)
add(thunk(), EN['press'], 1.0)                             # stamp!
add(squish(0.4, 0.2, 2200, 600), EN['lift'], 0.7)          # suction on lift
add(plop(300, 900, 0.08), EN['lift'] + 0.05, 0.4)
for b in EN['blue']:
    add(squish(0.2, 0.5, 500, 1500), b, 0.55)
add(plop(220, 900, 0.14), EN['logo'], 0.85)
add(plop(300, 1000, 0.12), EN['tag1'], 0.75)
add(plop(320, 1100, 0.12), EN['tag2'], 0.75)

# =====================================================================
# room reverb + master
ir_len = int(1.1 * SR); xi = np.arange(ir_len) / SR
irL = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.3), 'low', 6000)
irR = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.3), 'low', 6000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
mix = np.stack([L + fftconvolve(VL, irL)[:N] * 0.6, R + fftconvolve(VR, irR)[:N] * 0.6], axis=1)
mix = filt(mix.T, 'high', 35).T
fo = int(0.5 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]       # no fade-in: the slap is on sample 0
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'clay-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out)
