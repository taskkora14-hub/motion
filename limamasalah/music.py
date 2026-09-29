"""Soundtrack for "1 task, 5 masalah" (no voice-over).

    python3 limamasalah/music.py   -> out/limamasalah-music.wav

Plucky electronic track at 120 BPM (1 beat = 0.5 s, 1 bar = 2 s) in D minor -> F major.
Every event in limamasalah/anim.js sits on this grid: sparse hook, a groove that tightens as the
five problems land in the tray, a distorted chaos section that collapses at 40 s, then a clean
major-key resolution with one marimba note per checked item.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(15)
L = np.zeros(N)
R = np.zeros(N)
BEAT = 0.5


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


def env(x, d, a=0.004, r=0.05):
    return np.minimum(1, x / a) * np.clip((d - x) / r, 0, 1)


# ---------------- instruments ----------------
def pluck(n, d=0.45, bright=1.0):
    """additive plucked string: upper harmonics die faster"""
    x = tt(d); f = midi(n); s = np.zeros_like(x)
    for h in range(1, 9):
        s += np.sin(2 * np.pi * f * h * x) / h ** 1.2 * np.exp(-x * (4 + h * 5 / bright))
    return s * env(x, d, 0.002, 0.03) * 0.6


def supersaw(notes, d, cut=2200):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.12, 0.0, 0.12):
            ph = (midi(n) * (1 + det / 100) * x + rng.uniform()) % 1
            s += 2 * ph - 1
    s = filt(s / (3 * len(notes)), 'low', cut)
    return s * np.minimum(1, x / 0.15) * np.clip((d - x) / 0.3, 0, 1)


def sub(n, d, drive=1.0):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x)
    s = np.tanh(s * drive) / np.tanh(drive)
    return s * env(x, d, 0.005, 0.04) * np.exp(-x / 0.8)


def kick(g=1.0):
    x = tt(0.35); f = 45 + 110 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.14) * g


def clap():
    x = tt(0.25); n = filt(rng.standard_normal(len(x)), 'band', [900, 5000])
    e = sum(np.exp(-np.maximum(0, x - k * 0.011) / 0.008) * (x >= k * 0.011) for k in range(3)) + np.exp(-x / 0.07) * 0.6
    return n * e * 0.5


def hat(open_=False):
    d = 0.18 if open_ else 0.05; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 8000) * np.exp(-x / (0.06 if open_ else 0.012)) * 0.35


def rim():
    x = tt(0.06)
    return (np.sin(2 * np.pi * 1700 * x) + filt(rng.standard_normal(len(x)), 'band', [2000, 6000]) * 0.5) * np.exp(-x / 0.012) * 0.4


def whoosh(d=0.5, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 300 * (25 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.6


def pop(f=700):
    x = tt(0.1); ff = f * (1 + 0.8 * np.exp(-x / 0.012))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.03)


def ping(n):
    """notification ping"""
    x = tt(0.35)
    return (np.sin(2 * np.pi * midi(n) * x) + 0.5 * np.sin(2 * np.pi * midi(n + 7) * x) * (x > 0.07)) * np.exp(-x / 0.1) * np.minimum(1, x / 0.002)


def marimba(n, d=0.9):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x * 30)) * np.exp(-x / 0.3) * np.minimum(1, x / 0.001)


def boing(f=300, d=0.3):
    x = tt(d); ff = f * (1 + 0.25 * np.sin(2 * np.pi * 14 * x) * np.exp(-x / 0.15)) * (1 + 0.6 * x / d)
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.1)


def buzz(d=0.3):
    """error buzzer"""
    x = tt(d); s = np.sign(np.sin(2 * np.pi * 110 * x)) + np.sign(np.sin(2 * np.pi * 116.5 * x))
    return filt(s, 'low', 1800) * env(x, d, 0.005, 0.05) * 0.3


def key_click():
    x = tt(0.03)
    return filt(rng.standard_normal(len(x)), 'band', [2500, 7000]) * np.exp(-x / 0.004) * 0.6


def thud():
    x = tt(0.15); f = 120 + 90 * np.exp(-x / 0.02)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + filt(rng.standard_normal(len(x)), 'low', 1500) * 0.5) * np.exp(-x / 0.04)


def scribble(d=0.3):
    x = tt(d); n = filt(rng.standard_normal(len(x)), 'band', [1500, 5000])
    return n * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 11 * x))) * env(x, d, 0.01, 0.05) * 0.5


def clock_tick(hi=True):
    x = tt(0.04)
    return np.sin(2 * np.pi * (2400 if hi else 1800) * x) * np.exp(-x / 0.006)


def alarm(d=0.22):
    x = tt(d)
    return np.sign(np.sin(2 * np.pi * 1320 * x)) * env(x, d, 0.004, 0.03) * 0.18


def impact(g=1.0):
    x = tt(1.0); f = 38 + 80 * np.exp(-x / 0.05)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.35) + filt(rng.standard_normal(len(x)), 'low', 1600) * np.exp(-x / 0.05) * 0.4) * g


def sad_wah(d=0.9):
    x = tt(d); f = midi(64) * 2 ** (-5 * (x / d) / 12)
    ph = (np.cumsum(f) / SR) % 1
    s = filt(2 * ph - 1, 'low', 1400) * (0.8 + 0.2 * np.sin(2 * np.pi * 6 * x))
    return s * env(x, d, 0.02, 0.2) * 0.5


def riser(d, lo=400, hi=8000):
    x = tt(d) / d; n = rng.standard_normal(len(x)); out = np.zeros_like(n)
    for k in range(10):
        c = (k + 0.5) / 10; f = lo * (hi / lo) ** c
        out += filt(n, 'band', [f * 0.8, min(f * 1.3, 18000)]) * np.clip(1 - np.abs(x - c) * 10, 0, 1)
    return out * x ** 2


def glitch(d=0.35):
    """stuttered noise + bitcrushed sine"""
    x = tt(d); g = (np.floor(x * 32) % 2)
    s = np.sign(np.sin(2 * np.pi * 220 * np.floor(x * 4000) / 4000 * (1 + 3 * (np.floor(x * 16) % 3))))
    return (s * 0.3 + rng.standard_normal(len(x)) * 0.3) * g * env(x, d, 0.002, 0.03)


def shimmer(notes, d=2.0):
    x = tt(d); s = np.zeros_like(x)
    for k, n in enumerate(notes):
        s += np.sin(2 * np.pi * midi(n) * x + k) * np.exp(-x / (0.6 + 0.1 * k))
    return s / len(notes) * np.minimum(1, x / 0.01)


# chords (root, voicing)
DM = [(38, [62, 65, 69]), (34, [62, 65, 70]), (41, [60, 65, 69]), (36, [60, 64, 67])]   # Dm Bb F C
FM = [(41, [65, 69, 72, 76]), (36, [64, 67, 72, 74]), (38, [65, 69, 72, 74]), (34, [65, 70, 74, 77])]   # Fmaj7 Cadd9 Dm7 Bbmaj7


def groove(t0, t1, prog, level, bar0=0):
    """level 0 = sparse, 1 = full, 2 = chaos"""
    t = t0; bar = bar0
    while t < t1 - 1e-6:
        root, v = prog[bar % 4]
        for k in range(4):
            tk = t + k * BEAT
            if level >= 1 or k in (0, 2):
                add(kick(0.9 if level < 2 else 1.1), tk, 0.55)
            if level >= 1 and k in (1, 3):
                add(clap(), tk, 0.35 if level < 2 else 0.45)
            if level == 0 and k in (1, 3):
                add(rim(), tk, 0.5, pan=0.2)
            steps = 4 if level >= 2 else 2
            for e in range(steps):
                add(hat(open_=(level == 1 and e == 1 and k == 3)), tk + e * BEAT / steps, 0.55 if e else 0.35, pan=0.35)
            # bass: off-beat pump
            if level >= 1:
                add(sub(root + 12, BEAT * 0.45, drive=1.0 if level < 2 else 4.0), tk + BEAT / 2, 0.45 if level < 2 else 0.5)
                add(sub(root, BEAT * 0.3, drive=1.0 if level < 2 else 3.0), tk, 0.3)
            # pluck arpeggio on 8ths
            arp = v + [v[1] + 12]
            for e in range(2):
                n = arp[(k * 2 + e) % len(arp)] + 12
                add(pluck(n, 0.35, bright=0.8 if level < 2 else 1.6), tk + e * BEAT / 2, 0.16 if level < 2 else 0.12, pan=-0.3 + 0.6 * e)
        add(supersaw(v, 2.0, cut=1500 if level < 2 else 3500), t, 0.1 if level < 2 else 0.14)
        t += 2.0; bar += 1


# ---------------- 0–5 hook ----------------
add(impact(0.9), 0.2, 0.6)
add(pluck(62, 0.8), 0.2, 0.3); add(pluck(69, 0.8), 0.2, 0.2)
add(pop(900), 0.55, 0.4)
for i in range(5):
    tk = 2.0 + i * 0.25
    add(ping(76 + [0, 2, 3, 5, 7][i]), tk, 0.22, pan=-0.5 + i * 0.25)
    add(thud(), tk, 0.25)
add(impact(0.8), 3.0, 0.55)
add(supersaw([62, 65, 69], 1.6, cut=1200), 3.0, 0.12)
add(sad_wah(), 3.55, 0.6)
add(whoosh(0.45), 4.5, 0.4)

# ---------------- 5–12 "bisa bikin pusing" ----------------
groove(5.0, 11.0, DM, 0, bar0=0)
for tk in (5.1, 5.5, 6.6):
    add(pop(600), tk, 0.25)
add(pop(750), 6.0, 0.3)                                   # ring appears
x = tt(4.2); f = 220 * 2 ** (x / 4.2 * 1.6)                 # load rising
add(np.sin(2 * np.pi * np.cumsum(f) / SR) * (x / 4.2) ** 1.5 * 0.2 * env(x, 4.2, 0.2, 0.3), 6.5, 0.6)
for i in range(5):
    add(pop(500 + i * 90), 7.4 + i * 0.3, 0.3, pan=-0.4 + i * 0.2)
add(riser(1.0, 600, 9000), 10.0, 0.35)
add(whoosh(0.7, up=False), 10.9, 0.4)
for i in range(5):
    add(rim(), 11.6 + i * 0.08, 0.4)

# ---------------- 12–32 five problems ----------------
groove(12.0, 32.0, DM, 1, bar0=0)
for i in range(5):
    s = 12 + i * 4
    add(whoosh(0.4), s - 0.3, 0.35)
    add(impact(0.5), s, 0.35)
    if i == 0:   # desain: wobbly elements
        for k in range(5):
            add(boing(260 + k * 60), s + 0.3 + k * 0.18, 0.18, pan=-0.4 + k * 0.2)
        for k in range(9):
            add(pop(900 + k * 60), s + 0.45 + k * 0.08, 0.1)
        add(buzz(), s + 1.4, 0.35)
    if i == 1:   # data: typing + errors
        for k in range(35):
            add(key_click(), s + 0.15 + k * 0.045, 0.35, pan=rng.uniform(-0.3, 0.3))
        add(buzz(0.4), s + 2.0, 0.35)
    if i == 2:   # file: files dropping
        for j in range(14):
            add(thud(), s + 0.1 + j * 0.16 + 0.3, 0.3, pan=rng.uniform(-0.5, 0.5))
        add(ping(71), s + 1.9, 0.18)
    if i == 3:   # revisi: comments + red pen
        for j in range(4):
            add(ping(79 - j), s + 0.35 + j * 0.45, 0.2, pan=0.4)
        for a in (0.45, 0.85, 1.25, 1.65):
            add(scribble(0.3), s + a, 0.3, pan=-0.3)
        add(buzz(), s + 1.2, 0.3)
    if i == 4:   # deadline: clock ticking faster, alarm
        tk = s
        while tk < s + 3.8:
            add(clock_tick(int((tk - s) * 4) % 2 == 0), tk, 0.35)
            tk += 0.25 if tk < s + 1.5 else 0.125
        for k in range(5):
            add(alarm(), s + 1.5 + k * 0.5, 1.0)
    add(whoosh(0.5, up=False), s + 3.25, 0.3)
    add(thud(), s + 3.85, 0.5)
    add(marimba([57, 58, 60, 62, 63][i], 0.6), s + 3.85, 0.25)   # ominous: climbing semitones

# ---------------- 32–40 chaos ----------------
groove(32.0, 39.0, DM, 2, bar0=0)
add(impact(1.2), 32.0, 0.6)
add(glitch(0.4), 32.2, 0.6)
for k in range(40):
    tk = 33.0 + k * (0.25 - k * 0.003)
    if tk > 39.2:
        break
    add(ping(72 + (k * 5) % 12), tk, 0.14, pan=rng.uniform(-0.7, 0.7))
for k in range(14):                                      # dissonant stabs on each beat
    add(supersaw([61, 62, 68], 0.25, cut=3000), 32.0 + k * 0.5, 0.12)
for k in range(12):
    add(alarm(0.12), 35.0 + k * 0.33, 0.8, pan=0.5)
add(glitch(0.6), 36.0, 0.6)
add(impact(0.9), 36.0, 0.45)
add(riser(3.0, 300, 12000), 36.9, 0.55)
# reverse suck into the knot
x = tt(0.95); rev = filt(rng.standard_normal(len(x)), 'band', [500, 9000]) * (x / 0.95) ** 3
add(rev, 39.0, 0.6)
add(sub(26, 0.9, drive=5.0) * np.linspace(0, 1, int(0.9 * SR)), 39.0, 0.4)

# ---------------- 40–52 structure ----------------
add(impact(0.8), 40.0, 0.4)
add(shimmer([77, 81, 84, 88, 91], 2.5), 40.0, 0.35)
add(supersaw([65, 69, 72, 76], 2.0, cut=2500), 40.0, 0.1)
for i in range(5):
    add(pop(700 + i * 110), 41.0 + i * 0.09, 0.28, pan=-0.4 + i * 0.2)
add(whoosh(0.4), 42.5, 0.25)
groove(42.0, 52.0, FM, 1, bar0=0)
for i, n in enumerate([77, 81, 84, 86, 89]):              # one marimba note per checked item
    tc = 44 + i * 1.5
    add(marimba(n), tc, 0.4)
    add(marimba(n + 12, 0.5), tc + 0.06, 0.12)
    add(pop(1100), tc, 0.18)
add(shimmer([77, 81, 84, 89], 1.6), 50.35, 0.3)

# ---------------- 52–60 takeaway + CTA ----------------
add(whoosh(0.4, up=False), 51.6, 0.3)
groove(52.0, 58.0, FM, 0, bar0=0)
add(thud(), 52.2, 0.6)
for i in range(5):
    add(pop(600 + i * 120), 53.5 + i * 0.05, 0.3, pan=-0.5 + i * 0.25)
add(shimmer([72, 76, 79], 1.2), 53.6, 0.2)
add(whoosh(0.4), 55.6, 0.3)
for i in range(5):
    add(marimba([65, 69, 72, 74, 77][i], 0.5), 56.8 + i * 0.25, 0.25)
add(whoosh(0.4), 58.1, 0.3)
add(supersaw([65, 69, 72, 76], 1.8, cut=1800), 58.35, 0.12)
add(sub(29, 1.6), 58.35, 0.4)
add(kick(), 58.35, 0.5)
add(rim(), 59.3, 0.6)
add(shimmer([81, 84, 88], 0.8), 59.4, 0.3)
add(pluck(77, 0.6), 59.4, 0.2)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
for dly, g in ((0.029, 0.1), (0.057, 0.07), (0.089, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
fade = np.ones(N); fi = int(0.03 * SR); fo = int(0.5 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/limamasalah-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/limamasalah-music.wav')
