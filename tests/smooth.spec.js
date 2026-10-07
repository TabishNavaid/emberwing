// the two busiest moments, the brass swell on the rainbow route and the celebration, with the CPU
// slowed down 6x like a weak laptop. no frame may take longer than 100ms and the dragon has to be drawn
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

const SLOW = 6;
const MAX_FRAME = 100;

// real frames (the game's own loop), a guest steering at the hoops, until the moment is over
const realFrames = (page, until) => page.evaluate((until) => new Promise((resolve) => {
  const w = window.__emberwing;
  const g = w.game;
  const scene = g.scenes.current;
  const frames = [];
  let last = null;
  const stop = until === 'swell' ? () => scene.swellFired && scene.swellT > 3 : () => g.scenes.name === 'end';
  const tick = (now) => {
    const s = w.state();
    if (s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
    const c = g.scenes.current;
    if (last !== null) frames.push({ gap: now - last, scene: g.scenes.name, t: c.t, drawn: c.drawn ? { ...c.drawn } : null, dragons: c.dragons?.length, low: s.lowDetail });
    last = now;
    if (stop() || frames.length > 1200) return resolve({ frames });
    requestAnimationFrame(tick);
  };
  w.pause(false);
  requestAnimationFrame(tick);
}), until);

const slowDown = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
};

test('6x slower CPU: the brass swell on the rainbow route stays under 100ms a frame, dragon always drawn', async ({ page }) => {
  await boot(page);
  // fast-forward by hand (no drawing) to just before the swell, with 5 dragons home to fly in
  await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    for (let i = 0; i < 5; i++) g.store.add([[0, 0.5], [0.3, 0.4], [0.6, 0.6], [1, 0.4]], i);
    g.level = 'flier'; // moving hoops
    g.route = 1; // the squall, rainbow at the swell
    w.goto('flight');
    const f = g.scenes.current;
    for (let i = 0; i < 60 * 40 && f.tt < f.swellAt - 1.5; i++) {
      const s = w.state();
      if (s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
      w.step(1 / 60, 60, false);
    }
  });
  await slowDown(page);
  const { frames } = await realFrames(page, 'swell');
  const run = frames.slice(3); // the first gaps include the setup above
  const worst = Math.max(...run.map((f) => f.gap));
  console.log(`swell at ${SLOW}x: ${run.length} frames, worst ${worst.toFixed(0)}ms, low detail ${run.some((f) => f.low) ? 'on' : 'off'}`);
  console.log('  slowest:', [...run].sort((a, b) => b.gap - a.gap).slice(0, 5).map((f) => `${Math.round(f.gap)}ms at ${f.t.toFixed(2)}s`).join(', '));
  expect(run.length).toBeGreaterThan(20);
  expect(worst).toBeLessThan(MAX_FRAME);
  for (const f of run) {
    expect(f.drawn).not.toBeNull();
    expect(Math.abs(f.drawn.sy)).toBeGreaterThan(0.15); // never squashed flat (the barrel roll used to)
    expect(f.drawn.x).toBeGreaterThan(0);
    expect(f.drawn.x).toBeLessThan(480);
    expect(f.drawn.y).toBeGreaterThan(0);
    expect(f.drawn.y).toBeLessThan(270);
  }
  // the dragon's draw time moves forward every frame, so it isn't a stale value from earlier
  for (let i = 1; i < run.length; i++) expect(run[i].drawn.t).toBeGreaterThan(run[i - 1].drawn.t);
});

test('6x slower CPU: home and then a big celebration stay under 100ms a frame, every dragon drawn', async ({ page }) => {
  await boot(page);
  // 39 home already, this guest is the 40th: home, then the celebration, like a real night
  await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.store.clear();
    for (let i = 0; i < 39; i++) g.store.add([[0, 0.5], [0.3, 0.4], [0.6, 0.6], [1, 0.4]], i % 6);
    w.goto('home');
  });
  await slowDown(page);
  const { frames } = await realFrames(page, 'celebration');
  const run = frames.slice(3).filter((f) => f.scene === 'home' || f.scene === 'celebration');
  const worst = run.reduce((a, f) => (f.gap > a.gap ? f : a));
  console.log(`home + celebration at ${SLOW}x: ${run.length} frames, worst ${worst.gap.toFixed(0)}ms, low detail ${run.some((f) => f.low) ? 'on' : 'off'}`);
  console.log('  slowest:', [...run].sort((a, b) => b.gap - a.gap).slice(0, 5).map((f) => `${Math.round(f.gap)}ms ${f.scene} at ${f.t.toFixed(2)}s`).join(', '));
  expect(run.filter((f) => f.scene === 'celebration').length).toBeGreaterThan(20);
  expect(worst.gap).toBeLessThan(MAX_FRAME);
  for (const f of run) if (f.scene === 'celebration') expect(f.drawn.count).toBe(f.dragons);
});
