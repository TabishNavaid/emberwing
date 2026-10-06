import { makeCanvas, TAU, glow } from '../core/util.js';
import { PAL } from '../config.js';

// dragons are drawn with normal canvas paths, then the alpha gets hard-thresholded so the
// edges come out as crisp pixels, then a 1px outline goes around it. way easier to tweak
// than hand-placing pixels. every dragon + pose combo gets cached after the first draw.
// the parts (wings, head, tail tip, markings) come from src/core/dragons.js

const SPRITE_W = 76;
const SPRITE_H = 72;
const ANCHOR_X = 36; // body center inside the sprite
const ANCHOR_Y = 46;

const OX = 6; // room for the wings when they're up
const OY = 12;

const cache = new Map();

function ellipse(g, x, y, rx, ry, color, rot = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
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

// radians, 0 = straight back, positive = raised
const WING = {
  folded: { a: 1.0, len: [11, 9, 6], spread: 0.35 },
  up: { a: 1.25, len: [22, 19, 14], spread: 0.32 },
  mid: { a: 0.45, len: [23, 20, 15], spread: 0.4 },
  down: { a: -0.45, len: [20, 17, 13], spread: 0.36 },
  burst: { a: 0.9, len: [25, 22, 17], spread: 0.55 },
};

// c = { mem, alt, bone, vein }. every shape uses the same three tip angles so the flap
// animation works the same for all of them
function drawWing(g, sx, sy, pose, shape, c, scale = 1) {
  const P = WING[pose];
  const tips = [P.a + P.spread, P.a, P.a - P.spread].map((ang, i) => {
    const L = P.len[i] * scale;
    return [sx - Math.cos(ang) * L, sy - Math.sin(ang) * L];
  });
  const root = [sx - 7 * scale, sy + 4 * scale];
  const out = (a, b, k) => [sx + ((a[0] + b[0]) / 2 - sx) * k, sy + ((a[1] + b[1]) / 2 - sy) * k];

  if (shape === 'leaf') {
    // one rounded petal, bulging out between the tips
    g.fillStyle = c.mem;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(tips[0][0], tips[0][1]);
    let k = out(tips[0], tips[1], 1.2);
    g.quadraticCurveTo(k[0], k[1], tips[1][0], tips[1][1]);
    k = out(tips[1], tips[2], 1.2);
    g.quadraticCurveTo(k[0], k[1], tips[2][0], tips[2][1]);
    k = out(tips[2], root, 1.1);
    g.quadraticCurveTo(k[0], k[1], root[0], root[1]);
    g.closePath();
    g.fill();
    line(g, sx, sy, tips[1][0], tips[1][1], c.bone, 1.2);
    if (c.vein) for (const t of [tips[0], tips[2]]) line(g, (sx + tips[1][0]) / 2, (sy + tips[1][1]) / 2, (sx + t[0] * 2) / 3, (sy + t[1] * 2) / 3, c.vein, 1);
    line(g, sx, sy, tips[0][0], tips[0][1], c.bone, 1.4);
  } else if (shape === 'feather') {
    // four long feathers fanned out, alternating shades, back ones first
    for (let i = 3; i >= 0; i--) {
      const f = i / 3;
      const ang = P.a + P.spread * 1.15 - f * P.spread * 2.3;
      const L = (P.len[0] + (P.len[2] - P.len[0]) * f) * scale * 1.08;
      const cx = sx - Math.cos(ang) * L * 0.55;
      const cy = sy - Math.sin(ang) * L * 0.55;
      ellipse(g, cx, cy, L * 0.55, 2.7 * scale, i % 2 ? c.alt : c.mem, ang);
      if (c.vein) line(g, sx - Math.cos(ang) * L * 0.2, sy - Math.sin(ang) * L * 0.2, sx - Math.cos(ang) * L * 0.85, sy - Math.sin(ang) * L * 0.85, c.vein, 1);
    }
    line(g, sx, sy, tips[0][0], tips[0][1], c.bone, 1.6);
  } else if (shape === 'moth') {
    // big round fore-lobe + small hind-lobe, with an eyespot
    const a1 = P.a + P.spread * 0.5;
    const L1 = P.len[0] * scale;
    const c1 = [sx - Math.cos(a1) * L1 * 0.55, sy - Math.sin(a1) * L1 * 0.55];
    const a2 = P.a - P.spread * 1.1;
    const L2 = P.len[2] * scale;
    const c2 = [sx - Math.cos(a2) * L2 * 0.55, sy - Math.sin(a2) * L2 * 0.55];
    ellipse(g, c2[0], c2[1], L2 * 0.5, L2 * 0.34, c.alt, a2);
    ellipse(g, c1[0], c1[1], L1 * 0.52, L1 * 0.36, c.mem, a1);
    if (L1 > 12) {
      const ex = c1[0] - Math.cos(a1) * L1 * 0.15;
      const ey = c1[1] - Math.sin(a1) * L1 * 0.15;
      ellipse(g, ex, ey, 2.4 * scale, 2.4 * scale, c.vein || c.alt);
      ellipse(g, ex, ey, 1.1 * scale, 1.1 * scale, c.bone);
    }
    line(g, sx, sy, tips[0][0], tips[0][1], c.bone, 1.4);
  } else {
    // bat: three fingers with scalloped membrane between them
    poly(g, [[sx, sy], tips[0], out(tips[0], tips[1], 0.72), tips[1], out(tips[1], tips[2], 0.72), tips[2], root], c.mem);
    if (c.vein) for (const t of tips) line(g, sx, sy, (sx + t[0]) / 2, (sy + t[1]) / 2, c.vein, 1);
    line(g, sx, sy, tips[0][0], tips[0][1], c.bone, 1.6);
    line(g, sx, sy, tips[1][0], tips[1][1], c.bone, 1.1);
    line(g, sx, sy, tips[2][0], tips[2][1], c.bone, 1.1);
  }
  const t0 = tips[0];
  g.fillStyle = '#fff3d6';
  g.fillRect(Math.round(t0[0]) - 1, Math.round(t0[1]) - 1, 2, 2);
}

function drawTailTip(g, kind, tx, ty, C) {
  if (kind === 'spade') {
    poly(g, [[tx - 3.6, ty + 1], [tx, ty - 5.5], [tx + 3.6, ty + 1]], C.tip);
    ellipse(g, tx - 1.9, ty + 1.2, 1.9, 1.9, C.tip);
    ellipse(g, tx + 1.9, ty + 1.2, 1.9, 1.9, C.tip);
  } else if (kind === 'flame') {
    ellipse(g, tx - 2.6, ty - 1.5, 1.4, 3, C.wingLit, -0.4);
    ellipse(g, tx + 2.6, ty - 1.5, 1.4, 3, PAL.amber, 0.4);
    ellipse(g, tx, ty - 3, 2, 4.2, C.tip);
  } else if (kind === 'leaf') {
    ellipse(g, tx - 1, ty - 3, 2.4, 5, C.tip, -0.5);
    line(g, tx + 0.5, ty + 0.5, tx - 2, ty - 6, C.body2, 1);
  } else if (kind === 'puff') {
    ellipse(g, tx - 2.2, ty, 2.2, 2.2, C.belly);
    ellipse(g, tx + 2.2, ty, 2.2, 2.2, C.belly);
    ellipse(g, tx, ty - 2.4, 2.8, 2.8, C.belly);
  } else if (kind === 'fork') {
    poly(g, [[tx - 1, ty + 1], [tx - 4.5, ty - 5], [tx + 0.5, ty - 1.5]], C.tip);
    poly(g, [[tx + 1, ty + 1], [tx + 4.5, ty - 4], [tx - 0.5, ty - 1.5]], C.tip);
  } else {
    poly(g, [[tx - 3, ty], [tx, ty - 5], [tx + 3, ty], [tx, ty + 2]], C.tip);
  }
}

// things behind the head (frill, crest). up = how perky, 0 flat (scared) .. 1 proud.
// each head has its own silhouette so they still tell apart from across the lobby
function drawHeadBack(g, d, C, up) {
  if (d.head === 'frill') {
    // a big round ruff around the back of the head, like a frilled lizard
    const L = 9 + up * 5;
    const spines = [-3.5, -3.05, -2.6, -2.15, -1.7, -1.25, -0.85];
    const tips = spines.map((a) => [37 + Math.cos(a) * L, 22 + Math.sin(a) * L]);
    poly(g, [[39, 30], ...tips, [44, 18]], C.accent);
    for (const [x, y] of tips) ellipse(g, x, y, 2.2, 2.2, C.accent);
    for (const [x, y] of tips) line(g, 37, 22, x, y, C.body2, 1);
  } else if (d.head === 'crest') {
    // one tall sail from the forehead down the neck
    const h = 0.6 + up * 0.4;
    const pts = [[45, 16], [42, 16 - 12 * h], [37, 16 - 13 * h], [31, 18 - 9 * h], [25, 23 - 4 * h], [26, 25], [36, 18]];
    poly(g, pts, C.accent);
    for (const [x, y] of [[42, 16 - 12 * h], [37, 16 - 13 * h], [31, 18 - 9 * h]]) line(g, x, y, x + 1.5, 19, C.body2, 1);
  }
}

// things on top of the head (horns, curls, antlers)
function drawHeadTop(g, d, C) {
  if (d.head === 'curls') {
    // ram horns: a fat spiral of discs curling back and down beside the face
    for (const [cx, cy, s] of [[44, 17, 0.7], [35.5, 18.5, 1]]) {
      for (let k = 0; k <= 12; k++) {
        const a = -Math.PI * 0.4 - k * 0.5;
        const r = (6 - k * 0.38) * s;
        const rr = (2.3 - k * 0.1) * s;
        ellipse(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, rr, rr, k % 4 === 3 ? '#cdb894' : C.horn);
      }
    }
  } else if (d.head === 'antlers') {
    const c = '#e8d8b0';
    line(g, 37.5, 16, 34, 6, c, 2);
    line(g, 35.6, 11, 39.5, 8, c, 1.5);
    line(g, 34.5, 8, 30.5, 6.5, c, 1.4);
    line(g, 42.5, 15, 43.5, 5.5, c, 1.8);
    line(g, 43, 10, 47, 7.5, c, 1.4);
  } else if (d.head === 'horns') {
    poly(g, [[36.5, 16.5], [34, 8.5], [40.5, 15]], C.horn);
    poly(g, [[42, 15], [42.5, 7.5], [46, 15]], C.horn);
  }
}

function render(d, o) {
  const C = d.colors;
  const [raw, g] = makeCanvas(SPRITE_W, SPRITE_H);
  g.imageSmoothingEnabled = true;
  g.translate(OX, OY);

  const mood = o.mood;
  const lit = o.glow; // 0 dark (lost), 1 warming up, 2 fully lit
  const membrane = lit >= 2 ? C.wingLit : lit === 1 ? C.wingMid : C.wingDark;
  const membraneFar = lit >= 2 ? C.wingMid : '#213a44';
  const alt = lit >= 2 ? C.wingMid : lit === 1 ? C.wingDark : '#1c3038';
  const vein = lit >= 2 ? C.vein : null;
  const wing = o.wing;

  // tail curls up tighter when scared, stretches out when flying
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
  drawTailTip(g, d.tail, tx, ty, C);

  drawWing(g, 27, 27, wing, d.wing, { mem: membraneFar, alt: '#1c3038', bone: C.body2, vein: null }, 0.85);

  ellipse(g, 24, 42, 3.4, 3.2, C.body2);
  ellipse(g, 35, 43, 3, 3, C.body2);
  g.fillStyle = C.horn;
  g.fillRect(34, 45, 1, 1);
  g.fillRect(36, 45, 1, 1);
  g.fillRect(23, 44, 1, 1);
  g.fillRect(25, 44, 1, 1);

  ellipse(g, 28, 35, 11.5, 9.5, C.body);
  ellipse(g, 27, 39, 10, 5.5, C.body2);
  ellipse(g, 29, 35, 10.5, 7, C.body);
  ellipse(g, 26, 30, 6, 2.6, C.body3);
  for (const [x, y] of [[17, 29], [21, 26], [26, 25]]) poly(g, [[x - 2.5, y + 2], [x - 1, y - 3], [x + 2.5, y + 1.5]], C.body2);
  if (d.mark === 'spots') {
    for (const [x, y, r] of [[21, 32, 1.8], [17, 36, 1.5], [25.5, 29.5, 1.4], [22.5, 37.5, 1.3]]) ellipse(g, x, y, r, r, C.mark);
  } else if (d.mark === 'bands') {
    for (const [x, y] of [[16, 31], [20.5, 28.5], [25, 27]]) line(g, x, y, x + 1.5, y + 7, C.mark, 2);
  }
  ellipse(g, 32.5, 38, 6.5, 5.5, C.belly);
  line(g, 28.5, 36.5, 36.5, 36.5, C.stripe, 1);
  line(g, 29, 39.5, 36, 39.5, C.stripe, 1);

  drawWing(g, 29, 29, wing, d.wing, { mem: membrane, alt, bone: C.body2, vein }, 1);

  const hx = 41, hy = 24;
  const earUp = mood === 'scared' ? -0.6 : mood === 'curious' ? 0.2 : 0.7;
  drawHeadBack(g, d, C, (earUp + 0.6) / 1.3);
  // ears flatten when scared and perk up when happy, reads from way further away than the face.
  // frills and crests do the same thing by folding down, curls just cover where the ears go
  if (d.head === 'horns' || d.head === 'antlers') {
    for (const [ex, ey, s] of [[33, 18, 1], [37, 16, 0.8]]) {
      const L = 9 * s;
      const a = Math.PI * 0.85 - earUp * 0.6;
      const tip = [ex + Math.cos(a) * L, ey - Math.sin(a) * L];
      poly(g, [[ex + 1.5, ey + 2.5], tip, [ex - 3, ey + 3]], membrane);
      line(g, ex, ey + 2, tip[0], tip[1], C.body2, 1);
    }
  }
  ellipse(g, hx, hy, 10.5, 9.5, C.body);
  ellipse(g, hx - 1, hy - 5, 5.5, 2.4, C.body3);
  if (d.mark === 'spots') ellipse(g, 45, 17.5, 1.3, 1.1, C.mark);
  drawHeadTop(g, d, C);
  ellipse(g, 50, 27.5, 5.5, 4.2, C.body3);
  g.fillStyle = C.body2;
  g.fillRect(53, 25, 1, 1);
  // cheek blush, a lot more of it on the shy ones
  g.fillStyle = PAL.rose;
  if (d.quirk === 'shy') g.fillRect(43, 29, 5, 2);
  else g.fillRect(44, 30, 3, 1);

  const look = o.look | 0;
  const eyes = [[45.5, 22.5, 1], [38.5, 22.5, 0.82]];
  for (const [ex, ey, s] of eyes) {
    if (o.blink || mood === 'happy') {
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
    if (mood !== 'scared') ellipse(g, ex + look * 0.9 * s, ey + 1.2, pr * 0.55 * s, pr * 0.7 * s, lit >= 1 ? C.eye : '#3a2a5a');
    g.fillStyle = '#ffffff';
    g.fillRect(Math.round(ex - 1.5 * s + look * 0.7), Math.round(ey - 2.5 * s), 2, 2);
  }
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

  // 110 instead of 128 keeps more of the thin 1px wing bones
  const img = g.getImageData(0, 0, SPRITE_W, SPRITE_H);
  const px = img.data;
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] >= 110 ? 255 : 0;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(img, 0, 0);

  const [sil, sg] = makeCanvas(SPRITE_W, SPRITE_H);
  sg.drawImage(raw, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = C.outline;
  sg.fillRect(0, 0, SPRITE_W, SPRITE_H);
  const [outC, og] = makeCanvas(SPRITE_W, SPRITE_H);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) og.drawImage(sil, dx, dy);
  og.drawImage(raw, 0, 0);
  return outC;
}

function frame(d, o) {
  const opts = {
    mood: o.mood ?? 'curious',
    wing: o.wing ?? 'folded',
    glow: o.glow ?? 2,
    blink: !!o.blink,
    look: o.look ?? 0,
  };
  const key = `${d.key}|${opts.mood}|${opts.wing}|${opts.glow}|${opts.blink}|${opts.look}`;
  let c = cache.get(key);
  if (!c) {
    c = render(d, opts);
    // a whole night of dragons adds up, drop the oldest frames once there are a lot
    if (cache.size > 1600) {
      let n = 0;
      for (const k of cache.keys()) {
        cache.delete(k);
        if (++n >= 400) break;
      }
    }
    cache.set(key, c);
  }
  return c;
}

export function flapPose(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.25) return 'up';
  if (p < 0.5) return 'mid';
  if (p < 0.75) return 'down';
  return 'mid';
}

