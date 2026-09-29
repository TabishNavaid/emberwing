import { dist } from '../core/util.js';

// "Hover and hold": the replacement for clicking, because a motion-capture
// prop can't click. Keep the light inside the target until the ring fills.
export class Dwell {
  constructor(x, y, r, duration = 1) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.duration = duration;
    this.progress = 0;
    this.hover = false;
    this.done = false;
  }
  update(input, dt) {
    if (this.done) return false;
    this.hover = input.seen && dist(input.x, input.y, this.x, this.y) < this.r;
    if (this.hover) this.progress += dt / this.duration;
    else this.progress -= (dt / this.duration) * 1.5;
    this.progress = Math.max(0, Math.min(1, this.progress));
    if (this.progress >= 1) {
      this.done = true;
      return true;
    }
    return false;
  }
  reset() {
    this.progress = 0;
    this.done = false;
  }
}
