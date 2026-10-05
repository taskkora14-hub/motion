"""Original electro-pop track + SFX for "Green flag vs red flag semester akhir" (no voice-over).

    python3 flags/music.py   -> out/flags-music.wav

120 BPM, A minor (Am - F - C - G, one chord per 2 s bar): four-on-the-floor kick, clap on 2 & 4,
off-beat open hats, sidechain-pumped supersaw chords, a pumping saw bass and a square pluck hook.
Filtered build under the hook, drop at 4.0 s when the first pair lands, half-time outro after the
flag crash. A bright ding for every green card, a low buzz for every red card (timings from
flags/timeline.js). Impact hit on sample 0 (no fade-in).
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
rng = np.random.default_rng(12)
L = np.zeros(N)
R = np.zeros(N)
S = np.zeros(N)          # sidechained bus (chords + bass)

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


def saw(f, x):
    ph = (f * x + rng.uniform()) % 1.0
    return 2 * ph - 1


# ---------------- instruments ----------------
def kick():
    x = tt(0.4); f = 46 + 160 * np.exp(-x / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.2)
    click = filt(rng.standard_normal(len(x)), 'band', [2000, 6000]) * np.exp(-x / 0.004) * 0.4
    return np.tanh((body + click) * 1.6)


def clap():
    d = 0.3; x = tt(d); n = filt(rng.standard_normal(len(x)), 'band', [900, 5000])
    env = sum(np.exp(-np.maximum(0, x - o) / 0.012) * (x >= o) for o in (0, 0.011, 0.022)) * 0.5 + np.exp(-x / 0.09) * (x >= 0.03)
    return n * env * 0.7


def hat(open_=False):
    d = 0.22 if open_ else 0.05; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 7500) * np.exp(-x / (0.07 if open_ else 0.012)) * 0.5


def supersaw(notes, d, cut=3200):
    x = tt(d); s = np.zeros_like(x)
    for n in notes:
        for det in (-0.25, -0.12, 0, 0.12, 0.25):
            s += saw(midi(n) * 2 ** (det / 12), x)
    s = filt(s / (5 * len(notes)), 'low', cut)
    return s * np.minimum(1, x / 0.01) * np.clip((d - x) / 0.05, 0, 1)


def bass(n, d):
    x = tt(d)
    s = saw(midi(n), x) * 0.6 + np.sin(2 * np.pi * midi(n) * x) * 0.8
    return filt(s, 'low', 900) * np.minimum(1, x / 0.004) * np.clip((d - x) / 0.02, 0, 1)


def pluck(n, d=0.3):
    x = tt(d); f = midi(n)
    s = np.where(((f * x) % 1) < 0.3, 1.0, -1.0) * 0.6 + saw(f * 1.005, x) * 0.4
    # moving lowpass: two fixed filters crossfaded by the envelope
    lo, hi = filt(s, 'low', 1500), filt(s, 'low', 7000)
    k = np.exp(-x / 0.05)
    out = lo * (1 - k) + hi * k
    return out * np.exp(-x / 0.12) * np.minimum(1, x / 0.002)


# ---------------- SFX ----------------
def ding():
    out = np.zeros(int(0.9 * SR))
    for k, n in enumerate((88, 95)):
        x = tt(0.9 - k * 0.07); f = midi(n)
        s = (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2.0 * x) * np.exp(-x * 10) + 0.2 * np.sin(2 * np.pi * f * 3.01 * x) * np.exp(-x * 16)) * np.exp(-x / 0.3)
        i = int(k * 0.07 * SR); out[i:i + len(s)] += s * np.minimum(1, x / 0.001)
    return out


def buzz():
    d = 0.5; x = tt(d)
    f = 74 * (1 - 0.06 * x / d)
    s = sum(np.sign(np.sin(2 * np.pi * np.cumsum(f * m) / SR)) for m in (1, 1.007, 2.0)) / 3
    s = filt(s, 'low', 1400) * (0.75 + 0.25 * np.sin(2 * np.pi * 28 * x))
    return np.tanh(s * 1.5) * np.minimum(1, x / 0.004) * np.clip((d - x) / 0.06, 0, 1) * 0.8


def impact(size=1.0):
    d = 1.0 * size; x = tt(d); f = 38 + 120 * np.exp(-x / 0.04)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / (0.28 * size))
    crack = filt(rng.standard_normal(len(x)), 'band', [1500, 9000]) * np.exp(-x / 0.05) * 0.6
    return np.tanh((boom + crack) * 1.3)


def glass():
    d = 0.8; x = tt(d); s = np.zeros_like(x)
    for k in range(18):
        t0 = rng.uniform(0, 0.25); i = int(t0 * SR); f = rng.uniform(3000, 9000)
        g = np.sin(2 * np.pi * f * x[: len(x) - i]) * np.exp(-x[: len(x) - i] / 0.04)
        s[i:] += g * rng.uniform(0.2, 1)
    return s / 6


def metal_thunk():
    x = tt(0.5)
    return sum(np.sin(2 * np.pi * f * x) * np.exp(-x / dd) for f, dd in ((310, 0.18), (847, 0.09), (1530, 0.05))) / 3


def whoosh(d=0.4, up=True):
    n = rng.standard_normal(int(d * SR)); x = tt(d) / d; out = np.zeros_like(n)
    for k in range(8):
        c = (k + 0.5) / 8; f = 400 * (18 ** (c if up else 1 - c))
        out += filt(n, 'band', [f * 0.7, min(f * 1.5, 18000)]) * np.clip(1 - np.abs(x - c) * 8, 0, 1)
    return out * np.sin(np.pi * x) ** 2 * 0.6


def riser(d):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(n)
    for k in range(10):
        c = (k + 0.5) / 10; f = 300 * (30 ** c)
        out += filt(n, 'band', [f * 0.8, min(f * 1.25, 18000)]) * np.clip(1 - np.abs(x / d - c) * 6, 0, 1)
    tone = np.sin(2 * np.pi * np.cumsum(200 * 8 ** (x / d)) / SR) * 0.3
    return (out + tone) * (x / d) ** 2


def pop(f=800):
    x = tt(0.1); ff = f * (1 + 1.2 * np.exp(-x / 0.012))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-x / 0.03)


def tick():
    x = tt(0.03)
    return filt(rng.standard_normal(len(x)), 'band', [3000, 9000]) * np.exp(-x / 0.005)


# ---------------- arrangement ----------------
PROG = [(57, [69, 72, 76]), (53, [65, 69, 72]), (48, [64, 67, 72]), (55, [67, 71, 74])]   # Am F C G
HOOKMEL = [(0, 76), (1, 79), (2, 76), (3, 74), (4, 72), (6, 74), (7, 76),
           (8, 79), (9, 81), (10, 79), (11, 76), (12, 74), (14, 72), (15, 71)]           # 8th-note grid, 2 bars


def section_bar(bar, t0, mode):
    root, ch = PROG[bar % 4]
    if mode == 'build':
        add(supersaw(ch, BAR, cut=700 + 900 * (t0 / 4)), t0, 0.22, bus=S)
        return
    full = mode == 'full'
    for b in range(4):
        tb = t0 + b * BEAT
        if full or b in (0,):
            add(kick(), tb, 0.85)
        if full and b in (1, 3) or (not full and b == 2):
            add(clap(), tb, 0.5)
        add(hat(open_=True), tb + BEAT / 2, 0.3 if full else 0.2, pan=0.25)
        for s16 in range(4):
            if full:
                add(hat(), tb + s16 * BEAT / 4, 0.18 if s16 % 2 else 0.1, pan=-0.25)
    # chords: stabs on the off-beats
    if full:
        for e in range(8):
            if e % 2 == 1 or e == 0:
                add(supersaw([n + 12 for n in ch], BEAT * 0.45, cut=4200), t0 + e * BEAT / 2, 0.2, bus=S)
        for e in range(8):
            add(bass(root - 12 + (12 if e % 4 == 3 else 0), BEAT * 0.45), t0 + e * BEAT / 2, 0.55, bus=S)
    else:
        add(supersaw(ch, BAR * 0.98, cut=2400), t0, 0.22, bus=S)
        add(bass(root - 12, BAR * 0.95), t0, 0.5, bus=S)
    # pluck hook (2-bar phrase), only in the full section
    if full:
        half = bar % 2
        for step, n in HOOKMEL:
            if step // 8 == half:
                add(pluck(n), t0 + (step % 8) * BEAT / 2, 0.16, pan=0.2)
                add(pluck(n + 12, 0.2), t0 + (step % 8) * BEAT / 2 + 0.375, 0.04, pan=-0.3)   # dotted-8th echo


for bar in range(int(DUR / BAR)):
    t0 = bar * BAR
    if t0 < T['HOOK']:
        section_bar(bar, t0, 'build')
    elif t0 < T['END3']:
        section_bar(bar, t0, 'full')
    elif t0 >= 36.0 - 1e-6 and t0 < 38.0:
        section_bar(bar, t0, 'half')
# 34–36: the flags fly in and crash; 36–38 half-time; 38–40 last chord rings
add(supersaw([69, 72, 76, 81], 2.0, cut=2600), 38.0, 0.24, bus=S)
add(bass(45, 1.9), 38.0, 0.5, bus=S)
add(kick(), 38.0, 0.8); add(clap(), 38.0, 0.3)
for k, n in enumerate([76, 79, 81, 84]):
    add(pluck(n, 0.5), 38.0 + k * 0.25, 0.14)
add(supersaw([65, 69, 72, 76], 1.4, cut=2200), 34.5, 0.2, bus=S)       # after the crash: F chord swell
add(bass(41, 1.4), 34.5, 0.45, bus=S)
for k in range(3):
    add(kick(), 34.5 + k * BEAT, 0.6)

# ---------------- sidechain pump on the chord/bass bus ----------------
duck = np.ones(N)
pump = 1 - 0.75 * np.exp(-tt(BEAT) / 0.09)
for b in range(int(DUR / BEAT)):
    tb = b * BEAT
    if T['HOOK'] <= tb < T['END3'] or 36.0 <= tb < 40:
        i = int(tb * SR); duck[i:i + len(pump)] = np.minimum(duck[i:i + len(pump)], pump[: N - i])
L += S * duck
R += S * duck

# ---------------- hook: two flag slams + build ----------------
add(impact(), 0.0, 0.9)                 # the hit on frame 0 (left flag)
add(metal_thunk(), 0.0, 0.4, pan=-0.4)
add(glass(), 0.02, 0.35, pan=-0.3)
add(impact(0.8), 0.28, 0.75)            # right flag
add(metal_thunk(), 0.28, 0.35, pan=0.4)
add(glass(), 0.3, 0.3, pan=0.3)
add(whoosh(0.35), 0.1, 0.3)
add(riser(3.4), 0.6, 0.4)
for k in range(16):                     # snare-clap roll into the drop
    tk = 2.0 + k * (BEAT / 4 if k < 8 else BEAT / 8)
    if tk < 4.0:
        add(clap() * (0.3 + k / 24), tk, 0.35)
add(impact(1.2), T['HOOK'], 0.55)       # the drop

# ---------------- pair SFX ----------------
for e in TLJ['events']:
    t = e['t']
    if e['type'] == 'green':
        add(whoosh(0.3), t - 0.1, 0.25, pan=-0.5)
        add(ding(), t + 0.2, 0.3, pan=-0.3)
        add(pop(1100), t + 0.33, 0.15, pan=-0.3)
    elif e['type'] == 'red':
        add(whoosh(0.3), t - 0.1, 0.25, pan=0.5)
        add(buzz(), t + 0.2, 0.36, pan=0.3)
        add(impact(0.35), t + 0.33, 0.2, pan=0.3)
    elif e['type'] == 'exit':
        add(whoosh(0.45, up=False), t, 0.3)
for i in range(6):
    add(pop(700), T['PAIR0'] + i * T['PAIR_LEN'], 0.12)

# ---------------- finale ----------------
add(riser(0.5), T['END3'], 0.5)
add(whoosh(0.5), T['END3'], 0.4)
add(impact(1.4), T['CRASH'], 1.0)
add(glass(), T['CRASH'], 0.45)
crash = filt(rng.standard_normal(int(2.0 * SR)), 'high', 3000) * np.exp(-tt(2.0) / 0.6)
add(crash, T['CRASH'], 0.35)
add(pop(900), T['CRASH'] + 0.4, 0.2)
for i in range(6):
    add(pop(800 + i * 120), T['CRASH'] + 0.9 + i * 0.1, 0.13, pan=-0.5 + i * 0.2)
for i in range(10):
    add(tick(), T['CRASH'] + 1.5 + i * 0.25, 0.12)
add(pop(1300), T['CRASH'] + 1.75, 0.18)

# ---------------- master ----------------
ir_t = tt(0.9)
ir = filt(rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.22), 'low', 7000)
ir *= 0.18 / np.sqrt((ir ** 2).sum())
mix = np.stack([L + fftconvolve(L, ir)[:N], R + fftconvolve(R, np.roll(ir, 41))[:N]], axis=1)
mix = np.stack([filt(mix[:, 0], 'high', 28), filt(mix[:, 1], 'high', 28)], axis=1)
fade = np.ones(N)
fi = int(0.001 * SR)                     # 1 ms de-click only: the hit lands on frame 0
fo = int(0.35 * SR)
fade[:fi] = np.linspace(0.6, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/flags-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/flags-music.wav', f'{N / SR:.2f}s')
