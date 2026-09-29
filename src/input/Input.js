import { VIEW, INPUT } from '../config.js';
import { OneEuroFilter } from './OneEuroFilter.js';

// The one pointer the whole game listens to. Any adapter (mouse, touch,
// motion-capture, test keys) calls feed(); scenes only ever read
//   { x, y, speed, holding, present, idle, source }
// x/y are in internal view pixels (0..480, 0..270).
// speed is in screen-widths per second, so it means the same on a phone
// and on a 10-foot projection.
export class Input {
  constructor() {
    this.x = VIEW.W * 0.5;
    this.y = VIEW.H * 0.62;
    this.rawX = this.x;
    this.rawY = this.y;
    this.speed = 0;
    this.holding = false;
    this.source = 'none';
    this.idle = 999; // seconds since meaningful movement
    this.seen = false;
    this.fx = new OneEuroFilter(INPUT.FILTER.mouse);
    this.fy = new OneEuroFilter(INPUT.FILTER.mouse);
    this.anchorX = this.x;
    this.anchorY = this.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.status = ''; // adapter status line for the debug overlay
  }

  // x, y in view pixels
  feed(x, y, source = 'mouse') {
    if (source !== this.source) {
      const f = INPUT.FILTER[source] || INPUT.FILTER.mouse;
      this.fx.set(f);
      this.fy.set(f);
      this.source = source;
    }
    this.rawX = Math.max(0, Math.min(VIEW.W, x));
    this.rawY = Math.max(0, Math.min(VIEW.H, y));
    this.seen = true;
  }

  setHolding(v) {
    this.holding = !!v;
    if (v) this.idle = 0;
  }

  // Someone is actively pointing right now.
  get present() {
    return this.seen && this.idle < 1.5;
  }

  update(dt) {
    if (dt <= 0) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = this.fx.filter(this.rawX, dt);
    this.y = this.fy.filter(this.rawY, dt);

    const v = Math.hypot(this.x - this.prevX, this.y - this.prevY) / dt / VIEW.W;
    const k = 1 - Math.exp(-dt / 0.12);
    this.speed += (v - this.speed) * k;

    const moved = Math.hypot(this.rawX - this.anchorX, this.rawY - this.anchorY);
    if (moved > INPUT.IDLE_MOVE_EPS) {
      this.idle = 0;
      this.anchorX = this.rawX;
      this.anchorY = this.rawY;
    } else {
      this.idle += dt;
    }
  }

  // Used on scene reset so an old pointer position doesn't count as input.
  resetIdle(value = 0) {
    this.idle = value;
    this.anchorX = this.rawX;
    this.anchorY = this.rawY;
  }
}
