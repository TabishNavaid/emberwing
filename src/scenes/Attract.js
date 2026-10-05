import { VIEW, DUR, PAL, FLOCK, LEVELS, LEVEL_ORDER } from '../config.js';
import { makeCanvas, glow, clamp, ease, lerp } from '../core/util.js';
import { drawText } from '../art/font.js';
import { drawKnotRing, drawKnotFrame, drawKnotBand } from '../art/knotwork.js';
import { drawDragon, drawSpeck, eyeOffset } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { fillLost } from '../core/dragons.js';
import { ROUTES } from '../art/routes.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawLighthouse, drawStone, drawCloud, drawWind, drawFog } from '../art/world.js';
import { drawLantern, drawFeet, drawHorn, drawSoundLines, drawCursorLight, drawSparkle, drawArrowUp, drawLevelIcon } from '../art/icons.js';
import { drawBaseAurora, drawRibbon, ribbonSkyPoints, RIBBON_COLORS } from '../art/aurora.js';
import { drawTree } from '../art/sprites.js';

const { W, H } = VIEW;

// storybook on the left, the level picker on the right. picking a level is how a run starts
const BOOK = { x: 10, y: 48, w: 252, h: 140 };
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

const PAGES = [
  { id: 'storm', caption: 'A STORM...' },
  { id: 'lost', caption: null }, // "PIP IS LOST", set per dragon
  { id: 'demo', caption: '' }, // sets its own caption as it goes
  { id: 'home', caption: null }, // "GUIDE PIP HOME"
  { id: 'music', caption: 'HEAR IT IN ACT II' },
];

