import { test, expect } from '@playwright/test';
import { boot, state, startRun, findDragon, waitScene, moveTo } from './helpers.js';

// measured on the game clock, not the wall clock. when the laptop is busy the page drops
// frames and the capped game clock falls behind real time, which made this test flaky
const gameTime = (page) => page.evaluate(() => window.__emberwing.game.time);

test('idle during Find resets to attract after ~10s', async ({ page }) => {
  await boot(page);
  await startRun(page);
  await moveTo(page, 60, 60, 3); // then the guest walks away
  const t0 = await gameTime(page);
  await waitScene(page, 'attract', 60_000);
  const idle = (await gameTime(page)) - t0;
  console.log(`idle reset after ${idle.toFixed(1)}s`);
  expect(idle).toBeGreaterThan(9.5);
  expect(idle).toBeLessThan(12);
  expect((await state(page)).count).toBe(0);
});

test('idle during Flight resets to attract after ~10s', async ({ page }) => {
  await boot(page);
  await startRun(page);
  await findDragon(page, { searchSeconds: 0.5 });
  await waitScene(page, 'flight');
  await moveTo(page, 240, 130, 3);
  const t0 = await gameTime(page);
  await waitScene(page, 'attract', 60_000);
  const idle = (await gameTime(page)) - t0;
  console.log(`idle reset after ${idle.toFixed(1)}s`);
  expect(idle).toBeGreaterThan(9.5);
  expect(idle).toBeLessThan(12);
});
