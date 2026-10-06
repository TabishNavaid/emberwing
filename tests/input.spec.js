// input: the mocap pointer, the touch offset, and the rotate hint on portrait phones
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

test('portrait phones see the rotate hint', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await boot(page);
  await expect(page.locator('#rotate')).toBeVisible();
  await page.screenshot({ path: 'tests/screens/portrait-phone.png' });
  await ctx.close();
});

test('touch: the light sits above the fingertip, mouse stays exact', async ({ page }) => {
  await boot(page);
  const at = (type) => page.evaluate((type) => {
    const w = window.__emberwing;
    const s = w.toScreen(240, 150);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: s.x, clientY: s.y, pointerType: type, bubbles: true }));
    const i = w.game.input;
    return { x: i.rawX, y: i.rawY, source: i.source };
  }, type);
  const touch = await at('touch');
  expect(touch.source).toBe('touch');
  expect(Math.abs(touch.x - 240)).toBeLessThan(1);
  expect(touch.y).toBeLessThan(150 - 20);
  const mouse = await at('mouse');
  expect(mouse.source).toBe('mouse');
  expect(Math.abs(mouse.y - 150)).toBeLessThan(1);
});
