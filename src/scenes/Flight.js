import { VIEW, DUR, FLIGHT, PAL, MUSIC } from '../config.js';
import { clamp, lerp, approach, glow, ease, mix, invLerp, mulberry32 } from '../core/util.js';
import { drawText, drawTextPop } from '../art/font.js';
import { drawKnotRing } from '../art/knotwork.js';
import { drawEmber, flapPose, FLOCK_COLORS } from '../art/ember.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawStone, drawStack, drawCloud, drawWind, drawRays, drawRune, drawFlyingGull, makeCliff, drawCliff } from '../art/world.js';
import { drawHorn, drawSoundLines, drawCursorLight, drawSparkle } from '../art/icons.js';
import { drawBaseAurora } from '../art/aurora.js';

const { W, H } = VIEW;
const REF_X = 150; // rings reach this x exactly on the beat
const SEA_Y = 222;

// Scene 2: FIRST FLIGHT. One visual idea: wobbly, then soaring.
// Ember follows the guest's light. Rune rings arrive on the beat; they grow
// bigger and more golden as Ember gains confidence, the camera pulls back,
// and at the brass swell golden rays fan out and the flock joins in.
// Missing a ring is never a failure: Ember loops playfully and the ring's
// sparkles find it anyway.
export class Flight {
  interactive = true;

  enter(g, data = {}) {
    const r = mulberry32(g.rng.int(1, 1e6));
    this.ex = 110;
    this.ey = data.fromY ? clamp(data.fromY, 80, 200) : 150;
    this.vy = 0;
    this.px = this.ex;
    this.py = this.ey;
    this.camX = 0;
    this.loopT = 0;
    this.squash = 0;
    this.hits = 0;
    this.path = [];
    this.pathT = 0;
    this.trail = [];
    this.swellFired = false;
    this.riseY = 0;
    this.stars = makeStars(13, 80, 160);
    this.flock = FLOCK_COLORS.map((c, i) => ({ c, i, x: -60 - i * 30, y: 60 + i * 40, ox: [-38, -52, -84, -98][i], oy: [-34, 30, -8, 42][i] }));

    // --- rings on the beat
    const beat = 60 / MUSIC.BPM;
    const end = DUR.FLIGHT * FLIGHT.RISE_AT - 0.6;
    this.rings = [];
    let tt = FLIGHT.FIRST_RING_AT;
    let i = 0;
    let y = this.ey;
    while (tt < end) {
      const p = tt / DUR.FLIGHT;
      const amp = lerp(40, 70, clamp(p / FLIGHT.SWELL_AT));
      const ny = 140 + Math.sin(i * 1.15 + r() * 0.6) * amp + Math.sin(i * 0.43) * 18;
      y = clamp(lerp(y, ny, 0.8), 55, 200);
      this.rings.push({ at: tt, y, p, rune: i, state: 'coming', fx: 0 });
      tt += beat * (p < FLIGHT.WOBBLY_UNTIL ? FLIGHT.RING_BEATS_EARLY : FLIGHT.RING_BEATS_LATE);
      i++;
    }

    // --- scenery in world space
    this.far = makeCliff({ seed: 31, x0: 0, x1: W, top: 196, bottom: SEA_Y + 2, rough: 14, periodic: true, colors: { rock: '#1b2638', rock2: '#223048', rock3: '#2a3a55', grass: '#24403c', grass2: '#2c4c46' } });
    this.stacks = [];
    for (let x = 200; x < 3200; x += 150 + r() * 160) this.stacks.push({ x, w: 16 + Math.floor(r() * 12), h: 60 + Math.floor(r() * 70), seed: Math.floor(r() * 99) });
    this.stones = [];
    for (let x = 380; x < 3200; x += 260 + r() * 220) this.stones.push({ x, h: 26 + Math.floor(r() * 16), w: 11 + Math.floor(r() * 4), rune: Math.floor(r() * 6) });
    this.clouds = Array.from({ length: 7 }, (_, k) => ({ x: k * 110 + r() * 60, y: 40 + r() * 70, w: 70 + r() * 70, seed: k + 40 }));
  }

