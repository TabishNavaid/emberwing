import { VIEW, DUR, PAL, LEVELS, FLOCK } from '../config.js';
import { clamp, glow, ease, dist, dwell } from '../core/util.js';
import { drawText, drawTextPop, textWidth, fitScale } from '../art/font.js';
import { drawKnotFrame, drawKnotRing, drawKnotBand } from '../art/knotwork.js';
import { drawSky, SKY, makeStars, drawStars } from '../art/world.js';
import { drawBaseAurora, drawPartyStars } from '../art/aurora.js';
import { drawHorn, drawLantern, drawCursorLight, drawSparkle, drawStarIcon } from '../art/icons.js';
import { member, chirp, updateMember, drawMember } from '../art/flock.js';
import { ordinal, QUIRK_TEXT } from '../core/dragons.js';

const { W, H } = VIEW;
const SKIP = { x: 446, y: 244, r: 18 };
// the card, centered so it looks right in a phone photo of the whole wall
const CARD = { x: 60, y: 10, w: 360, h: 226 };
const PORTRAIT = { x: 122, y: 100 }; // body center, the head and wings sit up inside the ring
const RING = { x: 126, y: 80, r: 58 };

// the guest's dragon gets a little trading card: portrait, name, which one home it was tonight,
// its quirk, and the act II line to take into the hall
export class EndCard {
  interactive = false;

  enter(g) {
    this.stars = makeStars(33, 90, 200);
    this.skipHold = 0; // 0..1 on the little lantern
    this.leaving = false;
    this.d = g.dragon;
    // which number it was. home saved it already, so it's the count (or the next one if we got
    // here some other way, like ?scene=end)
    this.nth = this.d.home ? g.store.count : g.store.count + 1;
    this.run = g.lastRun ?? { level: g.level, score: 0, stars: 1 };
    this.me = member(this.d);
    this.me.q.reset();
    chirp(this.me, 0.35);
    g.audio.section('card');
    g.audio.cue('card');
  }

  exit(g) {
    if (g.runStart) {
      g.runs.push(+(g.time - g.runStart).toFixed(2));
      g.runStart = 0;
    }
  }

  skip(g) {
    this.leave(g);
  }
  leave(g) {
    if (this.leaving) return;
    this.leaving = true;
    g.scenes.go('attract', { reason: 'done' });
  }

  update(g, dt) {
    updateMember(g, this.me, dt, PORTRAIT.x, PORTRAIT.y, { scale: 2 / this.d.size });
    if (this.skipHold < 1) {
      const inp = g.input;
      const over = inp.seen && dist(inp.x, inp.y, SKIP.x, SKIP.y) < SKIP.r + 6;
      this.skipHold = dwell(this.skipHold, over, dt, DUR.END_SKIP_DWELL);
      if (this.skipHold >= 1) this.leave(g);
    }
    if (this.t >= DUR.END) this.leave(g);
  }

