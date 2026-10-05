import { mulberry32 } from './util.js';

// every guest rescues a different emberwing. a dragon is just a seed: the seed picks the parts,
// so storing { seed, name } is enough to draw the same dragon again later in the night

// short (7 letters max, so "JUNIPER FOLLOWS YOUR LIGHT" still fits at scale 3), all made up for this
export const NAMES = [
  'PIP', 'SKYE', 'BRAMBLE', 'CINDER', 'MARLO', 'FENN', 'JUNIPER', 'KOA',
  'WREN', 'MOSS', 'TANSY', 'ROWAN', 'PUCK', 'NELL', 'OLLIE', 'BEAN',
  'CLOVER', 'TUCK', 'HAZEL', 'BIRCH', 'SORREL', 'NUTMEG', 'BASIL', 'RORY',
  'THISTLE', 'PEBBLE', 'MAPLE', 'FINCH', 'SUNNY', 'KIT', 'IVY', 'LUMI',
  'NOVA', 'ECHO', 'FLINT', 'FERN', 'SAGE', 'TILLY', 'WISP', 'BO',
  'JUNO', 'PAX', 'MIKA', 'KESTREL', 'BRACKEN', 'TUMBLE', 'BISCUIT', 'TOFFEE',
  'MOCHI', 'SAFFRON', 'RIPPLE', 'COMET', 'PEPPER', 'OTTIE', 'BRIAR', 'DOT',
];

// body colors. they differ in brightness as well as hue, and every dragon also gets a
// different wing/head/tail shape from the one before, so color is never the only difference
// [body, shade, highlight, belly, belly stripes, markings, outline]
const BODIES = [
  ['#f0762a', '#c8521f', '#ffa654', '#ffd99a', '#f0b870', '#c8521f', '#2a140e'], // ember orange
  ['#8a6cff', '#5b3fb0', '#b49cff', '#e6dcff', '#cbbcff', '#5b3fb0', '#1d1238'], // violet
  ['#2fb9a6', '#1b7a70', '#6fe0cf', '#d8fff5', '#a9eee2', '#1b7a70', '#0e2a28'], // teal
  ['#ffc34a', '#c98a1f', '#ffe08e', '#fff4d2', '#ffe0a0', '#c98a1f', '#3a2408'], // gold
  ['#ff8fb0', '#c95a7c', '#ffc0d2', '#fff0f4', '#ffd0de', '#c95a7c', '#3a1020'], // rose
  ['#5aa8ff', '#2f6fc0', '#9ccaff', '#e4f2ff', '#bcdcff', '#2f6fc0', '#0e1e3a'], // sky
  ['#6cc04a', '#3f8a2c', '#a6e47e', '#f0ffd8', '#cdeeb0', '#3f8a2c', '#13280c'], // leaf
  ['#e8444a', '#a8262c', '#ff8a84', '#ffd8c8', '#ffb0a0', '#a8262c', '#2a0a0c'], // crimson
  ['#e8ecf4', '#a8b0c8', '#ffffff', '#fff4dc', '#d0d8e8', '#8a94b0', '#1a1e30'], // snow
  ['#b0508a', '#7a2a5c', '#e08abc', '#ffe0f0', '#f0b0d4', '#ffd0ea', '#240a1c'], // plum
  ['#c8803a', '#8a5020', '#eab070', '#ffe8c0', '#f0c890', '#8a5020', '#241408'], // copper
  ['#7ee8c0', '#3fb08a', '#b8ffe4', '#f4fff8', '#d0fff0', '#3fb08a', '#0c2a20'], // mint
  ['#5a6478', '#3a4254', '#8a96ac', '#ffd88a', '#ffe8b0', '#ffd88a', '#0c0e16'], // storm grey, gold belly
];

// wings: [dark (lost), mid (warming up), lit, veins, which aurora color the ribbon gets]
const WINGS = [
  ['#2c4f5a', '#249d96', '#3ff0d8', '#c8fff6', 0], // teal
  ['#4a3a1a', '#d9a640', '#ffd26a', '#fff4c8', 2], // gold
  ['#4a2a3a', '#d56a9f', '#ff9ed0', '#ffe2f1', 3], // pink
  ['#253a55', '#4a98c8', '#8ad8ff', '#e8f8ff', 4], // sky
  ['#2f4a22', '#5aa83a', '#9df06a', '#efffe0', 5], // lime
  ['#3a2f55', '#8a6cd0', '#c4a8ff', '#f0e8ff', 1], // lavender
  ['#4a2a22', '#d86a4a', '#ff9a78', '#ffe4d8', 3], // coral
];
// wing colors that don't vanish against each body (same index as BODIES)
const WING_OK = [
  [0, 3, 5], [1, 0, 4], [1, 2, 6], [0, 3, 5], [4, 0, 3], [1, 2, 6], [1, 5, 0],
  [1, 0, 3], [0, 2, 5, 6], [1, 0, 4], [0, 3, 5], [2, 5, 6], [1, 0, 2, 6],
];