  // progress through the flight 0..1
  get p() {
    return clamp(this.t / DUR.FLIGHT);
  }
  get conf() {
    return ease.inOutSine(clamp(this.p / FLIGHT.SWELL_AT));
  }
  get zoom() {
    return lerp(FLIGHT.ZOOM_START, FLIGHT.ZOOM_END, ease.inOutSine(invLerp(0.05, FLIGHT.SWELL_AT + 0.08, this.p)));
  }
  ringX(ring) {
    return REF_X + (ring.at - this.t) * FLIGHT.SCROLL;
  }
  ringR(ring) {
    return lerp(FLIGHT.RING_R_START, FLIGHT.RING_R_END, ease.inOutSine(clamp(ring.p / FLIGHT.RISE_AT)));
  }
  // screen -> zoomed world coordinates
  toWorld(x, y) {
    const z = this.zoom;
    return { x: (x - W / 2) / z + W / 2, y: (y - H / 2) / z + H / 2 };
  }
  nextRing() {
    return this.rings.find((r) => r.state === 'coming' && this.ringX(r) > this.ex - 4);
  }
  target(g) {
    const r = this.nextRing();
    if (!r) return { x: W * 0.4, y: H * 0.3 };
    // report in screen coordinates (for scripted test players)
    const z = this.zoom;
    const x = (REF_X - W / 2) * z + W / 2;
    return { x, y: (r.y - H / 2) * z + H / 2 };
  }

  skip(g) {
    this.finish(g);
  }
  finish(g) {
    if (this.done) return;
    this.done = true;
    g.scenes.go('home', { path: this.path, hits: this.hits, rings: this.rings.length }, { fade: 0.6, color: '#0a1024' });
  }

  update(g, dt) {
    const inp = g.input;
    const p = this.p;
    const conf = this.conf;
    this.camX += FLIGHT.SCROLL * dt;

    // --- where Ember wants to go: the guest's light (or the next ring if nobody's pointing)
    const w = this.toWorld(inp.x, inp.y);
    let tx = clamp(w.x, 70, 320);
    let ty = clamp(w.y, 34, 212);
    const next = this.nextRing();
    if (next) {
      const dx = this.ringX(next) - this.ex;
      const pull = FLIGHT.MAGNET * clamp(1 - dx / 120) * (inp.present ? 1 : 0);
      ty = lerp(ty, next.y, pull);
      if (!inp.present) {
        tx = lerp(this.ex, REF_X, 0.5);
        ty = next.y;
      }
    }
    if (p > FLIGHT.RISE_AT) {
      // climb toward the aurora
      ty = 20;
      tx = W * 0.45;
      this.riseY += dt * 150 * ease.inCubic(invLerp(FLIGHT.RISE_AT, 1, p) + 0.2);
    }

    const follow = FLIGHT.FOLLOW * lerp(0.55, 1, conf);
    const ny = approach(this.ey, ty, follow, dt);
    this.vy = (ny - this.ey) / dt;
    this.px = this.ex;
    this.py = this.ey;
    this.ex = approach(this.ex, tx, follow * 0.6, dt);
    this.ey = ny;

    // playful loop-the-loop (after a missed ring)
    if (this.loopT > 0) this.loopT = Math.max(0, this.loopT - dt);
    this.squash = approach(this.squash, 0, 6, dt);

    // --- rings
    for (const ring of this.rings) {
      if (ring.state !== 'coming') {
        ring.fx += dt;
        continue;
      }
      const rx = this.ringX(ring);
      if (rx <= this.ex) {
        const r = this.ringR(ring);
        const hit = Math.abs(this.ey - ring.y) < r + 4;
        ring.state = hit ? 'hit' : 'miss';
        ring.hitX = rx;
        ring.hitY = ring.y;
        const gold = ring.p > FLIGHT.WOBBLY_UNTIL;
        if (hit) {
          this.hits++;
          this.squash = 1;
          g.audio.cue('ring');
          g.cam.shake(1 + ring.p * 2);
          g.particles.burst(rx, ring.y, 26 + Math.round(ring.p * 20), { speed: 80 + ring.p * 60, colors: gold ? [PAL.gold, PAL.gold2, '#fff6d8'] : ['#bff8ee', PAL.teal, '#ffffff'], kind: 'spark', size: 2, drag: 2.5, life: 0.8 }, g.rng);
        } else {
          // no penalty: a happy loop, and the ring's light streams into Ember anyway
          this.loopT = 0.75;
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            g.particles.add({ x: rx + Math.cos(a) * r, y: ring.y + Math.sin(a) * r, vx: (this.ex - rx) * 1.6, vy: (this.ey - ring.y) * 1.6, life: 0.6, color: gold ? PAL.gold2 : '#bff8ee', kind: 'spark', size: 1, drag: 0.5 });
          }
        }
      }
    }

