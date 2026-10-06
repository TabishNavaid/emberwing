import { VIEW, PAL, INPUT } from '../config.js';
import { drawText } from '../art/font.js';
import { drawKnotRing } from '../art/knotwork.js';
import { ROUTES } from '../art/routes.js';
import { glow } from './util.js';
import { CAL_TARGETS, CAL_NAMES } from '../input/Calibration.js';

// hidden operator keys: F fullscreen, R reset, S skip, D debug, C clear sky (asks first), M sound,
// G reduced motion (auto / on / off), K calibrate the mocap rig
export class Operator {
  constructor(game) {
    this.game = game;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.confirm = 0; // seconds left on the "clear sky?" dialog, it times out so it can't get stuck open
    this.toast = '';
    this.toastT = 0;
    this.fps = 60;
    this.cal = null; // calibration in progress
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
    if (this.cal) return this.calKey(e.key);
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
      g.scenes.current?.skip(g);
    } else if (k === 'd') {
      this.debug = !this.debug;
    } else if (k === 'c') {
      this.confirm = 8;
    } else if (k === 'k') {
      this.cal = { step: 0, pts: [], hold: 0, ax: null, ay: null, armed: true, source: g.input.source };
    } else if (k === 'g') {
      g.motion.cycle();
      this.say(`MOTION ${g.motion.label()}`);
    } else if (k === 'm') {
      this.say(g.audio.toggle() ? 'SOUND ON' : 'SOUND OFF');
    }
  }
  calKey(key) {
    const g = this.game;
    if (key === 'Escape') {
      this.cal = null;
      this.say('CALIBRATION CANCELLED');
    } else if (key === 'Delete' || key === 'Backspace') {
      g.cal.clear();
      this.cal = null;
      this.say('CALIBRATION CLEARED');
    } else if (key === ' ' || key === 'Enter') {
      // someone at the keyboard can grab the corner right away
      this.calCapture(g.input.srcX, g.input.srcY);
    }
  }

  calCapture(x, y) {
    const c = this.cal;
    c.pts.push([x, y]);
    c.source = this.game.input.source;
    c.step++;
    c.hold = 0;
    c.armed = false; // has to move away first, or it grabs the same spot for the next corner
    if (c.step < 4) return;
    const ok = this.game.cal.set(c.source, c.pts);
    this.cal = null;
    this.say(ok ? 'CALIBRATED' : 'CALIBRATION FAILED, TRY AGAIN');
  }

  calUpdate(dt) {
    const c = this.cal;
    const { srcX: x, srcY: y } = this.game.input;
    const last = c.pts[c.pts.length - 1];
    if (!c.armed && (!last || Math.hypot(x - last[0], y - last[1]) > 20)) c.armed = true;
    if (c.ax === null || Math.hypot(x - c.ax, y - c.ay) > INPUT.CAL_STEADY) {
      c.ax = x;
      c.ay = y;
      c.hold = 0;
    } else if (c.armed) {
      c.hold += dt;
      if (c.hold >= INPUT.CAL_HOLD) this.calCapture(c.ax, c.ay);
    }
  }

  update(dt) {
    if (this.cal) this.calUpdate(dt);
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
        `DRAGONS ${g.store.count} NEXT ${g.dragon.name}`,
        `ROUTE ${ROUTES[g.route % ROUTES.length].name}`,
        `SOUND ${g.audio.status.toUpperCase()}${g.audio.ctx ? ' ' + g.audio.ctx.state.toUpperCase() : ''}`,
        `MOTION ${g.motion.label()}`,
        `CAL ${this.cal ? `IN PROGRESS ${this.cal.step + 1}/4` : g.cal.label()}`,
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
    if (this.cal) this.drawCal(ctx);
    if (this.toastT > 0) {
      drawText(ctx, this.toast, W - 8, 8, { scale: 2, align: 'right', color: PAL.gold, alpha: Math.min(1, this.toastT * 2) });
    }
  }

  // "press any key to start the station", until the browser lets sound play
  drawGate(ctx) {
    const { W, H } = VIEW;
    const t = this.game.time;
    ctx.fillStyle = 'rgba(5,7,13,0.82)';
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W / 2, H / 2 - 10, 120, PAL.gold, 0.15 + 0.05 * Math.sin(t * 2));
    drawText(ctx, 'PRESS ANY KEY', W / 2, H / 2 - 40, { scale: 4, align: 'center', color: PAL.gold });
    drawText(ctx, 'TO START', W / 2, H / 2 - 4, { scale: 4, align: 'center', color: PAL.gold });
    drawText(ctx, 'THIS TURNS THE SOUND ON', W / 2, H / 2 + 42, { scale: 2, align: 'center', color: PAL.cream });
    drawText(ctx, 'OR PRESS M FOR NO SOUND', W / 2, H / 2 + 62, { scale: 2, align: 'center', color: '#9fb4d0' });
  }

  drawCal(ctx) {
    const { W, H } = VIEW;
    const c = this.cal;
    const inp = this.game.input;
    ctx.fillStyle = 'rgba(5,7,13,0.9)';
    ctx.fillRect(0, 0, W, H);
    const [tx, ty] = CAL_TARGETS[c.step];
    glow(ctx, tx, ty, 26, PAL.gold, 0.6);
    drawKnotRing(ctx, tx, ty, 16, c.hold / INPUT.CAL_HOLD, { lobes: 6, amp: 2, width: 2, on: PAL.gold, off: 'rgba(255,226,138,0.5)' });
    drawText(ctx, 'CALIBRATE', W / 2, 70, { scale: 3, align: 'center', color: PAL.gold });
    drawText(ctx, `POINT AT ${CAL_NAMES[c.step]}`, W / 2, 104, { scale: 2, align: 'center' });
    drawText(ctx, c.armed ? 'AND HOLD STILL' : 'MOVE TO THE NEXT RING', W / 2, 124, { scale: 2, align: 'center', color: '#bff8ee' });
    drawText(ctx, `${c.step + 1} / 4`, W / 2, 152, { scale: 2, align: 'center', color: PAL.gold2 });
    drawText(ctx, 'SPACE GRAB  ·  ESC CANCEL  ·  DEL CLEAR SAVED', W / 2, 196, { scale: 1, align: 'center', color: '#9fb4d0' });
    // where the rig says it's pointing, before calibration
    const px = Math.max(0, Math.min(W, inp.srcX));
    const py = Math.max(0, Math.min(H, inp.srcY));
    ctx.fillStyle = '#ff3fd0';
    ctx.fillRect(Math.round(px) - 4, Math.round(py), 9, 1);
    ctx.fillRect(Math.round(px), Math.round(py) - 4, 1, 9);
  }
}
