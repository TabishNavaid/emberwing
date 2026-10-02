import { approach } from './util.js';

// screen shake, applied when the low-res buffer gets blitted so every scene gets it
export class Camera {
  constructor() {
    this.t = 0;
    this.reset();
  }
  reset() {
    this.shakeAmt = 0;
    this.ox = 0;
    this.oy = 0;
  }
  shake(amount) {
    if (this.motion?.reduced) return; // no shake at all in reduced motion
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }
  update(dt) {
    this.t += dt;
    this.shakeAmt = approach(this.shakeAmt, 0, 6, dt);
    const s = this.shakeAmt;
    // layered sines instead of Math.random every frame. random jitter looked buzzy on the
    // projector, this reads as a rumble
    const t = this.t;
    this.ox = s > 0.05 ? s * (Math.sin(t * 37) * 0.7 + Math.sin(t * 61) * 0.3) : 0;
    this.oy = s > 0.05 ? s * (Math.cos(t * 43) * 0.7 + Math.sin(t * 53) * 0.3) : 0;
  }
}