    // --- the brass swell
    if (!this.swellFired && p >= FLIGHT.SWELL_AT) {
      this.swellFired = true;
      this.swellT = 0;
      g.cam.shake(3);
      g.audio.cue('burst');
    }
    if (this.swellFired) this.swellT += dt;
    for (const f of this.flock) {
      const on = this.swellFired;
      const tx2 = on ? this.ex + f.ox : -80;
      const ty2 = on ? this.ey + f.oy + Math.sin(this.t * 2 + f.i) * 5 : f.y;
      f.x = approach(f.x, tx2, on ? 2.2 - f.i * 0.25 : 1, dt);
      f.y = approach(f.y, ty2, 2.4 - f.i * 0.3, dt);
    }

    // --- trail (becomes the aurora ribbon)
    this.trail.push({ x: this.camX + this.ex, y: this.ey });
    if (this.trail.length > 90) this.trail.shift();
    this.pathT -= dt;
    if (this.pathT <= 0) {
      this.pathT = DUR.FLIGHT / 48;
      this.path.push([p, clamp(this.ey / H)]);
    }

    // ambient sparkle dust on the wind
    if (g.rng() < dt * (4 + conf * 10)) {
      g.particles.add({ x: W / 2 + (g.rng() - 0.5) * W * 1.2, y: g.rng() * H * 0.8, vx: -FLIGHT.SCROLL * 0.6, vy: 0, life: 1.4, color: conf > 0.5 ? PAL.gold2 : '#bfe8ff', kind: 'px', size: 1, layer: 1 });
    }

