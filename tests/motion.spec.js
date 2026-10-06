// reduced motion: follows the OS setting, G cycles it, and the flight camera calms down
import { test, expect } from '@playwright/test';
import { boot, reload } from './helpers.js';

const motion = (page) => page.evaluate(() => {
  const g = window.__emberwing.game;
  g.cam.reset();
  g.cam.shake(3);
  return { reduced: g.motion.reduced, force: g.motion.force, shake: g.cam.shakeAmt };
});

test('follows the OS reduce-motion setting: no shake', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  const m = await motion(page);
  expect(m.reduced).toBe(true);
  expect(m.shake).toBe(0);
});

test('G cycles auto / forced on / forced off and survives a refresh', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page);
  expect((await motion(page)).shake).toBeGreaterThan(0); // normal: shake works
  await page.keyboard.press('g');
  let m = await motion(page);
  expect(m.force).toBe('on');
  expect(m.reduced).toBe(true);
  expect(m.shake).toBe(0);
  await reload(page);
  expect((await motion(page)).force).toBe('on');
  await page.keyboard.press('g');
  m = await motion(page);
  expect(m.force).toBe('off');
  expect(m.reduced).toBe(false);
  await page.keyboard.press('g');
  expect((await motion(page)).force).toBe('auto');
});

test('reduced motion makes the flight camera calmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, '&scene=flight');
  const z = await page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    for (let i = 0; i < 20; i++) { w.game.input.feed(200 + i, 135, 'mouse'); w.step(0.05); }
    const f = w.game.scenes.current;
    return { zoom: f.zoom, camY: f.camY };
  });
  expect(z.zoom).toBeLessThan(1.1); // full motion starts at 1.18
  expect(z.camY).toBe(0);
});