const EYES = ['#1f8f86', '#c07a1a', '#6a3ac0', '#2a8a3a', '#2a5ab0', '#b03a6a'];
const TIPS = ['#ffc94a', '#fff3d6', '#ff9e3a'];
// frills and crests, picked to stand out from both the body and the wings
const ACCENTS = ['#ffc94a', '#fff3d6', '#ff9e3a', '#ff8fb0', '#8ad8ff', '#c4a8ff'];

export const WING_SHAPES = ['bat', 'leaf', 'feather', 'moth'];
export const HEADS = ['horns', 'curls', 'frill', 'antlers', 'crest'];
export const TAILS = ['diamond', 'spade', 'flame', 'leaf', 'puff', 'fork'];
export const MARKS = ['none', 'spots', 'bands'];
export const SIZES = [0.86, 0.93, 1, 1.07, 1.14];
export const QUIRKS = ['sparky', 'loopy', 'wobbly', 'shy', 'bouncy'];
export const QUIRK_TEXT = {
  sparky: 'SNEEZES SPARKS',
  loopy: 'LOVES LOOPS',
  wobbly: 'A WOBBLY FLIER',
  shy: 'SHY AT FIRST',
  bouncy: 'FULL OF BOUNCE',
};

const pick = (r, list) => list[Math.floor(r() * list.length)];

const cache = new Map();
export function dragonFromSeed(seed, name = '') {
  const key = `${seed}|${name}`;
  let d = cache.get(key);
  if (d) return d;
  const r = mulberry32(seed);
  const body = Math.floor(r() * BODIES.length);
  const wingPal = pick(r, WING_OK[body]);
  const [b, b2, b3, belly, stripe, mark, outline] = BODIES[body];
  const [wingDark, wingMid, wingLit, vein, ribbon] = WINGS[wingPal];
  d = {
    seed,
    name,
    key: `d${seed}`,
    body,
    wingPal,
    ribbon,
    wing: pick(r, WING_SHAPES),
    head: pick(r, HEADS),
    tail: pick(r, TAILS),
    mark: pick(r, MARKS),
    size: pick(r, SIZES),
    quirk: pick(r, QUIRKS),
    colors: {
      body: b, body2: b2, body3: b3, belly, stripe, mark, outline,
      wingDark, wingMid, wingLit, vein,
      eye: pick(r, EYES),
      tip: r() < 0.5 ? wingLit : pick(r, TIPS),
      accent: pick(r, ACCENTS.filter((c) => c !== b && c !== wingLit)),
      horn: '#fff3d6',
    },
  };
  if (cache.size > 600) cache.clear();
  cache.set(key, d);
  return d;
}

// how different two dragons look, counted in parts
function diff(a, b) {
  let n = 0;
  for (const k of ['body', 'wing', 'head', 'tail', 'quirk']) if (a[k] !== b[k]) n++;
  return n;
}

// the next lost dragon. recent = dragons already home tonight (newest last), so the new one
// never repeats the last few body colors or the last dragon's shapes and quirk
export function pickDragon(rng, recent = [], usedNames = []) {
  const last = recent[recent.length - 1];
  const recentBodies = new Set(recent.slice(-6).map((d) => d.body));
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < 80; i++) {
    const d = dragonFromSeed(rng.int(1, 2147483646));
    let score = recentBodies.has(d.body) ? 0 : 10;
    if (last) score += diff(d, last) * 2 + (d.wing !== last.wing && d.head !== last.head ? 3 : 0);
    else score += 13;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
    if (score >= 23) break; // new body color, and every shape and the quirk changed
  }
  return dragonFromSeed(best.seed, pickName(rng, usedNames));
}

// no repeats in a night until the whole list is used up, then anything but the last few
export function pickName(rng, used = []) {
  const taken = new Set(used);
  let free = NAMES.filter((n) => !taken.has(n));
  if (!free.length) {
    const lately = new Set(used.slice(-12));
    free = NAMES.filter((n) => !lately.has(n));
  }
  return free[Math.floor(rng() * free.length)];
}

export function ordinal(n) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}TH`;
  return `${n}${['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`;
}

// three dragons are lost at any time and the guest picks one of them. the other two stay lost
// for the guests after. names never clash with anyone home or anyone else lost
export function fillLost(g) {
  g.lost = g.lost.filter((d) => !d.home);
  // somebody picked a dragon and walked away: it's still lost, back to the front of the queue
  if (g.dragon && !g.dragon.home && !g.lost.includes(g.dragon)) g.lost.unshift(g.dragon);
  while (g.lost.length < 3) {
    g.lost.push(pickDragon(g.rng, [...g.store.dragons, ...g.lost], [...g.store.names, ...g.lost.map((d) => d.name)]));
  }
  g.lost.length = 3;
  return g.lost;
}