    if (this.t >= DUR.FLIGHT) this.finish(g);
  }

  // ------------------------------------------------------------------ drawing
  draw(g, ctx) {
    const t = this.t;
    const p = this.p;
    const conf = this.conf;
    const rise = invLerp(FLIGHT.RISE_AT, 1, p);
    const swell = this.swellFired ? clamp(this.swellT / 1.2) : 0;

    // --- sky: storm -> dusk -> gold -> aurora night (the color arc tells the story)
    drawSky(ctx, SKY.storm, 0, H);
    drawSky(ctx, SKY.dusk, 0, H, invLerp(0, 0.35, p));
    drawSky(ctx, SKY.gold, 0, H, invLerp(0.4, FLIGHT.SWELL_AT + 0.05, p) * (1 - rise));
    drawSky(ctx, SKY.aurora, 0, H, rise);
    drawStars(ctx, this.stars, t, clamp(1 - p * 3) + rise);
    if (rise > 0) drawBaseAurora(ctx, t, rise * 1.2, 10);

    // low sun glow on the horizon + brass-swell rays
    const sunX = W * 0.72;
    const sunY = SEA_Y - 4 + this.riseY;
    glow(ctx, sunX, sunY, 90 + conf * 40, PAL.amber, 0.25 + conf * 0.35 * (1 - rise));
    if (this.swellFired) drawRays(ctx, sunX, sunY, t, PAL.gold2, 0.16 * swell * (1 - rise) * (0.8 + 0.2 * g.beat.pulse), 11, 520);

    // clouds (slow parallax)
    for (const c of this.clouds) {
      const x = ((c.x - this.camX * 0.2) % (W + 200) + W + 200) % (W + 200) - 100;
      drawCloud(ctx, x, c.y + this.riseY * 0.5, c.w, mix(mix('#2a3a52', '#f0a890', conf), '#1a2440', rise), c.seed, 0.45 + conf * 0.2);
    }

    // --- sea + far islands (drop away as Ember climbs)
    ctx.save();
    ctx.translate(0, Math.round(this.riseY));
    const farOff = (this.camX * 0.15) % W;
    ctx.drawImage(this.far.canvas, -Math.round(farOff), 0);
    ctx.drawImage(this.far.canvas, W - Math.round(farOff), 0);
    drawSea(ctx, SEA_Y, t, { c1: mix('#10202e', '#3a3a6a', conf), c2: mix('#1b3242', '#6a5a8a', conf), foam: mix('#9fc0cc', '#ffd8a0', conf), scroll: this.camX, glint: conf > 0.2 ? { x: sunX, color: PAL.gold2 } : null });
    ctx.restore();

    drawWind(ctx, t, g.beat, { lanes: [0.2, 0.46, 0.7], alpha: 0.25 + conf * 0.2, color: conf > 0.5 ? '#ffe8b0' : '#bfe8ff', speed: 160 });

    // --- zoomed world layer: stacks, stones, rings, dragons
    const z = this.zoom;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2 + this.riseY);

    for (const s of this.stacks) {
      const x = s.x - this.camX * 0.7;
      if (x < -60 || x > W + 60) continue;
      drawStack(ctx, x, SEA_Y + 4, s.w, s.h, s.seed, { c1: mix('#1c2738', '#4a3a5a', conf), c2: mix('#2a3a50', '#8a6a7a', conf) });
    }
    for (const s of this.stones) {
      const x = s.x - this.camX;
      if (x < -60 || x > W + 60) continue;
      // islet
      ctx.fillStyle = mix('#1a2433', '#3a2e48', conf);
      for (let i = -18; i <= 18; i++) ctx.fillRect(Math.round(x + i), SEA_Y + 2 - Math.round(Math.sqrt(324 - i * i) * 0.35), 1, 8);
      drawStone(ctx, x, SEA_Y - 2, s.h, s.w, s.rune, clamp(0.3 + g.beat.pulse * 0.7));
    }
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    this.drawTrail(ctx, conf);
    for (const ring of this.rings) this.drawRing(g, ctx, ring);
    for (const f of this.flock) {
      if (f.x < -50) continue;
      drawEmber(ctx, f.x, f.y, { mood: 'fly', wing: flapPose(t * 2.6 + f.i * 0.21), glow: 2, colors: f.c, ci: f.i, scale: 0.78, rot: Math.sin(t * 2 + f.i) * 0.06 });
    }
    this.drawEmberFlying(g, ctx, t, conf);
    g.particles.draw(ctx, 0);
    ctx.restore();
    g.particles.draw(ctx, 1);

    // --- one short message at a time
    if (t < 1.8) drawTextPop(ctx, 'FLY!', W / 2, 40, t * 1.4, { scale: 5, color: PAL.cream });
    if (this.swellFired && this.swellT < 2.2) {
      const a = clamp((2.2 - this.swellT) * 2);
      drawTextPop(ctx, 'SOAR!', W / 2 + 14, 40, this.swellT * 1.4, { scale: 5, color: PAL.gold2, alpha: a });
      ctx.globalAlpha = a;
      drawHorn(ctx, W / 2 - 88, 40, 2);
      drawSoundLines(ctx, W / 2 - 64, 40, 1, t, PAL.gold2);
      ctx.globalAlpha = 1;
    }
    if (rise > 0.1) drawText(ctx, 'HOME IS UP THERE', W / 2, 236, { scale: 2, align: 'center', color: '#bff8ee', alpha: clamp(rise * 3) });

    // the guest's light
    drawCursorLight(ctx, g.input.x, g.input.y, t, 0.8);
  }

  drawRing(g, ctx, ring) {
    const x = this.ringX(ring);
    const r = this.ringR(ring);
    if (x > W / 2 + (W / 2) / this.zoom + r + 10) return;
    const gold = invLerp(FLIGHT.WOBBLY_UNTIL * 0.6, FLIGHT.SWELL_AT, ring.p);
    const color = mix('#bff8ee', PAL.gold, gold);
    if (ring.state === 'coming') {
      const pulse = 1 + g.beat.pulse * 0.06;
      glow(ctx, x, ring.y, r * 1.6, gold > 0.5 ? PAL.gold : PAL.teal, 0.25 + 0.15 * g.beat.pulse);
      drawKnotRing(ctx, x, ring.y, r * pulse, 1, { lobes: 6 + Math.round(gold * 4), amp: 2 + r * 0.08, width: 2, on: color });
      drawRune(ctx, x, ring.y, Math.max(8, r * 0.55), ring.rune, mix('#e8fffb', PAL.gold2, gold), 1);
    } else if (ring.fx < 0.5) {
      // hit: ring expands and fades; miss: shrinks away
      const k = ring.fx / 0.5;
      ctx.globalAlpha = 1 - k;
      const rr = ring.state === 'hit' ? r * (1 + ease.outCubic(k) * 1.2) : r * (1 - k);
      drawKnotRing(ctx, ring.hitX - ring.fx * FLIGHT.SCROLL, ring.hitY, Math.max(2, rr), 1, { lobes: 8, amp: 2, width: 2, on: color });
      ctx.globalAlpha = 1;
    }
  }

  drawTrail(ctx, conf) {
    // A bold ribbon of light behind Ember: this is what joins the aurora.
    const tr = this.trail;
    for (let i = 1; i < tr.length; i++) {
      const k = i / tr.length;
      const x = tr[i].x - this.camX - 12;
      const y = tr[i].y + 3 + Math.sin(i * 0.5 + this.t * 6) * (1 - k) * 2;
      const w = 1 + Math.round(k * 3);
      ctx.globalAlpha = k * (0.45 + conf * 0.45);
      ctx.fillStyle = mix(PAL.teal, PAL.gold2, clamp(k * 0.5 + conf * 0.6));
      ctx.fillRect(Math.round(x), Math.round(y - w / 2), 2, w);
    }
    ctx.globalAlpha = 1;
  }

  drawEmberFlying(g, ctx, t, conf) {
    const wob = FLIGHT.WOBBLE * (1 - conf);
    const wx = Math.sin(t * 9.3) * wob * 0.5;
    const wy = Math.sin(t * 7.1) * wob + Math.sin(t * 13) * wob * 0.3;
    let rot = clamp(this.vy * 0.004, -0.5, 0.5) + Math.sin(t * 6) * 0.15 * (1 - conf);
    let x = this.ex + wx;
    let y = this.ey + wy;
    if (this.loopT > 0) {
      const k = 1 - this.loopT / 0.75;
      rot = -k * Math.PI * 2;
      y -= Math.sin(k * Math.PI) * 18;
      x += Math.sin(k * Math.PI * 2) * 8;
    }
    const climbing = this.vy < -20;
    const flapSpeed = climbing ? 4.5 : lerp(3.6, 2.4, conf);
    const s = this.squash;
    glow(ctx, x - 6, y - 6, 26, PAL.teal, 0.3 + conf * 0.2);
    drawEmber(ctx, x, y, {
      mood: this.loopT > 0 || s > 0.3 ? 'joy' : 'fly',
      wing: this.vy > 60 && conf > 0.4 ? 'mid' : flapPose(t * flapSpeed),
      glow: 2, rot, sx: 1 + s * 0.25, sy: 1 - s * 0.2,
    });
  }
}
