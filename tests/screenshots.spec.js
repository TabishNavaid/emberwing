import { test } from '@playwright/test';

// Regenerates tests/screens/*.png for every scene at projector and phone sizes.
//   npm run shots
const SHOTS = [
  ['attract', 2, null],
  ['attract', 10.4, null],
  ['attract', 13.5, null],
  ['find', 2, { x: 240, y: 90 }],
  ['find', 1.4, 'target'],
  ['flight', 6, 'follow'],
  ['flight', 13.4, 'follow'],
  ['flight', 19.2, 'follow'],
  ['home', 1.4, null],
  ['home', 4.2, null],
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
      await page.goto(`./?seed=3&scene=${scene}`);
      await page.waitForFunction(() => document.body.classList.contains('ready'));
      await page.evaluate(([t, ptr]) => {
        const w = window.__emberwing;
        const inp = w.game.input;
        w.pause(true);
        inp.feed(300, 250, 'mouse');
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
