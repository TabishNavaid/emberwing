import { test, expect } from '@playwright/test';
import { boot, reload } from './helpers.js';

// a score for hoops, streaks, popping enemies and clean flying, 1 to 3 stars, the best flight
// per level on attract

// flies a whole flight by hand. aim = how far off the middle of each hoop to aim (px)
const flyIt = (aim) => {
  const w = window.__emberwing;
  const g = w.game;
  w.goto('flight');
  const f = g.scenes.current;
  for (let i = 0; i < 40 * 20 && g.scenes.name === 'flight' && !g.scenes.pending; i++) {
    const s = w.state();
    if (s.target) g.input.feed(s.target.x, s.target.y + aim, 'mouse');
    w.step(0.05, 60, false);
  }
  return f;
};

test('hoops, perfect hoops and streaks score; clean flying gets a bonus; stars follow the score', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.level = 'hatchling';
    const flyIt = ${flyIt.toString()};
    const sharp = flyIt(0);
    const a = { score: sharp.points.score, hits: sharp.points.hits, perfects: sharp.points.perfects, stars: sharp.points.stars, clean: sharp.points.clean, best: sharp.points.bestStreak };
    const sloppy = flyIt(80);
    const b = { score: sloppy.points.score, hits: sloppy.points.hits, misses: sloppy.points.misses, stars: sloppy.points.stars };
    return { a, b, L: w.LEVELS.hatchling };
  })()`);
  // aiming at every hoop: all 8, mostly perfect, a long streak, clean bonus, 3 stars
  expect(r.a.hits).toBe(8);
  expect(r.a.perfects).toBeGreaterThanOrEqual(6);
  expect(r.a.best).toBe(8);
  expect(r.a.clean).toBe(true);
  expect(r.a.score).toBeGreaterThanOrEqual(r.L.stars[1]);
  expect(r.a.stars).toBe(3);
  // aiming way off: fewer hoops, a lower score, still at least one star
  expect(r.b.hits).toBeLessThan(r.a.hits);
  expect(r.b.score).toBeLessThan(r.a.score);
  expect(r.b.stars).toBeGreaterThanOrEqual(1);
  expect(r.b.stars).toBeLessThan(3);
});

test('the dragon card shows the score and stars, attract shows the best flight per level, C clears it', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    const flyIt = ${flyIt.toString()};
    w.goto('attract');
    g.level = 'hatchling';
    const kid = g.dragon.name;
    flyIt(0);
    w.step(1); // into home
    w.step(5); // home -> card
    const card = g.scenes.current;
    const onCard = { scene: g.scenes.name, score: card.run.score, stars: card.run.stars, name: card.d.name };
    w.goto('attract');
    g.level = 'storm';
    const teen = g.dragon.name;
    flyIt(30);
    w.step(6);
    w.goto('attract');
    return { onCard, kid, teen, best: g.store.best };
  })()`);
  expect(r.onCard.scene).toBe('end');
  expect(r.onCard.name).toBe(r.kid);
  expect(r.onCard.score).toBeGreaterThan(0);
  expect(r.onCard.stars).toBeGreaterThanOrEqual(1);
  // one best per level: the hatchling run is a best flight too, even next to a storm rider
  expect(r.best.hatchling).toMatchObject({ name: r.kid, score: r.onCard.score });
  expect(r.best.storm.name).toBe(r.teen);
  expect(r.best.flier).toBeUndefined();

  // survives a refresh
  await reload(page);
  const after = await page.evaluate(() => window.__emberwing.game.store.best);
  expect(after.hatchling.name).toBe(r.kid);
  // C clears it with everything else
  await page.keyboard.press('c');
  await page.keyboard.press('y');
  expect(await page.evaluate(() => window.__emberwing.game.store.best)).toEqual({});
});

test('a lower score on the same level does not replace the best, skipping to home posts nothing', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    g.store.add([[0, 0.5], [1, 0.5]], 0, null, { flown: true, level: 'flier', score: 1200 });
    g.store.add([[0, 0.5], [1, 0.5]], 0, null, { flown: true, level: 'flier', score: 800 });
    g.store.add([[0, 0.5], [1, 0.5]], 0, null, { flown: false, level: 'hatchling', score: 0 });
    return g.store.best;
  });
  expect(r.flier.score).toBe(1200);
  expect(r.hatchling).toBeUndefined();
});
