import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// mixed ages: three scripted guests fly every level, so we can see the levels are actually
// different. stepped by hand (30 steps a game-second) so it's exact and the same every time.
//   kid:   slow and imprecise, reacts late, wobbly aim, ignores power-ups and enemies
//   teen:  decent, a bit of lag, goes for power-ups that are close
//   sharp: quick and precise, reads moving hoops ahead, dodges enemies, grabs power-ups

const SIM = `(() => {
  const w = window.__emberwing;
  const g = w.game;
  w.pause(true);
  const PROFILES = {
    kid: { delay: 0.5, follow: 2.2, noise: 26, grabs: false, dodges: false, predicts: false, seed: 1 },
    teen: { delay: 0.22, follow: 6, noise: 10, grabs: true, dodges: false, predicts: false, seed: 2 },
    sharp: { delay: 0.06, follow: 16, noise: 2, grabs: true, dodges: true, predicts: true, seed: 3 },
  };
  const out = {};
  // hoop layouts and enemies are random, so every guest flies the same four layouts per level
  // and we compare averages
  const SEEDS = [11, 23, 37, 41];
  for (const level of ['hatchling', 'flier', 'storm']) {
    for (const [who, P] of Object.entries(PROFILES)) {
      const runs = [];
      for (const seed of SEEDS) {
      w.reseed(seed * 1000 + 7);
      g.store.clear();
      for (let i = 0; i < 3; i++) g.store.add([[0, 0.5], [1, 0.4]], i);
      g.level = level;
      g.scenes.pending = null;
      g.scenes.fadeDir = 0;
      g.scenes.fade = 0;
      w.goto('flight');
      const f = g.scenes.current;
      let px = 240, py = 150;
      const hist = [];
      const dt = 1 / 30;
      for (let i = 0; i < 70 * 30 && g.scenes.name === 'flight' && !g.scenes.pending; i++) {
        const t = i * dt;
        // where they mean to go: the next hoop (where it will be when they get there, if sharp)
        const ring = f.nextRing();
        let aim = { x: 150, y: 120 };
        if (ring) {
          let y = f.ringY(ring);
          if (P.predicts && ring.move) y = ring.y + ring.move.amp * Math.sin(ring.move.w * Math.max(f.tt, ring.at) + ring.move.ph);
          aim = f.toScreen(f.ringX(ring) < 180 ? f.ex : 150, y);
        }
        const v = f.hz.view();
        const me = f.toScreen(f.ex, f.ey);
        if (P.grabs) {
          const orb = v.orbs.find((o) => o.x > me.x + 5 && o.x < me.x + 130 && Math.abs(o.y - aim.y) < 70);
          if (orb) aim = { x: aim.x, y: orb.y };
        }
        if (P.dodges) {
          const e = v.enemies.find((o) => o.x > me.x - 10 && o.x < me.x + 90 && Math.abs(o.y - aim.y) < 24);
          if (e) aim = { x: aim.x, y: aim.y + (aim.y > e.y ? 24 : -24) };
        }
        hist.push(aim);
        const late = hist[Math.max(0, hist.length - 1 - Math.round(P.delay / dt))];
        const wob = P.noise * (Math.sin(t * 1.3 + P.seed * 7) * 0.6 + Math.sin(t * 3.1 + P.seed * 3) * 0.4);
        const k = 1 - Math.exp(-P.follow * dt);
        px += (late.x - px) * k;
        py += (late.y + wob - py) * k;
        g.input.feed(px, py, 'mouse');
        w.step(dt, 30, false); // no need to draw 36 whole flights
      }
      const p = f.points;
      runs.push({ score: p.score, hits: p.hits, hoops: f.L.hoops, bumps: p.bumps, popped: p.popped, home: g.scenes.pending?.name === 'home' });
      }
      const avg = (k) => runs.reduce((s, x) => s + x[k], 0) / runs.length;
      const score = Math.round(avg('score'));
      const [two, three] = w.LEVELS[level].stars;
      out[level + ':' + who] = {
        score, stars: score >= three ? 3 : score >= two ? 2 : 1, hits: +avg('hits').toFixed(1), hoops: runs[0].hoops,
        bumps: +avg('bumps').toFixed(1), popped: +avg('popped').toFixed(1), home: runs.every((x) => x.home), each: runs.map((x) => x.score),
      };
    }
  }
  return out;
})()`;

test('mixed ages: each level is a different challenge, and storm rider is hard for a decent player', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(SIM);
  console.log('\naverage of 4 layouts per level');
  console.log('level        guest   score  stars   hoops     bumps  popped  each layout');
  for (const [key, x] of Object.entries(r)) {
    const [level, who] = key.split(':');
    console.log(`${level.padEnd(12)} ${who.padEnd(6)} ${String(x.score).padStart(6)}  ${'*'.repeat(x.stars).padEnd(5)}  ${String(x.hits).padStart(4)} / ${String(x.hoops).padEnd(3)}  ${String(x.bumps).padStart(5)}  ${String(x.popped).padStart(6)}  ${x.each.join(' ')}`);
  }
  for (const level of ['hatchling', 'flier', 'storm']) {
    // everybody gets home, on every level
    for (const who of ['kid', 'teen', 'sharp']) expect(r[`${level}:${who}`].home).toBe(true);
  }
  // on the harder levels, better flying = a better score
  for (const level of ['flier', 'storm']) {
    expect(r[`${level}:sharp`].score).toBeGreaterThan(r[`${level}:teen`].score);
    expect(r[`${level}:teen`].score).toBeGreaterThan(r[`${level}:kid`].score);
  }
  // hatchling is for little kids: everyone does well (who pops the most puffs is luck)
  for (const who of ['kid', 'teen', 'sharp']) expect(r[`hatchling:${who}`].stars).toBeGreaterThanOrEqual(2);
  expect(r['hatchling:teen'].stars).toBe(3);
  // flier: a real step up, the decent player is in the middle
  expect(r['flier:kid'].stars).toBe(1);
  expect(r['flier:teen'].stars).toBe(2);
  expect(r['flier:sharp'].stars).toBe(3);
  // storm rider: genuinely hard for the decent player, only the sharp one does well
  expect(r['storm:teen'].stars).toBe(1);
  expect(r['storm:teen'].hits / r['storm:teen'].hoops).toBeLessThan(0.6);
  expect(r['storm:sharp'].stars).toBeGreaterThanOrEqual(2);
});
