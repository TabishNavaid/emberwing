import { approach } from './util.js';

// Screen-space juice: shake, zoom and a gentle drift. Applied when the
// low-res buffer is drawn, so every scene gets it for free.
export class Camera {
  constructor() {
    this.reset();
  }
  reset() {
    this.shakeAmt = 0;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.ox = 0;
    this.oy = 0;
  }
  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }
  update(dt) {
    this.shakeAmt = approach(this.shakeAmt, 0, 6, dt);
    this.zoom = approach(this.zoom, this.zoomTarget, 2.2, dt);
    const s = this.shakeAmt;
    this.ox = s > 0.05 ? (Math.random() - 0.5) * s * 2 : 0;
    this.oy = s > 0.05 ? (Math.random() - 0.5) * s * 2 : 0;
  }
}
