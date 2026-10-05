import { VIEW, DUR, PAL, FLOCK } from '../config.js';
import { clamp, lerp, ease, invLerp, glow } from '../core/util.js';
import { drawText, drawTextPop, textWidth, fitScale } from '../art/font.js';
import { drawSpeck } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawStone, makeCliff, drawCliff } from '../art/world.js';
import { drawBaseAurora, drawRibbon, ribbonSkyPoints, RIBBON_COLORS } from '../art/aurora.js';
import { drawSparkle, drawActBanner } from '../art/icons.js';

const { W, H } = VIEW;
const ORBIT = { x: 240, y: 118 };
const ARRIVE = 1.6; // the guest's dragon reaches its spot in the circle
const TICK = 3.1; // the ribbon settles into the aurora and the counter lands on the new number
const PARTY = 3.3; // celebration starts here (only every FLOCK.CELEBRATE_EVERY-th dragon)

export class Home {
  interactive = false; // people just watch this part, so no idle reset

  enter(g, data = {}) {
    let path = data.path;
    if (!path || path.length < 4) {
      // came in via skip or ?scene=home, fake a wave
      path = Array.from({ length: 40 }, (_, i) => [i / 39, 0.5 + Math.sin(i * 0.4) * 0.2]);
    }
    this.path = path;
    this.d = g.dragon;
    this.hue = this.d.ribbon % RIBBON_COLORS.length;
    // saved on enter, not at the end, so leaving early still counts the dragon. skipping straight
    // here (S, ?scene=home) means there was no flight to score
    this.run = data.run ?? { level: g.level, score: 0, stars: 1 };
    g.lastRun = this.run;
    this.rib = g.store.add(path, this.hue, this.d, this.run);
    this.d.home = true; // attract picks a new lost dragon after this
    g.audio.section('home');
    this.color = RIBBON_COLORS[this.hue];
    this.count = g.store.count;

    // the circle is exactly the dragons home tonight, the guest's one included (it's the last one,
    // it flies in from below). anyone past FLOCK.CLOSE circles further off as a speck
    const { near, far } = flockOf(g.store);
    this.flock = near.map((d, i) => member(d, i));
    this.mine = this.flock[this.flock.length - 1];
    this.far = far.map((d, i) => ({ d, a: i * 2.39996, r: 0.55 + ((i * 13) % 10) / 22, y: 26 + ((i * 17) % 50) }));
    // land, chirp, and the flock answers one at a time
    chirp(this.mine, ARRIVE);
    this.flock.slice(0, -1).reverse().forEach((m, j) => chirp(m, ARRIVE + 0.25 + j * 0.12));
    this.mine.q.reset();
    // fewer dragons = bigger and closer together, a full dozen gets a wider, smaller circle
    const n = this.flock.length;
    this.rx = lerp(118, 168, clamp((n - 5) / 7));
    this.ry = lerp(24, 32, clamp((n - 5) / 7));
    this.scale = lerp(0.8, 0.6, clamp((n - 5) / 7));

    this.stars = makeStars(21, 110, 170);
    this.hill = makeCliff({ seed: 8, x0: 120, x1: 360, top: 206, bottom: 226, rough: 8, taperR: 60, colors: { rock: '#10182a', rock2: '#18223a', rock3: '#202c48', grass: '#1c3a3a', grass2: '#285048' } });
    this.skyPts = ribbonSkyPoints(this.rib, g.wall.top, g.wall.height);
    this.flightPts = path.map(([x, y]) => [20 + x * (W - 40), clamp(y, 0.12, 0.85) * H]);
    this.ticked = false;
    // every 8th dragon home tonight gets the whole flock out
    this.celebrate = this.count % FLOCK.CELEBRATE_EVERY === 0;
    this.partied = false;
    this.length = DUR.HOME + (this.celebrate ? DUR.CELEBRATE : 0);
    this.actAt = this.celebrate ? PARTY + DUR.CELEBRATE - 0.3 : 3.5;
  }

