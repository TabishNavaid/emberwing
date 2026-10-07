// sparks, glows and confetti. kinds: 'px' plain square, 'spark' square + glow, 'glow' soft blob
import { glow, detail } from './util.js';

// layer lets flight draw some particles inside the zoomed camera and some outside
export class Particles {
  constructor() {
    this.list = [];
    this.pool = []; // dead particles get reused instead of making new ones (less garbage)
  }
  clear() {
    for (const p of this.list) this.pool.push(p);
    this.list.length = 0;
  }
  add(p) {
    const q = this.pool.pop() ?? {};
    q.x = 0; q.y = 0; q.vx = 0; q.vy = 0; q.life = 1; q.size = 1; q.color = '#fff';
    q.drag = 0; q.grav = 0; q.kind = 'px'; q.layer = 0;
    for (const k in p) q[k] = p[k];
    q.max = p.life ?? 1;
    this.list.push(q);
  }
  burst(x, y, n, opts, rng) {
    const { speed = 60, spread = Math.PI * 2, angle = 0, colors = ['#fff'], life = 0.9, size = 1, ...rest } = opts;
    for (let i = 0; i < n; i++) {
      const a = angle + (rng() - 0.5) * spread;
      const s = speed * (0.35 + rng() * 0.65);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.6 + rng() * 0.6), size, color: colors[Math.floor(rng() * colors.length)],
        ...rest,
      });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap-remove, order doesn't matter
        L[i] = L[L.length - 1];
        L.pop();
        this.pool.push(p);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  draw(ctx, layer = 0) {
    const low = detail.low;
    for (let i = 0; i < this.list.length; i++) {
      // low detail draws every other particle and no glow halos, the game still moves them all
      if (low && i % 2) continue;
      const p = this.list[i];
      if (p.layer !== layer) continue;
      const t = p.life / p.max;
      const { x, y } = p;
      if (p.kind === 'glow') {
        glow(ctx, x, y, p.size * (0.5 + t * 0.5), p.color, t);
      } else {
        const s = Math.max(1, Math.round(p.size * (p.kind === 'spark' ? 0.5 + t * 0.5 : 1)));
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, t * 2.5);
        ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        ctx.globalAlpha = 1;
        if (p.kind === 'spark' && !low) glow(ctx, x, y, 4 + s * 2, p.color, t * 0.5);
      }
    }
  }
}