  draw(g, ctx) {
    const t = this.t;
    const d = this.d;
    drawSky(ctx, SKY.aurora, 0, H);
    drawStars(ctx, this.stars, t);
    drawBaseAurora(ctx, t, 0.8, 10);
    g.wall.draw(ctx, t, 0.6);
    drawPartyStars(ctx, Math.floor(g.store.count / FLOCK.CELEBRATE_EVERY), t);

    const { x, y, w, h } = CARD;
    // slides up into place
    const k = ease.outCubic(clamp(t / 0.45));
    ctx.save();
    ctx.translate(0, Math.round((1 - k) * 30));
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(8,10,24,0.9)';
    ctx.fillRect(x, y, w, h);
    drawKnotFrame(ctx, x, y, w, h, { color: PAL.gold });

    // portrait in a ring of its own wing color, always exactly 2x so the pixels stay square
    glow(ctx, RING.x, RING.y, RING.r + 6, d.colors.wingLit, 0.3 + g.beat.pulse * 0.1);
    drawKnotRing(ctx, RING.x, RING.y, RING.r, 1, { lobes: 10, amp: 3, width: 2, on: d.colors.wingLit });
    // a slow hover between two wing poses, the full flap pokes out of the ring at 2x
    const wing = Math.sin(t * 5) > 0 ? 'mid' : 'down';
    drawMember(ctx, this.me, PORTRAIT.x, PORTRAIT.y, { mood: 'joy', wing, life: t, glow: 2, scale: 2 / d.size });

    // name, which one it was tonight, its quirk, and how the flight went
    const cx = 302;
    const nameScale = fitScale(d.name, 196, 5, 3);
    drawTextPop(ctx, d.name, cx, 34, clamp((t - 0.25) * 1.3), { scale: nameScale, color: PAL.gold2 });
    drawText(ctx, `THE ${ordinal(this.nth)} EMBERWING`, cx, 58, { scale: 2, align: 'center', color: PAL.cream });
    drawText(ctx, 'HOME TONIGHT', cx, 74, { scale: 2, align: 'center', color: PAL.cream });
    const quirk = QUIRK_TEXT[d.quirk];
    const qw = textWidth(quirk, 2);
    drawSparkle(ctx, cx - qw / 2 - 9, 98, 3, d.colors.wingLit);
    drawSparkle(ctx, cx + qw / 2 + 9, 98, 3, d.colors.wingLit);
    drawText(ctx, quirk, cx, 92, { scale: 2, align: 'center', color: '#bff8ee' });
    // stars pop in one at a time
    for (let i = 0; i < 3; i++) {
      const k = clamp((t - 0.6 - i * 0.25) / 0.2);
      const earned = i < this.run.stars;
      if (earned && k > 0 && k < 1) glow(ctx, cx - 26 + i * 26, 118, 18, PAL.gold, 1 - k);
      drawStarIcon(ctx, cx - 26 + i * 26, 118, earned && k > 0, 2);
    }
    drawText(ctx, `${LEVELS[this.run.level].label} ${this.run.score}`, cx, 131, { scale: 2, align: 'center', color: PAL.gold });

    drawKnotBand(ctx, x + 20, 150, w - 40);

    // the line to take into the hall
    const l1 = 'HEAR IT LIVE IN ACT II';
    const l1w = textWidth(l1, 2) + 30;
    const l1x = Math.round(W / 2 - l1w / 2);
    glow(ctx, l1x + 10, 167, 18, PAL.gold, 0.3 + g.beat.pulse * 0.2);
    drawHorn(ctx, l1x + 12, 167, 1);
    drawText(ctx, l1, l1x + 30, 160, { scale: 2, color: PAL.gold2 });
    drawText(ctx, 'HOW TO TRAIN YOUR DRAGON', W / 2, 180, { scale: 2, align: 'center', color: PAL.cream });
    drawText(ctx, 'LISTEN FOR THE BRASS!', W / 2, 200, { scale: 2, align: 'center', color: PAL.gold2 });

    // shrinking bar = time left, no numbers needed
    const left = clamp(1 - t / DUR.END);
    ctx.fillStyle = 'rgba(255,201,74,0.5)';
    ctx.fillRect(x + 20, y + h - 10, Math.round((w - 40) * left), 2);
    ctx.restore();

    // hold the light on the little lantern to skip
    drawKnotRing(ctx, SKIP.x, SKIP.y, SKIP.r, this.skipHold, { lobes: 6, amp: 2, width: 1, on: PAL.gold, off: 'rgba(255,226,138,0.5)' });
    drawLantern(ctx, SKIP.x, SKIP.y, 0.5 + this.skipHold * 0.5, t);
    drawText(ctx, 'NEXT', SKIP.x - SKIP.r - 6, SKIP.y - 6, { scale: 2, align: 'right', color: PAL.cream, alpha: 0.85 });

    g.particles.draw(ctx);
    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 0.8);
  }
}
