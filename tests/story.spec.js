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

test('brass swell: wind-up, then it fires on time and the flock joins', async ({ page }) => {
  await boot(page, '&scene=flight');
  await page.evaluate(() => window.__emberwing.pause(true));
  // keep the light moving or the 10s idle reset sends us back to attract
  const at = (t) => page.evaluate((t) => {
    const w = window.__emberwing;
    for (let i = 0; i < t * 10; i++) {
      w.game.input.feed(200 + Math.sin(w.game.time) * 60, 135, 'mouse');
      w.step(0.1);
    }
    const f = w.game.scenes.current;
    return { windup: f.windup, fired: f.swellFired, flockX: f.flock[0].x };
  }, t);
  const before = await at(12.1); // swell is at 0.62 * 20s = 12.4s
  expect(before.windup).toBeGreaterThan(0);
  expect(before.fired).toBe(false);
  const after = await at(1.6);
  expect(after.fired).toBe(true);
  expect(after.flockX).toBeGreaterThan(0);
});

test('after a finished run, attract points "YOURS!" at the newest ribbon for ~15s', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    w.game.store.add([[0, 0.4], [0.5, 0.7], [1, 0.3]], 0);
    w.goto('attract', { reason: 'done' });
    const a = w.game.scenes.current;
    const at = a.yoursAt;
    const start = a.yoursT;
    w.step(16);
    return { start, at, after: a.yoursT };
  });
  expect(r.start).toBeGreaterThan(14);
  expect(r.at.x).toBeGreaterThan(0);
  expect(r.at.x).toBeLessThan(480);
  expect(r.after).toBe(0);
});

test('no "YOURS!" after an idle reset', async ({ page }) => {
  await boot(page);
  const t = await page.evaluate(() => {
    const w = window.__emberwing;
    w.game.store.add([[0, 0.4], [1, 0.3]], 0);
    w.goto('attract', { reason: 'idle' });
    return w.game.scenes.current.yoursT;
  });
  expect(t).toBe(0);
});
