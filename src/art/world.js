// scenery every scene shares, all drawn in code: sky, stars, sea, cliffs, the lighthouse, standing
// stones, sea stacks, clouds, wind, rays and fog
import { VIEW, PAL } from '../config.js';
import { makeCanvas, mix, mulberry32, clamp, TAU, glow, stampLine, disc, rgba } from '../core/util.js';

const { W, H } = VIEW;

// banded + dithered gradient so it looks like pixel art instead of a smooth css gradient.
// stops: [[t, color], ...]. alpha is for cross-fading one sky into the next
const skyCache = new Map();
export function drawSky(ctx, stops, y0 = 0, y1 = H, alpha = 1) {
  if (alpha <= 0.01) return;
  const key = JSON.stringify(stops) + y0 + '|' + y1;
  let c = skyCache.get(key);
  if (!c) {
    let g;
    [c, g] = makeCanvas(W, y1 - y0);
    const h = y1 - y0;
    const colorAt = (t) => {
      for (let i = 0; i < stops.length - 1; i++) {
        const [a, ca] = stops[i];
        const [b, cb] = stops[i + 1];
        if (t <= b) return mix(ca, cb, (t - a) / (b - a || 1));
      }
      return stops[stops.length - 1][1];
    };
    const bands = 14;
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const bi = Math.floor(t * bands);
      const frac = t * bands - bi;
      const ca = colorAt(bi / bands);
      const cb = colorAt((bi + 1) / bands);
      // checker dither in the last third of each band
      for (let x = 0; x < W; x += 2) {
        const d = frac > 0.66 && ((x >> 1) + y) % 2 === 0;
        g.fillStyle = d ? cb : ca;
        g.fillRect(x, y, 2, 1);
      }
    }
    if (skyCache.size > 40) skyCache.clear();
    skyCache.set(key, c);
  }
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(c, 0, y0);
  ctx.globalAlpha = 1;
}

export const SKY = {
  storm: [[0, '#070b14'], [0.55, '#141f33'], [1, '#26374f']],
  dusk: [[0, '#16203a'], [0.5, '#3a4a78'], [0.8, '#c0707a'], [1, '#ffb070']],
  gold: [[0, '#1a2250'], [0.45, '#4a4a90'], [0.75, '#ff9a6a'], [1, '#ffd88a']],
  aurora: [[0, '#050818'], [0.5, '#0e1a3a'], [1, '#1d3450']],
};

export function makeStars(seed, n, maxY) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => ({ x: r() * W, y: r() * maxY, p: r() * TAU, b: r() }));
}
export function drawStars(ctx, stars, t, alpha = 1) {
  for (const s of stars) {
    // keep the twinkle slow, well under the 3 flashes/sec limit
    const a = alpha * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.9 + s.p)));
    ctx.globalAlpha = a;
    ctx.fillStyle = s.b > 0.8 ? '#fff6d8' : '#cfe0ff';
    ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    if (s.b > 0.93) {
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1);
      ctx.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawSea(ctx, y, t, o = {}) {
  const { c1, c2, foam, scroll = 0, glint = null } = o;
  // runs a bit past the bottom so a camera nudge never shows a gap under the sea
  const bottom = H + 16;
  ctx.fillStyle = c1;
  ctx.fillRect(0, y, W, bottom - y);
  ctx.fillStyle = c2;
  ctx.fillRect(0, y, W, 2);
  let row = 0;
  for (let yy = y + 3; yy < bottom; yy += 3 + row) {
    const depth = Math.min(1, (yy - y) / (H - y));
    const speed = 6 + depth * 18;
    const len = 3 + Math.floor(depth * 9);
    const gap = 26 + row * 7;
    const off = (t * speed + scroll * (0.5 + depth) + row * 17) % gap;
    ctx.fillStyle = row % 3 === 0 ? foam : c2;
    ctx.globalAlpha = row % 3 === 0 ? 0.35 + depth * 0.25 : 0.9;
    for (let x = -gap + off; x < W; x += gap) {
      const wob = Math.round(Math.sin((x + row * 13) * 0.2 + t * 1.3));
      ctx.fillRect(Math.round(x), yy + wob, len, 1);
    }
    row++;
  }
  ctx.globalAlpha = 1;
  if (glint) {
    // sun / aurora reflection
    for (let yy = y + 2; yy < H; yy += 3) {
      const k = (yy - y) / (H - y);
      const w = 6 + k * 50;
      ctx.globalAlpha = 0.35 * (1 - k * 0.5);
      ctx.fillStyle = glint.color;
      const wob = Math.sin(yy * 0.7 + t * 2) * 4;
      ctx.fillRect(Math.round(glint.x - w / 2 + wob), yy, Math.round(w * (0.4 + 0.3 * Math.sin(yy + t * 3))), 1);
    }
    ctx.globalAlpha = 1;
  }
}

