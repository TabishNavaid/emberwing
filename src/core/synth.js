// the instruments, all made from scratch with web audio (no sound files to download or license).
// every function schedules one note at `when` (audio clock) into `out`

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// tiny seeded random so the plucked strings sound the same every time
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

let noiseBuf = null;
export function noise(ac) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    const r = lcg(7);
    for (let i = 0; i < d.length; i++) d[i] = r();
  }
  return noiseBuf;
}

function env(ac, when, attack, peak, hold, release) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.setValueAtTime(peak, when + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  return g;
}

function osc(ac, type, freq, when, stop) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.start(when);
  o.stop(stop);
  return o;
}

// harp / folk guitar: karplus-strong plucked string, rendered once per note and cached.
// the rounding of the delay line makes it a bit out of tune, playbackRate fixes that
const plucks = new Map();
function pluckBuffer(ac, midi) {
  let p = plucks.get(midi);
  if (p) return p;
  const sr = ac.sampleRate;
  const f = mtof(midi);
  const n = Math.max(2, Math.round(sr / f));
  const len = Math.floor(sr * 2.2);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const ring = new Float32Array(n);
  const r = lcg(midi * 977 + 13);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    // softened noise burst = a warmer, less twangy pluck
    prev = prev * 0.5 + r() * 0.5;
    ring[i] = prev;
  }
  const decay = Math.pow(0.001, 1 / (2.0 * f)); // about -60db after 2s, whatever the pitch
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx];
    const b = ring[(idx + 1) % n];
    d[i] = a;
    ring[idx] = (a + b) * 0.5 * decay;
    idx = (idx + 1) % n;
  }
  p = { buf, rate: f / (sr / (n + 0.5)) };
  plucks.set(midi, p);
  return p;
}
export function pluck(ac, out, midi, when, vel = 0.3) {
  const p = pluckBuffer(ac, midi);
  const src = ac.createBufferSource();
  src.buffer = p.buf;
  src.playbackRate.value = p.rate;
  const g = ac.createGain();
  g.gain.value = vel;
  src.connect(g).connect(out);
  src.start(when);
}

// tin whistle: sine with a little triangle, breath noise, a slide up into the note and
// vibrato that only comes in on long notes
export function whistle(ac, out, midi, when, dur, vel = 0.12) {
  const f = mtof(midi);
  const stop = when + dur + 0.15;
  const a = env(ac, when, 0.035, vel, Math.max(0, dur - 0.06), 0.1);
  const o1 = osc(ac, 'sine', f, when, stop);
  o1.frequency.setValueAtTime(f * 0.985, when);
  o1.frequency.linearRampToValueAtTime(f, when + 0.05);
  const o2 = osc(ac, 'triangle', f, when, stop);
  const g2 = ac.createGain();
  g2.gain.value = 0.22;
  if (dur > 0.4) {
    const lfo = osc(ac, 'sine', 5.6, when, stop);
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(f * 0.007, when + 0.35);
    lfo.connect(depth);
    depth.connect(o1.frequency);
    depth.connect(o2.frequency);
  }
  const n = ac.createBufferSource();
  n.buffer = noise(ac);
  n.start(when, Math.random() * 1.5);
  n.stop(stop);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f * 2;
  bp.Q.value = 1.2;
  const gn = ac.createGain();
  gn.gain.value = 0.18;
  o1.connect(a);
  o2.connect(g2).connect(a);
  n.connect(bp).connect(gn).connect(a);
  a.connect(out);
}

// soft string pad, a couple of detuned saws per note through a lowpass
export function pad(ac, out, notes, when, dur, vel = 0.05, attack = 0.3) {
  const stop = when + dur + 0.6;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1300;
  lp.Q.value = 0.4;
  const a = env(ac, when, attack, vel, Math.max(0, dur - attack), 0.5);
  for (const m of notes) {
    for (const det of [-7, 6]) {
      const o = osc(ac, 'sawtooth', mtof(m), when, stop);
      o.detune.value = det;
      o.connect(lp);
    }
  }
  lp.connect(a).connect(out);
}

// brass: stacked saws with a filter that opens on every note (the "blat"), and a swell in
// volume. this is the big moment, so it's the loudest thing in the game
export function brass(ac, out, notes, when, dur, vel = 0.09, { swell = 0.35 } = {}) {
  const stop = when + dur + 0.5;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2.2;
  lp.frequency.setValueAtTime(320, when);
  lp.frequency.exponentialRampToValueAtTime(2800, when + 0.16 + swell * 0.4);
  lp.frequency.exponentialRampToValueAtTime(1500, when + 0.5 + swell);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vel * 0.45, when + 0.05);
  g.gain.linearRampToValueAtTime(vel, when + 0.05 + swell);
  g.gain.setValueAtTime(vel, when + Math.max(0.1 + swell, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, stop);
  for (const m of notes) {
    for (const det of [-9, 0, 8]) {
      const o = osc(ac, 'sawtooth', mtof(m), when, stop);
      o.detune.value = det;
      const lfo = osc(ac, 'sine', 5 + det * 0.03, when, stop);
      const dg = ac.createGain();
      dg.gain.setValueAtTime(0, when);
      dg.gain.linearRampToValueAtTime(5, when + 0.6);
      lfo.connect(dg).connect(o.detune);
      o.connect(lp);
    }
  }
  lp.connect(g).connect(out);
}

