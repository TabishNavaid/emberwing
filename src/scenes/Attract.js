import { DUR, PAL, FLOCK, LEVELS, LEVEL_ORDER } from '../config.js';
import { glow, clamp, dwell } from '../core/util.js';
import { drawText } from '../art/font.js';
import { drawKnotRing, drawKnotBand } from '../art/knotwork.js';
import { drawSpeck } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { fillLost } from '../core/dragons.js';
import { ROUTES } from '../art/routes.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawWind } from '../art/world.js';
import { drawFeet, drawCursorLight, drawSparkle, drawArrowUp, drawLevelIcon } from '../art/icons.js';
import { drawBaseAurora, drawRibbon, ribbonSkyPoints, RIBBON_COLORS, drawPartyStars } from '../art/aurora.js';
import { Storybook, BOOK } from '../art/storybook.js';

// storybook on the left, the level picker on the right. picking a level is how a run starts
const COL = 374; // middle of the right column
const ROW_H = 58;
// each row is a big target: the ring, the name, the hint and tonight's best all count
const ROWS = LEVEL_ORDER.map((id, i) => {
  const top = 50 + i * ROW_H;
  return { id, top, ring: { x: 292, y: top + 22, r: 17 }, x0: 270, x1: 479, y0: top - 4, y1: top + 52 };
});
const YOURS = { x: 222, y: 10 }; // the free strip of sky between the title and NEXT FLYER
// holding the light still for this long anywhere near the middle starts hatchling, for people
// who don't aim at a lantern at all
const HOLD_ANYWHERE = 2.0;
const MIDDLE = { x0: 60, x1: 420, y0: 50, y1: 230 };

// how many more dragons until the next celebration
const partyLeft = (n) => FLOCK.CELEBRATE_EVERY - (n % FLOCK.CELEBRATE_EVERY);

export class Attract {
  interactive = false;

  enter(g, data = {}) {
    this.rows = ROWS.map((r) => ({ ...r, progress: 0, hover: false }));
    this.anyHold = 0; // the hold-anywhere timer
    this.anyAt = null;
    this.moved = 0; // the light has to move a bit first, so a prop left resting can't start runs
    this.lastX = g.input.rawX;
    this.lastY = g.input.rawY;
    // the three lost dragons the next guest picks from. the storybook tells the first one's story
    fillLost(g);
    g.dragon = g.lost[0];
    this.flockVersion = -1;
    this.syncFlock(g);
    g.audio.section('attract');
    // only after a finished run. an idle reset means nobody made it home this time
    this.yoursT = 0;
    const rs = g.store.ribbons;
    if (data.reason === 'done' && rs.length) {
      const rib = rs[rs.length - 1];
      this.yoursT = DUR.YOURS_LABEL;
      this.yoursColor = RIBBON_COLORS[rib.h % RIBBON_COLORS.length];
      this.yoursPts = ribbonSkyPoints(rib, g.wall.top, g.wall.height);
      this.yoursAt = pickVisiblePoint(this.yoursPts);
    }
    this.book = new Storybook();
    this.stars = makeStars(7, 90, 150);
    this.starting = null;
    g.runStart = 0;
  }

  skip(g) {
    this.start(g, 'hatchling');
  }

  start(g, level = 'hatchling') {
    if (this.starting) return;
    this.starting = level;
    g.level = level;
    g.runStart = g.time;
    // the three flight routes take turns, so guests in a row each see a different one
    g.route = g.routePin ?? g.store.count % ROUTES.length;
    g.audio.cue('start');
    const row = this.rows.find((r) => r.id === level) ?? this.rows[0];
    g.particles.burst(row.ring.x, row.ring.y, 40, { speed: 90, colors: [PAL.gold, PAL.gold2, '#fff6d8'], kind: 'spark', size: 2, drag: 2, life: 1 }, g.rng);
    g.cam.shake(2);
    g.scenes.go('choose');
  }

  // where a scripted guest (or a test) should hold the light to pick a level
  levelTarget(id = 'hatchling') {
    const r = ROWS.find((row) => row.id === id) ?? ROWS[0];
    return { x: r.ring.x, y: r.ring.y };
  }
  target() {
    return this.levelTarget('hatchling');
  }

  // the flock is rebuilt whenever the store changes (a run finished, the operator cleared it)
  syncFlock(g) {
    if (this.flockVersion === g.store.version) return;
    this.flockVersion = g.store.version;
    const { near, far } = flockOf(g.store);
    this.flock = near.map((d, i) => member(d, i));
    this.far = far.map((d, i) => ({ d, a: i * 2.39996, r: 0.55 + ((i * 13) % 10) / 22, y: 4 + ((i * 17) % 12) }));
    this.chirpT = 3;
  }

