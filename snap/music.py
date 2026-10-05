"""Original electro-pop soundtrack + snap/whoosh SFX for "snap! semester kemarin vs sekarang." (no voice-over).

    python3 snap/music.py   -> out/snap-music.wav

125 BPM (1 beat = 0.48 s, 1 bar = 1.92 s) in F# minor (F#m - D - A - E). Every finger snap in
snap/anim.js sits on a beat: 0, 4.32, 8.64, 12.96, 17.28, 21.6 (beats 0/9/18/27/36/45), the MinTask
snap on the drop at 26.88 (bar 14) and the logo snap at 34.56 (bar 18). Thick sidechained bass,
offbeat chord stabs, a build with snare roll + riser, a clear drop, and an outro that rings out at 40 s.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(125)
BPM = 125
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
SNAPS = [0, 4.32, 8.64, 12.96, 17.28, 21.6, 26.88, 34.56]
DROP = 26.88
BUILD = 23.04
OUTRO = 34.56

# buses: drums / sidechained music / sfx
bus = {k: np.zeros((N, 2)) for k in ('drums', 'music', 'sfx')}


def add(sig, t0, gain=1.0, pan=0.0, to='music'):
    i = int(round(t0 * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    b = bus[to]
    if sig.ndim == 1:
        b[i:i + len(sig), 0] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
        b[i:i + len(sig), 1] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414
    else:
        b[i:i + len(sig)] += sig * gain


def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def filt(sig, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), sig, axis=0)


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def saw(f, x, ph=0.0):
    return 2 * ((f * x + ph) % 1.0) - 1


def adsr(x, d, a=0.005, rel=0.05):
    return np.minimum(1, x / a) * np.clip((d - x) / rel, 0, 1)


# ---------------- drums ----------------
def kick(big=False):
    d = 0.45 if big else 0.32; x = tt(d)
    f = 44 + 140 * np.exp(-x / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / (0.22 if big else 0.14))
    click = filt(rng.standard_normal(len(x)), 'high', 3000) * np.exp(-x / 0.003) * 0.5
    return np.tanh((body + click) * 1.6)


def clap():
    d = 0.3; x = tt(d); n = filt(rng.standard_normal(len(x)), 'band', [900, 5000])
    e = np.zeros_like(x)
    for o in (0, 0.011, 0.022):
        e += (x >= o) * np.exp(-np.maximum(0, x - o) / (0.008 if o < 0.02 else 0.07))
    return n * e * 0.7


def hat(open_=False):
    d = 0.18 if open_ else 0.05; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 8000) * np.exp(-x / (0.05 if open_ else 0.012)) * 0.6


def snare():
    d = 0.2; x = tt(d)
    return filt(rng.standard_normal(len(x)), 'band', [1500, 7000]) * np.exp(-x / 0.05) * 0.6 + np.sin(2 * np.pi * 200 * x) * np.exp(-x / 0.03) * 0.4


def crash(d=1.8):
    x = tt(d)
    return filt(rng.standard_normal(len(x)), 'high', 5000) * np.exp(-x / 0.6) * 0.5


# ---------------- synths ----------------
def supersaw(notes, d, cut=3000, voices=5, spread=0.22):
    x = tt(d); L_ = np.zeros_like(x); R_ = np.zeros_like(x)
    for n in notes:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
            s = saw(midi(n) * 2 ** (det / 12), x, rng.uniform())
            pan = (v / (voices - 1)) * 2 - 1
            L_ += s * (1 - pan) / 2; R_ += s * (1 + pan) / 2
    st = np.stack([L_, R_], axis=1) / (len(notes) * voices) * 2
    return filt(st, 'low', cut) * adsr(x, d, 0.006, 0.06)[:, None]


def stab(notes, d=0.2, cut=2600):
    x = tt(d)
    return supersaw(notes, d, cut, 4, 0.15) * np.exp(-x / 0.09)[:, None]


def pluck(n, d, bright=3500):
    x = tt(d); f = midi(n)
    s = saw(f, x) * 0.6 + np.sign(np.sin(2 * np.pi * f * x)) * 0.25 + saw(f * 2.004, x) * 0.2
    out = filt(s * np.exp(-x / 0.25), 'low', bright)
    return out * adsr(x, d, 0.002, 0.03)


def bass_pluck(n, d):
    x = tt(d); f = midi(n)
    s = filt(saw(f, x) + 0.6 * saw(f * 1.005, x), 'low', 900) * np.exp(-x / 0.18) * 0.7 + np.sin(2 * np.pi * f * x) * 0.8
    return s * adsr(x, d, 0.003, 0.02)


def reese(n, d):
    """thick drop bass: detuned saws + sub, slow filter wobble"""
    x = tt(d); f = midi(n)
    s = saw(f, x) + saw(f * 1.012, x, 0.3) + saw(f * 0.993, x, 0.6)
    s = filt(s / 3, 'low', 700) * 0.9 + np.sin(2 * np.pi * f * x) * 0.9 + np.sin(2 * np.pi * f / 2 * x) * 0.35
    return np.tanh(s * 1.4) * adsr(x, d, 0.004, 0.03)


def riser(d):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(x); k = 10
    for i in range(k):
        c = (i + 0.5) / k; f = 400 * (25 ** c)
        out += filt(n, 'band', [f * 0.8, min(f * 1.25, 19000)]) * np.clip(1 - np.abs(x / d - c) * k / 1.5, 0, 1)
    tone = saw(220 * 2 ** (2 * x / d) , x) * 0.15
    return (out + filt(tone, 'low', 3000)) * (x / d) ** 2


def impact():
    d = 1.6; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 90 * np.exp(-x / 0.08)) / SR) * np.exp(-x / 0.5)
    return np.tanh(sub * 1.5) + filt(rng.standard_normal(len(x)), 'low', 2500) * np.exp(-x / 0.12) * 0.5


# ---------------- SFX ----------------
def snap_sfx(big=False):
    """sharp finger snap: crisp click + tonal pop + short room"""
    d = 0.25; x = tt(d)
    click = filt(rng.standard_normal(len(x)), 'band', [1800, 7500], 4) * np.exp(-x / 0.006)
    pop = np.sin(2 * np.pi * np.cumsum(2300 * np.exp(-x / 0.01) + 1100) / SR) * np.exp(-x / 0.012) * 0.6
    s = (click * 1.2 + pop) * np.minimum(1, x / 0.0004)
    room = np.zeros_like(s)
    for dly, g in ((0.011, 0.35), (0.019, 0.25), (0.031, 0.18), (0.047, 0.1)):
        k = int(dly * SR); room[k:] += s[:-k] * g
    out = s + filt(room, 'band', [800, 6000])
    if big:
        out = out + filt(rng.standard_normal(len(x)), 'high', 4000) * np.exp(-x / 0.05) * 0.4
    return out / np.max(np.abs(out))


def whoosh(d=0.28):
    x = tt(d); n = rng.standard_normal(len(x)); out = np.zeros_like(x); k = 8
    for i in range(k):
        c = (i + 0.5) / k; f = 300 * (30 ** c)
        out += filt(n, 'band', [f * 0.7, min(f * 1.4, 19000)]) * np.clip(1 - np.abs(x / d - c) * k / 1.6, 0, 1)
    return out * (x / d) ** 1.5 * 0.9


def bubble(f=900):
    x = tt(0.12)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.2 * np.exp(-x / 0.02))) / SR) * np.exp(-x / 0.04)


def sparkle(d=1.0):
    x = tt(d); s = np.zeros_like(x)
    for k in range(8):
        o = k * 0.06; f = midi(88 + [0, 4, 7, 11, 12, 16, 19, 24][k])
        s += np.sin(2 * np.pi * f * np.maximum(0, x - o)) * (x >= o) * np.exp(-np.maximum(0, x - o) / 0.2)
    return s * 0.3


# ---------------- arrangement ----------------
PROG = [(42, [66, 69, 73]), (38, [62, 66, 69]), (45, [64, 69, 73]), (40, [64, 68, 71])]   # F#m D A E
LEAD = [(0, 73, 2), (3, 73, 2), (6, 76, 2), (8, 73, 2), (10, 71, 2), (12, 69, 2), (14, 71, 2),
        (16, 69, 3), (19, 66, 3), (22, 69, 2), (24, 71, 4), (28, 69, 2), (30, 66, 2),
        (32, 73, 2), (35, 73, 2), (38, 76, 2), (40, 78, 4), (44, 76, 2), (46, 73, 2),
        (48, 71, 3), (51, 68, 3), (54, 71, 2), (56, 73, 6), (62, 71, 2)]
LEAD_AT = {s: (n, l) for s, n, l in LEAD}

kicks = []
nbars = int(np.ceil(DUR / BAR))
for bar in range(nbars):
    t0 = bar * BAR
    if t0 >= DUR:
        break
    root, chord = PROG[bar % 4]
    in_build = BUILD <= t0 < DROP
    in_drop = DROP <= t0 < OUTRO
    in_outro = t0 >= OUTRO
    for s in range(16):
        t = t0 + s * S16
        if t >= DUR - 0.05:
            break
        beat_ = s % 4 == 0
        # --- drums ---
        if beat_ and not (in_build and t >= DROP - BEAT * 2) and not (in_outro and t >= 38.4):
            if not (in_build and t0 >= BUILD + BAR and s % 8 != 0):
                add(kick(big=in_drop), t, 0.95 if in_drop else 0.85, to='drums'); kicks.append(t)
        if s in (4, 12) and not in_build and t < 38.4:
            add(clap(), t, 0.55, to='drums')
            if in_drop:
                add(snare(), t, 0.25, to='drums')
        if not in_build and t < 38.4:
            if s % 4 == 2:
                add(hat(open_=True), t, 0.32, pan=0.2, to='drums')
            elif s % 2 == 1 and t > 3.84:
                add(hat(), t, 0.22, pan=-0.2, to='drums')
        # --- bass ---
        if in_drop:
            if s % 4 == 0:
                add(reese(root, BEAT * 0.98), t, 0.62)
        elif in_outro:
            if t < 38.4 and s % 4 == 0:
                add(reese(root, BEAT * 0.9), t, 0.5)
        elif not in_build or t < BUILD + BAR:
            if s % 4 in (0, 2, 3) or (s % 4 == 1 and t > 12):
                add(bass_pluck(root + (12 if s % 8 == 6 else 0), S16 * 1.8), t, 0.55)
        # --- chords ---
        if in_drop or (in_outro and t < 38.4):
            if s % 4 == 2:
                add(stab([n + 12 for n in chord] + [chord[0]], 0.26, 4200), t, 0.5)
            if s == 0:
                add(supersaw(chord + [chord[0] + 12], BAR * 0.98, 2400, 7, 0.28), t, 0.32)
        elif in_build:
            cut = 900 + 4000 * ((t - BUILD) / (DROP - BUILD)) ** 2
            if s % 2 == 0:
                add(stab(chord, 0.16, cut), t, 0.35)
        else:
            if s % 4 == 2 or s in (7, 15) and t > 8:
                add(stab(chord, 0.18, 2200), t, 0.38)
        # --- lead ---
        st = (bar % 4) * 16 + s
        lead_on = (7.68 <= t < BUILD) or in_drop
        if lead_on and st in LEAD_AT:
            n, l = LEAD_AT[st]
            add(pluck(n + (12 if in_drop else 0), S16 * l * 1.2, 4500 if in_drop else 3000), t, 0.28, pan=0.15)
            add(pluck(n, S16 * l, 2500), t + S16 * 3, 0.07, pan=-0.4)          # dotted-8th echo
            if in_drop:
                add(pluck(n, S16 * l * 1.2, 3000), t, 0.14, pan=-0.15)

# build: accelerating snare roll + riser, then a beat of silence before the drop
roll_t = BUILD
k = 0
while roll_t < DROP - BEAT:
    prog = (roll_t - BUILD) / (DROP - BUILD)
    add(snare(), roll_t, 0.12 + 0.35 * prog, to='drums')
    roll_t += BEAT if prog < 0.25 else BEAT / 2 if prog < 0.5 else BEAT / 4 if prog < 0.75 else BEAT / 8
add(riser(DROP - BUILD - 0.05), BUILD, 0.45, to='sfx')
# outro: final chord ringing out to 40 s
add(supersaw([54, 61, 66, 69, 73], 1.6, 2200, 7, 0.3), 38.4, 0.45)
add(reese(30, 1.5) * np.exp(-tt(1.5) / 0.6), 38.4, 0.45)
add(kick(big=True), 38.4, 0.9, to='drums'); kicks.append(38.4)
add(crash(1.6), 38.4, 0.35, to='drums')
add(pluck(85, 1.2, 5000), 38.4, 0.2)

# ---------------- SFX: snaps on the beat ----------------
add(impact(), 0.0, 0.8, to='sfx')                    # hit exactly at 0.000 s
add(crash(1.4), 0.0, 0.35, to='sfx')
for i, s in enumerate(SNAPS):
    big = s in (0, DROP, OUTRO)
    add(snap_sfx(big), s, 0.95 if big else 0.85, pan=-0.12, to='sfx')
    if s > 0:
        w = whoosh(0.3)
        add(w, s - len(w) / SR, 0.55, pan=0.1, to='sfx')
        add(filt(rng.standard_normal(int(0.12 * SR)), 'high', 2500) * np.exp(-tt(0.12) / 0.03), s, 0.25, to='sfx')
    if s in (DROP, OUTRO):
        add(impact(), s, 0.7, to='sfx'); add(crash(2.0), s, 0.45, to='sfx')
    if 0 < s < DROP:
        add(bubble(700 + i * 80), s + 0.05, 0.18, to='sfx')       # stage tag pops in
add(sparkle(1.2), DROP + 0.05, 0.45, to='sfx')                     # card appears
for i in range(6):                                                 # tasks fly into the card
    t0 = 29.76 + i * BEAT * 2
    add(whoosh(0.35) * 0.5, t0 + BEAT * 1.6 - 0.35, 0.35, pan=0.5 if i % 2 else -0.5, to='sfx')
    add(bubble(1100 + i * 90), t0 + BEAT * 1.6, 0.3, pan=0.3, to='sfx')
add(sparkle(1.0), OUTRO + BEAT * 2, 0.3, to='sfx')                 # tagline pops

# ---------------- mix ----------------
side = np.ones(N)
for kt in kicks:
    i = int(kt * SR); n = min(N - i, int(0.35 * SR))
    side[i:i + n] = np.minimum(side[i:i + n], 1 - 0.65 * np.exp(-tt(n / SR)[:n] / 0.09))
music = bus['music'] * side[:, None]
# light stereo room on music
for dly, g in ((0.027, 0.12), (0.041, 0.09), (0.067, 0.06)):
    d = int(dly * SR)
    music[d:, 0] += filt(music[:-d, 1], 'low', 6000) * g
    music[d:, 1] += filt(music[:-d, 0], 'low', 6000) * g
mix = music * 0.9 + bus['drums'] * 0.9 + bus['sfx'] * 1.0
mix = filt(mix, 'high', 25)
fi = int(0.001 * SR); fo = int(0.3 * SR)              # no fade-in: the hit is at 0.000 s
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.9 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
wavfile.write('out/snap-music.wav', SR, (mix * 32767).astype(np.int16))
print('wrote out/snap-music.wav', f'{len(mix) / SR:.3f}s')
