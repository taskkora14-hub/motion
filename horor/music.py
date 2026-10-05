"""Original horror-comedy score + SFX for "jam 23.00. satu notifikasi." (no voice-over).

    python3 horor/music.py   -> out/horor-music.wav

0-24 s  tense: low dissonant drone + staccato strings at 120 BPM (one tick-tock per beat), echoing
        notification "ting", phone buzz, heartbeat speeding up 66 -> 132 BPM, hits on every hard cut.
24-26 s door creak, everything drains away, one breath of silence.
26 s    short silly jumpscare sting (stab + cymbal + boing + tuba blat).
26-34 s comedic: pizzicato + oom-pah tuba + woodblock in F major, slide whistle as the monster
        shrinks, pop + ding when it becomes a neat stack.
34-40 s warm outro: light-switch click, soft pad + glockenspiel, chime on the logo.
Times mirror horor/anim.js (T table + HEART).
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(23)
L = np.zeros(N)
R = np.zeros(N)

T = dict(hook=4.0, wideA=8.5, screen=11.5, wideB=15.5, face=18.5, creak=24.0, reveal=26.0,
         shrink0=27.0, poof=28.6, walk0=28.8, walk1=30.8, hand=31.4, lights=33.8, brand=36.4)
HEART = []
_t = 4.2
while _t < 25.6:
    HEART.append(_t)
    _t += 60 / (66 + 66 * min(1, (_t - 4) / 21) ** 1.5)


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


def saw(f, x, ph=0.0):
    return 2 * ((np.cumsum(np.broadcast_to(f, x.shape)) / SR + ph) % 1.0) - 1


def env(x, d, a=0.005, rel=0.05):
    return np.minimum(1, x / a) * np.clip((d - x) / rel, 0, 1)


# ---------------- horror palette ----------------
def drone(d):
    x = tt(d)
    s = sum(saw(midi(n) * (1 + 0.002 * np.sin(2 * np.pi * 0.13 * x + k)), x, rng.uniform()) for k, n in enumerate((33, 34, 45, 39)))
    m = np.sin(2 * np.pi * 0.07 * x) ** 2                  # slow breathing brightness
    s = filt(s / 4, 'low', 240) * (1 - m) + filt(s / 4, 'low', 420) * m
    return s * np.minimum(1, x / 1.5) * np.clip((d - x) / 0.6, 0, 1)


def stacc(n, d=0.16, bright=2400):
    """staccato bowed string: saw + bow noise, short envelope, two slightly detuned players"""
    x = tt(d); f = midi(n) * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * x))
    s = saw(f, x) * 0.6 + saw(f * 1.003, x, 0.4) * 0.5 + filt(rng.standard_normal(len(x)), 'band', [2000, 6000]) * 0.08
    s = filt(s, 'band', [180, bright])
    return s * np.minimum(1, x / 0.006) * np.exp(-x / 0.07)


def stab(notes, d=0.5):
    x = tt(d)
    s = sum(saw(midi(n), x, rng.uniform()) + saw(midi(n) * 1.004, x, rng.uniform()) for n in notes) / (2 * len(notes))
    return filt(s, 'low', 3500) * np.minimum(1, x / 0.004) * np.exp(-x / 0.14)


def boom(d=1.4):
    x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(28 + 70 * np.exp(-x / 0.1)) / SR) * np.exp(-x / 0.45)
    return np.tanh(sub * 1.6) + filt(rng.standard_normal(len(x)), 'low', 1500) * np.exp(-x / 0.08) * 0.4


def cut_hit():
    d = 0.9; x = tt(d)
    n = rng.standard_normal(len(x))
    sweep = filt(n, 'band', [200, 1800]) * np.exp(-x / 0.12) * 0.5
    return boom(d) * 0.8 + sweep


def ting():
    """notification ting with a long, darkening echo tail"""
    d = 0.6; x = tt(d)
    base = (np.sin(2 * np.pi * 1568 * x) + 0.5 * np.sin(2 * np.pi * 3136 * x) * np.exp(-x * 8) + 0.25 * np.sin(2 * np.pi * 2349 * x)) * np.exp(-x / 0.18) * np.minimum(1, x / 0.002)
    out = np.zeros(int(2.6 * SR)); out[:len(base)] += base
    s = base
    for k in range(1, 7):
        s = filt(s, 'low', 5000 / k) * 0.62
        i = int(k * 0.29 * SR)
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def buzz(d):
    x = tt(d)
    s = np.sign(np.sin(2 * np.pi * 150 * x)) * 0.5 + np.sin(2 * np.pi * 75 * x)
    am = (np.sin(2 * np.pi * 11 * x) > -0.3).astype(float)
    return filt(s, 'low', 900) * am * env(x, d, 0.01, 0.03) + filt(rng.standard_normal(len(x)), 'band', [300, 1200]) * am * 0.3


def clock_tick(hi=True):
    x = tt(0.06)
    f = 3200 if hi else 2100
    return (np.sin(2 * np.pi * f * x) * 0.6 + filt(rng.standard_normal(len(x)), 'high', 2500) * 0.6) * np.exp(-x / 0.008)


def heartbeat(v=1.0):
    def thump(f, d):
        x = tt(d)
        return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-x / 0.02))) / SR) * np.exp(-x / 0.07) * np.minimum(1, x / 0.003)
    a = thump(52, 0.3); b = thump(46, 0.3) * 0.7
    out = np.zeros(int(0.5 * SR)); out[:len(a)] += a; i = int(0.17 * SR); out[i:i + len(b)] += b[: len(out) - i]
    return np.tanh(out * 1.8) * v


def rustle(d):
    x = tt(d); n = filt(rng.standard_normal(len(x)), 'band', [1500, 7000])
    gate = filt((rng.random(len(x)) > 0.9985).astype(float), 'low', 40) * 30
    return n * np.clip(gate, 0, 1) * np.sin(np.pi * x / d) * 0.6


def creak(d):
    """door creak: stick-slip pulse train with wandering rate, through a wooden resonance"""
    x = tt(d)
    rate = 60 + 90 * np.abs(np.sin(2 * np.pi * 0.6 * x + 0.5)) + 25 * np.sin(2 * np.pi * 3.1 * x)
    ph = np.cumsum(rate) / SR
    pulses = np.diff(np.floor(ph), prepend=0) * (0.6 + 0.4 * rng.random(len(x)))
    s = filt(pulses, 'band', [500, 1400], 2) * 3 + filt(pulses, 'band', [1800, 3200], 2) * 1.5
    s += filt(saw(rate * 4, x), 'band', [600, 1600]) * 0.12
    return s * np.minimum(1, x / 0.2) * np.clip((d - x) / 0.2, 0, 1)


# ---------------- comedy palette ----------------
def pizz(n, d=0.45):
    """Karplus-Strong pluck, processed one period at a time"""
    f = midi(n); p = max(2, int(SR / f)); M = int(d * SR)
    buf = rng.uniform(-1, 1, p); out = np.zeros(M); k = 0
    while k < M:
        m = min(p, M - k); out[k:k + m] = buf[:m]
        buf = 0.5 * (buf + np.roll(buf, -1)) * 0.993
        k += p
    out = filt(out, 'low', 3500)
    return out * np.clip((d - tt(d)[:M]) / 0.05, 0, 1)


def tuba(n, d=0.38, scoop=True):
    x = tt(d); f = midi(n) * (1 - 0.06 * np.exp(-x / 0.03) if scoop else 1)
    s = saw(f, x) * 0.8 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6
    # time-varying brightness: blend two fixed filters by the envelope
    s = filt(s, 'low', 1100) * (np.exp(-x / 0.08)) + filt(s, 'low', 350) * (1 - np.exp(-x / 0.08))
    return np.tanh(s * 1.5) * env(x, d, 0.012, 0.06)


def woodblock(hi=True):
    x = tt(0.08); f = 1300 if hi else 950
    return np.sin(2 * np.pi * f * x) * np.exp(-x / 0.018)


def boing():
    d = 0.6; x = tt(d)
    f = 220 * (1 + 0.6 * np.sin(2 * np.pi * 14 * x) * np.exp(-x / 0.2)) * (1 + 0.5 * np.exp(-x / 0.05))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.22)


def cymbal(d=1.2):
    x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 5000) * np.exp(-x / 0.35) * 0.5


def slide_whistle(d, f0, f1):
    x = tt(d); f = f0 * (f1 / f0) ** (x / d) * (1 + 0.012 * np.sin(2 * np.pi * 6 * x))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + filt(rng.standard_normal(len(x)), 'band', [800, 3000]) * 0.04
    return s * env(x, d, 0.03, 0.08)


def pop():
    x = tt(0.1)
    return np.sin(2 * np.pi * np.cumsum(500 * (1 + 2 * np.exp(-x / 0.008))) / SR) * np.exp(-x / 0.025)


def glock(n, d=1.0):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 9)) * np.exp(-x / 0.4) * np.minimum(1, x / 0.002)


def pad(notes, d, cut=1600):
    x = tt(d)
    s = sum(np.sin(2 * np.pi * midi(n) * (1 + det / 1200) * x + rng.uniform(0, 6)) for n in notes for det in (-6, 6))
    s = filt(s / (2 * len(notes)), 'low', cut)
    return s * np.minimum(1, x / 0.6) * np.clip((d - x) / 0.8, 0, 1)


def switch_click():
    x = tt(0.05)
    return filt(rng.standard_normal(len(x)), 'band', [1500, 6000]) * np.exp(-x / 0.004)


# =============== 0-4: hook ===============
add(boom(1.8), 0.0, 0.9)                                   # hit exactly at 0.000
add(stab([45, 46, 51, 57, 58], 0.7), 0.0, 0.7)             # horror sting (cluster)
add(cymbal(0.9) * 0.6, 0.0, 0.4)
add(ting(), 0.05, 0.45, pan=0.15)
add(buzz(1.1), 0.0, 0.35, pan=0.1)
add(buzz(0.8), 1.8, 0.3, pan=0.1)
add(drone(25.8), 0.0, 0.5)
for k in range(8):                                          # sparse low pulses under the hook
    add(stacc(33 + (k % 2), 0.3, 900), 0.5 * k, 0.25)

# =============== 4-24: tension ===============
for c in (T['hook'], T['wideA'], T['screen'], T['wideB'], T['face']):
    add(cut_hit(), c, 0.55)
add(ting(), 4.05, 0.22, pan=0.4)                            # the phone buzzes again on the desk
add(buzz(0.6), 4.0, 0.15, pan=0.4)

OST = [57, 57, 60, 57, 58, 57, 64, 63]                      # A minor ostinato with b2 / b5 rubs
t = 4.0; k = 0
while t < 24.0 - 1e-6:
    inten = (t - 4) / 20
    add(stacc(OST[k % 8] - 12, 0.18), t, 0.18 + 0.2 * inten, pan=-0.25)
    if t > 8.5:
        add(stacc(OST[k % 8], 0.15, 3000), t, 0.1 + 0.15 * inten, pan=0.25)
    if t > 15.5:                                            # 16th-note doubling in the high violins
        add(stacc(OST[(k + 3) % 8] + 12, 0.1, 4000), t + 0.125, 0.07 + 0.1 * inten, pan=0.4)
    if t > 18.5 and k % 2 == 0:
        add(stacc(33, 0.22, 700), t, 0.35)                 # cellos digging in
    t += 0.25; k += 1
for i, t in enumerate(np.arange(4.0, 25.6, 0.5)):          # loud tick-tock
    add(clock_tick(i % 2 == 0), t, 0.32 if t < 24 else 0.22, pan=-0.35)
for h in HEART:
    add(heartbeat(0.5 + 0.5 * min(1, (h - 4) / 18)), h, 0.6)
for t0 in (12.2, 13.8, 19.0, 21.0, 22.6):
    add(rustle(1.2), t0, 0.35, pan=-0.5)                   # the paper monster shifting
add(filt(rng.standard_normal(int(1.6 * SR)), 'band', [200, 900]) * np.linspace(0, 1, int(1.6 * SR)) ** 2, 22.4, 0.25)  # unease swell

# =============== 24-26: the door ===============
add(creak(1.8), T['creak'], 0.75, pan=0.45)
air = filt(rng.standard_normal(int(1.9 * SR)), 'band', [3000, 9000]) * np.linspace(0.6, 0, int(1.9 * SR))
add(air, 24.0, 0.08)

# =============== 26: silly jumpscare ===============
R0 = T['reveal']
add(stab([53, 57, 60, 65, 69], 0.4), R0, 0.75)              # bright major stab (not scary)
add(cymbal(1.4), R0, 0.5)
add(boing(), R0 + 0.05, 0.45, pan=-0.2)
add(tuba(41, 0.25), R0 + 0.18, 0.55)
add(tuba(34, 0.45), R0 + 0.42, 0.6)                        # "bwa-waaa"

# =============== 26.5-33.8: comedy ===============
B = 0.5
PIZZ = [65, None, 69, 72, 70, None, 67, 64, 65, 69, 72, 77, 76, None, 72, None,
        74, None, 70, 67, 69, None, 65, 64, 62, 64, 65, 67, 69, None, None, None]
BASS = [(41, 36), (46, 41), (36, 43), (41, 36)]            # F, Bb, C, F (root / fifth)
CH = [[57, 60, 65], [58, 62, 65], [55, 60, 64], [57, 60, 65]]
start = 26.5
for bar in range(int((T['lights'] - start) / (4 * B)) + 1):
    t0 = start + bar * 4 * B
    if t0 >= T['lights'] - 0.01:
        break
    r, f5 = BASS[bar % 4]; ch = CH[bar % 4]
    for b in range(4):
        tb = t0 + b * B
        if tb >= T['lights']:
            break
        if b % 2 == 0:
            add(tuba(r if b == 0 else f5, 0.36), tb, 0.5)
        else:
            for j, n in enumerate(ch):
                add(pizz(n, 0.3), tb + j * 0.008, 0.16, pan=-0.2 + j * 0.2)
        add(woodblock(b % 2 == 1), tb + B / 2, 0.12, pan=0.5)
    for e in range(8):                                     # pizz melody in 8ths
        n = PIZZ[(bar * 8 + e) % len(PIZZ)]
        te = t0 + e * B / 2
        if n is not None and te < T['lights']:
            add(pizz(n + 12, 0.35), te, 0.3, pan=0.2)
add(slide_whistle(1.5, 1700, 380), T['shrink0'], 0.22)       # monster deflates
add(pop(), T['poof'], 0.6); add(glock(84, 0.8), T['poof'] + 0.03, 0.25)
for k, t in enumerate(np.arange(T['walk0'], T['walk1'], 0.25)):  # little footstep boops
    add(woodblock(k % 2 == 0) * 0.6, t, 0.12, pan=0.4)
add(filt(rng.standard_normal(int(0.3 * SR)), 'band', [1200, 6000]) * np.sin(np.pi * tt(0.3) / 0.3), T['hand'], 0.3)  # folder swish
add(glock(88, 0.8), T['hand'] + 0.3, 0.22)

# =============== 33.8-40: warm outro ===============
add(switch_click(), T['lights'], 0.7)
add(glock(77, 0.6), T['lights'] + 0.05, 0.15)
OUT = [([53, 57, 60, 64], 34.0), ([58, 62, 65, 69], 35.6), ([48, 55, 60, 64], 37.2), ([53, 57, 60, 65, 69], 38.4)]
for notes, t0 in OUT:
    d = 1.8 if t0 < 38 else 1.6
    add(pad(notes, d + 0.3), t0, 0.32)
    add(tuba(notes[0] - 12, 0.6, scoop=False) * 0.6, t0, 0.35)
    for j, n in enumerate(notes):
        add(pizz(n + 12, 0.6), t0 + j * 0.05, 0.12, pan=-0.3 + j * 0.2)
MEL = [(34.4, 81), (34.8, 84), (35.2, 81), (35.6, 82), (36.0, 79), (36.4, 77), (36.8, 81), (37.2, 79), (37.6, 76), (38.4, 77), (38.6, 81), (38.8, 84), (39.0, 89)]
for t0, n in MEL:
    add(glock(n, 1.2), t0, 0.2, pan=0.2)
# logo chime
for k, n in enumerate((84, 88, 91, 96)):
    add(glock(n, 1.4), T['brand'] + 0.15 + k * 0.07, 0.12, pan=-0.2 + k * 0.15)

# ---------------- master ----------------
mixd = np.stack([L, R], axis=1)
sec = np.ones(N); i0, i1 = int(26.3 * SR), int(26.6 * SR)   # lift the comedy + outro to match the tension level
sec[i0:i1] = np.linspace(1, 1.8, i1 - i0); sec[i1:] = 1.8
mixd *= sec[:, None]
for dly, g in ((0.031, 0.14), (0.053, 0.1), (0.089, 0.07), (0.131, 0.05)):   # small room
    d = int(dly * SR)
    mixd[d:, 0] += filt(mixd[:-d, 1], 'low', 5000) * g
    mixd[d:, 1] += filt(mixd[:-d, 0], 'low', 5000) * g
mixd = sosfilt(butter(2, 25, btype='high', fs=SR, output='sos'), mixd, axis=0)
fi = int(0.001 * SR); fo = int(0.4 * SR)              # no fade-in: the hit is at 0.000 s
mixd[:fi] *= np.linspace(0, 1, fi)[:, None]
mixd[-fo:] *= np.linspace(1, 0, fo)[:, None]
mixd = np.tanh(mixd * 1.2) / np.tanh(1.2)
mixd *= 0.9 / np.max(np.abs(mixd))
os.makedirs('out', exist_ok=True)
wavfile.write('out/horor-music.wav', SR, (mixd * 32767).astype(np.int16))
print('wrote out/horor-music.wav', f'{len(mixd) / SR:.3f}s')