// pre-rendered once per scene. returns { canvas, top(x) } so things can sit on the cliff edge
export function makeCliff({ seed = 1, x0 = 0, x1 = W, top = 180, bottom = H, rough = 10, colors, taperR = 0, periodic = false } = {}) {
  const r = mulberry32(seed);
  const C = { rock: PAL.rock, rock2: PAL.rock2, rock3: PAL.rock3, grass: PAL.grass, grass2: '#4f7d5f', ...(colors || {}) };
  const w = x1 - x0;
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  // periodic = whole number of waves across the width, so flight can tile it with no seam
  const fr = periodic ? [(TAU * 3) / (x1 - x0), (TAU * 8) / (x1 - x0), (TAU * 19) / (x1 - x0)] : [0.021, 0.057, 0.13];
  const topAt = (x) => {
    const u = x - x0;
    const edge = taperR ? Math.pow(Math.max(0, 1 - (x1 - x) / taperR), 2) * (bottom - top) : 0;
    return edge + (
      top +
      Math.sin(u * fr[0] + ph[0]) * rough +
      Math.sin(u * fr[1] + ph[1]) * rough * 0.45 +
      Math.round(Math.sin(u * fr[2] + ph[2]) * rough * 0.18)
    );
  };
  const [c, g] = makeCanvas(w, bottom);
  for (let x = 0; x < w; x++) {
    const ty = Math.round(topAt(x + x0));
    g.fillStyle = C.rock;
    g.fillRect(x, ty, 1, bottom - ty);
    g.fillStyle = C.rock2;
    g.fillRect(x, ty, 1, 10 + Math.round(Math.sin(x * 0.3) * 2));
    g.fillStyle = C.grass;
    g.fillRect(x, ty - 1, 1, 3);
    if (x % 3 === 0 && r() < 0.5) {
      g.fillStyle = C.grass2;
      g.fillRect(x, ty - 2 - Math.floor(r() * 2), 1, 2);
    }
  }
  g.fillStyle = C.rock3;
  for (let i = 0; i < w / 9; i++) {
    const x = Math.floor(r() * w);
    const y = Math.round(topAt(x + x0)) + 12 + Math.floor(r() * (bottom - topAt(x + x0) - 14));
    const len = 3 + Math.floor(r() * 10);
    g.globalAlpha = 0.55;
    g.fillRect(x, y, len, 1);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < w / 60; i++) {
    const x = Math.floor(r() * w);
    const y = Math.round(topAt(x + x0));
    const s = 3 + r() * 5;
    g.fillStyle = C.rock;
    disc(g, x, y - s * 0.4, s);
    g.fillStyle = C.rock2;
    disc(g, x - 1, y - s * 0.6, s * 0.6);
  }
  return { canvas: c, x0, top: topAt };
}
export function drawCliff(ctx, cliff) {
  ctx.drawImage(cliff.canvas, Math.round(cliff.x0), 0);
}

// returns where the lamp is so the beam can come out of it
export function drawLighthouse(ctx, x, y, t) {
  const h = 62;
  for (let i = 0; i < h; i++) {
    const w = Math.round(14 - (i / h) * 5);
    const band = Math.floor(i / 10) % 2 === 0;
    ctx.fillStyle = band ? '#e8e0cc' : '#46546e';
    ctx.fillRect(Math.round(x - w / 2), y - i, w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(Math.round(x + w / 2) - 3, y - i, 3, 1);
  }
  ctx.fillStyle = '#2a1c14';
  ctx.fillRect(x - 2, y - 7, 4, 7);
  ctx.fillStyle = '#1a2433';
  ctx.fillRect(x - 8, y - h - 1, 16, 2);
  ctx.fillStyle = '#ffe28a';
  ctx.fillRect(x - 5, y - h - 9, 10, 8);
  ctx.fillStyle = '#1a2433';
  ctx.fillRect(x - 5, y - h - 9, 1, 8);
  ctx.fillRect(x + 4, y - h - 9, 1, 8);
  ctx.fillRect(x - 1, y - h - 9, 1, 8);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#2b3a4f';
    ctx.fillRect(x - 6 + i, y - h - 10 - i, 12 - i * 2, 1);
  }
  ctx.fillRect(x, y - h - 17, 1, 2);
  glow(ctx, x, y - h - 5, 18 + Math.sin(t * 3) * 1.5, PAL.gold, 0.8);
  return { lx: x, ly: y - h - 5 };
}

