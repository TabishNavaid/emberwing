import { test, expect } from '@playwright/test';
import { boot, state, startRun, findEmber, fly, watch, waitScene } from './helpers.js';

// a slow lobby laptop shouldn't make runs longer, the game clock has to keep up with real time

// replaces requestAnimationFrame with one we drive by hand: __tick(ms) = one frame, ms after the last
const manualFrames = () => {
  let now = null;
  const queue = [];
  window.requestAnimationFrame = (cb) => queue.push(cb);
  window.__tick = (ms) => {
    if (now === null) now = performance.now();
    now += ms;
    queue.splice(0).forEach((cb) => cb(now));
  };
};

test('8 fps: the game clock still keeps up with real time', async ({ page }) => {
  await page.addInitScript(manualFrames);
  await boot(page);
  const gained = await page.evaluate(() => {
    window.__tick(16);
    const t0 = window.__emberwing.game.time;
    for (let i = 0; i < 40; i++) window.__tick(125); // 5 real seconds at 8 fps
    return window.__emberwing.game.time - t0;
  });
  expect(gained).toBeGreaterThan(4.9);
  expect(gained).toBeLessThan(5.1);
});

test('frozen tab: a 5s gap only nudges the game forward', async ({ page }) => {
  await page.addInitScript(manualFrames);
  await boot(page);
  const gained = await page.evaluate(() => {
    window.__tick(16);
    const t0 = window.__emberwing.game.time;
    window.__tick(5000);
    return window.__emberwing.game.time - t0;
  });
  expect(gained).toBeGreaterThan(0);
  expect(gained).toBeLessThan(0.3);
});

// the same scripted guest at full speed and at ~8 fps. the throttled run has to land within 2s
test.describe.serial('full run at a low frame rate', () => {
  let normal = null;

  const timedRun = async (page) => {
    await boot(page);
    await startRun(page);
    const t0 = Date.now();
    await findEmber(page);
    await waitScene(page, 'flight', 60_000);
    await fly(page);
    await waitScene(page, 'home', 60_000);
    await watch(page, 'attract');
    return (Date.now() - t0) / 1000;
  };

  test('normal frame rate', async ({ page }) => {
    normal = await timedRun(page);
    console.log(`normal run (wall, find to attract): ${normal.toFixed(1)}s`);
  });

  test('~8 fps', async ({ page }) => {
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 125);
    });
    const slow = await timedRun(page);
    const ref = normal ?? 37.2; // if this test runs on its own
    console.log(`8 fps run (wall, find to attract): ${slow.toFixed(1)}s vs normal ${ref.toFixed(1)}s`);
    expect(Math.abs(slow - ref)).toBeLessThan(2);
  });
});
