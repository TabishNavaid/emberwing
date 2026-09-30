import { dist, clamp } from '../core/util.js';

// hover-and-hold instead of clicking, since a mocap prop can't click
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
    // drains a bit faster than it fills so brushing past doesn't start anything
    this.progress = clamp(this.progress + (this.hover ? 1 : -1.5) * (dt / this.duration));
    if (this.progress >= 1) this.done = true;
    return this.done;
  }
}
