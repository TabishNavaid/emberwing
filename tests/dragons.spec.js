import { test, expect } from '@playwright/test';
import { boot, reload } from './helpers.js';

// every guest rescues a different dragon, and the flock on screen is always exactly the
// dragons people brought home tonight

test('every guest gets a different dragon, and no name repeats until the list runs out', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    const seen = [];
    for (let i = 0; i < 70; i++) {
      w.goto('attract'); // picks the next lost dragon
      const d = g.dragon;
      seen.push({ name: d.name, seed: d.seed, body: d.body, wing: d.wing, head: d.head, tail: d.tail, quirk: d.quirk });
      w.goto('home'); // brings it home
    }
    return { seen, count: g.store.count };
  });
  expect(r.count).toBe(70);
  // names: all different until the list is used up (it has 40+)
  const firstRepeat = r.seen.findIndex((d, i) => r.seen.slice(0, i).some((e) => e.name === d.name));
  expect(firstRepeat).toBeGreaterThanOrEqual(40);
  // and every dragon looks different from the one before: new body color plus a new shape
  for (let i = 1; i < r.seen.length; i++) {
    const a = r.seen[i - 1];
    const b = r.seen[i];
    expect(b.seed).not.toBe(a.seed);
    expect(b.body).not.toBe(a.body);
    expect(b.wing !== a.wing || b.head !== a.head).toBe(true);
  }
});

test('the flock on screen always matches the dragons saved tonight', async ({ page }) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = [];
    for (const n of [0, 1, 3, 12, 13, 20]) {
      g.store.clear();
      for (let i = 0; i < n; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
      const saved = g.store.dragons.map((d) => d.name);
      w.goto('attract');
      const a = w.game.scenes.current.visibleDragons();
      w.goto('flight');
      const f = w.game.scenes.current.visibleDragons();
      w.goto('home'); // the guest's dragon makes it n + 1
      const h = w.game.scenes.current;
      w.step(3.0);
      const before = { ticked: h.ticked };
      w.step(0.6);
      const home = { ...h.visibleDragons(), ticked: h.ticked, shown: h.count, count: g.store.count };
      w.goto('attract');
      const after = w.game.scenes.current.visibleDragons();
      out.push({ n, saved, a, f, before, home, after });
    }
    return out;
  });
  for (const { n, saved, a, f, before, home, after } of rows) {
    expect(a.near + a.far).toBe(n);
    expect(a.near).toBe(Math.min(n, 12));
    expect(a.names).toEqual(saved.slice(-12)); // the newest ones up close
    expect(f.near + f.far).toBe(n); // the swell brings out exactly who's home
    expect(home.count).toBe(n + 1);
    expect(home.near + home.far).toBe(n + 1);
    expect(home.shown).toBe(n + 1);
    expect(before.ticked).toBe(false); // counter hidden until it lands on the new number
    expect(home.ticked).toBe(true);
    expect(after.near + after.far).toBe(n + 1);
  }
});

test('every 8th dragon home gets a celebration, and attract counts down to it', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const out = {};
    for (const before of [6, 7, 8, 15]) {
      g.store.clear();
      for (let i = 0; i < before; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
      w.goto('attract');
      const left = w.game.scenes.current.visibleDragons().partyLeft;
      w.goto('home');
      const h = w.game.scenes.current;
      w.step(5.2); // home is over, on to whatever comes next
      out[before] = { left, celebrate: h.celebrate, next: g.scenes.name };
      g.scenes.pending = null;
      g.scenes.fadeDir = 0;
    }
    return out;
  });
  expect(r[6]).toMatchObject({ left: 2, celebrate: false, next: 'end' });
  expect(r[7]).toMatchObject({ left: 1, celebrate: true, next: 'party' }); // the 8th
  expect(r[8]).toMatchObject({ left: 8, celebrate: false, next: 'end' });
  expect(r[15]).toMatchObject({ left: 1, celebrate: true, next: 'party' }); // the 16th
});

test('operator C asks first: N keeps the night, Y clears the ribbons and the dragons', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const g = window.__emberwing.game;
    for (let i = 0; i < 3; i++) g.store.add([[0, 0.5], [1, 0.4]], i);
  });
  await page.keyboard.press('c');
  expect(await page.evaluate(() => window.__emberwing.game.op.confirm > 0)).toBe(true);
  await page.keyboard.press('n');
  expect(await page.evaluate(() => window.__emberwing.game.store.count)).toBe(3);
  await page.keyboard.press('c');
  await page.keyboard.press('y');
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    w.step(0.1);
    return { count: w.game.store.count, saved: w.game.store.dragons.length, seen: w.game.scenes.current.visibleDragons() };
  });
  expect(r.count).toBe(0);
  expect(r.saved).toBe(0);
  expect(r.seen.near + r.seen.far).toBe(0);
});

test('a saved night comes back after a refresh: dragons, ribbons, best flights, celebration stars', async ({ page }) => {
  await boot(page);
  const night = () => page.evaluate(() => {
    const g = window.__emberwing.game;
    const s = g.store;
    return {
      count: s.count,
      ribbons: s.ribbons,
      dragons: s.dragons.map((d) => [d.seed, d.name]),
      best: s.best,
      stars: Math.floor(s.count / 8),
      flock: g.scenes.current.visibleDragons(),
    };
  });
  await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    // 9 guests, each brings the lost dragon home through the real home scene with a score
    for (let i = 0; i < 9; i++) {
      w.goto('attract');
      g.level = ['hatchling', 'flier', 'storm'][i % 3];
      w.goto('home', { path: [[0, 0.5], [0.3, 0.3 + i * 0.02], [0.6, 0.6], [1, 0.4]], run: { flown: true, level: g.level, score: 500 + i * 100 } });
    }
    w.goto('attract');
  });
  const saved = await night();
  await reload(page);
  const after = await night();
  expect(saved.count).toBe(9);
  expect(saved.stars).toBe(1);
  expect(Object.keys(saved.best).sort()).toEqual(['flier', 'hatchling', 'storm']);
  expect(after).toEqual(saved);
});

test('the dragon card shows the rescued dragon and its number tonight, then goes back to attract', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    for (let i = 0; i < 8; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
    w.goto('attract');
    const lost = g.dragon.name;
    w.goto('home');
    w.goto('end');
    const card = g.scenes.current;
    const shown = { name: card.d.name, nth: card.nth };
    w.step(4.5);
    const stillUp = g.scenes.name;
    w.step(1.2);
    return { lost, shown, stillUp, after: g.scenes.name, saved: g.store.dragons.at(-1).name };
  });
  expect(r.shown.name).toBe(r.lost);
  expect(r.saved).toBe(r.lost);
  expect(r.shown.nth).toBe(9); // "THE 9TH EMBERWING HOME TONIGHT"
  expect(r.stillUp).toBe('end'); // holds about 5s
  expect(r.after).toBe('attract');
});
