import { VIEW, DUR, INPUT, PAL } from '../config.js';
import { clamp, dist, lerp, approach, glow, ease, mulberry32 } from '../core/util.js';
import { drawText, drawTextPop } from '../art/font.js';
import { drawKnotRing } from '../art/knotwork.js';
import { drawEmber, eyeOffset, flapPose } from '../art/ember.js';
import { drawSky, SKY, drawSea, makeCliff, drawCliff, drawLighthouse, drawStone, drawCloud, drawFog, drawFlyingGull } from '../art/world.js';
import { drawSparkle } from '../art/icons.js';
import { drawGull, drawTree } from '../art/sprites.js';

const { W, H } = VIEW;

// Scene 1: FIND EMBER. One visual idea: your light cuts through the fog.
// Sweep the beam, find the two blinking eyes, hold the light steady on them.
// The knotwork ring fills and Ember's wing-glow bursts back to life.
export class FindEmber {
  interactive = true;

  enter(g) {
    const r = g.rng;
    this.lighthouseCliff = makeCliff({ seed: 5, x0: 0, x1: 126, top: 128, rough: 4, taperR: 30 });
    this.cliff = makeCliff({ seed: 11 + Math.floor(r() * 50), x0: 84, x1: W, top: 196, rough: 12 });
    // Ember hides in a different place each run (never right under the start point)
    const spots = [196, 262, 332, 410];
    this.homeX = spots[Math.floor(r() * spots.length)];
    this.ex = this.homeX;
    this.ey = this.restY(this.ex);
    this.hold = 0; // 0..1 knotwork fill
    this.found = false;
    this.burstT = -1;
    this.seenNear = false;
    this.flinch = 0;
    this.fogA = 1;
    this.hopT = 0;
    this.gull = { x: this.homeX > 300 ? 170 : 380, perched: true, fx: 0, fy: 0, t: 0 };
    this.gull.y = this.cliff.top(this.gull.x) - 2;
    this.stones = [
      { x: 130, h: 34, w: 12, rune: 1 },
      { x: 300, h: 26, w: 10, rune: 3 },
      { x: 455, h: 38, w: 13, rune: 5 },
    ].map((s) => ({ ...s, y: this.cliff.top(s.x) + 3 }));
    this.drops = Array.from({ length: 150 }, (_, i) => ({ x: r() * W, y: r() * H, s: 0.8 + r() * 0.6 }));
    this.sparkT = 0;
    this.activeT = 0; // assist clock: only runs while someone is pointing
  }

  restY(x) {
    return this.cliff.top(x) - 11;
  }

  eyes() {
    const o = eyeOffset(1);
    return { x: this.ex + o.x, y: this.ey + o.y };
  }

  target() {
    return this.eyes();
  }

  skip(g) {
    if (!this.found) this.burst(g);
    else g.scenes.go('flight', {}, { fade: 0.3, color: '#e8fff8' });
  }

  burst(g) {
    this.found = true;
    this.hold = 1;
    this.burstT = 0;
    const e = this.eyes();
    g.cam.shake(3);
    g.audio.cue('burst');
    g.particles.burst(this.ex, this.ey - 4, 70, { speed: 150, colors: [PAL.teal, PAL.gold, PAL.gold2, '#ffffff', PAL.ember3], kind: 'spark', size: 2, drag: 2.2, life: 1.3 }, g.rng);
    g.particles.burst(this.ex, this.ey - 4, 8, { speed: 50, colors: [PAL.teal], kind: 'glow', size: 8, drag: 1, life: 1 }, g.rng);
    g.particles.burst(e.x, e.y, 20, { speed: 60, colors: [PAL.gold2], kind: 'px', size: 1, grav: 40, drag: 1, life: 1.5 }, g.rng);
  }

