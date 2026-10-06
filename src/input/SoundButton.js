// the speaker button in the bottom left corner: click it, tap it, or hold the light on it (the mocap
// prop can't click). M does the same
import { PAL } from '../config.js';
import { glow } from '../core/util.js';
import { drawKnotRing } from '../art/knotwork.js';
import { drawText, textWidth } from '../art/font.js';
import { drawSpeaker } from '../art/icons.js';

// it used to be just a picture. people clicked it and nothing happened
const SOUND_BTN = { x: 17, y: 256, w: 30, h: 24 };
const HOLD = 1.5; // a bit longer than the lanterns, so brushing past doesn't mute anything

export class SoundButton {
  constructor(game) {
    this.game = game;
    this.hold = 0;
    this.armed = true; // after a hold toggles it, the light has to leave before it can again
    this.hover = false;
    this.flash = 0;
  }

  contains(x, y) {
    return Math.abs(x - SOUND_BTN.x) <= SOUND_BTN.w / 2 + 3 && Math.abs(y - SOUND_BTN.y) <= SOUND_BTN.h / 2 + 3;
  }

  // a click, a tap, or a full hold
  press() {
    const a = this.game.audio;
    if (a.status === 'none') return;
    // still waiting for the browser to allow sound (a phone before its first touch): this tap
    // turns it on rather than muting something nobody has heard yet
    if (a.status === 'locked') a.unlock();
    else a.toggle();
    this.flash = 1;
  }

  update(dt) {
    const g = this.game;
    const inp = g.input;
    const over = inp.seen && this.contains(inp.x, inp.y);
    if (!over) this.armed = true;
    // holding only works when nobody is steering, so a guest's beam wandering into the corner
    // during find or the flight can't mute the game by accident (clicking works everywhere)
    const can = !g.scenes.current?.interactive && !g.gate && !g.op.cal && g.audio.status !== 'none';
    this.hover = can && over && this.armed;
    this.hold = this.hover ? this.hold + dt : Math.max(0, this.hold - dt * 2);
    if (this.hold >= HOLD) {
      this.press();
      this.hold = 0;
      this.armed = false;
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  draw(ctx) {
    const g = this.game;
    const state = g.audio.status;
    if (state === 'none') return;
    const { x, y, w, h } = SOUND_BTN;
    ctx.fillStyle = 'rgba(5,7,13,0.7)';
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = state === 'on' ? 'rgba(255,226,138,0.7)' : 'rgba(255,243,214,0.35)';
    ctx.fillRect(x - w / 2, y - h / 2, w, 1);
    ctx.fillRect(x - w / 2, y + h / 2 - 1, w, 1);
    ctx.fillRect(x - w / 2, y - h / 2, 1, h);
    ctx.fillRect(x + w / 2 - 1, y - h / 2, 1, h);
    if (this.flash > 0) glow(ctx, x, y, 26, state === 'on' ? PAL.gold : PAL.rose, this.flash * 0.8);
    drawSpeaker(ctx, x - 12, y, state, g.time, g.beat.pulse);
    if (this.hover || this.hold > 0) {
      drawKnotRing(ctx, x, y, 19, this.hold / HOLD, { lobes: 6, amp: 2, width: 1, on: PAL.gold, off: 'rgba(255,226,138,0.45)' });
      // on its own dark plate so it reads over whatever the scene has in that corner
      const msg = state === 'on' ? 'HOLD TO MUTE' : 'HOLD FOR SOUND';
      ctx.fillStyle = 'rgba(5,7,13,0.88)';
      ctx.fillRect(x + 20, y - 11, textWidth(msg, 2) + 10, 22);
      drawText(ctx, msg, x + 25, y - 7, { scale: 2, color: PAL.cream });
    }
  }
}