// made-up rune shapes on a 4x6 grid. deliberately not a real alphabet
const RUNES = [
  [[0, 0, 0, 6], [0, 1, 3, 3], [0, 3, 3, 5]],
  [[2, 0, 2, 6], [0, 2, 2, 0], [4, 2, 2, 0], [0, 4, 2, 6], [4, 4, 2, 6]],
  [[0, 0, 0, 6], [4, 0, 4, 6], [0, 2, 4, 4]],
  [[2, 0, 2, 6], [0, 1, 4, 3], [4, 1, 0, 3]],
  [[0, 6, 2, 0], [2, 0, 4, 6], [1, 3, 3, 3]],
  [[0, 0, 4, 6], [4, 0, 0, 6], [2, 0, 2, 6]],
];
export function drawRune(ctx, cx, cy, size, idx, color, width = 1) {
  const R = RUNES[((idx % RUNES.length) + RUNES.length) % RUNES.length];
  const s = size / 6;
  ctx.fillStyle = color;
  for (const [a, b, c, d] of R) stampLine(ctx, cx + (a - 2) * s, cy + (b - 3) * s, cx + (c - 2) * s, cy + (d - 3) * s, width);
}

export function drawStone(ctx, x, y, h, w, rune, glowAmt = 0) {
  const c1 = '#3a4a60';
  const c2 = '#56698a';
  const c3 = '#242f40';
  x = Math.round(x);
  y = Math.round(y);
  for (let i = 0; i < h; i++) {
    const k = i / h;
    const ww = Math.round(w * (k > 0.85 ? Math.sqrt(1 - (k - 0.85) / 0.15) : 1) * (1 - k * 0.12));
    ctx.fillStyle = c1;
    ctx.fillRect(x - Math.floor(ww / 2), y - i, ww, 1);
    ctx.fillStyle = c2;
    ctx.fillRect(x - Math.floor(ww / 2), y - i, Math.max(1, Math.floor(ww * 0.3)), 1);
    ctx.fillStyle = c3;
    ctx.fillRect(x + Math.ceil(ww / 2) - 2, y - i, 2, 1);
  }
  const col = glowAmt > 0.05 ? mix('#1c2636', '#8ffff0', glowAmt) : '#1c2636';
  drawRune(ctx, x, y - h * 0.5, Math.min(w * 0.6, h * 0.35), rune, col, 1);
  if (glowAmt > 0.05) glow(ctx, x, y - h * 0.5, 10 + h * 0.2, PAL.teal, glowAmt * 0.6);
}

const stackCache = new Map();
export function drawStack(ctx, x, baseY, w, h, seed = 1, colors = {}) {
  const key = `${w}|${h}|${seed}|${colors.c1}`;
  let c = stackCache.get(key);
  if (!c) {
    const r = mulberry32(seed);
    let g;
    [c, g] = makeCanvas(w + 8, h + 6);
    const c1 = colors.c1 ?? '#233044';
    const c2 = colors.c2 ?? '#34465f';
    const cg = colors.grass ?? '#3d6b58';
    const ph = r() * TAU;
    for (let i = 0; i < h; i++) {
      const k = i / h;
      const ww = Math.round(w * (1 - k * 0.35) + Math.sin(i * 0.25 + ph) * 2 + (r() < 0.08 ? 2 : 0));
      const x0 = Math.round((w + 8 - ww) / 2 + Math.sin(i * 0.05 + ph) * 2);
      g.fillStyle = c1;
      g.fillRect(x0, h + 6 - i, ww, 1);
      g.fillStyle = c2;
      g.fillRect(x0, h + 6 - i, Math.max(1, Math.round(ww * 0.28)), 1);
    }
    g.fillStyle = cg;
    const topW = Math.round(w * 0.65);
    g.fillRect(Math.round((w + 8 - topW) / 2), 5, topW, 3);
    g.fillRect(Math.round((w + 8 - topW) / 2) + 2, 4, topW - 4, 1);
    stackCache.set(key, c);
  }
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(baseY - c.height));
  ctx.fillStyle = rgba(PAL.foam, 0.6);
  ctx.fillRect(Math.round(x - w / 2 - 3), Math.round(baseY - 1), w + 6, 1);
}

