// the score for one flight, plus the little "+150" numbers that float up where it happened
import { SCORE, LEVELS, PAL } from '../config.js';
import { drawText } from '../art/font.js';

export class Points {
  constructor(level) {
    this.level = level;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.perfects = 0;
    this.bumps = 0;
    this.popped = 0;
    this.bestStreak = 0;
    this.popups = [];
    this.pop = 0; // the score in the corner bounces when it changes
  }

  add(n, x, y, label = null, color = null) {
    this.score = Math.max(0, this.score + n);
    this.pop = 0.35;
    this.popups.push({ text: label ?? (n >= 0 ? `+${n}` : `${n}`), x, y, t: 0, color: color ?? (n >= 0 ? PAL.gold2 : PAL.rose) });
    if (this.popups.length > 12) this.popups.shift();
  }

  // a hoop flown through. streak = hoops in a row including this one, mult = 2 in a speed burst
  hoop(x, y, streak, perfect, mult = 1) {
    this.hits++;
    this.bestStreak = Math.max(this.bestStreak, streak);
    if (perfect) this.perfects++;
    const n = mult * (SCORE.HOOP + (perfect ? SCORE.PERFECT : 0) + SCORE.STREAK * Math.min(streak - 1, SCORE.STREAK_MAX));
    this.add(n, x, y, perfect ? `PERFECT +${n}` : null);
    return n;
  }

  get clean() {
    return this.bumps === 0 && this.misses <= 1;
  }

  // one star for everybody, then the level's thresholds
  get stars() {
    const [two, three] = LEVELS[this.level].stars;
    return this.score >= three ? 3 : this.score >= two ? 2 : 1;
  }

  update(dt) {
    this.pop = Math.max(0, this.pop - dt);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.1);
  }

  // popups are in screen coords
  drawPopups(ctx) {
    for (const p of this.popups) {
      const a = Math.min(1, (1.1 - p.t) * 3);
      drawText(ctx, p.text, p.x, Math.round(p.y - 14 - p.t * 22), { scale: 2, align: 'center', color: p.color, alpha: a });
    }
  }
}
