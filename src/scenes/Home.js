import { VIEW, DUR, PAL } from '../config.js';
import { clamp, lerp, ease, invLerp, glow } from '../core/util.js';
import { drawText, drawTextPop, textWidth } from '../art/font.js';
import { drawEmber, flapPose, FLOCK_COLORS } from '../art/ember.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawStone, makeCliff, drawCliff } from '../art/world.js';
import { drawBaseAurora, drawRibbon, ribbonSkyPoints, RIBBON_COLORS } from '../art/aurora.js';
import { drawSparkle } from '../art/icons.js';

const { W, H } = VIEW;
const ORBIT = { x: 240, y: 118, rx: 118, ry: 24 };

export class Home {
  interactive = false; // people just watch this part, so no idle reset

  enter(g, data = {}) {
    let path = data.path;
    if (!path || path.length < 4) {
      // came in via skip or ?scene=home, fake a wave
      path = Array.from({ length: 40 }, (_, i) => [i / 39, 0.5 + Math.sin(i * 0.4) * 0.2]);
    }
    this.path = path;
    this.hue = g.store.count % RIBBON_COLORS.length;
    // saved on enter, not at the end, so leaving early still counts the dragon
    this.rib = g.store.add(path, this.hue);
    this.color = RIBBON_COLORS[this.hue];
    this.count = g.store.count;
    this.stars = makeStars(21, 110, 170);
    this.hill = makeCliff({ seed: 8, x0: 120, x1: 360, top: 206, bottom: 226, rough: 8, taperR: 60, colors: { rock: '#10182a', rock2: '#18223a', rock3: '#202c48', grass: '#1c3a3a', grass2: '#285048' } });
    this.skyPts = ribbonSkyPoints(this.rib, g.wall.top, g.wall.height);
    this.flightPts = path.map(([x, y]) => [20 + x * (W - 40), clamp(y, 0.12, 0.85) * H]);
    this.ticked = false;
  }

  skip(g) {
    g.scenes.go('end', {}, { fade: 0.3 });
  }

  update(g, dt) {
    if (!this.ticked && this.t > 3.4) {
      this.ticked = true;
      g.audio.cue('home');
      g.cam.shake(1.5);
      g.particles.burst(W / 2, 214, 40, { speed: 110, colors: [PAL.gold, PAL.gold2, this.color, '#ffffff'], kind: 'spark', size: 2, drag: 2.4, life: 1.1 }, g.rng);
    }
    if (this.t >= DUR.HOME) g.scenes.go('end', {}, { fade: 0.5, color: '#070a18' });
  }

