// the attract screen: tonight's flock and aurora, the storybook, and the level picker. holding the
// light on a level is how a run starts
import { DUR, INPUT, PAL, FLOCK, LEVELS, LEVEL_ORDER, TEXT, QR } from '../config.js';
import { glow, clamp, dwell, makeCanvas } from '../core/util.js';
import { makeQR } from '../core/qr.js';
import { drawText, textWidth, logShape } from '../art/font.js';
import { drawKnotRing } from '../art/knotwork.js';
import { drawSpeck } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { fillLost } from '../core/dragons.js';
import { ROUTES } from '../art/routes.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawWind } from '../art/world.js';
import { drawFeet, drawCursorLight, drawSparkle, drawLevelIcon } from '../art/icons.js';
import { drawBaseAurora, drawRibbon, ribbonSkyPoints, RIBBON_COLORS, drawCelebrationStars } from '../art/aurora.js';
import { Storybook, BOOK } from '../art/storybook.js';

// the level picker is the right column (the storybook on the left is art/storybook.js). the levels
// are the one thing to do here, so they get the biggest words on the screen and everything else
// is small and dim
const ROW_H = 58;
const NAME_X = 288;
// each row is a big target for the prop: the ring, the name and the line under it all count.
// holding the light anywhere else does nothing
const ROWS = LEVEL_ORDER.map((id, i) => {
  const top = 58 + i * ROW_H;
  return { id, top, ring: { x: 255, y: top + 16, r: 16 }, x0: 236, x1: 479, y0: top - 6, y1: top + ROW_H - 6 };
});
const YOURS = { x: 400, y: 6 }; // the open sky in the top right corner
const DIM = 'rgba(255,243,214,0.7)';

// how many more dragons until the next celebration
const untilCelebration = (n) => FLOCK.CELEBRATE_EVERY - (n % FLOCK.CELEBRATE_EVERY);

export class Attract {
  interactive = false;

