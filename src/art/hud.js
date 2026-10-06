// everything drawn over the flight that isn't the world: the score and stars, the hoop counter,
// the lighthouse-to-home track, the instruction, and the arrows that teach steering
import { VIEW, FLIGHT, PAL, POWER } from '../config.js';
import { clamp, lerp, glow } from '../core/util.js';
import { drawText, drawTextPop, fitScale } from './font.js';
import { drawKnotRing, drawKnotBand } from './knotwork.js';
import { drawStarIcon } from './icons.js';
import { drawPowerIcon, POWER_COLORS } from './critters.js';

const { W } = VIEW;

// f is the flight scene, g the game
export function drawHud(ctx, f, g, t) {
  drawJourney(ctx, f, f.p, t);
  drawCounter(ctx, f);
  drawScore(ctx, f);
  f.points.drawPopups(ctx);
  if (f.prompt) {
    drawText(ctx, f.prompt, W / 2, 30, { scale: fitScale(f.prompt, W - 10), align: 'center', color: PAL.cream, alpha: clamp(f.promptT / 0.25) });
  }
  drawGuides(ctx, f, g.input.x, g.input.y, t);
}

// teaching arrows: light -> dragon while "PIP FOLLOWS YOUR LIGHT" is up, then a bouncing
// chevron from the dragon toward the tutorial hoop while it's waiting
function drawGuides(ctx, f, lx, ly, t) {
  const e = f.toScreen(f.ex, f.ey);
  if (f.prompt === f.follows) {
    const d = Math.hypot(e.x - lx, e.y - ly);
    if (d > 30) {
      const ux = (e.x - lx) / d;
      const uy = (e.y - ly) / d;
      ctx.fillStyle = PAL.gold2;
      for (let s = 10 + ((t * 40) % 8); s < d - 30; s += 8) ctx.fillRect(Math.round(lx + ux * s) - 1, Math.round(ly + uy * s) - 1, 3, 3);
      // arrowhead pointing at the dragon
      const hx = e.x - ux * 26;
      const hy = e.y - uy * 26;
      for (let i = 0; i < 7; i++) {
        const w = 7 - i;
        ctx.fillRect(Math.round(hx - ux * i - uy * w), Math.round(hy - uy * i + ux * w), 2, 2);
        ctx.fillRect(Math.round(hx - ux * i + uy * w), Math.round(hy - uy * i - ux * w), 2, 2);
      }
    }
  }
  const tut = f.rings[0];
  if (f.tutorial && f.tutT >= FLIGHT.TUT_SLIDE && tut.state === 'coming') {
    const hy = f.toScreen(0, tut.y).y;
    const dir = Math.sign(hy - e.y);
    if (Math.abs(hy - e.y) > 24) {
      const bob = Math.sin(t * 8) * 3;
      const cy = (e.y + hy) / 2 + bob * dir;
      ctx.fillStyle = PAL.gold2;
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i < 6; i++) {
          const yy = Math.round(cy + dir * (k * 7 + i)); // tip of the V points at the hoop
          ctx.fillRect(Math.round(e.x - 6 + i), yy, 2, 2);
          ctx.fillRect(Math.round(e.x + 6 - i), yy, 2, 2);
        }
      }
    }
  }
}

// score in the top left corner, with the stars earned so far filling in as you go, and
// whatever power-up is running with a bar for how long it has left
function drawScore(ctx, f) {
  const pts = f.points;
  const stars = pts.stars;
  for (let i = 0; i < 3; i++) drawStarIcon(ctx, 10 + i * 12, 12, i < stars, 1);
  const pop = pts.pop > 0 ? 1 + Math.sin((pts.pop / 0.35) * Math.PI) * 0.25 : 1;
  drawText(ctx, String(pts.score), 46, 6, { scale: 2, color: PAL.gold2, alpha: 1 });
  if (pop > 1.01) drawText(ctx, String(pts.score), 46, 6, { scale: 2, color: '#ffffff', alpha: (pop - 1) * 3 });
  const running = [['fireball', f.fireT, POWER.FIREBALL], ['speed', f.speedT, POWER.SPEED], ['magnet', f.magnetT, POWER.MAGNET], ['shield', f.shield ? 1 : 0, 1]].filter(([, v]) => v > 0);
  running.forEach(([kind, v, max], i) => {
    const x = 12 + i * 26;
    glow(ctx, x, 32, 10, POWER_COLORS[kind], 0.5);
    drawPowerIcon(ctx, kind, x, 32, f.t);
    ctx.fillStyle = POWER_COLORS[kind];
    ctx.fillRect(x - 8, 41, Math.round(16 * (v / max)), 2);
  });
}

