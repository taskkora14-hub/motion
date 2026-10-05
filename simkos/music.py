"""Original bossa-nova soundtrack + life-sim SFX + gibberish voice for the "kamar kos" spot.

    python3 simkos/music.py   -> out/simkos-music.wav

120 BPM (one bar = 2 s, so every scene cut lands on a downbeat): plucked nylon guitar (additive
pluck model) comping a syncopated bossa pattern with bass on 1 & 3, a soft FM electric piano for
chords and the playful melody, shaker / rim-click / soft surdo kick. The student "talks" in an
invented gibberish language (formant synthesis: glottal buzz through vowel formants + consonant
bursts). A ting plays for every need bar going up, a buzz for every bar going down; all timings
come from simkos/timeline.js. A hit + alarm lands on sample 0 (no fade-in).
"""
import json
import os
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)
V = np.zeros(N)          # voice bus (kept drier)

TLJ = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'timeline.js'), '--json']))
T = TLJ['T']
BEAT = 0.5
BAR = 2.0


def add(sig, t0, gain=1.0, pan=0.0, bus=None):
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    if bus is not None:
        bus[i:i + len(sig)] += sig * gain
        return
    L[i:i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def jsrnd(i):  # same hash as anim.js rnd()
    x = np.sin(i * 127.1 + 311.7) * 43758.5453
    return x - np.floor(x)


# ---------------- instruments ----------------
def nylon(n, d=1.6, bright=1.0):
    """plucked nylon string: harmonics with pluck-position weighting, higher partials die faster"""
    x = tt(d); f = midi(n); s = np.zeros_like(x)
    for k in range(1, 14):
        if f * k > 9000:
            break
        amp = abs(np.sin(np.pi * k * 0.18)) / k ** 1.1 * (bright if k > 3 else 1)
        s += amp * np.sin(2 * np.pi * f * k * x * (1 + 0.0004 * k * k)) * np.exp(-x * (1.6 + 0.9 * k ** 1.25))
    att = filt(rng.standard_normal(len(x)), 'band', [1500, 5000]) * np.exp(-x / 0.004) * 0.08
    return (s + att) * np.minimum(1, x / 0.0015) * np.clip((d - x) / 0.05, 0, 1)


def epiano(notes, d=1.0, vel=1.0):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n); ph = 2 * np.pi * f * x
        mod = np.sin(ph * 1.0) * 1.3 * vel * np.exp(-x / 0.3)
        s += np.sin(ph + mod) * np.exp(-x / 0.9) + 0.25 * np.sin(2 * ph) * np.exp(-x / 0.25)
    s /= max(1, len(notes))
    return s * np.minimum(1, x / 0.003) * np.clip((d - x) / 0.08, 0, 1)


def vib(n, d=1.2):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 4 * x) * np.exp(-x * 8)
    return s * np.exp(-x / 0.6) * (1 + 0.15 * np.sin(2 * np.pi * 5.5 * x)) * np.minimum(1, x / 0.002)


def kick():
    x = tt(0.35); f = 52 + 45 * np.exp(-x / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.16)


def rim():
    x = tt(0.06)
    return (np.sin(2 * np.pi * 1750 * x) * 0.6 + filt(rng.standard_normal(len(x)), 'band', [2000, 6000]) * 0.4) * np.exp(-x / 0.012)


def shaker(acc=1.0):
    x = tt(0.09)
    env = np.minimum(1, x / 0.025) * np.exp(-np.maximum(0, x - 0.025) / 0.02)
    return filt(rng.standard_normal(len(x)), 'band', [5000, 12000]) * env * 0.5 * acc


# ---------------- SFX ----------------
def ting(n=84, d=0.9):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.45 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 7) + 0.25 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x * 14)
    return s * np.exp(-x / 0.35) * np.minimum(1, x / 0.001)


def buzz(d=0.34, f0=110):
    x = tt(d)
    f = f0 * (1 - 0.18 * x / d) * (1 + 0.03 * np.sin(2 * np.pi * 32 * x))
    sq = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    sq2 = np.sign(np.sin(2 * np.pi * np.cumsum(f * 1.012) / SR))
    s = filt((sq + sq2) / 2, 'low', 1800)
    return s * np.minimum(1, x / 0.005) * np.clip((d - x) / 0.06, 0, 1) * 0.8


