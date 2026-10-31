// the a/b test's notes: a line per run in localStorage, from the level being picked to the start
// screen coming back. how long each screen took, hoops, and whether it finished or idled out.
// both versions go in one list (v says which). the operator's L shows it, X clears it
import { LOG } from '../config.js';
import { version } from './version.js';

// the screens a run goes through, in the order the table shows them. celebration counts as home
export const LOG_SCREENS = ['start', 'choose', 'find', 'flight', 'home', 'end'];
const column = (scene) => (scene === 'attract' ? 'start' : scene === 'celebration' ? 'home' : scene);
const secs = (s) => Math.round(s * 10) / 10;

export class RunLog {
  constructor() {
    this.runs = [];
    this.open = null; // the run being played right now
    try {
      const saved = JSON.parse(localStorage.getItem(LOG.KEY));
      if (Array.isArray(saved)) this.runs = saved;
    } catch {
      // storage blocked or the line is broken, start a fresh log
    }
  }

  save() {
    try {
      localStorage.setItem(LOG.KEY, JSON.stringify(this.runs));
    } catch {
      // fine, it just won't survive a refresh
    }
  }

  // a level was picked. start = seconds the guest was on the start screen before that
  begin(g, level, start) {
    this.open = { v: version, level, at: new Date().toISOString(), t: { start: secs(start) }, total: 0, hits: 0, of: 0, end: '' };
    this.t0 = g.time;
    this.sceneAt = g.time;
    this.scene = null; // the rest of the start screen (its fade) only counts toward the total
  }

  // every scene change (SceneManager.enter), from = the scene being left
  enter(g, from, to, data = {}) {
    const r = this.open;
    if (!r) return;
    if (this.scene) {
      const c = column(this.scene);
      r.t[c] = secs((r.t[c] ?? 0) + g.time - this.sceneAt);
    }
    if (from === 'flight') {
      const f = g.scenes.scenes.flight;
      r.hits = f.points.hits;
      r.of = f.L.hoops;
    }
    this.scene = to;
    this.sceneAt = g.time;
    if (to !== 'attract') return;
    // back on the start screen: finished (the card was done), idled out of a screen, or the operator
    r.total = secs(g.time - this.t0);
    r.end = data.reason === 'done' ? 'done' : data.reason === 'idle' ? 'idle' : 'reset';
    if (r.end !== 'done') r.where = from;
    this.runs.push(r);
    if (this.runs.length > LOG.MAX) this.runs.splice(0, this.runs.length - LOG.MAX);
    this.open = null;
    this.save();
  }

  clear() {
    this.runs = [];
    this.open = null;
    this.save();
  }

  // averages per version, for the top of the table. screen times count only runs that got there
  summary(v) {
    const runs = this.runs.filter((r) => r.v === v);
    const avg = (vals) => (vals.length ? secs(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
    const t = {};
    for (const s of LOG_SCREENS) t[s] = avg(runs.map((r) => r.t[s]).filter((x) => x !== undefined));
    const flown = runs.filter((r) => r.of);
    return {
      v,
      runs: runs.length,
      done: runs.filter((r) => r.end === 'done').length,
      t,
      total: avg(runs.filter((r) => r.end === 'done').map((r) => r.total)),
      hits: avg(flown.map((r) => r.hits)),
      of: avg(flown.map((r) => r.of)),
    };
  }
}