  update(g, dt) {
    const inp = g.input;
    const t = this.t;
    if (this.found) {
      this.burstT += dt;
      this.fogA = approach(this.fogA, 0, 3.5, dt);
      // Ember hops up, flaps, and rises, ready for flight
      if (this.burstT > 0.8) this.ey -= dt * 40 * ease.inCubic(clamp((this.burstT - 0.8) / 1));
      if (this.burstT > DUR.FIND_BURST) g.scenes.go('flight', { fromY: this.ey }, { fade: 0.35, color: '#e8fff8' });
      return;
    }

    if (inp.idle < 2) this.activeT += dt;
    const e = this.eyes();
    const d = dist(inp.x, inp.y, e.x, e.y);
    const near = d < INPUT.LOCK_RADIUS;
    if (d < INPUT.LOCK_RADIUS * 2) this.seenNear = true;
    const steady = inp.speed < INPUT.STEADY_SPEED;
    const hopping = this.activeT > DUR.FIND_ASSIST_HOP;

    if (near) {
      // Steady light earns trust quickly. Jerky light still helps, just slowly,
      // and makes Ember flinch; nothing is ever lost.
      const rate = steady || hopping ? 1 : 0.25;
      this.hold += (dt / DUR.FIND_HOLD) * rate;
      if (!steady && !hopping) this.flinch = Math.min(1, this.flinch + dt * 4);
    } else {
      this.hold = Math.max(0, this.hold - dt * 0.3);
    }
    this.flinch = approach(this.flinch, 0, 3, dt);
    if (this.activeT > DUR.FIND_AUTO_COMPLETE) this.hold += dt / 0.6; // hard cap: never stuck
    if (this.hold >= 1) return this.burst(g);

    // Assist 2: Ember comes to the light by itself (hops along the cliff,
    // then flutters up toward the beam if it's in the sky)
    if (hopping && !near) {
      this.hopT += dt;
      const tx = clamp(inp.x, 100, W - 20);
      this.ex = approach(this.ex, tx, 1.3, dt);
      const ground = this.restY(this.ex);
      const ty = Math.min(ground, Math.max(70, inp.y + 10));
      const hop = Math.abs(Math.sin(this.hopT * 5)) * 8;
      this.ey = approach(this.ey, ty, 1.5, dt) - (this.ey >= ground - 1 ? hop * dt * 8 : 0);
      this.ey = Math.min(this.ey, ground);
    }

    // Assist 1: sparkles drift from the beam toward the eyes
    if (this.activeT > DUR.FIND_ASSIST_GLOW && !near) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.12;
        const k = g.rng();
        const px = lerp(inp.x, e.x, k * 0.3);
        const py = lerp(inp.y, e.y, k * 0.3);
        const a = Math.atan2(e.y - py, e.x - px);
        g.particles.add({ x: px, y: py, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: Math.min(1.4, d / 90), color: PAL.gold2, kind: 'spark', size: 1 });
      }
    }

    // Gull takes off when the light finds it
    const gl = this.gull;
    if (gl.perched && dist(inp.x, inp.y, gl.x, gl.y - 8) < 30) {
      gl.perched = false;
      gl.fx = gl.x;
      gl.fy = gl.y - 8;
    }
    if (!gl.perched) {
      gl.t += dt;
      gl.fx -= dt * 50;
      gl.fy -= dt * 35;
    }
  }

  // ------------------------------------------------------------------ drawing
  draw(g, ctx) {
    const t = this.t;
    const inp = g.input;
    const e = this.eyes();
    const clear = 1 - this.fogA; // 0 storm .. 1 after the burst

    drawSky(ctx, SKY.storm, 0, 190);
    if (clear > 0.01) {
      ctx.globalAlpha = clear * 0.7;
      drawSky(ctx, SKY.dusk, 0, 190);
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 5; i++) drawCloud(ctx, ((t * (8 + i * 3) + i * 120) % 620) - 70, 40 + (i % 3) * 22, 110 + (i % 2) * 40, i % 2 ? '#1c2a40' : '#24344c', 21 + i, 0.95);
    drawSea(ctx, 176, t, { c1: '#0f1f2c', c2: '#1b3242', foam: '#9fc0cc' });

    drawCliff(ctx, this.lighthouseCliff);
    const lamp = drawLighthouse(ctx, 46, Math.round(this.lighthouseCliff.top(46)) + 2, t, 1);
    drawTree(ctx, 'pine', 88, this.lighthouseCliff.top(88) + 1, '#0e1824');
    drawCliff(ctx, this.cliff);
    drawTree(ctx, 'bare', 238, this.cliff.top(238) + 2, '#0f1a28');
    drawTree(ctx, 'oak', 372, this.cliff.top(372) + 2, '#0f1a28');
    for (const s of this.stones) {
      const lit = clamp(1 - dist(inp.x, inp.y, s.x, s.y - s.h / 2) / 50) + clear;
      drawStone(ctx, s.x, s.y, s.h, s.w, s.rune, clamp(lit * (0.5 + 0.5 * g.beat.pulse)));
    }
    const gl = this.gull;
    if (gl.perched) drawGull(ctx, gl.x, gl.y, Math.floor(t * 2.5) % 4 === 3 ? 2 : Math.floor(t * 1.5) % 2, true);

    this.drawEmber(g, ctx, t);

    // ---- warm light where the beam lands (drawn under the fog)
    if (!this.found) {
      glow(ctx, inp.x, inp.y, 50, PAL.gold, 0.45);
      glow(ctx, inp.x, inp.y, 22, '#fff6d8', 0.25);
    }

    // ---- fog, cut by the beam (darker than the world, so light reads as light)
    if (this.fogA > 0.01) {
      const holes = [{ x: inp.x, y: inp.y, r: 50 }, { x: 46, y: 96, r: 46, a: 0.55 }];
      if (this.found) holes.push({ x: this.ex, y: this.ey, r: 60 + this.burstT * 200 });
      drawFog(ctx, W, H, t, holes, { alpha: 0.93 * this.fogA, color: '#141c2a', color2: '#2a3850' });
    }
    if (!gl.perched && gl.fy > -10) drawFlyingGull(ctx, gl.fx, gl.fy, gl.t, '#e8eef4');

    // ---- the keeper's beam: a cone from the lighthouse (nod to the bat-signal proof of concept)
    if (!this.found) this.drawBeam(ctx, lamp.lx, lamp.ly, inp.x, inp.y);

    // ---- rain (eases off after the burst)
    const rainA = 0.55 * this.fogA + 0.05;
    ctx.fillStyle = '#b4d2f0';
    for (const d of this.drops) {
      const y = (d.y + t * 230 * d.s) % (H + 10);
      const x = (d.x + y * 0.28 + t * 20) % W;
      const inBeam = dist(x, y, inp.x, inp.y) < 44;
      ctx.globalAlpha = inBeam ? 0.95 : rainA;
      ctx.fillStyle = inBeam ? '#fff2c8' : '#b4d2f0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 5);
    }
    ctx.globalAlpha = 1;

    // ---- the two eyes glint through the fog, blinking
    if (!this.found) this.drawEyeGlints(g, ctx, e, t);

    // ---- knotwork trust ring
    const d = dist(inp.x, inp.y, e.x, e.y);
    const showRing = this.hold > 0.01 || d < INPUT.LOCK_RADIUS * 1.8;
    if (showRing && !this.found) {
      drawKnotRing(ctx, this.ex, this.ey - 6, 34, this.hold, { lobes: 9, amp: 3, width: 2, on: PAL.gold, off: 'rgba(255,243,214,0.35)' });
    }
    if (this.found && this.burstT < 1.2) {
      const k = this.burstT / 1.2;
      ctx.globalAlpha = 1 - k;
      drawKnotRing(ctx, this.ex, this.ey - 6, 34 + ease.outCubic(k) * 120, 1, { lobes: 12, amp: 4, width: 2, on: PAL.teal });
      ctx.globalAlpha = 1;
    }

    g.particles.draw(ctx);

    // ---- one short prompt at a time
    if (!this.found) {
      let msg = 'FIND THE EYES';
      if (d < INPUT.LOCK_RADIUS * 1.2) msg = this.flinch > 0.4 ? 'GENTLY...' : 'HOLD STEADY';
      else if (this.activeT > DUR.FIND_ASSIST_GLOW) msg = 'FOLLOW THE SPARKS';
      drawText(ctx, msg, W / 2, 12, { scale: 3, align: 'center', color: msg === 'HOLD STEADY' ? PAL.gold2 : PAL.cream });
    } else {
      // single soft flash, then the name
      if (this.burstT < 0.4) {
        ctx.globalAlpha = 0.35 * (1 - this.burstT / 0.4);
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      drawTextPop(ctx, 'EMBER!', W / 2, 44, this.burstT * 1.6, { scale: 5, color: PAL.ember3 });
    }
  }

  drawBeam(ctx, lx, ly, x, y) {
    const a = Math.atan2(y - ly, x - lx);
    const r = 40;
    const d = Math.hypot(x - lx, y - ly);
    const s = Math.asin(Math.min(0.99, r / Math.max(d, r + 1)));
    const pc = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,214,130,0.10)';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(a - s) * d, ly + Math.sin(a - s) * d);
    ctx.lineTo(lx + Math.cos(a + s) * d, ly + Math.sin(a + s) * d);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = pc;
    glow(ctx, lx, ly, 14, '#fff6d8', 0.9);
  }

  drawEyeGlints(g, ctx, e, t) {
    const inp = g.input;
    const d = dist(inp.x, inp.y, e.x, e.y);
    const warm = clamp(1 - d / 160);
    const assist = this.activeT > DUR.FIND_ASSIST_GLOW ? 0.6 + 0.4 * g.beat.pulse : 0;
    const blink = t % 1.7 > 1.55; // brief blink, ~0.6 per second
    if (d < 40) return; // inside the beam you can see the real eyes
    const amt = clamp(0.45 + warm * 0.4 + assist * 0.5);
    glow(ctx, e.x, e.y, 10 + assist * 10 + warm * 6, PAL.gold, amt * 0.8);
    if (!blink) {
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(Math.round(e.x + 1), Math.round(e.y - 1), 3, 3);
      ctx.fillRect(Math.round(e.x - 7), Math.round(e.y - 1), 2, 3);
    } else {
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(Math.round(e.x + 1), Math.round(e.y + 1), 3, 1);
      ctx.fillRect(Math.round(e.x - 7), Math.round(e.y + 1), 2, 1);
    }
    if (assist) drawSparkle(ctx, e.x + 10, e.y - 10, 2 + Math.round(g.beat.pulse * 2), PAL.gold2);
  }

  drawEmber(g, ctx, t) {
    const inp = g.input;
    const look = inp.x < this.ex - 10 ? -1 : inp.x > this.ex + 30 ? 1 : 0;
    if (this.found) {
      const k = this.burstT;
      const pop = k < 0.25 ? 1 + Math.sin((k / 0.25) * Math.PI) * 0.35 : 1;
      drawEmber(ctx, this.ex, this.ey, {
        mood: 'joy', wing: k < 0.7 ? 'burst' : flapPose(k * 3.2), glow: 2,
        sx: 1 / Math.sqrt(pop), sy: pop,
      });
      glow(ctx, this.ex - 10, this.ey - 10, 44, PAL.teal, 0.25 * (1 - clamp(k / 1.8)) + 0.12);
      return;
    }
    const h = this.hold;
    const mood = h < 0.3 ? 'scared' : h < 0.75 ? 'curious' : 'happy';
    const shake = mood === 'scared' ? Math.sin(t * 38) * 0.7 : 0;
    const duck = this.flinch * 0.18; // flinch: squash down
    const perk = h * 0.08;
    const glowLvl = h > 0.6 ? 1 : 0;
    const air = this.ey < this.restY(this.ex) - 3;
    drawEmber(ctx, this.ex + shake, this.ey, {
      mood, wing: air ? flapPose(t * 4) : 'folded', glow: glowLvl, look,
      blink: t % 1.7 > 1.55, sx: 1 + duck * 0.6, sy: 1 - duck + perk,
    });
    if (h > 0.05) glow(ctx, this.ex - 4, this.ey - 6, 20 + h * 20, PAL.teal, h * 0.35);
  }
}
