import { test, expect } from '@playwright/test';
import { boot, state, startRun, findDragon, fly, watch, waitScene } from './helpers.js';

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
      w.step(4.6);
      out[before] = { left, celebrate: h.celebrate, partying: h.partyK > 0 && h.partyK < 1, length: h.length };
    }
    return out;
  });
  expect(r[6]).toMatchObject({ left: 2, celebrate: false, partying: false });
  expect(r[7]).toMatchObject({ left: 1, celebrate: true, partying: true }); // the 8th
  expect(r[8]).toMatchObject({ left: 8, celebrate: false });
  expect(r[15]).toMatchObject({ left: 1, celebrate: true }); // the 16th
  expect(r[7].length).toBeGreaterThan(r[6].length + 3);
});

test('operator C clears the dragons along with the ribbons', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const g = window.__emberwing.game;
    for (let i = 0; i < 3; i++) g.store.add([[0, 0.5], [1, 0.4]], i);
  });
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

test('cold first run of the night: nobody home yet, the first dragon flies home alone', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await boot(page);
  const start = await page.evaluate(() => {
    const w = window.__emberwing;
    return { count: w.game.store.count, seen: w.game.scenes.current.visibleDragons(), name: w.game.dragon.name };
  });
  expect(start.count).toBe(0);
  expect(start.seen.near + start.seen.far).toBe(0);
  expect(start.seen.partyLeft).toBe(8);

  await startRun(page);
  expect((await state(page)).dragon).toBe(start.name);
  await findDragon(page);
  await waitScene(page, 'flight');
  const swellFlock = await page.evaluate(() => window.__emberwing.game.scenes.current.visibleDragons());
  expect(swellFlock.near + swellFlock.far).toBe(0);
  await fly(page);
  await waitScene(page, 'home');
  const home = await page.evaluate(() => window.__emberwing.game.scenes.current.visibleDragons());
  expect(home).toMatchObject({ near: 1, far: 0, names: [start.name] });
  await watch(page, 'attract');
  const after = await page.evaluate(() => {
    const w = window.__emberwing;
    return { count: w.game.store.count, seen: w.game.scenes.current.visibleDragons(), next: w.game.dragon.name, saved: w.game.store.dragons.map((d) => d.name) };
  });
  expect(after.count).toBe(1);
  expect(after.saved).toEqual([start.name]);
  expect(after.seen).toMatchObject({ near: 1, far: 0, names: [start.name], partyLeft: 7 });
  expect(after.next).not.toBe(start.name); // a new dragon is lost for the next guest
});
