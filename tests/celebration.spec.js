import { test, expect } from '@playwright/test';
import { boot, reload } from './helpers.js';

// every 8th dragon: a real celebration, and a star that stays in the sky all night

test('the 8th dragon home: every saved dragon in the spiral, the names from this round, about 7-8s, then the card', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    for (let i = 0; i < 15; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
    w.goto('home'); // the 16th
    w.step(5.2);
    const scene = g.scenes.name;
    const c = g.scenes.current;
    const seen = c.visibleDragons();
    const saved = g.store.dragons.map((d) => d.name);
    let t = 0;
    while (g.scenes.name === 'celebration' && t < 12) {
      w.step(0.1);
      t += 0.1;
    }
    return { scene, seen, saved, count: g.store.count, length: +t.toFixed(1), after: g.scenes.name, nth: c.nth };
  });
  expect(r.scene).toBe('celebration');
  expect(r.seen.near + r.seen.far).toBe(r.count); // every dragon saved tonight is in it
  expect(r.seen.names).toEqual(r.saved.slice(-8)); // this round's eight roll past
  expect(r.length).toBeGreaterThanOrEqual(6.8);
  expect(r.length).toBeLessThanOrEqual(8.5);
  expect(r.after).toBe('end');
  expect(r.nth).toBe(2);
});

test('each celebration leaves a star in the sky for the night, it survives a refresh, C clears it', async ({ page }) => {
  await boot(page);
  const stars = () => page.evaluate(() => Math.floor(window.__emberwing.game.store.count / 8));
  await page.evaluate(() => {
    const g = window.__emberwing.game;
    g.store.clear();
    for (let i = 0; i < 17; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
  });
  expect(await stars()).toBe(2);
  await reload(page);
  expect(await stars()).toBe(2);
  await page.keyboard.press('c');
  await page.keyboard.press('y');
  expect(await stars()).toBe(0);
});

test('reduced motion: the celebration still plays, calmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    for (let i = 0; i < 7; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
    w.goto('home');
    w.step(5.2);
    const c = g.scenes.current;
    w.step(3);
    return { scene: g.scenes.name, gentle: c.gentle, booms: c.booms, shake: g.cam.shakeAmt };
  });
  expect(r.scene).toBe('celebration');
  expect(r.gentle).toBe(true);
  expect(r.booms).toBeLessThanOrEqual(4); // fewer fireworks
  expect(r.shake).toBe(0);
});