  skip(g) {
    g.scenes.go('end');
  }

  // point i of the path, somewhere between where it was flown (lift 0) and its spot in the aurora (lift 1)
  pathPoint(i, lift) {
    const a = this.flightPts[i];
    const b = this.skyPts[i] || this.skyPts[this.skyPts.length - 1];
    return [lerp(a[0], b[0], lift), lerp(a[1], b[1], lift)];
  }

  // where member i is on the circle right now. depth z: -1 far side, 1 near side
  slot(i, t) {
    const n = this.flock.length;
    const a = t * 0.9 + (i / n) * Math.PI * 2;
    return { x: ORBIT.x + Math.cos(a) * this.rx, y: ORBIT.y + Math.sin(a) * this.ry, z: Math.sin(a) };
  }

  // the guest's dragon flies up from the bottom left into its slot
  minePos(t) {
    const s = this.slot(this.flock.length - 1, t);
    const k = ease.outCubic(clamp(t / ARRIVE));
    return { x: lerp(-30, s.x, k), y: lerp(250, s.y, k) - Math.sin(k * Math.PI) * 30, z: s.z + 0.01, k };
  }

  // 0..1 how far into the celebration flyover, or -1 when there isn't one
  get partyK() {
    if (!this.celebrate) return -1;
    return clamp((this.t - PARTY) / DUR.CELEBRATE);
  }

  // during the flyover the whole circle breaks up and sweeps across the sky in a wave,
  // then swoops back into the circle
  pos(i, t) {
    const m = this.flock[i];
    const base = m === this.mine ? this.minePos(t) : this.slot(i, t);
    const ct = t - PARTY;
    if (!this.celebrate || ct <= 0 || ct >= DUR.CELEBRATE) return base;
    const u = clamp((ct - 0.2 - i * 0.09) / 2.2);
    const fx = lerp(-50, W + 50, u);
    // a band under the big "8 DRAGONS HOME!" so they don't fly through the words
    const fy = 140 - Math.sin(u * Math.PI) * 44 + (i % 3) * 14 - 14 + Math.sin(ct * 3 + i) * 4;
    const w = ease.inOutSine(clamp(ct / 0.4)) * (1 - ease.inOutSine(clamp((ct - (DUR.CELEBRATE - 0.9)) / 0.9)));
    return { x: lerp(base.x, fx, w), y: lerp(base.y, fy, w), z: lerp(base.z, 1, w), k: 1, fly: w > 0.5 };
  }

  // the tests and the flock-count check read this
  visibleDragons() {
    return { near: this.flock.length, far: this.far.length, names: this.flock.map((m) => m.d.name) };
  }

