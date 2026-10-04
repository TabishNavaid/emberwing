import { test, expect } from '@playwright/test';
import { boot, startRun, findDragon, fly, watch, waitScene } from './helpers.js';

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

// the bug report: on a fresh page load the first flight only had one hoop. every guest has to
// get the same flight, and every hoop has to be on screen long enough to actually aim for it

const flightReport = (page) => page.evaluate(() => {
  const f = window.__emberwing.game.scenes.scenes.flight;
  return f.rings.map((r) => ({ seen: r.seenAt, gate: r.gateAt, state: r.state }));
});

test('cold first run and a second run both give every hoop a real chance', async ({ page }) => {
  await boot(page); // fresh page, nothing cached
  const runs = [];
  for (let run = 0; run < 2; run++) {
    await startRun(page);
    await findDragon(page);
    await waitScene(page, 'flight', 60_000);
    await fly(page);
    await waitScene(page, 'home', 60_000);
    const rings = await flightReport(page);
    const chances = rings.filter((r) => r.gate !== undefined && r.seen !== undefined && r.gate - r.seen >= 1.5).length;
    runs.push({ total: rings.length, chances, warn: rings.map((r) => +(r.gate - r.seen).toFixed(2)) });
    await watch(page, 'attract');
  }
  console.log('hoops per run:', JSON.stringify(runs));
  expect(runs[0].total).toBeGreaterThan(1);
  expect(runs[0].chances).toBe(runs[0].total); // every hoop seen 1.5s+ before it arrives
  expect(runs[1].total).toBe(runs[0].total);
  expect(runs[1].chances).toBe(runs[1].total);
});