  // tonight's flock loops slowly through the sky along the top of the screen. z: -1 behind, 1 in front
  slot(i, t) {
    const n = this.flock.length;
    const a = t * 0.16 + (i / Math.max(1, n)) * Math.PI * 2;
    return { x: 240 + Math.cos(a) * 226, y: 27 + Math.sin(a) * 11, z: Math.sin(a) };
  }

  visibleDragons() {
    return { near: this.flock.length, far: this.far.length, names: this.flock.map((m) => m.d.name), partyLeft: partyLeft(this.flock.length + this.far.length) };
  }

  update(g, dt) {
    this.syncFlock(g);
    this.yoursT = Math.max(0, this.yoursT - dt);
    // every few seconds somebody in the flock calls out
    this.chirpT -= dt;
    if (this.chirpT <= 0 && this.flock.length) {
      this.chirpT = 4 + g.rng() * 3;
      chirp(this.flock[Math.floor(g.rng() * this.flock.length)]);
    }
    this.flock.forEach((m, i) => {
      const p = this.slot(i, this.t);
      updateMember(g, m, dt, p.x, p.y, { scale: 0.3, flip: p.z > 0, quiet: true });
    });
    this.book.update(dt);
    if (!this.starting) this.updatePicker(g, dt);
  }

  // hover-and-hold on a level row starts that level. nobody can start until the operator has
  // started the station (the gate in main.js)
  updatePicker(g, dt) {
    const inp = g.input;
    // only real movement of the device counts as "someone raised the light": the raw position (the
    // smoothed light glides even when nothing moves), and not a jump (the light showing up for the
    // first time, a rig reconnecting), or a resting prop would start a run after a reload
    const step = Math.hypot(inp.rawX - this.lastX, inp.rawY - this.lastY);
    if (step < 40) this.moved += step;
    this.lastX = inp.rawX;
    this.lastY = inp.rawY;
    let onRow = null;
    for (const r of this.rows) {
      const inRect = inp.x >= r.x0 && inp.x <= r.x1 && inp.y >= r.y0 && inp.y <= r.y1;
      r.hover = !g.gate && inp.seen && (inRect || Math.hypot(inp.x - r.ring.x, inp.y - r.ring.y) < r.ring.r + 8);
      if (r.hover && !onRow) onRow = r;
      else r.hover = false;
      r.progress = dwell(r.progress, r.hover, dt, DUR.START_DWELL);
      if (r.progress >= 1) return this.start(g, r.id);
      if (r.hover && g.rng() < dt * 30) {
        const a = g.rng() * Math.PI * 2;
        g.particles.add({ x: r.ring.x + Math.cos(a) * r.ring.r, y: r.ring.y + Math.sin(a) * r.ring.r, vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 20, life: 0.6, color: r.progress > 0.5 ? PAL.gold2 : PAL.gold, kind: 'spark', size: 1 });
      }
    }
    // held still anywhere near the middle (not on a level) for a couple of seconds = hatchling
    const inMiddle = inp.x >= MIDDLE.x0 && inp.x <= MIDDLE.x1 && inp.y >= MIDDLE.y0 && inp.y <= MIDDLE.y1;
    const can = !g.gate && inp.seen && !onRow && inMiddle && this.moved > 30 && !g.soundBtn.contains(inp.x, inp.y);
    if (can && this.anyAt && Math.hypot(inp.x - this.anyAt.x, inp.y - this.anyAt.y) < 12) {
      this.anyHold += dt;
      if (this.anyHold >= HOLD_ANYWHERE) return this.start(g, 'hatchling');
    } else {
      this.anyAt = can ? { x: inp.x, y: inp.y } : null;
      this.anyHold = 0;
    }
  }

