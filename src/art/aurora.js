// the aurora: one ribbon for every guest who made it home, the curtains that are always there, and
// the stars each celebration leaves in the sky
import { VIEW, PAL } from '../config.js';
import { makeCanvas, rgba, clamp, glow } from '../core/util.js';

const { W, H } = VIEW;
export const RIBBON_COLORS = [PAL.teal, PAL.violet, PAL.gold, PAL.rose, '#7fd6ff', PAL.seaGreen];

// one 1px-wide curtain strip per color: bright top edge, fades down like real aurora
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

// stored points are 0..999 ints (smaller localStorage), this maps them into the sky band
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

export function drawRibbon(ctx, pts, color, alpha, t = 0, len = 30) {
  if (pts.length < 2) return;
  const tex = strip(color, len);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.abs(x2 - x1) / 2));
    for (let s = 0; s < steps; s++) {
      const k = s / steps;
      const x = x1 + (x2 - x1) * k;
      const y = y1 + (y2 - y1) * k + Math.sin(x * 0.05 + t * 0.8) * 2;
      const sway = 0.75 + 0.25 * Math.sin(x * 0.13 + t * 1.3);
      ctx.globalAlpha = alpha * sway;
      ctx.drawImage(tex, Math.round(x), Math.round(y), 2, len);
    }
  }
  ctx.restore();
}

// every ribbon from tonight. redrawing 500 of them each frame is too slow so it's cached
// and only rebuilt when a new one gets added
export class AuroraWall {
  constructor(store) {
    this.store = store;
    this.key = '';
    [this.canvas, this.g] = makeCanvas(W, H);
    this.top = 14;
    this.height = 120;
  }
  // hideNewest leaves the newest ribbon(s) out while home is still animating it in
  rebuild(hideNewest) {
    const g = this.g;
    g.clearRect(0, 0, W, H);
    const all = this.store.ribbons;
    const rs = all.slice(0, Math.max(0, all.length - hideNewest));
    const n = rs.length;
    // dimmer per ribbon as the night fills up, otherwise 100+ ribbons blow out to white
    const a = clamp(0.5 * Math.pow(10 / Math.max(10, n), 0.45), 0.12, 0.5);
    rs.forEach((rib, i) => {
      const pts = ribbonSkyPoints(rib, this.top, this.height);
      const fresh = i >= n - 3 ? 1.35 : 1;
      drawRibbon(g, pts, RIBBON_COLORS[rib.h % RIBBON_COLORS.length], a * fresh, i * 0.37, 26 + (i % 4) * 4);
    });
  }
  draw(ctx, t, alpha = 1, hideNewest = 0) {
    const key = this.store.version + '|' + hideNewest;
    if (key !== this.key) {
      this.rebuild(hideNewest);
      this.key = key;
    }
    ctx.save();
    ctx.globalAlpha = alpha * (0.88 + 0.12 * Math.sin(t * 0.7));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.canvas, 0, Math.round(Math.sin(t * 0.3) * 1.5));
    ctx.restore();
  }
}

// always-on curtains so the first guest of the night doesn't see an empty sky
export function drawBaseAurora(ctx, t, alpha = 1, top = 20) {
  const bands = [
    { c: PAL.teal, y: top + 30, amp: 14, f: 0.012, sp: 0.25, a: 0.22 },
    { c: PAL.violet, y: top + 16, amp: 10, f: 0.018, sp: -0.18, a: 0.18 },
    { c: PAL.seaGreen, y: top + 46, amp: 12, f: 0.009, sp: 0.12, a: 0.16 },
  ];
  for (const b of bands) {
    const pts = [];
    for (let x = -10; x <= W + 10; x += 20) pts.push([x, b.y + Math.sin(x * b.f + t * b.sp) * b.amp + Math.sin(x * b.f * 2.7 + t * b.sp * 1.7) * b.amp * 0.4]);
    drawRibbon(ctx, pts, b.c, b.a * alpha, t, 44);
  }
}

// every celebration leaves a bright star in the sky for the rest of the night, so the sky shows
// how many there have been. same spots in every scene, in the strip of sky the attract screen
// leaves open between the title and NEXT FLYER
const STAR_SPOTS = [[196, 12], [226, 30], [254, 8], [284, 26], [208, 40], [240, 18], [270, 42], [298, 10], [186, 28], [260, 32], [218, 6], [292, 40]];
export function drawCelebrationStar(ctx, x, y, t, k = 1, i = 0) {
  const tw = 0.75 + 0.25 * Math.sin(t * 1.3 + i * 1.7); // slow twinkle
  glow(ctx, x, y, 14 * k, PAL.gold2, 0.55 * tw * k);
  ctx.fillStyle = '#fff6d8';
  const arm = Math.round((4 + tw * 2) * k);
  ctx.globalAlpha = Math.min(1, k);
  ctx.fillRect(Math.round(x) - arm, Math.round(y), arm * 2 + 1, 1);
  ctx.fillRect(Math.round(x), Math.round(y) - arm, 1, arm * 2 + 1);
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
  ctx.globalAlpha = 1;
}
// where star i sits. past 12 they start a second layer just below the first
export function celebrationStarSpot(i) {
  const [x, y] = STAR_SPOTS[i % STAR_SPOTS.length];
  const layer = Math.floor(i / STAR_SPOTS.length);
  return { x: x + layer * 7, y: y + layer * 5 };
}
export function drawCelebrationStars(ctx, n, t) {
  for (let i = 0; i < n; i++) {
    const { x, y } = celebrationStarSpot(i);
    drawCelebrationStar(ctx, x, y, t, 1, i);
  }
}

// the whole sky full of aurora, for the celebration. k = 0..1 how full
export function drawFullAurora(ctx, t, k) {
  if (k <= 0) return;
  for (let b = 0; b < 7; b++) {
    const pts = [];
    const y0 = 8 + b * 26;
    for (let x = -10; x <= W + 10; x += 16) pts.push([x, y0 + Math.sin(x * 0.015 + t * (0.5 + b * 0.1) + b) * 14 + Math.sin(x * 0.04 - t * 0.7) * 5]);
    drawRibbon(ctx, pts, RIBBON_COLORS[b % RIBBON_COLORS.length], 0.32 * k, t + b, 50 + (b % 3) * 14);
  }
}
