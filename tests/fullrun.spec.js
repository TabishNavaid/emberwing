import { test, expect } from '@playwright/test';
import { boot, state, startRun, findDragon, fly, watch, waitScene, hover, reload } from './helpers.js';

const MIN = 35;
const MAX = 50;
// worst case (guest never finds the dragon). runs got a bit longer on purpose (picking a level
// and a dragon), aiming for ~45s on hatchling, so the worst case on hatchling is now ~55s
const ASSISTED_MAX = 56;

test('a guest who finds the dragon plays a full run in 35-50s and returns to attract', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await boot(page);
  const wall0 = Date.now();
  await startRun(page);
  expect((await state(page)).scene).toBe('find');
  await findDragon(page);
  await waitScene(page, 'flight');
  await fly(page);
  await waitScene(page, 'home');
  await watch(page, 'end');
  await watch(page, 'attract');
  const wall = (Date.now() - wall0) / 1000;
  const s = await state(page);
  console.log(`run (game clock): ${s.runs[0]}s   wall clock: ${wall.toFixed(1)}s`);
  expect(s.runs.length).toBe(1);
  expect(s.runs[0]).toBeGreaterThanOrEqual(MIN);
  expect(s.runs[0]).toBeLessThanOrEqual(MAX);
  expect(s.count).toBe(1);
  expect(errors).toEqual([]);

  // ribbon has to survive a refresh
  await reload(page);
  expect((await state(page)).count).toBe(1);
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
