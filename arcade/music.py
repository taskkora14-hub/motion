"""Original 8-bit soundtrack + arcade SFX for "level 1: tugas menyerang!" (no voice-over).

    python3 arcade/music.py   -> out/arcade-music.wav

Chiptune in A minor at 140 BPM (pulse-wave lead/arp, triangle bass, noise drums). The tempo
accelerates as the tasks pile up (140 -> 172 BPM), breaks down for the MinTask power-up, drops into
a C-major hero groove for the laser, and ends in a stage-clear jingle + victory fanfare.
SFX times (pews, explosions, landings, laser) come from arcade/plan.js, so they hit the exact frame.
"""
import json
import os
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(14)
L = np.zeros(N)
R = np.zeros(N)

plan = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'plan.js')]))


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


# ---------------- chip voices ----------------
def pulse_f(f, d, duty=0.5):
    """pulse wave with a per-sample frequency array (or scalar)"""
    x = tt(d)
    f = np.broadcast_to(f, x.shape)
    ph = np.cumsum(f) / SR % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def env(x, d, a=0.002, rel=0.03, decay=None, sus=1.0):
    e = np.minimum(1, x / a) * np.clip((d - x) / rel, 0, 1)
    if decay:
        e *= sus + (1 - sus) * np.exp(-x / decay)
    return e


def sq(n, d, duty=0.5, decay=None, sus=0.6, vib=0.0):
    x = tt(d); f = midi(n) * (1 + vib * np.sin(2 * np.pi * 6 * x) * np.clip((x - 0.12) / 0.1, 0, 1))
    return pulse_f(f, d, duty) * env(x, d, decay=decay, sus=sus)


def tri(n, d):
    x = tt(d); ph = midi(n) * x % 1.0
    s = 4 * np.abs(ph - 0.5) - 1
    s = np.round(s * 8) / 8                     # 4-bit-ish stair steps like the NES triangle
    return s * env(x, d, rel=0.01)


def noise(d):
    return rng.choice([-1.0, 1.0], size=len(tt(d)))


def kick():
    d = 0.16; x = tt(d); f = 55 + 220 * np.exp(-x / 0.02)
    s = pulse_f(f, d, 0.5) * np.exp(-x / 0.05)
    return filt(s, 'low', 1800) * 1.2


def snare():
    d = 0.16; x = tt(d)
    return filt(noise(d), 'high', 1500) * np.exp(-x / 0.045) * 0.7 + tri(50, d) * np.exp(-x / 0.03) * 0.5


def hat(open_=False):
    d = 0.12 if open_ else 0.04; x = tt(d)
    return filt(noise(d), 'high', 7000) * np.exp(-x / (0.04 if open_ else 0.01)) * 0.5


def crash():
    d = 1.2; x = tt(d)
    return filt(noise(d), 'high', 4000) * np.exp(-x / 0.35) * 0.6


# ---------------- SFX ----------------
def coin():
    a = sq(83, 0.07, 0.5); b = sq(88, 0.42, 0.5) * np.exp(-tt(0.42) / 0.14)
    return np.concatenate([a, b])


def hit0():
    d = 0.35; x = tt(d)
    thump = pulse_f(40 + 160 * np.exp(-x / 0.03), d, 0.5) * np.exp(-x / 0.09)
    return filt(thump, 'low', 2500) + filt(noise(d), 'low', 5000) * np.exp(-x / 0.06) * 0.8


def pew(k=0):
    d = 0.11; x = tt(d); f0 = 1500 + 200 * (k % 3)
    return pulse_f(f0 * np.exp(-x / 0.045) + 180, d, 0.5) * np.exp(-x / 0.06)


def boom(big=False):
    d = 0.6 if big else 0.32; x = tt(d)
    n = noise(d)
    # crunchy decaying low-pass, stepped like a sample-rate-reduced chip
    out = np.zeros_like(n)
    for k, (a, b) in enumerate(((0, 0.05), (0.05, 0.14), (0.14, d))):
        m = (x >= a) & (x < b)
        out[m] = filt(n, 'low', [6000, 2500, 900][k])[m]
    hold = 3 if big else 2
    out = np.repeat(out[::hold], hold)[: len(n)]
    thump = pulse_f(30 + 120 * np.exp(-x / 0.04), d, 0.5) * np.exp(-x / 0.08) * 0.6
    return (out * np.exp(-x / (0.22 if big else 0.1)) + thump) * (1.0 if big else 0.8)


