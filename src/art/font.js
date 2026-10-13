// hand-made 5x7 pixel font so there's no font download (can't trust lobby wifi).
// scale 2 = 56px tall on a 1080p projector, which reads fine from 15ft
import { makeCanvas } from '../core/util.js';

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
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
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

// text gets a 1px dark shadow underneath, or a 1px outline all the way round over busy art
// (edge: 'outline'). it used to be a 2px outline on everything, which at scale 2 filled in the
// gaps between letters and turned every line into a dark box
const cache = new Map();
function textSprite(str, scale, color, outline, edge) {
  const key = `${str}|${scale}|${color}|${outline}|${edge}`;
  let c = cache.get(key);
  if (c) return c;
  const o = outline ? 1 : 0;
  let g;
  [c, g] = makeCanvas(textWidth(str, scale) + o * 2, textHeight(scale) + o * 3);
  if (outline) {
    if (edge === 'outline') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) paint(g, str, o + dx, o + dy, scale, outline);
    paint(g, str, o, o + 1, scale, outline);
  }
  paint(g, str, o, o, scale, color);
  if (cache.size > 400) cache.clear(); // debug overlay makes a new string every frame
  cache.set(key, c);
  return c;
}

// makes a line's sprite ahead of time, so a scene can do it while it's still behind a fade
export function warmText(str, { scale = 1, color = '#fff', outline = '#0b0f1a', edge = 'shadow' } = {}) {
  textSprite(str, scale, color, outline, edge);
}

// the word-budget and overlap tests turn this on to see every line a screen draws: [text, size,
// box]. box is where it landed on the screen, null for text drawn inside something else (the
// storybook's pages). shapes are the non-text things text mustn't sit on, from logShape
export const textLog = { on: false, lines: [], shapes: [], screen: null };
export function logShape(name, x, y, w, h) {
  if (textLog.on) textLog.shapes.push([name, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }]);
}

// y is the top of the letters
export function drawText(ctx, str, x, y, { scale = 1, color = '#fff', outline = '#0b0f1a', edge = 'shadow', align = 'left', alpha = 1 } = {}) {
  const s = textSprite(str, scale, color, outline, edge);
  const o = outline ? 1 : 0;
  let dx = x - o;
  if (align === 'center') dx = x - Math.floor(textWidth(str, scale) / 2) - o;
  else if (align === 'right') dx = x - textWidth(str, scale) - o;
  const at = [Math.round(dx), Math.round(y - o)];
  if (textLog.on && alpha * ctx.globalAlpha > 0.05) textLog.lines.push([String(str), scale, ctx === textLog.screen ? { x: at[0], y: at[1], w: s.width, h: s.height } : null]);
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  ctx.drawImage(s, at[0], at[1]);
  ctx.globalAlpha = pa;
}

// springy pop-in for the big one-word moments (SOAR!, PIP IS HOME!)
export function drawTextPop(ctx, str, x, y, t, opts = {}) {
  const scale = opts.scale ?? 3;
  const s = textSprite(str, scale, opts.color ?? '#fff', opts.outline ?? '#0b0f1a', opts.edge ?? 'shadow');
  const k = t >= 1 ? 1 : 1 + Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * 2.1) * 0.6;
  const kk = Math.max(0.01, t < 0.12 ? t / 0.12 : k);
  if (textLog.on && (opts.alpha ?? 1) * ctx.globalAlpha > 0.05) {
    const w = Math.round(s.width * kk);
    const h = Math.round(s.height * kk);
    textLog.lines.push([String(str), scale, ctx === textLog.screen ? { x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h } : null]);
  }
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * (opts.alpha ?? 1);
  ctx.drawImage(s, Math.round(x - (s.width * kk) / 2), Math.round(y - (s.height * kk) / 2), Math.round(s.width * kk), Math.round(s.height * kk));
  ctx.globalAlpha = pa;
}

// biggest scale (up to max) that fits in maxW. names make some lines longer than others
export function fitScale(str, maxW, max = 3, min = 2) {
  for (let s = max; s > min; s--) if (textWidth(str, s) <= maxW) return s;
  return min;
}
