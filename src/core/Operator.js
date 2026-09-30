import { VIEW, PAL } from '../config.js';
import { drawText } from '../art/font.js';

// hidden operator keys: F fullscreen, R reset, S skip, D debug, C clear sky (asks first), M audio
export class Operator {
  constructor(game) {
    this.game = game;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.confirm = 0; // seconds left on the "clear sky?" dialog, it times out so it can't get stuck open
    this.toast = '';
    this.toastT = 0;
    this.fps = 60;
    window.addEventListener('keydown', (e) => this.key(e));
  }
  say(msg) {
    this.toast = msg;
    this.toastT = 1.8;
  }
  key(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // don't eat cmd+r etc
    const k = e.key.toLowerCase();
    const g = this.game;
    if (this.confirm > 0) {
      if (k === 'y' || k === 'enter') {
        g.store.clear();
        this.say('SKY CLEARED');
      } else {
        this.say('KEPT');
      }
      this.confirm = 0;
      return;
    }
    if (k === 'f') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    } else if (k === 'r') {
      g.scenes.go('attract', { reason: 'operator' }, { fade: 0.2 });
    } else if (k === 's') {
      g.scenes.skip();
    } else if (k === 'd') {
      this.debug = !this.debug;
    } else if (k === 'c') {
      this.confirm = 8;
    } else if (k === 'm') {
      this.say(g.audio.toggle() ? 'AUDIO ON' : 'AUDIO OFF');
    }
  }
  update(dt) {
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    if (this.confirm > 0) this.confirm = Math.max(0, this.confirm - dt);
    if (this.toastT > 0) this.toastT -= dt;
  }
  draw(ctx) {
    const g = this.game;
    const { W, H } = VIEW;
    if (this.debug) {
      const s = g.scenes.current;
      const lines = [
        `FPS ${this.fps.toFixed(0)}`,
        `SCENE ${g.scenes.name} ${s ? s.t.toFixed(1) : ''}S`,
        `RUN ${g.runStart ? (g.time - g.runStart).toFixed(1) + 'S' : '-'}`,
        `PTR ${g.input.x.toFixed(0)},${g.input.y.toFixed(0)} ${g.input.source}`,
        `SPEED ${g.input.speed.toFixed(2)} IDLE ${g.input.idle.toFixed(1)}`,
        `HOLD ${g.input.holding ? 'Y' : 'N'} BEAT ${g.beat.count}`,
        `DRAGONS ${g.store.count}`,
      ];
      if (g.input.status) lines.push(g.input.status.toUpperCase().slice(0, 60));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(2, 2, 170, lines.length * 9 + 4);
      lines.forEach((l, i) => drawText(ctx, l, 5, 5 + i * 9, { color: '#9fffe0', outline: null }));
      // raw (unfiltered) pointer, handy for seeing how jittery the mocap is
      ctx.fillStyle = '#ff3fd0';
      ctx.fillRect(Math.round(g.input.rawX) - 3, Math.round(g.input.rawY), 7, 1);
      ctx.fillRect(Math.round(g.input.rawX), Math.round(g.input.rawY) - 3, 1, 7);
    }
    if (this.confirm > 0) {
      ctx.fillStyle = 'rgba(5,7,13,0.85)';
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'CLEAR TONIGHT\'S SKY?', W / 2, H / 2 - 30, { scale: 3, align: 'center', color: PAL.gold });
      drawText(ctx, 'Y = CLEAR    N = KEEP', W / 2, H / 2 + 10, { scale: 2, align: 'center' });
      drawText(ctx, `${g.store.count} DRAGONS WILL BE ERASED`, W / 2, H / 2 + 40, { scale: 1, align: 'center', color: '#9fb4d0' });
    }
    if (this.toastT > 0) {
      drawText(ctx, this.toast, W - 8, 8, { scale: 2, align: 'right', color: PAL.gold, alpha: Math.min(1, this.toastT * 2) });
    }
  }
}