def land():
    d = 0.3; x = tt(d)
    thud = tri(36, d) * np.exp(-x / 0.08) + filt(noise(d), 'low', 700) * np.exp(-x / 0.05) * 0.8
    blip = pulse_f(600 * np.exp(-x / 0.08) + 90, d, 0.25) * np.exp(-x / 0.07) * 0.35
    return thud + blip


def blip(n=84, d=0.03, duty=0.25):
    return sq(n, d, duty) * 0.7


def powerup():
    notes = [57, 60, 64, 69, 72, 76, 81, 84, 88, 93, 96, 100]
    return np.concatenate([sq(n, 0.035, 0.125) for n in notes] + [sq(96, 0.3, 0.125, decay=0.08, sus=0)])


def item():
    return np.concatenate([sq(88, 0.05, 0.25), np.zeros(int(0.02 * SR)), sq(93, 0.12, 0.25, decay=0.05, sus=0)])


def laser():
    d = 1.35; x = tt(d)
    f = 140 * (1 + 0.35 * np.sign(np.sin(2 * np.pi * 28 * x)))
    body = pulse_f(f, d, 0.25) * 0.55 + filt(noise(d), 'band', [1500, 6000]) * 0.35
    zap = pulse_f(2600 * np.exp(-x / 0.12) + 200, d, 0.5) * np.exp(-x / 0.15) * 0.6
    e = np.minimum(1, x / 0.01) * np.clip((d - x) / 0.35, 0, 1)
    return (body * e + zap)


def riser(d):
    x = tt(d)
    f = 200 * (8 ** (x / d))
    return pulse_f(f, d, 0.125) * (x / d) ** 1.5 * 0.5 + filt(noise(d), 'high', 3000) * (x / d) ** 2 * 0.25


def shutter():
    d = 0.3; x = tt(d)
    return filt(noise(d), 'band', [600, 3000]) * np.sin(np.pi * x / d) * 0.5 + pulse_f(900 * np.exp(-x / 0.1) + 80, d, 0.5) * 0.25 * np.exp(-x / 0.1)


# ---------------- music: tempo map ----------------
def bpm(t):
    if t < 10: return 140.0
    if t < 25.8: return 140 + 32 * ((t - 10) / 15.8) ** 1.3
    return 172.0


def sixteenths(t0, t1, tempo=None):
    """16th-note grid between t0 and t1 following the tempo map"""
    ts, t = [], t0
    while t < t1 - 1e-6:
        ts.append(t)
        t += 60 / (tempo or bpm(t)) / 4
    return ts


# A minor loop: Am F C G (one chord per bar)
PROG = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [52, 55, 60]), (43, [55, 59, 62])]
LEAD = [(0, 69, 2), (2, 72, 2), (4, 76, 4), (8, 74, 2), (10, 72, 2), (12, 71, 2), (14, 72, 2),
        (16, 72, 2), (18, 69, 2), (20, 65, 4), (24, 69, 2), (26, 72, 2), (28, 77, 4),
        (32, 76, 2), (34, 74, 2), (36, 72, 4), (40, 67, 2), (42, 72, 2), (44, 76, 4),
        (48, 74, 2), (50, 76, 2), (52, 79, 4), (56, 77, 2), (58, 76, 2), (60, 74, 4)]
LEAD_AT = {s: (n, ln) for s, n, ln in LEAD}

