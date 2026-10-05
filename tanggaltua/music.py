"""Original jazzy, silly score + SFX for "menu mahasiswa tanggal tua." (no voice-over).

    python3 tanggaltua/music.py   -> out/tanggaltua-music.wav

Relaxed jazz trio (walking upright bass, brushes, piano, a cheeky clarinet) that slows down and
turns blue day by day, each day = one calendar page in tanggaltua/anim.js:
  25 & 26  F major, 8 beats @ 0.70 s (86 BPM)
  27       D minor, 7 beats @ 0.80 s
  28       D minor, half-time, 6 beats @ 0.93 s
  29       solo piano + bass, 5 beats @ 1.12 s, ritardando, a silly "spiritual" choir pad
  30       transfer ting + coin, then a bright 140 BPM swing (stride piano, clarinet) to the end.
SFX: calendar page "sret" on every tear (hit + tear at 0.000 s), spoon clinks on the plate,
pops as food appears, kecap pour, ghost "wooo" for the imaginary side dish.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(25)
L = np.zeros(N)
R = np.zeros(N)

DAYS = [(25, 0.0), (26, 9.6), (27, 15.2), (28, 20.8), (29, 26.4), (30, 32.0)]
CLINKS = [2.4, 6.1, 7.6, 11.9, 13.4, 17.6, 19.1, 23.3, 24.6, 28.3, 28.75, 29.2, 35.0, 35.43, 35.86, 36.29, 37.15, 38.0]
MENU = {25: ['nasi', 'telur', 'sayur', 'tempe', 'sambal', 'kerupuk'], 26: ['nasi', 'kecap'], 27: ['mie'],
        28: ['nasiS', 'ghost'], 29: ['mug'], 30: ['nasi', 'ayam', 'telur', 'sayur', 'tempe', 'sambal', 'kerupuk']}


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
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


# ---------------- instruments ----------------
def upright(n, d):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x) * np.exp(-x / 0.1) + 0.15 * np.sin(6 * np.pi * f * x) * np.exp(-x / 0.05)
    thump = filt(noise(0.03), 'low', 400) * np.exp(-tt(0.03) / 0.008) * 0.4
    s[:len(thump)] += thump
    return s * np.exp(-x / 0.45) * env(x, d, 0.004, 0.06)


def piano(notes, d, vel=1.0, bright=1.0):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n)
        for h, a in ((1, 1), (2, 0.45 * bright), (3, 0.2 * bright), (4, 0.08 * bright)):
            s += a * np.sin(2 * np.pi * f * h * (1 + 0.0004 * h) * x) * np.exp(-x * (1.2 + h * 0.8))
    return s / max(1, len(notes)) * vel * env(x, d, 0.003, 0.1)


def brush_sweep(d):
    x = tt(d)
    return filt(noise(d), 'band', [1500, 7000]) * (0.4 + 0.6 * np.sin(np.pi * x / d)) * 0.25


def brush_tap():
    x = tt(0.16)
    return filt(noise(0.16), 'band', [1200, 6000]) * np.exp(-x / 0.04) * 0.6


def ride(v=1.0):
    d = 0.6; x = tt(d)
    s = sum(np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) for f in (3150, 4220, 5340, 6870)) / 4
    return (s * 0.5 + filt(noise(d), 'high', 6000) * 0.4) * np.exp(-x / 0.22) * 0.45 * v


def clarinet(n, d, vib=0.006):
    x = tt(d); f = midi(n) * (1 + vib * np.sin(2 * np.pi * 5 * x) * np.clip((x - 0.1) / 0.2, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.35 * np.sin(3 * ph) + 0.15 * np.sin(5 * ph) + 0.06 * np.sin(7 * ph)
    s += filt(noise(d), 'band', [1500, 4000]) * 0.03
    return filt(s, 'low', 3500) * env(x, d, 0.03, 0.08)


def choir(notes, d):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-5, 0, 5):
            f = midi(n) * 2 ** (det / 1200) * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * x + det))
            ph = 2 * np.pi * np.cumsum(f) / SR
            s += np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
    s = filt(s / (3 * len(notes)), 'band', [300, 2800])      # "aah" formant-ish
    return s * env(x, d, 0.6, 0.8)


# ---------------- SFX ----------------
def hit0():
    d = 0.8; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-x / 0.06)) / SR) * np.exp(-x / 0.3)
    return np.tanh(sub * 1.4) + filt(noise(d), 'low', 2500) * np.exp(-x / 0.04) * 0.4


def sret(d=0.4):
    """calendar page tear: crackly paper rip with a rising edge"""
    x = tt(d)
    grit = (rng.random(len(x)) > 0.55).astype(float)
    grit = filt(grit, 'low', 600) * 2
    n = filt(noise(d), 'band', [1800, 9000]) * grit
    sweep = filt(noise(d), 'band', [800, 3000]) * 0.4
    e = np.minimum(1, x / 0.015) * np.clip((d - x) / 0.08, 0, 1) * (0.6 + 0.4 * x / d)
    return (n + sweep) * e * 1.4


def clink(k=0):
    d = 0.7; x = tt(d)
    fs = [2380 + 60 * (k % 3), 3910, 6120, 8240]
    s = sum(np.sin(2 * np.pi * f * x) * np.exp(-x / (0.25 / (j + 1))) / (j + 1) for j, f in enumerate(fs))
    tick = filt(noise(0.01), 'high', 4000) * np.exp(-tt(0.01) / 0.002)
    s[:len(tick)] += tick
    return s * 0.6


def pop(f=700):
    x = tt(0.12)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.4 * np.exp(-x / 0.015))) / SR) * np.exp(-x / 0.035)


def pour(d):
    x = tt(d)
    glug = (np.sin(2 * np.pi * 7 * x) > 0.3).astype(float)
    return filt(noise(d), 'band', [300, 1400]) * filt(glug, 'low', 40) * 0.8 * env(x, d, 0.05, 0.1) + np.sin(2 * np.pi * (300 + 200 * np.sin(2 * np.pi * 7 * x)) * x) * 0.1 * env(x, d, 0.05, 0.1)


def ghost_wooo(d=1.4):
    x = tt(d); f = 520 + 160 * np.sin(2 * np.pi * 0.9 * x) + 12 * np.sin(2 * np.pi * 6 * x)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(x, d, 0.2, 0.4) * 0.6


def notif_ting():
    out = np.zeros(int(0.8 * SR))
    for k, f in enumerate((1568, 2093)):
        x = tt(0.5); s = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 2 * x)) * np.exp(-x / 0.15)
        i = int(k * 0.1 * SR); out[i:i + len(s)] += s
    return out * 0.6


def coin():
    out = np.zeros(int(0.9 * SR))
    for k in range(5):
        x = tt(0.4); f = 2600 + k * 300
        s = sum(np.sin(2 * np.pi * f * m * x) / m for m in (1, 2.7, 4.1)) * np.exp(-x / 0.12)
        i = int(k * 0.05 * SR); out[i:i + len(s)] += s
    return out * 0.35


def whoosh(d=0.5):
    x = tt(d); n = noise(d); out = np.zeros_like(x); k = 8
    for i in range(k):
        c = (i + 0.5) / k; f = 300 * (25 ** c)
        out += filt(n, 'band', [f * 0.7, min(f * 1.4, 19000)]) * np.clip(1 - np.abs(x / d - c) * k / 1.6, 0, 1)
    return out * np.sin(np.pi * x / d) ** 1.5


def sparkle():
    out = np.zeros(int(1.4 * SR))
    for k, n in enumerate((84, 88, 91, 96, 100, 103)):
        x = tt(0.6); s = np.sin(2 * np.pi * midi(n) * x) * np.exp(-x / 0.2)
        i = int(k * 0.06 * SR); out[i:i + len(s)] += s
    return out * 0.3


# ---------------- arrangement: days 25–29 ----------------
# hook pickup: walking bass + brushes leading into the 25th's downbeat at 4.0
for k, t in enumerate((0.5, 1.2, 1.9, 2.6, 3.3)):
    add(upright([41, 43, 45, 46, 48][k], 0.66), t, 0.6)
    add(brush_tap(), t, 0.25 if k % 2 else 0.15, pan=-0.2)
add(piano([65, 69, 72, 76], 1.2, 0.9), 0.5, 0.22, pan=-0.15)
add(clarinet(72, 0.3), 2.6, 0.12, pan=0.2); add(clarinet(74, 0.3), 2.95, 0.12, pan=0.2); add(clarinet(76, 0.6), 3.3, 0.14, pan=0.2)

# each segment: (start, beats, beat length, chords [(root, notes)] one per 2 beats, mood)
SEG = [
    (4.0, 8, 0.70, [(41, [64, 69, 72, 76]), (38, [65, 69, 72, 77]), (43, [65, 70, 74, 77]), (36, [64, 67, 70, 74])], 'bright'),
    (9.6, 8, 0.70, [(41, [64, 69, 72, 76]), (38, [65, 69, 72, 77]), (43, [65, 70, 74, 77]), (36, [64, 67, 70, 74])], 'bright'),
    (15.2, 7, 0.80, [(38, [65, 69, 72, 76]), (43, [65, 70, 74, 77]), (40, [62, 65, 67, 70]), (45, [61, 64, 67, 70])], 'minor'),
    (20.8, 6, 0.933, [(38, [62, 65, 69, 72]), (34, [62, 65, 69, 74]), (45, [61, 64, 67, 70])], 'halftime'),
    (26.4, 5, 1.12, [(38, [62, 65, 69, 76]), (34, [62, 65, 70, 74]), (38, [62, 65, 69, 74])], 'solo'),
]
MEL_BRIGHT = [77, 76, 74, 72, 74, 76, 72, 69]       # cheeky clarinet line (one note per beat)
MEL_MINOR = [74, 72, 70, 69, 70, 65, 69]
for si, (s0, nb, bl, chords, mood) in enumerate(SEG):
    for b in range(nb):
        tb = s0 + b * bl
        root, ch = chords[min(len(chords) - 1, b // 2)]
        sw = bl * 0.16                                       # swing the off-beat
        # walking bass
        if mood == 'halftime':
            if b % 2 == 0:
                add(upright(root, bl * 1.9), tb, 0.55)
        elif mood == 'solo':
            if b in (0, 2, 4):
                add(upright(root, bl * 1.8), tb, 0.45)
        else:
            walk = [root, root + 2, root + 4, root + 5, root + 7, root + 5, root + 4, root + 2][b % 8]
            add(upright(walk, bl * 0.95), tb, 0.6)
        # brushes + ride
        if mood in ('bright', 'minor'):
            add(brush_sweep(bl * 0.9), tb, 0.6, pan=-0.25)
            if b % 2 == 1:
                add(brush_tap(), tb, 0.35, pan=-0.25)
            add(ride(0.8), tb, 0.12, pan=0.35)
            add(ride(0.5), tb + bl / 2 + sw, 0.08, pan=0.35)
        elif mood == 'halftime':
            if b % 2 == 0:
                add(brush_sweep(bl * 1.8), tb, 0.35, pan=-0.25)
            else:
                add(brush_tap(), tb, 0.2, pan=-0.25)
        # piano comping
        if mood == 'bright':
            if b % 2 == 1:
                add(piano(ch, bl * 0.6, 0.9), tb + bl / 2 + sw, 0.2, pan=-0.15)
            if b % 2 == 0:
                add(piano(ch, bl * 0.9, 0.7), tb, 0.14, pan=-0.15)
        elif mood == 'minor':
            if b % 2 == 0:
                add(piano(ch, bl * 1.8, 0.7, 0.7), tb, 0.2, pan=-0.15)
        elif mood == 'halftime':
            if b % 2 == 0:
                add(piano(ch, bl * 1.9, 0.6, 0.5), tb, 0.22, pan=-0.1)
        else:  # solo: slow, spread chords, ritardando at the very end
            if b % 2 == 0:
                for j, n in enumerate(ch):
                    add(piano([n], 2.2, 0.6, 0.4), tb + j * 0.09, 0.2, pan=-0.2 + j * 0.12)
        # melody
        if mood == 'bright':
            n = MEL_BRIGHT[b % 8] - (2 if si == 1 and b >= 4 else 0)
            if b in (0, 1, 2, 4, 5, 6):
                add(clarinet(n, bl * (0.45 if b % 2 else 0.85)), tb + (sw if b % 2 else 0), 0.12, pan=0.2)
        elif mood == 'minor':
            add(clarinet(MEL_MINOR[b % 7], bl * 0.9, 0.004), tb, 0.08, pan=0.2)
        elif mood == 'halftime' and b % 2 == 0:
            add(piano([MEL_MINOR[b % 7] + 12], bl * 1.8, 0.5, 0.6), tb + bl * 0.5, 0.12, pan=0.2)
# 29th: last lonely notes + the silly "spiritual" choir
add(choir([62, 65, 69, 74], 4.6), 27.0, 0.14)
add(piano([86], 1.6, 0.5, 0.3), 29.6, 0.12, pan=0.3)
add(piano([81], 1.6, 0.5, 0.3), 30.4, 0.1, pan=0.3)
add(piano([50, 57, 62, 65, 69], 2.0, 0.4, 0.3), 31.0, 0.18)       # fermata, fading under the tear

# ---------------- the 30th: bright 140 BPM swing ----------------
HB = 60 / 140
s0 = 32.0 + HB                                                  # kicks in one beat after the tear
HAPPY = [(41, [65, 69, 72, 76]), (38, [65, 69, 72, 74]), (43, [65, 70, 74, 77]), (36, [64, 67, 70, 76])]
HMEL = [(0, 72, 1), (1, 76, 1), (2, 79, 1.5), (3.5, 77, 0.5), (4, 76, 1), (5, 74, 1), (6, 72, 2),
        (8, 74, 1), (9, 77, 1), (10, 81, 1.5), (11.5, 79, 0.5), (12, 77, 1), (13, 76, 0.5), (13.5, 74, 0.5), (14, 72, 2)]
nbeats = int((39.4 - s0) / HB)
for b in range(nbeats):
    tb = s0 + b * HB
    root, ch = HAPPY[(b // 4) % 4]
    sw = HB * 0.17
    walk = [root, root + 4, root + 7, root + 9][b % 4]
    add(upright(walk, HB * 0.9), tb, 0.6)
    add(ride(), tb, 0.14, pan=0.35); add(ride(0.6), tb + HB / 2 + sw, 0.09, pan=0.35)
    if b % 2 == 1:
        add(brush_tap(), tb, 0.45, pan=-0.25)
    # stride piano: bass note on 1 & 3, chord on 2 & 4
    if b % 2 == 0:
        add(piano([root + 12], HB * 0.8, 0.9), tb, 0.18, pan=-0.15)
    else:
        add(piano(ch, HB * 0.6, 1.0, 1.2), tb, 0.2, pan=-0.15)
for (bt, n, ln) in HMEL:
    for rep in (0, 16):
        t = s0 + (bt + rep) * HB
        if t < 39.3:
            add(clarinet(n, ln * HB * 0.95), t + (HB * 0.17 if bt % 1 else 0), 0.16, pan=0.2)
# ending "ta-da!"
end = s0 + nbeats * HB
add(piano([41, 53, 65, 69, 72, 76, 81], 1.6, 1.0, 1.2), end, 0.32)
add(clarinet(81, 1.2), end, 0.18, pan=0.2)
add(upright(29 + 12, 1.2), end, 0.6)
add(ride(1.2), end, 0.25, pan=0.35)

# ---------------- SFX ----------------
add(hit0(), 0.0, 0.85)
add(sret(0.42), 0.0, 0.6, pan=0.3)                             # hook: the page is already ripping at 0.000 s
for d, T in DAYS[1:]:
    add(sret(0.42), T - 0.12, 0.6, pan=0.3)
for k, c in enumerate(CLINKS):
    add(clink(k), c, 0.3 if c < 32 else 0.25, pan=0.45)
# food pops (items that are new on each day), mirroring the anim stagger
for i in range(1, len(DAYS)):
    d, T = DAYS[i]
    prev = MENU[DAYS[i - 1][0]]
    delay = 0.45 if d == 30 else 0.0
    for k, it in enumerate(MENU[d]):
        if it in prev:
            continue
        add(pop(600 + k * 70), T + 0.3 + delay + k * 0.12, 0.25, pan=-0.2 + 0.08 * k)
add(pour(0.9), 10.1, 0.35)                                     # kecap
add(ghost_wooo(1.4), 21.6, 0.18, pan=0.2)                      # bayangan lauk
add(sparkle() * 0.6, 27.0, 0.3)                                # halo
add(notif_ting(), 32.15, 0.45)
add(coin(), 32.45, 0.5)
add(whoosh(0.5), 32.25, 0.35)
add(sparkle(), 32.55, 0.45)
add(sparkle(), 33.8, 0.25)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
lift = np.ones(N)                                         # keep the lonely 28th/29th audible on phones
i0, i1, i2, i3 = (int(x * SR) for x in (21.0, 26.4, 31.9, 32.05))
lift[i0:i1] = np.linspace(1, 1.8, i1 - i0); lift[i1:i2] = 1.8; lift[i2:i3] = np.linspace(1.8, 1, i3 - i2)
mix *= lift[:, None]
for dly, g in ((0.031, 0.13), (0.053, 0.09), (0.089, 0.06), (0.131, 0.04)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
mix = sosfilt(butter(2, 25, btype='high', fs=SR, output='sos'), mix, axis=0)
fi = int(0.001 * SR); fo = int(0.35 * SR)              # no fade-in: the hit is at 0.000 s
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/tanggaltua-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/tanggaltua-music.wav', f'{len(mix) / SR:.3f}s')
