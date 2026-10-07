// phones held sideways: whole runs with a finger only, tap to pick, the notch and home bar, and
// whether the hoops are a fair size on a small screen
import { test, expect } from '@playwright/test';

const IPHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const ANDROID = { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const LIFT = 26; // INPUT.TOUCH_LIFT: the light sits this far above the finger

const open = async (browser, device = IPHONE) => {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  await page.goto('./?seed=5');
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { polling: 50 });
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
};
const state = (page) => page.evaluate(() => window.__emberwing.state());
const screenAt = (page, x, y) => page.evaluate(([x, y]) => window.__emberwing.toScreen(x, y), [x, y]);

// a real touch: down, move, up. the browser turns these into touch pointer events like a phone
const finger = (cdp, type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y }] });
const tapAt = async (page, cdp, x, y) => {
  const p = await screenAt(page, x, y);
  await finger(cdp, 'touchStart', p);
  await finger(cdp, 'touchEnd', p);
};
// keeps the finger down so the light (just above it) sits on the target, until the scene changes
const steer = async (page, cdp, scene, wobble = 0) => {
  let p = await screenAt(page, 240, 200);
  await finger(cdp, 'touchStart', p);
  for (let i = 0; (await state(page)).scene === scene && i < 3000; i++) {
    const s = await state(page);
    if (s.target) p = await screenAt(page, s.target.x + Math.sin(i) * wobble, s.target.y + LIFT);
    await finger(cdp, 'touchMove', p);
    await page.waitForTimeout(50);
  }
  await finger(cdp, 'touchEnd', p);
};
const waitScene = (page, name) => page.waitForFunction((n) => { const s = window.__emberwing.state(); return s.scene === n && !s.title; }, name, { timeout: 60_000, polling: 100 });

test.describe.serial('whole runs on a phone with a finger', () => {
  for (const level of ['hatchling', 'flier', 'storm']) {
    test(`${level}: tap the level, tap a dragon, find it and fly home by finger`, async ({ browser }) => {
      const { ctx, page, cdp } = await open(browser);
      expect((await state(page)).gate).toBe(false); // phones never get the press any key screen
      const at = await page.evaluate((id) => window.__emberwing.game.scenes.current.levelTarget(id), level);
      await tapAt(page, cdp, at.x, at.y);
      await waitScene(page, 'choose');
      expect((await state(page)).level).toBe(level);
      const pick = await page.evaluate(() => window.__emberwing.game.scenes.current.optionTarget(0));
      await tapAt(page, cdp, pick.x, pick.y);
      await waitScene(page, 'find');
      await steer(page, cdp, 'find', 1);
      await waitScene(page, 'flight');
      await steer(page, cdp, 'flight');
      await waitScene(page, 'home');
      const hoops = await page.evaluate(() => {
        const f = window.__emberwing.game.scenes.scenes.flight;
        return { hit: f.points.hits, of: f.L.hoops, score: f.points.score };
      });
      await page.waitForFunction(() => window.__emberwing.state().scene === 'attract', null, { timeout: 60_000, polling: 100 });
      const s = await state(page);
      console.log(`phone ${level}: ${s.runs[0]}s, hoops ${hoops.hit}/${hoops.of}, score ${hoops.score}, sound ${s.sound}`);
      expect(s.count).toBe(1);
      expect(s.sound).toBe('on'); // the first tap turned it on
      expect(hoops.hit).toBeGreaterThan(hoops.of / 2);
      await ctx.close();
    });
  }
});

test('tap to pick: a level, a dragon, and NEXT on the card all go on the first tap, a mouse still has to hold', async ({ browser }) => {
  const { ctx, page, cdp } = await open(browser);
  const r = await page.evaluate(() => {
    window.__emberwing.pause(true);
    return window.__emberwing.game.scenes.current.levelTarget('storm');
  });
  await tapAt(page, cdp, r.x, r.y);
  const afterTap = await page.evaluate(() => { const w = window.__emberwing; w.step(0.05); return { next: w.game.scenes.pending?.name ?? w.game.scenes.name, level: w.game.level }; });
  expect(afterTap).toEqual({ next: 'choose', level: 'storm' });
  // jump straight to each screen (paused, so the fade from the tap above never finishes)
  const jump = (name) => page.evaluate((n) => { const w = window.__emberwing; w.game.scenes.pending = null; w.goto(n); }, name);
  await jump('choose');
  const pick = await page.evaluate(() => { const w = window.__emberwing; return { at: w.game.scenes.current.optionTarget(2), name: w.game.scenes.current.options[2].d.name }; });
  await tapAt(page, cdp, pick.at.x, pick.at.y);
  expect(await page.evaluate(() => { const w = window.__emberwing; w.step(0.05); return w.game.scenes.current.picked?.d.name; })).toBe(pick.name);
  await jump('end');
  await tapAt(page, cdp, 446, 244);
  expect(await page.evaluate(() => { const w = window.__emberwing; w.step(0.05); return w.game.scenes.pending?.name; })).toBe('attract');
  // a mouse click on a level does nothing by itself, the mocap prop and the mouse hold to pick
  await jump('attract');
  const at = await page.evaluate(() => window.__emberwing.game.scenes.current.levelTarget('flier'));
  const p = await screenAt(page, at.x, at.y);
  await page.mouse.click(p.x, p.y);
  const mouse = await page.evaluate(() => { const w = window.__emberwing; w.step(0.1); return w.game.scenes.pending?.name ?? w.game.scenes.name; });
  expect(mouse).toBe('attract');
  await ctx.close();
});

