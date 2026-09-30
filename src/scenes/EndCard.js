import { VIEW, DUR, PAL } from '../config.js';
import { clamp, glow } from '../core/util.js';
import { Dwell } from '../input/Dwell.js';
import { drawText, textWidth } from '../art/font.js';
import { drawKnotFrame, drawKnotRing } from '../art/knotwork.js';
import { drawSky, SKY, makeStars, drawStars } from '../art/world.js';
import { drawBaseAurora } from '../art/aurora.js';
import { drawHorn, drawSoundLines, drawLantern, drawCursorLight } from '../art/icons.js';

const { W, H } = VIEW;
const SKIP = { x: 446, y: 244, r: 18 };

export class EndCard {
  interactive = false;

  enter(g) {
    this.stars = makeStars(33, 90, 200);
    this.dwell = new Dwell(SKIP.x, SKIP.y, SKIP.r + 6, DUR.END_SKIP_DWELL);
    this.leaving = false;
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
    if (this.dwell.update(g.input, dt)) this.leave(g);
    if (this.t >= DUR.END) this.leave(g);
  }

  draw(g, ctx) {
    const t = this.t;
    drawSky(ctx, SKY.aurora, 0, H);
    drawStars(ctx, this.stars, t);
    drawBaseAurora(ctx, t, 0.8, 10);
    g.wall.draw(ctx, t, 0.6);

    const x = 60, y = 16, w = W - 120, h = 196;
    ctx.fillStyle = 'rgba(8,10,24,0.82)';
    ctx.fillRect(x, y, w, h);
    drawKnotFrame(ctx, x, y, w, h, { color: PAL.gold });

    // 3 big lines. the old card had 5 and nobody could read it in 3s
    glow(ctx, W / 2, y + 50, 70, PAL.gold, 0.2 + g.beat.pulse * 0.15);
    drawText(ctx, 'ACT II', W / 2, y + 22, { scale: 7, align: 'center', color: PAL.gold });
    drawText(ctx, 'HOW TO TRAIN YOUR DRAGON', W / 2, y + 92, { scale: 2, align: 'center', color: PAL.cream });

    const lw = textWidth('LISTEN FOR THE BRASS!', 2);
    const lx = Math.round(W / 2 - (lw + 52) / 2);
    glow(ctx, lx + 12, y + 140, 26, PAL.gold, 0.3 + g.beat.pulse * 0.2);
    drawHorn(ctx, lx + 14, y + 140, 2);
    drawSoundLines(ctx, lx + 36, y + 140, 1, t);
    drawText(ctx, 'LISTEN FOR THE BRASS!', lx + 54, y + 133, { scale: 2, color: PAL.gold2 });

    // shrinking bar = time left, no numbers needed
    const left = clamp(1 - t / DUR.END);
    ctx.fillStyle = 'rgba(255,201,74,0.5)';
    ctx.fillRect(x + 20, y + h - 12, Math.round((w - 40) * left), 2);

    // hold the light on the little lantern to skip
    drawKnotRing(ctx, SKIP.x, SKIP.y, SKIP.r, this.dwell.progress, { lobes: 6, amp: 2, width: 1, on: PAL.gold, off: 'rgba(255,226,138,0.5)' });
    drawLantern(ctx, SKIP.x, SKIP.y, 1, 0.5 + this.dwell.progress * 0.5, t);
    drawText(ctx, 'NEXT', SKIP.x - SKIP.r - 6, SKIP.y - 6, { scale: 2, align: 'right', color: PAL.cream, alpha: 0.85 });

    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 0.8);
  }
}