  update(g, dt) {
    const t = this.t;
    const n = this.flightPts.length;
    const draw = invLerp(0.6, 1.9, t);
    const lift = ease.inOutSine(invLerp(1.9, TICK, t));
    if (draw > 0 && draw < 1 && g.rng() < dt * 50) {
      // comet head sheds sparks while the path draws in
      const [x, y] = this.pathPoint(Math.max(0, Math.ceil(n * draw) - 1), 0);
      g.particles.add({ x, y, vx: (g.rng() - 0.5) * 30, vy: 10 + g.rng() * 20, life: 0.7, color: g.rng() < 0.5 ? PAL.gold2 : this.color, kind: 'spark', size: 1 });
    }
    if (lift > 0 && lift < 1 && g.rng() < dt * 40) {
      // sparkles float up off the path as it rises
      const [x, y] = this.pathPoint(Math.floor(g.rng() * n), lift);
      g.particles.add({ x, y, vx: 0, vy: -30 - g.rng() * 30, life: 0.8, color: this.color, kind: 'spark', size: 1 });
    }
    if (!this.ticked && t > TICK) {
      this.ticked = true;
      g.audio.cue('home');
      g.cam.shake(1.5);
      g.particles.burst(W / 2, 214, 40, { speed: 110, colors: [PAL.gold, PAL.gold2, this.color, '#ffffff'], kind: 'spark', size: 2, drag: 2.4, life: 1.1 }, g.rng);
    }
    if (this.celebrate && !this.partied && t > PARTY) {
      this.partied = true;
      g.audio.cue('celebrate');
      g.cam.shake(2.5);
      this.flock.forEach((m, i) => chirp(m, 0.3 + i * 0.1));
    }
    const pk = this.partyK;
    if (pk > 0.05 && pk < 0.75 && g.rng() < dt * 70) {
      // gold confetti drifting down over the flyover
      g.particles.add({ x: g.rng() * W, y: -6, vx: (g.rng() - 0.5) * 30, vy: 40 + g.rng() * 50, grav: 20, drag: 0.4, life: 2.2, color: [PAL.gold, PAL.gold2, PAL.cream, this.color][Math.floor(g.rng() * 4)], kind: g.rng() < 0.3 ? 'spark' : 'px', size: 2 });
    }
    this.flock.forEach((m, i) => {
      const p = this.pos(i, t);
      updateMember(g, m, dt, p.x, p.y, { scale: this.scale, flip: !p.fly && p.z > 0 });
    });
    this.showingAct = t > this.actAt; // the tests check this
    if (t >= this.length) g.scenes.go('end', {}, { color: '#070a18' });
  }

  draw(g, ctx) {
    const t = this.t;
    drawSky(ctx, SKY.aurora, 0, H);
    drawStars(ctx, this.stars, t);
    // the celebration flares the whole aurora once (soft, never strobing)
    const pk = this.partyK;
    const flare = pk > 0 ? Math.sin(clamp(pk / 0.35) * Math.PI) * g.motion.flash : 0;
    drawBaseAurora(ctx, t, 1 + flare * 1.5, 14);
    const revealed = t > TICK;
    g.wall.draw(ctx, t, 1 + flare, revealed ? 0 : 1);
    if (flare > 0) glow(ctx, W / 2, 60, 220, PAL.teal, 0.35 * flare);
    for (const f of this.far) {
      const a = f.a + t * 0.25;
      // the far ones stream across with the flyover too
      const sweep = pk > 0 && pk < 1 ? Math.sin(pk * Math.PI) * 120 : 0;
      drawSpeck(ctx, ORBIT.x + Math.cos(a) * W * 0.42 * f.r + sweep, f.y + Math.sin(a * 2) * 6, f.d, t + f.a);
    }

    // the flight path draws in across the sky, then lifts up and turns into a curtain
    const draw = invLerp(0.6, 1.9, t);
    const lift = ease.inOutSine(invLerp(1.9, TICK, t));
    if (!revealed) {
      const n = this.flightPts.length;
      const pts = [];
      for (let i = 0; i < n; i++) pts.push(this.pathPoint(i, lift));
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
        glow(ctx, head[0], head[1], 20, PAL.gold2, 1);
        drawSparkle(ctx, head[0], head[1], 4);
      }
    } else {
      const k = clamp(1 - (t - TICK) / 2.5);
      if (k > 0) drawRibbon(ctx, this.skyPts, this.color, 0.5 * k, t, 34);
      this.drawShimmer(g, ctx, (t - TICK) / 1.3);
    }

    drawSea(ctx, 222, t, { c1: '#0a1426', c2: '#122440', foam: '#5fb8c8', glint: { x: W / 2, color: PAL.teal } });
    drawCliff(ctx, this.hill);
    for (const [x, h, r] of [[196, 22, 0], [222, 28, 2], [258, 28, 4], [284, 22, 1]]) drawStone(ctx, x, this.hill.top(x) + 3, h, 9, r, 0.4 + 0.6 * g.beat.pulse);

