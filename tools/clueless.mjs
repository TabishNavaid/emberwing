// plays one run like a first-timer who doesn't know the game: the light wanders to random
// spots, pauses, never aims at anything. takes a screenshot every second + a log of what's up.
//   node tools/clueless.mjs <url> <out-dir> [seed]
// (starts the run on the lantern like the attract screen asks, then goes clueless)
import { chromium } from '@playwright/test';
import fs from 'fs';

const [url = 'http://localhost:4173/', out = 'notes/clueless', seed = '11'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(url + '?seed=' + seed);
await page.waitForFunction(() => document.body.classList.contains('ready'), null, { polling: 50 });

const toCss = (x, y) => ({ x: (x / 480) * 960, y: (y / 270) * 540 });
const state = () => page.evaluate(() => {
  const g = window.__emberwing.game;
  const s = g.scenes.current;
  return {
    scene: g.scenes.name, t: s.t, prompt: s.prompt ?? null, hold: s.hold ?? null,
    rings: s.rings ? s.rings.map((r) => r.state[0]).join('') : null,
    dragon: s.ex !== undefined ? [Math.round(s.ex), Math.round(s.ey)] : null,
    present: g.input.present, idle: +g.input.idle.toFixed(1),
  };
});

// start: hold the light on the lantern
for (let i = 0; i < 25; i++) {
  const p = toCss(372 + (i % 2), 152);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
}

let rnd = +seed;
const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
// from here on the game is stepped by hand (50ms per tick) so screenshots don't slow it down
// and every shot is exactly one game-second apart
await page.evaluate(() => window.__emberwing.pause(true));
let px = 372, py = 152, tx = px, ty = py, pause = 0;
const lines = [];
let left = false;
for (let tick = 0; tick < 90 * 20; tick++) {
  if (tick % 20 === 0) {
    const s = await state();
    const sec = String(tick / 20).padStart(2, '0');
    await page.screenshot({ path: `${out}/${sec}.png` });
    lines.push(`${sec}s ${JSON.stringify(s)}`);
    if (s.scene !== 'attract') left = true;
    else if (left) break;
  }
  // wander: drift toward a random spot, sometimes stop for a bit, never aim at anything
  if (pause > 0) pause -= 0.05;
  else {
    if (Math.hypot(tx - px, ty - py) < 4) {
      if (rand() < 0.35) pause = 0.5 + rand() * 1.5;
      tx = 30 + rand() * 420;
      ty = 30 + rand() * 210;
    }
    px += (tx - px) * 0.12;
    py += (ty - py) * 0.12;
    const p = toCss(px, py);
    await page.mouse.move(p.x, p.y);
  }
  await page.evaluate(() => window.__emberwing.step(0.05));
}
fs.writeFileSync(`${out}/log.txt`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
await b.close();
