"""Original 8-bit chiptune score + arcade SFX for "Level 1: Tugas Menyerang!".

    python3 arcade/music.py   -> out/arcade-music.wav

Pulse waves, a 4-bit triangle bass and noise drums, NES style. The battle theme starts at
140 BPM and accelerates to 172 BPM as tasks pile up (26 s), drops into a suspense bed for the
power-up, explodes with the laser, then resolves into a victory groove and a stage-clear
fanfare that ends on the logo. Every shot / hit / crash comes from arcade/game.js, so the
sound lands on exactly the frame the picture does.
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ev = json.loads(subprocess.check_output(
    ['node', '-e', "process.stdout.write(JSON.stringify(require('./arcade/game.js').events()))"], cwd=ROOT))
T = ev['T']

SR = 44100
DUR = 40.0
N = int(SR * DUR)
rng = np.random.default_rng(140)
L = np.zeros(N)
R = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def filt(sig, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------------- chip voices ----------------
def pulse_f(freq, d, duty=0.5):
    """Pulse with a per-sample frequency curve (array) or a constant."""
    n = len(tt(d))
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph = np.cumsum(f) / SR % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def adsr(d, a=0.004, dec=0.08, sus=0.6, rel=0.03):
    x = tt(d)
    e = np.where(x < a, x / a, sus + (1 - sus) * np.exp(-(x - a) / dec))
    return e * np.clip((d - x) / rel, 0, 1)


def sq(note, d, duty=0.5, vib=0.0, sus=0.6, dec=0.08):
    x = tt(d)
    f = midi(note) * (1 + vib * np.sin(2 * np.pi * 6 * x) * np.clip((x - 0.12) / 0.1, 0, 1))
    return pulse_f(f, d, duty) * adsr(d, sus=sus, dec=dec)


def tri(note, d):
    x = tt(d)
    ph = (midi(note) * x) % 1.0
    w = 4 * np.abs(ph - 0.5) - 1
    w = np.round(w * 7.5) / 7.5            # 4-bit stepped triangle
    return w * np.clip((d - x) / 0.02, 0, 1)


def noise(d, rate=SR, seed=None):
    """Sample-and-hold noise; `rate` may be an array (Hz) to sweep the 'pitch'."""
    n = len(tt(d))
    r = np.broadcast_to(np.asarray(rate, dtype=float), (n,))
    idx = np.floor(np.cumsum(r) / SR).astype(int)
    vals = (np.random.default_rng(seed).integers(0, 2, idx[-1] + 2) * 2 - 1).astype(float)
    return vals[idx]


def kick():
    d = 0.16; x = tt(d)
    f = 45 + 140 * np.exp(-x / 0.03)
    return pulse_f(f, d, 0.5) * np.exp(-x / 0.06) * 0.9 + tri(33, d) * 0.4 * np.exp(-x / 0.05)


def snare():
    d = 0.14; x = tt(d)
    return noise(d, 12000) * np.exp(-x / 0.05) * 0.55 + pulse_f(180 * np.exp(-x / 0.05) + 120, d, 0.5) * np.exp(-x / 0.03) * 0.25


def hat(open_=False):
    d = 0.12 if open_ else 0.035; x = tt(d)
    return filt(noise(d, 30000), 'high', 6000) * np.exp(-x / (0.04 if open_ else 0.012)) * 0.4


def crash(d=1.2):
    x = tt(d)
    return filt(noise(d, 26000), 'high', 3000) * np.exp(-x / 0.35) * 0.4


# ---------------- SFX ----------------
def coin():
    a = sq(83, 0.07, 0.5, sus=1); b = sq(88, 0.42, 0.5, sus=0.7, dec=0.18)
    return np.concatenate([a, b])


def hit_impact():
    d = 0.4; x = tt(d)
    body = pulse_f(160 * np.exp(-x / 0.06) + 40, d, 0.5) * np.exp(-x / 0.1)
    return body * 0.8 + noise(d, 9000 * np.exp(-x / 0.08) + 600) * np.exp(-x / 0.09) * 0.7


def pew():
    d = 0.13; x = tt(d)
    f = 1500 * np.exp(-x / 0.04) + 260
    return pulse_f(f, d, 0.25) * np.exp(-x / 0.05)


def boom(big=False):
    d = 0.5 if big else 0.3; x = tt(d)
    rate = (7000 if big else 9000) * np.exp(-x / (0.12 if big else 0.07)) + 500
    s = noise(d, rate) * np.exp(-x / (0.16 if big else 0.08))
    if big:
        s += pulse_f(110 * np.exp(-x / 0.1) + 40, d, 0.5) * np.exp(-x / 0.12) * 0.6
    return s


def thud():
    d = 0.35; x = tt(d)
    s = pulse_f(110 * np.exp(-x / 0.05) + 35, d, 0.5) * np.exp(-x / 0.12)
    s += noise(d, 4000 * np.exp(-x / 0.05) + 400) * np.exp(-x / 0.1) * 0.6
    hurt = np.concatenate([sq(64, 0.06, 0.25, sus=1), sq(58, 0.1, 0.25, sus=1)])
    s[:len(hurt)] += hurt * 0.5
    return s


def blip(note, d=0.05, duty=0.25):
    return sq(note, d, duty, sus=1)


def arp(notes, step, duty=0.25, tail=0.0):
    out = np.zeros(int((len(notes) * step + tail + 0.05) * SR))
    for k, n in enumerate(notes):
        s = sq(n, step + (tail if k == len(notes) - 1 else 0), duty, sus=0.8)
        i = int(k * step * SR); out[i:i + len(s)] += s
    return out


def sweep(f0, f1, d, duty=0.5, curve='exp'):
    x = tt(d) / d
    f = f0 * (f1 / f0) ** x if curve == 'exp' else f0 + (f1 - f0) * x
    return pulse_f(f, d, duty)


# =====================================================================
# 1) BATTLE THEME 0–26 s, tempo 140 -> 172 BPM
def bpm(t):
    return np.where(t < 10, 140.0, 140 + (t - 10) / 16 * 32)


tg = np.linspace(0, T['CARD'], 20001)
beats = np.concatenate([[0], np.cumsum((bpm(tg[:-1]) / 60) * np.diff(tg))])
step_t = lambda b: float(np.interp(b, beats, tg))   # beat -> time
TOTAL_BEATS = beats[-1]

# Am – F – G – E, one chord per bar (4 beats)
PROG = [(45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62]), (40, [52, 56, 59])]
MEL_A = [[76, None, 74, 76, None, 72, 69, None], [77, None, 76, 77, None, 72, 69, None],
         [79, None, 77, 76, 74, None, 71, None], [76, None, 75, 76, 80, None, 83, None]]
MEL_B = [[81, None, 79, 76, None, 74, 72, 74], [77, None, 76, 72, None, 69, 72, 77],
         [79, None, 83, 81, 79, 77, 76, 74], [76, None, None, 80, None, 83, 81, 80]]

b = 0.0
while True:
    t0 = step_t(b)
    if b >= TOTAL_BEATS - 1e-6:
        break
    bar, beat_in_bar = int(b // 4), b % 4
    root, chord = PROG[bar % 4]
    t1 = step_t(b + 0.25)
    sixteenth = t1 - t0
    k16 = int(round(b * 4)) % 16  # 16th index within bar
    tsec = t0
    # --- drums
    if k16 in (0, 8) or (tsec > 12 and k16 == 14) or (tsec > 19 and k16 == 6):
        add(kick(), t0, 0.55)
    if k16 in (4, 12):
        add(snare(), t0, 0.42)
    if k16 % 2 == 0 or tsec > 16:
        add(hat(open_=(k16 == 14 and tsec < 16)), t0, 0.22 if k16 % 2 == 0 else 0.13, pan=0.35)
    # fills before the banners (15.6 / 21.6) and before the card
    for fill_at in (15.6, 21.6, T['CARD']):
        if fill_at - 4 * sixteenth - 1e-3 <= tsec < fill_at - 1e-3:
            add(snare(), t0, 0.32 + 0.06 * ((fill_at - tsec) < 2 * sixteenth))
    # --- triangle bass, octave-bouncing 8ths
    if k16 % 2 == 0:
        n = root - 12 + (12 if (k16 // 2) % 2 else 0)
        add(tri(n, sixteenth * 1.8), t0, 0.5)
    # --- 12.5% arpeggio 16ths (enters at 4 s)
    if tsec >= 4.0:
        arpn = (chord + [chord[0] + 12])[k16 % 4] + 12
        add(sq(arpn, sixteenth * 0.9, 0.125, sus=0.5, dec=0.04), t0, 0.075, pan=-0.3)
    # --- lead melody (8ths): phrase A, phrase B, alternating every 4 bars
    if k16 % 2 == 0:
        phrase = MEL_A if (bar // 4) % 2 == 0 else MEL_B
        note = phrase[bar % 4][k16 // 2]
        if note is not None:
            # hold length: until next non-None note in this bar
            row = phrase[bar % 4]; j = k16 // 2 + 1; hold = 1
            while j < 8 and row[j] is None:
                hold += 1; j += 1
            d = sixteenth * 2 * hold * 0.92
            up = 12 if tsec > 19 else 0          # lead jumps an octave in the frantic part
            add(sq(note + up - 12 * (up > 0 and note > 80), d, 0.25 if tsec < 12 else 0.5, vib=0.006), t0, 0.16, pan=0.1)
            add(sq(note + up - 12 * (up > 0 and note > 80), d, 0.125, vib=0.006), t0 + 0.09, 0.05, pan=-0.4)  # echo
    b += 0.25

add(crash(1.4), 0.0, 0.5)

# =====================================================================
# 2) HOOK + GAME SFX
add(coin(), 0.0, 0.42)
add(hit_impact(), 0.0, 0.75)
add(arp([69, 72, 76, 81, 84], 0.045), 0.08, 0.16)       # "level start"
add(arp([72, 76, 79, 84], 0.05, tail=0.15), 3.95, 0.2)  # "mulai!"
for s in ev['shots']:
    add(pew(), s['tf'], 0.2, pan=(s['x'] - 135) / 200)
    add(boom(), s['th'], 0.32, pan=(s['x'] - 135) / 180)
    add(blip(96, 0.03, 0.5), s['th'] + 0.04, 0.05)       # score tick
for l in ev['landings']:
    if l['tl'] < T['CATCH']:
        add(thud(), l['tl'], 0.5, pan=(l['x'] - 135) / 200)
for t0 in (15.6, 21.6):                                   # banners
    for k in range(3):
        add(blip(88, 0.06, 0.5), t0 + k * 0.12, 0.12)
        add(blip(81, 0.06, 0.5), t0 + k * 0.12 + 0.06, 0.12)
for k in range(6):                                        # low-life alarm
    add(blip(93, 0.08, 0.5), 23.25 + k * 0.45, 0.07)

# =====================================================================
# 3) POWER-UP 26 – 31
CARD, CATCH, FIRE = T['CARD'], T['CATCH'], T['FIRE']
add(crash(1.0), CARD, 0.3)
add(arp([88, 91, 95, 100, 103], 0.05, tail=0.25), CARD, 0.16)        # item appears
# suspense bed: heartbeat kick + low triangle drone + sparkle descending
for k in range(int((CATCH - CARD) / 0.43)):
    tk = CARD + k * 0.43
    add(kick(), tk, 0.45); add(kick(), tk + 0.14, 0.25)
    add(tri(33, 0.4), tk, 0.45)
for k in range(12):
    add(sq([88, 84, 81, 79, 76, 72][k % 6] + 12 * (k < 6), 0.1, 0.125, sus=0.3), CARD + 0.4 + k * 0.17, 0.06, pan=np.sin(k) * 0.5)
add(sweep(220, 660, CATCH - CARD - 0.2, 0.5) * np.linspace(0, 1, len(tt(CATCH - CARD - 0.2))) ** 2, CARD + 0.2, 0.05)
# catch: power-up run
add(arp([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], 0.032, 0.25, tail=0.3), CATCH, 0.26)
add(hit_impact(), CATCH, 0.4)
# charge riser
dch = FIRE - CATCH - 0.25; x = tt(dch)
ch = sweep(180, 1600, dch, 0.5) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * (8 + 24 * x / dch) * x))) * (x / dch) ** 1.3
ch += noise(dch, 2000 + 18000 * x / dch) * (x / dch) ** 2 * 0.5
add(ch, CATCH + 0.25, 0.22)
# laser
dz = 0.7; x = tt(dz)
zap = pulse_f(1900 * np.exp(-x / 0.18) + 110, dz, 0.5) * np.exp(-x / 0.4)
add(zap, FIRE, 0.42)
add(hit_impact(), FIRE, 0.7)
add(crash(2.0), FIRE, 0.6)
dh = 1.4; x = tt(dh)
hum = (pulse_f(110 * (1 + 0.02 * np.sin(2 * np.pi * 9 * x)), dh, 0.5) + pulse_f(165.5, dh, 0.25) * 0.6
       + noise(dh, 6000) * 0.25) * np.clip(1 - x / dh, 0, 1) ** 1.5
add(hum, FIRE + 0.05, 0.24)
for k, p in enumerate(ev['laserPops']):
    add(boom(big=True), p['t'], 0.34 if k < 10 else 0.2, pan=(p['x'] - 135) / 180)

# =====================================================================
# 4) VICTORY GROOVE 30.9 – 34, then STAGE CLEAR FANFARE 34 – 37, LOGO 37 – 40
BEAT = 60 / 140
G0 = 30.9
GROOVE = [(48, [60, 64, 67]), (48, [60, 64, 67]), (53, [65, 69, 72]), (53, [65, 69, 72]),
          (55, [67, 71, 74]), (55, [67, 71, 74]), (55, [67, 71, 74])]
GLEAD = [(0, 72, 0.5), (0.5, 76, 0.5), (1, 79, 1), (2, 77, 0.5), (2.5, 76, 0.5), (3, 77, 1),
         (4, 79, 0.5), (4.5, 81, 0.5), (5, 83, 0.5), (5.5, 84, 0.5), (6, 86, 0.75)]
for k, (root, chord) in enumerate(GROOVE):
    tb = G0 + k * BEAT
    add(kick(), tb, 0.5)
    if k % 2: add(snare(), tb, 0.4)
    add(hat(), tb + BEAT / 2, 0.2, pan=0.35)
    add(tri(root - 12, BEAT * 0.45), tb, 0.5); add(tri(root, BEAT * 0.4), tb + BEAT / 2, 0.45)
    for j in range(4):
        add(sq(chord[j % 3] + 12, BEAT / 4 * 0.9, 0.125, sus=0.5, dec=0.04), tb + j * BEAT / 4, 0.07, pan=-0.3)
for (o, n, d) in GLEAD:
    add(sq(n, d * BEAT * 0.92, 0.5, vib=0.006), G0 + o * BEAT, 0.15, pan=0.1)
for k in range(4):                                                   # snare roll into fanfare
    add(snare(), 34.0 - BEAT + k * BEAT / 4, 0.3 + 0.05 * k)

# stage clear fanfare (original), 140 BPM from 34.0
F0 = T['STAGE']
add(crash(1.6), F0, 0.55)
add(hit_impact(), F0, 0.4)
FAN = [  # (beat offset, note, beats)
    (0, 72, 1 / 3), (1 / 3, 76, 1 / 3), (2 / 3, 79, 1 / 3), (1, 84, 1), (2, 81, 0.5), (2.5, 83, 0.5),
    (3, 84, 1.5), (4.5, 77, 1 / 6), (4 + 2 / 3, 81, 1 / 6), (4 + 5 / 6, 84, 1 / 6), (5, 86, 0.75), (5.75, 83, 0.25),
    (6, 88, 0.95),
]
for (o, n, d) in FAN:
    add(sq(n, d * BEAT * 0.95, 0.5, vib=0.008, sus=0.75, dec=0.2), F0 + o * BEAT, 0.2, pan=0.1)
    add(sq(n - 4 if n in (76, 88, 81) else n - 3 if n in (79, 84, 83, 86) else n - 5, d * BEAT * 0.95, 0.25, sus=0.7, dec=0.2),
        F0 + o * BEAT, 0.09, pan=-0.25)
FBASS = [(0, 48, 1), (1, 48, 1), (2, 53, 1), (3, 48, 1.5), (4.5, 53, 0.5), (5, 55, 1), (6, 48, 1)]
for (o, n, d) in FBASS:
    add(tri(n - 12, d * BEAT * 0.9), F0 + o * BEAT, 0.55)
for k in range(7):
    add(kick(), F0 + k * BEAT, 0.45)
    add(hat(), F0 + k * BEAT + BEAT / 2, 0.18)
    if k in (1, 3, 5): add(snare(), F0 + k * BEAT, 0.38)
# held ending chord of the fanfare
for n, g in ((76, 0.07), (79, 0.07), (84, 0.06)):
    add(sq(n, 0.75, 0.125, sus=0.6, dec=0.3), F0 + 6 * BEAT, g)
# score tally ticks + "rekor baru!"
for k in range(24):
    add(blip(96 + (k % 2) * 3, 0.025, 0.5), F0 + 0.6 + k * 0.05, 0.06)
add(arp([84, 88, 91, 96], 0.06, 0.5, tail=0.15), F0 + 1.9, 0.14)

# ---- logo: dither sweep, mark, final cadence
LG = T['LOGO']
dw = 0.45; x = tt(dw)
add(noise(dw, 16000 * np.exp(-x / 0.2) + 800) * np.sin(np.pi * x / dw), LG, 0.18)
add(arp([67, 72, 76, 79, 84, 88], 0.04, 0.25), LG + 0.05, 0.14)
CAD = [(37.4, 53, [65, 69, 72, 77]), (37.95, 55, [67, 71, 74, 79]), (38.35, 48, [64, 67, 72, 76, 79, 84])]
for k, (tc, root, chord) in enumerate(CAD):
    dd = (CAD[k + 1][0] - tc) if k + 1 < len(CAD) else 40.0 - tc
    add(kick(), tc, 0.55); add(crash(1.0 if k < 2 else 1.8), tc, 0.3 if k < 2 else 0.45)
    add(tri(root - 12, dd * 0.95), tc, 0.55)
    for j, n in enumerate(chord):
        add(sq(n, dd * 0.97, 0.25 if j % 2 else 0.5, vib=0.005, sus=0.55, dec=0.35), tc, 0.075 if k < 2 else 0.06, pan=(j - 2) * 0.15)
add(sq(91, 0.12, 0.5, sus=1), 37.4, 0.12)                     # logo "ping"
add(hit_impact(), 37.95, 0.45)                                # wordmark slam
# victory lead on top of the final chord, then a shimmering arpeggio
for (o, n, d) in [(0, 84, 0.25), (0.25, 88, 0.25), (0.5, 91, 0.5), (1, 96, 2.2)]:
    add(sq(n, d * BEAT * 0.95 if d < 2 else 1.2, 0.5, vib=0.01, sus=0.7, dec=0.4), 38.35 + o * BEAT, 0.13)
for k in range(28):
    add(sq([72, 76, 79, 84][k % 4] + 12, 0.07, 0.125, sus=0.4), 38.4 + k * 0.055, 0.04 * (1 - k / 30), pan=np.sin(k) * 0.4)
# typewriter blips on the tagline
for k, ch in enumerate('ada task?'):
    if ch != ' ': add(blip(84 + (k % 3) * 2, 0.03, 0.5), 38.35 + k / 26, 0.05)
for k, ch in enumerate('taskkora-in aja.'):
    if ch != ' ': add(blip(88 + (k % 3) * 2, 0.03, 0.5), 38.8 + k / 26, 0.05)

# =====================================================================
# master: gentle low-pass (tame aliasing), slight stereo slap, glue, limiter
mix = np.stack([L, R], axis=1)
mix = filt(mix.T, 'low', 11000).T
for dly, g in ((0.021, 0.12), (0.043, 0.07)):
    d = int(dly * SR)
    mix[d:, 0] += mix[:-d, 1] * g
    mix[d:, 1] += mix[:-d, 0] * g
fade = np.ones(N); fo = int(0.6 * SR)
fade[-fo:] = np.linspace(1, 0, fo)            # no fade-in: the hit lands on sample 0
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.8 / np.max(np.abs(mix))   # headroom for AAC
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'arcade-music.wav')
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out, f'({len(ev["shots"])} shots, {len(ev["landings"])} crashes, {len(ev["laserPops"])} laser pops)')
