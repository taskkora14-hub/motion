"""Original era-hopping score + SFX for "tugas kuliah: dulu vs sekarang." (no voice-over).

    python3 era/music.py   -> out/era-music.wav

Each musical style starts exactly on its swipe in era/anim.js (SW):
  0-8     soft 1950s jazz trio, 120 BPM swing (F major ii-V-I)         + typewriter, bell, paper rip, tip-ex
  8-12.5  1980s synth pop, 106.67 BPM (2 bars, A minor)                + floppy clunk, drive seek, PC-speaker error beep
  12.5-17 1990s chiptune, 160 BPM (3 bars, E minor)                    + dial-up modem, mouse clicks, queue bell
  17-22   2010s lo-fi beat, 96 BPM (2 bars, Dmaj9 / Gmaj7), vinyl dust + USB blip, low-battery beeps, power-down
  22-34   clean electronic, 120 BPM (light at 22, full drop at 26)     + comment pings, chat send/receive, blue-check chimes
  34-40   electronic outro + logo swell
Every swipe gets a whoosh; the hit + typewriter slam land at 0.000 s.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(1958)
SW = [0, 8.0, 12.5, 17.0, 22.0, 26.0, 34.0]
SECTIONS = [(0, 8.0), (8.0, 12.5), (12.5, 17.0), (17.0, 22.0), (22.0, DUR)]   # one buffer per musical style
sec_bufs = [np.zeros((N, 2)) for _ in SECTIONS]
CUR = [sec_bufs[0]]
sfx = np.zeros((N, 2))


def KEYS(start, stop, gaps):
    a, t, i = [], start, 0
    while t < stop:
        a.append(t); t += gaps[i % len(gaps)]; i += 1
    return a, i


K1, _ = KEYS(0, 2.7, [0.11, 0.13, 0.1, 0.16, 0.12])
_a, _i = KEYS(4.3, 5.5, [0.12, 0.15, 0.11, 0.18])
K2 = list(_a)
t_, i_ = 6.75, _i
while t_ < 7.6:
    K2.append(t_); t_ += [0.12, 0.15, 0.11, 0.18][i_ % 4]; i_ += 1


def add(sig, t0, gain=1.0, pan=0.0, bus=None):
    b = CUR[0] if bus is None else bus
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    b[i:i + len(sig), 0] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
    b[i:i + len(sig), 1] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414


def fx(sig, t0, gain=1.0, pan=0.0):
    add(sig, t0, gain, pan, sfx)


def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig, axis=0)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def saw(f, x, ph=0.0):
    return 2 * ((np.cumsum(np.broadcast_to(f, x.shape)) / SR + ph) % 1.0) - 1


def sq(f, x, duty=0.5):
    return np.where((np.cumsum(np.broadcast_to(f, x.shape)) / SR) % 1.0 < duty, 1.0, -1.0)


def env(x, d, a=0.005, rel=0.04):
    return np.minimum(1, x / a) * np.clip((d - x) / rel, 0, 1)


def noise(d):
    return rng.standard_normal(len(tt(d)))


# ======================= instruments =======================
# --- jazz ---
def upright(n, d):
    x = tt(d); f = midi(n)
    s = np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x) * np.exp(-x / 0.1) + 0.15 * np.sin(6 * np.pi * f * x) * np.exp(-x / 0.05)
    return s * np.exp(-x / 0.35) * env(x, d, 0.004, 0.05)


def piano(notes, d, vel=1.0):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n)
        for h, a in ((1, 1), (2, 0.45), (3, 0.2), (4, 0.1)):
            s += a * np.sin(2 * np.pi * f * h * (1 + 0.0004 * h) * x) * np.exp(-x * (1.6 + h * 0.9))
    return s / len(notes) * vel * env(x, d, 0.003, 0.08)


def ride():
    d = 0.5; x = tt(d)
    s = sum(np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) for f in (3150, 4220, 5340, 6870)) / 4
    return (s * 0.5 + filt(noise(d), 'high', 6000) * 0.5) * np.exp(-x / 0.18) * 0.5


def brush(d=0.22):
    x = tt(d)
    return filt(noise(d), 'band', [1500, 7000]) * np.sin(np.pi * x / d) * 0.35


# --- 80s ---
def linn_kick():
    x = tt(0.3); f = 50 + 100 * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12)


def gated_snare():
    d = 0.28; x = tt(d)
    s = filt(noise(d), 'band', [800, 7000]) * 0.7 + np.sin(2 * np.pi * 185 * x) * np.exp(-x / 0.04)
    gate = np.where(x < 0.2, 1.0, np.exp(-(x - 0.2) / 0.01))
    return s * (0.4 + 0.6 * np.exp(-x / 0.05)) * gate


def synth_brass(notes, d):
    x = tt(d)
    s = sum(saw(midi(n), x, rng.uniform()) + saw(midi(n) * 1.006, x, rng.uniform()) for n in notes) / (2 * len(notes))
    bright = filt(s, 'low', 3000); dark = filt(s, 'low', 900)
    e = np.exp(-x / 0.15)
    return (bright * e + dark * (1 - e)) * env(x, d, 0.03, 0.08)


def synth_bass(n, d):
    x = tt(d)
    return filt(saw(midi(n), x) + sq(midi(n) * 0.5, x) * 0.5, 'low', 1200) * np.exp(-x / 0.15) * env(x, d, 0.003, 0.02)


def arp_note(n, d):
    x = tt(d)
    return filt(sq(midi(n), x, 0.3), 'low', 4000) * np.exp(-x / 0.08) * env(x, d, 0.002, 0.02)


# --- chiptune ---
def pulse(n, d, duty=0.25):
    x = tt(d)
    return sq(midi(n), x, duty) * env(x, d, 0.002, 0.01)


def tri(n, d):
    x = tt(d); ph = midi(n) * x % 1.0
    return np.round((4 * np.abs(ph - 0.5) - 1) * 8) / 8 * env(x, d, 0.002, 0.01)


def nkick():
    x = tt(0.12)
    return sq(60 + 200 * np.exp(-x / 0.02), x) * np.exp(-x / 0.04) * 0.8


def nsnare():
    x = tt(0.12)
    return rng.choice([-1.0, 1.0], len(x)) * np.exp(-x / 0.04) * 0.6


def nhat():
    x = tt(0.03)
    return filt(rng.choice([-1.0, 1.0], len(x)), 'high', 7000) * np.exp(-x / 0.008) * 0.5


# --- lo-fi ---
def rhodes(notes, d):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        f = midi(n); ph = 2 * np.pi * f * x
        s += np.sin(ph + 1.2 * np.sin(ph) * np.exp(-x / 0.3)) * np.exp(-x / 1.2)
    s *= 1 + 0.12 * np.sin(2 * np.pi * 4.5 * x)               # tremolo
    return filt(s / len(notes), 'low', 2200) * env(x, d, 0.006, 0.1)


def dusty_kick():
    x = tt(0.35); f = 45 + 70 * np.exp(-x / 0.04)
    return filt(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.18), 'low', 900) * 1.2


def dusty_snare():
    d = 0.25; x = tt(d)
    return filt(noise(d), 'band', [900, 4500]) * np.exp(-x / 0.07) * 0.6 + np.sin(2 * np.pi * 170 * x) * np.exp(-x / 0.05) * 0.3


def soft_hat():
    x = tt(0.06)
    return filt(noise(0.06), 'band', [5000, 9000]) * np.exp(-x / 0.015) * 0.4


def sub_bass(n, d):
    x = tt(d)
    return np.sin(2 * np.pi * midi(n) * x) * env(x, d, 0.01, 0.06)


# --- electronic ---
def ekick():
    x = tt(0.3); f = 46 + 130 * np.exp(-x / 0.025)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.14) * 1.6)


def eclap():
    d = 0.25; x = tt(d); n = filt(noise(d), 'band', [1000, 6000]); e = np.zeros_like(x)
    for o in (0, 0.01, 0.02):
        e += (x >= o) * np.exp(-np.maximum(0, x - o) / (0.008 if o < 0.02 else 0.06))
    return n * e * 0.6


def ehat(open_=False):
    d = 0.15 if open_ else 0.04; x = tt(d)
    return filt(noise(d), 'high', 8000) * np.exp(-x / (0.05 if open_ else 0.01)) * 0.45


def epluck(n, d):
    x = tt(d); f = midi(n)
    s = saw(f, x) * 0.5 + sq(f, x, 0.5) * 0.3 + np.sin(2 * np.pi * f * 2 * x) * 0.3
    return filt(s * np.exp(-x / 0.18), 'low', 4500) * env(x, d, 0.002, 0.03)


def epad(notes, d, cut=2400):
    x = tt(d)
    s = sum(saw(midi(n) * 2 ** (det / 1200), x, rng.uniform()) for n in notes for det in (-8, 0, 8)) / (3 * len(notes))
    return filt(s, 'low', cut) * env(x, d, 0.4, 0.5)


def ebass(n, d):
    x = tt(d); f = midi(n)
    return (np.sin(2 * np.pi * f * x) * 0.9 + filt(saw(f, x), 'low', 600) * 0.4) * env(x, d, 0.004, 0.03)


# ======================= SFX =======================
def hit0():
    d = 1.0; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 90 * np.exp(-x / 0.07)) / SR) * np.exp(-x / 0.35)
    return np.tanh(sub * 1.5) + filt(noise(d), 'low', 3000) * np.exp(-x / 0.05) * 0.5


def type_key(v=1.0):
    d = 0.09; x = tt(d)
    clack = filt(noise(d), 'band', [1500, 6000]) * np.exp(-x / 0.006) * 1.2
    body = np.sin(2 * np.pi * 420 * x) * np.exp(-x / 0.02) * 0.5 + filt(noise(d), 'low', 600) * np.exp(-x / 0.015) * 0.6
    return (clack + body) * v


def bell(f=2100):
    d = 1.2; x = tt(d)
    return (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 5)) * np.exp(-x / 0.4)


def ratchet(d):
    """carriage return / ratchet zip"""
    x = tt(d); clicks = (np.sin(2 * np.pi * 38 * x) > 0.95).astype(float)
    return filt(clicks, 'band', [1200, 5000]) * 6 * env(x, d, 0.01, 0.05)


def rip(d=0.35):
    x = tt(d)
    am = (rng.random(len(x)) > 0.6).astype(float)
    am = filt(am, 'low', 300)
    return filt(noise(d), 'band', [1500, 8000]) * am * 2.5 * env(x, d, 0.01, 0.05)


def whoosh(d=0.45, up=True):
    x = tt(d); n = noise(d); out = np.zeros_like(x); k = 8
    for i in range(k):
        c = (i + 0.5) / k; f = 300 * (25 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.4, 19000)]) * np.clip(1 - np.abs(x / d - c) * k / 1.6, 0, 1)
    return out * np.sin(np.pi * x / d) ** 1.5 * 0.9


def soft_swish(d):
    x = tt(d)
    return filt(noise(d), 'band', [600, 3000]) * np.sin(np.pi * x / d) * 0.4


def clunk():
    d = 0.2; x = tt(d)
    return filt(noise(d), 'low', 1800) * np.exp(-x / 0.02) * 1.2 + np.sin(2 * np.pi * 140 * x) * np.exp(-x / 0.03)


def drive_seek(d):
    x = tt(d)
    steps = np.sign(np.sin(2 * np.pi * 9 * x)) * (np.sin(2 * np.pi * 1.3 * x) > -0.2)
    buzz = sq(110 + 40 * steps, x, 0.5) * 0.4 + filt(noise(d), 'band', [300, 1200]) * 0.4
    return filt(buzz, 'low', 2500) * (0.5 + 0.5 * np.abs(steps)) * env(x, d, 0.02, 0.05)


def pc_beep(d=0.35, f=880):
    x = tt(d)
    return sq(f, x, 0.5) * env(x, d, 0.002, 0.01) * 0.5


def mouse_click():
    x = tt(0.04)
    return filt(noise(0.04), 'band', [2000, 8000]) * np.exp(-x / 0.003) + filt(noise(0.04), 'band', [2000, 8000]) * np.exp(-np.maximum(0, x - 0.022) / 0.002) * (x > 0.022) * 0.7


def dialup():
    """generic modem connect: dial tone, DTMF digits, ringback, answer tone, handshake hiss"""
    parts = []
    x = tt(0.45); parts.append((np.sin(2 * np.pi * 350 * x) + np.sin(2 * np.pi * 440 * x)) * 0.35)
    for lo, hi in ((697, 1336), (770, 1209), (852, 1477), (697, 1209), (941, 1336), (770, 1477)):
        x = tt(0.09); parts.append((np.sin(2 * np.pi * lo * x) + np.sin(2 * np.pi * hi * x)) * 0.35); parts.append(np.zeros(int(0.05 * SR)))
    x = tt(0.4); parts.append(np.sin(2 * np.pi * 2100 * x) * 0.3)
    x = tt(0.5); parts.append(sq(1650 + 50 * np.sign(np.sin(2 * np.pi * 30 * x)), x, 0.5) * 0.18)
    x = tt(0.35); parts.append(sum(np.sin(2 * np.pi * f * x) for f in (600, 1200, 2400)) / 3 * 0.35 * np.exp(-x / 0.2))
    x = tt(1.0); hs = filt(noise(1.0), 'band', [800, 3500]) * 0.35 * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 7 * x)))
    parts.append(hs * env(x, 1.0, 0.02, 0.2))
    return filt(np.concatenate(parts), 'band', [300, 3400])          # phone-line band


def ding_dong():
    a = bell(1318) * 0.6; b = bell(1047) * 0.6
    out = np.zeros(len(a) + int(0.3 * SR)); out[:len(a)] += a; out[int(0.3 * SR):] += b[: len(out) - int(0.3 * SR)]
    return out


def usb_blip():
    out = np.zeros(int(0.35 * SR))
    for k, f in enumerate((660, 990)):
        x = tt(0.14); s = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.06)
        i = int(k * 0.12 * SR); out[i:i + len(s)] += s
    return out


def low_batt():
    out = np.zeros(int(0.5 * SR))
    for k in range(2):
        x = tt(0.12); s = np.sin(2 * np.pi * 1200 * x) * env(x, 0.12, 0.003, 0.02)
        i = int(k * 0.2 * SR); out[i:i + len(s)] += s
    return out * 0.6


def power_down():
    d = 0.9; x = tt(d)
    f = 900 * np.exp(-x / 0.25) + 40
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.4) * 0.7


def ping(f=1760):
    x = tt(0.35)
    return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 1.5 * x)) * np.exp(-x / 0.1) * np.minimum(1, x / 0.002)


def send_swoosh():
    return whoosh(0.22, up=True) * 0.6


def receive():
    out = np.zeros(int(0.4 * SR))
    for k, f in enumerate((1318, 1760)):
        s = ping(f) * 0.7; i = int(k * 0.08 * SR); out[i:i + len(s)] += s[: len(out) - i]
    return out


def check_chime(k=0):
    notes = [76, 79, 81, 84, 86, 88][k % 6]
    x = tt(0.6); f = midi(notes)
    return (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2 * x) * np.exp(-x * 6)) * np.exp(-x / 0.2)


def sparkle():
    out = np.zeros(int(1.2 * SR))
    for k, n in enumerate((84, 88, 91, 96, 100)):
        s = check_chime(k) * 0.5; i = int(k * 0.06 * SR); out[i:i + len(s)] += s[: len(out) - i]
    return out


# ======================= A: 1950s jazz (0–8) =======================
CUR[0] = sec_bufs[0]
B = 0.5
SWING = 0.333 * B * 0.66                 # swung 8th offset
JZ = [(55, [65, 69, 72, 74]), (48, [64, 67, 70, 72]), (53, [64, 67, 69, 72]), (50, [66, 69, 72, 74])]   # Gm9 C13 Fmaj9 D7
for bar in range(4):
    t0 = bar * 4 * B
    root, ch = JZ[bar % 4]
    walk = [root, root + 4, root + 7, root + 9] if bar % 2 == 0 else [root, root - 1, root - 3, root - 5]
    for b in range(4):
        tb = t0 + b * B
        add(upright(walk[b] - 12, B * 0.95), tb, 0.55)
        add(ride(), tb, 0.18, pan=0.35)
        if b % 2 == 1:
            add(ride(), tb + SWING + B / 2 - SWING, 0.1, pan=0.35)
            add(brush(), tb, 0.35, pan=-0.2)
    add(piano(ch, 0.9, 0.9), t0 + B * 1.66, 0.22, pan=-0.15)
    add(piano(ch, 0.6, 0.7), t0 + B * 3.66, 0.18, pan=-0.15)
add(piano([77, 81, 84], 1.2), 6.0, 0.12, pan=0.2)

# ======================= B: 1980s synth pop (8–12.5) =======================
CUR[0] = sec_bufs[1]
BB = 60 / 106.67
s0 = SW[1]
PROG80 = [(45, [69, 72, 76]), (41, [69, 72, 77])]          # Am, F
for bar in range(2):
    t0 = s0 + bar * 4 * BB
    root, ch = PROG80[bar]
    add(synth_brass(ch, 4 * BB * 0.95), t0, 0.28)
    for e in range(8):
        te = t0 + e * BB / 2
        add(synth_bass(root - 12 + (12 if e % 2 else 0), BB / 2 * 0.9), te, 0.35)
        add(arp_note([ch[0], ch[1], ch[2], ch[1] + 12][e % 4] + 12, BB / 2 * 0.8), te, 0.08, pan=0.3)
        add(arp_note([ch[0], ch[1], ch[2], ch[1] + 12][(e + 2) % 4] + 12, BB / 4 * 0.8), te + BB / 4, 0.05, pan=-0.3)
    for b in range(4):
        tb = t0 + b * BB
        add(linn_kick(), tb, 0.6 if b % 2 == 0 else 0.45)
        if b % 2 == 1:
            add(gated_snare(), tb, 0.45)
        add(filt(noise(0.04), 'high', 7000) * np.exp(-tt(0.04) / 0.01), tb + BB / 2, 0.15, pan=0.2)

# ======================= C: 1990s chiptune (12.5–17) =======================
CUR[0] = sec_bufs[2]
CB = 60 / 160
s0 = SW[2]
PROG90 = [(40, [64, 67, 71]), (36, [64, 67, 72]), (38, [62, 66, 69])]   # Em C D
LEAD90 = [76, None, 79, 76, 74, None, 71, 74, 76, 79, 83, None, 81, 79, 76, None,
          74, None, 78, 74, 76, 78, 81, None, 83, None, 81, 79, 78, None, 76, None,
          76, 79, 83, 79, 81, 78, 74, 78, 79, None, 76, None, 76, None, None, None]
for bar in range(3):
    t0 = s0 + bar * 4 * CB
    root, ch = PROG90[bar]
    for s16 in range(16):
        ts = t0 + s16 * CB / 4
        add(pulse([ch[0], ch[1], ch[2], ch[0] + 12][s16 % 4] + 12, CB / 4 * 0.9, 0.125), ts, 0.05, pan=-0.3)
        if s16 % 2 == 0:
            add(tri(root + (12 if s16 % 4 == 2 else 0), CB / 2 * 0.9), ts, 0.35)
            n = LEAD90[(bar * 8 + s16 // 2) % len(LEAD90)]
            if n is not None:
                add(pulse(n, CB / 2 * 0.95, 0.25), ts, 0.1, pan=0.2)
        if s16 in (0, 8, 10):
            add(nkick(), ts, 0.4)
        if s16 in (4, 12):
            add(nsnare(), ts, 0.3)
        if s16 % 2 == 1:
            add(nhat(), ts, 0.2)

# ======================= D: 2010s lo-fi (17–22) =======================
CUR[0] = sec_bufs[3]
LB = 60 / 96
s0 = SW[3]
PROGLF = [(38, [57, 61, 64, 66, 69]), (43, [59, 62, 66, 69, 71])]       # Dmaj9, Gmaj9
for bar in range(2):
    t0 = s0 + bar * 4 * LB
    root, ch = PROGLF[bar]
    add(rhodes(ch, 2 * LB), t0, 0.3, pan=-0.1)
    add(rhodes(ch[1:], 1.6 * LB), t0 + 2.5 * LB, 0.2, pan=0.1)
    add(sub_bass(root, 1.8 * LB), t0, 0.4); add(sub_bass(root + 7, 1.2 * LB), t0 + 2.5 * LB, 0.32)
    sw = LB / 2 * 0.16
    for b in range(4):
        tb = t0 + b * LB
        if b in (0,):
            add(dusty_kick(), tb, 0.6); add(dusty_kick(), tb + LB * 1.5 + sw, 0.45)
        if b == 2:
            add(dusty_kick(), tb + LB * 0.5 + sw, 0.4)
        if b in (1, 3):
            add(dusty_snare(), tb + 0.02, 0.4)
        add(soft_hat(), tb, 0.25, pan=0.3); add(soft_hat(), tb + LB / 2 + sw, 0.18, pan=0.3)
crackle = np.zeros(int(5.0 * SR))
pos = rng.integers(0, len(crackle), 260); crackle[pos] = rng.uniform(-1, 1, 260)
crackle = filt(crackle, 'band', [1000, 6000]) * 3 + filt(rng.standard_normal(len(crackle)), 'low', 300) * 0.05
add(crackle, SW[3], 0.25)

# ======================= E/F: clean electronic (22–34) =======================
CUR[0] = sec_bufs[4]
EB = 0.5
PROGE = [(41, [65, 69, 72, 76]), (43, [67, 71, 74, 77]), (45, [64, 69, 72, 76]), (38, [62, 65, 69, 72])]   # Fmaj7 G7sus Am7 Dm7
LEADE = [(0, 81, 2), (2, 79, 2), (4, 76, 4), (8, 74, 2), (10, 76, 2), (12, 79, 4),
         (16, 81, 2), (18, 83, 2), (20, 84, 4), (24, 83, 2), (26, 81, 2), (28, 79, 4),
         (32, 76, 2), (34, 79, 2), (36, 81, 4), (40, 79, 2), (42, 76, 2), (44, 74, 4),
         (48, 76, 4), (52, 77, 2), (54, 79, 2), (56, 81, 8)]
LE = {s: (n, l) for s, n, l in LEADE}
kicks = []
for bar in range(9):                     # 22 .. 40 (bars of 2 s)
    t0 = SW[4] + bar * 4 * EB
    if t0 >= DUR - 0.01:
        break
    full = t0 >= SW[5]
    outro = t0 >= SW[6]
    root, ch = PROGE[bar % 4]
    add(epad(ch, 4 * EB, 1800 if not full else 2600), t0, 0.22 if not outro else 0.3)
    for s16 in range(16):
        ts = t0 + s16 * EB / 4
        if ts >= DUR - 0.3:
            break
        if full and s16 % 4 == 0 and not (outro and ts >= 38.0):
            add(ekick(), ts, 0.7); kicks.append(ts)
        if not full and s16 in (0, 8):
            add(ekick() * 0.5, ts, 0.4); kicks.append(ts)
        if full and s16 in (4, 12) and ts < 38.0:
            add(eclap(), ts, 0.45)
        if s16 % 2 == 1 or (full and s16 % 4 == 2):
            add(ehat(open_=(s16 % 4 == 2)), ts, 0.18, pan=0.25)
        if s16 % 2 == 0 and ts < 38.0:
            add(ebass(root - 12 + (12 if s16 % 4 == 2 and full else 0), EB / 2 * 0.9), ts, 0.4 if full else 0.28)
        add(epluck([ch[0], ch[2], ch[1], ch[3]][s16 % 4] + 12, EB / 4 * 1.6), ts, 0.07 if full else 0.09, pan=-0.3)
        st = (bar % 4) * 16 + s16
        if full and st in LE and ts < 38.0:
            n, l = LE[st]
            add(epluck(n, EB / 4 * l * 1.1), ts, 0.2, pan=0.15)
add(epad([53, 60, 65, 69, 72, 76], 2.0, 3000), 38.0, 0.35)
add(epluck(84, 1.5), 38.0, 0.2)
# sidechain pump on the electronic section
side = np.ones(N)
for kt in kicks:
    i = int(kt * SR); n = min(N - i, int(0.3 * SR))
    side[i:i + n] = np.minimum(side[i:i + n], 1 - 0.5 * np.exp(-tt(n / SR)[:n] / 0.08))
sec_bufs[4] *= side[:, None]

# each style lives only inside its own swipe window: the switch is exact (25 ms fades, no clicks)
sec_bufs[0] = filt(sec_bufs[0], 'band', [90, 7000])        # 1950s: a touch of old-record band-limiting
music = np.zeros((N, 2))
for (a_, b_), buf in zip(SECTIONS, sec_bufs):
    w = np.zeros(N); i0, i1 = int(a_ * SR), min(N, int(b_ * SR)); f = int(0.025 * SR)
    w[i0:i1] = 1
    if a_ > 0: w[i0:i0 + f] = np.linspace(0, 1, f)
    if b_ < DUR: w[i1 - f:i1] = np.linspace(1, 0, f)
    music += buf * w[:, None]

# ======================= SFX =======================
def hit0():
    d = 1.0; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 90 * np.exp(-x / 0.07)) / SR) * np.exp(-x / 0.35)
    return np.tanh(sub * 1.5) + filt(noise(d), 'low', 3000) * np.exp(-x / 0.05) * 0.5


def type_key(v=1.0):
    d = 0.09; x = tt(d)
    clack = filt(noise(d), 'band', [1500, 6000]) * np.exp(-x / 0.006) * 1.2
    body = np.sin(2 * np.pi * 420 * x) * np.exp(-x / 0.02) * 0.5 + filt(noise(d), 'low', 600) * np.exp(-x / 0.015) * 0.6
    return (clack + body) * v


def bell(f=2100):
    d = 1.2; x = tt(d)
    return (np.sin(2 * np.pi * f * x) + 0.5 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x * 5)) * np.exp(-x / 0.4)


def ratchet(d):
    """carriage return / ratchet zip"""
    x = tt(d); clicks = (np.sin(2 * np.pi * 38 * x) > 0.95).astype(float)
    return filt(clicks, 'band', [1200, 5000]) * 6 * env(x, d, 0.01, 0.05)


def rip(d=0.35):
    x = tt(d)
    am = (rng.random(len(x)) > 0.6).astype(float)
    am = filt(am, 'low', 300)
    return filt(noise(d), 'band', [1500, 8000]) * am * 2.5 * env(x, d, 0.01, 0.05)


def whoosh(d=0.45, up=True):
    x = tt(d); n = noise(d); out = np.zeros_like(x); k = 8
    for i in range(k):
        c = (i + 0.5) / k; f = 300 * (25 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.4, 19000)]) * np.clip(1 - np.abs(x / d - c) * k / 1.6, 0, 1)
    return out * np.sin(np.pi * x / d) ** 1.5 * 0.9


def soft_swish(d):
    x = tt(d)
    return filt(noise(d), 'band', [600, 3000]) * np.sin(np.pi * x / d) * 0.4


def clunk():
    d = 0.2; x = tt(d)
    return filt(noise(d), 'low', 1800) * np.exp(-x / 0.02) * 1.2 + np.sin(2 * np.pi * 140 * x) * np.exp(-x / 0.03)


def drive_seek(d):
    x = tt(d)
    steps = np.sign(np.sin(2 * np.pi * 9 * x)) * (np.sin(2 * np.pi * 1.3 * x) > -0.2)
    buzz = sq(110 + 40 * steps, x, 0.5) * 0.4 + filt(noise(d), 'band', [300, 1200]) * 0.4
    return filt(buzz, 'low', 2500) * (0.5 + 0.5 * np.abs(steps)) * env(x, d, 0.02, 0.05)


def pc_beep(d=0.35, f=880):
    x = tt(d)
    return sq(f, x, 0.5) * env(x, d, 0.002, 0.01) * 0.5


def mouse_click():
    x = tt(0.04)
    return filt(noise(0.04), 'band', [2000, 8000]) * np.exp(-x / 0.003) + filt(noise(0.04), 'band', [2000, 8000]) * np.exp(-np.maximum(0, x - 0.022) / 0.002) * (x > 0.022) * 0.7


def dialup():
    """generic modem connect: dial tone, DTMF digits, ringback, answer tone, handshake hiss"""
    parts = []
    x = tt(0.45); parts.append((np.sin(2 * np.pi * 350 * x) + np.sin(2 * np.pi * 440 * x)) * 0.35)
    for lo, hi in ((697, 1336), (770, 1209), (852, 1477), (697, 1209), (941, 1336), (770, 1477)):
        x = tt(0.09); parts.append((np.sin(2 * np.pi * lo * x) + np.sin(2 * np.pi * hi * x)) * 0.35); parts.append(np.zeros(int(0.05 * SR)))
    x = tt(0.4); parts.append(np.sin(2 * np.pi * 2100 * x) * 0.3)
    x = tt(0.5); parts.append(sq(1650 + 50 * np.sign(np.sin(2 * np.pi * 30 * x)), x, 0.5) * 0.18)
    x = tt(0.35); parts.append(sum(np.sin(2 * np.pi * f * x) for f in (600, 1200, 2400)) / 3 * 0.35 * np.exp(-x / 0.2))
    x = tt(1.0); hs = filt(noise(1.0), 'band', [800, 3500]) * 0.35 * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 7 * x)))
    parts.append(hs * env(x, 1.0, 0.02, 0.2))
    return filt(np.concatenate(parts), 'band', [300, 3400])          # phone-line band


def ding_dong():
    a = bell(1318) * 0.6; b = bell(1047) * 0.6
    out = np.zeros(len(a) + int(0.3 * SR)); out[:len(a)] += a; out[int(0.3 * SR):] += b[: len(out) - int(0.3 * SR)]
    return out


def usb_blip():
    out = np.zeros(int(0.35 * SR))
    for k, f in enumerate((660, 990)):
        x = tt(0.14); s = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.06)
        i = int(k * 0.12 * SR); out[i:i + len(s)] += s
    return out


def low_batt():
    out = np.zeros(int(0.5 * SR))
    for k in range(2):
        x = tt(0.12); s = np.sin(2 * np.pi * 1200 * x) * env(x, 0.12, 0.003, 0.02)
        i = int(k * 0.2 * SR); out[i:i + len(s)] += s
    return out * 0.6


def power_down():
    d = 0.9; x = tt(d)
    f = 900 * np.exp(-x / 0.25) + 40
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.4) * 0.7


def ping(f=1760):
    x = tt(0.35)
    return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 1.5 * x)) * np.exp(-x / 0.1) * np.minimum(1, x / 0.002)


def send_swoosh():
    return whoosh(0.22, up=True) * 0.6


def receive():
    out = np.zeros(int(0.4 * SR))
    for k, f in enumerate((1318, 1760)):
        s = ping(f) * 0.7; i = int(k * 0.08 * SR); out[i:i + len(s)] += s[: len(out) - i]
    return out


def check_chime(k=0):
    notes = [76, 79, 81, 84, 86, 88][k % 6]
    x = tt(0.6); f = midi(notes)
    return (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2 * x) * np.exp(-x * 6)) * np.exp(-x / 0.2)


def sparkle():
    out = np.zeros(int(1.2 * SR))
    for k, n in enumerate((84, 88, 91, 96, 100)):
        s = check_chime(k) * 0.5; i = int(k * 0.06 * SR); out[i:i + len(s)] += s[: len(out) - i]
    return out


# ======================= A: 1950s jazz (0–8) =======================
CUR[0] = sec_bufs[0]
B = 0.5
SWING = 0.333 * B * 0.66                 # swung 8th offset
JZ = [(55, [65, 69, 72, 74]), (48, [64, 67, 70, 72]), (53, [64, 67, 69, 72]), (50, [66, 69, 72, 74])]   # Gm9 C13 Fmaj9 D7
for bar in range(4):
    t0 = bar * 4 * B
    root, ch = JZ[bar % 4]
    walk = [root, root + 4, root + 7, root + 9] if bar % 2 == 0 else [root, root - 1, root - 3, root - 5]
    for b in range(4):
        tb = t0 + b * B
        add(upright(walk[b] - 12, B * 0.95), tb, 0.55)
        add(ride(), tb, 0.18, pan=0.35)
        if b % 2 == 1:
            add(ride(), tb + SWING + B / 2 - SWING, 0.1, pan=0.35)
            add(brush(), tb, 0.35, pan=-0.2)
    add(piano(ch, 0.9, 0.9), t0 + B * 1.66, 0.22, pan=-0.15)
    add(piano(ch, 0.6, 0.7), t0 + B * 3.66, 0.18, pan=-0.15)
add(piano([77, 81, 84], 1.2), 6.0, 0.12, pan=0.2)

# ======================= B: 1980s synth pop (8–12.5) =======================
CUR[0] = sec_bufs[1]
BB = 60 / 106.67
s0 = SW[1]
PROG80 = [(45, [69, 72, 76]), (41, [69, 72, 77])]          # Am, F
for bar in range(2):
    t0 = s0 + bar * 4 * BB
    root, ch = PROG80[bar]
    add(synth_brass(ch, 4 * BB * 0.95), t0, 0.28)
    for e in range(8):
        te = t0 + e * BB / 2
        add(synth_bass(root - 12 + (12 if e % 2 else 0), BB / 2 * 0.9), te, 0.35)
        add(arp_note([ch[0], ch[1], ch[2], ch[1] + 12][e % 4] + 12, BB / 2 * 0.8), te, 0.08, pan=0.3)
        add(arp_note([ch[0], ch[1], ch[2], ch[1] + 12][(e + 2) % 4] + 12, BB / 4 * 0.8), te + BB / 4, 0.05, pan=-0.3)
    for b in range(4):
        tb = t0 + b * BB
        add(linn_kick(), tb, 0.6 if b % 2 == 0 else 0.45)
        if b % 2 == 1:
            add(gated_snare(), tb, 0.45)
        add(filt(noise(0.04), 'high', 7000) * np.exp(-tt(0.04) / 0.01), tb + BB / 2, 0.15, pan=0.2)

# ======================= C: 1990s chiptune (12.5–17) =======================
CUR[0] = sec_bufs[2]
CB = 60 / 160
s0 = SW[2]
PROG90 = [(40, [64, 67, 71]), (36, [64, 67, 72]), (38, [62, 66, 69])]   # Em C D
LEAD90 = [76, None, 79, 76, 74, None, 71, 74, 76, 79, 83, None, 81, 79, 76, None,
          74, None, 78, 74, 76, 78, 81, None, 83, None, 81, 79, 78, None, 76, None,
          76, 79, 83, 79, 81, 78, 74, 78, 79, None, 76, None, 76, None, None, None]
for bar in range(3):
    t0 = s0 + bar * 4 * CB
    root, ch = PROG90[bar]
    for s16 in range(16):
        ts = t0 + s16 * CB / 4
        add(pulse([ch[0], ch[1], ch[2], ch[0] + 12][s16 % 4] + 12, CB / 4 * 0.9, 0.125), ts, 0.05, pan=-0.3)
        if s16 % 2 == 0:
            add(tri(root + (12 if s16 % 4 == 2 else 0), CB / 2 * 0.9), ts, 0.35)
            n = LEAD90[(bar * 8 + s16 // 2) % len(LEAD90)]
            if n is not None:
                add(pulse(n, CB / 2 * 0.95, 0.25), ts, 0.1, pan=0.2)
        if s16 in (0, 8, 10):
            add(nkick(), ts, 0.4)
        if s16 in (4, 12):
            add(nsnare(), ts, 0.3)
        if s16 % 2 == 1:
            add(nhat(), ts, 0.2)

# ======================= D: 2010s lo-fi (17–22) =======================
CUR[0] = sec_bufs[3]
LB = 60 / 96
s0 = SW[3]
PROGLF = [(38, [57, 61, 64, 66, 69]), (43, [59, 62, 66, 69, 71])]       # Dmaj9, Gmaj9
for bar in range(2):
    t0 = s0 + bar * 4 * LB
    root, ch = PROGLF[bar]
    add(rhodes(ch, 2 * LB), t0, 0.3, pan=-0.1)
    add(rhodes(ch[1:], 1.6 * LB), t0 + 2.5 * LB, 0.2, pan=0.1)
    add(sub_bass(root, 1.8 * LB), t0, 0.4); add(sub_bass(root + 7, 1.2 * LB), t0 + 2.5 * LB, 0.32)
    sw = LB / 2 * 0.16
    for b in range(4):
        tb = t0 + b * LB
        if b in (0,):
            add(dusty_kick(), tb, 0.6); add(dusty_kick(), tb + LB * 1.5 + sw, 0.45)
        if b == 2:
            add(dusty_kick(), tb + LB * 0.5 + sw, 0.4)
        if b in (1, 3):
            add(dusty_snare(), tb + 0.02, 0.4)
        add(soft_hat(), tb, 0.25, pan=0.3); add(soft_hat(), tb + LB / 2 + sw, 0.18, pan=0.3)
crackle = np.zeros(int(5.0 * SR))
pos = rng.integers(0, len(crackle), 260); crackle[pos] = rng.uniform(-1, 1, 260)
crackle = filt(crackle, 'band', [1000, 6000]) * 3 + filt(rng.standard_normal(len(crackle)), 'low', 300) * 0.05
add(crackle, SW[3], 0.25)

# ======================= E/F: clean electronic (22–34) =======================
CUR[0] = sec_bufs[4]
EB = 0.5
PROGE = [(41, [65, 69, 72, 76]), (43, [67, 71, 74, 77]), (45, [64, 69, 72, 76]), (38, [62, 65, 69, 72])]   # Fmaj7 G7sus Am7 Dm7
LEADE = [(0, 81, 2), (2, 79, 2), (4, 76, 4), (8, 74, 2), (10, 76, 2), (12, 79, 4),
         (16, 81, 2), (18, 83, 2), (20, 84, 4), (24, 83, 2), (26, 81, 2), (28, 79, 4),
         (32, 76, 2), (34, 79, 2), (36, 81, 4), (40, 79, 2), (42, 76, 2), (44, 74, 4),
         (48, 76, 4), (52, 77, 2), (54, 79, 2), (56, 81, 8)]
LE = {s: (n, l) for s, n, l in LEADE}
kicks = []
for bar in range(9):                     # 22 .. 40 (bars of 2 s)
    t0 = SW[4] + bar * 4 * EB
    if t0 >= DUR - 0.01:
        break
    full = t0 >= SW[5]
    outro = t0 >= SW[6]
    root, ch = PROGE[bar % 4]
    add(epad(ch, 4 * EB, 1800 if not full else 2600), t0, 0.22 if not outro else 0.3)
    for s16 in range(16):
        ts = t0 + s16 * EB / 4
        if ts >= DUR - 0.3:
            break
        if full and s16 % 4 == 0 and not (outro and ts >= 38.0):
            add(ekick(), ts, 0.7); kicks.append(ts)
        if not full and s16 in (0, 8):
            add(ekick() * 0.5, ts, 0.4); kicks.append(ts)
        if full and s16 in (4, 12) and ts < 38.0:
            add(eclap(), ts, 0.45)
        if s16 % 2 == 1 or (full and s16 % 4 == 2):
            add(ehat(open_=(s16 % 4 == 2)), ts, 0.18, pan=0.25)
        if s16 % 2 == 0 and ts < 38.0:
            add(ebass(root - 12 + (12 if s16 % 4 == 2 and full else 0), EB / 2 * 0.9), ts, 0.4 if full else 0.28)
        add(epluck([ch[0], ch[2], ch[1], ch[3]][s16 % 4] + 12, EB / 4 * 1.6), ts, 0.07 if full else 0.09, pan=-0.3)
        st = (bar % 4) * 16 + s16
        if full and st in LE and ts < 38.0:
            n, l = LE[st]
            add(epluck(n, EB / 4 * l * 1.1), ts, 0.2, pan=0.15)
add(epad([53, 60, 65, 69, 72, 76], 2.0, 3000), 38.0, 0.35)
add(epluck(84, 1.5), 38.0, 0.2)
# sidechain pump on the electronic section
side = np.ones(N)
for kt in kicks:
    i = int(kt * SR); n = min(N - i, int(0.3 * SR))
    side[i:i + n] = np.minimum(side[i:i + n], 1 - 0.5 * np.exp(-tt(n / SR)[:n] / 0.08))
sec_bufs[4] *= side[:, None]

# hard style switches on the swipes (short fades so nothing clicks)
gate = np.ones(N)
for s in SW[1:]:
    i = int(s * SR); f = int(0.025 * SR)
    seg_ = gate[i - f:i + f].copy()
    gate[i - f:i] = np.linspace(1, 0, f); gate[i:i + f] = np.linspace(0, 1, f)
# let notes from the previous style stop at the swipe: zero the tails that cross a boundary
# (instruments were added per section, so a tail crossing into the next section is cut by the dip)
music *= gate[:, None]

# ======================= SFX =======================
fx(hit0(), 0.0, 0.85)
fx(type_key(1.6), 0.0, 0.9)
fx(bell(2100) * 0.5, 0.0, 0.25, pan=0.3)
for k, t in enumerate(K1[1:]):
    fx(type_key(0.8 + 0.4 * ((k * 7) % 3) / 2), t, 0.5, pan=-0.2 + 0.4 * ((k * 3) % 5) / 4)
fx(bell(2100), 2.72, 0.35, pan=0.4)
fx(ratchet(0.18), 2.8, 0.5, pan=0.3)
fx(rip(0.36), 2.95, 0.7)
fx(whoosh(0.5), 3.3, 0.4, pan=0.4)
fx(filt(noise(0.25), 'band', [500, 3000]) * np.exp(-tt(0.25) / 0.06), 3.95, 0.4, pan=0.5)   # crumple lands
for k, t in enumerate(K2):
    fx(type_key(0.8), t, 0.45, pan=-0.1)
fx(soft_swish(0.6), 5.9, 0.5)                    # tip-ex brush
# swipes
for s in SW[1:]:
    w = whoosh(0.5)
    fx(w, s - 0.15, 0.55)
# 1988
for t in np.arange(8.55, 9.55, 0.09):
    fx(type_key(0.5), t, 0.3, pan=-0.2)
fx(clunk(), 8.5, 0.5, pan=0.4)
fx(drive_seek(1.4), 9.0, 0.35, pan=0.4)
fx(pc_beep(0.3, 880), 10.2, 0.35); fx(pc_beep(0.3, 660), 10.55, 0.35)
fx(clunk(), 10.4, 0.5, pan=0.4)                  # eject
# 1999
fx(dialup(), 12.95, 0.32, pan=0.2)
for t in (13.2, 13.5, 16.0, 16.3):
    fx(mouse_click(), t, 0.5, pan=-0.3)
for t in (14.33, 15.67):                          # "sekarang: no. 13 / 14"
    fx(ding_dong(), t, 0.25, pan=-0.4)
# 2012
fx(usb_blip(), 17.4, 0.3, pan=0.3)
fx(mouse_click(), 18.0, 0.45)
fx(low_batt(), 18.9, 0.35); fx(low_batt(), 20.0, 0.4)
fx(power_down(), 20.8, 0.45)
# 2021 comments pile up
for k in range(7):
    fx(ping(1568 + (k % 3) * 220), 22.7 + 3.0 * (k + 0.001) / 7, 0.22, pan=0.3 - 0.1 * k)
fx(mouse_click(), 22.4, 0.4)
# now: chat + checks
fx(mouse_click(), 26.45, 0.4)
fx(send_swoosh(), 26.6, 0.5, pan=0.3)
for t in np.arange(27.15, 27.6, 0.12):
    fx(type_key(0.25), t, 0.2)
fx(receive(), 27.65, 0.35, pan=-0.3)
fx(send_swoosh(), 28.1, 0.5, pan=0.3)
fx(receive(), 28.6, 0.35, pan=-0.3)
fx(whoosh(0.4), 29.8, 0.3)
fx(check_chime(0), 30.2, 0.4)
for i in range(5):
    fx(check_chime(i + 1), 31.0 + i * 0.5, 0.35, pan=-0.3 + 0.15 * i)
fx(sparkle(), 33.0, 0.3)
fx(sparkle(), 34.2, 0.25)                       # logo

# ======================= master =======================
mix = music * 0.85 + sfx
for dly, g in ((0.029, 0.1), (0.047, 0.07), (0.083, 0.05)):
    d = int(dly * SR)
    mix[d:, 0] += filt(mix[:-d, 1], 'low', 5000) * g
    mix[d:, 1] += filt(mix[:-d, 0], 'low', 5000) * g
mix = filt(mix, 'high', 25)
fi = int(0.001 * SR); fo = int(0.4 * SR)          # no fade-in: the hit is at 0.000 s
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/era-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/era-music.wav', f'{len(mix) / SR:.3f}s')
