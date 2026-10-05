import { PAL } from '../config.js';
import { glow, disc } from '../core/util.js';

// the things that get in the dragon's way, and the power-ups. all soft and silly on purpose:
// nothing here looks like it hurts anyone, they just get in the way and go pop

const OUT = '#0b0f1a';

// eyes: open dots, or happy/sleepy arcs
function eyes(ctx, x, y, gap, kind = 'dot', color = OUT) {
  ctx.fillStyle = color;
  for (const dx of [-gap, gap]) {
    if (kind === 'dot') ctx.fillRect(x + dx - 1, y - 1, 2, 2);
    else if (kind === 'happy') {
      ctx.fillRect(x + dx - 1, y, 1, 1);
      ctx.fillRect(x + dx, y - 1, 1, 1);
      ctx.fillRect(x + dx + 1, y, 1, 1);
    } else {
      ctx.fillRect(x + dx - 1, y, 3, 1); // sleepy
    }
  }
}

function blob(ctx, x, y, parts, fill, edge = OUT) {
  ctx.fillStyle = edge;
  for (const [dx, dy, r] of parts) disc(ctx, x + dx, y + dy, r + 1);
  ctx.fillStyle = fill;
  for (const [dx, dy, r] of parts) disc(ctx, x + dx, y + dy, r);
}

const CLOUD = [[-7, 1, 6], [0, -3, 7], [7, 1, 6], [-2, 3, 6], [4, 3, 5]];

// grumpy storm cloud: frowny brows, a little drizzle. zap = 0..1 while it zaps a hoop
export function drawGrumpyCloud(ctx, x, y, t, zap = 0) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = 'rgba(160,190,230,0.7)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 8 + i * 5, y + 9 + ((t * 30 + i * 4) % 8), 1, 2);
  blob(ctx, x, y, CLOUD, '#7d8aa8');
  ctx.fillStyle = '#a2adc6';
  disc(ctx, x - 1, y - 5, 3);
  // cross little brows and a frown
  ctx.fillStyle = OUT;
  ctx.fillRect(x - 6, y - 2, 3, 1);
  ctx.fillRect(x - 4, y - 1, 1, 1);
  ctx.fillRect(x + 3, y - 2, 3, 1);
  ctx.fillRect(x + 3, y - 1, 1, 1);
  eyes(ctx, x, y + 1, 4);
  ctx.fillRect(x - 2, y + 5, 4, 1);
  ctx.fillRect(x - 3, y + 6, 1, 1);
  ctx.fillRect(x + 2, y + 6, 1, 1);
  if (zap > 0) {
    // one small spark down onto the hoop, no flashing
    ctx.fillStyle = PAL.gold2;
    for (const [a, b] of [[0, 9], [-1, 10], [-2, 11], [-1, 12], [0, 13], [1, 14], [0, 15], [-1, 16]]) ctx.fillRect(x + a, y + b, 2, 1);
    glow(ctx, x, y + 14, 8, PAL.gold, 0.5 * zap);
  }
}

// gust sprite: a little swirl of wind with eyes that tumbles along
export function drawGustSprite(ctx, x, y, t) {
  x = Math.round(x);
  y = Math.round(y);
  glow(ctx, x, y, 12, '#bfefff', 0.25);
  for (let k = 0; k < 2; k++) {
    ctx.fillStyle = k ? '#e8fbff' : '#7fc8e8';
    for (let i = 0; i < 26; i++) {
      const a = t * 6 + i * 0.42 + k * Math.PI;
      const r = 2 + i * 0.32;
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), 2, 2);
    }
  }
  ctx.fillStyle = '#e8fbff';
  disc(ctx, x, y, 4);
  eyes(ctx, x, y, 2, 'dot');
}

// fog wisp: a sleepy ghosty puff of mist. alpha so it can fade out
export function drawFogWisp(ctx, x, y, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  x = Math.round(x);
  y = Math.round(y + Math.sin(t * 2) * 2);
  ctx.fillStyle = '#c8d2e4';
  for (let i = 0; i < 3; i++) disc(ctx, x + 8 + i * 4, y + 2 + Math.round(Math.sin(t * 3 + i) * 2), 3 - i);
  blob(ctx, x, y, [[-4, 0, 6], [3, -2, 6], [1, 3, 5]], '#dde4f0', 'rgba(11,15,26,0.6)');
  eyes(ctx, x, y, 3, 'sleepy');
  ctx.restore();
}