// "3 / 8" up in the corner with a little hoop, pops when you get one
function drawCounter(ctx, f) {
  const pop = f.countPop > 0 ? 1 + Math.sin((f.countPop / 0.4) * Math.PI) * 0.3 : 1;
  const label = `${f.points.hits} / ${f.L.hoops}`;
  drawKnotRing(ctx, 412, 14, 7 * pop, 1, { lobes: 5, amp: 1.5, width: 1, on: PAL.gold });
  drawTextPop(ctx, label, 446, 14, 1, { scale: Math.round(2 * pop) || 2, color: PAL.gold2 });
}

// lighthouse -> home track across the top. someone who glances over mid-flight gets
// "it's flying home" without reading anything
function drawJourney(ctx, f, p, t) {
  const x0 = 150, x1 = 330, y = 13;
  const px = Math.round(lerp(x0, x1, p));
  drawKnotBand(ctx, x0, y, x1 - x0, { color: 'rgba(255,243,214,0.5)' });
  if (px > x0) drawKnotBand(ctx, x0, y, px - x0);
  // tiny lighthouse
  ctx.fillStyle = '#e8e0cc';
  ctx.fillRect(x0 - 16, y - 6, 5, 12);
  ctx.fillStyle = '#46546e';
  ctx.fillRect(x0 - 16, y - 2, 5, 3);
  ctx.fillStyle = PAL.gold2;
  ctx.fillRect(x0 - 16, y - 9, 5, 3);
  glow(ctx, x0 - 14, y - 8, 7, PAL.gold, 0.7);
  // home: three stones under an aurora arc
  const hx = x1 + 14;
  glow(ctx, hx, y - 4, 12, PAL.teal, 0.35 + 0.25 * Math.sin(t * 2));
  ctx.fillStyle = PAL.teal;
  for (let i = -6; i <= 6; i++) ctx.fillRect(hx + i, y - 7 + Math.round((i * i) / 12), 1, 2);
  ctx.fillStyle = '#56698a';
  for (const [dx, h] of [[-5, 6], [0, 8], [5, 6]]) ctx.fillRect(hx + dx - 1, y + 5 - h, 3, h);
  // the dragon's marker, in its own colors: body, wing, one eye
  const bob = Math.round(Math.sin(t * 6) * 1);
  ctx.fillStyle = f.d.colors.wingLit;
  ctx.fillRect(px - 4, y - 6 + bob, 4, 3);
  ctx.fillStyle = f.d.colors.body;
  ctx.fillRect(px - 3, y - 3 + bob, 7, 6);
  ctx.fillRect(px + 3, y - 4 + bob, 3, 4);
  ctx.fillStyle = '#1b1030';
  ctx.fillRect(px + 4, y - 3 + bob, 1, 1);
}

// dotted light from the guest's light to the dragon when they drift apart, so it's obvious
// the dragon is following YOU
export function drawTether(ctx, f, x, y, t) {
  const { x: ex, y: ey } = f.toScreen(f.ex, f.ey);
  const d = Math.hypot(ex - x, ey - y);
  if (d < 28 || f.p > FLIGHT.RISE_AT) return;
  const a = clamp((d - 28) / 40) * 0.6;
  ctx.fillStyle = PAL.gold2;
  const off = (t * 40) % 7;
  for (let s = off; s < d - 14; s += 7) {
    const k = s / d;
    ctx.globalAlpha = a * (1 - k * 0.5);
    ctx.fillRect(Math.round(x + (ex - x) * k), Math.round(y + (ey - y) * k), 2, 2);
  }
  ctx.globalAlpha = 1;
}