def alarm():
    """two-tone alert beep (one per blink)"""
    return np.concatenate([np.sin(2 * np.pi * midi(88) * tt(0.11)) * np.minimum(1, tt(0.11) / 0.003),
                           np.sin(2 * np.pi * midi(84) * tt(0.12)) * np.exp(-tt(0.12) / 0.06)])


def hit():
    x = tt(0.6); f = 45 + 110 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.22) + filt(rng.standard_normal(len(x)), 'low', 3000) * np.exp(-x / 0.05) * 0.5


def pop(f=700):
    x = tt(0.1); ff = f * (1 + 1.2 * np.exp(-x / 0.012))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.03)


def whoosh(d=0.45, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 400 * (18 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.5


def click():
    x = tt(0.03)
    return filt(rng.standard_normal(len(x)), 'band', [2500, 8000]) * np.exp(-x / 0.004) + np.sin(2 * np.pi * 2200 * x) * np.exp(-x / 0.006) * 0.5


def slurp():
    d = 0.42; x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n)
    for k in range(6):
        c = (k + 0.5) / 6; f = 600 + 1800 * c
        out += filt(n, 'band', [f * 0.8, f * 1.25]) * np.clip(1 - np.abs(x / d - c) * 5, 0, 1)
    return out * np.sin(np.pi * x / d) * 0.7


def step_tap():
    x = tt(0.07)
    return filt(rng.standard_normal(len(x)), 'band', [150, 900]) * np.exp(-x / 0.015)


def sparkle(d=1.2):
    x = tt(d); s = np.zeros_like(x)
    for k in range(14):
        t0 = rng.uniform(0, d * 0.7); i = int(t0 * SR); f = midi(rng.integers(91, 103))
        g = np.sin(2 * np.pi * f * x[: len(x) - i]) * np.exp(-x[: len(x) - i] / 0.12)
        s[i:] += g * rng.uniform(0.3, 1)
    return s / 6


def snore():
    d = 1.3; x = tt(d)
    breath = filt(rng.standard_normal(len(x)), 'band', [250, 1200]) * np.sin(np.pi * np.clip(x / 0.8, 0, 1)) * 0.6
    whistle = np.sin(2 * np.pi * np.cumsum(900 - 300 * np.clip((x - 0.8) / 0.5, 0, 1)) / SR) * np.clip((x - 0.8) / 0.05, 0, 1) * np.clip((d - x) / 0.2, 0, 1) * 0.25
    return breath + whistle


# ---------------- gibberish voice (formant synthesis) ----------------
VOW = {'a': (800, 1250, 2600), 'e': (480, 1900, 2600), 'i': (320, 2300, 3000), 'o': (520, 900, 2500), 'u': (360, 760, 2400)}
CONS = ['b', 'p', 'd', 't', 'g', 'k', 'm', 'n', 'l', 's', 'sh', 'w', 'y', 'h', '']


def glottal(f):
    ph = np.cumsum(f) / SR
    s = np.zeros_like(ph)
    for k in range(1, 22):
        s += np.sin(2 * np.pi * k * ph) / k ** 1.15 * (np.mean(f) * k < 5000)
    return s


def syllable(f0, d, vowel, cons, breathy=0.0, glide=0.0):
    x = tt(d)
    f = f0 * (1 + glide * x / d) * (1 + 0.012 * np.sin(2 * np.pi * 6 * x))
    src = glottal(f) * (1 - breathy) + rng.standard_normal(len(x)) * breathy * 0.6
    F1, F2, F3 = VOW[vowel]
    v = filt(src, 'band', [F1 * 0.8, F1 * 1.2]) * 1.0 + filt(src, 'band', [F2 * 0.88, F2 * 1.12]) * 0.55 + filt(src, 'band', [F3 * 0.9, F3 * 1.1]) * 0.25
    env = np.minimum(1, x / 0.018) * np.clip((d - x) / 0.04, 0, 1)
    out = v * env
    c = int(0.035 * SR)
    if cons in ('b', 'p', 'd', 't', 'g', 'k'):
        burst = filt(rng.standard_normal(c), 'band', {'b': [300, 1500], 'p': [400, 2500], 'd': [1500, 4000], 't': [2500, 6000], 'g': [1000, 3000], 'k': [1500, 4500]}[cons]) * np.exp(-tt(0.035) / 0.008) * 0.5
        out = np.concatenate([burst, out])
    elif cons in ('m', 'n'):
        nas = filt(glottal(np.full(int(0.05 * SR), f0)), 'low', 400) * 0.4 * np.minimum(1, tt(0.05) / 0.01)
        out = np.concatenate([nas, out])
    elif cons in ('s', 'sh'):
        fr = filt(rng.standard_normal(int(0.07 * SR)), 'high' if cons == 's' else 'band', 4500 if cons == 's' else [2200, 5000]) * 0.25 * np.sin(np.pi * tt(0.07) / 0.07)
        out = np.concatenate([fr, out])
    elif cons == 'h':
        out = np.concatenate([filt(rng.standard_normal(int(0.04 * SR)), 'band', [F1, F3]) * 0.15, out])
    return out


MOODS = {  # base pitch, syllable length, pitch spread, contour, vowels, breathiness
    'panic':   (360, 0.085, 0.25, 'shake', 'aieo', 0.05),
    'yawn':    (300, 0.32, 0.0, 'fall', 'au', 0.25),
    'happy':   (290, 0.11, 0.18, 'bounce', 'aeio', 0.05),
    'yum':     (270, 0.13, 0.12, 'bounce', 'ou', 0.05),
    'giggle':  (340, 0.075, 0.1, 'rise', 'ei', 0.15),
    'meh':     (215, 0.15, 0.05, 'flat', 'eou', 0.1),
    'sigh':    (240, 0.22, 0.0, 'fall', 'ao', 0.4),
    'excited': (370, 0.1, 0.22, 'rise', 'aeiou', 0.05),
    'content': (250, 0.16, 0.08, 'fall', 'aou', 0.15),
}


def say(n, mood):
    f0, sd, spread, shape, vows, br = MOODS[mood]
    parts = []
    for k in range(n):
        u = k / max(1, n - 1)
        if shape == 'rise':
            m = 1 + 0.35 * u
        elif shape == 'fall':
            m = 1.15 - 0.35 * u
        elif shape == 'bounce':
            m = 1 + spread * (1 if k % 2 else -0.4)
        elif shape == 'shake':
            m = 1 + spread * rng.uniform(-1, 1) + 0.1 * u
        else:
            m = 1 + spread * rng.uniform(-1, 1)
        if mood in ('yum',):
            cons = 'm' if k % 2 == 0 else 'n'
        elif mood == 'giggle':
            cons = 'h'
        else:
            cons = CONS[rng.integers(len(CONS))]
        v = vows[rng.integers(len(vows))]
        d = sd * rng.uniform(0.8, 1.3) * (1.8 if k == n - 1 else 1)
        glide = 0.25 if (k == n - 1 and shape in ('rise',)) else (-0.2 if k == n - 1 and shape in ('fall', 'flat') else rng.uniform(-0.08, 0.08))
        parts.append(syllable(f0 * m, d, v, cons, br, glide))
        parts.append(np.zeros(int(SR * rng.uniform(0.01, 0.04))))
    return np.concatenate(parts)


# ---------------- harmony (F major bossa) ----------------
CH = {
    'Fmaj7': (41, [57, 60, 64, 65]), 'Gm7': (43, [58, 62, 65, 69]), 'C9': (36, [58, 62, 64, 67]), 'Am7': (45, [55, 60, 64, 67]),
    'D7b9': (38, [57, 60, 63, 66]), 'Bbmaj7': (46, [57, 62, 65, 69]), 'Bbm6': (46, [55, 61, 65, 67]), 'Fmaj9': (41, [57, 60, 64, 67]),
    'Dm9': (38, [57, 60, 64, 65]), 'G13': (43, [59, 64, 65, 69]),
}
PROG = ['Fmaj7', 'Fmaj7', 'Gm7', 'C9', 'Am7', 'D7b9', 'Gm7', 'C9',
        'Fmaj7', 'Dm9', 'Gm7', 'C9', 'Am7', 'D7b9', 'Gm7', 'C9',
        'Bbmaj7', 'Bbm6', 'Fmaj9', 'Fmaj9']
# playful EP/vibes melody: (bar, beat offset, midi, length in beats)
MEL = [
    (0, 0.5, 72, 0.5), (0, 1.0, 74, 0.5), (0, 1.5, 76, 1.0), (0, 3.0, 72, 0.5), (0, 3.5, 69, 1.5),
    (1, 2.0, 72, 0.5), (1, 2.5, 76, 0.5), (1, 3.0, 79, 1.0),
    (2, 0.5, 77, 0.5), (2, 1.0, 74, 0.5), (2, 1.5, 70, 1.0), (2, 3.0, 74, 1.0),
    (3, 0.0, 72, 0.5), (3, 0.5, 70, 0.5), (3, 1.0, 67, 2.0),
]
GUITAR_A = [0, 3, 6, 10, 12]
GUITAR_B = [2, 6, 10, 13]
CLAVE = [[0, 6, 12], [4, 10]]

SLEEP = (6.0, 10.0)    # lullaby: drums drop out, guitar only, darker
for bar, name in enumerate(PROG):
    t0 = bar * BAR
    if t0 >= DUR:
        break
    root, notes = CH[name]
    asleep = SLEEP[0] <= t0 < SLEEP[1]
    final = bar >= 18
    s16 = BAR / 16
    # guitar: thumb bass on 1 & 3 (root, fifth), fingers on the syncopations
    for k, bn in enumerate([root, root + 7]):
        if final and k == 1:
            break
        add(nylon(bn, 1.2 if not final else 3.5), t0 + k * 2 * BEAT, 0.42, pan=-0.1)
    for s in (GUITAR_A if bar % 2 == 0 else GUITAR_B):
        if final and s > 0:
            break
        for j, n in enumerate(notes):            # tiny strum spread
            add(nylon(n, 0.7 if not final else 3.5, bright=0.7), t0 + s * s16 + j * 0.008, 0.16 if not asleep else 0.11, pan=-0.25)
    # EP pad comp on beat 1 (softly), drops out while asleep
    if not asleep:
        add(epiano([n + 12 for n in notes], 1.7 if not final else 3.8, vel=0.7), t0, 0.07, pan=0.25)
    # percussion
    if not asleep and not final:
        add(kick(), t0, 0.32); add(kick(), t0 + 2 * BEAT, 0.26); add(kick(), t0 + 3.5 * BEAT, 0.12)
        for s in CLAVE[bar % 2]:
            add(rim(), t0 + s * s16, 0.16, pan=0.3)
        for s in range(16):
            add(shaker(1.0 if s % 2 == 0 else 0.55), t0 + s * s16 + (0.012 if s % 2 else 0), 0.22, pan=0.4)
    # melody: vibes in the hook/scene 2, EP in scene 3, both quiet when sleeping
    if not asleep and not final:
        for mb, off, n, ln in MEL:
            if bar % 4 == mb and (bar < 13 or bar >= 14):
                inst = vib(n, ln * BEAT + 0.6) if bar < 13 else epiano([n + 12], ln * BEAT + 0.5, vel=1.0)
                add(inst, t0 + off * BEAT, 0.12 if bar < 13 else 0.11, pan=0.15)

# sleep: soft music-box lullaby notes
for k, n in enumerate([77, 76, 72, 74, 72, 69, 72, 67]):
    add(vib(n, 1.2), 6.2 + k * 0.5, 0.06, pan=0.2)

# ---------------- hook 0–4 ----------------
add(hit(), 0.0, 0.8)                                       # the hit on frame 0
add(epiano([53, 56, 59, 62], 0.6, vel=1.4), 0.0, 0.2)      # tense diminished stab
for k in range(8):                                         # alarm in sync with the 4 Hz blink
    add(alarm(), k * 0.5, 0.12, pan=0.1)

# ---------------- bar steps: ting up, buzz down ----------------
ups = 0
for s in TLJ['STEPS']:
    t = s['t']
    if s['up']:
        if s.get('big'):
            for k, n in enumerate([84, 88, 91, 96, 100]):
                add(ting(n, 1.4), t + k * 0.07, 0.17, pan=-0.3 + k * 0.15)
            add(sparkle(1.6), t, 0.4)
        else:
            add(ting(86 + (ups % 5) * 2), t, 0.17, pan=-0.2)
            ups += 1
    else:
        add(buzz(0.34 if t > 0.1 else 0.45, 110 if s['bar'] != 'tugas' else 92), t, 0.2, pan=-0.2)

# ---------------- action SFX ----------------
for a, b in ((4.25, 5.5), (10.9, 12.0), (17.2, 18.4), (32.4, 34.0)):   # footsteps
    t = a + 0.1
    while t < b - 0.1:
        add(step_tap(), t, 0.25, pan=rng.uniform(-0.2, 0.2))
        t += 0.29
for t in (0.25, 4.3, 10.95, 17.25, 25.3):                 # thought bubbles
    add(pop(900), t, 0.22)
for t in (4.4, 10.9, 17.4, 25.6, 28.9, 34.2):             # banners
    add(whoosh(0.35), t - 0.12, 0.25); add(pop(1200), t + 0.1, 0.14)
add(whoosh(0.5, up=False), 5.5, 0.25)                      # flop into bed
for t in (6.6, 8.1, 9.3):
    add(snore(), t, 0.16)
add(ting(91, 0.8), 10.3, 0.08)                             # morning
k = 0
while 12.0 + k * 1.6 + 0.45 < 17.2:                        # slurps on each chopstick lift
    add(slurp(), 12.0 + k * 1.6 + 0.45, 0.22, pan=0.2); k += 1
for i in range(6):                                         # phone notifications
    t0 = 18.9 + i * 0.9 + jsrnd(i) * 0.3
    add(pop(1500 + (i % 3) * 200), t0, 0.12, pan=0.3); add(ting(96 + (i % 2) * 3, 0.3), t0 + 0.03, 0.05, pan=0.3)

# ---------------- menu + MINTASK ----------------
add(whoosh(0.4), T['MENU'] - 0.1, 0.3)
for i in range(4):
    add(pop(700 + i * 160), T['MENU'] + 0.08 * i + 0.05, 0.18, pan=-0.3 + i * 0.2)
for t in (26.85, 27.25, 27.6):
    add(click() * 0.4, t, 0.25)
add(click(), T['CLICK'], 0.5)
add(ting(96, 0.6), T['CLICK'] + 0.02, 0.1)
add(whoosh(0.6), 28.12, 0.35)
add(hit() * 0.5, T['FILL'], 0.45)
add(sparkle(2.0), 29.4, 0.3)
add(epiano([65, 69, 72, 76, 79], 2.0, vel=1.2), T['FILL'], 0.16)   # ta-da: Fmaj9 burst
for k, n in enumerate([72, 76, 79, 84]):
    add(vib(n, 0.9), T['FILL'] + 0.05 + k * 0.09, 0.08)

# ---------------- 34 – 40: lounge + brand sting ----------------
add(whoosh(0.5), 33.95, 0.25)
add(pop(500), 34.45, 0.18)                                 # plop onto the sofa
add(whoosh(0.7), T['LOGO'] - 0.05, 0.4)                    # blue circle wipe
add(pop(800), T['LOGO'] + 0.4, 0.25)
add(ting(84, 1.6), T['LOGO'] + 0.45, 0.14)
add(ting(91, 1.6), T['LOGO'] + 0.8, 0.1)
for k, n in enumerate([77, 81, 84, 88, 89]):              # tagline sparkle
    add(vib(n, 1.6), T['LOGO'] + 1.15 + k * 0.06, 0.08, pan=-0.3 + k * 0.15)
add(sparkle(1.4), T['LOGO'] + 1.15, 0.25)

# ---------------- voice ----------------
for v in TLJ['VOICE']:
    add(say(v['n'], v['mood']), v['t'], 0.5 if v['mood'] != 'sigh' else 0.4, bus=V)

# ---------------- master ----------------
ir_t = tt(1.1)
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.32)
ir = filt(ir, 'low', 6000)
ir *= 0.22 / np.sqrt((ir ** 2).sum())                       # unit-energy room, ~-13 dB wet
mix = np.stack([L + V * 0.75, R + V * 0.75], axis=1)
wet = np.stack([fftconvolve(L + V * 0.3, ir)[:N], fftconvolve(R + V * 0.3, np.roll(ir, 37))[:N]], axis=1)
mix = mix + wet
mix = np.stack([filt(mix[:, 0], 'high', 35), filt(mix[:, 1], 'high', 35)], axis=1)
fade = np.ones(N)
fi = int(0.001 * SR)                                        # 1 ms de-click only: the hit lands on frame 0
fo = int(0.5 * SR)
fade[:fi] = np.linspace(0.6, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/simkos-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/simkos-music.wav', f'{N / SR:.2f}s')
