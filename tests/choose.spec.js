// "who will you find?": three lost dragons, the guest holds the light on one
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

const choose = (page, fn) => page.evaluate(fn);

test('three lost dragons to pick from, the light picks one, the other two stay lost', async ({ page }) => {
  await boot(page);
  const r = await choose(page, () => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    w.goto('attract');
    const lost = g.lost.map((d) => d.name);
    w.goto('choose');
    const c = g.scenes.current;
    const shown = c.options.map((o) => o.d.name);
    const at = c.optionTarget(2);
    // the light starts up by the title, then comes onto the right-hand dragon once the screen
    // has been up long enough to look at
    while (c.locked()) { g.input.feed(240, 20, 'mouse'); w.step(0.05); }
    for (let i = 0; i < 1.2 * 20; i++) {
      g.input.feed(at.x + (i % 2), at.y, 'mouse');
      w.step(0.05);
    }
    const early = c.picked?.d.name ?? null;
    for (let i = 0; i < 0.4 * 20; i++) {
      g.input.feed(at.x + (i % 2), at.y, 'mouse');
      w.step(0.05);
    }
    const picked = c.picked?.d.name ?? null;
    const dragon = g.dragon.name;
    const left = g.lost.map((d) => d.name);
    w.step(1.0);
    const next = g.scenes.pending?.name ?? g.scenes.name;
    // that dragon makes it home, the next guest sees the other two plus one new one
    w.goto('home');
    w.goto('attract');
    const after = g.lost.map((d) => d.name);
    const home = g.store.dragons.map((d) => d.name);
    return { lost, shown, early, picked, dragon, left, next, after, home };
  });
  expect(r.shown).toEqual(r.lost);
  expect(r.early).toBe(null); // 1.2s isn't enough, it's a 1.5s hold
  expect(r.picked).toBe(r.lost[2]);
  expect(r.dragon).toBe(r.lost[2]);
  expect(r.left).toEqual([r.lost[0], r.lost[1]]);
  expect(r.next).toBe('find');
  expect(r.home).toEqual([r.lost[2]]);
  expect(r.after.slice(0, 2)).toEqual([r.lost[0], r.lost[1]]);
  expect(r.after).toHaveLength(3);
  expect(new Set([...r.after, ...r.home]).size).toBe(4); // nobody shares a name
});

test('nobody picks: after about 8s it picks for you so the line keeps moving', async ({ page }) => {
  await boot(page);
  const r = await choose(page, () => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    w.goto('choose');
    const c = g.scenes.current;
    const mid = c.options[1].d.name;
    for (let i = 0; i < 7.7 * 20; i++) {
      g.input.feed(240, 20, 'mouse'); // up by the title, not on any dragon
      w.step(0.05);
    }
    const before = c.picked;
    w.step(0.5);
    return { before: before ? before.d.name : null, picked: c.picked?.d.name, mid };
  });
  expect(r.before).toBe(null);
  expect(r.picked).toBe(r.mid);
});

test('picking a dragon and walking away puts it back at the front of the lost ones', async ({ page }) => {
  await boot(page);
  const r = await choose(page, () => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    w.goto('choose');
    const c = g.scenes.current;
    c.pick(g, c.options[2]);
    const picked = g.dragon.name;
    w.goto('find');
    w.goto('attract', { reason: 'idle' });
    return { picked, first: g.lost[0].name, count: g.lost.length, dragon: g.dragon.name };
  });
  expect(r.first).toBe(r.picked);
  expect(r.dragon).toBe(r.picked);
  expect(r.count).toBe(3);
});