grid = sixteenths(0.0, 26.2)
for i, t in enumerate(grid):
    st = i % 64; bar = st // 16; s16 = st % 16
    root, chord = PROG[bar]
    d16 = 60 / bpm(t) / 4
    hot = t > 12           # second half: busier
    # drums
    if s16 in (0, 8) or (hot and s16 in (10,)) or (t > 20 and s16 == 6):
        add(kick(), t, 0.55)
    if s16 in (4, 12):
        add(snare(), t, 0.4)
    if hot or s16 % 2 == 0:
        add(hat(open_=(s16 == 14)), t, 0.22 if s16 % 4 == 2 else 0.14, pan=0.25)
    # triangle bass: driving eighths, octave bounce
    if s16 % 2 == 0:
        add(tri(root + (12 if s16 % 4 == 2 else 0), d16 * 1.8), t, 0.5)
    # 12.5% arp: chord tones in 16ths
    arp = chord + [chord[0] + 12]
    add(sq(arp[s16 % 4] + 12, d16 * 0.9, 0.125), t, 0.07, pan=-0.3)
    # lead (rests 4–8 s to let the first shots breathe; octave up when it gets hectic)
    if st in LEAD_AT and not (4.0 <= t < 8.0):
        n, ln = LEAD_AT[st]
        add(sq(n + (12 if t > 19 else 0), d16 * ln * 0.95, 0.25, decay=0.12, sus=0.55, vib=0.004), t, 0.12, pan=0.15)
        add(sq(n, d16 * ln * 0.95, 0.5, decay=0.1, sus=0.4), t + d16 * 0.75, 0.035, pan=-0.4)   # echo

# danger siren under "awas deadline!" (21.6–25.4, synced to the 3 Hz blink)
t = 21.6
k = 0
while t < 25.4:
    add(sq(81 if k % 2 == 0 else 76, 1 / 6 * 0.9, 0.5), t, 0.05, pan=0.4)
    t += 1 / 6; k += 1

