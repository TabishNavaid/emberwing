import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test('motion-capture pointer (normalized 0..1) drives the same cursor', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.emberwingPointer(0.25, 0.5));
  await page.waitForTimeout(600);
  const p = await page.evaluate(() => {
    const i = window.__emberwing.game.input;
    return { x: i.x, y: i.y, source: i.source };
  });
  expect(p.source).toBe('mocap');
  expect(Math.abs(p.x - 120)).toBeLessThan(4);
  expect(Math.abs(p.y - 135)).toBeLessThan(4);

  await page.evaluate(() => window.postMessage({ type: 'emberwing-pointer', x: 0.75, y: 0.25 }, '*'));
  await page.waitForTimeout(900);
  const q = await page.evaluate(() => window.__emberwing.game.input.x);
  expect(Math.abs(q - 360)).toBeLessThan(6);
});

test('operator C asks before clearing the night sky', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__emberwing.game.store.add([[0, 0.5], [1, 0.5]], 0));
  await page.keyboard.press('c');
  expect(await page.evaluate(() => window.__emberwing.game.op.confirm > 0)).toBe(true);
  await page.keyboard.press('n');
  expect(await page.evaluate(() => window.__emberwing.game.store.count)).toBe(1);
  await page.keyboard.press('c');
  await page.keyboard.press('y');
  expect(await page.evaluate(() => window.__emberwing.game.store.count)).toBe(0);
});

test('portrait phones see the rotate hint', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await boot(page);
  await expect(page.locator('#rotate')).toBeVisible();
  await page.screenshot({ path: 'tests/screens/portrait-phone.png' });
  await ctx.close();
});