// blinks at random-ish gaps (roughly 1-5s), sometimes a double blink. a metronome blink looked
// robotic. O(1) so the attract screen can run all night. seed keeps the flock out of sync
const hash = (a, b) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export function blinkAt(t, seed = 0) {
  const tt = t + seed * 1.37;
  const slot = Math.floor(tt / 3.2);
  const local = tt - slot * 3.2;
  const at = hash(slot, seed) * 2.4;
  if (local >= at && local < at + 0.12) return true;
  return hash(slot + 0.5, seed) > 0.7 && local >= at + 0.22 && local < at + 0.34;
}

// x/y is the middle of the body. sx/sy = squash and stretch.
// flap: wingbeat phase, picks the wing pose and stretches the body on the downstroke.
// life: a clock for automatic blinking
export function drawDragon(ctx, x, y, d, o = {}) {
  let sx = o.sx ?? 1;
  let sy = o.sy ?? 1;
  if (o.flap !== undefined) {
    const f = -Math.cos(o.flap * TAU);
    sy *= 1 + f * 0.06;
    sx *= 1 - f * 0.05;
  }
  const img = frame(d, {
    ...o,
    wing: o.flap !== undefined ? flapPose(o.flap) : o.wing,
    blink: o.blink ?? (o.life !== undefined && blinkAt(o.life, (d.seed % 97) / 7)),
  });
  const s = (o.scale ?? 1) * d.size;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flip ? -1 : 1) * s * sx, s * sy);
  ctx.drawImage(img, -ANCHOR_X, -ANCHOR_Y);
  ctx.restore();
}