  draw(g, ctx) {
    const t = this.t;
    // the aurora wall is everyone's flight so far, so the line sees it fill up while they wait
    drawSky(ctx, SKY.aurora, 0, 210);
    drawStars(ctx, this.stars, t);
    drawBaseAurora(ctx, t, 0.9);
    g.wall.draw(ctx, t);
    // one bright star for every celebration so far tonight
    drawPartyStars(ctx, Math.floor(g.store.count / FLOCK.CELEBRATE_EVERY), t);
    // your ribbon glows a bit brighter than the rest while the label is up
    if (this.yoursT > 0) drawRibbon(ctx, this.yoursPts, this.yoursColor, 0.45 * clamp(this.yoursT / 1.5), t, 34);
    this.syncFlock(g);
    for (const f of this.far) {
      const a = f.a + t * 0.12;
      drawSpeck(ctx, 240 + Math.cos(a) * 230 * f.r, f.y + Math.sin(a * 2) * 3, f.d, t + f.a);
    }
    const drawers = this.flock.map((m, i) => {
      const p = this.slot(i, t);
      return { z: p.z, f: () => drawMember(ctx, m, p.x, p.y, { mood: 'joy', flap: t * 2.4 + i * 0.23, life: t, glow: 2, scale: 0.3 * (0.85 + 0.15 * (p.z + 1) / 2), flip: p.z > 0 }) };
    });
    drawers.sort((a, b) => a.z - b.z).forEach((d) => d.f());
    drawSea(ctx, 212, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    drawWind(ctx, t, g.beat, { lanes: [0.3, 0.72], alpha: 0.25, color: '#9fe8ff' });

    this.book.draw(ctx, g, this.flock);
    this.drawPicker(g, ctx, t);

    // tagline sits under the title at scale 2, it was scale 1 (under 2in tall on the big screen)
    drawText(ctx, 'EMBERWING', BOOK.x + 2, 5, { scale: 3, color: PAL.ember3 });
    drawText(ctx, 'THE WAY HOME', BOOK.x + 3, 30, { scale: 2, color: PAL.cream });

    this.drawTally(ctx, g.store.count, t);

    if (this.yoursT > 0) this.drawYours(ctx, t, g.beat.pulse);
    g.particles.draw(ctx);
    this.drawHoldAnywhere(ctx, g.input, t);
    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 1);
  }

  // the three levels, one row each: ring with the badge, name, hint, tonight's best
  drawPicker(g, ctx, t) {
    const pulse = g.beat.pulse;
    drawText(ctx, 'NEXT FLYER', COL, 4, { scale: 2, align: 'center', color: PAL.gold });
    drawFeet(ctx, COL - 52, 28);
    drawText(ctx, 'STEP HERE', COL - 30, 21, { scale: 2, color: PAL.cream });
    drawKnotBand(ctx, COL - 96, 42, 192);
    for (const r of this.rows) {
      const L = LEVELS[r.id];
      const lit = r.hover || this.starting === r.id;
      if (lit) {
        ctx.fillStyle = 'rgba(255,201,74,0.13)';
        ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      }
      const easy = r.id === 'hatchling';
      glow(ctx, r.ring.x, r.ring.y, 30 + (easy ? pulse * 6 : 0), PAL.gold, (easy ? 0.22 : 0.1) + r.progress * 0.4);
      ctx.fillStyle = 'rgba(8,10,24,0.75)';
      ctx.beginPath();
      ctx.arc(r.ring.x, r.ring.y, r.ring.r - 2, 0, Math.PI * 2);
      ctx.fill();
      drawKnotRing(ctx, r.ring.x, r.ring.y, r.ring.r, r.progress, { lobes: 7, amp: 2.5, width: 2, on: PAL.gold, off: lit ? 'rgba(255,226,138,0.7)' : 'rgba(255,226,138,0.42)' });
      drawLevelIcon(ctx, r.id, r.ring.x, r.ring.y, t);
      drawText(ctx, L.label, 316, r.top, { scale: 2, color: lit ? PAL.gold2 : PAL.gold });
      drawText(ctx, L.hint, 316, r.top + 17, { scale: 2, color: PAL.cream });
      const best = g.store.best[r.id];
      if (best) drawText(ctx, `${best.name} ${best.score}`, 316, r.top + 34, { scale: 2, color: '#bff8ee' });
      else drawText(ctx, L.fresh, 316, r.top + 34, { scale: 2, color: easy ? PAL.gold2 : 'rgba(191,248,238,0.6)', alpha: easy ? 0.75 + 0.25 * pulse : 1 });
    }
    const hover = this.rows.some((r) => r.hover);
    const cap = this.starting ? 'HERE WE GO!' : hover ? 'HOLD IT THERE' : 'RAISE YOUR LIGHT';
    drawText(ctx, cap, COL, 226, { scale: 2, align: 'center', color: hover ? PAL.gold2 : PAL.white, alpha: hover ? 1 : 0.75 + 0.25 * pulse });
    if (!hover && !this.starting) {
      const k = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - k;
      drawArrowUp(ctx, COL + 104, 236 - k * 12);
      ctx.globalAlpha = 1;
    }
  }