  enter(g, data = {}) {
    // armed: the light has been seen properly off this level since the handoff, so landing on it
    // now is someone choosing it, not a prop left resting there
    this.rows = ROWS.map((r) => ({ ...r, progress: 0, hover: false, armed: false }));
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

  // true for the first DUR.HANDOFF seconds, while nothing can start (see updatePicker)
  inHandoff() {
    return this.t < DUR.HANDOFF;
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
    return { near: this.flock.length, far: this.far.length, names: this.flock.map((m) => m.d.name), untilCelebration: untilCelebration(this.flock.length + this.far.length) };
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
    // on a phone a tap on a level picks it straight away (one guest per phone, no handoff)
    const tap = inp.tap;
    if (tap && !g.gate) {
      const r = this.rows.find((row) => this.onRow(row, tap.x, tap.y));
      if (r) return this.start(g, r.id);
    }
    // the handoff between guests: for a moment nothing counts, then a level only fills once the
    // light has come onto it from somewhere else. a prop left resting on a level never starts it,
    // and neither does a light that shows up already on one (the rig reconnecting)
    const handoff = this.inHandoff();
    let onRow = null;
    for (const r of this.rows) {
      if (!inp.seen) r.armed = false;
      else if (!handoff && !this.onRow(r, inp.x, inp.y, INPUT.START_ARM_PX)) r.armed = true;
      r.hover = !g.gate && !handoff && r.armed && inp.seen && !onRow && this.onRow(r, inp.x, inp.y);
      if (r.hover) onRow = r;
      r.progress = dwell(r.progress, r.hover, dt, DUR.START_DWELL, DUR.START_CANCEL);
      if (r.progress >= 1) return this.start(g, r.id);
      if (r.hover && g.rng() < dt * 30) {
        const a = g.rng() * Math.PI * 2;
        g.particles.add({ x: r.ring.x + Math.cos(a) * r.ring.r, y: r.ring.y + Math.sin(a) * r.ring.r, vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 20, life: 0.6, color: r.progress > 0.5 ? PAL.gold2 : PAL.gold, kind: 'spark', size: 1 });
      }
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
    drawCelebrationStars(ctx, Math.floor(g.store.count / FLOCK.CELEBRATE_EVERY), t);
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
    // the name is a logo up in the corner, not something to read first
    drawText(ctx, 'EMBERWING', BOOK.x + 1, 3, { scale: TEXT.S, color: PAL.ember3 });

    this.drawTally(ctx, g.store.count, t);
    if (g.op.qr && !g.touch) this.drawQR(ctx);

    if (this.yoursT > 0) this.drawYours(ctx, t, g.beat.pulse);
    g.particles.draw(ctx);
    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 1);
  }

  // one prompt at the top, then the three levels: ring with the badge, the name, one short line.
  // tonight's best score only shows once there is one, small under the badge
  drawPicker(g, ctx, t) {
    const pulse = g.beat.pulse;
    const hover = this.rows.some((r) => r.hover);
    // phones have no line to stand in and no light to raise, so they just get told to tap
    let cap = g.touch ? 'TAP ONE' : 'RAISE YOUR LIGHT';
    if (this.starting) cap = 'HERE WE GO!';
    else if (hover && !g.touch) cap = 'HOLD IT THERE';
    if (!g.touch) {
      drawFeet(ctx, 250, 37);
      logShape('feet', 236, 25, 28, 28);
    }
    drawText(ctx, cap, g.touch ? 244 : 268, 31, { scale: TEXT.S, color: hover || this.starting ? PAL.gold2 : PAL.cream, alpha: hover ? 1 : 0.8 + 0.2 * pulse });
    for (const r of this.rows) {
      const L = LEVELS[r.id];
      const lit = r.hover || this.starting === r.id;
      if (lit) {
        ctx.fillStyle = 'rgba(255,201,74,0.13)';
        ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      }
      // the hold shows on the row being held, not just its ring: a glow sweeps across it as it
      // fills, so it reads from the back of the line. it runs back quickly if the light slides off
      if (r.progress > 0) {
        ctx.fillStyle = 'rgba(255,201,74,0.2)';
        ctx.fillRect(r.x0, r.y0, Math.round((r.x1 - r.x0) * r.progress), r.y1 - r.y0);
      }
      const easy = r.id === 'hatchling';
      glow(ctx, r.ring.x, r.ring.y, 30 + (easy ? pulse * 6 : 0), PAL.gold, (easy ? 0.25 : 0.12) + r.progress * 0.4);
      ctx.fillStyle = 'rgba(8,10,24,0.75)';
      ctx.beginPath();
      ctx.arc(r.ring.x, r.ring.y, r.ring.r - 2, 0, Math.PI * 2);
      ctx.fill();
      drawKnotRing(ctx, r.ring.x, r.ring.y, r.ring.r, r.progress, { lobes: 7, amp: 2.5, width: 2, on: PAL.gold, off: lit ? 'rgba(255,226,138,0.75)' : 'rgba(255,226,138,0.5)' });
      logShape(`ring ${r.id}`, r.ring.x - r.ring.r - 3, r.ring.y - r.ring.r - 3, r.ring.r * 2 + 6, r.ring.r * 2 + 6);
      drawLevelIcon(ctx, r.id, r.ring.x, r.ring.y, t);
      drawText(ctx, L.label, NAME_X, r.top + 3, { scale: TEXT.M, color: lit ? PAL.gold2 : PAL.gold });
      // hatchling's line is a small tag that says start here, the others say what's different
      if (easy) drawText(ctx, L.hint, NAME_X, r.top + 29, { scale: TEXT.S, color: PAL.gold2, alpha: 0.75 + 0.25 * pulse });
      else drawText(ctx, L.hint, NAME_X, r.top + 29, { scale: TEXT.S, color: DIM });
      // tonight's best sits under the ring, clear of the next row's ring, and nudged right if a
      // long one would reach the book
      const best = g.store.best[r.id];
      if (best) {
        const str = String(best.score);
        const x = Math.max(r.ring.x, BOOK.x + BOOK.w + 7 + Math.ceil(textWidth(str, TEXT.S) / 2));
        drawText(ctx, str, x, r.top + 37, { scale: TEXT.S, align: 'center', color: DIM });
      }
    }
  }

  // on the level's row, or within `near` px of it
  onRow(r, x, y, near = 0) {
    return (x >= r.x0 - near && x <= r.x1 + near && y >= r.y0 - near && y <= r.y1 + near) || Math.hypot(x - r.ring.x, y - r.ring.y) < r.ring.r + 8 + near;
  }

  // one quiet line under the book: a pip per dragon in this round of 8 (a full round = a
  // celebration) and how far along it is. the dragons in the sky already show how many are home.
  // laid out from the real sizes, the pips and BE THE FIRST used to run into each other
  drawTally(ctx, n, t) {
    const every = FLOCK.CELEBRATE_EVERY;
    const done = n % every;
    const label = n === 0 ? 'BE THE FIRST' : `${done} / ${every}`;
    const gap = 9; // pip to pip
    const pad = 6; // a pip's ring at its biggest (the next one pulses), from its middle
    const pipsW = (every - 1) * gap + pad * 2;
    const space = 8; // between the last pip and the label
    const w = pipsW + space + textWidth(label, TEXT.S);
    const x0 = Math.round(BOOK.x + BOOK.w / 2 - w / 2);
    const y = BOOK.y + BOOK.h + 22;
    for (let i = 0; i < every; i++) {
      const on = i < done;
      const next = i === done;
      const r = next ? 4 + Math.sin(t * 4) * 0.6 : 3.5;
      const x = x0 + pad + i * gap;
      if (on) glow(ctx, x, y, 8, PAL.gold, 0.5);
      drawKnotRing(ctx, x, y, r, on ? 1 : 0, { lobes: 3, amp: 1, width: 1, on: PAL.gold, off: next ? 'rgba(191,248,238,0.8)' : 'rgba(191,248,238,0.3)' });
    }
    logShape('pips', x0, y - pad, pipsW, pad * 2);
    drawText(ctx, label, x0 + pipsW + space, y - 7, { scale: TEXT.S, color: DIM });
  }

  // the operator's Q key: a code for the live site under the tally, dark squares on a light card
  // with a quiet border so phone cameras pick it up
  drawQR(ctx) {
    if (!this.qrCanvas) {
      const m = makeQR(QR.URL);
      const s = QR.MODULE;
      const n = m.length + 6;
      const [c, q] = makeCanvas(n * s, n * s);
      q.fillStyle = PAL.cream;
      q.fillRect(0, 0, n * s, n * s);
      q.fillStyle = '#05070d';
      m.forEach((row, r) => row.forEach((on, col) => on && q.fillRect((col + 3) * s, (r + 3) * s, s, s)));
      this.qrCanvas = c;
    }
    const c = this.qrCanvas;
    const x = 40;
    const y = 268 - c.height;
    ctx.drawImage(c, x, y);
    logShape('qr', x, y, c.width, c.height);
    drawText(ctx, 'PLAY ON', x + c.width + 8, y + c.height / 2 - 17, { scale: TEXT.S, color: DIM });
    drawText(ctx, 'YOUR PHONE', x + c.width + 8, y + c.height / 2 + 1, { scale: TEXT.S, color: DIM });
  }

  // the label lives in the open sky in the top right corner (anywhere else it landed on text or
  // the book) and a dotted line of light leads to the ribbon itself
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
    drawText(ctx, 'YOURS!', lx, YOURS.y + bob, { scale: TEXT.S, align: 'center', color: PAL.gold2, alpha: a });
  }
}

// the aurora is mostly hidden behind the storybook and the level picker. pick a bit of the
// ribbon you can see near the label: the open sky across the top first
function pickVisiblePoint(pts) {
  const zones = [
    { x0: 236, x1: 470, y0: 10, y1: 26, aim: [YOURS.x, 20] },
    { x0: 130, x1: 470, y0: 0, y1: 26, aim: [YOURS.x, 16] },
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
  for (const [x, y] of pts) if (Math.hypot(x - YOURS.x, y - 20) < Math.hypot(best.x - YOURS.x, best.y - 20)) best = { x, y };
  return best;
}
