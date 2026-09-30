import { PAL } from '../config.js';
import { makeCanvas, glow, disc } from '../core/util.js';

const lanternCache = new Map();
// s = pixel scale
export function drawLantern(ctx, x, y, s = 2, lit = 1, t = 0) {
  let c = lanternCache.get(s);
  if (!c) {
    let g;
    [c, g] = makeCanvas(14 * s, 22 * s);
    const px = (xx, yy, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(xx * s, yy * s, w * s, h * s);
    };
    const dark = '#1a1410';
    px(4, 0, 6, 1, dark); px(3, 1, 1, 3, dark); px(10, 1, 1, 3, dark); px(4, 1, 6, 1, '#b8863a');
    px(2, 4, 10, 1, dark); px(3, 5, 8, 2, '#c9953f'); px(2, 5, 1, 2, dark); px(11, 5, 1, 2, dark);
    px(4, 5, 3, 1, '#ffd98a');
    px(2, 7, 10, 10, dark);
    px(3, 8, 8, 8, '#ffe9a8');
    px(6, 8, 1, 8, '#b8863a'); px(3, 12, 8, 1, '#b8863a');
    px(4, 10, 2, 3, '#ffb040'); px(7, 10, 2, 3, '#ffb040');
    px(5, 13, 1, 2, '#fff6d8'); px(8, 13, 1, 2, '#fff6d8');
    px(1, 17, 12, 1, dark); px(2, 18, 10, 2, '#c9953f'); px(1, 18, 1, 2, dark); px(12, 18, 1, 2, dark);
    px(1, 20, 12, 1, dark); px(3, 18, 3, 1, '#ffd98a');
    lanternCache.set(s, c);
  }
  if (lit > 0) glow(ctx, x, y + 2 * s, 18 * s * (0.9 + 0.1 * Math.sin(t * 2.5)), PAL.gold, 0.55 * lit);
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
}

export function drawFeet(ctx, x, y, s = 2, color = PAL.cream) {
  const foot = (fx, fy, mirror) => {
    ctx.fillStyle = color;
    const px = (a, b, w, h) => ctx.fillRect(Math.round(fx + (mirror ? 4 - a - w : a) * s), Math.round(fy + b * s), w * s, h * s);
    px(1, 2, 3, 1); px(0, 3, 5, 3); px(1, 6, 3, 1);
    px(1, 8, 3, 3); px(2, 11, 1, 1);
    px(0, 0, 1, 1); px(2, 0, 1, 1); px(4, 1, 1, 1);
  };
  foot(x - 7 * s, y - 4 * s, false);
  foot(x + 2 * s, y - 6 * s, true);
}

export function drawHorn(ctx, x, y, s = 2) {
  const gold = PAL.gold;
  const dark = '#6b4a14';
  x = Math.round(x);
  y = Math.round(y);
  // coil: dark pass a pixel fatter, then gold on top
  for (const [col, size] of [[dark, s + 1], [gold, s]]) {
    ctx.fillStyle = col;
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      ctx.fillRect(Math.round(x - 2 * s + Math.cos(a) * 5 * s), Math.round(y + Math.sin(a) * 4 * s), size, size);
    }
  }
  for (let i = 0; i <= 7; i++) {
    const h = Math.round((1 + i * i * 0.12) * s);
    ctx.fillStyle = dark;
    ctx.fillRect(x + 2 * s + i * s, y - h - 1, s, h * 2 + 2);
    ctx.fillStyle = i === 7 ? '#fff0b0' : gold;
    ctx.fillRect(x + 2 * s + i * s, y - h, s, h * 2);
  }
  ctx.fillStyle = gold;
  ctx.fillRect(x - 9 * s, y - s, 3 * s, s);
}

export function drawSoundLines(ctx, x, y, s, t, color = PAL.gold) {
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.2 + i / 3) % 1;
    const r = (4 + k * 10) * s;
    ctx.globalAlpha = 1 - k;
    for (let a = -0.6; a <= 0.6; a += 0.12) ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), s, s);
  }
  ctx.globalAlpha = 1;
}

export function drawSparkle(ctx, x, y, r, color = '#fff6d8') {
  ctx.fillStyle = color;
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  ctx.fillRect(x, y - r, 1, r * 2 + 1);
  if (r > 2) ctx.fillRect(x - 1, y - 1, 3, 3);
}

export function drawArrowUp(ctx, x, y, s = 2, color = PAL.cream) {
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x - i * s), Math.round(y + i * s), (i * 2 + 1) * s, s);
  ctx.fillRect(Math.round(x - s), Math.round(y + 5 * s), 3 * s, 5 * s);
}

// the guest's light everywhere except find ember (that one's a beam)
export function drawCursorLight(ctx, x, y, t, size = 1) {
  glow(ctx, x, y, 22 * size, PAL.gold, 0.55);
  glow(ctx, x, y, 8 * size, '#fff6d8', 0.9);
  ctx.fillStyle = '#fff6d8';
  const r = Math.round(2 + Math.sin(t * 4) * 0.5);
  disc(ctx, x, y, r * size);
}
