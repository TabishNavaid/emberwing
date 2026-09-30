// one-euro filter (casiez et al. 2012). smooths a lot when the pointer is slow
// (kills mocap jitter) and barely at all when it's fast (so it doesn't feel laggy)
const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);

export class OneEuroFilter {
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
