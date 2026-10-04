import { VIEW, DUR, PAL, FLOCK } from '../config.js';
import { makeCanvas, glow, clamp, ease, lerp } from '../core/util.js';
import { Dwell } from '../input/Dwell.js';
import { drawText } from '../art/font.js';
import { drawKnotRing, drawKnotFrame, drawKnotBand } from '../art/knotwork.js';
import { drawDragon, drawSpeck, eyeOffset } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { nextLostDragon } from '../core/dragons.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawLighthouse, drawStone, drawCloud, drawWind, drawFog } from '../art/world.js';
import { drawLantern, drawFeet, drawHorn, drawSoundLines, drawCursorLight, drawSparkle, drawArrowUp } from '../art/icons.js';
import { drawBaseAurora, drawRibbon, ribbonSkyPoints, RIBBON_COLORS } from '../art/aurora.js';
import { drawTree } from '../art/sprites.js';

const { W, H } = VIEW;

// storybook on the left, "next flyer" panel on the right
const BOOK = { x: 14, y: 54, w: 252, h: 172 };
const PANEL_X = 372;
const LANTERN = { x: PANEL_X, y: 152, r: 34 };
const YOURS = { x: 242, y: 10 }; // the free strip of sky between the title and NEXT FLYER
const CIRCLE = { x: PANEL_X, y: 92 }; // tonight's flock circles between STEP HERE and the lantern

const PAGES = [
  { id: 'storm', caption: 'A STORM...' },
  { id: 'lost', caption: null }, // "PIP IS LOST", set per dragon
  { id: 'demo', caption: '' }, // sets its own caption as it goes
  { id: 'home', caption: null }, // "GUIDE PIP HOME"
  { id: 'music', caption: 'HEAR IT IN ACT II' },
];

export class Attract {
  interactive = false;

  enter(g, data = {}) {
    this.dwell = new Dwell(LANTERN.x, LANTERN.y, LANTERN.r + 6, DUR.START_DWELL);
    // the next guest's dragon. it stays the same one until somebody actually gets it home
    if (!g.dragon || g.dragon.home) g.dragon = nextLostDragon(g);
    this.flockVersion = -1;
    this.syncFlock(g);
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
    this.pageStars = makeStars(3, 30, 120);
    this.starting = false;
    g.runStart = 0;
  }

  skip(g) {
    this.start(g);
  }

  start(g) {
    if (this.starting) return;
    this.starting = true;
    g.runStart = g.time;
    g.audio.cue('start');
    g.particles.burst(LANTERN.x, LANTERN.y, 40, { speed: 90, colors: [PAL.gold, PAL.gold2, '#fff6d8'], kind: 'spark', size: 2, drag: 2, life: 1 }, g.rng);
    g.cam.shake(2);
    g.scenes.go('find', {}, { title: `${g.dragon.name} IS LOST!` });
  }

  pageDuration() {
    return PAGES[this.page].id === 'demo' ? DUR.ATTRACT_DEMO_PAGE : DUR.ATTRACT_PAGE;
  }

  // the circle is rebuilt whenever the store changes (a run finished, the operator cleared it)
  syncFlock(g) {
    if (this.flockVersion === g.store.version) return;
    this.flockVersion = g.store.version;
    const { near, far } = flockOf(g.store);
    this.flock = near.map((d, i) => member(d, i));
    this.far = far.map((d, i) => ({ d, a: i * 2.39996, r: 0.4 + ((i * 13) % 10) / 16, y: 6 + ((i * 17) % 30) }));
    this.chirpT = 3;
  }

