import { makeCanvas, TAU } from '../core/util.js';

// celtic/nordic interlace for rings, meters and frames (the folk influence from the program notes).
// canvas strokes go blurry at 480x270 so everything is stamped square by square

function stamp(ctx, x, y, w) {
  const o = Math.floor(w / 2);
  ctx.fillRect(Math.round(x) - o, Math.round(y) - o, w, w);
}

// two strands along a path. pt(k, u) -> [x, y, f] for strand k at position u.
// pass 1 dark edges, pass 2 colour, then at every crossing the "over" strand gets
// redrawn on top (alternating), which is what makes it read as woven
function weave(ctx, pt, { len, step, closed, crossAt, span, w, colorAt, edge }) {
  const us = [];
  for (let u = 0; closed ? u < len : u <= len; u += step) us.push(u);
  ctx.fillStyle = edge;
  for (let k = 0; k < 2; k++) for (const u of us) { const [x, y] = pt(k, u); stamp(ctx, x, y, w + 2); }
  for (let k = 0; k < 2; k++) for (const u of us) { const [x, y, f] = pt(k, u); ctx.fillStyle = colorAt(f); stamp(ctx, x, y, w); }
  crossAt.forEach((c, i) => {
    const k = i % 2;
    const run = (pad, width, fill) => {
      for (let u = c - span - pad; u <= c + span + pad; u += step) {
        let v = u;
        if (closed) v = (v + len) % len;
        else if (v < 0 || v > len) continue;
        const [x, y, f] = pt(k, v);
        ctx.fillStyle = fill ?? colorAt(f);
        stamp(ctx, x, y, width);
      }
    };
    run(0, w + 2, edge);
    run(1, w, null);
  });
}

// progress 0..1 fills clockwise from 12 o'clock
export function drawKnotRing(ctx, cx, cy, r, progress = 1, o = {}) {
  const lobes = o.lobes ?? 8;
  const amp = o.amp ?? Math.max(2, r * 0.14);
  const on = o.on ?? '#ffc94a';
  const off = o.off ?? 'rgba(255,255,255,0.18)';
  const N = Math.max(64, Math.round(r * 2 * Math.PI * 1.3));
  const crossings = lobes * 2;
  weave(ctx, (k, i) => {
    const th = (i / N) * TAU;
    const rr = r + amp * Math.sin(lobes * th + k * Math.PI);
    return [cx + Math.sin(th) * rr, cy - Math.cos(th) * rr, i / N];
  }, {
    len: N,
    step: 1,
    closed: true,
    crossAt: Array.from({ length: crossings }, (_, c) => Math.round((c / crossings) * N)),
    span: Math.round((N / crossings) * 0.32),
    w: o.width ?? 2,
    colorAt: (f) => (f <= progress ? on : off),
    edge: o.edge ?? '#0b0f1a',
  });
}

// straight woven band for frames and dividers
export function drawKnotBand(ctx, x, y, len, o = {}) {
  const vertical = o.vertical ?? false;
  const period = o.period ?? 10;
  const amp = o.amp ?? 2;
  const color = o.color ?? '#ffc94a';
  const crossAt = [];
  for (let s0 = 0; s0 <= len; s0 += period / 2) crossAt.push(s0);
  weave(ctx, (k, s) => {
    const off = amp * Math.sin((s / period) * TAU + k * Math.PI);
    return vertical ? [x + off, y + s] : [x + s, y + off];
  }, { len, step: 0.5, closed: false, crossAt, span: period * 0.16, w: o.width ?? 1, colorAt: () => color, edge: o.edge ?? '#0b0f1a' });
}

// frames are expensive to stamp, so each size/color gets drawn once and cached
const frameCache = new Map();
export function drawKnotFrame(ctx, x, y, w, h, o = {}) {
  const color = o.color ?? '#ffc94a';
  const key = `${w}|${h}|${color}`;
  let c = frameCache.get(key);
  if (!c) {
    let g;
    const pad = 6;
    [c, g] = makeCanvas(w + pad * 2, h + pad * 2);
    const band = { color, period: 12, amp: 2.5 };
    drawKnotBand(g, pad, pad, w, band);
    drawKnotBand(g, pad, pad + h, w, band);
    drawKnotBand(g, pad, pad, h, { ...band, vertical: true });
    drawKnotBand(g, pad + w, pad, h, { ...band, vertical: true });
    for (const [cx, cy] of [[pad, pad], [pad + w, pad], [pad, pad + h], [pad + w, pad + h]]) {
      drawKnotRing(g, cx, cy, 4, 1, { lobes: 3, amp: 2, width: 1, on: color, off: color });
    }
    c.pad = pad;
    frameCache.set(key, c);
  }
  ctx.drawImage(c, Math.round(x - c.pad), Math.round(y - c.pad));
}