# ---- 26–28.4: power-up break ----
for j, t in enumerate(sixteenths(26.2, 28.4, 172)):
    s16 = j % 16
    add(sq([57, 60, 64, 69][j % 4] + 12 + (j // 16) * 2, 0.04, 0.125), t, 0.06, pan=-0.2)
    if t > 27.0:
        add(snare(), t, 0.12 + 0.25 * (t - 27.0) / 1.4)       # accelerating snare roll
    if s16 % 4 == 0:
        add(tri(45, 0.08), t, 0.4)
add(riser(1.2), 27.2, 0.35)

# ---- 28.4–34: hero groove in C major, 150 BPM ----
HPROG = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [57, 60, 64]), (41, [57, 60, 65])]
HLEAD = [(0, 72, 4), (4, 76, 2), (6, 79, 6), (12, 77, 2), (14, 76, 2),
         (16, 74, 4), (20, 71, 2), (22, 74, 6), (28, 76, 2), (30, 74, 2),
         (32, 72, 4), (36, 76, 2), (38, 81, 6), (44, 79, 4),
         (48, 77, 2), (50, 76, 2), (52, 74, 2), (54, 77, 2), (56, 79, 8)]
HL = {s: (n, ln) for s, n, ln in HLEAD}
for i, t in enumerate(sixteenths(28.4, 33.75, 150)):
    st = i % 64; s16 = st % 16; root, chord = HPROG[st // 16]; d16 = 60 / 150 / 4
    if s16 in (0, 6, 8, 10):
        add(kick(), t, 0.5)
    if s16 in (4, 12):
        add(snare(), t, 0.38)
    add(hat(open_=(s16 % 4 == 2)), t, 0.12, pan=0.25)
    if s16 % 2 == 0:
        add(tri(root + (12 if s16 % 4 == 2 else 0), d16 * 1.8), t, 0.5)
    add(sq((chord + [chord[0] + 12])[s16 % 4] + 12, d16 * 0.9, 0.125), t, 0.06, pan=-0.3)
    if t > 29.6 and st in HL:
        n, ln = HL[st]
        add(sq(n, d16 * ln * 0.95, 0.25, decay=0.15, sus=0.6, vib=0.005), t, 0.13, pan=0.15)
        add(sq(n - 12, d16 * ln * 0.95, 0.5, decay=0.15, sus=0.5), t, 0.05, pan=-0.15)

# ---- 34–37: stage clear jingle ----
SC = [(34.0, 72, 0.12), (34.1, 76, 0.12), (34.2, 79, 0.12), (34.3, 84, 0.5)]
for t0, n, d in SC:
    add(sq(n, d, 0.25, decay=0.2, sus=0.5), t0, 0.16)
    add(sq(n - 12, d, 0.5, decay=0.2, sus=0.4), t0, 0.06)
add(tri(48, 0.8), 34.0, 0.5)
for t0, n, d in [(35.0, 79, 0.14), (35.15, 77, 0.14), (35.3, 76, 0.14), (35.45, 74, 0.3), (35.85, 76, 0.14), (36.0, 79, 0.5)]:
    add(sq(n, d, 0.125, decay=0.1, sus=0.5), t0, 0.08, pan=0.2)
for i, t in enumerate(sixteenths(34.0, 37.0, 140)):
    if i % 4 == 0:
        add(tri([48, 48, 53, 55][(i // 16) % 4] + (12 if i % 8 == 4 else 0), 0.2), t, 0.4)
    if i % 8 == 4:
        add(snare(), t, 0.2)
    if i % 2 == 0:
        add(hat(), t, 0.1, pan=0.25)
for a in (34.5, 34.9, 35.4):
    add(blip(91, 0.06, 0.5), a, 0.18)
for k, t in enumerate(np.arange(35.4, 36.3, 0.05)):   # total counting up
    add(blip(84 + (k % 2) * 7, 0.025), t, 0.1)
add(boom(), 36.3, 0.35); add(blip(96, 0.15, 0.5), 36.3, 0.15)

# ---- 37–40: victory fanfare + logo ----
F0 = 37.2; b = 60 / 140
FAN = [(0, 67, 0.5), (0.5, 72, 0.5), (1.0, 76, 0.5), (1.5, 79, 1.0), (2.5, 76, 0.5),
       (3.0, 77, 0.25), (3.25, 79, 0.25), (3.5, 84, 2.6)]
for beat, n, ln in FAN:
    add(sq(n, ln * b * 0.95 if ln < 2 else 2.6 * b, 0.25, decay=0.3, sus=0.7, vib=0.006 if ln > 1 else 0), F0 + beat * b, 0.17, pan=0.15)
    add(sq(n - 4 if n != 84 else 79, ln * b * 0.95 if ln < 2 else 2.6 * b, 0.5, decay=0.3, sus=0.6), F0 + beat * b, 0.07, pan=-0.2)
for beat, r in [(0, 48), (1.5, 53), (2.5, 55), (3.5, 48)]:
    add(tri(r, (1.0 if beat < 3.5 else 2.4) * b * 1.5), F0 + beat * b, 0.55)
    add(kick(), F0 + beat * b, 0.5)
add(crash(), F0 + 3.5 * b, 0.4)
for beat in np.arange(3.5, 6.0, 0.25):            # final chord tremolo
    add(sq(76 if int(beat * 4) % 2 else 72, 0.06, 0.125), F0 + beat * b, 0.05, pan=-0.3)
add(item(), 37.45, 0.12)                           # mosaic logo starts resolving
add(boom(), 38.15, 0.18)
for k in range(26):                                 # tagline typing
    if k % 2 == 0:
        add(blip(96, 0.02, 0.5), 38.5 + k * 0.03, 0.05)

# ---------------- SFX from the gameplay plan ----------------
add(hit0(), 0.0, 0.9)          # impact exactly on frame 0
add(coin(), 0.0, 0.32, pan=0.1)
for k, t in enumerate(plan['shots']):
    add(pew(k), t, 0.16, pan=0.0)
for k, (t, x) in enumerate(plan['hits']):
    add(boom(), t, 0.36, pan=(x - 540) / 900)
for t, x in plan['lands']:
    add(land(), t, 0.55, pan=(x - 540) / 900)
add(item(), 26.0, 0.25)
add(powerup(), 27.7, 0.3)
add(laser(), 28.4, 0.5)
add(crash(), 28.4, 0.5); add(hit0(), 28.4, 0.6)
for t, x in plan['laser']:
    add(boom(big=True), t, 0.32, pan=(x - 540) / 900)
for k in range(15):                                  # "bantuan datang." typing
    if k != 7:
        add(blip(91, 0.02, 0.5), 27.75 + k * 0.045, 0.05)
for k, t in enumerate(np.arange(29.9, 31.2, 0.06)):  # bonus counter
    add(blip(88 + (k % 2) * 5, 0.025), t, 0.06, pan=0.3)
add(shutter(), 33.72, 0.5)
add(riser(0.45) * 0.8, 36.95, 0.3)                    # tile dissolve

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
mix = filt(mix.T, 'low', 14000).T                    # tame naive-pulse aliasing
mix = filt(mix.T, 'high', 25).T
fi = int(0.001 * SR); fo = int(0.25 * SR)            # no audible fade-in: the hit lands on 0.000s
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/arcade-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/arcade-music.wav', f'{len(mix) / SR:.3f}s')