  // the ring that fills on the light itself when someone holds still away from the levels
  drawHoldAnywhere(ctx, inp, t) {
    if (this.anyHold < 0.3 || this.starting) return;
    const k = clamp((this.anyHold - 0.3) / (HOLD_ANYWHERE - 0.3));
    drawKnotRing(ctx, inp.x, inp.y, 16, k, { lobes: 6, amp: 2, width: 2, on: PAL.gold, off: 'rgba(255,226,138,0.4)' });
    drawText(ctx, 'HATCHLING', inp.x, inp.y + 22, { scale: 2, align: 'center', color: PAL.gold2, alpha: clamp(k * 3) });
  }

  // how many are home (always the same number as dragons in the sky) and how close the next
  // celebration is. under the book, clear of the sound button in the corner
  drawTally(ctx, n, t) {
    const cx = BOOK.x + BOOK.w / 2 + 12;
    const s = n === 0 ? 'NO DRAGONS HOME YET' : `${n} ${n === 1 ? 'DRAGON' : 'DRAGONS'} HOME`;
    drawText(ctx, s, cx, 201, { scale: 2, align: 'center', color: '#bff8ee' });
    const every = FLOCK.CELEBRATE_EVERY;
    const done = n % every;
    // one pip per dragon in this round, the next one to fill breathes
    const x0 = cx - ((every - 1) * 15) / 2;
    for (let i = 0; i < every; i++) {
      const on = i < done;
      const next = i === done;
      const r = next ? 4.5 + Math.sin(t * 4) * 0.7 : 4;
      if (on) glow(ctx, x0 + i * 15, 224, 9, PAL.gold, 0.6);
      drawKnotRing(ctx, x0 + i * 15, 224, r, on ? 1 : 0, { lobes: 3, amp: 1, width: 1, on: PAL.gold, off: next ? 'rgba(191,248,238,0.9)' : 'rgba(191,248,238,0.35)' });
    }
    drawText(ctx, `${partyLeft(n)} MORE TO THE`, cx, 234, { scale: 2, align: 'center', color: '#bff8ee' });
    drawText(ctx, 'NEXT CELEBRATION', cx, 250, { scale: 2, align: 'center', color: '#bff8ee' });
  }

  // the label lives in the open strip of sky between the title and NEXT FLYER (anywhere else it
  // landed on text or the book) and a dotted line of light leads to the ribbon itself
  drawYours(ctx, t, pulse) {
    const { x, y } = this.yoursAt;
    const a = clamp(this.yoursT / 1.5); // fades out over the last 1.5s
    const lx = YOURS.x;
    const ly = YOURS.y + 18;
    const d = Math.hypot(x - lx, y - ly);
    ctx.fillStyle = PAL.gold2;
    for (let s = (t * 30) % 5; s < d - 4; s += 5) {
      ctx.globalAlpha = a * 0.8;
      ctx.fillRect(Math.round(lx + ((x - lx) * s) / d), Math.round(ly + ((y - ly) * s) / d), 2, 2);
    }
    ctx.globalAlpha = 1;
    glow(ctx, x, y, 14 + pulse * 6, this.yoursColor, 0.8 * a);
    ctx.globalAlpha = a;
    drawSparkle(ctx, x, y, 3 + Math.round(pulse * 2), PAL.gold2);
    ctx.globalAlpha = 1;
    const bob = Math.round(Math.sin(t * 4) * 1.5);
    drawText(ctx, 'YOURS!', lx, YOURS.y + bob, { scale: 2, align: 'center', color: PAL.gold2, alpha: a });
  }
}

// the aurora is mostly hidden behind the storybook and the level picker. pick a bit of the
// ribbon you can see near the label: the strip of sky between the title and NEXT FLYER first
function pickVisiblePoint(pts) {
  const zones = [
    { x0: 176, x1: 290, y0: 26, y1: 46, aim: [YOURS.x, 40] },
    { x0: 176, x1: 470, y0: 0, y1: 46, aim: [YOURS.x, 30] },
  ];
  for (const z of zones) {
    let best = null;
    let bestD = Infinity;
    for (const [x, y] of pts) {
      if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) continue;
      const d = Math.hypot(x - z.aim[0], y - z.aim[1]);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    if (best) return best;
  }
  // nothing visible, point at whatever part is closest to the label
  let best = { x: pts[0][0], y: pts[0][1] };
  for (const [x, y] of pts) if (Math.hypot(x - YOURS.x, y - 40) < Math.hypot(best.x - YOURS.x, best.y - 40)) best = { x, y };
  return best;
}
