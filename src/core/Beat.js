import { MUSIC } from '../config.js';

// 120 bpm clock. nothing plays audio by default, so the beat is what makes
// wind, rings and stones pulse together
export class Beat {
  constructor(bpm = MUSIC.BPM) {
    this.bpm = bpm;
    this.t = 0;
    this.hit = false; // true only on the frame a beat lands
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
  // soft decay after each beat. 2 pulses/sec keeps us under the 3 flashes/sec limit
  get pulse() {
    return Math.exp(-this.phase * 3.5);
  }
  update(dt) {
    const before = this.count;
    this.t += dt;
    this.hit = this.count !== before;
  }
}
