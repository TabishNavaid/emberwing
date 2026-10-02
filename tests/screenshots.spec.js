import { test } from '@playwright/test';

// npm run shots -> tests/screens/, every scene at projector and phone size
const SHOTS = [
  ['attract', 2, null],
  ['attract', 10.4, null],
  ['attract', 13.5, null],
  ['attract', 22, null], // music page
  ['attract', 3, 'yours'], // YOURS! label after a run
  ['attract', 1, 'calibrate'], // K screen
  ['find', 0.8, { x: 240, y: 90 }], // story beat
  ['find', 2, { x: 240, y: 90 }],
  ['find', 1.4, 'target'],
  ['find', 2.6, 'target'], // found: happy wiggle
  ['flight', 6, 'follow'],
  ['flight', 5.35, 'follow'], // barrel roll after 3 in a row
  ['flight', 9, { x: 400, y: 60 }], // tether when ember lags behind the light
  ['flight', 12.2, 'follow'], // swell wind-up
  ['flight', 12.6, 'follow'], // swell fires
  ['flight', 13.4, 'follow'],
  ['flight', 19.2, 'follow'],
  ['home', 1.4, null],
  ['home', 3.6, null], // shimmer + counter rolling
  ['home', 4.2, null],
  ['home', 5, null], // act II banner
  ['end', 1.2, null],
];
const SIZES = [
  ['projector', { width: 1920, height: 1080 }, 1],
  ['phone', { width: 844, height: 390 }, 2],
];

for (const [label, viewport, dpr] of SIZES) {
  for (const [scene, t, ptr] of SHOTS) {
    test(`${scene} @${t}s ${label}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
      const page = await ctx.newPage();
      // seeded Math.random + no real-time loop so the same code always gives the same pixels,
      // that's how we checked the cleanup didn't change anything
      await page.addInitScript(() => {
        let s = 12345;
        Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        window.requestAnimationFrame = () => 0;
      });
      await page.goto(`./?seed=3&scene=${scene}`);
      await page.waitForFunction(() => document.body.classList.contains('ready'), null, { polling: 50 });
      await page.evaluate(([t, ptr]) => {
        const w = window.__emberwing;
        const inp = w.game.input;
        w.pause(true);
        inp.feed(300, 250, 'mouse');
        if (ptr === 'calibrate') {
          w.game.op.cal = { step: 1, pts: [[40, 40]], hold: 0.6, ax: 300, ay: 60, armed: true, source: 'mocap' };
          inp.feed(330, 70, 'mocap');
        }
        if (ptr === 'yours') {
          for (let i = 0; i < 6; i++) w.game.store.add([[0, 0.5], [0.3, 0.3 + i * 0.05], [0.6, 0.6], [1, 0.4]], i);
          w.goto('attract', { reason: 'done' });
        }
        if (ptr && ptr.x) inp.feed(ptr.x, ptr.y, 'mouse');
        for (let i = 0; i < t * 20; i++) {
          const s = w.state();
          if ((ptr === 'target' || ptr === 'follow') && s.target) inp.feed(s.target.x, s.target.y, 'mouse');
          w.step(0.05);
        }
      }, [t, ptr]);
      await page.screenshot({ path: `tests/screens/${scene}-${t}-${label}.png` });
      await ctx.close();
    });
  }
}