// how many more dragons until the next celebration
export const partyLeft = (n) => FLOCK.CELEBRATE_EVERY - (n % FLOCK.CELEBRATE_EVERY);

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
    this.page = 0;
    this.pageT = 0;
    this.flip = 1; // page turn, 0..1
    [this.pageCanvas, this.pg] = makeCanvas(BOOK.w, BOOK.h);
    [this.prevCanvas, this.ppg] = makeCanvas(BOOK.w, BOOK.h);
    this.stars = makeStars(7, 90, 150);
    this.pageStars = makeStars(3, 30, 110);
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

  pageDuration() {
    return PAGES[this.page].id === 'demo' ? DUR.ATTRACT_DEMO_PAGE : DUR.ATTRACT_PAGE;
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
    this.pageT += dt;
    this.flip = Math.min(1, this.flip + dt / 0.55);
    if (this.pageT > this.pageDuration()) {
      this.ppg.clearRect(0, 0, BOOK.w, BOOK.h);
      this.ppg.drawImage(this.pageCanvas, 0, 0);
      this.page = (this.page + 1) % PAGES.length;
      this.pageT = 0;
      this.flip = 0;
    }
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
      // drains a bit faster than it fills so brushing past doesn't start anything
      r.progress = clamp(r.progress + (r.hover ? 1 : -1.5) * (dt / DUR.START_DWELL));
      if (r.progress >= 1) return this.start(g, r.id);
      if (r.hover && g.rng() < dt * 30) {
        const a = g.rng() * Math.PI * 2;
        g.particles.add({ x: r.ring.x + Math.cos(a) * r.ring.r, y: r.ring.y + Math.sin(a) * r.ring.r, vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 20, life: 0.6, color: r.progress > 0.5 ? PAL.gold2 : PAL.gold, kind: 'spark', size: 1 });
      }
    }
    // held still anywhere near the middle (not on a level) for a couple of seconds = hatchling
    const inMiddle = inp.x >= MIDDLE.x0 && inp.x <= MIDDLE.x1 && inp.y >= MIDDLE.y0 && inp.y <= MIDDLE.y1;
    const can = !g.gate && inp.seen && !onRow && inMiddle && this.moved > 30 && !g.soundBtn?.contains(inp.x, inp.y);
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

    this.drawBook(g, ctx, t);
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
    drawFeet(ctx, COL - 52, 28, 2, PAL.cream);
    drawText(ctx, 'STEP HERE', COL - 30, 21, { scale: 2, color: PAL.cream });
    drawKnotBand(ctx, COL - 96, 42, 192, { color: PAL.gold, period: 10, amp: 2 });
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
      const best = g.store.best?.[r.id];
      if (best) drawText(ctx, `${best.name} ${best.score}`, 316, r.top + 34, { scale: 2, color: '#bff8ee' });
      else drawText(ctx, L.fresh, 316, r.top + 34, { scale: 2, color: easy ? PAL.gold2 : 'rgba(191,248,238,0.6)', alpha: easy ? 0.75 + 0.25 * pulse : 1 });
    }
    const hover = this.rows.some((r) => r.hover);
    const cap = this.starting ? 'HERE WE GO!' : hover ? 'HOLD IT THERE' : 'RAISE YOUR LIGHT';
    drawText(ctx, cap, COL, 226, { scale: 2, align: 'center', color: hover ? PAL.gold2 : PAL.white, alpha: hover ? 1 : 0.75 + 0.25 * pulse });
    if (!hover && !this.starting) {
      const k = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - k;
      drawArrowUp(ctx, COL + 104, 236 - k * 12, 1, PAL.cream);
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

  drawBook(g, ctx, t) {
    const pg = this.pg;
    pg.clearRect(0, 0, BOOK.w, BOOK.h);
    const id = PAGES[this.page].id;
    const caption = this[`page_${id}`](pg, this.pageT, g, g.dragon) ?? PAGES[this.page].caption;
    if (caption) {
      pg.fillStyle = 'rgba(5,7,13,0.55)';
      pg.fillRect(0, BOOK.h - 24, BOOK.w, 24);
      drawText(pg, caption, BOOK.w / 2, BOOK.h - 19, { scale: 2, align: 'center', color: PAL.cream });
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(BOOK.x + 4, BOOK.y + 5, BOOK.w, BOOK.h);
    ctx.drawImage(this.pageCanvas, BOOK.x, BOOK.y);
    // page turn = old page squashes toward the spine over the new one
    if (this.flip < 1) {
      const k = ease.inOutSine(this.flip);
      const w = Math.round(BOOK.w * (1 - k));
      if (w > 0) {
        ctx.drawImage(this.prevCanvas, 0, 0, BOOK.w, BOOK.h, BOOK.x, BOOK.y, w, BOOK.h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(BOOK.x + w, BOOK.y, Math.min(10, BOOK.w - w), BOOK.h);
        ctx.fillStyle = '#fff3d6';
        ctx.fillRect(BOOK.x + w - 1, BOOK.y, 1, BOOK.h);
      }
    }
    drawKnotFrame(ctx, BOOK.x, BOOK.y, BOOK.w, BOOK.h, { color: PAL.gold });
    for (let i = 0; i < PAGES.length; i++) {
      ctx.fillStyle = i === this.page ? PAL.gold : 'rgba(255,243,214,0.35)';
      ctx.fillRect(BOOK.x + BOOK.w / 2 - PAGES.length * 5 + i * 10, BOOK.y + BOOK.h + 5, i === this.page ? 6 : 4, i === this.page ? 6 : 4);
    }
  }

  page_storm(pg, t, g, d) {
    drawSky(pg, SKY.storm, 0, BOOK.h);
    drawSea(pg, 116, t, { c1: '#10202e', c2: '#1d3445', foam: '#8fb0c0' });
    for (let i = 0; i < 3; i++) drawCloud(pg, ((t * 18 + i * 110) % 330) - 40, 28 + i * 9, 90, '#2a3a52', 11 + i, 0.9);
    for (let x = 0; x < 110; x++) {
      const top = Math.round(110 + Math.pow(Math.max(0, x - 58) / 52, 2) * 26 + Math.sin(x * 0.3) * 1.2);
      pg.fillStyle = PAL.rock;
      pg.fillRect(x, top, 1, BOOK.h - top);
      pg.fillStyle = PAL.rock2;
      pg.fillRect(x, top, 1, 5);
      pg.fillStyle = PAL.grass;
      pg.fillRect(x, top - 1, 1, 2);
    }
    const lamp = drawLighthouse(pg, 36, 110, t);
    pg.globalCompositeOperation = 'lighter';
    pg.fillStyle = 'rgba(255,220,140,0.12)';
    const a = Math.sin(t * 0.9) * 0.5 - 0.1;
    pg.beginPath();
    pg.moveTo(lamp.lx, lamp.ly);
    pg.lineTo(lamp.lx + Math.cos(a - 0.12) * 260, lamp.ly + Math.sin(a - 0.12) * 260);
    pg.lineTo(lamp.lx + Math.cos(a + 0.12) * 260, lamp.ly + Math.sin(a + 0.12) * 260);
    pg.fill();
    pg.globalCompositeOperation = 'source-over';
    pg.fillStyle = 'rgba(180,210,240,0.5)';
    for (let i = 0; i < 70; i++) {
      const x = (i * 37 + t * 60) % BOOK.w;
      const y = (i * 53 + t * 190) % BOOK.h;
      pg.fillRect(Math.round(x), Math.round(y), 1, 4);
    }
    const ex = 150 + Math.sin(t * 1.3) * 30 + t * 8;
    const ey = 54 + Math.sin(t * 2.1) * 12;
    drawDragon(pg, ex, ey, d, { mood: 'scared', flap: t * 3, glow: 0, rot: Math.sin(t * 2.5) * 0.6, scale: 0.8 });
  }

  // all three lost dragons, huddled in the storm, waiting for someone to pick them
  page_lost(pg, t, g, d) {
    drawSky(pg, SKY.storm, 0, BOOK.h);
    drawStars(pg, this.pageStars, t, 0.4);
    pg.fillStyle = '#16202e';
    pg.fillRect(0, 100, BOOK.w, 60);
    pg.fillStyle = PAL.rock2;
    for (let x = 0; x < BOOK.w; x++) pg.fillRect(x, 100 + Math.round(Math.sin(x * 0.07) * 3), 1, 3);
    drawStone(pg, 60, 104, 34, 12, 2, 0);
    drawStone(pg, 205, 106, 26, 10, 4, 0);
    drawTree(pg, 'bare', 30, 104, '#0e1622');
    const shake = Math.sin(t * 30) * 0.6;
    (g.lost.length ? g.lost : [d]).forEach((dd, i) => {
      drawDragon(pg, 92 + i * 56 + (i === 1 ? shake : 0), 101 - 11 * dd.size, dd, { mood: 'scared', wing: 'folded', glow: 0, life: t + i, look: i === 2 ? 1 : -1, scale: 0.8 });
    });
    const lx = lerp(-10, 60, ease.outCubic(clamp(t / 3.5)));
    glow(pg, lx, 66, 40, PAL.gold, 0.35);
    drawLantern(pg, lx, 64, 1, 1, t);
    pg.fillStyle = 'rgba(92,114,140,0.25)';
    for (let i = 0; i < 4; i++) pg.fillRect(0, 80 + i * 16 + Math.round(Math.sin(t + i) * 3), BOOK.w, 6);
    return 'WHO WILL YOU FIND?';
  }

  page_demo(pg, t, g, d) {
    // ghost player so the next person in line already knows what to do
    const FIND = 2.8;
    const eyes = { x: 0, y: 0 };
    drawSky(pg, t < FIND ? SKY.storm : SKY.dusk, 0, BOOK.h);
    let ghost;
    if (t < FIND) {
      pg.fillStyle = PAL.rock;
      for (let x = 0; x < BOOK.w; x++) pg.fillRect(x, 106 + Math.round(Math.sin(x * 0.05) * 5 + Math.sin(x * 0.17) * 2), 1, 50);
      drawStone(pg, 60, 110, 30, 11, 1, 0);
      const ex = 170, ey = 100;
      const eo = eyeOffset(d, 0.85);
      eyes.x = ex + eo.x;
      eyes.y = ey + eo.y;
      drawDragon(pg, ex, ey, d, { mood: t > 1.8 ? 'curious' : 'scared', wing: 'folded', glow: 0, look: -1, scale: 0.85, life: t });
      const k = ease.inOutSine(clamp(t / 1.3));
      ghost = { x: lerp(30, eyes.x, k) + Math.sin(t * 5) * 18 * (1 - k), y: lerp(40, eyes.y, k) };
      // same dark fog + warm beam as the real scene so the demo looks like the game
      glow(pg, ghost.x, ghost.y, 44, PAL.gold, 0.45);
      drawFog(pg, BOOK.w, BOOK.h, t, [{ x: ghost.x, y: ghost.y, r: 42 }], { alpha: 0.93 });
      glow(pg, eyes.x, eyes.y, 9, PAL.gold, 0.8);
      const fill = clamp((t - 1.4) / 1.2);
      if (fill > 0) drawKnotRing(pg, ex, ey - 4, 30, fill, { lobes: 8, amp: 2.5, on: PAL.gold });
    } else {
      const ft = t - FIND;
      drawSea(pg, 116, t, { c1: '#2a3a60', c2: '#4a5a8a', foam: '#ffd0a0' });
      for (let i = 0; i < 4; i++) {
        const rx = 260 + i * 70 - ft * 70;
        const ry = 66 + Math.sin(i * 1.7) * 24;
        if (rx < -30 || rx > 280) continue;
        const passed = rx < 96;
        if (!passed) drawKnotRing(pg, rx, ry, 14 + i * 2, 1, { lobes: 6, amp: 2, width: 1, on: i > 1 ? PAL.gold : '#bff8ee' });
        else if (rx > 60) {
          for (let s = 0; s < 6; s++) drawSparkle(pg, rx + Math.cos(s) * (96 - rx) * 0.6, ry + Math.sin(s * 2) * (96 - rx) * 0.4, 2, PAL.gold2);
        }
      }
      const nextY = 66 + Math.sin(Math.floor((ft * 70 - 164 + 70) / 70) * 1.7) * 24;
      ghost = { x: 130, y: lerp(66, nextY, 0.8) + Math.sin(ft * 2) * 6 };
      this.demoY = this.demoY === undefined ? ghost.y : lerp(this.demoY, ghost.y, 0.08);
      pg.fillStyle = 'rgba(255,201,74,0.5)';
      for (let i = 1; i < 18; i++) pg.fillRect(96 - i * 4, Math.round(this.demoY + Math.sin(ft * 3 - i * 0.4) * 3), 3, 1);
      drawDragon(pg, 96, this.demoY, d, { mood: 'fly', flap: ft * 3, life: ft, glow: 2, scale: 0.9 });
    }
    if (t < 0.2) this.demoY = undefined;
    pg.globalAlpha = 0.85;
    drawLantern(pg, ghost.x, ghost.y, 1, 0.8, t);
    pg.globalAlpha = 1;
    drawText(pg, 'YOU', ghost.x, ghost.y - 28, { scale: 2, align: 'center', color: PAL.gold2 });
    return t < FIND ? `FIND ${d.name}` : 'FLY HOME!';
  }

  page_home(pg, t, g, d) {
    drawSky(pg, SKY.aurora, 0, BOOK.h);
    drawStars(pg, this.pageStars, t);
    drawBaseAurora(pg, t * 1.5, 1.2, 6);
    drawSea(pg, 116, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    // the last few who made it home tonight wait for this one (nobody, for the first guest)
    const waiting = this.flock.slice(-4);
    waiting.forEach((m, i) => {
      const a = t * 0.7 + (i / waiting.length) * Math.PI * 2;
      const x = 125 + Math.cos(a) * 92;
      const y = 64 + Math.sin(a) * 24;
      drawDragon(pg, x, y, m.d, { mood: 'joy', flap: t * 2.5 + i * 0.3, life: t, glow: 2, scale: 0.7, flip: Math.sin(a) > 0 });
    });
    drawDragon(pg, 125, 78 + Math.sin(t * 3) * 3, d, { mood: 'happy', flap: t * 2.5, glow: 2 });
    return `GUIDE ${d.name} HOME`;
  }

  page_music(pg, t, g) {
    pg.fillStyle = '#1a1430';
    pg.fillRect(0, 0, BOOK.w, BOOK.h);
    // the full credit lives here, the end card only has room for the act II line
    glow(pg, BOOK.w / 2, 24, 70, PAL.gold, 0.25 + g.beat.pulse * 0.1);
    drawHorn(pg, BOOK.w / 2 - 6, 22, 3);
    drawSoundLines(pg, BOOK.w / 2 + 30, 22, 2, t);
    drawText(pg, 'HOW TO TRAIN', BOOK.w / 2, 42, { scale: 2, align: 'center', color: PAL.gold });
    drawText(pg, 'YOUR DRAGON', BOOK.w / 2, 58, { scale: 2, align: 'center', color: PAL.gold });
    drawText(pg, 'WALLA WALLA SYMPHONY', BOOK.w / 2, 78, { scale: 2, align: 'center', color: PAL.cream });
    drawText(pg, 'YOUTH ORCHESTRA', BOOK.w / 2, 94, { scale: 2, align: 'center', color: PAL.cream });
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
