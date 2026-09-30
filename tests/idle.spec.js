import { test, expect } from '@playwright/test';
import { boot, state, startRun, findEmber, waitScene, moveTo } from './helpers.js';

test('idle during Find Ember resets to attract after ~10s', async ({ page }) => {
  await boot(page);
  await startRun(page);
  await moveTo(page, 60, 60, 3); // then the guest walks away
  const t0 = Date.now();
  await waitScene(page, 'attract', 20_000);
  const idle = (Date.now() - t0) / 1000;
  console.log(`idle reset after ${idle.toFixed(1)}s`);
  expect(idle).toBeGreaterThan(9.5);
  expect(idle).toBeLessThan(12);
  expect((await state(page)).count).toBe(0);
});

test('idle during Flight resets to attract after ~10s', async ({ page }) => {
  await boot(page);
  await startRun(page);
  await findEmber(page, { searchSeconds: 0.5 });
  await waitScene(page, 'flight');
  await moveTo(page, 240, 130, 3);
  const t0 = Date.now();
  await waitScene(page, 'attract', 20_000);
  const idle = (Date.now() - t0) / 1000;
  console.log(`idle reset after ${idle.toFixed(1)}s`);
  expect(idle).toBeGreaterThan(9.5);
  expect(idle).toBeLessThan(12);
});