  // where member i is on the circle. z: -1 behind, 1 in front
  slot(i, t) {
    const n = this.flock.length;
    const a = t * 0.45 + (i / Math.max(1, n)) * Math.PI * 2;
    const rx = lerp(50, 92, clamp((n - 3) / 9));
    return { x: CIRCLE.x + Math.cos(a) * rx, y: CIRCLE.y + Math.sin(a) * 12, z: Math.sin(a) };
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
      updateMember(g, m, dt, p.x, p.y, { scale: 0.36, flip: p.z > 0 });
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
    if (!this.starting && this.dwell.update(g.input, dt)) this.start(g);
    if (this.dwell.hover && !this.starting && g.rng() < dt * 30) {
      const a = g.rng() * Math.PI * 2;
      const p = this.dwell.progress;
      g.particles.add({ x: LANTERN.x + Math.cos(a) * LANTERN.r, y: LANTERN.y + Math.sin(a) * LANTERN.r, vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 20, life: 0.6, color: p > 0.5 ? PAL.gold2 : PAL.gold, kind: 'spark', size: 1 });
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
      const a = f.a + t * 0.18;
      drawSpeck(ctx, 330 + Math.cos(a) * 140 * f.r, 60 + f.y + Math.sin(a * 2) * 4, f.d, t + f.a);
    }
    const drawers = this.flock.map((m, i) => {
      const p = this.slot(i, t);
      return { z: p.z, f: () => drawMember(ctx, m, p.x, p.y, { mood: 'joy', flap: t * 2.4 + i * 0.23, life: t, glow: 2, scale: 0.36 * (0.85 + 0.15 * (p.z + 1) / 2), flip: p.z > 0 }) };
    });
    drawers.sort((a, b) => a.z - b.z).forEach((d) => d.f());
    drawSea(ctx, 212, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    drawWind(ctx, t, g.beat, { lanes: [0.3, 0.72], alpha: 0.25, color: '#9fe8ff' });

    this.drawBook(g, ctx, t);
    this.drawPanel(g, ctx, t);

    // tagline sits under the title at scale 2, it was scale 1 (under 2in tall on the big screen)
    drawText(ctx, 'EMBERWING', BOOK.x + 2, 6, { scale: 3, color: PAL.ember3 });
    drawText(ctx, 'THE WAY HOME', BOOK.x + 3, 31, { scale: 2, color: PAL.cream });

    this.drawTally(ctx, g.store.count, t);

    if (this.yoursT > 0) this.drawYours(ctx, t, g.beat.pulse);
    g.particles.draw(ctx);
    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 1);
  }

  // how many are home (always the same number as dragons in the circle) and how close the next
  // celebration is. the line reads this while they wait
  drawTally(ctx, n, t) {
    const s = n === 0 ? 'NO DRAGONS HOME YET' : `${n} ${n === 1 ? 'DRAGON' : 'DRAGONS'} HOME TONIGHT`;
    drawText(ctx, s, BOOK.x + BOOK.w / 2, 246, { scale: 2, align: 'center', color: '#bff8ee' });
    const every = FLOCK.CELEBRATE_EVERY;
    const done = n % every;
    const left = partyLeft(n);
    drawText(ctx, `${left} MORE TO THE`, PANEL_X, 223, { scale: 2, align: 'center', color: '#bff8ee' });
    drawText(ctx, 'NEXT CELEBRATION', PANEL_X, 239, { scale: 2, align: 'center', color: '#bff8ee' });
    // one pip per dragon in this round, the next one to fill breathes
    const x0 = PANEL_X - ((every - 1) * 15) / 2;
    for (let i = 0; i < every; i++) {
      const on = i < done;
      const next = i === done;
      const r = next ? 4.5 + Math.sin(t * 4) * 0.7 : 4;
      if (on) glow(ctx, x0 + i * 15, 260, 9, PAL.gold, 0.6);
      drawKnotRing(ctx, x0 + i * 15, 260, r, on ? 1 : 0, { lobes: 3, amp: 1, width: 1, on: PAL.gold, off: next ? 'rgba(191,248,238,0.9)' : 'rgba(191,248,238,0.35)' });
    }
  }

