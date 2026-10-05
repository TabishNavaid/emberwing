import { VIEW, DUR, PAL, LEVELS } from '../config.js';
import { clamp, glow, ease } from '../core/util.js';
import { drawText, drawTextPop, textWidth } from '../art/font.js';
import { drawKnotRing, drawKnotBand } from '../art/knotwork.js';
import { drawDragon } from '../art/dragon.js';
import { member, chirp, updateMember, drawMember } from '../art/flock.js';
import { drawSky, SKY, makeStars, drawStars, drawCloud } from '../art/world.js';
import { drawCursorLight, drawLevelIcon } from '../art/icons.js';
import { QUIRK_TEXT } from '../core/dragons.js';

const { W, H } = VIEW;
const CARD_X = [86, 240, 394];
const CARD = { y0: 46, y1: 236, w: 144 };
const RING = { dy: 104, r: 42 }; // the dwell ring sits around each dragon

// "who will you find?": three lost dragons side by side, hold the light on one to pick it.
// the other two stay lost for the guests after you. picks one by itself after DUR.CHOOSE so the
// line keeps moving
export class Choose {
  interactive = false; // it picks by itself, no idle reset needed

  enter(g) {
    this.level = LEVELS[g.level] ? g.level : 'hatchling';
    this.options = g.lost.slice(0, 3).map((d, i) => ({ d, me: member(d, i), x: CARD_X[i], progress: 0, hover: false }));
    this.picked = null;
    this.going = false;
    this.stars = makeStars(41, 60, 120);
    g.audio.section('attract');
  }

  // where a scripted guest holds the light to pick option i
  optionTarget(i = 1) {
    return { x: CARD_X[i], y: RING.dy };
  }
  target() {
    return this.optionTarget(1);
  }

  skip(g) {
    if (!this.picked) this.pick(g, this.options[1] ?? this.options[0]);
  }

  pick(g, opt) {
    this.picked = opt;
    this.pickT = 0;
    g.dragon = opt.d;
    // the other two stay in the pool for the next guests
    g.lost = g.lost.filter((d) => d !== opt.d);
    chirp(opt.me, 0.1);
    opt.me.q.reset();
    g.audio.cue('pick');
    g.cam.shake(1.5);
    g.particles.burst(opt.x, RING.dy, 36, { speed: 100, colors: [opt.d.colors.wingLit, PAL.gold2, '#ffffff'], kind: 'spark', size: 2, drag: 2.2, life: 0.9 }, g.rng);
  }

  update(g, dt) {
    for (const o of this.options) updateMember(g, o.me, dt, o.x, RING.dy, { flying: false });
    if (this.picked) {
      this.pickT += dt;
      if (this.pickT > 0.9 && !this.going) {
        this.going = true;
        g.scenes.go('find', {}, { title: `${g.dragon.name} IS LOST!` });
      }
      return;
    }
    const inp = g.input;
    let on = null;
    for (const o of this.options) {
      const inCard = Math.abs(inp.x - o.x) < CARD.w / 2 && inp.y > CARD.y0 && inp.y < CARD.y1;
      o.hover = inp.seen && !on && inCard;
      if (o.hover) on = o;
      o.progress = clamp(o.progress + (o.hover ? 1 : -1.5) * (dt / DUR.CHOOSE_DWELL));
      if (o.progress >= 1) return this.pick(g, o);
    }
    if (this.t >= DUR.CHOOSE) {
      // nobody picked: the one the light is closest to, or the middle one
      let best = this.options[1] ?? this.options[0];
      if (inp.seen) for (const o of this.options) if (Math.abs(inp.x - o.x) < Math.abs(inp.x - best.x)) best = o;
      this.pick(g, best);
    }
  }

  draw(g, ctx) {
    const t = this.t;
    drawSky(ctx, SKY.storm, 0, H);
    drawStars(ctx, this.stars, t, 0.5);
    for (let i = 0; i < 4; i++) drawCloud(ctx, ((t * (10 + i * 4) + i * 140) % 640) - 80, 30 + (i % 2) * 150, 120, '#1c2a40', 50 + i, 0.6);

    drawText(ctx, 'WHO WILL YOU FIND?', W / 2, 10, { scale: 3, align: 'center', color: PAL.gold2 });
    // the level they picked, small, so they know it took
    const lab = LEVELS[this.level].label;
    const lw = textWidth(lab, 2);
    drawLevelIcon(ctx, this.level, W / 2 - lw / 2 - 14, 251, t);
    drawText(ctx, lab, W / 2 + 4, 245, { scale: 2, align: 'center', color: PAL.gold });

    for (const o of this.options) this.drawCard(g, ctx, o, t);

    // shrinking bar = time until it picks for you
    if (!this.picked) {
      const left = clamp(1 - t / DUR.CHOOSE);
      ctx.fillStyle = 'rgba(255,201,74,0.55)';
      ctx.fillRect(Math.round(W / 2 - 150 * left), 238, Math.round(300 * left), 2);
    }
    g.particles.draw(ctx);
    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 1);
  }

  drawCard(g, ctx, o, t) {
    const d = o.d;
    const chosen = this.picked === o;
    const other = this.picked && !chosen;
    const x0 = o.x - CARD.w / 2;
    ctx.globalAlpha = other ? 0.4 : 1;
    ctx.fillStyle = o.hover || chosen ? 'rgba(40,36,70,0.85)' : 'rgba(10,14,30,0.75)';
    ctx.fillRect(x0, CARD.y0 + 10, CARD.w, CARD.y1 - CARD.y0 - 26);
    glow(ctx, o.x, RING.dy, 52, d.colors.wingLit, (chosen ? 0.6 : 0.15) + o.progress * 0.4);
    drawKnotRing(ctx, o.x, RING.dy, RING.r, chosen ? 1 : o.progress, { lobes: 9, amp: 3, width: 2, on: PAL.gold, off: o.hover ? 'rgba(255,226,138,0.7)' : 'rgba(255,226,138,0.35)' });
    // lost and a bit scared until picked, then happy and lit up
    const dy = RING.dy + 10;
    if (chosen) {
      const k = ease.outCubic(clamp(this.pickT / 0.3));
      drawMember(ctx, o.me, o.x, dy - k * 6, { mood: 'happy', flap: t * 3, glow: 2, life: t });
    } else {
      drawDragon(ctx, o.x, dy, d, { mood: o.hover ? 'curious' : 'scared', wing: 'folded', glow: 1, life: t + o.x, look: o.hover ? 0 : -1 });
    }
    if (chosen) drawTextPop(ctx, d.name, o.x, 164, this.pickT * 1.5, { scale: 3, color: PAL.gold2 });
    else drawText(ctx, d.name, o.x, 154, { scale: 3, align: 'center', color: PAL.gold });
    // the quirk, on two lines when it's long so the cards don't run into each other
    const q = QUIRK_TEXT[d.quirk];
    const words = q.split(' ');
    const lines = q.length > 11 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [q];
    lines.forEach((l, i) => drawText(ctx, l, o.x, 182 + i * 16, { scale: 2, align: 'center', color: '#bff8ee' }));
    ctx.globalAlpha = 1;
    if (other) drawText(ctx, 'NEXT TIME', o.x, 216, { scale: 2, align: 'center', color: PAL.cream, alpha: clamp(this.pickT * 3) * 0.8 });
    if (chosen) drawKnotBand(ctx, x0 + 12, CARD.y1 - 20, CARD.w - 24, { color: PAL.gold, period: 10, amp: 2 });
  }
}
