import { VIEW, DUR, PAL } from '../config.js';
import { clamp, glow } from '../core/util.js';
import { Dwell } from '../input/Dwell.js';
import { drawText } from '../art/font.js';
import { drawKnotFrame, drawKnotRing } from '../art/knotwork.js';
import { drawSky, SKY, makeStars, drawStars } from '../art/world.js';
import { drawBaseAurora } from '../art/aurora.js';
import { drawHorn, drawSoundLines, drawLantern, drawCursorLight } from '../art/icons.js';

const { W, H } = VIEW;
const SKIP = { x: 446, y: 244, r: 18 };

// Scene 4: END CARD. Point people to the real thing: the orchestra in Act II.
// Guests in a hurry can hold their light on the lantern to skip.
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
    g.scenes.go('attract', { reason: 'done' }, { fade: 0.6 });
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

    const x = 50, y = 16, w = W - 100, h = 200;
    ctx.fillStyle = 'rgba(8,10,24,0.82)';
    ctx.fillRect(x, y, w, h);
    drawKnotFrame(ctx, x, y, w, h, { color: PAL.gold });

    drawText(ctx, 'HEAR THIS FLIGHT IN ACT II', W / 2, y + 16, { scale: 2, align: 'center', color: PAL.cream });
    drawText(ctx, 'FROM', W / 2, y + 44, { scale: 1, align: 'center', color: '#bff8ee' });
    drawText(ctx, 'HOW TO TRAIN YOUR DRAGON', W / 2, y + 56, { scale: 2, align: 'center', color: PAL.gold });
    drawText(ctx, 'WALLA WALLA SYMPHONY', W / 2, y + 84, { scale: 2, align: 'center', color: PAL.cream });
    drawText(ctx, 'YOUTH ORCHESTRA', W / 2, y + 102, { scale: 2, align: 'center', color: PAL.cream });

    glow(ctx, W / 2 - 60, y + 150, 34, PAL.gold, 0.3 + g.beat.pulse * 0.2);
    drawHorn(ctx, W / 2 - 66, y + 150, 2);
    drawSoundLines(ctx, W / 2 - 42, y + 150, 1, t);
    drawText(ctx, 'LISTEN FOR', W / 2 - 16, y + 136, { scale: 2, align: 'left', color: PAL.gold2 });
    drawText(ctx, 'THE BRASS!', W / 2 - 16, y + 154, { scale: 2, align: 'left', color: PAL.gold2 });

    // the time left, as a thin woven band shrinking (no numbers needed)
    const left = clamp(1 - t / DUR.END);
    ctx.fillStyle = 'rgba(255,201,74,0.5)';
    ctx.fillRect(x + 20, y + h - 12, Math.round((w - 40) * left), 2);

    // skip lantern (hold to skip)
    drawKnotRing(ctx, SKIP.x, SKIP.y, SKIP.r, this.dwell.progress, { lobes: 6, amp: 2, width: 1, on: PAL.gold, off: 'rgba(255,226,138,0.35)' });
    drawLantern(ctx, SKIP.x, SKIP.y, 1, 0.5 + this.dwell.progress * 0.5, t);
    drawText(ctx, 'NEXT', SKIP.x - SKIP.r - 6, SKIP.y - 3, { scale: 1, align: 'right', color: PAL.cream, alpha: 0.8 });

    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 0.8);
  }
}
