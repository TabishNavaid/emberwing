import { test, expect } from '@playwright/test';
import { boot, state, startRun, findDragon, fly, watch, waitScene, hover, reload } from './helpers.js';

// sound is on by default, but the game has to work exactly the same with it off

// pretend to be a browser that blocks audio until a real key press or touch (playwright's
// chromium allows autoplay, the lobby laptop's chrome won't)
const lockedAudio = () => {
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...a) {
      super(...a);
      this.allowed = false;
    }
    get state() {
      return this.allowed ? super.state : 'suspended';
    }
    resume() {
      if (navigator.userActivation?.isActive) {
        this.allowed = true;
        setTimeout(() => this.dispatchEvent(new Event('statechange')), 0);
      }
      return super.resume();
    }
  };
};

const soundIs = (page, v) => page.waitForFunction((v) => window.__emberwing.state().sound === v, v, { polling: 50, timeout: 3000 });

test('sound is on by default, M mutes it and that survives a refresh', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.removeItem('emberwing.sound.v1'));
  await boot(page);
  await soundIs(page, 'on');
  await page.keyboard.press('m');
  await soundIs(page, 'muted');
  await reload(page);
  expect((await state(page)).sound).toBe('muted');
  expect((await state(page)).gate).toBe(false); // muted on purpose, no need to wait for a key
  await page.keyboard.press('m');
  await soundIs(page, 'on');
});

test('a browser that blocks audio: the station waits for any key, and that key does nothing else', async ({ page }) => {
  await page.addInitScript(lockedAudio);
  await boot(page, '', { station: false });
  let s = await state(page);
  expect(s.gate).toBe(true);
  expect(s.sound).toBe('locked');
  // a guest can't start a run until the operator has started the station
  await hover(page, 372, 152, 1.8);
  expect((await state(page)).scene).toBe('attract');
  // S would normally start a run from attract. as the first key it only starts the station
  await page.keyboard.press('s');
  await soundIs(page, 'on');
  s = await state(page);
  expect(s.gate).toBe(false);
  expect(s.scene).toBe('attract');
  await startRun(page);
  expect((await state(page)).scene).toBe('find');
});

test('phones skip the gate, the first touch turns the sound on', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(lockedAudio);
  await boot(page, '', { station: false });
  let s = await state(page);
  expect(s.gate).toBe(false);
  expect(s.sound).toBe('locked');
  await page.touchscreen.tap(400, 200);
  await soundIs(page, 'on');
  await ctx.close();
});

test('a whole run with the sound muted works and looks exactly the same', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await boot(page);
  await page.keyboard.press('m');
  expect((await state(page)).sound).toBe('muted');
  const name = (await state(page)).dragon;
  await startRun(page);
  await findDragon(page);
  await waitScene(page, 'flight');
  await fly(page);
  await waitScene(page, 'home');
  const home = await page.evaluate(() => window.__emberwing.game.scenes.current.visibleDragons());
  await watch(page, 'attract');
  const s = await state(page);
  console.log(`muted run (game clock): ${s.runs[0]}s`);
  expect(s.sound).toBe('muted');
  expect(s.runs[0]).toBeGreaterThan(35);
  expect(s.runs[0]).toBeLessThanOrEqual(50);
  expect(s.count).toBe(1);
  expect(home.names).toContain(name);
  expect(errors).toEqual([]);
  await page.keyboard.press('m'); // leave it on for whoever runs next
});

test('the hoops and the brass swell land on the beat, so the music lines up', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    w.goto('flight');
    for (let i = 0; i < 30 * 30 && g.scenes.name === 'flight'; i++) {
      const s = w.state();
      if (s.target) g.input.feed(s.target.x, s.target.y + Math.sin(i) * 2, 'mouse');
      w.step(1 / 30, 30);
    }
    const f = g.scenes.scenes.flight;
    const off = (b) => Math.min(b % 1, 1 - (b % 1));
    return { rings: f.rings.slice(1).map((r) => +off(r.beat).toFixed(3)), swell: +off(f.swellBeat).toFixed(3) };
  });
  // within one frame (1/30s = 0.067 beats) of a beat
  for (const o of r.rings) expect(o).toBeLessThan(0.07);
  expect(r.swell).toBeLessThan(0.07);
});
