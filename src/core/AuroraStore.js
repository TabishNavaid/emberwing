import { STORE } from '../config.js';
import { dragonFromSeed, standIn } from './dragons.js';

// every guest's ribbon and the dragon they brought home, saved to localStorage so a refresh or
// crashed tab doesn't wipe the wall. storage can throw (private mode, blocked site data), then
// we just keep it in memory
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export class AuroraStore {
  constructor() {
    this.version = 0; // bumps on every change so the aurora wall and the flock know to redraw
    this.data = { date: today(), count: 0, ribbons: [], best: {} };
    this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(STORE.KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.ribbons)) return;
      if (STORE.NEW_NIGHT_BY_DATE && d.date !== today()) return;
      this.data = { date: d.date, count: d.count | 0, ribbons: d.ribbons, best: d.best || {} };
      this.version++;
    } catch (e) {
      console.warn('[emberwing] could not read saved aurora', e);
    }
  }
  save() {
    try {
      localStorage.setItem(STORE.KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[emberwing] could not save aurora', e);
    }
  }
  get count() {
    return this.data.count;
  }
  get ribbons() {
    return this.data.ribbons;
  }
  // everyone who made it home tonight, oldest first
  get dragons() {
    if (this._dv !== this.version) {
      this._dv = this.version;
      this._dragons = this.data.ribbons.map((r) => dragonFromSeed(r.d, r.n));
    }
    return this._dragons;
  }
  get names() {
    return this.data.ribbons.map((r) => r.n);
  }
  // best flight tonight per level: { hatchling: { score, name, seed }, ... }
  get best() {
    return this.data.best;
  }
  // points are [[x, y], ...] in 0..1. run = { level, score } from the flight, if there was one
  add(points, hue, dragon = null, run = null) {
    const p = [];
    for (const [x, y] of points) p.push(Math.round(x * 999), Math.round(y * 999));
    const n = this.data.count;
    dragon ??= standIn(n);
    const rib = {
      p,
      h: hue,
      // golden-ratio spacing spreads ribbons out so they don't all stack in one spot
      o: ((n * 0.618034) % 1) * 0.5, // horizontal offset
      w: 0.5 + ((n * 0.38197) % 1) * 0.5, // width fraction
      v: (n * 0.7548) % 1, // vertical layer
      d: dragon.seed,
      n: dragon.name,
    };
    if (run) {
      rib.s = run.score;
      rib.l = run.level;
      // kept per level, so a little kid's hatchling run can be a best flight too. only real
      // flights count (the operator skipping to home doesn't post a 0)
      const b = this.data.best[run.level];
      if (run.flown && (!b || run.score > b.score)) this.data.best[run.level] = { score: run.score, name: dragon.name, seed: dragon.seed };
    }
    this.data.ribbons.push(rib);
    if (this.data.ribbons.length > STORE.MAX_RIBBONS) this.data.ribbons.shift();
    this.data.count++;
    this.version++;
    this.save();
    return rib;
  }
  clear() {
    this.data = { date: today(), count: 0, ribbons: [], best: {} };
    this.version++;
    this.save();
  }
}
