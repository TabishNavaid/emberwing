import { approach } from './util.js';

// screen shake, applied when the low-res buffer gets blitted so every scene gets it
export class Camera {
  constructor() {
    this.reset();
  }
  reset() {
    this.shakeAmt = 0;
    this.ox = 0;
    this.oy = 0;
  }
  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }
  update(dt) {
    this.shakeAmt = approach(this.shakeAmt, 0, 6, dt);
    const s = this.shakeAmt;
    this.ox = s > 0.05 ? (Math.random() - 0.5) * s * 2 : 0;
    this.oy = s > 0.05 ? (Math.random() - 0.5) * s * 2 : 0;
  }
}
