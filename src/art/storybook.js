// the storybook on the attract screen. its pages turn by themselves and show the people in line
// what the game is: the storm, the lost dragons, a ghost player doing it, home, the act II line
import { DUR, PAL } from '../config.js';
import { makeCanvas, glow, clamp, ease, lerp } from '../core/util.js';
import { drawText } from './font.js';
import { drawKnotRing, drawKnotFrame } from './knotwork.js';
import { drawDragon, eyeOffset } from './dragon.js';
import { drawSky, SKY, makeStars, drawStars, drawSea, drawLighthouse, drawStone, drawCloud, drawFog } from './world.js';
import { drawLantern, drawHorn, drawSoundLines, drawSparkle } from './icons.js';
import { drawBaseAurora } from './aurora.js';
import { drawTree } from './sprites.js';

export const BOOK = { x: 10, y: 48, w: 252, h: 140 };

const PAGES = [
  { id: 'storm', caption: 'A STORM...' },
  { id: 'lost', caption: null }, // "PIP IS LOST", set per dragon
  { id: 'demo', caption: '' }, // sets its own caption as it goes
  { id: 'home', caption: null }, // "GUIDE PIP HOME"
  { id: 'music', caption: 'HEAR IT IN ACT II' },
];

export class Storybook {
  constructor() {
    this.page = 0;
    this.pageT = 0;
    this.flip = 1; // page turn, 0..1
    [this.pageCanvas, this.pg] = makeCanvas(BOOK.w, BOOK.h);
    [this.prevCanvas, this.ppg] = makeCanvas(BOOK.w, BOOK.h);
    this.stars = makeStars(3, 30, 110);
  }

  update(dt) {
    this.pageT += dt;
    this.flip = Math.min(1, this.flip + dt / 0.55);
    // the ghost demo needs longer to play out
    const length = PAGES[this.page].id === 'demo' ? DUR.ATTRACT_DEMO_PAGE : DUR.ATTRACT_PAGE;
    if (this.pageT > length) {
      this.ppg.clearRect(0, 0, BOOK.w, BOOK.h);
      this.ppg.drawImage(this.pageCanvas, 0, 0);
      this.page = (this.page + 1) % PAGES.length;
      this.pageT = 0;
      this.flip = 0;
    }
  }

  // flock: tonight's dragons, the last page shows a few of them waiting at home
  draw(ctx, g, flock) {
    const pg = this.pg;
    pg.clearRect(0, 0, BOOK.w, BOOK.h);
    const id = PAGES[this.page].id;
    const caption = this[id](pg, this.pageT, g, g.dragon, flock) ?? PAGES[this.page].caption;
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


  storm(pg, t, g, d) {
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
  lost(pg, t, g, d) {
    drawSky(pg, SKY.storm, 0, BOOK.h);
    drawStars(pg, this.stars, t, 0.4);
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
    drawLantern(pg, lx, 64, 1, t);
    pg.fillStyle = 'rgba(92,114,140,0.25)';
    for (let i = 0; i < 4; i++) pg.fillRect(0, 80 + i * 16 + Math.round(Math.sin(t + i) * 3), BOOK.w, 6);
    return 'WHO WILL YOU FIND?';
  }

  demo(pg, t, g, d) {
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
      drawFog(pg, BOOK.w, BOOK.h, t, [{ x: ghost.x, y: ghost.y, r: 42 }], 0.93);
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
    drawLantern(pg, ghost.x, ghost.y, 0.8, t);
    pg.globalAlpha = 1;
    drawText(pg, 'YOU', ghost.x, ghost.y - 28, { scale: 2, align: 'center', color: PAL.gold2 });
    return t < FIND ? `FIND ${d.name}` : 'FLY HOME!';
  }

  home(pg, t, g, d, flock) {
    drawSky(pg, SKY.aurora, 0, BOOK.h);
    drawStars(pg, this.stars, t);
    drawBaseAurora(pg, t * 1.5, 1.2, 6);
    drawSea(pg, 116, t, { c1: '#0c1a2c', c2: '#16304a', foam: '#6fb6c8' });
    // the last few who made it home tonight wait for this one (nobody, for the first guest)
    const waiting = flock.slice(-4);
    waiting.forEach((m, i) => {
      const a = t * 0.7 + (i / waiting.length) * Math.PI * 2;
      const x = 125 + Math.cos(a) * 92;
      const y = 64 + Math.sin(a) * 24;
      drawDragon(pg, x, y, m.d, { mood: 'joy', flap: t * 2.5 + i * 0.3, life: t, glow: 2, scale: 0.7, flip: Math.sin(a) > 0 });
    });
    drawDragon(pg, 125, 78 + Math.sin(t * 3) * 3, d, { mood: 'happy', flap: t * 2.5, glow: 2 });
    return `GUIDE ${d.name} HOME`;
  }

  music(pg, t, g) {
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
