import { test, expect } from '@playwright/test';
import { boot, state, startRun, findDragon, fly, watch, waitScene } from '../tests/helpers.js';

// does the deployed build load from its subpath, and can a guest actually play it?

test('live site loads: no errors, every file found, sprites under the right base path', async ({ page, baseURL }) => {
  const errors = [];
  const bad = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  const sprites = [];
  page.on('response', (r) => r.url().includes('/sprites/') && sprites.push(r.url()));
  await boot(page);
  expect(errors).toEqual([]);
  expect(bad).toEqual([]);
  expect(sprites.length).toBe(4);
  for (const s of sprites) expect(s.startsWith(new URL('sprites/', baseURL).href)).toBe(true);
});

test('live site plays: a scripted guest goes all the way home and back', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await boot(page);
  await startRun(page);
  expect((await state(page)).scene).toBe('find');
  await findDragon(page);
  await waitScene(page, 'flight', 60_000);
  await fly(page);
  await waitScene(page, 'home', 60_000);
  await watch(page, 'attract');
  const s = await state(page);
  console.log(`live run (game clock): ${s.runs[0]}s, dragons: ${s.count}`);
  expect(s.count).toBe(1);
  expect(s.runs[0]).toBeGreaterThan(35);
  expect(s.runs[0]).toBeLessThan(45);
});