  draw(g, ctx) {
    const t = this.t;
    drawSky(ctx, SKY.aurora, 0, H);
    drawStars(ctx, this.stars, t);
    drawBaseAurora(ctx, t, 1, 14);
    const revealed = t > 3.4;
    g.wall.draw(ctx, t, 1, revealed ? 0 : 1);

    // the flight path draws in across the sky, then lifts up and turns into a curtain
    const draw = invLerp(0.6, 1.9, t);
    const lift = ease.inOutSine(invLerp(1.9, 3.4, t));
    if (!revealed) {
      const n = this.flightPts.length;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const a = this.flightPts[i];
        const b = this.skyPts[i] || this.skyPts[this.skyPts.length - 1];
        pts.push([lerp(a[0], b[0], lift), lerp(a[1], b[1], lift)]);
      }
      const shown = Math.max(2, Math.ceil(n * draw));
      const vis = pts.slice(0, shown);
      for (let i = 1; i < vis.length; i++) {
        const [x1, y1] = vis[i - 1];
        const [x2, y2] = vis[i];
        const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
        ctx.fillStyle = lift < 0.5 ? PAL.gold2 : this.color;
        ctx.globalAlpha = 1 - lift * 0.6;
        for (let s = 0; s < steps; s++) {
          const k = s / steps;
          ctx.fillRect(Math.round(lerp(x1, x2, k)), Math.round(lerp(y1, y2, k)), 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      drawRibbon(ctx, vis, this.color, 0.25 + lift * 0.5, t, 8 + Math.round(lift * 30));
      const head = vis[vis.length - 1];
      if (draw < 1) {
        glow(ctx, head[0], head[1], 14, PAL.gold2, 0.9);
        drawSparkle(ctx, head[0], head[1], 3);
      }
    } else {
      const k = clamp(1 - (t - 3.4) / 2.5);
      if (k > 0) drawRibbon(ctx, this.skyPts, this.color, 0.5 * k, t, 34);
    }

    drawSea(ctx, 222, t, { c1: '#0a1426', c2: '#122440', foam: '#5fb8c8', glint: { x: W / 2, color: PAL.teal } });
    drawCliff(ctx, this.hill);
    for (const [x, h, r] of [[196, 22, 0], [222, 28, 2], [258, 28, 4], [284, 22, 1]]) drawStone(ctx, x, this.hill.top(x) + 3, h, 9, r, 0.4 + 0.6 * g.beat.pulse);

    const orbit = (a, s = 1) => ({ x: ORBIT.x + Math.cos(a) * ORBIT.rx * s, y: ORBIT.y + Math.sin(a) * ORBIT.ry * s });
    const drawers = [];
    FLOCK_COLORS.forEach((c, i) => {
      const a = t * 0.9 + (i / 5) * Math.PI * 2;
      const p = orbit(a);
      drawers.push({ z: Math.sin(a), f: () => drawEmber(ctx, p.x, p.y, { mood: 'joy', wing: flapPose(t * 2.4 + i * 0.2), glow: 2, colors: c, ci: i, scale: 0.8, flip: Math.sin(a) > 0 }) });
    });
    const arrive = ease.outCubic(clamp(t / 1.6));
    const ea = t * 0.9 + (4 / 5) * Math.PI * 2;
    const op = orbit(ea);
    const ex = lerp(-30, op.x, arrive);
    const ey = lerp(250, op.y, arrive) - Math.sin(arrive * Math.PI) * 30;
    const bounce = t > 1.6 && t < 2.1 ? Math.sin(((t - 1.6) / 0.5) * Math.PI) * 0.2 : 0;
    drawers.push({ z: Math.sin(ea) + 0.01, f: () => {
      glow(ctx, ex - 4, ey - 6, 30, PAL.teal, 0.35);
      drawEmber(ctx, ex, ey, { mood: t > 1.6 ? 'happy' : 'joy', wing: flapPose(t * 2.4), glow: 2, flip: arrive >= 1 && Math.sin(ea) > 0, sx: 1 + bounce, sy: 1 - bounce * 0.8 });
    } });
    // sort by orbit depth so dragons on the far side go behind
    drawers.sort((a, b) => a.z - b.z).forEach((d) => d.f());

    g.particles.draw(ctx);

    if (t > 0.4 && t < 3.2) drawTextPop(ctx, 'HOME!', W / 2, 38, (t - 0.4) * 1.4, { scale: 5, color: PAL.cream, alpha: clamp((3.2 - t) * 3) });
    const n = this.ticked ? this.count : this.count - 1;
    if (t > 2.6) {
      // on the sea strip, it covered the standing stones when it was higher up
      const a = clamp((t - 2.6) * 3);
      const num = String(n);
      const label = n === 1 ? 'DRAGON HOME TONIGHT' : 'DRAGONS HOME TONIGHT';
      const wNum = textWidth(num, 4);
      const wLab = textWidth(label, 2);
      const x0 = Math.round(W / 2 - (wNum + 10 + wLab) / 2);
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 230, W, 36);
      ctx.globalAlpha = 1;
      const pop = this.ticked ? clamp((t - 3.4) * 1.5) : 1;
      drawTextPop(ctx, num, x0 + wNum / 2, 248, pop, { scale: 4, color: PAL.gold, alpha: a });
      drawText(ctx, label, x0 + wNum + 10, 244, { scale: 2, color: '#bff8ee', alpha: a });
    }
  }
}