// testers got the middle dragon by accident: the light was still where the level had been, which
// is over a card, and it filled before they'd looked. now the first second counts for nothing and
// a resting light never picks
test('a light left over a card from the start screen never picks it, and nothing counts in the first second', async ({ page }) => {
  await boot(page);
  const r = await choose(page, () => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = {};
    for (const level of ['hatchling', 'flier', 'storm']) {
      w.goto('attract');
      const a = g.scenes.current;
      while (a.inHandoff()) { g.input.feed(200, 250, 'mouse'); w.step(0.05); }
      const at = a.levelTarget(level);
      while (g.scenes.name === 'attract') { g.input.feed(at.x + (Math.round(a.t * 20) % 2), at.y, 'mouse'); w.step(0.05); }
      // the light stays exactly where the level was
      const c = g.scenes.current;
      let filled = 0;
      for (let i = 0; i < 7.5 * 20 && !c.picked; i++) {
        g.input.feed(at.x + (i % 2), at.y, 'mouse');
        w.step(0.05);
        filled = Math.max(filled, ...c.options.map((o) => o.progress));
      }
      out[level] = { picked: c.picked?.d.name ?? null, filled };
      g.scenes.pending = null;
      g.scenes.fade = 0;
      g.scenes.fadeDir = 0;
    }
    // a tap in the first second does nothing either
    w.goto('choose');
    const c = g.scenes.current;
    const card = c.optionTarget(0);
    g.input.tap = { x: card.x, y: card.y };
    w.step(0.05);
    out.earlyTap = c.picked?.d.name ?? null;
    w.step(1.0);
    g.input.tap = { x: card.x, y: card.y };
    w.step(0.05);
    out.laterTap = c.picked?.d.name ?? null;
    out.left = c.options[0].d.name;
    return out;
  });
  for (const level of ['hatchling', 'flier', 'storm']) expect(r[level]).toEqual({ picked: null, filled: 0 });
  expect(r.earlyTap).toBe(null);
  expect(r.laterTap).toBe(r.left);
});

// one choice per run: the dragon you pick is the one in the fog, on the title cards, in the flight,
// at home and on the card, same name and same look (seed) the whole way, picked with a light or a tap
test('the dragon you pick is the one you find, fly and see on the card, name and look never change', async ({ page }) => {
  await boot(page);
  const r = await choose(page, () => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const runs = [];
    for (const [card, how] of [[0, 'light'], [1, 'tap'], [2, 'light'], [0, 'tap'], [2, 'tap']]) {
      w.goto('attract');
      const a = g.scenes.current;
      // the start screen's storybook never names one of the lost dragons, all the way through it
      const lostNames = g.lost.map((d) => d.name);
      const said = new Set();
      for (let i = 0; i < 26 * 4; i++) { g.input.feed(200, 250, 'mouse'); w.step(0.25, 20, false); if (i % 2 === 0) for (const [str] of w.words()) said.add(str); }
      const named = [...said].filter((str) => lostNames.some((n) => str.includes(n)));
      const at = a.levelTarget('hatchling');
      while (g.scenes.name === 'attract') { g.input.feed(at.x + (Math.round(a.t * 20) % 2), at.y, 'mouse'); w.step(0.05); }
      const c = g.scenes.current;
      const want = c.options[card].d;
      const pickAt = c.optionTarget(card);
      while (c.locked()) { g.input.feed(240, 20, 'mouse'); w.step(0.05); }
      if (how === 'tap') { g.input.tap = { x: pickAt.x, y: pickAt.y }; w.step(0.05); }
      while (!c.picked) { g.input.feed(pickAt.x + (Math.round(c.t * 20) % 2), pickAt.y, 'mouse'); w.step(0.05); }
      // play it out, noting every dragon the game shows as yours along the way
      const seen = new Set();
      const titles = new Set();
      for (let i = 0; i < 20 * 120 && g.scenes.name !== 'attract'; i++) {
        const s = w.state();
        if (s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
        w.step(0.05, 60, false);
        if (g.scenes.name === 'attract') break; // the next guest's turn, a new dragon is up next
        seen.add(`${g.dragon.name}|${g.dragon.seed}`);
        const d = g.scenes.current?.d;
        if (d) seen.add(`${d.name}|${d.seed}`);
        if (g.scenes.title) titles.add(g.scenes.title.text);
        if (g.scenes.name === 'end') {
          const card = g.scenes.current;
          seen.add(`${card.d.name}|${card.d.seed}`);
        }
      }
      runs.push({ card, how, want: `${want.name}|${want.seed}`, picked: `${c.picked.d.name}|${c.picked.d.seed}`, seen: [...seen], titles: [...titles], named, home: g.store.dragons[g.store.dragons.length - 1]?.name, wantName: want.name });
    }
    return runs;
  });
  for (const run of r) {
    expect(run.picked).toBe(run.want);
    expect(run.seen).toEqual([run.want]); // only ever that one dragon
    expect(run.titles).toEqual([`${run.wantName} IS LOST!`, 'NOW FLY HOME!']);
    expect(run.home).toBe(run.wantName);
    expect(run.named).toEqual([]);
  }
});