  // the label lives in the open strip of sky between the title and NEXT FLYER (anywhere else it
  // landed on STEP HERE or the book) and a dotted line of light leads to the ribbon itself
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

  drawPanel(g, ctx, t) {
    const pulse = g.beat.pulse;
    drawText(ctx, 'NEXT FLYER', PANEL_X, 12, { scale: 2, align: 'center', color: PAL.gold });
    drawKnotBand(ctx, PANEL_X - 62, 34, 124, { color: PAL.gold, period: 10, amp: 2 });

    drawFeet(ctx, PANEL_X - 64, 62, 2, PAL.cream);
    drawText(ctx, 'STEP HERE', PANEL_X - 42, 55, { scale: 2, color: PAL.cream });

    const p = this.dwell.progress;
    const hover = this.dwell.hover;
    const bob = Math.sin(t * 2.2) * 2 * (1 - p);
    const sc = 1 + pulse * 0.04 + p * 0.1;
    glow(ctx, LANTERN.x, LANTERN.y, 60 + pulse * 6, PAL.gold, 0.18 + p * 0.4);
    drawKnotRing(ctx, LANTERN.x, LANTERN.y, LANTERN.r, p, { lobes: 9, amp: 3.5, width: 2, on: PAL.gold, off: hover ? 'rgba(255,226,138,0.65)' : 'rgba(255,226,138,0.45)' });
    ctx.save();
    ctx.translate(LANTERN.x, LANTERN.y + bob);
    ctx.scale(sc, sc);
    drawLantern(ctx, 0, 0, 2, 0.6 + p * 0.4 + pulse * 0.2, t);
    ctx.restore();
    if (!hover && !this.starting) {
      const k = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - k;
      drawArrowUp(ctx, LANTERN.x + 48, LANTERN.y + 10 - k * 16, 2, PAL.cream);
      ctx.globalAlpha = 1;
    }

    const cap = this.starting ? 'HERE WE GO!' : hover ? 'HOLD IT HERE' : 'RAISE YOUR LIGHT';
    const a = hover ? 1 : 0.75 + 0.25 * pulse;
    drawText(ctx, cap, PANEL_X, 200, { scale: 2, align: 'center', color: hover ? PAL.gold2 : PAL.white, alpha: a });
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
      ctx.fillRect(BOOK.x + BOOK.w / 2 - PAGES.length * 5 + i * 10, BOOK.y + BOOK.h + 8, i === this.page ? 6 : 4, i === this.page ? 6 : 4);
    }
  }

  page_storm(pg, t, g, d) {
    drawSky(pg, SKY.storm, 0, BOOK.h);
    drawSea(pg, 130, t, { c1: '#10202e', c2: '#1d3445', foam: '#8fb0c0' });
    for (let i = 0; i < 3; i++) drawCloud(pg, ((t * 18 + i * 110) % 330) - 40, 30 + i * 10, 90, '#2a3a52', 11 + i, 0.9);
    for (let x = 0; x < 110; x++) {
      const top = Math.round(124 + Math.pow(Math.max(0, x - 58) / 52, 2) * 30 + Math.sin(x * 0.3) * 1.2);
      pg.fillStyle = PAL.rock;
      pg.fillRect(x, top, 1, BOOK.h - top);
      pg.fillStyle = PAL.rock2;
      pg.fillRect(x, top, 1, 5);
      pg.fillStyle = PAL.grass;
      pg.fillRect(x, top - 1, 1, 2);
    }
    drawLighthouse(pg, 36, 124, t);
    pg.globalCompositeOperation = 'lighter';
    pg.fillStyle = 'rgba(255,220,140,0.12)';
    const a = Math.sin(t * 0.9) * 0.5 - 0.1;
    pg.beginPath();
    pg.moveTo(36, 61);
    pg.lineTo(36 + Math.cos(a - 0.12) * 260, 61 + Math.sin(a - 0.12) * 260);
    pg.lineTo(36 + Math.cos(a + 0.12) * 260, 61 + Math.sin(a + 0.12) * 260);
    pg.fill();
    pg.globalCompositeOperation = 'source-over';
    pg.fillStyle = 'rgba(180,210,240,0.5)';
    for (let i = 0; i < 70; i++) {
      const x = (i * 37 + t * 60) % BOOK.w;
      const y = (i * 53 + t * 190) % BOOK.h;
      pg.fillRect(Math.round(x), Math.round(y), 1, 4);
    }
    const ex = 150 + Math.sin(t * 1.3) * 30 + t * 8;
    const ey = 64 + Math.sin(t * 2.1) * 14;
    drawDragon(pg, ex, ey, d, { mood: 'scared', flap: t * 3, glow: 0, rot: Math.sin(t * 2.5) * 0.6, scale: 0.8 });
  }

  page_lost(pg, t, g, d) {
    drawSky(pg, SKY.storm, 0, BOOK.h);
    drawStars(pg, this.pageStars, t, 0.4);
    pg.fillStyle = '#16202e';
    pg.fillRect(0, 110, BOOK.w, 80);
    pg.fillStyle = PAL.rock2;
    for (let x = 0; x < BOOK.w; x++) pg.fillRect(x, 110 + Math.round(Math.sin(x * 0.07) * 3), 1, 3);
    drawStone(pg, 60, 114, 34, 12, 2, 0);
    drawStone(pg, 205, 116, 26, 10, 4, 0);
    drawTree(pg, 'bare', 30, 114, '#0e1622');
    const shake = Math.sin(t * 30) * 0.6;
    drawDragon(pg, 140 + shake, 111 - 11 * d.size, d, { mood: 'scared', wing: 'folded', glow: 0, life: t, look: -1 });
    const lx = lerp(20, 95, ease.outCubic(clamp(t / 3.5)));
    glow(pg, lx, 88, 40, PAL.gold, 0.35);
    drawLantern(pg, lx, 86, 1, 1, t);
    pg.fillStyle = 'rgba(92,114,140,0.25)';
    for (let i = 0; i < 4; i++) pg.fillRect(0, 90 + i * 20 + Math.round(Math.sin(t + i) * 3), BOOK.w, 6);
    return `${d.name} IS LOST`;
  }

  page_demo(pg, t, g, d) {
    // ghost player so the next person in line already knows what to do
    const FIND = 2.8;
    const eyes = { x: 0, y: 0 };
    drawSky(pg, t < FIND ? SKY.storm : SKY.dusk, 0, BOOK.h);
    let ghost;
    if (t < FIND) {
      pg.fillStyle = PAL.rock;
      for (let x = 0; x < BOOK.w; x++) pg.fillRect(x, 124 + Math.round(Math.sin(x * 0.05) * 5 + Math.sin(x * 0.17) * 2), 1, 70);
      drawStone(pg, 60, 128, 30, 11, 1, 0);
      const ex = 170, ey = 118;
      const eo = eyeOffset(d, 0.85);
      eyes.x = ex + eo.x;
      eyes.y = ey + eo.y;
      drawDragon(pg, ex, ey, d, { mood: t > 1.8 ? 'curious' : 'scared', wing: 'folded', glow: 0, look: -1, scale: 0.85, life: t });
      const k = ease.inOutSine(clamp(t / 1.3));
      ghost = { x: lerp(30, eyes.x, k) + Math.sin(t * 5) * 18 * (1 - k), y: lerp(50, eyes.y, k) };
      // same dark fog + warm beam as the real scene so the demo looks like the game
      glow(pg, ghost.x, ghost.y, 44, PAL.gold, 0.45);
      drawFog(pg, BOOK.w, BOOK.h, t, [{ x: ghost.x, y: ghost.y, r: 42 }], { alpha: 0.93 });
      glow(pg, eyes.x, eyes.y, 9, PAL.gold, 0.8);
      const fill = clamp((t - 1.4) / 1.2);
      if (fill > 0) drawKnotRing(pg, ex, ey - 4, 30, fill, { lobes: 8, amp: 2.5, on: PAL.gold });
    } else {
      const ft = t - FIND;
      drawSea(pg, 140, t, { c1: '#2a3a60', c2: '#4a5a8a', foam: '#ffd0a0' });
        for (let i = 0; i < 4; i++) {
        const rx = 260 + i * 70 - ft * 70;
        const ry = 80 + Math.sin(i * 1.7) * 26;
        if (rx < -30 || rx > 280) continue;
        const passed = rx < 96;
        if (!passed) drawKnotRing(pg, rx, ry, 14 + i * 2, 1, { lobes: 6, amp: 2, width: 1, on: i > 1 ? PAL.gold : '#bff8ee' });
        else if (rx > 60) {
          for (let s = 0; s < 6; s++) drawSparkle(pg, rx + Math.cos(s) * (96 - rx) * 0.6, ry + Math.sin(s * 2) * (96 - rx) * 0.4, 2, PAL.gold2);
        }
      }
        const nextY = 80 + Math.sin(Math.floor((ft * 70 - 164 + 70) / 70) * 1.7) * 26;
      ghost = { x: 130, y: lerp(80, nextY, 0.8) + Math.sin(ft * 2) * 6 };
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
    drawBaseAurora(pg, t * 1.5, 1.2, 8);
    drawSea(pg, 134, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    // the last few who made it home tonight wait for this one (nobody, for the first guest)
    const waiting = this.flock.slice(-4);
    waiting.forEach((m, i) => {
      const a = t * 0.7 + (i / waiting.length) * Math.PI * 2;
      const x = 125 + Math.cos(a) * 92;
      const y = 78 + Math.sin(a) * 30;
      drawDragon(pg, x, y, m.d, { mood: 'joy', flap: t * 2.5 + i * 0.3, life: t, glow: 2, scale: 0.7, flip: Math.sin(a) > 0 });
    });
    drawDragon(pg, 125, 92 + Math.sin(t * 3) * 3, d, { mood: 'happy', flap: t * 2.5, glow: 2 });
    return `GUIDE ${d.name} HOME`;
  }

  page_music(pg, t, g) {
    pg.fillStyle = '#1a1430';
    pg.fillRect(0, 0, BOOK.w, BOOK.h);
    // the full credit lives here now, the end card got cut down to 3 lines
    glow(pg, BOOK.w / 2, 34, 70, PAL.gold, 0.25 + g.beat.pulse * 0.1);
    drawHorn(pg, BOOK.w / 2 - 6, 32, 3);
    drawSoundLines(pg, BOOK.w / 2 + 30, 32, 2, t);
    drawText(pg, 'HOW TO TRAIN', BOOK.w / 2, 58, { scale: 2, align: 'center', color: PAL.gold });
    drawText(pg, 'YOUR DRAGON', BOOK.w / 2, 76, { scale: 2, align: 'center', color: PAL.gold });
    drawText(pg, 'WALLA WALLA SYMPHONY', BOOK.w / 2, 102, { scale: 2, align: 'center', color: PAL.cream });
    drawText(pg, 'YOUTH ORCHESTRA', BOOK.w / 2, 120, { scale: 2, align: 'center', color: PAL.cream });
  }
}

// how many more dragons until the next celebration
export const partyLeft = (n) => FLOCK.CELEBRATE_EVERY - (n % FLOCK.CELEBRATE_EVERY);

// the aurora is mostly hidden behind the storybook. pick a bit of the ribbon you can see,
// closest to the label first, then the gap between STEP HERE and the lantern
function pickVisiblePoint(pts) {
  const zones = [
    { x0: 176, x1: 310, y0: 30, y1: 46, aim: [YOURS.x, 40] },
    { x0: 292, x1: 462, y0: 72, y1: 108, aim: [330, 90] },
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
