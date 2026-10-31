// the a/b test: ?v=b is B (only the music page in the storybook, levels about 30% longer), the
// normal url is A. each keeps its own sky, and every run goes in the operator's run log (L, X)
import { test, expect } from '@playwright/test';
import { boot, state } from './helpers.js';

const STEP = 1 / 60;

test('the normal url and ?v=a are A, ?v=b is B; the A or B in the corner only shows with the D overlay', async ({ page }) => {
  for (const [q, want] of [['', 'a'], ['&v=a', 'a'], ['&v=b', 'b'], ['&v=B', 'b']]) {
    await boot(page, q);
    expect((await state(page)).version).toBe(want);
  }
  // A plays the levels exactly as config.js has them
  await boot(page);
  expect(await page.evaluate(() => ['hatchling', 'flier', 'storm'].every((id) => window.__emberwing.levelFor(id) === window.__emberwing.LEVELS[id]))).toBe(true);
  // the letter is drawn in the debug overlay's teal, bottom right
  const letter = () => page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    w.step(0.05);
    const px = document.getElementById('screen').getContext('2d').getImageData(480 - 14, 270 - 11, 14, 11).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] === 0x9f && px[i + 1] === 0xff && px[i + 2] === 0xe0) n++;
    return n;
  });
  await boot(page, '&v=b');
  expect(await letter()).toBe(0);
  await page.keyboard.press('d');
  expect(await letter()).toBeGreaterThan(5);
  await page.keyboard.press('d');
  expect(await letter()).toBe(0);
});

test('B: the start screen shows only the music page, no story and no ghost demo, and still asks for the light; A turns all five pages', async ({ page }) => {
  const look = async (q) => {
    await boot(page, q);
    return page.evaluate(() => {
      const w = window.__emberwing;
      w.pause(true);
      w.goto('attract');
      const words = new Set();
      let dots = false;
      // a full turn of the book and then some
      for (let i = 0; i < 60 / 0.25; i++) {
        w.step(0.25, 60, false);
        const { lines, shapes } = w.layout();
        for (const [text] of lines) words.add(text);
        dots ||= shapes.some(([name]) => name === 'page dots');
      }
      return { words: [...words], dots };
    });
  };
  const a = await look('');
  for (const line of ['A STORM...', 'DRAGONS ARE LOST', 'FIND THE EYES', 'GUIDE THEM HOME', 'HEAR IT IN ACT II', 'RAISE YOUR LIGHT']) expect(a.words).toContain(line);
  expect(a.dots).toBe(true);
  const b = await look('&v=b');
  for (const line of ['HEAR IT IN ACT II', 'WALLA WALLA', 'YOUTH ORCHESTRA', 'RAISE YOUR LIGHT']) expect(b.words).toContain(line);
  for (const line of ['A STORM...', 'DRAGONS ARE LOST', 'FIND THE EYES', 'FLY HOME!', 'GUIDE THEM HOME']) expect(b.words).not.toContain(line);
  expect(b.dots).toBe(false); // one page, nothing to turn to
});

