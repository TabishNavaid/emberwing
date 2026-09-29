// Optional ambience only. OFF by default (the lobby is loud and nothing in
// the game depends on sound). Operator presses M to toggle.
// Everything is generated live: a soft drone on D and A, sea-wind noise, and
// sparse random notes from a D pentatonic scale on the beat. It is not, and
// never tries to be, any melody from the film score.
const PENTA = [0, 2, 4, 7, 9]; // D E F# A B

export class Audio {
  constructor(beat) {
    this.beat = beat;
    this.on = false;
    this.ctx = null;
  }
  toggle() {
    this.on ? this.stop() : this.start();
    return this.on;
  }
  start() {
    try {
      if (!this.ctx) this.build();
      this.ctx.resume();
      this.master.gain.setTargetAtTime(0.22, this.ctx.currentTime, 0.8);
      this.on = true;
    } catch (e) {
      console.warn('[emberwing] audio unavailable', e);
    }
  }
  stop() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.on = false;
  }
  build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    // drone
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(this.master);
    for (const [f, g] of [[73.42, 0.12], [110, 0.08], [146.83, 0.04]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 160;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    // wind
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = buf;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    n.connect(bp).connect(ng).connect(this.master);
    n.start();
  }
  note(semi, when = 0, dur = 1.2, vol = 0.1, type = 'triangle') {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = 293.66 * Math.pow(2, semi / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  // Called every frame; plays a sparse random pentatonic pluck on some beats.
  update() {
    if (!this.on || !this.beat.hit) return;
    if (Math.random() < 0.45) {
      const deg = PENTA[Math.floor(Math.random() * PENTA.length)];
      this.note(deg + 12 * (Math.random() < 0.3 ? 1 : 0), 0, 1.4, 0.06);
    }
  }
  // Little one-shot cues (never required to understand anything)
  cue(name) {
    if (!this.on) return;
    if (name === 'ring') this.note(PENTA[Math.floor(Math.random() * 5)] + 12, 0, 0.6, 0.07, 'sine');
    if (name === 'burst') [0, 4, 7, 12].forEach((s, i) => this.note(s, i * 0.07, 1.6, 0.08));
    if (name === 'home') [0, 7, 12, 16, 19].forEach((s, i) => this.note(s, i * 0.12, 2.2, 0.07));
    if (name === 'start') this.note(7, 0, 0.8, 0.07, 'sine');
  }
}
