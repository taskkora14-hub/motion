"""Original 8-bit soundtrack + arcade SFX for "LEVEL 1: TUGAS MENYERANG!" (no voice-over).

    python3 arcade/music.py   -> out/arcade-music.wav

NES-style voices only: two pulse channels (12.5/25/50% duty), a 4-bit stepped triangle bass and
sample-and-hold noise drums. Driving A-minor chiptune at 140 BPM that accelerates to 172 BPM while
the tasks pile up, a siren break when HP runs low, then a C-major hero theme after the MINTASK
power-up and a victory fanfare for STAGE CLEAR. Every pew / hit / crash is read from sim.js so it
lands on the frame it is drawn. A hit + coin plays on sample 0 (no fade-in).
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
rng = np.random.default_rng(140)
L = np.zeros(N)
R = np.zeros(N)

SIM = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'sim.js'), '--json']))
EV = SIM['events']
TS = SIM['T']


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
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


# ---------------- NES-ish voices ----------------
def pulse_f(freq, d, duty=0.5):
    """pulse wave from a frequency curve (array) or constant"""
    x = tt(d)
    f = np.broadcast_to(freq, x.shape) if np.ndim(freq) else np.full_like(x, freq)
    ph = np.cumsum(f) / SR
    return np.where((ph % 1.0) < duty, 1.0, -1.0)


def env(x, d, a=0.002, decay=None, rel=0.02, sus=1.0):
    e = np.minimum(1, x / a)
    if decay:
        e = e * (sus + (1 - sus) * np.exp(-x / decay))
    return e * np.clip((d - x) / rel, 0, 1)


def sq(n, d, duty=0.25, vib=0.0, decay=None, sus=1.0, slide=0.0):
    x = tt(d)
    f = midi(n) * 2 ** ((slide * np.clip(x / 0.05, 0, 1) - slide) / 12)  # slide up into the note
    if vib:
        f = f * (1 + vib * np.sin(2 * np.pi * 6 * x) * np.clip((x - 0.12) / 0.1, 0, 1))
    return pulse_f(f, d, duty) * env(x, d, decay=decay, sus=sus)


def tri(n, d):
    x = tt(d)
    ph = (midi(n) * x) % 1.0
    v = 4 * np.abs(ph - 0.5) - 1
    v = np.round(v * 7.5) / 7.5                                           # 4-bit stepped triangle
    return v * env(x, d, a=0.001, rel=0.01)


def noise(d, rate):
    """sample-and-hold noise: lower 'rate' = crunchier, more 8-bit"""
    n = int(d * SR)
    hold = max(1, int(SR / rate))
    v = rng.choice([-1.0, 1.0], size=n // hold + 2)
    return np.repeat(v, hold)[:n]


def kick():
    x = tt(0.14)
    f = 50 + 180 * np.exp(-x / 0.02)
    return pulse_f(f, 0.14, 0.5) * np.exp(-x / 0.05) * 0.9


def snare(d=0.16):
    x = tt(d)
    return noise(d, 9000) * np.exp(-x / 0.05) * 0.8 + pulse_f(190, d, 0.5) * np.exp(-x / 0.02) * 0.3


def hat(d=0.04, open_=False):
    d = 0.14 if open_ else d
    x = tt(d)
    return filt(noise(d, 22000), 'high', 6000) * np.exp(-x / (0.05 if open_ else 0.012)) * 0.5


def crash(d=1.2):
    x = tt(d)
    return filt(noise(d, 16000), 'high', 2500) * np.exp(-x / 0.35) * 0.5


# ---------------- arcade SFX ----------------
def coin():
    return np.concatenate([sq(83, 0.07, 0.5), sq(88, 0.42, 0.5, decay=0.12, sus=0.0)])


def impact():
    x = tt(0.7)
    f = 30 + 260 * np.exp(-x / 0.06)
    return pulse_f(f, 0.7, 0.5) * np.exp(-x / 0.18) * 0.8 + noise(0.7, 3000) * np.exp(-x / 0.12) * 0.7


def pew(seed=0):
    x = tt(0.11)
    f0 = 1500 + (seed % 5) * 90
    f = f0 * np.exp(-x / 0.035) + 220
    return pulse_f(f, 0.11, 0.25) * np.exp(-x / 0.05)


def boom(size=1.0):
    d = 0.22 + 0.3 * size
    x = tt(d)
    return noise(d, 2500 + 2500 * (1 - size)) * np.exp(-x / (0.05 + 0.1 * size)) + pulse_f(90 * np.exp(-x / 0.1) + 40, d, 0.5) * np.exp(-x / 0.06) * 0.4


def hurt():
    return np.concatenate([sq(64, 0.06, 0.5), sq(58, 0.06, 0.5), sq(52, 0.12, 0.5, decay=0.05, sus=0.0)])


def powerup():
    notes = [60, 64, 67, 72, 64, 67, 72, 76, 67, 72, 76, 79, 72, 76, 79, 84]
    return np.concatenate([sq(n, 0.035, 0.125) for n in notes] + [sq(84, 0.25, 0.125, vib=0.02, decay=0.1, sus=0.2)])


def laser():
    d = 1.15
    x = tt(d)
    f = 2400 * np.exp(-x / 0.18) + 180 + 40 * np.sin(2 * np.pi * 30 * x)
    beam = pulse_f(f, d, 0.125) * np.exp(-x / 0.5)
    body = pulse_f(f * 0.5, d, 0.5) * np.exp(-x / 0.3) * 0.5
    return (beam + body) * 0.7 + noise(d, 7000) * np.exp(-x / 0.25) * 0.35


def blip(n=84, d=0.03):
    return sq(n, d, 0.5)


def twinkle():
    return np.concatenate([sq(n, 0.05, 0.125, decay=0.03, sus=0.2) for n in (91, 96, 100, 103)])


def alarm():
    return np.concatenate([sq(81, 0.09, 0.5), sq(76, 0.09, 0.5)])


# ---------------- tempo map ----------------
def bpm(t):
    if t < 14:
        return 140.0
    if t < 26:
        return 140 + 32 * (t - 14) / 12        # the pile-up: 140 -> 172
    return 172.0


beats = [0.0]
ph, t, dt = 0.0, 0.0, 1e-4
while t < TS['LASER']:
    ph += bpm(t) / 60 * dt
    t += dt
    if ph >= len(beats):
        beats.append(t)
beats = [b for b in beats if b < TS['LASER'] - 0.05]

# A minor: Am - F - G - Em | Am - F - C - G   (original progression/melody)
PROG = [(57, [69, 72, 76]), (53, [65, 69, 72]), (55, [67, 71, 74]), (52, [64, 67, 71]),
        (57, [69, 72, 76]), (53, [65, 69, 72]), (48, [64, 67, 72]), (55, [67, 71, 74])]
# lead: 16 sixteenth-steps per bar, None = rest, -1 = hold
LEAD = [
    [81, -1, 79, 81, -1, 76, -1, 74, 76, -1, 72, -1, 74, -1, 76, -1],
    [77, -1, -1, 76, 77, -1, 81, -1, 79, -1, 77, -1, 76, -1, -1, None],
    [79, -1, 74, 79, -1, 83, -1, 81, 79, -1, 74, -1, 71, -1, 74, -1],
    [76, -1, -1, -1, 79, -1, 76, -1, 71, -1, 74, -1, 76, -1, -1, None],
    [81, -1, 84, 81, -1, 79, -1, 81, 84, -1, 86, -1, 88, -1, 84, -1],
    [86, -1, -1, 84, 81, -1, 77, -1, 81, -1, 84, -1, 86, -1, -1, None],
    [84, -1, 88, 84, -1, 79, -1, 76, 79, -1, 84, -1, 88, -1, 91, -1],
    [86, -1, -1, -1, 83, -1, 86, -1, 91, -1, 89, -1, 88, -1, 86, -1],
]


def play_lead(pattern, steps, gain, duty=0.25, pan=0.0, octave=0):
    """steps: list of 16 start times (+ end time) for the bar"""
    i = 0
    while i < 16:
        n = pattern[i]
        if n is None or n == -1:
            i += 1
            continue
        j = i + 1
        while j < 16 and pattern[j] == -1:
            j += 1
        d = steps[j] - steps[i]
        add(sq(n + octave, d * 0.95, duty, vib=0.012 if d > 0.2 else 0, slide=0.4 if d > 0.2 else 0), steps[i], gain, pan)
        i = j


nbars = (len(beats) - 1) // 4
for bar in range(nbars + 1):
    b0 = bar * 4
    if b0 >= len(beats):
        break
    bt = beats[b0:b0 + 5]
    if len(bt) < 5:                                     # last partial bar: extrapolate the grid
        step = bt[-1] - bt[-2] if len(bt) > 1 else 60 / 172
        bt = bt + [bt[-1] + step * k for k in range(1, 6 - len(bt))]
    st = []
    for k in range(4):
        st += list(np.linspace(bt[k], bt[k + 1], 5)[:4])
    st.append(bt[4])
    t0 = bt[0]
    if t0 >= TS['LASER'] - 0.05:
        break
    alarm_mode = t0 >= TS['POWER'] - 0.3                # 26.1+ : siren break before the power-up
    root, ch = PROG[bar % 8]

    # --- drums ---
    for k in range(4):
        if bt[k] >= TS['LASER'] - 0.05:
            break
        add(kick(), bt[k], 0.55 if k in (0, 2) or t0 > 16 else 0.4)
        if k in (1, 3):
            add(snare(), bt[k], 0.42)
        for e in range(4 if t0 > 10 else 2):
            sub = st[k * 4 + e * (4 // (4 if t0 > 10 else 2))]
            add(hat(), sub, 0.35 if e % 2 else 0.22, pan=0.25)
    if bar % 4 == 3 or alarm_mode:                      # snare fill closing each phrase
        for s in range(12, 16):
            add(snare(0.08), st[s], 0.25 + 0.05 * (s - 12))
    if bar % 8 == 0 and bar > 0:
        add(crash(), t0, 0.35)

    # --- triangle bass: driving 8ths with octave jumps ---
    for s in range(0, 16, 2):
        n = root - 12 + (12 if s in (6, 14) else 0)
        add(tri(n, (st[s + 2] - st[s]) * 0.9), st[s], 0.55)

    # --- arpeggio (pulse 12.5%), doubled once the pile-up starts ---
    for s in range(16):
        n = ch[s % 3] + (12 if (s // 3) % 2 and t0 > 20 else 0)
        d = st[s + 1] - st[s]
        add(sq(n, d * 0.6, 0.125, decay=0.04, sus=0.3), st[s], 0.11, pan=-0.3)
        if t0 > 20:                                     # 32nd-note double-time shimmer when it gets hectic
            add(sq(n + 12, d * 0.3, 0.125), st[s] + d / 2, 0.05, pan=0.3)

    # --- lead ---
    if alarm_mode:
        for s in range(0, 16, 2):                       # siren alternation
            add(sq(81 if (s // 2) % 2 == 0 else 80, (st[s + 2] - st[s]) * 0.95, 0.5), st[s], 0.14)
    elif t0 >= 4.0 - 0.01 or bar == 0:
        g = 0.13 if t0 < 16 else 0.15
        play_lead(LEAD[bar % 8], st, g, duty=0.25 if t0 < 16 else 0.5)
        if t0 >= 16:                                    # harmony on the 2nd pulse a sixth below
            play_lead([None if v is None else (-1 if v == -1 else v - 8) for v in LEAD[bar % 8]], st, 0.06, duty=0.125, pan=0.35)

# ---------------- hook SFX ----------------
add(impact(), 0.0, 0.9)          # the hit on frame 0
add(coin(), 0.0, 0.32)           # CRT powers on with an insert-coin
add(crash(1.6), 0.0, 0.4)
for k, n in enumerate([69, 72, 76, 81]):            # "LEVEL 1" stinger rising under the title
    add(sq(n, 0.09, 0.5), 0.12 + k * 0.09, 0.16, pan=0.2)
add(sq(57 + 24, 0.28, 0.5, decay=0.1, sus=0.3), 0.48, 0.14)
add(impact() * 0.5, 4.0, 0.5)                        # game on: title glitches away
for k in range(8):
    add(blip(96 - k * 3, 0.02), 3.55 + k * 0.035, 0.08)

# ---------------- gameplay SFX (from the sim) ----------------
for i, e in enumerate(EV):
    t = e['t']
    if e['type'] == 'shot':
        add(pew(i), t, 0.17, pan=(e['x'] - 135) / 300)
    elif e['type'] == 'kill':
        add(boom(0.35), t, 0.3, pan=(e['x'] - 135) / 300)
        add(blip(96, 0.025), t + 0.02, 0.05)
    elif e['type'] == 'crash':
        add(boom(1.0), t, 0.42, pan=(e['x'] - 135) / 300)
        add(hurt(), t + 0.03, 0.15)
    elif e['type'] == 'clear':
        add(boom(0.55), t, 0.22, pan=(e['x'] - 135) / 300)
        add(blip(100, 0.03), t + 0.02, 0.05)
# low-HP alarm beeps every 0.5 s while HP < 40%
low = [e['t'] for e in EV if e['type'] == 'crash' and e['hp'] < 0.4]
if low:
    t = low[0] + 0.2
    while t < TS['CATCH'] - 0.1:
        add(alarm(), t, 0.07, pan=-0.2)
        t += 0.5

# deadline banner beeps (21 – 26.2, blinking 2.5 Hz)
t = 21.0
while t < TS['POWER'] - 0.2:
    add(blip(93, 0.05), t, 0.05, pan=0.4)
    t += 0.4

# ---------------- power-up + laser ----------------
for k in range(5):
    add(twinkle(), TS['POWER'] + k * 0.6, 0.1, pan=0.3)
add(powerup(), TS['CATCH'], 0.3)
add(crash(1.4), TS['LASER'], 0.45)
add(laser(), TS['LASER'], 0.55)
add(impact(), TS['LASER'], 0.55)

# ---------------- 30 – 34: hero theme in C major (140 BPM) ----------------
B = 60 / 140
h0 = 30.35
HERO = [(72, 1), (76, 1), (79, 1.5), (77, 0.5), (76, 1), (74, 1), (76, 2),
        (79, 1), (81, 1), (84, 2), (83, 0.5), (84, 0.5), (86, 1)]
HCH = [(48, [64, 67, 72]), (55, [67, 71, 74]), (57, [69, 72, 76]), (53, [65, 69, 72])]
tt0 = h0
for n, d in HERO:
    if tt0 + d * B / 2 > 34.0:
        break
    add(sq(n, d * B / 2 * 0.95, 0.5, vib=0.015, slide=0.3), tt0, 0.15)
    add(sq(n - 12, d * B / 2 * 0.9, 0.25), tt0, 0.05, pan=0.3)
    tt0 += d * B / 2
k = 0
while h0 + k * B < 34.0 - 1e-6:
    tk = h0 + k * B
    root, ch = HCH[(k // 2) % 4]
    add(kick(), tk, 0.5)
    if k % 2:
        add(snare(), tk, 0.38)
    add(hat(), tk + B / 2, 0.3, pan=0.25)
    add(tri(root - 12, B * 0.45), tk, 0.55)
    add(tri(root, B * 0.4), tk + B / 2, 0.45)
    for s in range(4):
        add(sq(ch[s % 3] + 12, B / 4 * 0.6, 0.125), tk + s * B / 4, 0.07, pan=-0.3)
    k += 1
add(crash(1.0), h0, 0.3)
for k, n in enumerate([72, 76, 79, 84, 88]):        # "BANTUAN DATANG." 1-up jingle
    add(sq(n, 0.07, 0.5), 30.9 + k * 0.07, 0.12, pan=-0.2)
for c in range(14):                                  # letters typing in
    add(blip(98, 0.015), 30.9 + c * 0.06, 0.04)

# ---------------- 34 – 37: STAGE CLEAR fanfare ----------------
F0 = 34.0
FAN = [(67, 0.12), (72, 0.12), (76, 0.12), (79, 0.24), (76, 0.12), (79, 0.6),
       (81, 0.12), (79, 0.12), (77, 0.12), (76, 0.24), (74, 0.24), (72, 0.9)]
add(impact() * 0.7, F0, 0.6)
add(crash(2.0), F0, 0.45)
tf = F0 + 0.02
for n, d in FAN:
    add(sq(n, d * 0.95, 0.5, vib=0.015), tf, 0.17)
    add(sq(n - 5 if n > 70 else n - 3, d * 0.95, 0.25), tf, 0.07, pan=0.3)
    tf += d
FCH = [(48, 0.0), (53, 0.72), (55, 1.44), (48, 2.16)]
for root, off in FCH:
    for s in range(6):
        add(tri(root - 12 if s % 2 == 0 else root, 0.11), F0 + off + s * 0.12, 0.55)
    add(kick(), F0 + off, 0.5)
    add(snare(), F0 + off + 0.36, 0.35)
# score tally ticks 34.7 – 36.0
t = 34.7
while t < 36.0:
    add(blip(88 + int((t - 34.7) * 8), 0.018), t, 0.07, pan=0.2)
    t += 0.045
for k, n in enumerate([84, 88, 91, 96]):            # NEW HI-SCORE
    add(sq(n, 0.08, 0.125), 36.05 + k * 0.08, 0.13)
add(sq(96, 0.5, 0.125, vib=0.02, decay=0.15, sus=0.2), 36.37, 0.12)

# ---------------- 37 – 40: brand sting ----------------
L0 = TS['LOGO']
for k in range(10):                                  # pixel dissolve: rising chirps
    add(blip(72 + k * 2, 0.04), L0 + k * 0.045, 0.08, pan=-0.4 + k * 0.08)
add(impact() * 0.6, L0 + 0.45, 0.5)
add(crash(2.5), L0 + 0.45, 0.4)
for k in range(6):                                   # logo resolving: one blip per resolution step
    add(blip(84 + k * 2, 0.03), L0 + 0.45 + k * 0.08, 0.08)
# final chord C major, arpeggiated then held — victory
for k, n in enumerate([60, 64, 67, 72, 76, 79, 84]):
    add(sq(n, 0.06, 0.125), L0 + 0.5 + k * 0.05, 0.1, pan=-0.3 + k * 0.1)
for n, duty, g, pan in ((72, 0.5, 0.1, -0.2), (76, 0.25, 0.08, 0.2), (79, 0.25, 0.07, 0.0)):
    add(sq(n, 2.4, duty, vib=0.01, decay=0.8, sus=0.35), L0 + 0.9, g, pan)
add(tri(48, 2.4), L0 + 0.9, 0.6)
add(tri(36, 2.4), L0 + 0.9, 0.3)
for k in range(4):                                   # little march under the tagline
    add(kick(), L0 + 0.9 + k * B, 0.4)
    add(hat(open_=True), L0 + 0.9 + k * B + B / 2, 0.22)
for c in range(25):                                  # tagline typing
    add(blip(100, 0.012), L0 + 1.45 + c * 0.035, 0.035)
for k, n in enumerate([84, 79, 84, 91]):            # "ADA TASK? TASKKORA-IN AJA." button sting
    add(sq(n, 0.1, 0.5), L0 + 2.45 + k * 0.1, 0.12)
add(sq(96, 0.55, 0.5, vib=0.02, decay=0.2, sus=0.15), L0 + 2.85, 0.1)

# ---------------- master ----------------
mix = np.stack([L, R], axis=1)
mix = np.stack([filt(mix[:, 0], 'low', 11000), filt(mix[:, 1], 'low', 11000)], axis=1)   # tame aliasing
mix = np.stack([filt(mix[:, 0], 'high', 30), filt(mix[:, 1], 'high', 30)], axis=1)
for dly, g in ((0.045, 0.1), (0.09, 0.06)):          # tiny slapback "arcade cabinet" room
    d = int(dly * SR)
    mix[d:, 0] += mix[:-d, 1] * g
    mix[d:, 1] += mix[:-d, 0] * g
fade = np.ones(N)
fi = int(0.001 * SR)                                 # 1 ms de-click only: the hit lands on frame 0
fo = int(0.35 * SR)
fade[:fi] = np.linspace(0.6, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/arcade-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/arcade-music.wav', f'{N / SR:.2f}s', f'{len(beats)} beats, last beat {beats[-1]:.2f}s')
