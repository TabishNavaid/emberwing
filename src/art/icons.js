import { PAL } from '../config.js';
import { makeCanvas, glow, disc } from '../core/util.js';
import { drawText, textWidth } from './font.js';
import { drawKnotFrame } from './knotwork.js';

let lantern = null;
export function drawLantern(ctx, x, y, lit, t) {
  if (!lantern) {
    let g;
    [lantern, g] = makeCanvas(14, 22);
    const px = (xx, yy, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(xx, yy, w, h);
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
  }
  if (lit > 0) glow(ctx, x, y + 2, 18 * (0.9 + 0.1 * Math.sin(t * 2.5)), PAL.gold, 0.55 * lit);
  ctx.drawImage(lantern, Math.round(x - lantern.width / 2), Math.round(y - lantern.height / 2));
}

export function drawFeet(ctx, x, y) {
  const s = 2;
  const foot = (fx, fy, mirror) => {
    ctx.fillStyle = PAL.cream;
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

export function drawArrowUp(ctx, x, y) {
  ctx.fillStyle = PAL.cream;
  for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x - i), Math.round(y + i), i * 2 + 1, 1);
  ctx.fillRect(Math.round(x - 1), Math.round(y + 5), 3, 5);
}

// the guest's light everywhere except find (that one's a beam)
export function drawCursorLight(ctx, x, y, t, size = 1) {
  glow(ctx, x, y, 22 * size, PAL.gold, 0.55);
  glow(ctx, x, y, 8 * size, '#fff6d8', 0.9);
  ctx.fillStyle = '#fff6d8';
  const r = Math.round(2 + Math.sin(t * 4) * 0.5);
  disc(ctx, x, y, r * size);
}

// "HEAR IT LIVE IN ACT II" plaque. home shows it after the counter so the key line is up for
// ~5s total instead of only the 3s end card (people couldn't read the old card in time)
export function drawActBanner(ctx, cx, y, t, pulse, alpha = 1) {
  const label = 'HEAR IT LIVE IN ACT II';
  const w = textWidth(label, 2) + 44;
  const x = Math.round(cx - w / 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(8,10,24,0.85)';
  ctx.fillRect(x, y, w, 30);
  drawKnotFrame(ctx, x, y, w, 30, { color: PAL.gold });
  glow(ctx, x + 18, y + 15, 16, PAL.gold, 0.3 + pulse * 0.2);
  drawHorn(ctx, x + 20, y + 15, 1);
  drawText(ctx, label, x + 36, y + 9, { scale: 2, color: PAL.gold2 });
  ctx.restore();
}

// the speaker on the sound button. on = waves pulsing on the beat, muted = an x, locked = waves
// blinking slowly (waiting for a key press or a touch). shape, not color, tells them apart.
// x is the left edge, y the middle. drawn at 2x
export function drawSpeaker(ctx, x, y, state, t, pulse) {
  if (state === 'none') return;
  const s = 2;
  x = Math.round(x);
  y = Math.round(y);
  const px = (a, b, w, h) => ctx.fillRect(x + a * s, y + b * s, w * s, h * s);
  ctx.fillStyle = state === 'on' ? PAL.cream : 'rgba(255,243,214,0.75)';
  px(0, -2, 2, 4);
  px(2, -3, 1, 6);
  px(3, -4, 1, 8);
  if (state === 'muted') {
    ctx.fillStyle = PAL.rose;
    for (let i = 0; i < 5; i++) {
      px(6 + i, -2 + i, 1, 1);
      px(10 - i, -2 + i, 1, 1);
    }
    return;
  }
  // locked: blinks once a second, well under the flash limit
  if (state === 'locked' && Math.floor(t) % 2 === 1) return;
  ctx.fillStyle = state === 'on' ? PAL.gold2 : 'rgba(255,243,214,0.75)';
  ctx.globalAlpha = state === 'on' ? 0.6 + 0.4 * pulse : 1;
  // two arcs, ")" shaped
  px(5, -2, 1, 1);
  px(6, -1, 1, 2);
  px(5, 1, 1, 1);
  px(8, -4, 1, 1);
  px(9, -3, 1, 1);
  px(10, -2, 1, 4);
  px(9, 2, 1, 1);
  px(8, 3, 1, 1);
  if (state === 'locked') {
    px(12, -3, 1, 4);
    px(12, 2, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// the three level badges. each is a different shape so they tell apart without color:
// hatchling = an egg with a crack, flier = a wing, storm rider = a storm cloud with a bolt
export function drawLevelIcon(ctx, id, x, y, t = 0) {
  x = Math.round(x);
  y = Math.round(y);
  const px = (a, b, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + a, y + b, w, h);
  };
  if (id === 'hatchling') {
    // egg, rows from the top: [offset, width]
    const rows = [[-3, 6], [-4, 8], [-5, 10], [-5, 10], [-6, 12], [-6, 12], [-6, 12], [-6, 12], [-6, 12], [-6, 12], [-5, 10], [-5, 10], [-4, 8], [-3, 6]];
    rows.forEach(([o, w], i) => px(o - 1, i - 8, w + 2, 1, '#1a1410'));
    rows.forEach(([o, w], i) => px(o, i - 8, w, 1, i < 5 ? '#fff6e0' : '#ffe9b8'));
    px(-3, -4, 2, 2, '#e0b878');
    px(2, 0, 2, 2, '#e0b878');
    // zigzag crack, and a little glow peeking out of it
    for (const [a, b] of [[-6, -1], [-5, -2], [-4, -1], [-3, -2], [-2, -1], [-1, -2], [0, -1], [1, -2], [2, -1], [3, -2], [4, -1], [5, -2]]) px(a, b, 1, 1, '#5a3a1a');
    glow(ctx, x, y - 2, 9, PAL.amber, 0.35 + 0.15 * Math.sin(t * 3));
  } else if (id === 'flier') {
    // a bat wing: bone along the top, membrane with a scalloped trailing edge, flapping a little
    const up = 0.85 + 0.15 * Math.sin(t * 4);
    for (const [col, grow] of [['#0b0f1a', 1], [PAL.teal, 0]]) {
      ctx.fillStyle = col;
      for (let i = -10; i <= 8; i++) {
        const top = Math.round((4 - ((i + 10) / 18) * 13) * up) - grow;
        const bottom = Math.round(7 - 5 * Math.abs(Math.sin(((i + 10) * Math.PI) / 6.5))) + grow;
        if (bottom > top) ctx.fillRect(x + i - grow, y + top, 1 + grow * 2, bottom - top);
      }
    }
    ctx.fillStyle = '#c8fff6';
    for (let i = -10; i <= 8; i++) ctx.fillRect(x + i, y + Math.round((4 - ((i + 10) / 18) * 13) * up), 1, 2);
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(x + 8, y + Math.round(-9 * up) - 2, 2, 2);
  } else {
    // storm cloud with a bolt under it (still, never flashing)
    ctx.fillStyle = '#0b0f1a';
    disc(ctx, x - 4, y - 2, 6);
    disc(ctx, x + 3, y - 4, 7);
    disc(ctx, x + 7, y, 5);
    ctx.fillRect(x - 10, y - 1, 22, 6);
    ctx.fillStyle = '#8a96b8';
    disc(ctx, x - 4, y - 2, 5);
    disc(ctx, x + 3, y - 4, 6);
    disc(ctx, x + 7, y, 4);
    ctx.fillRect(x - 9, y, 20, 4);
    ctx.fillStyle = '#c4cce0';
    ctx.fillRect(x - 1, y - 8, 5, 2);
    for (const [a, b] of [[1, 5], [0, 6], [-1, 7], [0, 8], [1, 8], [0, 9], [-1, 10], [-2, 11]]) px(a, b, 2, 1, PAL.gold2);
  }
}

// a chunky 5 point star for the score and the dragon card. filled or just an outline, so earned
// and not-yet stars differ by shape too, not only color. s = pixel scale
const STAR = ['...#...', '...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
export function drawStarIcon(ctx, x, y, filled, s) {
  x = Math.round(x - (STAR[0].length * s) / 2);
  y = Math.round(y - (STAR.length * s) / 2);
  ctx.fillStyle = '#0b0f1a';
  STAR.forEach((row, j) => [...row].forEach((c, i) => c === '#' && ctx.fillRect(x + i * s - 1, y + j * s - 1, s + 2, s + 2)));
  STAR.forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== '#') return;
    // outline-only stars keep just the edge pixels
    const edge = !filled && (STAR[j - 1]?.[i] !== '#' || STAR[j + 1]?.[i] !== '#' || row[i - 1] !== '#' || row[i + 1] !== '#');
    if (filled || edge) {
      ctx.fillStyle = filled ? PAL.gold2 : 'rgba(255,243,214,0.55)';
      ctx.fillRect(x + i * s, y + j * s, s, s);
    }
  }));
}