test('B: every level about 30% longer, more hoops on the same beat, same size and speed, enemies just as often', async ({ page }) => {
  await boot(page, '&v=b');
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = {};
    for (const id of ['hatchling', 'flier', 'storm']) {
      g.level = id;
      w.goto('flight');
      const f = g.scenes.current;
      const A = w.LEVELS[id];
      const rings = f.rings.slice(1);
      const enemies = (L) => Object.values(L.enemies).reduce((a, b) => a + b, 0) + L.puffs + L.gusts;
      out[id] = {
        hoops: f.rings.length,
        aHoops: A.hoops,
        gap: rings[1].at - rings[0].at,
        aGap: (A.hoopBeats * 60) / 120,
        r0: f.ringR(rings[0]),
        aR0: A.ringR[0],
        scroll: f.L.scroll,
        aScroll: A.scroll,
        T: f.T,
        aT: A.timeline,
        lastAt: rings[rings.length - 1].at,
        rise: f.T * 0.9,
        enemies: enemies(f.L),
        aEnemies: enemies(A),
        stars: f.L.stars,
        aStars: A.stars,
      };
    }
    return out;
  });
  console.log('B levels:', JSON.stringify(Object.fromEntries(Object.entries(r).map(([id, x]) => [id, { hoops: `${x.aHoops} -> ${x.hoops}`, timeline: `${x.aT} -> ${x.T}`, enemies: `${x.aEnemies} -> ${x.enemies}` }]))));
  for (const x of Object.values(r)) {
    expect(x.hoops / x.aHoops).toBeGreaterThan(1.2);
    expect(x.hoops / x.aHoops).toBeLessThan(1.4);
    expect(x.gap).toBeCloseTo(x.aGap, 5);
    expect(x.r0).toBeGreaterThanOrEqual(x.aR0);
    expect(x.r0).toBeLessThan(x.aR0 + 2);
    expect(x.scroll).toBe(x.aScroll);
    expect(x.T).toBeGreaterThan(x.aT);
    expect(x.lastAt).toBeLessThan(x.rise); // the last hoop still comes before the climb
    if (x.aEnemies) expect(Math.abs(x.enemies / x.aEnemies - x.hoops / x.aHoops)).toBeLessThan(0.15);
    expect(x.stars[0]).toBeGreaterThan(x.aStars[0]);
  }
});

test('A and B each keep their own sky, dragons and best scores', async ({ page }) => {
  const add = (score) => page.evaluate((score) => {
    const g = window.__emberwing.game;
    g.store.add([[0.2, 0.5], [0.6, 0.4]], 1, g.lost[0], { level: 'hatchling', score, flown: true });
  }, score);
  const night = () => page.evaluate(() => ({ count: window.__emberwing.game.store.count, best: window.__emberwing.game.store.best.hatchling?.score ?? null }));
  await boot(page);
  await add(1200);
  await add(900);
  await boot(page, '&v=b');
  expect(await night()).toEqual({ count: 0, best: null });
  await add(500);
  await boot(page);
  expect(await night()).toEqual({ count: 2, best: 1200 });
  await boot(page, '&v=b');
  expect(await night()).toEqual({ count: 1, best: 500 });
  // A still uses the key every save before the a/b test used
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('emberwing.night')).sort())).toEqual(['emberwing.night.v1', 'emberwing.night.v1.b']);
});

// a scripted guest, stepped by hand: steps up to the start screen, picks a level, a dragon, finds it
// and flies it home, all with the light. quitAt = the screen they walk away from instead
const playRuns = (page, runs) => page.evaluate(([runs, STEP]) => {
  const w = window.__emberwing;
  const g = w.game;
  w.pause(true);
  for (const { level, quitAt } of runs) {
    w.goto('attract', { reason: 'operator' });
    let i = 0;
    const feed = (x, y) => {
      g.input.feed(x + Math.sin(i++ * 0.7) * 2, y, 'mouse');
      w.step(STEP, 60, false);
    };
    const at = g.scenes.current.levelTarget(level);
    for (let k = 0; k < 3 / STEP; k++) feed(200, 250); // reading the screen for 3s
    while (g.scenes.name === 'attract') feed(at.x, at.y);
    for (let k = 0; k < 150 / STEP && g.scenes.name !== 'attract'; k++) {
      const name = g.scenes.name;
      if (name === quitAt) w.step(STEP, 60, false); // walked off, the light just sits there
      else if (name === 'choose' && g.scenes.current.locked()) feed(240, 255);
      else if (name === 'choose') {
        const o = g.scenes.current.optionTarget(0);
        feed(o.x, o.y);
      } else {
        const s = w.state();
        if (s.target && name !== 'end') feed(s.target.x, s.target.y);
        else feed(200 + Math.sin(k * 0.02) * 30, 120); // watching, clear of the card's NEXT
      }
    }
  }
  return JSON.parse(localStorage.getItem('emberwing.runs.v1'));
}, [runs, STEP]);

