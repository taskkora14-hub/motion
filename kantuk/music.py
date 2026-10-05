"""Original lo-fi playful score + SFX for "Level kantuk kelas jam 7 pagi."

    python3 kantuk/music.py   -> out/kantuk-music.wav

A swung 90 BPM lo-fi beat (e-piano, round bass, soft drums, kalimba, vinyl crackle) that gets
sleepier every level: slower (90 → 84 → 78 → 72 → 64 BPM), slightly flat, more muffled and
sparser. A tape-stop on "ada pertanyaan?", then everything snaps awake at 90 BPM.
SFX: the "duk" on sample 0, a lecturer "wah-wah" that drifts further away each level,
head flops while nodding, snores, and a "ting" on every level-up. Times: kantuk/timeline.js.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.loads(subprocess.check_output(['node', '-e', """
const T = require('./kantuk/timeline.js');
process.stdout.write(JSON.stringify({ HOOK: T.HOOK, LEVELS: T.LEVELS, BLINKS: T.BLINKS, YAWN: T.YAWN,
  NODS: T.NODS, SNORE: T.SNORE, WAH: T.WAH, END: T.END }));"""], cwd=ROOT))
END = TL['END']

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(90)
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


def level(t):
    if t < TL['LEVELS'][0] or t >= END['ask']:
        return 0 if t < 34 else 6
    return min(5, 1 + int((t - 4) // 6))


# per level: tempo, pitch factor, low-pass, wow depth
BPM = {0: 90, 1: 90, 2: 84, 3: 78, 4: 72, 5: 64, 6: 90}
PITCH = {0: 1.0, 1: 1.0, 2: 0.99, 3: 0.978, 4: 0.964, 5: 0.945, 6: 1.0}
CUT = {0: 9000, 1: 9000, 2: 5200, 3: 3300, 4: 2100, 5: 1300, 6: 10000}
WOW = {0: 0.0, 1: 0.0, 2: 0.002, 3: 0.004, 4: 0.006, 5: 0.009, 6: 0.0}


def sleepy(sig, t0):
    """Muffle a note according to the level at its onset."""
    return filt(sig, 'low', CUT[level(t0)])


# ---------------- instruments ----------------
def epiano(note, d, t0, vel=1.0):
    lv = level(t0); x = tt(d)
    f = midi(note) * PITCH[lv] * (1 + WOW[lv] * np.sin(2 * np.pi * 0.7 * (x + t0)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph + 1.1 * np.exp(-x / 0.25) * np.sin(2 * ph)) + 0.25 * np.sin(2 * ph) * np.exp(-x / 0.4)
    s *= np.exp(-x / 1.4) * np.minimum(1, x / 0.004) * np.clip((d - x) / 0.08, 0, 1)
    return sleepy(s, t0) * vel


def kalimba(note, t0, d=0.7):
    lv = level(t0); x = tt(d); f = midi(note) * PITCH[lv]
    s = (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x / 0.03)) * np.exp(-x / 0.25)
    return sleepy(s * np.minimum(1, x / 0.002), t0)


def bass(note, d, t0):
    lv = level(t0); x = tt(d); f = midi(note) * PITCH[lv]
    s = np.sin(2 * np.pi * f * x) + 0.2 * np.sin(2 * np.pi * 2 * f * x)
    return s * np.exp(-x / 0.6) * np.minimum(1, x / 0.01) * np.clip((d - x) / 0.05, 0, 1)


def kick(t0):
    d = 0.3; x = tt(d)
    return sleepy(np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-x / 0.03)) / SR) * np.exp(-x / 0.12), t0)


def snare(t0):
    d = 0.22; x = tt(d)
    s = filt(rng.standard_normal(len(x)), 'band', [1200, 5000]) * np.exp(-x / 0.06) * 0.55
    s += np.sin(2 * np.pi * 190 * x) * np.exp(-x / 0.04) * 0.4
    return sleepy(s, t0)


def rim(t0):
    d = 0.05; x = tt(d)
    return sleepy(np.sin(2 * np.pi * 1700 * x) * np.exp(-x / 0.01) + filt(rng.standard_normal(len(x)), 'high', 3000) * np.exp(-x / 0.004) * 0.4, t0)


def hat(t0):
    d = 0.05; x = tt(d)
    return sleepy(filt(rng.standard_normal(len(x)), 'high', 7000) * np.exp(-x / 0.012), t0)


def clap():
    d = 0.2; x = tt(d); e = np.exp(-x / 0.05) * 0.5
    for k in (0.0, 0.01, 0.02):
        i = int(k * SR); e[i:i + int(0.005 * SR)] += 1
    return filt(rng.standard_normal(len(x)), 'band', [900, 3800]) * e * 0.45


CHORDS = {
    'Fmaj7': (41, [57, 60, 64, 65]), 'Em7': (40, [55, 59, 62, 64]), 'Dm7': (38, [57, 60, 62, 65]),
    'G7': (43, [55, 59, 62, 65]), 'Cmaj7': (36, [55, 59, 60, 64]), 'Am7': (45, [55, 60, 64, 67]),
}
SLEEP_PROG = ['Fmaj7', 'Em7', 'Dm7', 'G7']
WAKE_PROG = ['Cmaj7', 'Am7', 'Dm7', 'G7']
MOTIF = [[(0, 72), (0.5, 74), (1, 76), (2.5, 79)], [(0, 76), (1, 74), (1.5, 72), (3, 71)],
         [(0, 74), (0.5, 77), (1, 81), (2, 79)], [(0, 79), (1.5, 77), (2, 74), (3, 71)]]

# ---------------- the sleepy beat (0 → 34 s) ----------------
t, step = 0.0, 0                          # step = 8th note index
while t < END['ask']:
    lv = level(t); beat = 60 / BPM[lv]
    bar, k8 = step // 8, step % 8
    root, chord = CHORDS[SLEEP_PROG[bar % 4]]
    swing = 0.09 * beat if k8 % 2 else 0.0
    ts = t + swing
    # drums thin out every level
    if k8 in (0, 5) and lv <= 4: add(kick(ts), ts, 0.6 if lv < 4 else 0.4)
    if lv == 5 and k8 in (0, 4): add(kick(ts), ts, 0.45)
    if k8 in (2, 6):
        if lv <= 2: add(snare(ts), ts, 0.4, verb=0.15)
        elif lv <= 4: add(rim(ts), ts, 0.25, pan=0.2)
    if lv <= 2 or (lv == 3 and k8 % 2 == 0): add(hat(ts), ts, 0.16 if k8 % 2 else 0.22, pan=0.35)
    # e-piano chord stabs: beat 1 and the "and" of 2
    if k8 in (0, 3):
        for j, n in enumerate(chord):
            add(epiano(n, beat * (2.5 if k8 == 0 else 1.5), ts, 0.9 if k8 == 0 else 0.6), ts + j * 0.012, 0.075, pan=-0.2 + j * 0.13, verb=0.25)
    # round bass
    if k8 in (0, 7) and lv >= 0:
        add(sleepy(bass(root, beat * (1.8 if k8 == 0 else 0.5), ts), ts), ts, 0.42)
    # playful kalimba, sparser every level
    keep = {0: 1, 1: 1, 2: 0.8, 3: 0.55, 4: 0.3, 5: 0.12}[lv]
    for off, n in MOTIF[bar % 4]:
        if abs(off * 2 - k8) < 1e-6 and rng.random() < keep:
            add(kalimba(n, ts), ts, 0.16, pan=0.3, verb=0.3)
    t += beat / 2; step += 1

# tape stop on "ada pertanyaan?": a pitch-dive of the current chord
x = tt(0.45)
dive = np.zeros_like(x)
for n in CHORDS['G7'][1]:
    f = midi(n) * 0.945 * (1 - 0.92 * (x / 0.45) ** 1.4)
    dive += np.sin(2 * np.pi * np.cumsum(f) / SR)
add(filt(dive * (1 - x / 0.45), 'low', 1500), END['ask'], 0.12)

# ---------------- awake (34.6 → 40 s) at 90 BPM, bright ----------------
beat = 60 / 90
t, step = END['wake'], 0
while t < DUR - 0.05:
    bar, k8 = step // 8, step % 8
    root, chord = CHORDS[WAKE_PROG[bar % 4]]
    swing = 0.09 * beat if k8 % 2 else 0.0
    ts = t + swing
    if k8 in (0, 5): add(kick(ts), ts, 0.65)
    if k8 in (2, 6): add(snare(ts), ts, 0.42); add(clap(), ts, 0.35, pan=0.15)
    add(hat(ts), ts, 0.18 if k8 % 2 else 0.24, pan=0.35)
    if k8 in (0, 3):
        for j, n in enumerate(chord):
            add(epiano(n, beat * 2, ts, 1.0), ts + j * 0.01, 0.08, pan=-0.2 + j * 0.13, verb=0.25)
    if k8 in (0, 7): add(bass(root, beat * (1.8 if k8 == 0 else 0.5), ts), ts, 0.45)
    for off, n in MOTIF[(bar + 1) % 4]:
        if abs(off * 2 - k8) < 1e-6: add(kalimba(n + 12, ts), ts, 0.16, pan=0.3, verb=0.3)
    t += beat / 2; step += 1
# final chord ring
for j, n in enumerate(CHORDS['Cmaj7'][1] + [67]):
    add(epiano(n, 2.0, 38.6, 1.0), 38.6 + j * 0.02, 0.07, pan=-0.2 + j * 0.1, verb=0.35)

# vinyl crackle + hiss, quieter once awake
crack = np.zeros(N)
idx = rng.integers(0, N, 2600)
crack[idx] = rng.uniform(-1, 1, len(idx))
crack = filt(crack, 'band', [1000, 7000]) * 0.9 + filt(rng.standard_normal(N), 'band', [2000, 8000]) * 0.03
add(crack, 0.0, 0.14, verb=0.0)

# =====================================================================
# SFX
def thud(f0=95):
    d = 0.5; x = tt(d)
    s = np.sin(2 * np.pi * np.cumsum(f0 * 0.7 + f0 * np.exp(-x / 0.04)) / SR) * np.exp(-x / 0.14) * 1.2
    wood = rng.standard_normal(len(x))
    s += (filt(wood, 'band', [220, 300]) * 3 + filt(wood, 'band', [560, 680]) * 2) * np.exp(-x / 0.07)
    s += filt(rng.standard_normal(len(x)), 'high', 2000) * np.exp(-x / 0.006) * 0.6
    return s


def slide(f0, f1, d, wav='sine'):
    x = tt(d); f = f0 * (f1 / f0) ** (x / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.2 * np.sin(2 * ph)
    return s * np.sin(np.pi * x / d) ** 0.4


def ting(note=88):
    d = 1.4; x = tt(d); f = midi(note); s = np.zeros_like(x)
    for m, a, dec in ((1, 1, 0.8), (2.0, 0.4, 0.4), (3.01, 0.2, 0.2), (4.2, 0.1, 0.1)):
        s += a * np.sin(2 * np.pi * f * m * x) * np.exp(-x / dec)
    return s * np.minimum(1, x / 0.001)


def wah(d=0.38, pitch=150, lv=1, rise=False):
    """One 'wah' syllable: buzzy voice through a formant that opens (w→a) and closes (h)."""
    x = tt(d)
    f = pitch * (1 + (0.18 if rise else -0.08) * x / d) * (1 + 0.01 * np.sin(2 * np.pi * 5.5 * x))
    ph = np.cumsum(f) / SR % 1.0
    src = 2 * ph - 1
    out = np.zeros_like(src); seg = 8
    for k in range(seg):
        c = (k + 0.5) / seg
        fc = 450 + 750 * np.sin(np.pi * min(1, c * 1.3)) ** 0.8          # w → a → h
        w = np.clip(1 - np.abs(x / d - c) * seg, 0, 1)
        out += (filt(src, 'band', [fc * 0.7, fc * 1.3]) + 0.5 * filt(src, 'band', [fc * 2.0, fc * 2.6])) * w
    env = np.sin(np.pi * np.clip(x / d, 0, 1)) ** 0.7
    return out * env


# hook: DUK on sample 0, then the jolt
add(thud(), TL['HOOK']['duk'], 1.1, verb=0.15)
add(epiano(53, 0.8, 0.0, 1.0), 0.0, 0.1)
add(slide(500, 1700, 0.2), TL['HOOK']['jolt'], 0.35)
add(filt(rng.standard_normal(int(0.25 * SR)), 'high', 4000) * np.exp(-tt(0.25) / 0.08), TL['HOOK']['jolt'], 0.25)
for k in range(2):
    add(slide(900, 700, 0.06), TL['HOOK']['look'] + 0.22 * k, 0.12, pan=-0.4 + 0.8 * k)

# level-up tings (brighter, then duller as he sinks)
for i, l0 in enumerate(TL['LEVELS']):
    add(ting(88 + (i % 2) * 3), l0, 0.38, pan=-0.5, verb=0.3)
    add(ting(95), l0 + 0.09, 0.16, pan=-0.5, verb=0.3)

# lecturer wah-wah, drifting away: quieter, darker and wetter every level
DIST = {1: (1.0, 4200, 0.15), 2: (0.78, 2600, 0.35), 3: (0.6, 1700, 0.55), 4: (0.45, 1100, 0.8), 5: (0.32, 750, 1.0)}
for w0, n in TL['WAH']:
    lv = level(w0); g, cut, verb = DIST[lv]
    for i in range(n):
        syl = wah(0.38, 150 - 4 * lv + (8 if i % 2 else 0), lv)
        add(filt(syl, 'low', cut), w0 + i * 0.42, 0.42 * g, pan=0.45, verb=verb)

# level 2: yawn
yawn = wah(1.1, 260, 2)
add(filt(yawn, 'low', 2400), TL['YAWN'], 0.3, verb=0.2)
# level 3: head flops ("terkulai") + jerk back up
for n in TL['NODS']:
    add(slide(330, 110, 0.28), n['flop'] - 0.12, 0.4)
    add(thud(70) * 0.5, n['flop'], 0.55)
    add(slide(300, 900, 0.12), n['up'], 0.22)
# level 5: snores (inhale rasp / exhale whistle)
t0 = TL['SNORE']['start']
while t0 < END['wake'] - 0.2:
    d = TL['SNORE']['period'] / 2
    x = tt(d)
    inhale = filt(rng.standard_normal(len(x)), 'band', [150, 900]) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 34 * x))) * np.sin(np.pi * x / d)
    exhale = filt(rng.standard_normal(len(x)), 'band', [1500, 4000]) * np.sin(np.pi * x / d) * 0.4 + slide(700, 500, d) * 0.15
    add(inhale, t0, 0.45); add(exhale, t0 + d, 0.32)
    t0 += TL['SNORE']['period']

# "ada pertanyaan?" — close, dry, rising (a-da per-ta-nya-an)
for i in range(6):
    add(wah(0.2 if i < 5 else 0.38, 165 + (40 if i == 5 else 0), 0, rise=(i == 5)), END['ask'] + i * 0.1, 0.55, pan=0.1, verb=0.08)
# everybody wakes
for when, big in ((END['wake'], 1.0), (END['gridWake'], 1.2)):
    stab = np.zeros(int(0.5 * SR))
    for n in (60, 64, 67, 72):
        stab += np.sin(2 * np.pi * midi(n) * tt(0.5)) * np.exp(-tt(0.5) / 0.15)
    add(stab, when, 0.18 * big, verb=0.2)
    add(thud(120), when, 0.6 * big)
    add(slide(450, 1800, 0.22), when + 0.02, 0.35 * big)
add(slide(1200, 2600, 0.05) * 0.5, END['wake'] + 0.05, 0.4)          # snot bubble pops
for k in range(5):                                                     # five little "huh?!"
    add(slide(380 + 60 * k, 1100 + 120 * k, 0.18), END['gridWake'] + 0.03 * k, 0.16, pan=-0.6 + 0.3 * k)
add(filt(rng.standard_normal(int(0.35 * SR)), 'band', [600, 4000]) * np.sin(np.pi * tt(0.35) / 0.35), END['grid'], 0.25)
add(ting(91), END['text'], 0.32, verb=0.3)
add(ting(96), END['text'] + 0.18, 0.2, verb=0.3)

# =====================================================================
# master
ir_len = int(1.8 * SR); xi = np.arange(ir_len) / SR
irL = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.5), 'low', 5000)
irR = filt(rng.standard_normal(ir_len) * np.exp(-xi / 0.5), 'low', 5000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
mix = np.stack([L + fftconvolve(VL, irL)[:N] * 0.6, R + fftconvolve(VR, irR)[:N] * 0.6], axis=1)
mix = filt(mix.T, 'high', 30).T
fo = int(0.45 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]        # no fade-in: the "duk" is on sample 0
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.8 / np.max(np.abs(mix))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'kantuk-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out)