// between the eyes, relative to drawDragon's x/y. find locks onto this
export function eyeOffset(d, scale = 1) {
  const s = scale * d.size;
  return { x: 12 * s, y: -11 * s };
}
// the tip of the snout, where sneezes and chirps come out
export function noseOffset(d, scale = 1, flip = false) {
  const s = scale * d.size;
  return { x: (flip ? -20 : 20) * s, y: -7 * s };
}

// a dragon too far away to make out: a few pixels in its own colors, still flapping
export function drawSpeck(ctx, x, y, d, t) {
  const C = d.colors;
  x = Math.round(x);
  y = Math.round(y);
  const up = Math.sin(t * 7 + d.seed) > 0;
  ctx.fillStyle = C.wingLit;
  if (up) ctx.fillRect(x - 1, y - 2, 2, 2);
  else ctx.fillRect(x - 1, y + 1, 2, 1);
  ctx.fillStyle = C.body;
  ctx.fillRect(x - 2, y, 4, 1);
  ctx.fillRect(x + 2, y - 1, 1, 1);
}

// little "!" lines out of a dragon's mouth, so a chirp still reads with the sound off
export function drawChirp(ctx, x, y, k, flip = false) {
  if (k <= 0 || k >= 1) return;
  const dir = flip ? -1 : 1;
  ctx.fillStyle = PAL.cream;
  ctx.globalAlpha = 1 - k;
  const r = 3 + k * 6;
  for (const a of [-0.7, 0, 0.7]) {
    const cx = x + dir * Math.cos(a) * r;
    const cy = y + Math.sin(a) * r;
    ctx.fillRect(Math.round(cx), Math.round(cy), 2, 1);
    ctx.fillRect(Math.round(cx + dir), Math.round(cy), 1, 1);
  }
  ctx.globalAlpha = 1;
  glow(ctx, x + dir * 4, y, 6, PAL.cream, 0.4 * (1 - k));
}
