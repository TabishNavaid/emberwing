import { STORE } from '../config.js';

// Every guest's flight becomes a ribbon of light in the aurora, and it stays
// for the rest of the evening. Saved to localStorage so a page refresh (or a
// crashed browser) doesn't wipe the wall. All storage access is wrapped in
// try/catch: private mode or blocked storage just falls back to memory.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export class AuroraStore {
  constructor() {
    this.version = 0; // bumps on every change (for render caches)
    this.data = { date: today(), count: 0, ribbons: [] };
    this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(STORE.KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.ribbons)) return;
      if (STORE.NEW_NIGHT_BY_DATE && d.date !== today()) return; // a new night
      this.data = { date: d.date, count: d.count | 0, ribbons: d.ribbons };
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
  // points: [[x 0..1, y 0..1], ...]; hue: palette index
  add(points, hue) {
    const p = [];
    for (const [x, y] of points) p.push(Math.round(x * 999), Math.round(y * 999));
    const n = this.data.count;
    const rib = {
      p,
      h: hue,
      // Spread ribbons across the sky so each one is visible.
      o: ((n * 0.618034) % 1) * 0.5, // horizontal offset
      w: 0.5 + ((n * 0.38197) % 1) * 0.5, // width fraction
      v: (n * 0.7548) % 1, // vertical layer
    };
    this.data.ribbons.push(rib);
    if (this.data.ribbons.length > STORE.MAX_RIBBONS) this.data.ribbons.shift();
    this.data.count++;
    this.version++;
    this.save();
    return rib;
  }
  clear() {
    this.data = { date: today(), count: 0, ribbons: [] };
    this.version++;
    this.save();
  }
}
