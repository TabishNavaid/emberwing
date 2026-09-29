import { makeCanvas, TAU } from '../core/util.js';
import { PAL } from '../config.js';

// Ember: an original little dragon. Round ember-orange body, big eyes, short
// snout, perky fin-ears, teal wing membranes that glow once it trusts you.
// Drawn with canvas paths into a small sprite, then hard-thresholded to crisp
// pixels and given a 1px outline. Every pose is cached.

export const SPRITE_W = 76;
export const SPRITE_H = 72;
export const ANCHOR_X = 36; // body center inside the sprite
export const ANCHOR_Y = 46;

const OX = 6; // design-space offset into the sprite
const OY = 12;

export const EMBER_COLORS = {
  body: PAL.ember,
  body2: PAL.ember2,
  body3: PAL.ember3,
  belly: PAL.belly,
  stripe: '#f0b870',
  horn: PAL.cream,
  wingDark: '#2c4f5a',
  wingMid: '#249d96',
  wingLit: PAL.teal,
  vein: '#c8fff6',
  outline: '#2a140e',
};

// Flock-mates share Ember's shape with their own colors (all original).
export const FLOCK_COLORS = [
  { body: '#8a6cff', body2: '#5b3fb0', body3: '#b49cff', belly: '#e6dcff', stripe: '#cbbcff', wingLit: '#ffd26a', wingMid: '#d9a640', vein: '#fff4c8', outline: '#1d1238' },
  { body: '#2fb9a6', body2: '#1b7a70', body3: '#6fe0cf', belly: '#d8fff5', stripe: '#a9eee2', wingLit: '#ff9ed0', wingMid: '#d56a9f', vein: '#ffe2f1', outline: '#0e2a28' },
  { body: '#ffc34a', body2: '#c98a1f', body3: '#ffe08e', belly: '#fff4d2', stripe: '#ffe0a0', wingLit: '#8ad8ff', wingMid: '#4a98c8', vein: '#e8f8ff', outline: '#3a2408' },
  { body: '#ff8fb0', body2: '#c95a7c', body3: '#ffc0d2', belly: '#fff0f4', stripe: '#ffd0de', wingLit: '#9df06a', wingMid: '#5aa83a', vein: '#efffe0', outline: '#3a1020' },
];

const cache = new Map();

function ellipse(g, x, y, rx, ry, color, rot = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fill();
}
function poly(g, pts, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}
function line(g, x1, y1, x2, y2, color, w = 1) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

// Wing angles (radians, 0 = straight back, positive = raised)
const WING = {
  folded: { a: 1.0, len: [11, 9, 6], spread: 0.35 },
  up: { a: 1.25, len: [22, 19, 14], spread: 0.32 },
  mid: { a: 0.45, len: [23, 20, 15], spread: 0.4 },
  down: { a: -0.45, len: [20, 17, 13], spread: 0.36 },
  burst: { a: 0.9, len: [25, 22, 17], spread: 0.55 },
};

function drawWing(g, sx, sy, pose, membrane, bone, vein, scale = 1) {
  const W = WING[pose];
  const tips = [W.a + W.spread, W.a, W.a - W.spread].map((ang, i) => {
    const L = W.len[i] * scale;
    return [sx - Math.cos(ang) * L, sy - Math.sin(ang) * L];
  });
  // scalloped membrane between finger tips
  const mid = (a, b, k) => [sx + ((a[0] + b[0]) / 2 - sx) * k, sy + ((a[1] + b[1]) / 2 - sy) * k];
  const root = [sx - 7 * scale, sy + 4 * scale];
  poly(g, [[sx, sy], tips[0], mid(tips[0], tips[1], 0.72), tips[1], mid(tips[1], tips[2], 0.72), tips[2], root], membrane);
  if (vein) for (const t of tips) line(g, sx, sy, (sx + t[0]) / 2, (sy + t[1]) / 2, vein, 1);
  // arm + finger bones
  line(g, sx, sy, tips[0][0], tips[0][1], bone, 1.6);
  line(g, sx, sy, tips[1][0], tips[1][1], bone, 1.1);
  line(g, sx, sy, tips[2][0], tips[2][1], bone, 1.1);
  // little thumb claw
  const c = tips[0];
  g.fillStyle = '#fff3d6';
  g.fillRect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 2, 2);
}

