"""Procedural soundtrack + sound design for the GenLayer motion graphic.

Everything is synthesised from scratch with numpy/scipy (no samples), on a
120 BPM grid that matches the scene timeline in src/timeline.json, with sound
effects placed on the exact visual cue times used by the scenes.

    python3 audio/synth.py            -> out/soundtrack_raw.wav
    (render.mjs loudness-normalises and muxes it into the video)
"""
import json
import os
import numpy as np
import scipy.signal as sg
from scipy.io import wavfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))
S = {k: v[0] for k, v in TL['scenes'].items()}
SR = 48000
DUR = TL['duration'] + 0.5
N = int(DUR * SR)
BEAT = 60.0 / TL['bpm']
BAR = 4 * BEAT
rng = np.random.default_rng(1234)


# ----------------------------------------------------------------- helpers
def mtof(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=np.float64) - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def stereo():
    return np.zeros((2, N), np.float64)


def place(dst, sig, t, gain=1.0, pan=0.0):
    """Add mono/stereo `sig` into stereo `dst` at time t (s) with constant-power pan."""
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    i0 = int(round(t * SR))
    if i0 >= N:
        return
    s0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(sig.shape[1] - s0, N - i0)
    if n > 0:
        dst[:, i0:i0 + n] += sig[:, s0:s0 + n] * gain


def env_adsr(n, a, d, s, r, hold=None):
    """ADSR in seconds; hold = time before release (defaults to fill)."""
    total = n / SR
    hold = total - r if hold is None else hold
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    dd = np.clip((t - a) / max(d, 1e-6), 0, 1)
    e = np.where(t >= a, 1 - (1 - s) * dd, e)
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    e = e * (1 - rel)
    return e


