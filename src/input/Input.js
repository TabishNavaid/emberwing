import { VIEW, INPUT } from '../config.js';

// one-euro filter (casiez et al. 2012). smooths a lot when the pointer is slow
// (kills mocap jitter) and barely at all when it's fast (so it doesn't feel laggy)
const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);

class OneEuroFilter {
  constructor(opts) {
    this.set(opts);
    this.x = null;
    this.dx = 0;
  }
  set({ minCutoff, beta, dCutoff = 1.0 }) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }
  filter(v, dt) {
    if (this.x === null || dt <= 0) {
      this.x = v;
      return v;
    }
    const d = (v - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}

// the one pointer the whole game reads. every adapter (mouse, touch, mocap, keys)
// just calls feed(). x/y are internal pixels (0..480, 0..270)
export class Input {
  constructor() {
    this.x = VIEW.W * 0.5;
    this.y = VIEW.H * 0.62;
    this.rawX = this.x;
    this.rawY = this.y;
    this.srcX = this.x;
    this.srcY = this.y;
    this.cal = null; // Calibration, set in main
    // screen-widths/sec so "steady" means the same thing on a phone and on the 10ft screen
    this.speed = 0;
    this.holding = false;
    this.source = 'none';
    this.idle = 999;
    this.seen = false;
    this.fx = new OneEuroFilter(INPUT.FILTER.mouse);
    this.fy = new OneEuroFilter(INPUT.FILTER.mouse);
    this.anchorX = this.x;
    this.anchorY = this.y;
    this.status = ''; // mocap connection line for the debug overlay
  }

  feed(x, y, source = 'mouse') {
    if (source !== this.source) {
      const f = INPUT.FILTER[source] || INPUT.FILTER.mouse;
      this.fx.set(f);
      this.fy.set(f);
      this.source = source;
    }
    // src = what the device reported, before calibration. the K screen needs that
    this.srcX = x;
    this.srcY = y;
    if (this.cal) [x, y] = this.cal.map(x, y, source);
    this.rawX = Math.max(0, Math.min(VIEW.W, x));
    this.rawY = Math.max(0, Math.min(VIEW.H, y));
    this.seen = true;
  }

  setHolding(v) {
    this.holding = !!v;
    if (v) this.idle = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    const px = this.x;
    const py = this.y;
    this.x = this.fx.filter(this.rawX, dt);
    this.y = this.fy.filter(this.rawY, dt);

    const v = Math.hypot(this.x - px, this.y - py) / dt / VIEW.W;
    this.speed += (v - this.speed) * (1 - Math.exp(-dt / 0.12));

    // idle only resets when the pointer really moves, a trembling hand or noisy rig doesn't count
    const moved = Math.hypot(this.rawX - this.anchorX, this.rawY - this.anchorY);
    if (moved > INPUT.IDLE_MOVE_EPS) {
      this.idle = 0;
      this.anchorX = this.rawX;
      this.anchorY = this.rawY;
    } else {
      this.idle += dt;
    }
  }

  // every scene starts with a fresh idle clock
  resetIdle() {
    this.idle = 0;
    this.anchorX = this.rawX;
    this.anchorY = this.rawY;
  }
}
