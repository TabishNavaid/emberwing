import { TAU } from '../core/util.js';

// each dragon's little personality. scenes call update() every step and add pose() on top of
// whatever they're already doing. it only ever changes how the dragon is drawn, never where
// the game thinks it is, so a loop never makes you miss a hoop
const SNEEZE = 0.55;
const LOOP = 0.8;

export class Quirk {
  constructor(d, phase = 0) {
    this.d = d;
    this.kind = d.quirk;
    this.t = phase;
    this.act = -1; // seconds into a sneeze or loop, -1 = not doing one
    this.next = 1.4 + ((d.seed % 13) / 13) * 2 + phase * 0.3;
    this.shy = 0; // shy dragons hide their face for a bit whenever they show up
  }
  // a new appearance (the dragon was just found, just landed home...)
  reset() {
    this.shy = 2.2;
    this.act = -1;
    this.next = this.t + 2.6;
  }
  // flying: loops only happen in the air. returns 'sneeze' on the frame the sparks come out
  update(dt, flying = true) {
    this.t += dt;
    this.shy = Math.max(0, this.shy - dt);
    let ev = null;
    if (this.act >= 0) {
      const before = this.act;
      this.act += dt;
      if (this.kind === 'sparky' && before < 0.32 && this.act >= 0.32) ev = 'sneeze';
      if (this.act >= (this.kind === 'loopy' ? LOOP : SNEEZE)) {
        this.act = -1;
        this.next = this.t + 3 + (Math.sin(this.d.seed + this.t) * 0.5 + 0.5) * 2.5;
      }
    } else if ((this.kind === 'sparky' || (this.kind === 'loopy' && flying)) && this.t >= this.next) {
      this.act = 0;
    }
    return ev;
  }
  pose(flying = true) {
    const t = this.t;
    const p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, blink: undefined, look: undefined, mood: undefined };
    const k = this.act;
    if (this.kind === 'sparky' && k >= 0) {
      if (k < 0.32) {
        // big breath in, head tips back
        const a = k / 0.32;
        p.sy = 1 + a * 0.1;
        p.sx = 1 - a * 0.05;
        p.rot = -a * 0.2;
        p.blink = a > 0.6;
      } else {
        // achoo
        const a = (k - 0.32) / (SNEEZE - 0.32);
        p.sy = 1 - 0.14 * (1 - a);
        p.sx = 1 + 0.1 * (1 - a);
        p.rot = 0.22 * (1 - a);
        p.blink = true;
      }
    } else if (this.kind === 'loopy' && k >= 0) {
      const a = k / LOOP;
      p.rot = -a * TAU;
      p.dy = -Math.sin(a * Math.PI) * 14;
      p.dx = Math.sin(a * TAU) * 6;
      p.mood = 'joy';
    } else if (this.kind === 'wobbly') {
      p.rot = Math.sin(t * 5.3) * 0.12 + Math.sin(t * 8.9) * 0.06;
      p.dy = Math.sin(t * 3.7) * 2 + Math.sin(t * 6.1) * 1;
      p.dx = Math.sin(t * 2.3) * 1.5;
    } else if (this.kind === 'bouncy') {
      const b = Math.abs(Math.sin(t * (flying ? 3.2 : 4.2)));
      p.dy = -b * (flying ? 5 : 4);
      // squash at the bottom of every bounce
      const low = 1 - Math.min(1, b * 4);
      p.sy = 1 - low * 0.12;
      p.sx = 1 + low * 0.1;
    } else if (this.kind === 'shy') {
      // looks away and shrinks a little when it first shows up, then every so often after
      const glance = (t % 6) < 0.8;
      if (this.shy > 0 || glance) {
        p.look = -1;
        p.mood = 'curious';
        p.sy = 0.94;
        p.dy = 1;
      }
    }
    return p;
  }
}
