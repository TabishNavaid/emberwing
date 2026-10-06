import { test, expect } from '@playwright/test';
import { boot, state, startRun, findDragon, fly, watch, waitScene, hover, reload } from './helpers.js';

const MIN = 35;
const MAX = 50;
// worst case (guest never finds the dragon). runs got a bit longer on purpose (picking a level
// and a dragon), aiming for ~45s on hatchling, so the worst case on hatchling is now ~55s
const ASSISTED_MAX = 56;

const seen = (page) => page.evaluate(() => window.__emberwing.game.scenes.current.visibleDragons());
// when each hoop showed up on screen and when it reached the gate
const flightReport = (page) => page.evaluate(() => {
  const f = window.__emberwing.game.scenes.scenes.flight;
  return f.rings.map((r) => ({ seen: r.seenAt, gate: r.gateAt }));
});

// one cold page, fresh night, two guests in a row, all real time. the bug report this started
// from: on a fresh page the first flight only had one hoop, and every later flight never got home
test('first two guests of the night: 35-50s, the first dragon flies home alone, every hoop gets a real chance', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await boot(page);
  const first = (await state(page)).dragon;
  const empty = await seen(page);
  expect(empty).toMatchObject({ near: 0, far: 0, untilCelebration: 8 });

  const hoops = [];
  for (let guest = 0; guest < 2; guest++) {
    const wall0 = Date.now();
    await startRun(page);
    expect((await state(page)).scene).toBe('find');
    if (guest === 0) expect((await state(page)).dragon).toBe(first);
    await findDragon(page);
    await waitScene(page, 'flight');
    const swell = await seen(page);
    expect(swell.near + swell.far).toBe(guest); // the swell brings out whoever is already home
    await fly(page);
    await waitScene(page, 'home');
    hoops.push(await flightReport(page));
    if (guest === 0) expect(await seen(page)).toMatchObject({ near: 1, far: 0, names: [first] });
    await watch(page, 'attract');
    const s = await state(page);
    console.log(`guest ${guest + 1} run (game clock): ${s.runs[guest]}s   wall clock: ${((Date.now() - wall0) / 1000).toFixed(1)}s`);
    expect(s.runs[guest]).toBeGreaterThanOrEqual(MIN);
    expect(s.runs[guest]).toBeLessThanOrEqual(MAX);
    expect(s.count).toBe(guest + 1);
    if (guest === 0) {
      expect(await seen(page)).toMatchObject({ near: 1, far: 0, names: [first], untilCelebration: 7 });
      expect(s.dragon).not.toBe(first); // a new dragon is lost for the next guest
    }
  }

  // every hoop on screen 1.5s+ before it reaches the gate, and both guests get the same flight
  const warn = hoops.map((rings) => rings.map((r) => +(r.gate - r.seen).toFixed(2)));
  console.log('hoop warning (s):', JSON.stringify(warn));
  expect(hoops[0].length).toBe(8);
  expect(hoops[1].length).toBe(hoops[0].length);
  for (const rings of hoops) for (const r of rings) expect(r.gate - r.seen).toBeGreaterThanOrEqual(1.5);
  expect(errors).toEqual([]);

  // the ribbons have to survive a refresh
  await reload(page);
  expect((await state(page)).count).toBe(2);
});

test('a guest who never finds the dragon is helped and still finishes within 56s', async ({ page }) => {
  await boot(page);
  await startRun(page);
  await findDragon(page, { neverFind: true });
  await waitScene(page, 'flight');
  await fly(page);
  await watch(page, 'attract');
  const s = await state(page);
  console.log(`assisted run (game clock): ${s.runs[0]}s`);
  expect(s.runs[0]).toBeLessThanOrEqual(ASSISTED_MAX);
});

test('holding the lantern skips the end card', async ({ page }) => {
  await boot(page, '&scene=end');
  await hover(page, 446, 244, 1.4);
  await waitScene(page, 'attract', 3000);
  expect((await state(page)).scene).toBe('attract');
});
