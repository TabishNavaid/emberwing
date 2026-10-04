import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// a first-timer who doesn't know the game: the light wanders to random spots, pauses, never aims.
// three of them in a row on the same page, the way the lobby runs. stepped by hand so it's exact
test('clueless guests: the game teaches, never finishes itself, and everyone gets the same flight', async ({ page }) => {
  await boot(page);
  const runs = await page.evaluate(() => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    const results = [];
    for (const seed of [11, 23, 37]) {
      let rnd = seed;
      const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
      let px = 372, py = 152, tx = px, ty = py, pause = 0;
      const prompts = []; // [scene, prompt, seconds]
      let findDone = null;
      let flight = null;
      // start the run the way the attract screen asks: light on the lantern
      for (let i = 0; i < 40 && g.scenes.name === 'attract'; i++) { g.input.feed(372 + (i % 2), 152, 'mouse'); w.step(0.05); }
      let left = false;
      for (let tick = 0; tick < 120 * 20; tick++) {
        if (pause > 0) pause -= 0.05;
        else {
          if (Math.hypot(tx - px, ty - py) < 4) {
            if (rand() < 0.35) pause = 0.5 + rand() * 1.5;
            tx = 30 + rand() * 420;
            ty = 30 + rand() * 210;
          }
          px += (tx - px) * 0.12;
          py += (ty - py) * 0.12;
          g.input.feed(px, py, 'mouse');
        }
        w.step(0.05);
        const name = g.scenes.name;
        const s = g.scenes.current;
        if (name !== 'attract') left = true;
        else if (left) break;
        if (g.scenes.title) continue;
        if ((name === 'find' || name === 'flight') && s.prompt) {
          const last = prompts[prompts.length - 1];
          if (last && last[0] === name && last[1] === s.prompt) last[2] += 0.05;
          else prompts.push([name, s.prompt, 0.05]);
        }
        if (name === 'find' && s.found && findDone === null) findDone = +s.t.toFixed(2);
        if (name === 'flight') flight = s;
      }
      results.push({
        seed,
        backToAttract: g.scenes.name === 'attract',
        findDone,
        prompts: prompts.map(([sc, p, t]) => [sc, p, +t.toFixed(2)]),
        hoops: flight ? flight.rings.length : 0,
        resolved: flight ? flight.rings.filter((r) => r.state !== 'coming').length : 0,
      });
    }
    return results;
  });
  for (const r of runs) {
    console.log(`seed ${r.seed}: find done at ${r.findDone}s, hoops ${r.resolved}/${r.hoops}, prompts ${JSON.stringify(r.prompts)}`);
    expect(r.backToAttract).toBe(true);
    // no finishing itself before the guest has had a real chance to learn it
    expect(r.findDone).toBeGreaterThanOrEqual(10);
    // every instruction readable for 2s. the only one allowed to end sooner is the last one in
    // find ember, because it ends when the guest succeeds
    r.prompts.forEach(([scene, , secs], i) => {
      const endedBySuccess = scene === 'find' && (i === r.prompts.length - 1 || r.prompts[i + 1][0] !== 'find');
      if (!endedBySuccess) expect(secs).toBeGreaterThanOrEqual(1.99);
    });
    expect(r.hoops).toBe(8);
    expect(r.resolved).toBe(8);
  }
  expect(new Set(runs.map((r) => r.hoops)).size).toBe(1);
});