const cloudCache = new Map();
export function drawCloud(ctx, x, y, w, color, seed = 1, alpha = 1) {
  const key = `${w}|${color}|${seed}`;
  let c = cloudCache.get(key);
  if (!c) {
    const r = mulberry32(seed);
    const h = Math.round(w * 0.45);
    let g;
    [c, g] = makeCanvas(w, h);
    g.fillStyle = color;
    const n = 5 + Math.floor(w / 14);
    for (let i = 0; i < n; i++) {
      const cx = w * (0.15 + 0.7 * (i / (n - 1)));
      const rr = (h * 0.35) * (0.6 + r() * 0.6) * (1 - Math.abs(i / (n - 1) - 0.5));
      disc(g, cx, h - rr - 1, rr + 2);
    }
    g.fillRect(Math.round(w * 0.1), h - 3, Math.round(w * 0.8), 3);
    cloudCache.set(key, c);
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height));
  ctx.globalAlpha = 1;
}

// wind ribbons brighten on every beat. it's the main way the tempo shows up with the sound off
export function drawWind(ctx, t, beat, o = {}) {
  const color = o.color ?? '#bfe8ff';
  const alpha = o.alpha ?? 0.35;
  const lanes = o.lanes ?? [0.22, 0.4, 0.58];
  const speed = o.speed ?? 40;
  const rows = o.thick ? 2 : 1;
  for (let i = 0; i < lanes.length; i++) {
    const yb = lanes[i] * H;
    const len = 90 + i * 20;
    const head = ((t * speed * (1 + i * 0.25) + i * 170) % (W + len * 2)) - len;
    const pulse = 0.55 + 0.45 * beat.pulse;
    for (let s = 0; s < len; s += 1) {
      const x = head - s;
      const k = 1 - s / len;
      const y = yb + Math.sin(x * 0.03 + t * 1.2 + i) * 7 + Math.sin(x * 0.011 + i * 2) * 5;
      ctx.globalAlpha = alpha * k * pulse;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), 2, rows);
    }
  }
  ctx.globalAlpha = 1;
}

// brass swell rays
export function drawRays(ctx, cx, cy, t, color, alpha = 0.3, n = 9, len = 420) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i - (n - 1) / 2) / n) * 2.6 + Math.sin(t * 0.4 + i) * 0.03;
    const wA = 0.05 + (i % 3) * 0.02;
    ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(t * 0.8 + i * 1.7));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - wA) * len, cy + Math.sin(a - wA) * len);
    ctx.lineTo(cx + Math.cos(a + wA) * len, cy + Math.sin(a + wA) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// the asset packs only have perched gulls, so flying ones are drawn by hand
export function drawFlyingGull(ctx, x, y, t) {
  const up = Math.sin(t * 9) > 0;
  ctx.fillStyle = '#e8eef4';
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillRect(x - 1, y, 3, 1);
  if (up) {
    ctx.fillRect(x - 3, y - 1, 2, 1);
    ctx.fillRect(x + 2, y - 1, 2, 1);
    ctx.fillRect(x - 4, y - 2, 1, 1);
    ctx.fillRect(x + 4, y - 2, 1, 1);
  } else {
    ctx.fillRect(x - 3, y + 1, 2, 1);
    ctx.fillRect(x + 2, y + 1, 2, 1);
  }
}

// fog with soft holes where the light is. holes: [{ x, y, r, a }], a = how much it clears
const fogCanvases = new Map();
export function drawFog(ctx, w, h, t, holes, alpha) {
  const key = w + 'x' + h;
  let f = fogCanvases.get(key);
  if (!f) {
    f = makeCanvas(w, h);
    fogCanvases.set(key, f);
  }
  const [c, g] = f;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.fillStyle = rgba('#141c2a', alpha);
  g.fillRect(0, 0, w, h);
  // flat drifting banks, round blobs looked like bokeh
  for (let i = 0; i < 16; i++) {
    const sp = 6 + (i % 4) * 4;
    const x = ((i * 67 + t * sp) % (w + 100)) - 50;
    const y = ((i * 41) % h) + Math.sin(t * 0.4 + i) * 6;
    g.fillStyle = rgba(i % 3 ? '#2a3850' : '#2c3a4c', 0.22 * alpha);
    const r = 16 + (i % 5) * 7;
    for (let yy = -r * 0.35; yy <= r * 0.35; yy++) {
      const ww = Math.round(r * 1.8 * Math.sqrt(1 - Math.pow(yy / (r * 0.35), 2)));
      g.fillRect(Math.round(x - ww), Math.round(y + yy), ww * 2, 1);
    }
  }
  g.globalCompositeOperation = 'destination-out';
  for (const hole of holes) {
    const r = Math.max(2, hole.r);
    const grad = g.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, r);
    const a = hole.a ?? 1;
    grad.addColorStop(0, `rgba(0,0,0,${a})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${a * 0.9})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(hole.x - r, hole.y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, 0, 0);
}
