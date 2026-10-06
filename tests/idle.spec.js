import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// walking away mid-game sends it back to attract after INPUT.IDLE_RESET (10s). stepped by hand on
// the game clock: waiting it out in real time took 20s a test and got flaky on a busy laptop
const walkAway = (page, scene) => page.evaluate((scene) => {
  const w = window.__emberwing;
  const g = w.game;
  w.pause(true);
  w.goto(scene);
  g.input.feed(240, 135, 'mouse'); // the guest's last move
  w.step(0.05);
  const t0 = g.time;
  while (g.scenes.name === scene && !g.scenes.pending && g.time - t0 < 20) w.step(0.1, 60, false);
  return { idle: g.time - t0, next: g.scenes.pending?.name ?? g.scenes.name, count: g.store.count };
}, scene);

for (const scene of ['find', 'flight']) {
  test(`idle during ${scene} resets to attract after ~10s`, async ({ page }) => {
    await boot(page);
    const before = await page.evaluate(() => window.__emberwing.game.store.count);
    const r = await walkAway(page, scene);
    console.log(`idle reset after ${r.idle.toFixed(1)}s`);
    expect(r.next).toBe('attract');
    expect(r.idle).toBeGreaterThan(9.5);
    expect(r.idle).toBeLessThan(12);
    expect(r.count).toBe(before); // nobody made it home
  });
}
