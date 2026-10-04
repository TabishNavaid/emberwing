import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// several guests in a row on the same page, the way the lobby actually runs it

test('every flight hands off to home, not just the first one on the page', async ({ page }) => {
  await boot(page);
  const homes = await page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    const out = [];
    for (let run = 0; run < 3; run++) {
      w.goto('flight');
      let t = 0;
      while (w.game.scenes.name !== 'home' && t < 40) {
        w.game.input.feed(200 + Math.sin(t) * 80, 135 + Math.cos(t * 1.3) * 60, 'mouse');
        w.step(0.1);
        t += 0.1;
      }
      out.push({ reachedHome: w.game.scenes.name === 'home', after: +t.toFixed(1) });
    }
    return out;
  });
  for (const h of homes) expect(h.reachedHome).toBe(true);
});