test('the notch and the home bar: the game and its buttons stay inside the safe area', async ({ browser }) => {
  const { ctx, page } = await open(browser);
  const r = await page.evaluate(() => {
    // an iphone held sideways: the notch on the left, the home bar along the bottom
    const root = document.documentElement.style;
    root.setProperty('--safe-left', '47px');
    root.setProperty('--safe-right', '47px');
    root.setProperty('--safe-bottom', '21px');
    window.dispatchEvent(new Event('resize'));
    const b = document.getElementById('screen').getBoundingClientRect();
    const speaker = window.__emberwing.toScreen(17, 256);
    return { left: b.left, right: b.right, bottom: b.bottom, top: b.top, w: innerWidth, h: innerHeight, speaker, scroll: document.scrollingElement.scrollHeight <= innerHeight };
  });
  expect(r.left).toBeGreaterThanOrEqual(47);
  expect(r.right).toBeLessThanOrEqual(r.w - 47);
  expect(r.bottom).toBeLessThanOrEqual(r.h - 21);
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.speaker.x).toBeGreaterThan(47);
  expect(r.speaker.y).toBeLessThan(r.h - 21);
  expect(r.scroll).toBe(true); // nothing to scroll
  await ctx.close();
});

test('touch targets are at least 44 css px and the hoops a fair size on a small android', async ({ browser }) => {
  const out = {};
  for (const [name, device] of [['iphone', IPHONE], ['android', ANDROID]]) {
    const { ctx, page } = await open(browser, device);
    out[name] = await page.evaluate(() => {
      const w = window.__emberwing;
      const g = w.game;
      w.pause(true);
      const css = (w.toScreen(100, 0).x - w.toScreen(0, 0).x) / 100; // css px per game px
      // fly each level by hand and measure every hoop as it reaches the dragon: how tall it looks
      // and how tall the band that counts as a hit is (the hoop plus its slack), both on screen
      const hoops = {};
      for (const id of ['hatchling', 'flier', 'storm']) {
        g.level = id;
        w.goto('flight');
        const f = g.scenes.current;
        let drawn = Infinity;
        let band = Infinity;
        const resolve = f.resolveRing.bind(f);
        f.resolveRing = (g, ring, rx, hit) => {
          const r = f.ringR(ring);
          drawn = Math.min(drawn, 2 * r * f.zoom * css);
          band = Math.min(band, 2 * (r + f.L.slack) * f.zoom * css);
          resolve(g, ring, rx, hit);
        };
        for (let i = 0; i < 60 * 120 && g.scenes.name === 'flight'; i++) {
          const s = w.state();
          if (s.target) g.input.feed(s.target.x, s.target.y, 'touch');
          w.step(1 / 60, 60, false);
        }
        hoops[id] = { drawn: Math.round(drawn), band: Math.round(band) };
      }
      const row = { w: 479 - 236, h: 58 }; // a level row on the start screen
      return {
        hoops,
        row: Math.round(Math.min(row.w, row.h) * css),
        speaker: Math.round((24 + 2 * 9) * css), // its height plus the finger padding each side
        next: Math.round((18 + 14) * 2 * css), // NEXT on the dragon card
      };
    });
    await ctx.close();
  }
  console.log('touch sizes, css px:', JSON.stringify(out));
  for (const d of Object.values(out)) {
    expect(d.row).toBeGreaterThanOrEqual(44);
    expect(d.speaker).toBeGreaterThanOrEqual(44);
    expect(d.next).toBeGreaterThanOrEqual(44);
    expect(d.hoops.hatchling.band).toBeGreaterThanOrEqual(44); // a little kid's finger
    expect(d.hoops.flier.band).toBeGreaterThanOrEqual(36);
    expect(d.hoops.storm.band).toBeGreaterThanOrEqual(30); // small on purpose, it's the hard level
  }
});
