import { VIEW, DUR, INPUT, PAL } from '../config.js';
import { clamp, dist, lerp, approach, glow, ease } from '../core/util.js';
import { drawText, drawTextPop, fitScale } from '../art/font.js';
import { drawKnotRing } from '../art/knotwork.js';
import { drawDragon, drawChirp, eyeOffset, noseOffset, flapPose, blinkAt } from '../art/dragon.js';
import { chirp, member, updateMember, drawMember } from '../art/flock.js';
import { drawSky, SKY, drawSea, makeCliff, drawCliff, drawLighthouse, drawStone, drawCloud, drawFog, drawFlyingGull } from '../art/world.js';
import { drawSparkle, drawLantern } from '../art/icons.js';
import { drawGull, drawTree } from '../art/sprites.js';

const { W, H } = VIEW;

// the three instructions, one at a time, in this order
const MOVE = 'MOVE YOUR LIGHT';
const FIND = 'FIND THE EYES';
const HOLD = 'HOLD STILL';

export class FindDragon {
  interactive = true;

  enter(g) {
    const r = g.rng;
    this.d = g.dragon;
    this.me = member(this.d);
    g.audio.section('find');
    this.lighthouseCliff = makeCliff({ seed: 5, x0: 0, x1: 126, top: 128, rough: 4, taperR: 30 });
    this.cliff = makeCliff({ seed: 11 + Math.floor(r() * 50), x0: 84, x1: W, top: 196, rough: 12 });
    // different hiding spot each run, and never right where the light already is (it starts
    // wherever it was on the attract screen, and the dragon used to be sitting right under it)
    const spots = [196, 262, 332, 410].filter((x) => Math.abs(x - g.input.x) > 110);
    this.ex = spots[Math.floor(r() * spots.length)] ?? 196;
    this.ey = this.restY(this.ex);
    this.hold = 0; // 0..1, fills while the light is on the eyes and never goes back down
    this.found = false;
    this.burstT = -1;
    this.flinch = 0;
    this.prompt = MOVE;
    this.promptT = 0;
    this.moved = 0;
    this.lastX = g.input.x;
    this.lastY = g.input.y;
    this.pull = 0;
    this.bx = g.input.x; // where the beam actually is (pointer, nudged toward the eyes late on)
    this.by = g.input.y;
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
    // hint clock. only ticks while someone is pointing, so an empty station idles out
    this.activeT = 0;
  }

  restY(x) {
    return this.cliff.top(x) - 11 * this.d.size;
  }

  eyes() {
    const o = eyeOffset(this.d);
    return { x: this.ex + o.x, y: this.ey + o.y };
  }

  target() {
    return this.eyes();
  }

  skip(g) {
    if (!this.found) this.burst();
    else g.scenes.go('flight', {}, { title: 'NOW FLY HOME!' });
  }

  burst() {
    this.found = true;
    this.hold = 1;
    this.burstT = 0;
    this.popped = false;
  }

  // fires 0.1s after burst(), once the dragon comes up out of its crouch
  pop(g) {
    this.popped = true;
    const e = this.eyes();
    const lit = this.d.colors.wingLit;
    g.cam.shake(3);
    g.audio.cue('found');
    chirp(this.me, 0.25);
    this.me.q.reset();
    // fewer, faster sparks so they fly clear and you can actually see the wiggle
    g.particles.burst(this.ex, this.ey - 4, 45, { speed: 210, colors: [lit, PAL.gold, PAL.gold2, '#ffffff', this.d.colors.body3], kind: 'spark', size: 2, drag: 2.2, life: 1.2 }, g.rng);
    g.particles.burst(this.ex, this.ey - 4, 8, { speed: 50, colors: [lit], kind: 'glow', size: 8, drag: 1, life: 1 }, g.rng);
    g.particles.burst(e.x, e.y, 20, { speed: 60, colors: [PAL.gold2], kind: 'px', size: 1, grav: 40, drag: 1, life: 1.5 }, g.rng);
  }

  // what the guest should be told right now. only one, and it can't change until the current
  // one has been readable for PROMPT_MIN
  wantPrompt(near) {
    if (this.moved < DUR.FIND_MOVE_TO_LEARN) return MOVE;
    return near ? HOLD : FIND;
  }

