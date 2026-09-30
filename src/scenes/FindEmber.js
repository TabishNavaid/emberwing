import { VIEW, DUR, INPUT, PAL } from '../config.js';
import { clamp, dist, lerp, approach, glow, ease } from '../core/util.js';
import { drawText, drawTextPop } from '../art/font.js';
import { drawKnotRing } from '../art/knotwork.js';
import { drawEmber, eyeOffset, flapPose, blinkAt } from '../art/ember.js';
import { drawSky, SKY, drawSea, makeCliff, drawCliff, drawLighthouse, drawStone, drawCloud, drawFog, drawFlyingGull } from '../art/world.js';
import { drawSparkle } from '../art/icons.js';
import { drawGull, drawTree } from '../art/sprites.js';

const { W, H } = VIEW;

export class FindEmber {
  interactive = true;

  enter(g) {
    const r = g.rng;
    this.lighthouseCliff = makeCliff({ seed: 5, x0: 0, x1: 126, top: 128, rough: 4, taperR: 30 });
    this.cliff = makeCliff({ seed: 11 + Math.floor(r() * 50), x0: 84, x1: W, top: 196, rough: 12 });
    // different hiding spot each run so the line can't just memorize it
    const spots = [196, 262, 332, 410];
    this.ex = spots[Math.floor(r() * spots.length)];
    this.ey = this.restY(this.ex);
    this.hold = 0; // 0..1 knotwork fill
    this.found = false;
    this.burstT = -1;
    this.flinch = 0;
    this.prompt = 'EMBER IS LOST!';
    this.fogA = 1;
    this.hopT = 0;
    this.gull = { x: this.ex > 300 ? 170 : 380, perched: true, fx: 0, fy: 0, t: 0 };
    this.gull.y = this.cliff.top(this.gull.x) - 2;
    this.stones = [
      { x: 130, h: 34, w: 12, rune: 1 },
      { x: 300, h: 26, w: 10, rune: 3 },
      { x: 455, h: 38, w: 13, rune: 5 },
    ].map((s) => ({ ...s, y: this.cliff.top(s.x) + 3 }));
    this.drops = Array.from({ length: 150 }, () => ({ x: r() * W, y: r() * H, s: 0.8 + r() * 0.6 }));
    this.sparkT = 0;
    // assist clock. only ticks while someone is pointing, otherwise an empty station
    // would auto-complete at 9.5s before the 10s idle reset could kick in
    this.activeT = 0;
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
    if (!this.found) this.burst();
    else g.scenes.go('flight', {}, { color: '#e8fff8' });
  }

  burst() {
    this.found = true;
    this.hold = 1;
    this.burstT = 0;
    this.popped = false;
  }

  // fires 0.1s after burst(), once ember comes up out of its crouch
  pop(g) {
    this.popped = true;
    const e = this.eyes();
    g.cam.shake(3);
    g.audio.cue('burst');
    // fewer, faster sparks so they fly clear and you can actually see the wiggle
    g.particles.burst(this.ex, this.ey - 4, 45, { speed: 210, colors: [PAL.teal, PAL.gold, PAL.gold2, '#ffffff', PAL.ember3], kind: 'spark', size: 2, drag: 2.2, life: 1.2 }, g.rng);
    g.particles.burst(this.ex, this.ey - 4, 8, { speed: 50, colors: [PAL.teal], kind: 'glow', size: 8, drag: 1, life: 1 }, g.rng);
    g.particles.burst(e.x, e.y, 20, { speed: 60, colors: [PAL.gold2], kind: 'px', size: 1, grav: 40, drag: 1, life: 1.5 }, g.rng);
  }

