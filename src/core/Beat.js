import { MUSIC } from '../config.js';

// A steady musical clock (default 120 BPM). Wind ribbons, rings, runes and UI
// all pulse on it so the whole world visibly "breathes" in tempo.
export class Beat {
  constructor(bpm = MUSIC.BPM) {
    this.bpm = bpm;
    this.t = 0;
    this.hit = false; // true on the frame a beat lands
  }
  get period() {
    return 60 / this.bpm;
  }
  get beat() {
    return this.t / this.period;
  }
  get count() {
    return Math.floor(this.beat);
  }
  get phase() {
    return this.beat % 1;
  }
  // 1.0 on the beat, decaying smoothly. Soft brightness change, never a strobe.
  get pulse() {
    return Math.exp(-this.phase * 3.5);
  }
  // Smooth sine "breath", one cycle per bar (4 beats)
  get breath() {
    return 0.5 - 0.5 * Math.cos((this.beat / 4) * Math.PI * 2);
  }
  update(dt) {
    const before = this.count;
    this.t += dt;
    this.hit = this.count !== before;
  }
}
