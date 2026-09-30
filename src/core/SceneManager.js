import { DUR, INPUT, VIEW } from '../config.js';
import { clamp } from './util.js';

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
  go(name, data = {}, { fade = DUR.FADE, color = '#05070d' } = {}) {
    if (this.pending) return;
    if (fade <= 0) return this.enter(name, data);
    this.pending = { name, data };
    this.fadeDir = 1;
    this.fadeColor = color;
    this.fadeTime = fade;
  }
  skip() {
    this.current?.skip?.(this.game);
  }
  update(dt) {
    const g = this.game;
    if (this.fadeDir) {
      this.fade = clamp(this.fade + (this.fadeDir * dt) / this.fadeTime);
      if (this.fadeDir > 0 && this.fade >= 1) {
        const p = this.pending;
        this.pending = null;
        this.enter(p.name, p.data);
        this.fadeDir = -1;
      } else if (this.fadeDir < 0 && this.fade <= 0) {
        this.fadeDir = 0;
      }
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
  }
}