// hand drum: a low thump (pitch dropping) plus a slap of noise. tip = the lighter rim hits
export function drum(ac, out, when, vel = 0.3, tip = false) {
  const o = osc(ac, 'sine', tip ? 190 : 120, when, when + 0.4);
  o.frequency.exponentialRampToValueAtTime(tip ? 120 : 52, when + (tip ? 0.05 : 0.12));
  const g = env(ac, when, 0.003, vel, 0, tip ? 0.12 : 0.32);
  o.connect(g).connect(out);
  const n = ac.createBufferSource();
  n.buffer = noise(ac);
  n.start(when, Math.random());
  n.stop(when + 0.08);
  const f = ac.createBiquadFilter();
  f.type = tip ? 'highpass' : 'lowpass';
  f.frequency.value = tip ? 1800 : 700;
  const gn = env(ac, when, 0.002, vel * (tip ? 0.35 : 0.5), 0, 0.05);
  n.connect(f).connect(gn).connect(out);
}

// big low boom for the swell and the celebration
export function boom(ac, out, when, vel = 0.5) {
  const o = osc(ac, 'sine', 78, when, when + 2);
  o.frequency.exponentialRampToValueAtTime(46, when + 0.5);
  const g = env(ac, when, 0.01, vel, 0.05, 1.6);
  o.connect(g).connect(out);
  const o2 = osc(ac, 'triangle', 156, when, when + 1);
  const g2 = env(ac, when, 0.005, vel * 0.25, 0, 0.6);
  o2.connect(g2).connect(out);
}

// cymbal-ish shimmer: long bright noise
export function shimmer(ac, out, when, vel = 0.06, len = 2.5) {
  const n = ac.createBufferSource();
  n.buffer = noise(ac);
  n.loop = true;
  n.start(when);
  n.stop(when + len + 0.1);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const g = env(ac, when, 0.02, vel, 0, len);
  n.connect(hp).connect(g).connect(out);
}

// a rising drum roll, the "breath in" before the swell
export function roll(ac, out, when, len = 0.7, vel = 0.25) {
  const hits = 14;
  for (let i = 0; i < hits; i++) {
    const k = i / hits;
    drum(ac, out, when + len * (1 - Math.pow(1 - k, 1.6)), vel * (0.3 + 0.7 * k), true);
  }
}

// bell / chime. slightly stretched partials so it rings like metal
export function bell(ac, out, midi, when, vel = 0.12) {
  const f = mtof(midi);
  for (const [mult, amp, len] of [[1, 1, 1.6], [2.01, 0.45, 1.0], [3.03, 0.22, 0.6], [4.2, 0.12, 0.35]]) {
    const o = osc(ac, 'sine', f * mult, when, when + len + 0.1);
    const g = env(ac, when, 0.002, vel * amp, 0, len);
    o.connect(g).connect(out);
  }
}

// a dragon's chirp: two quick rising blips. bigger dragons chirp lower
export function chirp(ac, out, midi, when, vel = 0.08) {
  const f = mtof(midi);
  for (const [dt, a, b] of [[0, 1, 1.45], [0.09, 1.2, 1.8]]) {
    const o = osc(ac, 'triangle', f * a, when + dt, when + dt + 0.12);
    o.frequency.exponentialRampToValueAtTime(f * b, when + dt + 0.07);
    const g = env(ac, when + dt, 0.006, vel, 0.02, 0.07);
    o.connect(g).connect(out);
  }
}

// achoo: a breathy burst sweeping down, then a crackle of sparks
export function sneeze(ac, out, when, vel = 0.1) {
  const n = ac.createBufferSource();
  n.buffer = noise(ac);
  n.start(when, Math.random());
  n.stop(when + 0.3);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.5;
  bp.frequency.setValueAtTime(3200, when);
  bp.frequency.exponentialRampToValueAtTime(900, when + 0.18);
  const g = env(ac, when, 0.01, vel, 0.03, 0.15);
  n.connect(bp).connect(g).connect(out);
  for (let i = 0; i < 4; i++) bell(ac, out, 96 + i * 3, when + 0.12 + i * 0.035, vel * 0.25);
}
