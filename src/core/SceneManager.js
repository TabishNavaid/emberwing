import { DUR, INPUT, VIEW, PAL } from '../config.js';
import { clamp, ease } from './util.js';
import { drawTextPop, fitScale } from '../art/font.js';
import { drawKnotBand } from '../art/knotwork.js';
import { drawDragon } from '../art/dragon.js';

// one scene at a time with fades between them. also the idle watchdog: interactive
// scenes bail back to attract after INPUT.IDLE_RESET seconds of nobody pointing
export class SceneManager {
  constructor(game, scenes) {
    this.game = game;
    this.scenes = scenes;
    this.current = null;
    this.name = '';
    this.fade = 0; // 0 clear, 1 fully covered
    this.fadeDir = 0;
    this.fadeColor = '#000';
    this.fadeTime = DUR.FADE;
    this.pending = null;
    this.title = null; // { text, t } while a title card is up between scenes
  }
  // instant switch, no fade
  enter(name, data = {}) {
    const g = this.game;
    this.current?.exit?.(g);
    g.particles.clear();
    g.cam.reset();
    this.current = this.scenes[name];
    this.name = name;
    this.current.t = 0;
    g.input.resetIdle();
    this.current.enter(g, data);
  }
  // fades out, swaps at full black, then the new scene fades in while it's already running
  // title: optional card held between the fade out and the fade in. the next scene is paused
  // underneath, so its timeline (hoops etc) doesn't start until people can see it
  go(name, data = {}, { fade = DUR.FADE, color = '#05070d', title = null } = {}) {
    if (this.pending) return;
    if (fade <= 0) return this.enter(name, data);
    this.pending = { name, data, title };
    this.fadeDir = 1;
    this.fadeColor = color;
    this.fadeTime = fade;
  }
  update(dt) {
    const g = this.game;
    if (this.fadeDir) {
      this.fade = clamp(this.fade + (this.fadeDir * dt) / this.fadeTime);
      if (this.fadeDir > 0 && this.fade >= 1) {
        const p = this.pending;
        this.pending = null;
        this.enter(p.name, p.data);
        if (p.title) {
          this.title = { text: p.title, t: 0, lost: p.name === 'find' };
          this.fadeDir = 0; // stay covered while the title is up
        } else this.fadeDir = -1;
      } else if (this.fadeDir < 0 && this.fade <= 0) {
        this.fadeDir = 0;
      }
    }
    if (this.title) {
      this.title.t += dt;
      if (this.title.t < DUR.TITLE) return;
      this.title = null;
      this.fadeDir = -1;
      g.input.resetIdle(); // time spent reading the title doesn't count as idle
    }
    const s = this.current;
    if (!s) return;
    s.t += dt;
    s.update(g, dt);
    if (s.interactive && !this.pending && g.input.idle > INPUT.IDLE_RESET) {
      this.go('attract', { reason: 'idle' });
    }
  }
  draw(ctx) {
    this.current?.draw(this.game, ctx);
    if (this.fade > 0) {
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, VIEW.W, VIEW.H);
      ctx.globalAlpha = 1;
    }
    if (this.title) this.drawTitle(ctx);
  }

  drawTitle(ctx) {
    const { W, H } = VIEW;
    const k = this.title.t;
    const a = clamp(Math.min(k / 0.15, (DUR.TITLE - k) / 0.2));
    // tonight's dragon above the words: scared and dark before the find, flying after it
    const d = this.game.dragon;
    ctx.globalAlpha = a;
    if (this.title.lost) drawDragon(ctx, W / 2, H / 2 - 52, d, { mood: 'scared', wing: 'folded', glow: 0, life: k, sx: 1 + Math.sin(k * 30) * 0.02 });
    else drawDragon(ctx, W / 2 - 60 + k * 90, H / 2 - 54 + Math.sin(k * 6) * 4, d, { mood: 'fly', flap: k * 3.4, glow: 2 });
    ctx.globalAlpha = 1;
    drawTextPop(ctx, this.title.text, W / 2, H / 2 - 6, k * 1.4, { scale: fitScale(this.title.text, W - 16, 4), color: PAL.gold2, alpha: a });
    const len = Math.round(220 * ease.outCubic(clamp(k / 0.5)));
    ctx.globalAlpha = a;
    drawKnotBand(ctx, W / 2 - len / 2, H / 2 + 22, len);
    ctx.globalAlpha = 1;
  }
}
