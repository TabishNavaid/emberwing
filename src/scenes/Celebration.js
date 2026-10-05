import { VIEW, DUR, PAL, FLOCK } from '../config.js';
import { clamp, lerp, ease, glow } from '../core/util.js';
import { drawText, drawTextPop, textWidth, fitScale } from '../art/font.js';
import { drawDragon } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { drawSky, SKY, makeStars, drawStars } from '../art/world.js';
import { drawBaseAurora, drawFullAurora, drawPartyStar, drawPartyStars, PARTY_STARS } from '../art/aurora.js';

const { W, H } = VIEW;
const C = { x: 240, y: 118 }; // middle of the spiral
const STAR_AT = 5.6; // the new star starts gathering
const STAR_UP = 6.3; // ...and flies up to its spot in the sky

// every 8th dragon home: every dragon saved tonight floods the screen in a spiral, fireworks in
// their colors, the aurora fills the whole sky, a full fanfare, and the names of this round's 8
// roll past. then a new star is born and stays in the sky for the rest of the night.
// nobody does anything here, the whole line just gets to watch (and cheer)
export class Celebration {
  interactive = false;

  enter(g) {
    const count = g.store.count;
    this.count = count;
    this.nth = Math.floor(count / FLOCK.CELEBRATE_EVERY); // this is celebration number nth tonight
    const { near, far } = flockOf(g.store, count);
    const all = [...far, ...near];
    this.dragons = all.map((d, i) => member(d, i));
    // this round's eight, newest last
    this.round = all.slice(-FLOCK.CELEBRATE_EVERY).map((d, i) => ({ d, i }));
    this.scale = lerp(0.62, 0.32, clamp((all.length - 8) / 60));
    this.stars = makeStars(52, 120, 200);
    this.gentle = g.motion.reduced;
    this.boomT = 0;
    this.booms = 0;
    this.born = false;
    this.round.forEach((r, i) => chirp(this.dragons[this.dragons.length - this.round.length + i], 1 + i * 0.25));
    g.audio.section('party');
    g.audio.cue('fanfare');
    g.cam.shake(2.5);
  }

  skip(g) {
    g.scenes.go('end');
  }

  // spiral position of dragon i: they swirl in from off screen, circle, then fly off at the end
  pos(i, t) {
    const n = this.dragons.length;
    const k = Math.sqrt((i + 0.5) / n); // 0 in the middle .. 1 at the edge
    const spin = this.gentle ? 0.35 : 0.7;
    const a = i * 2.39996 + t * spin * (1.4 - k * 0.6);
    const swirlIn = ease.outCubic(clamp(t / 1.6));
    const flyOff = t > 6.6 ? ease.inCubic(clamp((t - 6.6) / 1.0)) : 0;
    const r = (40 + k * 190) * lerp(2.2, 1, swirlIn) * (1 + flyOff * 1.6);
    return { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * 0.5, z: Math.sin(a), flip: Math.cos(a + 0.3) < 0 };
  }

  update(g, dt) {
    const t = this.t;
    this.dragons.forEach((m, i) => {
      const p = this.pos(i, t);
      updateMember(g, m, dt, p.x, p.y, { scale: this.scale, flip: p.flip, quiet: true });
    });
    // fireworks in the dragons' own colors, at most ~2 a second (fewer in reduced motion)
    this.boomT -= dt;
    if (t > 0.5 && t < 6.4 && this.boomT <= 0) {
      this.boomT = this.gentle ? 0.8 : 0.45;
      const d = (this.round[this.booms % this.round.length] ?? this.dragons[0]).d;
      this.booms++;
      const x = 50 + g.rng() * (W - 100);
      const y = 30 + g.rng() * 110;
      const n = this.gentle ? 22 : 44;
      g.particles.burst(x, y, n, { speed: 120, colors: [d.colors.wingLit, d.colors.body3, d.colors.tip, '#ffffff'], kind: 'spark', size: 2, drag: 1.6, grav: 26, life: 1.3 }, g.rng);
      g.particles.burst(x, y, this.gentle ? 0 : 6, { speed: 30, colors: [d.colors.wingLit], kind: 'glow', size: 10, drag: 2, life: 0.6 }, g.rng);
      g.audio.cue('boom');
    }
    if (!this.born && t > STAR_UP + 0.7) {
      this.born = true;
      g.audio.cue('star');
    }
    if (t >= DUR.CELEBRATE) g.scenes.go('end', {}, { color: '#070a18' });
  }

  // where the new star ends up (the same spot attract, home and the card draw it in)
  starSpot() {
    const i = this.nth - 1;
    const [x, y] = PARTY_STARS[i % PARTY_STARS.length];
    return { x: x + Math.floor(i / PARTY_STARS.length) * 7, y: y + Math.floor(i / PARTY_STARS.length) * 5 };
  }

