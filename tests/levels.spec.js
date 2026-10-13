// three levels on the attract screen, and picking one is how you start
import { test, expect } from '@playwright/test';
import { boot, state, startRun } from './helpers.js';

// stepped by hand so it's quick. the real-mouse version of this is every full run below and in
// fullrun.spec.js, which all start by holding the light on a level
const STEP = 0.05;
for (const level of ['hatchling', 'flier', 'storm']) {
  test(`holding the light on ${level} for 1.5s starts a ${level} run`, async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(([id, STEP]) => {
      const w = window.__emberwing;
      const g = w.game;
      w.pause(true);
      w.goto('attract');
      const a = g.scenes.current;
      const at = a.levelTarget(id);
      // wait out the handoff with the light down by the sea, then bring it up onto the level
      while (a.inHandoff()) { g.input.feed(200, 250, 'mouse'); w.step(STEP); }
      for (let i = 0; i <= 10; i++) { g.input.feed(200 + ((at.x - 200) * i) / 10, 250 + ((at.y - 250) * i) / 10, 'mouse'); w.step(STEP); }
      let held = 0;
      let at13 = null;
      for (; held < 3 && !g.scenes.pending; held += STEP) {
        if (at13 === null && held >= 1.3) at13 = g.scenes.pending?.name ?? g.scenes.name;
        g.input.feed(at.x + (Math.round(held / STEP) % 2), at.y, 'mouse');
        w.step(STEP);
      }
      return { at13, held: +held.toFixed(2), next: g.scenes.pending?.name ?? g.scenes.name, level: g.level };
    }, [level, STEP]);
    expect(r.at13).toBe('attract'); // still filling at 1.3s
    expect(r.held).toBeLessThanOrEqual(1.7);
    expect(r.next).toBe('choose');
    expect(r.level).toBe(level);
  });
}

test('only the levels start a game: a light resting anywhere else for 10s never does, and nothing fills off a level', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate((STEP) => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    // the storybook, the middle, the tally, the sea, the sky above the levels, the speaker corner
    const spots = [[120, 90], [200, 120], [80, 190], [240, 245], [300, 15], [420, 250], [60, 250]];
    const out = [];
    for (const [x, y] of spots) {
      w.goto('attract');
      const a = g.scenes.current;
      // someone raises the light (a smooth sweep, like a real hand) and then holds it still there
      for (let i = 0; i <= 20; i++) { g.input.feed(x + (20 - i) * 3, y + (20 - i) * 2, 'mouse'); w.step(STEP); }
      let filled = 0;
      for (let i = 0; i < 10 / STEP; i++) {
        g.input.feed(x + Math.sin(i) * 1.5, y + Math.cos(i * 1.3) * 1.5, 'mouse');
        w.step(STEP);
        filled = Math.max(filled, ...a.rows.map((row) => row.progress));
      }
      out.push({ x, y, scene: g.scenes.pending?.name ?? g.scenes.name, filled });
    }
    return out;
  }, STEP);
  for (const spot of r) expect(spot).toEqual({ x: spot.x, y: spot.y, scene: 'attract', filled: 0 });
});

test('handoff: a light left on a level by the last guest never starts the next game, moving it off and back does', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate((STEP) => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const at = g.scenes.scenes.attract.levelTarget('flier');
    const rest = (secs) => {
      for (let i = 0; i < secs / STEP; i++) {
        g.input.feed(at.x + Math.sin(i) * 1.5, at.y + Math.cos(i * 1.3) * 1.5, 'mouse'); // a prop on a table jitters a little
        w.step(STEP);
      }
    };
    // the last guest's dragon card, with the prop already put down pointing at FLIER, and the
    // start screen coming back on its own
    w.goto('end');
    for (let i = 0; i < 20 / STEP && g.scenes.name !== 'attract'; i++) rest(STEP);
    const back = g.scenes.name;
    rest(10);
    const after10 = g.scenes.pending?.name ?? g.scenes.name;
    const filled = g.scenes.current.rows.find((row) => row.id === 'flier').progress;
    // the next guest picks it up: off the level, then back onto it
    for (let i = 0; i < 10; i++) { g.input.feed(at.x - 60, at.y + 70, 'mouse'); w.step(STEP); }
    for (let i = 0; i < 2 / STEP && !g.scenes.pending; i++) { g.input.feed(at.x + (i % 2), at.y, 'mouse'); w.step(STEP); }
    return { back, after10, filled, next: g.scenes.pending?.name ?? g.scenes.name, level: g.level };
  }, STEP);
  expect(r.back).toBe('attract');
  expect(r.after10).toBe('attract');
  expect(r.filled).toBe(0);
  expect(r.next).toBe('choose');
  expect(r.level).toBe('flier');
});

test('handoff: for 2s after the start screen comes back nothing fills, even a light moved onto a level', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate((STEP) => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.input.feed(200, 250, 'mouse');
    w.goto('attract', { reason: 'done' });
    const a = g.scenes.current;
    const at = a.levelTarget('hatchling');
    let filled = 0;
    // straight onto hatchling while the last guest is still walking off, and held there
    for (let i = 0; a.inHandoff(); i++) {
      g.input.feed(at.x + (i % 2), at.y, 'mouse');
      w.step(STEP);
      filled = Math.max(filled, a.rows[0].progress);
    }
    // it was already resting there when the handoff ended, so it stays dead
    for (let i = 0; i < 3 / STEP; i++) { g.input.feed(at.x + (i % 2), at.y, 'mouse'); w.step(STEP); }
    return { filled, scene: g.scenes.pending?.name ?? g.scenes.name, after: a.rows[0].progress };
  }, STEP);
  expect(r.filled).toBe(0);
  expect(r.scene).toBe('attract');
  expect(r.after).toBe(0);
});

test('sliding off a level cancels the fill quickly, coming back starts over', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate((STEP) => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    w.goto('attract');
    const a = g.scenes.current;
    const at = a.levelTarget('storm');
    const row = a.rows.find((x) => x.id === 'storm');
    const hold = (secs, x, y) => { for (let i = 0; i < secs / STEP; i++) { g.input.feed(x + (i % 2), y, 'mouse'); w.step(STEP); } };
    while (a.inHandoff()) hold(STEP, 200, 250);
    hold(1.0, at.x, at.y);
    const part = row.progress;
    hold(0.35, at.x, 250); // slides down off the level
    const gone = row.progress;
    hold(1.0, at.x, at.y); // back on: another 1s isn't enough
    return { part: +part.toFixed(2), gone, again: g.scenes.pending?.name ?? g.scenes.name };
  }, STEP);
  expect(r.part).toBeGreaterThan(0.6);
  expect(r.gone).toBe(0); // drained in about 0.3s
  expect(r.again).toBe('attract');
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
