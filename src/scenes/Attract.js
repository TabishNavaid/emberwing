import { VIEW, DUR, PAL } from '../config.js';
import { makeCanvas, glow, clamp, ease, lerp } from '../core/util.js';
import { Dwell } from '../input/Dwell.js';
import { drawText, textWidth } from '../art/font.js';
import { drawKnotRing, drawKnotFrame, drawKnotBand } from '../art/knotwork.js';
import { drawEmber, flapPose, FLOCK_COLORS, eyeOffset } from '../art/ember.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawLighthouse, drawStone, drawCloud, drawWind, drawFlyingGull, drawFog } from '../art/world.js';
import { drawLantern, drawFeet, drawHorn, drawSoundLines, drawCursorLight, drawSparkle, drawArrowUp } from '../art/icons.js';
import { drawBaseAurora } from '../art/aurora.js';
import { drawTree } from '../art/sprites.js';

const { W, H } = VIEW;

// storybook on the left, "next flyer" panel on the right
const BOOK = { x: 14, y: 46, w: 252, h: 180 };
const PANEL_X = 372;
const LANTERN = { x: PANEL_X, y: 152, r: 34 };

const PAGES = [
  { id: 'storm', caption: 'A STORM...' },
  { id: 'lost', caption: 'A LOST DRAGON' },
  { id: 'demo', caption: '' }, // sets its own caption as it goes
  { id: 'home', caption: 'GUIDE IT HOME' },
  { id: 'music', caption: 'HEAR IT IN ACT II' },
];

export class Attract {
  interactive = false;

  enter(g) {
    this.dwell = new Dwell(LANTERN.x, LANTERN.y, LANTERN.r + 6, DUR.START_DWELL);
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
    g.scenes.go('find');
  }

  pageDuration() {
    return PAGES[this.page].id === 'demo' ? DUR.ATTRACT_DEMO_PAGE : DUR.ATTRACT_PAGE;
  }

  update(g, dt) {
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
    for (let i = 0; i < 5; i++) {
      const a = t * 0.35 + (i / 5) * Math.PI * 2;
      drawFlyingGull(ctx, 380 + Math.cos(a) * 60, 95 + Math.sin(a) * 12, t + i, i % 2 ? '#ffd88a' : '#8ffff0');
    }
    drawSea(ctx, 212, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    drawWind(ctx, t, g.beat, { lanes: [0.3, 0.72], alpha: 0.25, color: '#9fe8ff' });

    this.drawBook(g, ctx, t);
    this.drawPanel(g, ctx, t);

    drawText(ctx, 'EMBERWING', BOOK.x + 2, 14, { scale: 3, color: PAL.ember3 });
    drawText(ctx, 'THE WAY HOME', BOOK.x + textWidth('EMBERWING', 3) + 10, 21, { scale: 1, color: PAL.cream });

    const n = g.store.count;
    if (n > 0) {
      const s = `${n} ${n === 1 ? 'DRAGON' : 'DRAGONS'} HOME TONIGHT`;
      drawText(ctx, s, BOOK.x + BOOK.w / 2, 240, { scale: 1, align: 'center', color: '#bff8ee' });
    }

    g.particles.draw(ctx);
    if (g.input.seen) drawCursorLight(ctx, g.input.x, g.input.y, t, 1);
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
    drawKnotRing(ctx, LANTERN.x, LANTERN.y, LANTERN.r, p, { lobes: 9, amp: 3.5, width: 2, on: PAL.gold, off: hover ? 'rgba(255,226,138,0.55)' : 'rgba(255,226,138,0.3)' });
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
    const caption = this[`page_${id}`](pg, this.pageT, g) ?? PAGES[this.page].caption;
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

  page_storm(pg, t) {
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
    drawEmber(pg, ex, ey, { mood: 'scared', wing: flapPose(t * 3), glow: 0, rot: Math.sin(t * 2.5) * 0.6, scale: 0.8 });
  }

  page_lost(pg, t) {
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
    const blink = t % 2.2 > 2.05;
    drawEmber(pg, 140 + shake, 100, { mood: 'scared', wing: 'folded', glow: 0, blink, look: -1 });
    const lx = lerp(20, 95, ease.outCubic(clamp(t / 3.5)));
    glow(pg, lx, 88, 40, PAL.gold, 0.35);
    drawLantern(pg, lx, 86, 1, 1, t);
    pg.fillStyle = 'rgba(92,114,140,0.25)';
    for (let i = 0; i < 4; i++) pg.fillRect(0, 90 + i * 20 + Math.round(Math.sin(t + i) * 3), BOOK.w, 6);
  }

  page_demo(pg, t, g) {
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
      const eo = eyeOffset(0.85);
      eyes.x = ex + eo.x;
      eyes.y = ey + eo.y;
      drawEmber(pg, ex, ey, { mood: t > 1.8 ? 'curious' : 'scared', wing: 'folded', glow: 0, look: -1, scale: 0.85, blink: t % 1.3 > 1.2 });
      const k = ease.inOutSine(clamp(t / 1.3));
      ghost = { x: lerp(30, eyes.x, k) + Math.sin(t * 5) * 18 * (1 - k), y: lerp(50, eyes.y, k) };
      drawFog(pg, BOOK.w, BOOK.h, t, [{ x: ghost.x, y: ghost.y, r: 42 }], { alpha: 0.94 });
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
      this.demoEmberY = this.demoEmberY === undefined ? ghost.y : lerp(this.demoEmberY, ghost.y, 0.08);
      pg.fillStyle = 'rgba(255,201,74,0.5)';
      for (let i = 1; i < 18; i++) pg.fillRect(96 - i * 4, Math.round(this.demoEmberY + Math.sin(ft * 3 - i * 0.4) * 3), 3, 1);
      drawEmber(pg, 96, this.demoEmberY, { mood: 'fly', wing: flapPose(ft * 3), glow: 2, scale: 0.9 });
    }
    if (t < 0.2) this.demoEmberY = undefined;
    pg.globalAlpha = 0.85;
    drawLantern(pg, ghost.x, ghost.y, 1, 0.8, t);
    pg.globalAlpha = 1;
    drawText(pg, 'YOU', ghost.x, ghost.y - 22, { scale: 1, align: 'center', color: PAL.gold2 });
    return t < FIND ? 'FIND EMBER' : 'FLY HOME!';
  }

  page_home(pg, t, g) {
    drawSky(pg, SKY.aurora, 0, BOOK.h);
    drawStars(pg, this.pageStars, t);
    drawBaseAurora(pg, t * 1.5, 1.2, 8);
    drawSea(pg, 134, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    for (let i = 0; i < 4; i++) {
      const a = t * 0.7 + (i / 4) * Math.PI * 2;
      const x = 125 + Math.cos(a) * 92;
      const y = 78 + Math.sin(a) * 30;
      drawEmber(pg, x, y, { mood: 'joy', wing: flapPose(t * 2.5 + i * 0.3), glow: 2, colors: FLOCK_COLORS[i], ci: i, scale: 0.7, flip: Math.sin(a) > 0 });
    }
    drawEmber(pg, 125, 92 + Math.sin(t * 3) * 3, { mood: 'happy', wing: flapPose(t * 2.5), glow: 2 });
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
