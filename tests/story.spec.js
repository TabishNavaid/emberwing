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

test('find ember opens with the story beat, then the instruction', async ({ page }) => {
  await boot(page, '&scene=find');
  await page.evaluate(() => { const w = window.__emberwing; w.pause(true); w.game.input.feed(40, 40, 'mouse'); });
  const at = (t) => page.evaluate((t) => { window.__emberwing.step(t); return window.__emberwing.game.scenes.current.prompt; }, t);
  expect(await at(0.5)).toBe('EMBER IS LOST!');
  expect(await at(1.5)).toBe('FIND THE EYES');
});
