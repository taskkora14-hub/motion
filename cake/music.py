"""Original calm ASMR score + crisp ASMR SFX for "ini laptop asli atau kue?" (no voice-over).

    python3 cake/music.py   -> out/cake-music.wav

Music: felt piano, kalimba arpeggios, warm pad and sub, a barely-there beat (soft kick, shaker,
rim) at 80 BPM; every object = 2 bars (6 s) so each new object lands on a downbeat.
SFX (times mirror SEGS in cake/anim.js): knife piercing the fondant ("nyes"), the slow saw through
sponge with crumb crackle, a tap on the marble, the creamy pull as the halves part, crumbs pattering,
a soft ding on every "kue!", fabric swishes for the cloths. The hit + pierce land at 0.000 s.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(80)
L = np.zeros(N)
R = np.zeros(N)

SEGS = [  # id, t0, contact, bottom, lift, sep
    ('laptop', 0.0, 0.0, 2.4, (2.6, 3.3), (4.2, 5.0)),
    ('books', 10.0, 11.4, 12.9, (13.0, 13.5), (13.6, 14.4)),
    ('backpack', 16.0, 17.4, 18.9, (19.0, 19.5), (19.6, 20.4)),
    ('tumbler', 22.0, 23.4, 24.9, (25.0, 25.5), (25.6, 26.4)),
    ('pencil', 28.0, 29.4, 30.9, (31.0, 31.5), (31.6, 32.4)),
]
CLOTH = [35.0, 35.6, 36.2, 36.8, 37.4]


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    if i < 0:
        sig = sig[-i:]; i = 0
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def env(x, d, a=0.005, rel=0.05):
    return np.minimum(1, x / a) * np.clip((d - x) / rel, 0, 1)


def noise(d):
    return rng.standard_normal(len(tt(d)))


# ---------------- music voices ----------------
def felt_piano(notes, d, vel=1.0):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n)
        for h, a in ((1, 1), (2, 0.3), (3, 0.1)):
            s += a * np.sin(2 * np.pi * f * h * x) * np.exp(-x * (0.9 + h * 0.7))
    s = filt(s / len(notes), 'low', 1800)
    hammer = filt(noise(0.02), 'low', 900) * np.exp(-tt(0.02) / 0.004) * 0.15
    s[:len(hammer)] += hammer
    return s * vel * env(x, d, 0.008, 0.3)


def kalimba(n, d=1.2):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x * 25)) * np.exp(-x / 0.35) * np.minimum(1, x / 0.002)


def pad(notes, d, cut=1200):
    x = tt(d)
    s = sum(np.sin(2 * np.pi * midi(n) * (1 + det / 1200) * x + rng.uniform(0, 6)) for n in notes for det in (-7, 0, 7))
    s = filt(s / (3 * len(notes)), 'low', cut)
    return s * env(x, d, 1.2, 1.2) * (1 + 0.08 * np.sin(2 * np.pi * 0.2 * x))


def sub(n, d):
    x = tt(d)
    return np.sin(2 * np.pi * midi(n) * x) * env(x, d, 0.05, 0.3)


def soft_kick():
    x = tt(0.3); f = 45 + 50 * np.exp(-x / 0.04)
    return filt(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12), 'low', 400)


def shaker(v=1.0):
    x = tt(0.09)
    return filt(noise(0.09), 'band', [5000, 11000]) * np.sin(np.pi * x / 0.09) ** 2 * 0.3 * v


def rim():
    x = tt(0.06)
    return (np.sin(2 * np.pi * 1700 * x) * 0.5 + filt(noise(0.06), 'band', [1500, 4000]) * 0.4) * np.exp(-x / 0.012)


# ---------------- ASMR SFX ----------------
def pierce():
    """'nyes': the tip breaks the fondant skin and sinks into soft sponge"""
    d = 0.6; x = tt(d)
    crack = filt(noise(d), 'band', [2500, 9000]) * np.exp(-x / 0.012) * 0.9
    squish = filt(noise(d), 'band', [400, 2200]) * np.exp(-x / 0.12) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * x)) * 0.7
    body = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-x / 0.1) + 60) / SR) * np.exp(-x / 0.1) * 0.5
    return (crack + squish + body) * np.minimum(1, x / 0.001)


def slice_through(d, rate=1.6):
    """continuous blade-through-sponge hiss following the sawing motion, with crumb crackle"""
    x = tt(d)
    speed = np.abs(np.cos(2 * np.pi * rate * x))
    hiss = filt(noise(d), 'band', [1200, 7000]) * (0.25 + 0.75 * speed) * 0.5
    soft = filt(noise(d), 'band', [300, 1200]) * (0.3 + 0.7 * speed) * 0.4
    crackle = np.zeros_like(x)
    idx = rng.integers(0, len(x), int(d * 140))
    crackle[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.3, 1, len(idx))
    crackle = filt(crackle, 'band', [2500, 10000]) * 2.5
    return (hiss + soft + crackle) * env(x, d, 0.03, 0.15)


def tap():
    x = tt(0.15)
    return (np.sin(2 * np.pi * 2900 * x) * 0.4 + np.sin(2 * np.pi * 4700 * x) * 0.25 + filt(noise(0.15), 'high', 3000) * 0.3) * np.exp(-x / 0.02)


def cream_pull(d=0.6):
    """sticky, creamy release: low wet smack with a rising sticky squelch"""
    x = tt(d)
    f = 180 + 500 * (x / d) ** 2
    wet = filt(noise(d), 'band', [250, 1500]) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(14 + 30 * x / d) / SR)) * 0.8
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15
    pops = np.zeros_like(x); idx = rng.integers(0, len(x), 12); pops[idx] = 1
    pops = filt(pops, 'band', [600, 2500]) * 6
    return (wet + tone + pops) * np.sin(np.pi * x / d) ** 0.7


def crumbs_patter(d=1.2):
    x = tt(d); s = np.zeros_like(x)
    idx = np.sort(rng.integers(0, len(x), 40)); dens = np.exp(-x[idx] / 0.5)
    for i, a in zip(idx, dens):
        g = filt(noise(0.012), 'band', [3000, 11000]) * np.exp(-tt(0.012) / 0.002) * a * rng.uniform(0.4, 1)
        s[i:i + len(g)] += g[: len(s) - i]
    return s * 1.6


def ding(n=88):
    x = tt(1.0); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 2.01 * x) * np.exp(-x * 6)) * np.exp(-x / 0.35)


def air_whoosh(d=0.5):
    x = tt(d); n = noise(d); out = np.zeros_like(x); k = 6
    for i in range(k):
        c = (i + 0.5) / k; f = 500 * (12 ** c)
        out += filt(n, 'band', [f * 0.7, min(f * 1.4, 18000)]) * np.clip(1 - np.abs(x / d - c) * k / 1.6, 0, 1)
    return out * np.sin(np.pi * x / d) ** 2 * 0.5


def cloth_flump():
    d = 0.7; x = tt(d)
    swish = filt(noise(d), 'band', [500, 4000]) * np.sin(np.pi * np.clip(x / 0.45, 0, 1)) ** 2 * 0.5
    thud = filt(noise(d), 'low', 300) * np.exp(-np.maximum(0, x - 0.45) / 0.06) * (x > 0.45) * 1.2
    return swish + thud


def hit0():
    d = 0.9; x = tt(d)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(36 + 70 * np.exp(-x / 0.06)) / SR) * np.exp(-x / 0.3) * 1.4) * 0.8


# ---------------- music ----------------
BEAT = 0.75                         # 80 BPM
ORIGIN = -2.0                       # so 4.0, 10.0, 16.0 ... are bar downbeats
CH = [([48, 55, 62, 64, 67], 36), ([45, 52, 59, 60, 64], 33), ([41, 48, 55, 57, 64], 29), ([43, 50, 57, 59, 62], 31)]   # Cmaj9 Am9 Fmaj9 G6/9
KAL = [76, 79, 74, 72, 76, 81, 79, 74]
nb = int((DUR - ORIGIN) / BEAT)
for b in range(nb):
    t = ORIGIN + b * BEAT
    bar = b // 4; beat = b % 4
    if t > 39.2:
        break
    notes, root = CH[bar % 4]
    if t + BEAT <= 0:
        continue
    if beat == 0:
        add(pad(notes, 4 * BEAT + 0.8, 1100), t, 0.18)
        add(felt_piano(notes[1:], 2.6, 0.9), t + 0.02, 0.2, pan=-0.1)
        add(sub(root, 4 * BEAT * 0.95), t, 0.22)
    if beat == 2:
        add(felt_piano(notes[2:], 1.6, 0.6), t + 0.05, 0.12, pan=0.1)
    # kalimba eighth-note arpeggio (sparse)
    for e in range(2):
        k = (b * 2 + e) % 8
        if (b * 2 + e) % 3 != 2:
            add(kalimba(KAL[k] + (0 if bar % 4 != 2 else -3), 1.0), t + e * BEAT / 2, 0.07, pan=0.3 if e else -0.3)
    # barely-there beat (not under the hook's first bar, not under the finale's last notes)
    if 0.5 < t < 38.5:
        if beat in (0, 2):
            add(soft_kick(), t, 0.35)
        if beat == 2:
            add(rim(), t, 0.05, pan=0.2)
        add(shaker(1.0), t, 0.18, pan=0.4); add(shaker(0.6), t + BEAT / 2, 0.18, pan=0.4)
# final resolving chord
add(pad([48, 55, 60, 64, 67, 71], 4.0, 1300), 37.0, 0.22)
add(felt_piano([60, 64, 67, 71, 74], 3.0), 37.0, 0.2)
add(kalimba(84, 1.6), 38.5, 0.1)

# ---------------- SFX ----------------
add(hit0(), 0.0, 0.6)
for sid, t0, contact, bottom, lift, sep in SEGS:
    add(pierce(), contact, 0.7)
    add(slice_through(bottom - contact), contact + 0.04, 0.55)
    add(tap(), bottom, 0.35)
    add(cream_pull(0.5), lift[0], 0.45)
    add(cream_pull(0.8), sep[0], 0.6, pan=0.2)
    add(crumbs_patter(1.2), sep[0] + 0.3, 0.45, pan=0.15)
    add(ding(88), sep[0] + 0.25, 0.08, pan=0.25)
    if t0 > 0:
        add(air_whoosh(0.45), t0 - 0.2, 0.25)
        add(ding(81) * 0.6, t0 + 0.15, 0.05)            # "kue atau bukan?" appears
add(air_whoosh(0.5), 33.8, 0.25)
add(ding(84) * 0.6, 34.2, 0.05)
for c in CLOTH:
    add(cloth_flump(), c, 0.5, pan=-0.2 + 0.1 * CLOTH.index(c))

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.037, 0.16), (0.061, 0.12), (0.097, 0.09), (0.149, 0.06), (0.223, 0.04)):   # soft room
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 4500) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 4500) * g
mix = sosfilt(butter(2, 25, btype='high', fs=SR, output='sos'), mix, axis=0)
fi = int(0.001 * SR); fo = int(0.5 * SR)              # no fade-in: the hit is at 0.000 s
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/cake-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/cake-music.wav', f'{len(mix) / SR:.3f}s')
