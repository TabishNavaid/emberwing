import { VIEW, INPUT } from '../config.js';

// maps where the mocap rig *thinks* it's pointing to where it's actually pointing on the wall.
// 4 corners give a full perspective mapping, so it also fixes a keystoned projector.
// only applies to the input source it was captured with, so a desk mouse stays normal
const KEY = 'emberwing.cal.v1';
const I = INPUT.CAL_INSET;
export const CAL_TARGETS = [
  [I, I],
  [VIEW.W - I, I],
  [VIEW.W - I, VIEW.H - I],
  [I, VIEW.H - I],
];
export const CAL_NAMES = ['TOP LEFT', 'TOP RIGHT', 'BOTTOM RIGHT', 'BOTTOM LEFT'];

// solve the 8 unknowns of a homography from 4 point pairs (plain gaussian elimination).
// returns null if the points are degenerate, like all 4 captured in the same spot
function solveHomography(src, dst) {
  const A = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[8] / row[i]).concat(1);
}

function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

export class Calibration {
  constructor() {
    this.h = null;
    this.source = null;
    this.date = '';
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && Array.isArray(d.h) && d.h.length === 9) Object.assign(this, { h: d.h, source: d.source, date: d.date });
    } catch {
      // no saved calibration, or storage is blocked. uncalibrated still works
    }
  }
  map(x, y, source) {
    if (!this.h || source !== this.source) return [x, y];
    return applyHomography(this.h, x, y);
  }
  // raw: the 4 points the rig reported while aiming at CAL_TARGETS
  set(source, raw) {
    const h = solveHomography(raw, CAL_TARGETS);
    if (!h || h.some((v) => !Number.isFinite(v))) return false;
    const d = new Date();
    Object.assign(this, { h, source, date: `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` });
    try {
      localStorage.setItem(KEY, JSON.stringify({ h, source, date: this.date }));
    } catch {
      // works for this session at least
    }
    return true;
  }
  clear() {
    Object.assign(this, { h: null, source: null, date: '' });
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nothing saved anyway
    }
  }
  label() {
    return this.h ? `${this.source.toUpperCase()} ${this.date}` : 'OFF';
  }
}