function render(o) {
  const C = { ...EMBER_COLORS, ...(o.colors || {}) };
  const [raw, g] = makeCanvas(SPRITE_W, SPRITE_H);
  g.imageSmoothingEnabled = true;
  g.translate(OX, OY);

  const mood = o.mood;
  const glow = o.glow; // 0 dark, 1 warming, 2 fully lit
  const membrane = glow >= 2 ? C.wingLit : glow === 1 ? C.wingMid : C.wingDark;
  const membraneFar = glow >= 2 ? C.wingMid : '#213a44';
  const vein = glow >= 2 ? C.vein : null;
  const wing = o.wing;

  // --- tail: a curl with a little flame-tuft tip
  const curl = mood === 'scared' ? 1.4 : mood === 'fly' ? 0.4 : 1.0;
  let tx = 20, ty = 38;
  const segs = 12;
  let ang = Math.PI * 0.95;
  for (let i = 0; i < segs; i++) {
    const r = 4.2 - (i / segs) * 3;
    ellipse(g, tx, ty, r, r, i < 3 ? C.body : C.body2);
    ang -= 0.16 * curl;
    tx += Math.cos(ang) * 1.9;
    ty += Math.sin(ang) * 1.9 * (mood === 'fly' ? 0.4 : 1);
  }
  poly(g, [[tx - 3, ty], [tx, ty - 5], [tx + 3, ty], [tx, ty + 2]], PAL.gold);

  // --- far wing (behind)
  drawWing(g, 27, 27, wing, membraneFar, C.body2, null, 0.85);

  // --- legs
  ellipse(g, 24, 42, 3.4, 3.2, C.body2);
  ellipse(g, 35, 43, 3, 3, C.body2);
  g.fillStyle = C.horn;
  g.fillRect(34, 45, 1, 1);
  g.fillRect(36, 45, 1, 1);
  g.fillRect(23, 44, 1, 1);
  g.fillRect(25, 44, 1, 1);

  // --- body
  ellipse(g, 28, 35, 11.5, 9.5, C.body);
  ellipse(g, 27, 39, 10, 5.5, C.body2);
  ellipse(g, 29, 35, 10.5, 7, C.body);
  ellipse(g, 26, 30, 6, 2.6, C.body3);
  // back fins
  for (const [x, y] of [[17, 29], [21, 26], [26, 25]]) poly(g, [[x - 2.5, y + 2], [x - 1, y - 3], [x + 2.5, y + 1.5]], C.body2);
  // belly
  ellipse(g, 32.5, 38, 6.5, 5.5, C.belly);
  line(g, 28.5, 36.5, 36.5, 36.5, C.stripe, 1);
  line(g, 29, 39.5, 36, 39.5, C.stripe, 1);

  // --- near wing
  drawWing(g, 29, 29, wing, membrane, C.body2, vein, 1);

  // --- head
  const hx = 41, hy = 24;
  const earUp = mood === 'scared' ? -0.6 : mood === 'curious' ? 0.2 : 0.7;
  // fin-ears (lit with the wings)
  for (const [ex, ey, s] of [[33, 18, 1], [37, 16, 0.8]]) {
    const L = 9 * s;
    const a = Math.PI * 0.85 - earUp * 0.6;
    const tip = [ex + Math.cos(a) * L, ey - Math.sin(a) * L];
    poly(g, [[ex + 1.5, ey + 2.5], tip, [ex - 3, ey + 3]], membrane);
    line(g, ex, ey + 2, tip[0], tip[1], C.body2, 1);
  }
  ellipse(g, hx, hy, 10.5, 9.5, C.body);
  ellipse(g, hx - 1, hy - 5, 5.5, 2.4, C.body3);
  // horns
  poly(g, [[37, 16], [35, 10], [40, 15]], C.horn);
  poly(g, [[42, 15], [42.5, 9], [45.5, 15]], C.horn);
  // snout
  ellipse(g, 50, 27.5, 5.5, 4.2, C.body3);
  g.fillStyle = C.body2;
  g.fillRect(53, 25, 1, 1);
  // cheek blush
  g.fillStyle = PAL.rose;
  g.fillRect(44, 30, 3, 1);

  // eyes
  const look = o.look | 0;
  const eyes = [[45.5, 22.5, 1], [38.5, 22.5, 0.82]];
  for (const [ex, ey, s] of eyes) {
    if (o.blink || mood === 'happy') {
      // closed / smiling ^ ^ eyes
      g.strokeStyle = '#1b1030';
      g.lineWidth = 1.2;
      g.beginPath();
      if (o.blink) {
        g.moveTo(ex - 3 * s, ey + 1);
        g.lineTo(ex + 3 * s, ey + 1);
      } else {
        g.moveTo(ex - 3 * s, ey + 1.5);
        g.quadraticCurveTo(ex, ey - 3, ex + 3 * s, ey + 1.5);
      }
      g.stroke();
      continue;
    }
    const big = mood === 'scared' ? 1.08 : 1;
    ellipse(g, ex, ey, 3.6 * s * big, 4.6 * s * big, '#ffffff');
    const pr = mood === 'scared' ? 1.5 : 2.5;
    ellipse(g, ex + look * 0.9 * s, ey + 0.6, pr * s, (pr + 0.9) * s, '#1b1030');
    if (mood !== 'scared') ellipse(g, ex + look * 0.9 * s, ey + 1.2, pr * 0.55 * s, pr * 0.7 * s, glow >= 2 ? '#1f8f86' : '#3a2a5a');
    g.fillStyle = '#ffffff';
    g.fillRect(Math.round(ex - 1.5 * s + look * 0.7), Math.round(ey - 2.5 * s), 2, 2);
  }
  // mouth
  g.strokeStyle = '#3a1410';
  g.lineWidth = 1;
  g.beginPath();
  if (mood === 'scared') {
    g.moveTo(47, 31);
    g.lineTo(52, 30.5);
  } else if (mood === 'fly' || mood === 'joy') {
    g.moveTo(46.5, 30);
    g.quadraticCurveTo(50, 34.5, 53.5, 30);
    g.fillStyle = '#b8323a';
    g.fill();
  } else {
    g.moveTo(46.5, 30.5);
    g.quadraticCurveTo(50, 33, 53, 30.5);
  }
  g.stroke();

  // --- crisp-ify: hard alpha threshold
  const img = g.getImageData(0, 0, SPRITE_W, SPRITE_H);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(img, 0, 0);

  // --- 1px outline around the silhouette
  const [sil, sg] = makeCanvas(SPRITE_W, SPRITE_H);
  sg.drawImage(raw, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = C.outline;
  sg.fillRect(0, 0, SPRITE_W, SPRITE_H);
  const [out, og] = makeCanvas(SPRITE_W, SPRITE_H);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) og.drawImage(sil, dx, dy);
  og.drawImage(raw, 0, 0);
  return out;
}

