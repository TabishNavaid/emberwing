import { makeCanvas, TAU, clamp } from '../core/util.js';

// Celtic/Nordic interlace, drawn with crisp pixel stamps. Two strands weave
// over-and-under. Used for the trust ring, dwell rings, UI frames and borders:
// the folk influence from the program notes, made visible.

function stamp(ctx, x, y, w) {
  const o = Math.floor(w / 2);
  ctx.fillRect(Math.round(x) - o, Math.round(y) - o, w, w);
}

// progress 0..1 fills clockwise from 12 o'clock in colorOn; the rest colorOff.
export function drawKnotRing(ctx, cx, cy, r, progress = 1, o = {}) {
  const lobes = o.lobes ?? 8;
  const amp = o.amp ?? Math.max(2, r * 0.14);
  const w = o.width ?? 2;
  const on = o.on ?? '#ffc94a';
  const off = o.off ?? 'rgba(255,255,255,0.18)';
  const edge = o.edge ?? '#0b0f1a';
  const N = Math.max(64, Math.round(r * 2 * Math.PI * 1.3));
  const pt = (k, i) => {
    const th = (i / N) * TAU;
    const rr = r + amp * Math.sin(lobes * th + k * Math.PI);
    return [cx + Math.sin(th) * rr, cy - Math.cos(th) * rr, i / N];
  };
  const colorAt = (f) => (f <= progress ? on : off);
  // outline pass
  ctx.fillStyle = edge;
  for (let k = 0; k < 2; k++) for (let i = 0; i < N; i++) { const [x, y] = pt(k, i); stamp(ctx, x, y, w + 2); }
  // color pass
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < N; i++) {
      const [x, y, f] = pt(k, i);
      ctx.fillStyle = colorAt(f);
      stamp(ctx, x, y, w);
    }
  // over-under: at each crossing redraw the "over" strand on top with its edge
  const crossings = lobes * 2;
  const span = Math.round((N / crossings) * 0.32);
  for (let c = 0; c < crossings; c++) {
    const ci = Math.round((c / crossings) * N);
    const k = c % 2;
    ctx.fillStyle = edge;
    for (let i = ci - span; i <= ci + span; i++) { const [x, y] = pt(k, (i + N) % N); stamp(ctx, x, y, w + 2); }
    for (let i = ci - span - 1; i <= ci + span + 1; i++) {
      const [x, y, f] = pt(k, (i + N) % N);
      ctx.fillStyle = colorAt(f);
      stamp(ctx, x, y, w);
    }
  }
}

// A straight woven band (for frames and dividers).
export function drawKnotBand(ctx, x, y, len, o = {}) {
  const vertical = o.vertical ?? false;
  const period = o.period ?? 12;
  const amp = o.amp ?? 2.5;
  const w = o.width ?? 1;
  const color = o.color ?? '#ffc94a';
  const edge = o.edge ?? '#0b0f1a';
  const pt = (k, s) => {
    const off = amp * Math.sin((s / period) * TAU + k * Math.PI);
    return vertical ? [x + off, y + s] : [x + s, y + off];
  };
  ctx.fillStyle = edge;
  for (let k = 0; k < 2; k++) for (let s = 0; s <= len; s += 0.5) { const [a, b] = pt(k, s); stamp(ctx, a, b, w + 2); }
  ctx.fillStyle = color;
  for (let k = 0; k < 2; k++) for (let s = 0; s <= len; s += 0.5) { const [a, b] = pt(k, s); stamp(ctx, a, b, w); }
  const half = period / 2;
  const span = period * 0.16;
  for (let c = 0, s0 = 0; s0 <= len; c++, s0 += half) {
    const k = c % 2;
    ctx.fillStyle = edge;
    for (let s = s0 - span; s <= s0 + span; s += 0.5) { if (s < 0 || s > len) continue; const [a, b] = pt(k, s); stamp(ctx, a, b, w + 2); }
    ctx.fillStyle = color;
    for (let s = s0 - span - 1; s <= s0 + span + 1; s += 0.5) { if (s < 0 || s > len) continue; const [a, b] = pt(k, s); stamp(ctx, a, b, w); }
  }
}

// A woven frame with little triquetra-ish corner knots. Cached per size/color.
const frameCache = new Map();
export function drawKnotFrame(ctx, x, y, w, h, o = {}) {
  const color = o.color ?? '#ffc94a';
  const fill = o.fill ?? null;
  const key = `${w}|${h}|${color}|${fill}`;
  let c = frameCache.get(key);
  if (!c) {
    let g;
    const pad = 6;
    [c, g] = makeCanvas(w + pad * 2, h + pad * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fillRect(pad, pad, w, h);
    }
    drawKnotBand(g, pad, pad, w, { color });
    drawKnotBand(g, pad, pad + h, w, { color });
    drawKnotBand(g, pad, pad, h, { color, vertical: true });
    drawKnotBand(g, pad + w, pad, h, { color, vertical: true });
    for (const [cx, cy] of [[pad, pad], [pad + w, pad], [pad, pad + h], [pad + w, pad + h]]) {
      drawKnotRing(g, cx, cy, 4, 1, { lobes: 3, amp: 2, width: 1, on: color, off: color });
    }
    c.pad = pad;
    frameCache.set(key, c);
  }
  ctx.drawImage(c, Math.round(x - c.pad), Math.round(y - c.pad));
}

// Clamp helper for progress displays
export const prog = (v) => clamp(v);
