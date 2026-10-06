// the speaker in the corner is a real control: click, tap, or hold the light on it
import { test, expect } from '@playwright/test';
import { boot, state, toScreen } from './helpers.js';

const BTN = { x: 17, y: 256 };
const soundIs = (page, v) => page.waitForFunction((v) => window.__emberwing.state().sound === v, v, { polling: 50, timeout: 3000 });

test('clicking the speaker turns the sound off and on', async ({ page }) => {
  await boot(page);
  await soundIs(page, 'on');
  const p = await toScreen(page, BTN.x, BTN.y);
  await page.mouse.click(p.x, p.y);
  await soundIs(page, 'muted');
  await page.mouse.click(p.x, p.y);
  await soundIs(page, 'on');
  // a click somewhere else does nothing to the sound
  const q = await toScreen(page, 240, 135);
  await page.mouse.click(q.x, q.y);
  expect((await state(page)).sound).toBe('on');
});

test('tapping the speaker on a phone: the first tap turns sound on, the next one mutes', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await boot(page);
  // headless chromium keeps audio locked until a gesture, like a real phone
  const p = await toScreen(page, BTN.x, BTN.y);
  await page.touchscreen.tap(p.x, p.y);
  await soundIs(page, 'on');
  await page.touchscreen.tap(p.x, p.y);
  await soundIs(page, 'muted');
  await page.touchscreen.tap(p.x, p.y);
  await soundIs(page, 'on');
  await ctx.close();
});

test('holding the light on the speaker toggles it (once per hold), but not while flying', async ({ page }) => {
  await boot(page);
  await soundIs(page, 'on');
  const r = await page.evaluate((b) => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const hold = (secs, x, y) => {
      for (let i = 0; i < secs * 20; i++) {
        g.input.feed(x + (i % 2) * 0.5, y, 'mouse');
        w.step(0.05);
      }
      return g.audio.status;
    };
    const out = {};
    hold(0.5, 240, 135); // light somewhere in the middle first
    out.brief = hold(0.8, b.x, b.y); // passing over it doesn't toggle
    out.held = hold(1.0, b.x, b.y); // 1.8s total on it: muted
    out.stillHeld = hold(2.0, b.x, b.y); // keep holding: stays muted, no flip-flopping
    hold(0.5, 240, 135); // move away
    out.again = hold(1.8, b.x, b.y); // hold again: back on
    // during the flight a guest's light can wander into the corner, that must not mute it
    w.goto('flight');
    out.flying = hold(3.0, b.x, b.y);
    return out;
  }, BTN);
  expect(r.brief).toBe('on');
  expect(r.held).toBe('muted');
  expect(r.stillHeld).toBe('muted');
  expect(r.again).toBe('on');
  expect(r.flying).toBe('on');
});
