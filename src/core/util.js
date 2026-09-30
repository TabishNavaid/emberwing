export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const TAU = Math.PI * 2;

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// exponential ease toward a target, same feel at 30 or 144 fps
export const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function mulberry32(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(rng.range(a, b + 1));
  return rng;
}

const rgbCache = new Map();
function hexToRgb(hex) {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
  }
  return c;
}
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  t = clamp(t);
  const r = Math.round(lerp(A[0], B[0], t));
  const g = Math.round(lerp(A[1], B[1], t));
  const bl = Math.round(lerp(A[2], B[2], t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// canvas lines anti-alias on the tiny buffer, so we stamp squares instead
export function stampLine(ctx, x1, y1, x2, y2, w = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  const o = Math.floor(w / 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(lerp(x1, x2, t)) - o, Math.round(lerp(y1, y2, t)) - o, w, w);
  }
}

export function disc(ctx, cx, cy, r) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const rr = r * r;
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, rr - y * y)));
    if (rr - y * y >= 0) ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

// glow() runs hundreds of times a frame (every spark), so gradients get cached per color+size
const glowCache = new Map();
function glowSprite(color, r) {
  const key = color + r;
  let c = glowCache.get(key);
  if (!c) {
    let g;
    [c, g] = makeCanvas(r * 2, r * 2);
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.35, rgba(color, 0.45));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    glowCache.set(key, c);
  }
  return c;
}
export function glow(ctx, x, y, r, color, alpha = 1) {
  r = Math.max(2, Math.round(r));
  const s = glowSprite(color, r);
  const pa = ctx.globalAlpha;
  const pc = ctx.globalCompositeOperation;
  ctx.globalAlpha = pa * clamp(alpha);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(s, Math.round(x - r), Math.round(y - r));
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = pc;
}
