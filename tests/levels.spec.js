// three levels on the attract screen, and picking one is how you start
import { test, expect } from '@playwright/test';
import { boot, state, startRun } from './helpers.js';

// stepped by hand so it's quick. the real-mouse version of this is every full run below and in
// fullrun.spec.js, which all start by holding the light on a level
for (const level of ['hatchling', 'flier', 'storm']) {
  test(`holding the light on ${level} starts a ${level} run`, async ({ page }) => {
    await boot(page);
    const r = await page.evaluate((id) => {
      const w = window.__emberwing;
      const g = w.game;
      w.pause(true);
      w.goto('attract');
      const at = g.scenes.current.levelTarget(id);
      // raise the light from the bottom of the screen, then hold it on the level
      for (let i = 0; i <= 20; i++) {
        g.input.feed(200 + ((at.x - 200) * i) / 20, 250 + ((at.y - 250) * i) / 20, 'mouse');
        w.step(0.05);
      }
      for (let i = 0; i < 40 && !g.scenes.pending; i++) {
        g.input.feed(at.x + (i % 2), at.y, 'mouse');
        w.step(0.05);
      }
      return { next: g.scenes.pending?.name ?? g.scenes.name, level: g.level };
    }, level);
    expect(r.next).toBe('choose');
    expect(r.level).toBe(level);
  });
}

test('holding the light still anywhere near the middle starts hatchling, a resting light never does', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const feed = (secs, x, y) => {
      for (let i = 0; i < secs * 20; i++) {
        g.input.feed(x, y, 'mouse');
        w.step(0.05);
      }
    };
    // a prop that was already pointing at the middle when attract came up, never moving
    w.goto('attract');
    feed(4, 200, 120);
    const resting = g.scenes.name;
    // someone raises the light (a smooth sweep, like a real hand) and holds it over the storybook
    for (let i = 0; i <= 20; i++) feed(0.05, 80 + i * 6, 200 - i * 4);
    feed(1.0, 200, 120);
    const early = g.scenes.name;
    feed(1.4, 200, 120);
    return { resting, early, after: g.scenes.pending?.name ?? g.scenes.name, level: g.level };
  });
  expect(r.resting).toBe('attract');
  expect(r.early).toBe('attract'); // 1s isn't enough
  expect(r.after).toBe('choose'); // then "who will you find?"
  expect(r.level).toBe('hatchling');
});

test('each level plays by its own numbers from config.js', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = {};
    for (const id of ['hatchling', 'flier', 'storm']) {
      g.level = id;
      w.goto('flight');
      const f = g.scenes.current;
      const L = w.LEVELS[id];
      const rings = f.rings.slice(1);
      out[id] = {
        hoops: f.rings.length,
        want: L.hoops,
        gap: rings[1].at - rings[0].at,
        wantGap: (L.hoopBeats * 60) / 120,
        r0: f.ringR(rings[0]),
        wantR0: L.ringR[0],
        moving: rings.filter((x) => x.move).length,
        scroll: f.L.scroll,
        wantScroll: L.scroll,
        T: f.T,
      };
    }
    return out;
  });
  for (const id of ['hatchling', 'flier', 'storm']) {
    const x = r[id];
    expect(x.hoops).toBe(x.want);
    expect(x.gap).toBeCloseTo(x.wantGap, 5);
    // the first hoop's size (they grow a little over the flight)
    expect(x.r0).toBeGreaterThanOrEqual(x.wantR0);
    expect(x.r0).toBeLessThan(x.wantR0 + 2);
    expect(x.scroll).toBe(x.wantScroll);
  }
  // and they really get harder: more hoops, closer together, smaller, faster, moving
  expect(r.flier.hoops).toBeGreaterThan(r.hatchling.hoops);
  expect(r.storm.hoops).toBeGreaterThan(r.flier.hoops);
  expect(r.flier.r0).toBeLessThan(r.hatchling.r0);
  expect(r.storm.r0).toBeLessThan(r.flier.r0);
  expect(r.storm.gap).toBeLessThan(r.hatchling.gap);
  expect(r.hatchling.moving).toBe(0);
  expect(r.flier.moving).toBeGreaterThan(0);
  expect(r.storm.moving).toBeGreaterThan(r.flier.moving);
});

test('every level always gets the dragon home', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = {};
    for (const id of ['hatchling', 'flier', 'storm']) {
      g.level = id;
      w.goto('flight');
      let t = 0;
      // a guest who mostly flies the wrong way
      while (g.scenes.name === 'flight' && !g.scenes.pending && t < 60) {
        g.input.feed(240 + Math.sin(t * 0.7) * 200, 135 + Math.cos(t * 1.9) * 120, 'mouse');
        w.step(0.1, 60, false);
        t += 0.1;
      }
      out[id] = { home: g.scenes.pending?.name === 'home' || g.scenes.name === 'home', t: +t.toFixed(1) };
    }
    return out;
  });
  for (const id of ['hatchling', 'flier', 'storm']) expect(r[id].home).toBe(true);
});

// how long a whole run takes on each level, start to back on attract (hatchling's 35-50s and
// never-finds checks are in fullrun.spec.js). aiming for ~45s easy and up to ~60s hard
test.describe.serial('run times per level', () => {
  const times = {};
  for (const [level, max] of [['flier', 56], ['storm', 62]]) {
    test(`a guest who knows what to do: ${level} in under ${max}s`, async ({ page }) => {
      const { findDragon, fly, watch, waitScene } = await import('./helpers.js');
      await boot(page);
      await startRun(page, { level });
      expect((await state(page)).level).toBe(level);
      await findDragon(page);
      await waitScene(page, 'flight', 60_000);
      await fly(page);
      await waitScene(page, 'home', 60_000);
      await watch(page, 'attract');
      const s = await state(page);
      times[level] = s.runs[0];
      console.log(`${level} run (game clock): ${s.runs[0]}s`);
      expect(s.runs[0]).toBeLessThanOrEqual(max);
    });
  }
  test('storm rider, a guest who never finds the dragon: still about a minute', async ({ page }) => {
    const { findDragon, fly, watch, waitScene } = await import('./helpers.js');
    await boot(page);
    await startRun(page, { level: 'storm' });
    await findDragon(page, { neverFind: true });
    await waitScene(page, 'flight', 60_000);
    await fly(page);
    await watch(page, 'attract');
    const s = await state(page);
    console.log(`storm never-finds run (game clock): ${s.runs[0]}s`);
    expect(s.runs[0]).toBeLessThanOrEqual(68);
    expect(times.storm ?? 0).toBeLessThanOrEqual(s.runs[0]);
  });
});