def expdec(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def saw_blep(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m1 = ph < dt
    x = ph[m1] / dt[m1]
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt[m2]
    y[m2] -= x * x + x + x + 1
    return y


def sine(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=np.float64), (n,))
    return np.sin(2 * np.pi * (phase0 + np.cumsum(f) / SR))


def lp(x, fc, order=2):
    sos = sg.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return sg.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    sos = sg.butter(order, fc, 'high', fs=SR, output='sos')
    return sg.sosfilt(sos, x, axis=-1)


def bp(x, lo, hi, order=2):
    sos = sg.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return sg.sosfilt(sos, x, axis=-1)


def sweep_filter(x, f0, f1, kind='low', q=0.9, block=256, curve='exp'):
    """Time-varying biquad (RBJ) processed in blocks; f0->f1 over the signal."""
    n = x.shape[-1]
    out = np.zeros_like(x)
    zi = None
    nb = (n + block - 1) // block
    for b in range(nb):
        k = b / max(nb - 1, 1)
        fc = f0 * (f1 / f0) ** k if curve == 'exp' else f0 + (f1 - f0) * k
        w = 2 * np.pi * min(fc, SR * 0.45) / SR
        al = np.sin(w) / (2 * q)
        cw = np.cos(w)
        if kind == 'low':
            bb = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        elif kind == 'high':
            bb = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        else:  # band
            bb = [al, 0, -al]
        aa = [1 + al, -2 * cw, 1 - al]
        bb = np.array(bb) / aa[0]
        aa = np.array(aa) / aa[0]
        seg = x[..., b * block:(b + 1) * block]
        if zi is None:
            zi = np.zeros(x.shape[:-1] + (2,))
        y, zi = sg.lfilter(bb, aa, seg, axis=-1, zi=zi)
        out[..., b * block:(b + 1) * block] = y
    return out


def noise(n):
    return rng.standard_normal(n)


def make_ir(dur=2.6, pre=0.012, damp=4500, seed=3):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        nz = r.standard_normal(n)
        bright = nz * np.exp(-t / 0.35)
        dark = lp(nz, damp * 0.5) * np.exp(-t / (dur / 4.2))
        ir[c] = 0.5 * bright + dark
    ir[:, : int(pre * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return ir


IR_BIG = make_ir(3.2, 0.02, 4200, 5)
IR_MED = make_ir(1.6, 0.01, 6000, 7)


def reverb(x, ir, wet=0.3):
    """x: stereo (2,n). Returns dry+wet (length unchanged)."""
    out = np.zeros_like(x)
    for c in range(2):
        out[c] = sg.fftconvolve(x[c], ir[c])[: x.shape[1]]
    return x + wet * out


def delay(x, time, fb=0.4, n_echo=6, pingpong=True):
    out = x.copy()
    d = int(time * SR)
    for k in range(1, n_echo + 1):
        g = fb ** k
        sh = np.zeros_like(x)
        if k * d >= x.shape[1]:
            break
        if pingpong and k % 2 == 1:
            sh[0, k * d:] = x[1, : -k * d]
            sh[1, k * d:] = x[0, : -k * d]
        else:
            sh[:, k * d:] = x[:, : -k * d]
        out += sh * g
    return out


def soft(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


# ----------------------------------------------------------------- harmony
A, B_, C_, D, E, F, G = 57, 59, 60, 62, 64, 65, 67  # A3..G4 (midi)
CH = {
    'Am': [45, 57, 60, 64, 71],
    'F': [41, 57, 60, 65, 69],
    'C': [48, 55, 60, 64, 67],
    'G': [43, 55, 59, 62, 67],
    'Dm': [38, 57, 62, 65, 69],
    'E': [40, 56, 59, 64, 68],
    'Em': [40, 55, 59, 64, 67],
    'Fmaj7': [41, 57, 60, 64, 69],
    'Aadd9': [45, 57, 60, 64, 71],
}
# (start_time, chord) — each chord lasts until the next entry.
PROG = []


def prog_add(t0, chords, bar=BAR):
    for i, c in enumerate(chords):
        PROG.append((t0 + i * bar, c))


prog_add(0, ['Am', 'Am', 'Am', 'Am'])
prog_add(8, ['F', 'Dm', 'E'])
prog_add(14, ['Am', 'F', 'G'])
prog_add(20, ['Am', 'F', 'C', 'G', 'Am', 'F'])
prog_add(32, ['Am'] * 5)
prog_add(42, ['Dm', 'F', 'G', 'E'])
prog_add(50, ['Am', 'F', 'C', 'G'])
prog_add(58, ['Am', 'F', 'C', 'G'])
prog_add(66, ['Am', 'F', 'C', 'G', 'Am', 'F', 'G'])
prog_add(80, ['F', 'G', 'Am', 'F', 'G'])
prog_add(90, ['Am', 'F', 'C', 'E'])
prog_add(98, ['Am', 'F', 'C'])
prog_add(104, ['Fmaj7', 'Fmaj7'])
PROG.sort()


def chord_at(t):
    c = PROG[0][1]
    for t0, name in PROG:
        if t0 <= t + 1e-6:
            c = name
    return CH[c]


# ----------------------------------------------------------------- instruments
def supersaw_note(m, dur, cutoff=2600, voices=7, detune=0.16, amp=1.0, a=0.25, r=0.8, bright_env=0.0):
    n = int((dur + r) * SR)
    out = np.zeros((2, n))
    f0 = mtof(m)
    for v in range(voices):
        d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune  # semitones
        f = f0 * 2 ** (d / 12)
        s = saw_blep(f, n, phase0=rng.random())
        pan = (v / (voices - 1)) * 2 - 1
        aL = np.cos((pan * 0.8 + 1) * np.pi / 4)
        aR = np.sin((pan * 0.8 + 1) * np.pi / 4)
        out[0] += s * aL
        out[1] += s * aR
    out /= voices ** 0.7
    out = lp(out, cutoff, 2)
    e = env_adsr(n, a, 0.4, 0.85, r, hold=dur)
    return out * e * amp


def pad_track(t0, t1, gain=0.5, cutoff=2400, octave=0, filt=None, notes_slice=slice(1, 5)):
    out = stereo()
    times = [p for p in PROG if t0 - 1e-6 <= p[0] < t1] or []
    # Include chord already sounding at t0
    if not times or times[0][0] > t0:
        times = [(t0, next(name for tt0, name in reversed(PROG) if tt0 <= t0))] + times
    for i, (ts, name) in enumerate(times):
        te = times[i + 1][0] if i + 1 < len(times) else t1
        for m in CH[name][notes_slice]:
            nt = supersaw_note(m + 12 * octave, te - ts, cutoff=cutoff, amp=1.0, a=0.35, r=0.9)
            place(out, nt, ts, gain)
    if filt:
        a, b = int(t0 * SR), int(min(t1 + 1, DUR) * SR)
        out[:, a:b] = sweep_filter(out[:, a:b], filt[0], filt[1], 'low', 0.8)
    return out


def bass_note(m, dur, cutoff=700, amp=1.0):
    n = int((dur + 0.05) * SR)
    f = mtof(m)
    s = 0.6 * saw_blep(f, n) + 0.9 * sine(f, n) + 0.35 * sine(f / 2, n)
    s = lp(s, cutoff, 2)
    e = env_adsr(n, 0.004, 0.12, 0.75, 0.05, hold=dur)
    return soft(s * e * amp, 1.4)


def pluck(m, dur=0.22, cutoff=5200, amp=1.0, decay=0.16, wave='saw'):
    n = int(dur * SR)
    f = mtof(m)
    if wave == 'saw':
        s = saw_blep(f, n) * 0.6 + saw_blep(f * 1.005, n) * 0.4
    else:
        s = np.sign(sine(f, n)) * 0.5 + sine(f * 2, n) * 0.3
    s = sweep_filter(s, cutoff, 600, 'low', 1.2, block=128)
    return s * expdec(n, decay) * amp * env_adsr(n, 0.002, 0.05, 1.0, 0.02)


def bell(m, dur=2.2, amp=1.0, ratio=3.5, index=2.5):
    n = int(dur * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    idx = index * np.exp(-t / 0.35)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx
    s = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.9)
    s += 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.4)
    return s * amp * env_adsr(n, 0.002, 0.1, 1.0, 0.05)


def kick(amp=1.0, tight=1.0, f_hi=150, f_lo=46, dur=0.55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / (0.035 * tight))
    s = sine(f, n) * np.exp(-t / (0.28 * tight))
    click = hp(noise(n), 2500) * np.exp(-t / 0.003) * 0.35
    return soft((s + click) * amp, 1.6)


def snare(amp=1.0, tone=190, dur=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    body = sine(tone * (1 + 0.5 * np.exp(-t / 0.01)), n) * np.exp(-t / 0.06) * 0.6
    nz = bp(noise(n), 1200, 9000) * np.exp(-t / 0.11)
    return (body + nz) * amp


def clap(amp=1.0, dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = bp(noise(n), 900, 6000)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        e += (t >= off) * np.exp(-np.clip(t - off, 0, None) / 0.008) * (0.8 if k < 2 else 1.0)
    e += (t >= 0.03) * np.exp(-np.clip(t - 0.03, 0, None) / 0.12) * 0.7
    return nz * e * amp


def hat(amp=1.0, open_=False):
    dur = 0.32 if open_ else 0.06
    n = int(dur * SR)
    s = hp(noise(n), 7500, 4)
    return s * expdec(n, 0.09 if open_ else 0.018) * amp


def sub_boom(amp=1.0, dur=2.2, f0=70, f1=34):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    return sine(f, n) * np.exp(-t / 0.7) * amp * env_adsr(n, 0.003, 0.1, 1, 0.05)


def impact(amp=1.0, bright=1.0, dur=2.6):
    """Cinematic hit: sub boom + noise crack + metallic ring, stereo with reverb."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    boom = sub_boom(1.0, dur)
    crack = bp(noise(n), 300, 9000) * np.exp(-t / 0.05) * 0.8 * bright
    ring = sum(sine(f, n) * np.exp(-t / (0.5 + 0.3 * i)) for i, f in enumerate([523.0, 1187.0, 1661.0, 2347.0])) * 0.08 * bright
    m = soft(boom + crack + ring, 1.3)
    st = np.stack([m, m])
    st[1] = np.roll(st[1], 37)
    return reverb(st, IR_BIG, 0.35) * amp


def whoosh(dur=0.8, f0=300, f1=4000, amp=1.0, pan0=-0.6, pan1=0.6, q=1.4, shape=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = noise(n)
    s = sweep_filter(nz, f0, f1, 'band', q, block=128)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** shape
    s = s * e * amp * 1.4
    pans = np.linspace(pan0, pan1, n)
    a = (pans + 1) * np.pi / 4
    return np.stack([s * np.cos(a), s * np.sin(a)]) * np.sqrt(2)


def riser(dur=4.0, amp=1.0, f0=200, f1=6000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    nz = sweep_filter(noise(n), f0, f1, 'band', 0.7, block=256)
    tone = saw_blep(110 * 2 ** (k * 2.5), n) * 0.25 + saw_blep(110 * 1.007 * 2 ** (k * 2.5), n) * 0.25
    tone = sweep_filter(tone, 400, 7000, 'low', 0.9, block=256)
    e = k ** 2.2
    s = (nz * 0.9 + tone) * e * amp
    st = np.stack([s, np.roll(s, 89)])
    return reverb(st, IR_MED, 0.25)


def reverse_swell(m_list, dur=1.6, amp=1.0):
    n = int(dur * SR)
    out = np.zeros((2, n))
    for m in m_list:
        nt = supersaw_note(m, dur * 0.5, cutoff=3000, a=0.01, r=0.4)
        place_local(out, nt, 0)
    out = reverb(out, IR_BIG, 0.9)[:, ::-1]
    e = np.linspace(0, 1, n) ** 2
    return out * e * amp


def place_local(dst, sig, i0):
    n = min(sig.shape[1], dst.shape[1] - i0)
    dst[:, i0:i0 + n] += sig[:, :n]


def blip(f=1200, dur=0.12, amp=1.0, f_end=None, wave='sine'):
    n = int(dur * SR)
    t = np.arange(n) / SR
    fe = f if f_end is None else f_end
    fr = f * (fe / f) ** (t / dur)
    s = sine(fr, n) if wave == 'sine' else np.sign(sine(fr, n)) * 0.5
    return s * np.exp(-t / (dur / 4)) * env_adsr(n, 0.001, 0.01, 1, 0.01) * amp


def typing_clicks(t0, t1, rate=26, amp=0.25):
    out = stereo()
    t = t0
    while t < t1:
        n = int(0.012 * SR)
        c = bp(noise(n), 1800 + rng.random() * 3000, 9000) * expdec(n, 0.0025)
        place(out, c, t, amp * (0.6 + 0.4 * rng.random()), pan=rng.uniform(-0.3, 0.3))
        t += (1 / rate) * (0.5 + rng.random())
    return out


def glitch_burst(dur=0.5, amp=1.0, density=60):
    n = int(dur * SR)
    out = np.zeros((2, n))
    t = 0.0
    while t < dur:
        seg = 0.006 + rng.random() * 0.035
        m = int(seg * SR)
        kind = rng.random()
        if kind < 0.4:
            f = 200 * 2 ** (rng.random() * 4.5)
            s = np.sign(sine(f, m)) * 0.5
        elif kind < 0.7:
            s = noise(m) * 0.6
            s = np.round(s * 4) / 4
        else:
            f = 60 * 2 ** (rng.random() * 3)
            s = saw_blep(f, m)
        s = s * env_adsr(m, 0.001, 0.0, 1.0, 0.002)
        pan = rng.uniform(-0.8, 0.8)
        a = (pan + 1) * np.pi / 4
        i0 = int(t * SR)
        k = min(m, n - i0)
        out[0, i0:i0 + k] += (s * np.cos(a))[:k]
        out[1, i0:i0 + k] += (s * np.sin(a))[:k]
        t += seg + rng.random() * (1 / density)
    return out * amp


def scan_sweep(dur=0.7, amp=1.0, up=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 600 * 2 ** ((t / dur if up else 1 - t / dur) * 2.2)
    s = sine(f, n) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t))) * 0.5
    s += sweep_filter(noise(n), 1500, 7000, 'band', 2.0, block=128) * 0.5
    return s * np.sin(np.pi * t / dur) * amp


def zip_fx(dur=0.8, amp=1.0, f0=300, f1=1800):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = ease_io(t / dur)
    f = f0 * (f1 / f0) ** k
    s = sine(f, n) * 0.6 + sweep_filter(noise(n), f0 * 2, f1 * 3, 'band', 3, block=128) * 0.4
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    pans = np.linspace(-0.7, 0.7, n)
    a = (pans + 1) * np.pi / 4
    s = s * e * amp
    return np.stack([s * np.cos(a), s * np.sin(a)]) * np.sqrt(2)


def ease_io(x):
    x = np.clip(x, 0, 1)
    return np.where(x < 0.5, 4 * x ** 3, 1 - (-2 * x + 2) ** 3 / 2)


def thud(amp=1.0, f0=130, f1=55):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    s = sine(f, n) * np.exp(-t / 0.16) + lp(noise(n), 900) * np.exp(-t / 0.03) * 0.3
    return soft(s * amp, 1.2)


def sonar(f=1320, amp=1.0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    s = sine(f, n) * np.exp(-t / 0.25) + sine(f * 1.5, n) * np.exp(-t / 0.12) * 0.3
    st = np.stack([s, s])
    return delay(st, 0.375, 0.35, 4) * amp


def drone(t0, t1, m=33, amp=1.0, cutoff=500):
    n = int((t1 - t0) * SR)
    f = mtof(m)
    s = saw_blep(f, n) + saw_blep(f * 1.004, n) + 0.8 * sine(f / 2, n)
    s = lp(s, cutoff, 2)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.15 * np.arange(n) / SR)
    e = env_adsr(n, 1.5, 0.1, 1.0, 1.5)
    st = np.stack([s, np.roll(s, 211)]) * lfo * e * amp
    out = stereo()
    place(out, st, t0)
    return out


# ----------------------------------------------------------------- arrangement
drums = stereo()
bassb = stereo()
music = stereo()
arp = stereo()
fx = stereo()
side_env = np.zeros(N)  # sidechain trigger envelope


def K(t, amp=1.0, **kw):
    place(drums, kick(amp, **kw), t, 0.9)
    i = int(t * SR)
    L = int(0.32 * SR)
    if i < N:
        e = np.exp(-np.arange(min(L, N - i)) / SR / 0.11)
        side_env[i:i + len(e)] = np.maximum(side_env[i:i + len(e)], e)


def beats(t0, t1, step=BEAT):
    k = 0
    out = []
    while t0 + k * step < t1 - 1e-6:
        out.append(t0 + k * step)
        k += 1
    return out


def groove(t0, t1, kick_on=True, clap_on=True, hats=16, open_hats=True, kick_every=1, amp=1.0):
    for i, b in enumerate(beats(t0, t1)):
        if kick_on and i % kick_every == 0:
            K(b, 0.95 * amp)
        if clap_on and i % 4 in (1, 3):
            place(drums, clap(0.55 * amp), b, 1.0, pan=0.05)
            place(drums, snare(0.25 * amp), b, 1.0)
    if hats:
        step = BEAT * 4 / hats
        for j, h in enumerate(beats(t0, t1, step)):
            accent = 1.0 if (j % 2 == 1) else 0.55
            place(drums, hat(0.16 * accent * amp), h, 1.0, pan=0.25 if j % 2 else -0.15)
    if open_hats:
        for b in beats(t0 + BEAT / 2, t1):
            place(drums, hat(0.13 * amp, open_=True), b, 1.0, pan=-0.2)


def bassline(t0, t1, pattern='8th', amp=0.55, cutoff=650, octave=0):
    step = BEAT / 2 if pattern == '8th' else (BEAT / 4 if pattern == '16th' else BEAT)
    for b in beats(t0, t1, step):
        root = chord_at(b)[0] + 12 * octave
        place(bassb, bass_note(root, step * 0.85, cutoff=cutoff, amp=amp), b, 1.0)


def arpeggio(t0, t1, amp=0.18, octave=1, cutoff=4200, rate=4):
    step = BEAT / rate
    pat = [1, 2, 3, 4, 3, 2, 1, 3]
    for j, b in enumerate(beats(t0, t1, step)):
        ch = chord_at(b)
        m = ch[pat[j % len(pat)]] + 12 * octave
        place(arp, pluck(m, 0.25, cutoff=cutoff, amp=amp), b, 1.0, pan=0.35 if j % 2 else -0.35)


# --- 0–14: hook / question -------------------------------------------------
music += drone(0.0, 14.5, m=33, amp=0.07, cutoff=380)
music += pad_track(0.3, 8.0, gain=0.09, cutoff=1400, filt=(500, 2400))
fx += typing_clicks(1.2, 3.35, rate=30, amp=0.22)
for h in beats(1.25, 3.6, BEAT / 2):
    place(drums, hat(0.07), h, 1.0, pan=0.3)
# progress bar: rising soft tone
n = int(2.2 * SR)
tone = sine(mtof(69) * 2 ** (np.linspace(0, 1, n) * 1.0), n) * np.linspace(0.2, 1, n) * 0.06
place(fx, tone, 1.35, 1.0, pan=0.1)
place(fx, whoosh(0.55, 2000, 200, 0.18), 0.0)
place(fx, impact(0.55, bright=0.8), 3.6)
for i, m in enumerate([69, 72, 76, 81]):
    place(fx, bell(m, 2.4, 0.11), 3.6 + i * 0.03, 1.0, pan=-0.3 + 0.2 * i)
place(fx, whoosh(0.7, 400, 5000, 0.35), 4.2)
place(fx, whoosh(0.6, 5000, 400, 0.22, 0.6, -0.6), 7.45)
music += pad_track(8.0, 14.0, gain=0.11, cutoff=1800, filt=(900, 2600))
place(fx, glitch_burst(0.6, 0.45), 8.25)
place(fx, whoosh(0.6, 400, 4500, 0.28), 8.05)
place(fx, whoosh(0.6, 500, 5000, 0.28, 0.5, -0.5), 8.65)
place(fx, reverse_swell([69, 72, 76], 1.4, 0.35), 8.15)
place(fx, whoosh(1.1, 200, 3000, 0.4, -0.2, 0.2, shape=0.6), 9.4)
place(fx, bell(76, 3.0, 0.08), 9.6, 1.0, pan=0.2)
for b in beats(9.0, 14.0, BEAT * 2):
    place(drums, kick(0.35, tight=1.4), b, 0.8)
place(fx, riser(2.0, 0.55), 12.0)

# --- 14–20: missing layer ---------------------------------------------------
place(fx, impact(0.7), 14.0)
for i in range(5):
    place(fx, thud(0.42, 150 - i * 8, 52), S['layer'] + 0.1 + i * 0.14 + 0.42, 1.0, pan=-0.2 + 0.1 * i)
music += pad_track(14.0, 20.0, gain=0.17, cutoff=2000)
bassline(14.5, 19.3, '8th', amp=0.32, cutoff=420)
for k in range(5):
    place(fx, sonar(1318, 0.07), 15.0 + k * 0.95, 1.0, pan=0.4)
place(fx, whoosh(0.7, 500, 4000, 0.3), 14.55)
place(fx, riser(1.2, 0.5, 300, 8000), 18.8)
place(fx, whoosh(0.75, 200, 6000, 0.5, -0.3, 0.3, shape=0.5), 19.25)

# --- 20–32: thousands of agents ----------------------------------------------
place(fx, impact(0.75), 20.0)
groove(20.0, 24.0, clap_on=False, hats=8, open_hats=False, amp=0.8)
groove(24.0, 31.0, hats=16, open_hats=True)
bassline(20.0, 31.0, '8th', amp=0.5, cutoff=700)
arpeggio(20.0, 31.5, amp=0.16)
music += pad_track(20.0, 31.8, gain=0.16, cutoff=2600, filt=(1200, 3400))
for i in range(7):
    place(fx, blip(1500 + 220 * i, 0.09, 0.07), S['agents'] + 1.0 + i * 0.22, 1.0, pan=rng.uniform(-0.7, 0.7))
for i in range(4):
    t0 = S['agents'] + 4.25 + i * 1.25
    place(fx, whoosh(0.45, 600, 5000, 0.22, (-0.7 if i % 2 == 0 else 0.7), 0.0), t0 - 0.1)
    place(fx, pluck(76 + [0, 3, 7, 12][i], 0.5, 6000, 0.22, 0.25), t0 + 0.05, 1.0, pan=(-0.5 if i % 2 == 0 else 0.5))
    place(fx, blip(2400, 0.08, 0.05), t0 + 0.5, 1.0)
place(fx, glitch_burst(1.0, 0.35, 40), 31.0)
place(fx, riser(1.6, 0.35, 400, 9000), 30.3)

# --- 32–42: the problem -----------------------------------------------------
music += drone(32.0, 42.3, m=33, amp=0.085, cutoff=300)
music += drone(32.0, 42.3, m=34, amp=0.025, cutoff=900)  # dissonant Bb against A
for b in beats(32.6, 41.0, 1.0):
    place(drums, kick(0.42, tight=1.2, f_hi=110, f_lo=42), b, 0.55)
    place(drums, kick(0.28, tight=1.2, f_hi=100, f_lo=42), b + 0.22, 0.55)
place(fx, glitch_burst(0.9, 0.55), 32.1)
place(fx, whoosh(0.6, 3000, 300, 0.25), 33.5)
place(fx, whoosh(0.6, 400, 3000, 0.2), 33.8)
n = int(1.0 * SR)
conf = sine(mtof(64) * 2 ** (np.sqrt(np.linspace(0, 1, n)) * 1.0), n) * 0.05 * np.linspace(0.3, 1, n)
place(fx, conf, S['problem'] + 2.4, 1.0, pan=0.2)
place(fx, scan_sweep(0.62, 0.22), S['problem'] + 3.55)
hit = impact(0.85, bright=1.2)
place(fx, hit, S['problem'] + 4.1)
place(fx, glitch_burst(0.45, 0.6), S['problem'] + 4.1)
for m in [45, 46, 52]:
    place(fx, supersaw_note(m, 0.5, cutoff=1400, a=0.005, r=0.6) * 0.25, S['problem'] + 4.1)
place(fx, whoosh(0.6, 500, 4000, 0.22), S['problem'] + 4.7)
place(fx, whoosh(0.7, 400, 5000, 0.28, 0.5, -0.5), S['problem'] + 5.65)
for k in range(9):
    place(fx, glitch_burst(0.12, 0.25, 80), S['problem'] + 6.3 + k * 0.42 + rng.random() * 0.2)
place(fx, glitch_burst(0.75, 0.55), 41.25)

# --- 42–50: independent verification + build -------------------------------
place(fx, impact(0.45, bright=0.6), 42.0)
music += pad_track(42.0, 49.8, gain=0.16, cutoff=1800, filt=(800, 4500))
groove(42.0, 48.0, clap_on=False, hats=8, open_hats=False, amp=0.65)
bassline(42.0, 49.0, '8th', amp=0.42, cutoff=600)
place(fx, zip_fx(0.55, 0.18, 300, 1200), S['verify'] + 0.7)
place(fx, zip_fx(0.8, 0.16, 1400, 500), S['verify'] + 1.45)
place(fx, whoosh(0.25, 2000, 8000, 0.35, -0.3, 0.3), S['verify'] + 2.53)
place(fx, whoosh(0.25, 2000, 8000, 0.35, 0.3, -0.3), S['verify'] + 2.7)
place(fx, thud(0.35), S['verify'] + 2.75)
place(fx, whoosh(0.7, 4000, 300, 0.3), S['verify'] + 4.05)
for i in range(5):
    place(fx, bell(72 + [0, 3, 7, 10, 12][i], 1.6, 0.07, ratio=2.0, index=1.5), S['verify'] + 4.5 + i * 0.13, 1.0, pan=-0.6 + 0.3 * i)
n = int(2.6 * SR)
hum = (sine(mtof(57), n) + 0.5 * sine(mtof(64), n)) * 0.03 * env_adsr(n, 0.6, 0.1, 1, 0.3)
place(fx, hum, S['verify'] + 5.25)
place(fx, whoosh(0.6, 500, 4000, 0.22), S['verify'] + 5.25)
place(fx, riser(3.6, 0.8), 46.3)
for b in beats(48.0, 49.0, BEAT / 2):
    place(drums, snare(0.25), b, 1.0)
for b in beats(49.0, 49.75, BEAT / 4):
    place(drums, snare(0.3), b, 1.0)
for b in beats(49.25, 49.75, BEAT / 8):
    place(drums, snare(0.22), b, 1.0)

# --- 50–58: DROP / GenLayer ---------------------------------------------------
LOCK = S['genlayer'] + 0.5
place(fx, impact(0.8), 50.0)
place(fx, whoosh(0.5, 300, 6000, 0.45, -0.8, 0.0), 50.0)
place(fx, whoosh(0.5, 300, 6000, 0.45, 0.8, 0.0), 50.02)
place(fx, impact(1.05, bright=1.4), LOCK)
for i, m in enumerate([57, 64, 69, 72, 76]):
    place(fx, bell(m + 12, 3.0, 0.07), LOCK + 0.01 * i, 1.0, pan=-0.4 + 0.2 * i)
groove(LOCK, 58.0)
bassline(LOCK, 57.75, '8th', amp=0.56, cutoff=800)
arpeggio(LOCK, 57.75, amp=0.17, cutoff=5200)
music += pad_track(50.0, 58.0, gain=0.24, cutoff=3800)
music += pad_track(50.0, 58.0, gain=0.07, cutoff=5200, octave=1, notes_slice=slice(2, 5))
for i, tp in enumerate([S['genlayer'] + 4.0, S['genlayer'] + 4.4]):
    place(fx, blip(880 * (1.5 if i else 1), 0.18, 0.1, 1760 * (1.5 if i else 1)), tp, 1.0, pan=0.4)
    place(fx, whoosh(0.4, 800, 6000, 0.18, 0.6, 0.2), tp - 0.1)
place(fx, whoosh(0.5, 400, 4000, 0.2), LOCK + 0.5)
place(fx, reverse_swell([69, 72, 76], 1.0, 0.3), 57.0)

# --- 58–66: the question ----------------------------------------------------
groove(58.0, 65.6, clap_on=True, hats=8, open_hats=False, amp=0.6)
bassline(58.0, 65.6, '8th', amp=0.38, cutoff=600)
arpeggio(58.0, 65.6, amp=0.12, cutoff=3200)
music += pad_track(58.0, 66.0, gain=0.17, cutoff=2600)
place(fx, blip(660, 0.15, 0.1, 990), S['question'] + 0.3)
place(fx, zip_fx(0.4, 0.2, 1800, 400), S['question'] + 1.9)
place(fx, whoosh(0.6, 400, 5000, 0.28), S['question'] + 2.5)
for i in range(3):
    place(fx, pluck(81 + [0, 4, 7][i], 0.4, 7000, 0.16, 0.18), S['question'] + 4.3 + i * 0.28, 1.0, pan=-0.3 + 0.3 * i)
for i in range(2):
    place(fx, impact(0.25, bright=0.5, dur=1.5), S['question'] + 5.75 + i * 0.4)
    place(fx, bell(76 + 5 * i, 1.6, 0.07), S['question'] + 5.75 + i * 0.4, 1.0, pan=-0.3 + 0.6 * i)

# --- 66–80: workflow ----------------------------------------------------------
W0 = S['workflow']
place(fx, impact(0.5, bright=0.6), W0)
groove(W0, 79.5)
bassline(W0, 79.5, '8th', amp=0.52, cutoff=760)
arpeggio(W0, 79.5, amp=0.15, cutoff=4600)
music += pad_track(W0, 80.0, gain=0.2, cutoff=3200)
stage_t = [W0 + 0.45, W0 + 2.05, W0 + 4.35, W0 + 7.1]
for i, ts in enumerate(stage_t):
    place(fx, pluck([69, 72, 76, 81][i], 0.6, 7000, 0.3, 0.3), ts, 1.0, pan=-0.6 + 0.4 * i)
    place(fx, thud(0.3, 170, 70), ts, 1.0, pan=-0.6 + 0.4 * i)
for a, b in [(W0 + 1.2, W0 + 2.05), (W0 + 3.5, W0 + 4.35), (W0 + 6.25, W0 + 7.1)]:
    place(fx, zip_fx(b - a + 0.1, 0.18), a - 0.05)
n = int(1.5 * SR)
scan = sweep_filter(noise(n), 1000, 6000, 'band', 4, block=256) * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * np.arange(n) / SR)) * 0.08
place(fx, scan, W0 + 2.2, 1.0, pan=-0.2)
for i in range(5):
    if i == 3:
        place(fx, blip(220, 0.18, 0.12, 180, wave='square'), W0 + 4.75 + i * 0.22, 1.0, pan=0.2)
    else:
        place(fx, blip(1200 + 150 * i, 0.1, 0.11), W0 + 4.75 + i * 0.22, 1.0, pan=-0.4 + 0.2 * i)
for i, m in enumerate([69, 73, 76, 81]):
    place(fx, bell(m + 12, 2.0, 0.08), W0 + 5.95 + i * 0.02, 1.0, pan=-0.2 + 0.15 * i)
place(fx, whoosh(0.45, 2500, 600, 0.22, 0.9, 0.5), W0 + 7.45)
place(fx, thud(0.5, 200, 60), W0 + 7.9)
place(fx, impact(0.3, bright=0.6, dur=1.5), W0 + 7.95)
for i, m in enumerate([76, 81, 84]):
    place(fx, bell(m, 1.8, 0.07), W0 + 7.95 + i * 0.06, 1.0, pan=0.5)
for k in range(2):
    place(fx, zip_fx(2.4, 0.08, 300, 1500), W0 + 8.6 + k * 2.6)

# --- 80–88: trustless layer (breakdown) -----------------------------------------
TR = S['trustless']
SPLIT = TR + 4.0
music += pad_track(TR, TR + 10.0, gain=0.2, cutoff=2200)
bassline(SPLIT - 0.05, TR + 9.6, '8th', amp=0.3, cutoff=420)
for j, b in enumerate(beats(TR, TR + 9.6, BEAT / 2)):
    ch = chord_at(b)
    m = ch[[2, 3, 4, 3][j % 4]] + 12
    place(arp, pluck(m, 0.5, 3000, 0.12, 0.3, wave='sq'), b, 1.0, pan=0.3 if j % 2 else -0.3)
place(fx, impact(0.4, bright=0.5), TR)
place(fx, thud(0.45), TR + 1.0)
place(fx, whoosh(0.3, 2000, 8000, 0.3, -0.5, 0.5), TR + 2.15)
place(fx, reverse_swell([65, 69, 72], 1.2, 0.3), SPLIT - 1.1)
place(fx, whoosh(0.6, 3000, 300, 0.25), SPLIT - 0.3)
for i in range(5):
    place(fx, thud(0.3, 150 - i * 8, 55), SPLIT - 0.1 + i * 0.08 + 0.35, 1.0)
place(fx, whoosh(0.9, 300, 3000, 0.35, 0.9, 0.0), SPLIT + 0.85)
place(fx, impact(0.75, bright=1.0), SPLIT + 1.7)
for i, m in enumerate([65, 69, 72, 76]):
    place(fx, bell(m + 12, 2.4, 0.07), SPLIT + 1.7 + i * 0.03, 1.0, pan=-0.3 + 0.2 * i)
place(fx, whoosh(0.6, 500, 4500, 0.2), SPLIT + 1.7)

# --- 88–96: half the problem (build) -------------------------------------------
HF = S['half']
music += pad_track(HF, HF + 7.7, gain=0.2, cutoff=2400, filt=(1200, 5000))
groove(HF, HF + 4.0, clap_on=False, hats=8, open_hats=False, kick_every=2, amp=0.8)
groove(HF + 4.0, HF + 7.0, clap_on=True, hats=16, open_hats=False, amp=0.85)
bassline(HF, HF + 7.5, '8th', amp=0.45, cutoff=650)
arpeggio(HF + 4.0, HF + 7.5, amp=0.13)
n = int(1.0 * SR)
place(fx, sine(mtof(57) * 2 ** (np.linspace(0, 1, n)), n) * 0.06 * np.linspace(0.2, 1, n), HF + 0.5, 1.0, pan=-0.4)
n = int(1.1 * SR)
place(fx, sine(mtof(64) * 2 ** (np.linspace(0, 1, n)), n) * 0.06 * np.linspace(0.2, 1, n), HF + 3.9, 1.0, pan=0.4)
for i, m in enumerate([69, 72, 76, 81]):
    place(fx, bell(m + 12, 2.2, 0.08), HF + 5.0 + i * 0.03, 1.0, pan=-0.2 + 0.15 * i)
place(fx, riser(2.6, 0.75), HF + 5.4)
for b in beats(HF + 6.0, HF + 7.0, BEAT / 2):
    place(drums, snare(0.25), b, 1.0)
for b in beats(HF + 7.0, HF + 7.75, BEAT / 4):
    place(drums, snare(0.3), b, 1.0)

# --- 96–106: outro -------------------------------------------------------------
OU = S['outro']
CARD = OU + 4.75
place(fx, impact(1.0, bright=1.3), OU)
for i, m in enumerate([57, 64, 69, 72, 76]):
    place(fx, bell(m + 12, 3.2, 0.07), OU + 0.01 * i, 1.0, pan=-0.4 + 0.2 * i)
groove(OU, CARD - 0.25, hats=16)
bassline(OU, CARD - 0.25, '8th', amp=0.5, cutoff=760)
arpeggio(OU, CARD, amp=0.14)
music += pad_track(OU, OU + 5.0, gain=0.24, cutoff=3800)
music += pad_track(OU, OU + 5.0, gain=0.07, cutoff=5200, octave=1, notes_slice=slice(2, 5))
place(fx, whoosh(0.8, 300, 5000, 0.3), OU + 0.6)
place(fx, reverse_swell([65, 69, 72, 76], 1.2, 0.35), CARD - 1.05)
place(fx, impact(1.0, bright=1.1, dur=4.0), OU + 5.0)
for m in CH['Fmaj7'][1:] + [76, 81]:
    nt = supersaw_note(m, 3.4, cutoff=3200, a=0.01, r=2.0) * 0.26
    place(music, nt, OU + 5.0)
place(music, np.stack([bass_note(41, 3.0, 500, 0.5)] * 2), OU + 5.0)
for i, m in enumerate([65, 69, 72, 76, 81]):
    place(fx, bell(m + 12, 4.0, 0.06), OU + 5.0 + 0.05 * i, 1.0, pan=-0.4 + 0.2 * i)

# ----------------------------------------------------------------- mix
print('mixing...')
side = 1 - 0.55 * np.clip(side_env, 0, 1)
music = reverb(music, IR_BIG, 0.32) * side
bassb = bassb * (1 - 0.7 * np.clip(side_env, 0, 1))
arp = delay(arp, BEAT * 0.75, 0.32, 5)
arp = reverb(arp, IR_MED, 0.3) * (1 - 0.35 * np.clip(side_env, 0, 1))
drums = reverb(drums, IR_MED, 0.08)
fx = reverb(fx, IR_MED, 0.18)

STEM_GAIN = dict(drums=0.68, bass=0.8, music=1.25, arp=1.25, fx=0.62)
stems = dict(drums=drums, bass=bassb, music=music, arp=arp, fx=fx)
if os.environ.get('STEMS'):
    secs = [(0, 14), (14, 20), (20, 32), (32, 42), (42, 50), (50, 58), (58, 66), (66, 80), (80, 90), (90, 98), (98, 108)]
    print('section      ' + '  '.join(f'{k:>7s}' for k in stems))
    for a, b in secs:
        row = []
        for k, v in stems.items():
            seg = v[:, int(a * SR):int(b * SR)] * STEM_GAIN[k]
            row.append(10 * np.log10((seg ** 2).mean() + 1e-12))
        print(f'{a:3d}-{b:3d}     ' + '  '.join(f'{x:7.1f}' for x in row))
mix = sum(STEM_GAIN[k] * v for k, v in stems.items())
mix = hp(mix, 28, 2)

# Gentle bus compression (RMS follower) then a look-ahead peak limiter.
mono = np.sqrt((mix ** 2).mean(axis=0))
rms = np.sqrt(sg.lfilter([1 - np.exp(-1 / (0.08 * SR))], [1, -np.exp(-1 / (0.08 * SR))], mono ** 2))
thr = 0.32
gain = np.where(rms > thr, (thr / np.maximum(rms, 1e-9)) ** (1 - 1 / 1.7), 1.0)
mix *= gain
peak = np.abs(mix).max(axis=0)
la = int(0.004 * SR)
from scipy.ndimage import maximum_filter1d, uniform_filter1d
pk = maximum_filter1d(peak, size=2 * la + 1)
ceil = 0.89
g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
g = uniform_filter1d(g, size=la)
g = np.minimum(g, ceil / np.maximum(pk, 1e-9) + 0.0)
mix *= g
# fade the very end
fe = int(1.2 * SR)
mix[:, -fe:] *= np.linspace(1, 0, fe) ** 2
mix = np.clip(mix, -0.99, 0.99)

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
outp = os.path.join(ROOT, 'out', 'soundtrack_raw.wav')
wavfile.write(outp, SR, (mix.T * 32767).astype(np.int16))
print('wrote', outp, f'{N / SR:.1f}s', 'peak', float(np.abs(mix).max()))

# ----------------------------------------------------------------- loudness
# Two-pass EBU R128 normalisation to streaming loudness (-14 LUFS, -1.5 dBTP).
import subprocess
final = os.path.join(ROOT, 'out', 'soundtrack.wav')
p1 = subprocess.run(['ffmpeg', '-hide_banner', '-i', outp, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
js = json.loads(p1[p1.rindex('{'):p1.rindex('}') + 1])
af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
      f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', outp, '-af', af, '-ar', '48000', final], check=True)
print('wrote', final, '(input', js['input_i'], 'LUFS, LRA', js['input_lra'], ')')