  update(g, dt) {
    const inp = g.input;
    if (this.found) {
      // the YOU FOUND PIP! moment: hold still, nothing else happens until it's over
      this.burstT += dt;
      if (!this.popped && this.burstT >= 0.1) this.pop(g);
      if (this.popped) updateMember(g, this.me, dt, this.ex, this.ey, { flying: this.burstT > 0.95 });
      this.fogA = approach(this.fogA, 0, 3.5, dt);
      if (this.burstT > DUR.FIND_BURST) g.scenes.go('flight', { fromY: this.ey }, { title: 'NOW FLY HOME!' });
      return;
    }

    if (inp.idle < 2) this.activeT += dt;
    this.moved += Math.hypot(inp.x - this.lastX, inp.y - this.lastY);
    this.lastX = inp.x;
    this.lastY = inp.y;
    const e = this.eyes();

    // hint: late on, the beam drifts a little toward the eyes. never all the way
    const pullTo = clamp((this.activeT - DUR.FIND_HINT_PULL) / 3) * DUR.FIND_PULL_MAX;
    this.pull = approach(this.pull, pullTo, 2, dt);
    this.bx = lerp(inp.x, e.x, this.pull);
    this.by = lerp(inp.y, e.y, this.pull);

    const d = dist(this.bx, this.by, e.x, e.y);
    const near = d < INPUT.LOCK_RADIUS;
    const steady = inp.speed < INPUT.STEADY_SPEED;
    const lastResort = this.activeT > DUR.FIND_LAST_RESORT;

    if (near) {
      // moving fast still counts, just slower, and the dragon flinches. slipping off only pauses it
      this.hold += (dt / DUR.FIND_HOLD) * (steady || lastResort ? 1 : 0.4);
      if (!steady && !lastResort) this.flinch = Math.min(1, this.flinch + dt * 4);
    }
    this.flinch = approach(this.flinch, 0, 3, dt);
    if (this.activeT > DUR.FIND_HARD_CAP) this.hold += dt / DUR.FIND_HOLD;

    this.promptT += dt;
    const want = this.wantPrompt(near);
    if (want !== this.prompt && this.promptT >= DUR.PROMPT_MIN) {
      this.prompt = want;
      this.promptT = 0;
    }
    if (this.hold >= 1) return this.burst();

    // last resort: the dragon flutters into your beam. you still have to keep it there for the hold
    if (lastResort && !near) {
      this.hopT += dt;
      const tx = clamp(this.bx, 100, W - 20);
      this.ex = approach(this.ex, tx, 2.5, dt); // quick, it took 3s to cross the cliff at 1.3
      const ground = this.restY(this.ex);
      const ty = Math.min(ground, Math.max(70, this.by + 10));
      const hop = Math.abs(Math.sin(this.hopT * 5)) * 8;
      this.ey = approach(this.ey, ty, 2.5, dt) - (this.ey >= ground - 1 ? hop * dt * 8 : 0);
      this.ey = Math.min(this.ey, ground);
    }

    // little reward for sweeping around: the gull takes off
    const gl = this.gull;
    if (gl.perched && dist(this.bx, this.by, gl.x, gl.y - 8) < 30) {
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
    const { bx, by } = this;
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
      const lit = clamp(1 - dist(bx, by, s.x, s.y - s.h / 2) / 50) + clear;
      drawStone(ctx, s.x, s.y, s.h, s.w, s.rune, clamp(lit * (0.5 + 0.5 * g.beat.pulse)));
    }
    const gl = this.gull;
    if (gl.perched) drawGull(ctx, gl.x, gl.y, Math.floor(t * 2.5) % 4 === 3 ? 2 : Math.floor(t * 1.5) % 2);

    this.drawLost(g, ctx, t);

    if (!this.found) {
      glow(ctx, bx, by, 50, PAL.gold, 0.45);
      glow(ctx, bx, by, 22, '#fff6d8', 0.25);
    }

    // fog has to be darker than the world under it, when it was lighter the beam looked like a shadow
    if (this.fogA > 0.01) {
      const holes = [{ x: bx, y: by, r: 50 }, { x: 46, y: 96, r: 46, a: 0.55 }];
      if (this.popped) holes.push({ x: this.ex, y: this.ey, r: 60 + (this.burstT - 0.1) * 200 });
      drawFog(ctx, W, H, t, holes, 0.93 * this.fogA);
    }
    if (!gl.perched && gl.fy > -10) drawFlyingGull(ctx, gl.fx, gl.fy, gl.t);

    // beam comes out of the lighthouse, nod to the bat-signal proof of concept
    if (!this.found) this.drawBeam(ctx, lamp.lx, lamp.ly, bx, by);

    const rainA = 0.55 * this.fogA + 0.05;
    for (const d of this.drops) {
      const y = (d.y + t * 230 * d.s) % (H + 10);
      const x = (d.x + y * 0.28 + t * 20) % W;
      const inBeam = dist(x, y, bx, by) < 44;
      ctx.globalAlpha = inBeam ? 0.95 : rainA;
      ctx.fillStyle = inBeam ? '#fff2c8' : '#b4d2f0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 5);
    }
    ctx.globalAlpha = 1;

    if (!this.found) {
      this.drawTrail(ctx, e, t);
      this.drawEyeGlints(g, ctx, e, t);
      this.drawHoldRing(ctx, e);
    }
    if (this.popped && this.burstT < 1.3) {
      const k = (this.burstT - 0.1) / 1.2;
      ctx.globalAlpha = 1 - k;
      drawKnotRing(ctx, this.ex, this.ey - 6, 34 + ease.outCubic(k) * 120, 1, { lobes: 12, amp: 4, width: 2, on: this.d.colors.wingLit });
      ctx.globalAlpha = 1;
    }

    g.particles.draw(ctx);

    if (!this.found) this.drawPrompt(ctx, t);
    else {
      // one soft flash only (photosensitivity), never repeated
      if (this.popped && this.burstT < 0.5) {
        ctx.globalAlpha = 0.35 * g.motion.flash * (1 - (this.burstT - 0.1) / 0.4);
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (this.popped) {
        const msg = `YOU FOUND ${this.d.name}!`;
        drawTextPop(ctx, msg, W / 2, 40, (this.burstT - 0.1) * 1.6, { scale: fitScale(msg, W - 16, 4), color: PAL.gold2 });
      }
    }
  }

  // the instruction, plus a tiny looping demo of it underneath
  drawPrompt(ctx, t) {
    const msg = this.prompt;
    const a = clamp(this.promptT / 0.25);
    drawText(ctx, msg, W / 2, 10, { scale: 3, align: 'center', color: msg === HOLD ? PAL.gold2 : PAL.cream, alpha: a });
    const cx = W / 2;
    const cy = 52;
    ctx.globalAlpha = a;
    // the demo sits in its own little framed card so it reads as a picture of what to do.
    // loose on the sky, the demo eyes looked exactly like the dragon's real eyes
    ctx.fillStyle = 'rgba(8,10,24,0.85)';
    ctx.fillRect(cx - 50, cy - 13, 100, 26);
    ctx.strokeStyle = 'rgba(255,201,74,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 49.5, cy - 12.5, 99, 25);
    if (msg === MOVE) {
      // lantern sliding side to side
      const x = cx + Math.sin(t * 3) * 26;
      ctx.fillStyle = 'rgba(255,226,138,0.5)';
      for (let i = 1; i < 6; i++) ctx.fillRect(Math.round(x - Math.cos(t * 3) * i * 4), cy, 2, 2);
      drawLantern(ctx, x, cy, 0.8, t);
    } else if (msg === FIND) {
      // a light drifting over to a pair of eyes
      const k = (t % 1.8) / 1.8;
      const x = lerp(cx - 34, cx + 22, ease.inOutSine(clamp(k * 1.4)));
      glow(ctx, cx + 24, cy, 8, PAL.gold, 0.7);
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(cx + 20, cy - 1, 2, 3);
      ctx.fillRect(cx + 26, cy - 1, 2, 3);
      glow(ctx, x, cy, 12, PAL.gold, 0.6);
      ctx.fillRect(Math.round(x) - 1, cy - 1, 3, 3);
    } else {
      // ring filling around a still light
      const k = (t % 2) / 2;
      glow(ctx, cx, cy, 10, PAL.gold, 0.6);
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(cx - 1, cy - 1, 3, 3);
      drawKnotRing(ctx, cx, cy, 10, k, { lobes: 5, amp: 1.5, width: 1, on: PAL.gold, off: 'rgba(255,243,214,0.4)' });
    }
    ctx.globalAlpha = 1;
  }

  // hint: a dotted line of light flowing from your beam to the eyes. drawn fresh every frame so
  // it always points the right way (particles left a short wobbly arc when the light moved)
  drawTrail(ctx, e, t) {
    const k = clamp((this.activeT - DUR.FIND_HINT_TRAIL) / 0.6);
    const d = dist(this.bx, this.by, e.x, e.y);
    if (k <= 0 || d < INPUT.LOCK_RADIUS + 10) return;
    const ux = (e.x - this.bx) / d;
    const uy = (e.y - this.by) / d;
    ctx.fillStyle = PAL.gold2;
    for (let s = 20 + ((t * 50) % 9); s < d - 16; s += 9) {
      ctx.globalAlpha = k * (0.35 + 0.55 * Math.min(1, s / 60));
      ctx.fillRect(Math.round(this.bx + ux * s) - 1, Math.round(this.by + uy * s) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // big ring right on the eyes. fills while the light is on them, stays put when it slips off
  drawHoldRing(ctx, e) {
    const d = dist(this.bx, this.by, e.x, e.y);
    const near = d < INPUT.LOCK_RADIUS;
    if (this.hold <= 0.001 && d > INPUT.LOCK_RADIUS * 1.6) return;
    ctx.globalAlpha = near ? 1 : 0.7;
    drawKnotRing(ctx, e.x - 2, e.y + 1, 20, this.hold, { lobes: 8, amp: 2.5, width: 3, on: PAL.gold, off: 'rgba(255,243,214,0.55)' });
    ctx.globalAlpha = 1;
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
    const d = dist(this.bx, this.by, e.x, e.y);
    if (d < 40) return; // inside the beam you see the real eyes on the sprite
    const warm = clamp(1 - d / 160);
    // hint: after a few seconds the eyes get bigger and brighter, pulsing on the beat
    const big = this.activeT > DUR.FIND_HINT_BIG ? 0.6 + 0.4 * g.beat.pulse : 0;
    const blink = blinkAt(t);
    const amt = clamp(0.45 + warm * 0.4 + big * 0.5);
    glow(ctx, e.x, e.y, 14 + big * 16 + warm * 6, PAL.gold, amt * 0.85);
    const s = big ? 2 : 1;
    const ey = Math.round(blink ? e.y + 1 : e.y - 2 * s);
    const h = blink ? 1 : 4 * s;
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(Math.round(e.x + 1), ey, 4 * s, h);
    ctx.fillRect(Math.round(e.x - 8 * s), ey, 3 * s, h);
    if (big) drawSparkle(ctx, e.x + 12, e.y - 12, 2 + Math.round(g.beat.pulse * 2), PAL.gold2);
  }

  drawLost(g, ctx, t) {
    const d = this.d;
    const look = this.bx < this.ex - 10 ? -1 : this.bx > this.ex + 30 ? 1 : 0;
    if (this.found) {
      // crouch (anticipation) -> pop up -> happy wiggle with wings flared -> flap in place
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
      }
      glow(ctx, this.ex - 10, this.ey - 10, 44, d.colors.wingLit, 0.25 * (1 - clamp(k / 1.8)) + 0.12);
      // its own personality only kicks in once the wiggle is over
      if (k < 0.95) drawDragon(ctx, this.ex, this.ey, d, { mood, wing, glow: k < 0.1 ? 1 : 2, sx, sy, rot });
      else drawMember(ctx, this.me, this.ex, this.ey, { mood, flap: k * 3.2, glow: 2, life: t });
      if (k < 0.95 && this.me.chirpT >= 0) {
        const n = noseOffset(d);
        drawChirp(ctx, this.ex + n.x, this.ey + n.y, this.me.chirpT / 0.5);
      }
      return;
    }
    const h = this.hold;
    const mood = h < 0.3 ? 'scared' : h < 0.75 ? 'curious' : 'happy';
    const shake = mood === 'scared' ? Math.sin(t * 38) * 0.7 : 0;
    const duck = this.flinch * 0.18;
    const perk = h * 0.08;
    const glowLvl = h > 0.6 ? 1 : 0;
    const air = this.ey < this.restY(this.ex) - 3;
    drawDragon(ctx, this.ex + shake, this.ey, d, {
      mood, wing: air ? flapPose(t * 4) : 'folded', glow: glowLvl, look,
      life: t, sx: 1 + duck * 0.6, sy: 1 - duck + perk,
    });
    if (h > 0.05) glow(ctx, this.ex - 4, this.ey - 6, 20 + h * 20, d.colors.wingLit, h * 0.35);
  }
}
