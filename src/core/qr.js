// a small QR code maker for the operator's Q key (a code on the start screen so people in line can
// open the game on their phones). byte mode, medium error correction, versions 1-6, which is
// plenty for a url. written out by hand because we didn't want a dependency just for this

// per version, medium (M) error correction: [error codewords per block, blocks, data codewords per block]
const BLOCKS = [null, [10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

// galois field math for the reed-solomon error correction
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function errorCodewords(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= mul(gen[j], EXP[i]);
    }
    gen = next;
  }
  const rem = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ rem.shift();
    rem.push(0);
    for (let j = 0; j < n; j++) rem[j] ^= mul(gen[j + 1], f);
  }
  return rem;
}

// the bits of the message, split into blocks with their error correction, interleaved
function codewords(bytes, v) {
  const [ec, blocks, per] = BLOCKS[v];
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(0b0100, 4); // byte mode
  put(bytes.length, 8);
  for (const b of bytes) put(b, 8);
  const cap = blocks * per * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < blocks * per; pad ^= 0xec ^ 0x11) data.push(pad);
  const ds = [];
  const es = [];
  for (let b = 0; b < blocks; b++) {
    ds.push(data.slice(b * per, (b + 1) * per));
    es.push(errorCodewords(ds[b], ec));
  }
  const out = [];
  for (let i = 0; i < per; i++) for (const d of ds) out.push(d[i]);
  for (let i = 0; i < ec; i++) for (const e of es) out.push(e[i]);
  return out;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// the fixed patterns (finders, timing, alignment) plus which cells are reserved for them
function base(v) {
  const n = 17 + v * 4;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  const fixed = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, on) => { if (r >= 0 && r < n && c >= 0 && c < n) { m[r][c] = on ? 1 : 0; fixed[r][c] = true; } };
  for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(fr + r, fc + c, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (edge || core));
    }
  }
  for (let i = 8; i < n - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const r of ALIGN[v]) for (const c of ALIGN[v]) {
    if (fixed[r][c]) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  set(n - 8, 8, true); // the one dark module every code has
  // reserve the format info cells, filled in once the mask is picked
  for (let i = 0; i < 9; i++) { fixed[8][i] = true; fixed[i][8] = true; }
  for (let i = 0; i < 8; i++) { fixed[8][n - 1 - i] = true; fixed[n - 1 - i][8] = true; }
  return { n, m, fixed };
}

function formatBits(mask) {
  const data = (0b00 << 3) | mask; // 00 = medium error correction
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

// same layout as nayuki's reference qr code generator, bit 0 is the lowest bit
function placeFormat({ n, m }, mask) {
  const f = formatBits(mask);
  const bit = (i) => (f >> i) & 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
}

// the usual penalty score, lower is easier for a camera to read
function penalty(m) {
  const n = m.length;
  let p = 0;
  const lines = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      if (run >= 5) p += run - 2;
      for (let b = 0; b + 10 < n; b++) {
        const s = Array.from({ length: 11 }, (_, k) => get(a, b + k)).join('');
        if (s === '10111010000' || s === '00001011101') p += 40;
      }
    }
  };
  lines((r, c) => m[r][c]);
  lines((c, r) => m[r][c]);
  for (let r = 0; r + 1 < n; r++) for (let c = 0; c + 1 < n; c++) {
    const v = m[r][c];
    if (v === m[r + 1][c] && v === m[r][c + 1] && v === m[r + 1][c + 1]) p += 3;
  }
  const dark = m.flat().reduce((s, x) => s + x, 0);
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

// returns rows of 0/1 (1 = dark), or null if the text is too long
export function makeQR(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v < BLOCKS.length && bytes.length + 2 > BLOCKS[v][1] * BLOCKS[v][2]) v++;
  if (v >= BLOCKS.length) return null;
  const cw = codewords(bytes, v);
  const bits = cw.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const q = base(v);
    const { n, m, fixed } = q;
    let i = 0;
    // zigzag up and down two columns at a time from the bottom right, skipping the timing column
    for (let right = n - 1, up = true; right > 0; right -= 2, up = !up) {
      if (right === 6) right = 5;
      for (let k = 0; k < n; k++) {
        const r = up ? n - 1 - k : k;
        for (const c of [right, right - 1]) {
          if (fixed[r][c]) continue;
          const b = i < bits.length ? bits[i++] : 0;
          m[r][c] = b ^ (MASKS[mask](r, c) ? 1 : 0);
        }
      }
    }
    placeFormat(q, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { score, m };
  }
  return best.m;
}
