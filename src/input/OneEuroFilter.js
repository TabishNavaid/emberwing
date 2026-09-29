// One-Euro filter (Casiez et al. 2012): smooths jitter when the pointer is
// slow, stays responsive when it's fast. Ideal for motion-capture cursors.
function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.set({ minCutoff, beta, dCutoff });
    this.reset();
  }
  set({ minCutoff, beta, dCutoff = 1.0 }) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }
  reset(v = null) {
    this.x = v;
    this.dx = 0;
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
