import { makeCanvas } from '../core/util.js';

// hand-made 5x7 pixel font so there's no font download (can't trust lobby wifi).
// scale 2 = 56px tall on a 1080p projector, which reads fine from 15ft
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '&': ['.#...', '#.#..', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

const GAP = 1;
const glyph = (ch) => G[ch] || G[ch.toUpperCase()] || G['?'];

export function textWidth(str, scale = 1) {
  let w = 0;
  for (const ch of String(str)) w += (glyph(ch)[0].length + GAP) * scale;
  return Math.max(0, w - GAP * scale);
}
const textHeight = (scale = 1) => 7 * scale;

function paint(ctx, str, x, y, scale, color) {
  ctx.fillStyle = color;
  for (const ch of String(str)) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '#') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
    x += (g[0].length + GAP) * scale;
  }
}

const cache = new Map();
// dark outline so text reads over fog, sky or aurora. rendered once and cached
function textSprite(str, scale, color, outline) {
  const key = `${str}|${scale}|${color}|${outline}`;
  let c = cache.get(key);
  if (c) return c;
  const o = outline ? scale : 0;
  const w = textWidth(str, scale) + o * 2;
  const h = textHeight(scale) + o * 2;
  let g;
  [c, g] = makeCanvas(w, h + (outline ? scale : 0));
  if (outline) {
    for (let dy = -1; dy <= 2; dy++)
      for (let dx = -1; dx <= 1; dx++) paint(g, str, o + dx * scale, o + dy * scale, scale, outline);
  }
  paint(g, str, o, o, scale, color);
  if (cache.size > 400) cache.clear(); // debug overlay makes a new string every frame
  cache.set(key, c);
  return c;
}

// y is the top of the letters
export function drawText(ctx, str, x, y, { scale = 1, color = '#fff', outline = '#0b0f1a', align = 'left', alpha = 1 } = {}) {
  const s = textSprite(str, scale, color, outline);
  const o = outline ? scale : 0;
  let dx = x - o;
  if (align === 'center') dx = x - Math.floor(textWidth(str, scale) / 2) - o;
  else if (align === 'right') dx = x - textWidth(str, scale) - o;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  ctx.drawImage(s, Math.round(dx), Math.round(y - o));
  ctx.globalAlpha = pa;
}

// springy pop-in for the big one-word moments (EMBER!, FLY!, HOME!)
export function drawTextPop(ctx, str, x, y, t, opts = {}) {
  const scale = opts.scale ?? 3;
  const s = textSprite(str, scale, opts.color ?? '#fff', opts.outline ?? '#0b0f1a');
  const k = t >= 1 ? 1 : 1 + Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * 2.1) * 0.6;
  const kk = Math.max(0.01, t < 0.12 ? t / 0.12 : k);
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * (opts.alpha ?? 1);
  ctx.drawImage(s, Math.round(x - (s.width * kk) / 2), Math.round(y - (s.height * kk) / 2), Math.round(s.width * kk), Math.round(s.height * kk));
  ctx.globalAlpha = pa;
}
