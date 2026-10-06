// the story beats show up when they should: the act II line, one instruction at a time, the
// brass swell, YOURS!, and the title cards between scenes
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

test('home shows the act II line before the end card', async ({ page }) => {
  await boot(page, '&scene=home');
  await page.evaluate(() => window.__emberwing.pause(true));
  const at = (t) => page.evaluate((t) => { window.__emberwing.step(t); return window.__emberwing.game.scenes.current.showingAct; }, t);
  expect(await at(2)).toBe(false);
  expect(await at(2.5)).toBe(true); // 4.5s in
});

test('find teaches one thing at a time, and the ring never resets', async ({ page }) => {
  await boot(page, '&scene=find');
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const f = () => w.game.scenes.current;
    const inp = w.game.input;
    w.pause(true);
    w.goto('find'); // restart after pausing, so no real-time frames sneak in before we measure
    const log = [f().prompt]; // the first instruction is up from frame zero
    const step = (secs, aim) => {
      for (let i = 0; i < secs * 20; i++) {
        const e = f().eyes();
        if (aim) inp.feed(e.x, e.y, 'mouse');
        else inp.feed(60 + (i % 40) * 3, 60, 'mouse'); // sweeping around up top, nowhere near the dragon
        w.step(0.05);
        log.push(f().prompt);
      }
    };
    step(1.0, false);
    const first = f().prompt;
    step(1.5, false); // moved plenty, 2.5s in
    const second = f().prompt;
    step(2.5, true); // light on the eyes
    const third = f().prompt;
    const holdOn = f().hold;
    step(1.0, false); // slips off
    const holdOff = f().hold;
    // how long each instruction stayed up
    const runs = [];
    for (const p of log) {
      if (runs.length && runs[runs.length - 1].p === p) runs[runs.length - 1].n++;
      else runs.push({ p, n: 1 });
    }
    return { first, second, third, holdOn, holdOff, runs: runs.map((x) => [x.p, x.n * 0.05]) };
  });
  expect(r.first).toBe('MOVE YOUR LIGHT');
  expect(r.second).toBe('FIND THE EYES');
  expect(r.third).toBe('HOLD STILL');
  expect(r.holdOn).toBeGreaterThan(0.1);
  expect(r.holdOff).toBe(r.holdOn); // pauses, never goes back down
  for (const [, secs] of r.runs.slice(0, -1)) expect(secs).toBeGreaterThanOrEqual(1.99);
});

test('brass swell: wind-up, then it fires on time and the flock joins', async ({ page }) => {
  await boot(page);
  // the flock is whoever is already home tonight, so put three dragons home first
  await page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    w.game.store.clear();
    for (let i = 0; i < 3; i++) w.game.store.add([[0, 0.5], [1, 0.4]], i);
    w.goto('flight');
  });
  // keep the light moving or the 10s idle reset sends us back to attract
  const at = (t) => page.evaluate((t) => {
    const w = window.__emberwing;
    for (let i = 0; i < t * 10; i++) {
      w.game.input.feed(200 + Math.sin(w.game.time) * 60, 135, 'mouse');
      w.step(0.1);
    }
    const f = w.game.scenes.current;
    return { windup: f.windup, fired: f.swellFired, flock: f.flock.length, flockX: Math.min(...f.flock.map((m) => m.x)) };
  }, t);
  // step until the wind-up starts (the swell timeline only begins after the tutorial hoop)
  let before = await at(0.5);
  for (let i = 0; i < 60 && !(before.windup > 0); i++) before = await at(0.5);
  expect(before.windup).toBeGreaterThan(0);
  expect(before.fired).toBe(false);
  const after = await at(1.6);
  expect(after.fired).toBe(true);
  expect(after.flock).toBe(3);
  expect(after.flockX).toBeGreaterThan(0);
});

test('after a finished run attract points "YOURS!" at the newest ribbon for ~15s, never after an idle reset', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    w.game.store.add([[0, 0.4], [0.5, 0.7], [1, 0.3]], 0);
    w.goto('attract', { reason: 'idle' });
    const idle = w.game.scenes.current.yoursT;
    w.goto('attract', { reason: 'done' });
    const a = w.game.scenes.current;
    const at = a.yoursAt;
    const start = a.yoursT;
    w.step(16);
    return { idle, start, at, after: a.yoursT };
  });
  expect(r.idle).toBe(0);
  expect(r.start).toBeGreaterThan(14);
  expect(r.at.x).toBeGreaterThan(0);
  expect(r.at.x).toBeLessThan(480);
  expect(r.after).toBe(0);
});

test('title cards between scenes, and the next scene waits underneath them', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    w.pause(true);
    w.game.scenes.go('flight', {}, { title: 'NOW FLY HOME!' });
    w.step(0.6); // fade out, then the card
    const during = { title: w.state().title, flightT: w.game.scenes.current.t };
    w.step(1.5);
    return { during, after: { title: w.state().title, flightT: w.game.scenes.current.t } };
  });
  expect(r.during.title).toBe('NOW FLY HOME!');
  expect(r.during.flightT).toBe(0); // the flight hasn't started yet
  expect(r.after.title).toBe(null);
  expect(r.after.flightT).toBeGreaterThan(0);
});
