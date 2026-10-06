// three flight routes take turns. only the scenery changes, every guest gets the same flight
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test('guests in a row get the three routes in turn, each with the same 8 hoops at the same times', async ({ page }) => {
  await boot(page);
  const runs = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    const out = [];
    for (let i = 0; i < 4; i++) {
      w.goto('attract');
      g.scenes.current.start(g); // what holding the lantern does
      g.scenes.pending = null; // skip the fade, jump straight in
      g.scenes.fadeDir = 0;
      w.goto('flight');
      const f = g.scenes.current;
      out.push({ route: f.routeIndex, name: f.route.name, hoops: f.rings.length, at: f.rings.slice(1).map((r) => r.at) });
      w.goto('home'); // this guest made it, the next one gets the next route
    }
    return out;
  });
  expect(runs.map((r) => r.route)).toEqual([0, 1, 2, 0]);
  expect(new Set(runs.map((r) => r.name)).size).toBe(3);
  for (const r of runs) {
    expect(r.hoops).toBe(8);
    expect(r.at).toEqual(runs[0].at);
  }
});

test('every route plays all the way home without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  const results = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = [];
    for (let route = 0; route < 3; route++) {
      g.route = route;
      w.goto('flight');
      let t = 0;
      while (g.scenes.name === 'flight' && t < 40) {
        g.input.feed(200 + Math.sin(t) * 80, 135 + Math.cos(t * 1.3) * 60, 'mouse');
        w.step(0.1, 60, false);
        t += 0.1;
      }
      out.push({ route, home: g.scenes.name === 'home' || !!g.scenes.pending, t: +t.toFixed(1) });
    }
    return out;
  });
  for (const r of results) expect(r.home).toBe(true);
  expect(errors).toEqual([]);
});