test('run log: every run gets a line (version, level, seconds per screen, hoops, finished or idled out), in both versions', async ({ page }) => {
  const levels = ['hatchling', 'flier', 'storm'];
  await boot(page);
  const a = await playRuns(page, [...levels.map((level) => ({ level })), { level: 'hatchling', quitAt: 'find' }]);
  await boot(page, '&v=b');
  const all = await playRuns(page, levels.map((level) => ({ level })));
  expect(all.slice(0, 4)).toEqual(a); // one list, B's runs after A's
  const b = all.slice(4);
  const times = {};
  for (const r of [...a.slice(0, 3), ...b]) {
    times[`${r.v.toUpperCase()} ${r.level}`] = r.total;
    expect(r.end).toBe('done');
    for (const screen of ['start', 'choose', 'find', 'flight', 'home', 'end']) expect(r.t[screen]).toBeGreaterThan(0);
    expect(r.t.start).toBeGreaterThan(4); // 3s reading + the 1.5s hold
    expect(r.t.start).toBeLessThan(6);
    // the total runs from the level being picked, the rest of it is the start screen fading out
    const sum = Object.entries(r.t).reduce((x, [k, y]) => x + (k === 'start' ? 0 : y), 0);
    expect(r.total - sum).toBeGreaterThan(0);
    expect(r.total - sum).toBeLessThan(1.5);
    expect(r.hits).toBeGreaterThan(r.of / 2);
  }
  console.log('run times, stepped guest (game clock):', JSON.stringify(times));
  expect(a.map((r) => [r.v, r.level, r.of])).toEqual([['a', 'hatchling', 8], ['a', 'flier', 13], ['a', 'storm', 20], ['a', 'hatchling', 0]]);
  expect(b.map((r) => [r.v, r.level, r.of])).toEqual([['b', 'hatchling', 10], ['b', 'flier', 17], ['b', 'storm', 26]]);
  for (const i of [0, 1, 2]) expect(b[i].total).toBeGreaterThan(a[i].total);
  // walked away while looking for the dragon: idled out of find, no flight
  expect(a[3]).toMatchObject({ v: 'a', level: 'hatchling', end: 'idle', where: 'find', hits: 0, of: 0 });
  expect(a[3].t.flight).toBeUndefined();
});

test('run log: L shows it as a table, X asks first and then clears only the log, it keeps 500 runs', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__emberwing.game;
    // 510 old runs, 3 more than fit
    for (let i = 0; i < 510; i++) g.log.runs.push({ v: i % 2 ? 'b' : 'a', level: 'flier', at: String(i), t: { start: 5, choose: 2 }, total: 40, hits: 9, of: 13, end: 'done' });
    return g.log.summary('a');
  });
  expect(r).toMatchObject({ v: 'a', runs: 255, done: 255, total: 40, hits: 9, of: 13 });
  // the next finished run trims it to 500
  await playRuns(page, [{ level: 'hatchling' }]);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('emberwing.runs.v1')));
  expect(kept.length).toBe(500);
  expect(kept[0].at).toBe('11');
  const op = () => page.evaluate(() => {
    const w = window.__emberwing;
    w.step(0.05);
    return { table: w.game.op.table, drawn: w.game.op.tableKey ?? null, confirm: w.game.op.confirm > 0, runs: w.game.log.runs.length, saved: JSON.parse(localStorage.getItem('emberwing.runs.v1')).length, sky: w.game.store.count };
  });
  await page.keyboard.press('l');
  expect(await op()).toMatchObject({ table: true, runs: 500 });
  expect((await op()).drawn).toContain('500 ');
  await page.keyboard.press('x');
  expect(await op()).toMatchObject({ confirm: true });
  await page.keyboard.press('n');
  expect(await op()).toMatchObject({ confirm: false, runs: 500, saved: 500 });
  await page.keyboard.press('x');
  await page.keyboard.press('y');
  expect(await op()).toMatchObject({ confirm: false, runs: 0, saved: 0, sky: 1 }); // the run's dragon is still in the sky
  await page.keyboard.press('l');
  expect((await op()).table).toBe(false);
});
