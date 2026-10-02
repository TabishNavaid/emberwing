import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// a pretend rig that's off: shifted, squashed and a bit keystoned. aim() returns what it would
// report (0..1) when someone points at view pixel (x, y)
const RIG = `(x, y) => {
  const w = 1 + 0.0004 * y;
  return [(0.78 * x + 40) / w / 480, (0.85 * y + 18 - 0.03 * x) / w / 270];
}`;

test('K calibration: 4 corners fix a misaligned rig, survive a refresh, Delete clears', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__emberwing.pause(true));
  await page.keyboard.press('k');
  const result = await page.evaluate((rigSrc) => {
    const rig = eval(rigSrc);
    const w = window.__emberwing;
    const targets = [[30, 30], [450, 30], [450, 240], [30, 240]];
    for (const [x, y] of targets) {
      const [nx, ny] = rig(x, y);
      // aim at the corner and hold still for 1.5s
      for (let i = 0; i < 30; i++) { window.emberwingPointer(nx, ny); w.step(0.05); }
    }
    // now point at the middle of the screen
    const [cx, cy] = rig(240, 135);
    window.emberwingPointer(cx, cy);
    const i = w.game.input;
    return { calibrating: !!w.game.op.cal, label: w.game.cal.label(), x: i.rawX, y: i.rawY };
  }, RIG);
  expect(result.calibrating).toBe(false);
  expect(result.label).toContain('MOCAP');
  expect(Math.abs(result.x - 240)).toBeLessThan(1.5);
  expect(Math.abs(result.y - 135)).toBeLessThan(1.5);

  // a desk mouse isn't affected by the mocap calibration
  const mouse = await page.evaluate(() => { window.__emberwing.game.input.feed(100, 100, 'mouse'); return window.__emberwing.game.input.rawX; });
  expect(mouse).toBe(100);

  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { polling: 50 });
  expect(await page.evaluate(() => window.__emberwing.game.cal.label())).toContain('MOCAP');

  await page.keyboard.press('k');
  await page.keyboard.press('Delete');
  expect(await page.evaluate(() => window.__emberwing.game.cal.label())).toBe('OFF');
  await page.reload();
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { polling: 50 });
  expect(await page.evaluate(() => window.__emberwing.game.cal.label())).toBe('OFF');
});

test('calibration can be cancelled and the game is paused while it runs', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__emberwing.pause(true));
  await page.keyboard.press('k');
  const t = await page.evaluate(() => {
    const w = window.__emberwing;
    const t0 = w.game.scenes.current.t;
    w.step(1);
    return w.game.scenes.current.t - t0;
  });
  expect(t).toBe(0);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => !!window.__emberwing.game.op.cal)).toBe(false);
  expect(await page.evaluate(() => window.__emberwing.game.cal.label())).toBe('OFF');
});