    // sort by depth so dragons on the far side of the circle go behind
    const drawers = this.flock.map((m, i) => {
      const mine = m === this.mine;
      const p = this.pos(i, t);
      const s = this.scale * (0.88 + 0.12 * (p.z + 1) / 2);
      return { z: p.z, f: () => {
        if (mine) glow(ctx, p.x - 4, p.y - 6, 30, m.d.colors.wingLit, 0.35);
        const bounce = mine && t > ARRIVE && t < ARRIVE + 0.5 ? Math.sin(((t - ARRIVE) / 0.5) * Math.PI) * 0.2 : 0;
        drawMember(ctx, m, p.x, p.y, {
          mood: mine && t > ARRIVE ? 'happy' : 'joy', flap: t * 2.4 + i * 0.2, life: t, glow: 2, scale: s,
          flip: !p.fly && (!mine || p.k >= 1) && p.z > 0, sx: 1 + bounce, sy: 1 - bounce * 0.8,
        });
      } };
    });
    drawers.sort((a, b) => a.z - b.z).forEach((d) => d.f());

    g.particles.draw(ctx);

    if (t > 0.4 && t < 3.2) {
      const msg = `${this.d.name} IS HOME!`;
      drawTextPop(ctx, msg, W / 2, 38, (t - 0.4) * 1.4, { scale: fitScale(msg, W - 16, 5), color: PAL.cream, alpha: clamp((3.2 - t) * 3) });
    }
    // the counter only shows up once it's on the new number. starting on the old one for a
    // moment read like "0 DRAGONS", like you hadn't made it
    if (this.ticked) this.drawCounter(ctx, t - TICK);
    if (pk > 0 && pk < 1) {
      const msg = `${this.count} DRAGONS HOME!`;
      const a = clamp((1 - pk) * DUR.CELEBRATE * 3);
      drawTextPop(ctx, msg, W / 2, 34, (t - PARTY) * 1.4, { scale: fitScale(msg, W - 16, 5), color: PAL.gold2, alpha: a });
    }
    if (t > this.actAt) {
      const k = ease.outCubic(clamp((t - this.actAt) / 0.4));
      drawActBanner(ctx, W / 2, Math.round(-30 + k * 42), t, g.beat.pulse, k);
    }
  }

  drawCounter(ctx, k) {
    const n = this.count;
    const num = String(n);
    const label = n === 1 ? 'DRAGON HOME TONIGHT' : 'DRAGONS HOME TONIGHT';
    const wNum = textWidth(num, 4);
    const wLab = textWidth(label, 2);
    const x0 = Math.round(W / 2 - (wNum + 10 + wLab) / 2);
    const a = clamp(k * 4);
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 230, W, 36);
    ctx.globalAlpha = 1;
    const nx = x0 + wNum / 2;
    if (k < 0.8) glow(ctx, nx, 248, 26, PAL.gold, 0.6 * (1 - k / 0.8));
    drawTextPop(ctx, num, nx, 248, k * 1.6, { scale: 4, color: PAL.gold });
    drawText(ctx, label, x0 + wNum + 10, 244, { scale: 2, color: '#bff8ee', alpha: a });
  }

  // a band of light sweeps across the whole aurora once the new ribbon settles in.
  // "your light joined everyone's"
  drawShimmer(g, ctx, k) {
    if (k <= 0 || k >= 1) return;
    const wx = -40 + k * (W + 80);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let dx = -36; dx <= 36; dx += 4) {
      const x = Math.round(wx + dx);
      if (x < 0 || x > W - 4) continue;
      const a = 1 - Math.abs(dx) / 36;
      ctx.globalAlpha = a;
      ctx.drawImage(g.wall.canvas, x, 0, 4, H, x, 0, 4, H);
      // plus a soft column so it shows even when the wall is nearly empty (first guest)
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = PAL.teal;
      ctx.fillRect(x, 10, 4, 130);
    }
    ctx.restore();
  }
}
