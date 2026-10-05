import { noise, pluck, whistle, pad, brass, drum, boom, shimmer, roll, bell, chirp, sneeze } from './synth.js';
import { playStep, chordAt } from './tune.js';

// sound is on by default now: an original folk-style score that builds through the flight, a
// real brass swell, chimes on the hoops, a chord when you find the dragon, chirps. M mutes it
// and that's remembered. nothing in the game depends on hearing it, every cue is also visual.
// browsers keep audio locked until someone presses a key or touches the screen, see unlock()

const KEY = 'emberwing.sound.v1';
const LEAD = 0.05; // schedule this far ahead of "now" so notes land on time
const AHEAD = 0.2; // how much music to have queued up at any moment
const PENTA = [0, 2, 4, 7, 9];

export class Audio {
  constructor(beat) {
    this.beat = beat;
    this.on = true;
    try {
      if (localStorage.getItem(KEY) === 'off') this.on = false;
    } catch {
      // storage blocked, stay on
    }
    this.ctx = null;
    this.sec = { name: 'silent', start: 0, zero: 0, swelled: false };
    this.anchor = null;
    this.nextStep = 0;
    this.hits = 0;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.build(new AC());
    } catch (e) {
      console.warn('[emberwing] no audio', e);
      this.ctx = null;
    }
  }

  build(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.on ? 0.55 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // a bit of hall: generated impulse response, no file needed
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let s = 99 + ch * 31;
      for (let i = 0; i < len; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        d[i] = ((s / 4294967296) * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    verb.connect(wet).connect(this.master);
    // everything plays into the bus, the bus feeds the dry signal and the reverb
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.bus.connect(verb);
    this.buildBeds();
  }

  // the steady stuff under the music: a low drone, and wind/rain noise for the storm
  buildBeds() {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    lp.connect(this.droneGain).connect(this.bus);
    for (const [f, g] of [[73.42, 0.5], [110, 0.35]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = ctx.createGain();
    lg.gain.value = 120;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();

    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    n.loop = true;
    const wind = ctx.createBiquadFilter();
    wind.type = 'bandpass';
    wind.frequency.value = 500;
    wind.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    n.connect(wind).connect(this.windGain).connect(this.master);
    const rain = ctx.createBiquadFilter();
    rain.type = 'highpass';
    rain.frequency.value = 3500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    n.connect(rain).connect(this.rainGain).connect(this.master);
    n.start();
  }

  // 'none' (no web audio), 'muted' (operator pressed M), 'locked' (waiting for a key or a
  // touch), or 'on'
  get status() {
    if (!this.ctx) return 'none';
    if (!this.on) return 'muted';
    return this.ctx.state === 'running' ? 'on' : 'locked';
  }
  // the station needs a key press before sound can start (desktop browsers block it until then)
  get needsGesture() {
    return this.status === 'locked';
  }

  // call from a real key press / click / touch. safari also wants a sound played right then
  unlock() {
    if (!this.ctx || this.ctx.state === 'running') return;
    try {
      this.ctx.resume();
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      // try again on the next gesture
    }
  }

  toggle() {
    this.on = !this.on;
    try {
      localStorage.setItem(KEY, this.on ? 'on' : 'off');
    } catch {
      // fine, it just won't survive a refresh
    }
    if (this.ctx) {
      if (this.on) this.unlock();
      this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.15);
    }
    this.anchor = null;
    return this.on;
  }

  get live() {
    return this.ctx && this.on && this.ctx.state === 'running';
  }
  get now() {
    return this.ctx.currentTime + LEAD;
  }

  // what the music should be doing. bar 1 of the tune lands on `zeroBeat` (a beat number on the
  // game's Beat clock), default = the next beat. lead = bars of vamp before the tune.
  // keep = same tune carrying on, just a new name (the climb at the end of the flight)
  section(name, { zeroBeat = null, lead = 0, keep = false } = {}) {
    if (keep) this.sec.name = name;
    else {
      const startBeat = zeroBeat ?? Math.ceil(this.beat.beat - 1e-6);
      this.sec = { name, start: startBeat * 2, zero: (startBeat + lead * 4) * 2, swelled: false };
      this.hits = 0;
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const beds = {
      attract: [0.05, 0.02, 0],
      find: [0.06, 0.07, 0.035],
      flightIntro: [0.05, 0.04, 0],
      flight: [0.04, 0.03, 0],
      climb: [0.03, 0.02, 0],
      home: [0.04, 0.01, 0],
      card: [0.03, 0.01, 0],
    }[name] ?? [0, 0, 0];
    this.droneGain.gain.setTargetAtTime(beds[0], t, 0.6);
    this.windGain.gain.setTargetAtTime(beds[1], t, 0.6);
    this.rainGain.gain.setTargetAtTime(beds[2], t, 0.6);
    this.rainK = beds[2] / 0.05;
  }

  // rain you can hear on the squall route, 0..1
  rain(k) {
    if (!this.ctx || Math.abs(k - (this.rainK ?? 0)) < 0.02) return;
    this.rainK = k;
    this.rainGain.gain.setTargetAtTime(0.05 * k, this.ctx.currentTime, 0.4);
  }

  // called every game step. keeps about AHEAD seconds of music queued on the audio clock, lined
  // up with the game's beat so the hoops, wind and stones pulse with what you hear
  update() {
    if (!this.live) return;
    const per = this.beat.period;
    const b = this.beat.beat;
    const target = this.ctx.currentTime + LEAD;
    if (this.anchor) {
      const expected = this.anchor.t + (b - this.anchor.b) * per;
      if (Math.abs(expected - target) > 0.08) this.anchor = null;
    }
    if (!this.anchor) {
      // first time, or the game clock jumped (frozen tab, tests stepping the clock by hand).
      // don't re-anchor more than every quarter second or a fast-forward plays a pile of notes
      if (this.reAt !== undefined && this.ctx.currentTime - this.reAt < 0.25) return;
      this.reAt = this.ctx.currentTime;
      this.anchor = { t: target, b };
      this.nextStep = Math.floor(b * 2) + 1;
    }
    for (;;) {
      const when = this.anchor.t + (this.nextStep / 2 - this.anchor.b) * per;
      if (when > target + AHEAD) break;
      if (when >= this.ctx.currentTime) playStep(this.ctx, this.bus, this.sec, this.nextStep, when);
      this.nextStep++;
    }
  }

  chirp(d) {
    if (!this.live) return;
    // smaller dragons chirp higher, every dragon has its own note of the scale
    const m = 84 + PENTA[d.seed % 5] - Math.round((d.size - 1) * 14);
    chirp(this.ctx, this.bus, m, this.now, 0.07);
  }

  // one-shot cues, nothing in the game depends on hearing them
  cue(name) {
    if (!this.live) return;
    const ac = this.ctx;
    const out = this.bus;
    const t = this.now;
    const D = [50, 54, 57, 62, 66, 69];
    if (name === 'start') {
      // a quick run up the harp
      [62, 64, 66, 69, 71, 74, 78, 81].forEach((m, i) => pluck(ac, out, m, t + i * 0.035, 0.12));
    } else if (name === 'found') {
      // warm D chord with an added E, strings swelling under a harp sweep and a bell on top
      pad(ac, out, [50, 57, 62, 64, 66, 69], t, 1.6, 0.05, 0.12);
      [50, 57, 62, 64, 66, 69, 74, 78].forEach((m, i) => pluck(ac, out, m, t + i * 0.045, 0.15));
      bell(ac, out, 81, t + 0.38, 0.08);
    } else if (name === 'ring') {
      // a chime in the chord that's playing (hoops cross on the beat, so it lands on the music),
      // climbing up the chord with every hoop
      const chord = chordAt(Math.round(this.beat.beat * 2) - this.sec.zero);
      const m = chord[this.hits % 3] + (this.hits >= 3 ? 36 : 24);
      this.hits++;
      bell(ac, out, m, t, 0.1);
      bell(ac, out, m + 7, t + 0.06, 0.04);
    } else if (name === 'miss') {
      pluck(ac, out, 74, t, 0.08);
    } else if (name === 'windup') {
      roll(ac, out, t, 0.62, 0.22);
    } else if (name === 'swell') {
      // the brass swell: the whole section on a big D chord, a low boom and a cymbal wash.
      // the swell is on a downbeat, the tune starts over from the top in the brass right here
      this.sec.swelled = true;
      this.sec.zero = Math.round(this.beat.beat * 2);
      brass(ac, out, [38, 50, 57, 62, 66, 69], t, 1.9, 0.075, { swell: 0.45 });
      boom(ac, out, t, 0.45);
      shimmer(ac, out, t, 0.05, 2.8);
    } else if (name === 'home') {
      [62, 66, 69, 74, 78].forEach((m, i) => bell(ac, out, m + 12, t + i * 0.1, 0.07));
      pad(ac, out, [50, 57, 62, 66], t, 2.2, 0.035, 0.2);
    } else if (name === 'celebrate') {
      // fanfare: a rising call in the brass, then the full chord, drums underneath
      [[62, 0], [62, 0.16], [69, 0.32], [74, 0.48]].forEach(([m, dt]) => brass(ac, out, [m - 12, m], t + dt, 0.14, 0.05, { swell: 0.02 }));
      brass(ac, out, D, t + 0.66, 1.6, 0.07, { swell: 0.3 });
      boom(ac, out, t + 0.66, 0.4);
      shimmer(ac, out, t + 0.66, 0.05, 2.4);
      for (let i = 0; i < 6; i++) drum(ac, out, t + i * 0.08, 0.15 + i * 0.03, i < 5);
    } else if (name === 'card') {
      pad(ac, out, [50, 57, 64, 66], t, 2.6, 0.03, 0.4);
      [62, 66, 69, 74].forEach((m, i) => pluck(ac, out, m + 12, t + 0.2 + i * 0.08, 0.1));
    } else if (name === 'sneeze') {
      sneeze(ac, out, t, 0.08);
    } else if (name === 'power') {
      // grabbed a power-up: a sparkly run of bells
      [74, 78, 81, 86].forEach((m, i) => bell(ac, out, m + 12, t + i * 0.05, 0.06));
    } else if (name === 'fire') {
      // a little whoosh
      chirp(ac, out, 62, t, 0.04);
    } else if (name === 'pop') {
      pluck(ac, out, 86, t, 0.14);
      bell(ac, out, 93, t + 0.03, 0.05);
    } else if (name === 'bump') {
      // a soft boing, nothing that sounds like pain
      drum(ac, out, t, 0.2);
      whistle(ac, out, 79, t, 0.12, 0.05);
      whistle(ac, out, 74, t + 0.1, 0.18, 0.05);
    } else if (name === 'shield') {
      bell(ac, out, 81, t, 0.08);
      bell(ac, out, 88, t + 0.05, 0.06);
    } else if (name === 'zap') {
      for (let i = 0; i < 3; i++) bell(ac, out, 95 - i * 5, t + i * 0.04, 0.04);
    } else if (name === 'gust') {
      shimmer(ac, out, t, 0.04, 0.7);
    } else if (name === 'pick') {
      // a quick harp roll up when you pick a dragon
      [57, 62, 66, 69, 74, 78].forEach((m, i) => pluck(ac, out, m, t + i * 0.04, 0.12));
    } else if (name === 'tick') {
      whistle(ac, out, 86, t, 0.12, 0.04);
    }
  }
}