// harmless smiling puff (hatchling): bump it and it giggles, fireball it for points
export function drawPuff(ctx, x, y, t) {
  x = Math.round(x);
  y = Math.round(y + Math.sin(t * 2.5) * 2);
  blob(ctx, x, y, [[-6, 1, 5], [0, -2, 6], [6, 1, 5], [0, 3, 5]], '#ffffff');
  eyes(ctx, x, y, 3, 'happy');
  ctx.fillStyle = PAL.rose;
  ctx.fillRect(x - 6, y + 2, 2, 1);
  ctx.fillRect(x + 5, y + 2, 2, 1);
  ctx.fillStyle = OUT;
  ctx.fillRect(x - 1, y + 3, 3, 1);
}

// power-up orbs. a different shape inside each one, color is only a second clue
export const POWER_COLORS = { fireball: PAL.amber, speed: '#9df06a', shield: '#8ad8ff', magnet: PAL.rose, friend: PAL.gold2 };

export function drawPowerIcon(ctx, kind, x, y, t = 0) {
  x = Math.round(x);
  y = Math.round(y);
  const px = (a, b, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + a, y + b, w, h);
  };
  if (kind === 'fireball') {
    // a flame
    const f = Math.round(Math.sin(t * 12));
    for (const [a, b, w, c] of [[-1, -5 + f, 2, '#ffe28a'], [-2, -3, 4, '#ffc94a'], [-3, -1, 6, '#ff9e3a'], [-3, 1, 6, '#ff9e3a'], [-2, 3, 4, '#f0762a']]) px(a, b, w, 2, c);
    px(-1, 0, 2, 2, '#fff6d8');
  } else if (kind === 'speed') {
    // a double arrow
    for (const off of [-3, 2]) for (let i = 0; i < 4; i++) {
      px(off + i - 2, -i, 1, 1, '#efffe0');
      px(off + i - 2, i, 1, 1, '#efffe0');
    }
  } else if (kind === 'shield') {
    // a bubble with a shine
    ctx.fillStyle = '#e8f8ff';
    for (let a = 0; a < Math.PI * 2; a += 0.3) ctx.fillRect(Math.round(x + Math.cos(a) * 4.5), Math.round(y + Math.sin(a) * 4.5), 1, 1);
    px(-2, -3, 2, 1, '#ffffff');
    px(-3, -2, 1, 1, '#ffffff');
  } else if (kind === 'magnet') {
    // a horseshoe magnet
    for (let i = 0; i < 5; i++) {
      px(-4, -3 + i, 2, 1, '#ffd0de');
      px(2, -3 + i, 2, 1, '#ffd0de');
    }
    px(-4, 2, 8, 2, '#ffd0de');
    px(-4, -4, 2, 1, '#ffffff');
    px(2, -4, 2, 1, '#ffffff');
  } else {
    // flock friend: a heart
    for (const [a, b, w] of [[-3, -2, 2], [1, -2, 2], [-4, -1, 8], [-4, 0, 8], [-3, 1, 6], [-2, 2, 4], [-1, 3, 2]]) px(a, b, w, 1, '#fff3d6');
  }
}

export function drawOrb(ctx, kind, x, y, t) {
  const c = POWER_COLORS[kind] ?? PAL.gold;
  const bob = Math.sin(t * 3) * 2;
  glow(ctx, x, y + bob, 18, c, 0.45 + 0.15 * Math.sin(t * 5));
  ctx.fillStyle = OUT;
  disc(ctx, x, y + bob, 9);
  ctx.fillStyle = c;
  disc(ctx, x, y + bob, 8);
  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  disc(ctx, x, y + bob, 6);
  drawPowerIcon(ctx, kind, x, y + bob, t);
}

export function drawFireball(ctx, x, y, t) {
  glow(ctx, x, y, 9, PAL.amber, 0.7);
  ctx.fillStyle = '#ffe28a';
  disc(ctx, x, y, 2);
  ctx.fillStyle = PAL.ember3;
  ctx.fillRect(Math.round(x) - 4, Math.round(y), 3, 1);
}
