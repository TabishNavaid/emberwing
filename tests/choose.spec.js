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
    for (let i = 0; i < 0.8 * 20; i++) {
      g.input.feed(at.x + (i % 2), at.y, 'mouse');
      w.step(0.05);
    }
    const early = c.picked?.d.name ?? null;
    for (let i = 0; i < 0.7 * 20; i++) {
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
  expect(r.early).toBe(null); // 0.8s isn't enough
  expect(r.picked).toBe(r.lost[2]);
  expect(r.dragon).toBe(r.lost[2]);
  expect(r.left).toEqual([r.lost[0], r.lost[1]]);
  expect(r.next).toBe('find');
  expect(r.home).toEqual([r.lost[2]]);
  expect(r.after.slice(0, 2)).toEqual([r.lost[0], r.lost[1]]);
  expect(r.after).toHaveLength(3);
  expect(new Set([...r.after, ...r.home]).size).toBe(4); // nobody shares a name
});

test('nobody picks: after about 5s it picks for you so the line keeps moving', async ({ page }) => {
  await boot(page);
  const r = await choose(page, () => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    w.goto('choose');
    const c = g.scenes.current;
    const mid = c.options[1].d.name;
    for (let i = 0; i < 4.7 * 20; i++) {
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
