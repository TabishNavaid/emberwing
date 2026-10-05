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
  ['find', 0.9, 'title'], // title card between scenes
  ['find', 2, { x: 240, y: 90 }],
  ['find', 1.4, 'target'],
  ['find', 2.6, 'target'], // found: happy wiggle
  ['find', 7.5, 'wander'], // hints: big eyes + spark trail
  ['find', 10.5, 'wander'], // hints: beam leaning toward the eyes
  ['flight', 0.8, { x: 380, y: 210 }], // PIP FOLLOWS YOUR LIGHT + arrow, tutorial hoop gliding in
  ['flight', 2.6, { x: 150, y: 232 }], // tutorial hoop waiting, chevron, FLY THROUGH THE HOOPS
  ['flight', 5.9, 'follow'], // barrel roll after 3 in a row
  ['flight', 8.5, 'follow'], // mid flight, counter
  ['flight', 9.5, { x: 400, y: 60 }], // tether when the dragon lags behind the light
  ['flight', 13.6, 'follow'], // swell wind-up
  ['flight', 14.1, 'follow'], // swell fires (nobody home yet, so no flock)
  ['flight', 15, 'follow', 'flock'], // the flock is the dragons already home
  ['flight', 19.2, 'follow'],
  ['flight', 3, 'follow', 'route=1'], // route 2: inside the rain squall
  ['flight', 9, 'follow', 'route=1'], // clearing
  ['flight', 15, 'follow', 'route=1'], // rainbow at the swell
  ['flight', 6, 'follow', 'route=2'], // route 3: low over the standing stones
  ['flight', 15, 'follow', 'route=2'], // aurora flares at the swell
  ['home', 1.4, null],
  ['home', 3.6, null, 'flock'], // counter lands, flock circling
  ['home', 4.2, null], // first guest: one dragon, an empty sky
  ['home', 4.8, null], // act II banner
  ['home', 5.4, null, 'party'], // the 8th dragon: celebration flyover
  ['end', 1.2, null], // the dragon card, first guest of the night
  ['end', 1.6, null, 'flock'], // the dragon card, 6th home
  ['attract', 3, null, 'flock'], // tonight's flock circling, countdown to the next celebration
  ['attract', 1, null, 'gate'], // press any key to start the station
  ['attract', 0.6, { x: 292, y: 130 }], // holding the light on FLIER
  ['choose', 1.2, null], // who will you find?
  ['choose', 1.0, { x: 240, y: 104 }], // holding the light on the middle dragon
  ['flight', 6, 'follow', 'level=hatchling'], // puffs to pop, a power-up orb
  ['flight', 8, 'follow', 'level=flier'], // smaller moving hoops, the first enemies
  ['flight', 9, 'follow', 'level=storm'], // small hoops, enemies, gusts
  ['party', 3, null, 'eight'], // the celebration: every dragon, fireworks, names
  ['party', 6.6, null, 'eight'], // the new star flies up into the sky
  ['end', 2.0, null, 'scored'], // the dragon card with a score and stars
];
const SIZES = [
  ['projector', { width: 1920, height: 1080 }, 1],
  ['phone', { width: 844, height: 390 }, 2],
];

for (const [label, viewport, dpr] of SIZES) {
  for (const [scene, t, ptr, extra] of SHOTS) {
    test(`${scene} @${t}s ${extra ?? ''} ${label}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
      const page = await ctx.newPage();
      // seeded Math.random + no real-time loop so the same code always gives the same pixels,
      // that's how we checked the cleanup didn't change anything
      await page.addInitScript(() => {
        let s = 12345;
        Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        window.requestAnimationFrame = () => 0;
      });
      const route = extra?.includes('=') ? `&${extra}` : '';
      await page.goto(`./?seed=3&scene=${scene}${route}`);
      await page.waitForFunction(() => document.body.classList.contains('ready'), null, { polling: 50 });
      await page.evaluate(([scene, t, ptr, extra]) => {
        const w = window.__emberwing;
        const inp = w.game.input;
        w.pause(true);
        w.game.gate = false; // as if the operator already started the station
        inp.feed(300, 250, 'mouse');
        if (extra === 'scored') w.game.lastRun = { flown: true, level: 'flier', score: 2450, stars: 2 };
        // some dragons already home tonight (5), 7 so this one is the 8th, 8 for the celebration
        const home = { flock: 5, party: 7, eight: 8, scored: 3 }[extra] ?? 0;
        if (home) {
          for (let i = 0; i < home; i++) w.game.store.add([[0, 0.5], [0.3, 0.3 + i * 0.05], [0.6, 0.6], [1, 0.4]], i % 6);
          w.goto(scene);
        }
        if (extra === 'gate') w.game.gate = true;
        if (ptr === 'title') w.game.scenes.go('flight', {}, { title: 'NOW FLY HOME!' });
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
          if (ptr === 'wander') inp.feed(70 + Math.sin(i * 0.15) * 40, 50 + Math.cos(i * 0.11) * 25, 'mouse');
          w.step(0.05);
        }
      }, [scene, t, ptr, extra]);
      await page.screenshot({ path: `tests/screens/${scene}-${t}${extra ? '-' + extra.replace('=', '') : ''}-${label}.png` });
      await ctx.close();
    });
  }
}
