import { VIEW, PAL } from '../config.js';
import { makeCanvas, rgba, clamp } from '../core/util.js';

const { W, H } = VIEW;
export const RIBBON_COLORS = [PAL.teal, PAL.violet, PAL.gold, PAL.rose, '#7fd6ff', PAL.seaGreen];

// A vertical curtain strip texture per color (bright top edge fading down).
const stripCache = new Map();
function strip(color, len) {
  const key = color + len;
  let c = stripCache.get(key);
  if (!c) {
    let g;
    [c, g] = makeCanvas(1, len);
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, rgba(color, 0));
    grad.addColorStop(0.08, rgba(color, 1));
    grad.addColorStop(0.3, rgba(color, 0.55));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 1, len);
    stripCache.set(key, c);
  }
  return c;
}

// Resample a ribbon's stored points into sky coordinates.
export function ribbonSkyPoints(rib, top, height) {
  const p = rib.p;
  const n = p.length / 2;
  const out = [];
  const x0 = rib.o * W;
  const span = rib.w * W;
  const yOff = top + rib.v * height * 0.55;
  for (let i = 0; i < n; i++) {
    const nx = p[i * 2] / 999;
    const ny = p[i * 2 + 1] / 999;
    out.push([x0 + nx * span, yOff + (ny - 0.5) * height * 0.45]);
  }
  return out;
}

// Draw one curtain ribbon along points. reveal 0..1 draws it partially.
export function drawRibbon(ctx, pts, color, alpha, t = 0, reveal = 1, len = 30) {
  if (pts.length < 2) return;
  const tex = strip(color, len);
  const pc = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const total = pts.length - 1;
  const last = total * clamp(reveal);
  for (let i = 0; i < last; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[Math.min(i + 1, total)];
    const steps = Math.max(1, Math.ceil(Math.abs(x2 - x1) / 2));
    const frac = Math.min(1, last - i);
    for (let s = 0; s < steps * frac; s++) {
      const k = s / steps;
      const x = x1 + (x2 - x1) * k;
      const y = y1 + (y2 - y1) * k + Math.sin(x * 0.05 + t * 0.8) * 2;
      const sway = 0.75 + 0.25 * Math.sin(x * 0.13 + t * 1.3);
      ctx.globalAlpha = alpha * sway;
      ctx.drawImage(tex, Math.round(x), Math.round(y), 2, len);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = pc;
}

// The evening's wall: every stored ribbon, cached to a canvas until a new one arrives.
export class AuroraWall {
  constructor(store) {
    this.store = store;
    this.key = '';
    [this.canvas, this.g] = makeCanvas(W, H);
    this.top = 14;
    this.height = 120;
  }
  // `hideNewest` leaves the newest N ribbons out (Home animates the new one in).
  rebuild(hideNewest) {
    const g = this.g;
    g.clearRect(0, 0, W, H);
    const all = this.store.ribbons;
    const rs = all.slice(0, Math.max(0, all.length - hideNewest));
    const n = rs.length;
    const a = clamp(0.5 * Math.pow(10 / Math.max(10, n), 0.45), 0.12, 0.5);
    rs.forEach((rib, i) => {
      const pts = ribbonSkyPoints(rib, this.top, this.height);
      const fresh = i >= n - 3 ? 1.35 : 1;
      drawRibbon(g, pts, RIBBON_COLORS[rib.h % RIBBON_COLORS.length], a * fresh, i * 0.37, 1, 26 + (i % 4) * 4);
    });
  }
  draw(ctx, t, alpha = 1, hideNewest = 0) {
    const key = this.store.version + '|' + hideNewest;
    if (key !== this.key) {
      this.rebuild(hideNewest);
      this.key = key;
    }
    ctx.globalAlpha = alpha * (0.88 + 0.12 * Math.sin(t * 0.7));
    const pc = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.canvas, 0, Math.round(Math.sin(t * 0.3) * 1.5));
    ctx.globalCompositeOperation = pc;
    ctx.globalAlpha = 1;
  }
}

// A few always-on background curtains, so even the first guest of the night
// sees a living aurora.
export function drawBaseAurora(ctx, t, alpha = 1, top = 20) {
  const bands = [
    { c: PAL.teal, y: top + 30, amp: 14, f: 0.012, sp: 0.25, a: 0.22 },
    { c: PAL.violet, y: top + 16, amp: 10, f: 0.018, sp: -0.18, a: 0.18 },
    { c: PAL.seaGreen, y: top + 46, amp: 12, f: 0.009, sp: 0.12, a: 0.16 },
  ];
  for (const b of bands) {
    const pts = [];
    for (let x = -10; x <= W + 10; x += 20) pts.push([x, b.y + Math.sin(x * b.f + t * b.sp) * b.amp + Math.sin(x * b.f * 2.7 + t * b.sp * 1.7) * b.amp * 0.4]);
    drawRibbon(ctx, pts, b.c, b.a * alpha, t, 1, 44);
  }
}