  visibleDragons() {
    return { near: this.dragons.length, far: 0, names: this.round.map((r) => r.d.name) };
  }

  draw(g, ctx) {
    const t = this.t;
    drawSky(ctx, SKY.aurora, 0, H);
    drawStars(ctx, this.stars, t);
    // the aurora spreads until it fills the whole sky, one big soft flare (no strobing)
    const fill = ease.inOutSine(clamp(t / 1.8)) * (1 - clamp((t - 6.8) / 0.8) * 0.5);
    drawBaseAurora(ctx, t, 1 + fill, 14);
    drawFullAurora(ctx, t, fill * (this.gentle ? 0.7 : 1));
    g.wall.draw(ctx, t, 1);
    drawPartyStars(ctx, this.nth - 1, t);

    // everyone tonight, far side of the spiral first
    const drawers = this.dragons.map((m, i) => {
      const p = this.pos(i, t);
      return { z: p.z, f: () => drawMember(ctx, m, p.x, p.y, { mood: 'joy', flap: t * 2.8 + i * 0.17, life: t, glow: 2, scale: this.scale * (0.85 + 0.15 * (p.z + 1) / 2), flip: p.flip }) };
    });
    drawers.sort((a, b) => a.z - b.z).forEach((d) => d.f());
    g.particles.draw(ctx);

    // the big number
    const msg = `${this.count} DRAGONS HOME!`;
    const a = clamp((DUR.CELEBRATE - 0.3 - t) * 3);
    if (t > 0.3) drawTextPop(ctx, msg, W / 2, 34, (t - 0.3) * 1.2, { scale: fitScale(msg, W - 12, 6, 4), color: PAL.gold2, alpha: a });

    this.drawNames(ctx, t);
    this.drawNewStar(ctx, t);
  }

  // this round's eight names roll past in two rows going opposite ways, each with its dragon
  drawNames(ctx, t) {
    if (t < 0.8) return;
    const k = clamp((t - 0.8) * 2) * clamp((DUR.CELEBRATE - 0.4 - t) * 3);
    ctx.fillStyle = `rgba(5,8,20,${0.6 * k})`;
    ctx.fillRect(0, 190, W, 66);
    const rows = [this.round.slice(0, 4), this.round.slice(4)];
    rows.forEach((row, ri) => {
      const items = row.map((r) => ({ ...r, w: textWidth(r.d.name, 2) + 44 }));
      const total = items.reduce((s, it) => s + it.w, 0);
      const travel = W + total;
      const speed = travel / (DUR.CELEBRATE - 1.2);
      const off = (t - 0.8) * speed;
      let x = ri === 0 ? W - off : -total + off;
      const y = ri === 0 ? 206 : 238;
      for (const it of items) {
        drawDragon(ctx, x + 12, y + 3, it.d, { mood: 'joy', flap: t * 3 + it.i, life: t, glow: 2, scale: 0.4, flip: ri === 1 });
        glow(ctx, x + 30 + (it.w - 44) / 2, y, 16, it.d.colors.wingLit, 0.35 * k);
        drawText(ctx, it.d.name, x + 30, y - 6, { scale: 2, color: PAL.cream, alpha: k });
        x += it.w;
      }
    });
  }

  // a sparkle gathers in the middle, then flies up to its place in the sky and stays
  drawNewStar(ctx, t) {
    if (t < STAR_AT) return;
    const spot = this.starSpot();
    if (t < STAR_UP) {
      const k = (t - STAR_AT) / (STAR_UP - STAR_AT);
      glow(ctx, C.x, C.y, 10 + k * 30, PAL.gold2, 0.4 + k * 0.5);
      drawPartyStar(ctx, C.x, C.y, t, 0.6 + k * 1.2, this.nth);
      return;
    }
    const k = ease.inOutSine(clamp((t - STAR_UP) / 0.7));
    const x = lerp(C.x, spot.x, k);
    const y = lerp(C.y, spot.y, k) - Math.sin(k * Math.PI) * 30;
    for (let i = 1; i < 8; i++) {
      const kk = Math.max(0, k - i * 0.04);
      glow(ctx, lerp(C.x, spot.x, kk), lerp(C.y, spot.y, kk) - Math.sin(kk * Math.PI) * 30, 6, PAL.gold2, 0.3 * (1 - i / 8));
    }
    drawPartyStar(ctx, x, y, t, lerp(1.8, 1, k), this.nth);
    if (k >= 1) drawText(ctx, 'A NEW STAR!', spot.x, spot.y + 12, { scale: 2, align: 'center', color: PAL.gold2, alpha: clamp((DUR.CELEBRATE - t) * 3) });
  }
}