  update(g, dt) {
    const inp = g.input;
    if (this.found) {
      this.burstT += dt;
      if (!this.popped && this.burstT >= 0.1) this.pop(g);
      this.fogA = approach(this.fogA, 0, 3.5, dt);
      if (this.burstT > 0.8) this.ey -= dt * 40 * ease.inCubic(clamp((this.burstT - 0.8) / 1));
      if (this.burstT > DUR.FIND_BURST) g.scenes.go('flight', { fromY: this.ey }, { color: '#e8fff8' });
      return;
    }

    if (inp.idle < 2) this.activeT += dt;
    const e = this.eyes();
    const d = dist(inp.x, inp.y, e.x, e.y);
    const near = d < INPUT.LOCK_RADIUS;
    const steady = inp.speed < INPUT.STEADY_SPEED;
    const hopping = this.activeT > DUR.FIND_ASSIST_HOP;

    if (near) {
      // jerky light still counts (just 4x slower) and makes ember flinch. no progress is ever taken away
      // for moving fast, only for leaving
      const rate = steady || hopping ? 1 : 0.25;
      this.hold += (dt / DUR.FIND_HOLD) * rate;
      if (!steady && !hopping) this.flinch = Math.min(1, this.flinch + dt * 4);
    } else {
      this.hold = Math.max(0, this.hold - dt * 0.3);
    }
    this.flinch = approach(this.flinch, 0, 3, dt);

    // one short prompt at a time. starts with the story beat so someone glancing over from
    // the line gets "lost dragon" before the instructions
    if (d < INPUT.LOCK_RADIUS * 1.2) this.prompt = this.flinch > 0.4 ? 'GENTLY...' : 'HOLD STEADY';
    else if (this.t < 1.8) this.prompt = 'EMBER IS LOST!';
    else if (this.activeT > DUR.FIND_ASSIST_GLOW) this.prompt = 'FOLLOW THE SPARKS';
    else this.prompt = 'FIND THE EYES';
    if (this.activeT > DUR.FIND_AUTO_COMPLETE) this.hold += dt / DUR.FIND_AUTO_FILL;
    if (this.hold >= 1) return this.burst();

    // assist: ember hops toward the light, and flutters up if the beam is in the sky
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

    // assist: sparks drift from the beam toward the eyes
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

    // little reward for sweeping around: the gull takes off
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

  draw(g, ctx) {
    const t = this.t;
    const inp = g.input;
    const e = this.eyes();
    const clear = 1 - this.fogA; // 0 storm .. 1 after the burst

    drawSky(ctx, SKY.storm, 0, 190);
    drawSky(ctx, SKY.dusk, 0, 190, clear * 0.7);
    for (let i = 0; i < 5; i++) drawCloud(ctx, ((t * (8 + i * 3) + i * 120) % 620) - 70, 40 + (i % 3) * 22, 110 + (i % 2) * 40, i % 2 ? '#1c2a40' : '#24344c', 21 + i, 0.95);
    drawSea(ctx, 176, t, { c1: '#0f1f2c', c2: '#1b3242', foam: '#9fc0cc' });

    drawCliff(ctx, this.lighthouseCliff);
    const lamp = drawLighthouse(ctx, 46, Math.round(this.lighthouseCliff.top(46)) + 2, t);
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

    if (!this.found) {
      glow(ctx, inp.x, inp.y, 50, PAL.gold, 0.45);
      glow(ctx, inp.x, inp.y, 22, '#fff6d8', 0.25);
    }

    // fog has to be darker than the world under it, when it was lighter the beam looked like a shadow
    if (this.fogA > 0.01) {
      const holes = [{ x: inp.x, y: inp.y, r: 50 }, { x: 46, y: 96, r: 46, a: 0.55 }];
      if (this.popped) holes.push({ x: this.ex, y: this.ey, r: 60 + (this.burstT - 0.1) * 200 });
      drawFog(ctx, W, H, t, holes, { alpha: 0.93 * this.fogA });
    }
    if (!gl.perched && gl.fy > -10) drawFlyingGull(ctx, gl.fx, gl.fy, gl.t, '#e8eef4');

    // beam comes out of the lighthouse, nod to the bat-signal proof of concept
    if (!this.found) this.drawBeam(ctx, lamp.lx, lamp.ly, inp.x, inp.y);

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

    if (!this.found) this.drawEyeGlints(g, ctx, e, t);

    const d = dist(inp.x, inp.y, e.x, e.y);
    const showRing = this.hold > 0.01 || d < INPUT.LOCK_RADIUS * 1.8;
    if (showRing && !this.found) {
      drawKnotRing(ctx, this.ex, this.ey - 6, 34, this.hold, { lobes: 9, amp: 3, width: 2, on: PAL.gold, off: 'rgba(255,243,214,0.5)' });
    }
    if (this.popped && this.burstT < 1.3) {
      const k = (this.burstT - 0.1) / 1.2;
      ctx.globalAlpha = 1 - k;
      drawKnotRing(ctx, this.ex, this.ey - 6, 34 + ease.outCubic(k) * 120, 1, { lobes: 12, amp: 4, width: 2, on: PAL.teal });
      ctx.globalAlpha = 1;
    }

    g.particles.draw(ctx);

    if (!this.found) {
      const msg = this.prompt;
      if (msg === 'EMBER IS LOST!') drawTextPop(ctx, msg, W / 2, 23, this.t * 1.5, { scale: 3, color: PAL.ember3 });
      else drawText(ctx, msg, W / 2, 12, { scale: 3, align: 'center', color: msg === 'HOLD STEADY' ? PAL.gold2 : PAL.cream });
    } else {
      // one soft flash only (photosensitivity), never repeated
      if (this.popped && this.burstT < 0.5) {
        ctx.globalAlpha = 0.35 * (1 - (this.burstT - 0.1) / 0.4);
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (this.popped) drawTextPop(ctx, 'EMBER!', W / 2, 44, (this.burstT - 0.1) * 1.6, { scale: 5, color: PAL.ember3 });
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
    const blink = blinkAt(t);
    if (d < 40) return; // inside the beam you see the real eyes on the sprite
    const amt = clamp(0.45 + warm * 0.4 + assist * 0.5);
    // these two dots are the whole cue in the fog. they were 3px, which was tiny on the projector
    glow(ctx, e.x, e.y, 14 + assist * 10 + warm * 6, PAL.gold, amt * 0.85);
    const ey = Math.round(blink ? e.y + 1 : e.y - 2);
    const h = blink ? 1 : 4;
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(Math.round(e.x + 1), ey, 4, h);
    ctx.fillRect(Math.round(e.x - 8), ey, 3, h);
    if (assist) drawSparkle(ctx, e.x + 10, e.y - 10, 2 + Math.round(g.beat.pulse * 2), PAL.gold2);
  }

  drawEmber(g, ctx, t) {
    const inp = g.input;
    const look = inp.x < this.ex - 10 ? -1 : inp.x > this.ex + 30 ? 1 : 0;
    if (this.found) {
      // crouch (anticipation) -> pop up -> happy wiggle with wings flared -> start flapping
      const k = this.burstT;
      let sx = 1, sy = 1, rot = 0, mood = 'joy', wing = 'burst';
      if (k < 0.1) {
        sy = 0.78;
        sx = 1.18;
        wing = 'folded';
      } else if (k < 0.35) {
        const p = (k - 0.1) / 0.25;
        sy = 1 + Math.sin(p * Math.PI) * 0.35;
        sx = 1 / Math.sqrt(sy);
      } else if (k < 0.95) {
        const p = (k - 0.35) / 0.6;
        rot = Math.sin(p * Math.PI * 5) * 0.2 * (1 - p);
        mood = 'happy';
      } else {
        wing = flapPose(k * 3.2);
      }
      drawEmber(ctx, this.ex, this.ey, { mood, wing, glow: k < 0.1 ? 1 : 2, sx, sy, rot });
      glow(ctx, this.ex - 10, this.ey - 10, 44, PAL.teal, 0.25 * (1 - clamp(k / 1.8)) + 0.12);
      return;
    }
    const h = this.hold;
    const mood = h < 0.3 ? 'scared' : h < 0.75 ? 'curious' : 'happy';
    const shake = mood === 'scared' ? Math.sin(t * 38) * 0.7 : 0;
    const duck = this.flinch * 0.18;
    const perk = h * 0.08;
    const glowLvl = h > 0.6 ? 1 : 0;
    const air = this.ey < this.restY(this.ex) - 3;
    drawEmber(ctx, this.ex + shake, this.ey, {
      mood, wing: air ? flapPose(t * 4) : 'folded', glow: glowLvl, look,
      life: t, sx: 1 + duck * 0.6, sy: 1 - duck + perk,
    });
    if (h > 0.05) glow(ctx, this.ex - 4, this.ey - 6, 20 + h * 20, PAL.teal, h * 0.35);
  }
}