export function emberFrame(o) {
  const opts = {
    mood: o.mood ?? 'curious',
    wing: o.wing ?? 'folded',
    glow: o.glow ?? 2,
    blink: !!o.blink,
    look: o.look ?? 0,
    colors: o.colors ?? null,
    ci: o.ci ?? -1,
  };
  const key = `${opts.mood}|${opts.wing}|${opts.glow}|${opts.blink}|${opts.look}|${opts.ci}`;
  let c = cache.get(key);
  if (!c) {
    c = render(opts);
    cache.set(key, c);
  }
  return c;
}

// Wing pose for a flap cycle at phase 0..1
export function flapPose(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.25) return 'up';
  if (p < 0.5) return 'mid';
  if (p < 0.75) return 'down';
  return 'mid';
}

// Draw centered on the body. sx/sy = squash & stretch, rot in radians.
export function drawEmber(ctx, x, y, o = {}) {
  const frame = emberFrame(o);
  const s = o.scale ?? 1;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flip ? -1 : 1) * s * (o.sx ?? 1), s * (o.sy ?? 1));
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.drawImage(frame, -ANCHOR_X, -ANCHOR_Y);
  ctx.restore();
}

// Midpoint between Ember's eyes, relative to its draw position.
export function eyeOffset(scale = 1, flip = false) {
  return { x: 12 * scale * (flip ? -1 : 1), y: -11 * scale };
}
