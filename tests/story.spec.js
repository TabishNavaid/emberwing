import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// phase 2 story/clarity bits, checked through the scene state

test('home shows the act II line before the end card', async ({ page }) => {
  await boot(page, '&scene=home');
  await page.evaluate(() => window.__emberwing.pause(true));
  const at = (t) => page.evaluate((t) => { window.__emberwing.step(t); return window.__emberwing.game.scenes.current.showingAct; }, t);
  expect(await at(2)).toBe(false);
  expect(await at(2.5)).toBe(true); // 4.5s in
});
