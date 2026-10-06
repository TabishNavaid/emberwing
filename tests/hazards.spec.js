// enemies and power-ups. nothing can end a run: bumps are a tumble and a few points
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

// starts a flight on a level and steps through the tutorial hoop so the timeline is running
const SETUP = `
  const w = window.__emberwing;
  const g = w.game;
  w.pause(true);
  const fly = (level, home = 0) => {
    g.store.clear();
    for (let i = 0; i < home; i++) g.store.add([[0, 0.5], [1, 0.4]], i % 6);
    g.level = level;
    // a previous flight's "go home" fade may still be pending, drop it
    g.scenes.pending = null;
    g.scenes.fadeDir = 0;
    g.scenes.fade = 0;
    w.goto('flight');
    const f = g.scenes.current;
    for (let i = 0; i < 200 && f.tutorial; i++) {
      const s = w.state();
      if (s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
      w.step(0.05, 60, false);
    }
    return f;
  };
  const steer = (f, secs, aim = true) => {
    for (let i = 0; i < secs * 20 && g.scenes.name === 'flight' && !g.scenes.pending; i++) {
      const s = w.state();
      if (aim && s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
      w.step(0.05, 60, false);
    }
  };
  // drops a critter right where it'll meet the dragon
  const put = (f, kind, extra = {}) => {
    const it = { kind, x: f.ex + 4, y: f.ey, vx: 0, t: 0, alpha: 1, ...extra };
    f.hz.list.push(it);
    return it;
  };
`;
const run = (page, body) => page.evaluate(`(() => { ${SETUP} ${body} })()`);

test('no enemies on hatchling (harmless puffs instead), flier and storm rider get theirs', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const out = {};
    for (const id of ['hatchling', 'flier', 'storm']) {
      const f = fly(id, 3);
      steer(f, 40);
      out[id] = f.hz.spawned;
    }
    return out;
  `);
  const enemies = (list) => list.filter((k) => ['cloud', 'gust', 'wisp'].includes(k)).length;
  expect(enemies(r.hatchling)).toBe(0);
  expect(r.hatchling.filter((k) => k === 'puff').length).toBeGreaterThan(0);
  // little kids get the spectacle too: a fireball and a flock friend
  expect(r.hatchling).toContain('fireball');
  expect(r.hatchling).toContain('friend');
  expect(enemies(r.flier)).toBeGreaterThan(0);
  expect(enemies(r.storm)).toBeGreaterThan(enemies(r.flier));
});

test('a bump: the dragon tumbles, loses the streak and a little score, then flies on home', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const f = fly('flier');
    steer(f, 3);
    const before = { score: f.points.score, streak: f.streak };
    put(f, 'gust');
    steer(f, 0.1, false);
    const hit = { tumble: f.tumbleT > 0, bumps: f.points.bumps, score: f.points.score, streak: f.streak };
    // bumped again straight away: no, it gets a moment to recover
    put(f, 'cloud');
    steer(f, 0.1, false);
    const again = f.points.bumps;
    steer(f, 1.2);
    const recovered = f.tumbleT === 0;
    steer(f, 40);
    return { before, hit, again, recovered, home: g.scenes.pending?.name ?? g.scenes.name };
  `);
  expect(r.hit.tumble).toBe(true);
  expect(r.hit.bumps).toBe(1);
  expect(r.hit.streak).toBe(0);
  expect(r.hit.score).toBe(Math.max(0, r.before.score - 50));
  expect(r.again).toBe(1);
  expect(r.recovered).toBe(true);
  expect(r.home).toBe('home');
});

test('a grumpy cloud zaps a hoop it sits on (not counted as your miss), a fog wisp hides one', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const f = fly('flier');
    steer(f, 1);
    const ring = f.hz.ringIn(250, 700);
    const missesBefore = f.points.misses;
    f.hz.list.push({ kind: 'cloud', zapper: true, ring, x: f.ringX(ring), y: f.ringY(ring) - 20, vx: 0, t: 0, alpha: 1 });
    steer(f, 1.2);
    const zapped = ring.state;
    const ring2 = f.hz.ringIn(250, 700);
    f.hz.list.push({ kind: 'wisp', ring: ring2, x: f.ringX(ring2), y: f.ringY(ring2), vx: 0, t: 0, alpha: 1 });
    steer(f, 0.3);
    const hidden = ring2.hidden;
    steer(f, 2.0);
    return { zapped, misses: f.points.misses - missesBefore, hidden, after: ring2.hidden };
  `);
  expect(r.zapped).toBe('zapped');
  expect(r.misses).toBe(0);
  expect(r.hidden).toBe(true);
  expect(r.after).toBe(false);
});

test('fireball: the dragon pops whatever the light points near', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const f = fly('flier');
    steer(f, 1);
    f.powerUp(g, 'fireball', f.ex, f.ey);
    const target = put(f, 'gust', { x: f.ex + 120, y: f.ey - 10 });
    const at = f.toScreen(target.x, target.y);
    for (let i = 0; i < 20; i++) { g.input.feed(at.x, at.y, 'mouse'); w.step(0.05, 60, false); }
    return { popped: target.popT !== undefined, count: f.points.popped, bumps: f.points.bumps };
  `);
  expect(r.popped).toBe(true);
  expect(r.count).toBe(1);
  expect(r.bumps).toBe(0);
});

test('shield shrugs off one hit, then it is gone', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const f = fly('storm');
    steer(f, 1);
    f.powerUp(g, 'shield', f.ex, f.ey);
    put(f, 'gust');
    steer(f, 0.1, false);
    const first = { tumble: f.tumbleT > 0, bumps: f.points.bumps, shield: f.shield };
    steer(f, 1.5);
    put(f, 'gust');
    steer(f, 0.1, false);
    return { first, second: { tumble: f.tumbleT > 0, bumps: f.points.bumps } };
  `);
  expect(r.first).toEqual({ tumble: false, bumps: 0, shield: false });
  expect(r.second).toEqual({ tumble: true, bumps: 1 });
});

test('magnet pulls the dragon into the next hoop, speed burst doubles hoop points', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    // light held way off at the bottom and the next hoop up high: the magnet pulls the dragon
    // a lot closer to it. hatchling, so no enemy can get in the way of the measurement
    const offBy = (magnet) => {
      w.reseed(5);
      const f = fly('hatchling');
      if (magnet) f.powerUp(g, 'magnet', f.ex, f.ey);
      const ring = f.rings.find((x) => !x.tutorial && x.state === 'coming');
      ring.y = 70;
      for (let i = 0; i < 80 && ring.state === 'coming'; i++) { g.input.feed(200, 262, 'mouse'); w.step(0.05, 60, false); }
      return Math.abs(ring.hitY - f.ey);
    };
    const without = offBy(false);
    const withMagnet = offBy(true);
    // points for exactly the next hoop, aiming at its middle
    const nextHoop = (f) => {
      const h = f.points.hits;
      const s0 = f.points.score;
      for (let i = 0; i < 80 && f.points.hits === h; i++) {
        const s = w.state();
        if (s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
        w.step(0.05, 60, false);
      }
      return f.points.score - s0;
    };
    w.reseed(5);
    const f = fly('hatchling');
    steer(f, 1);
    const normalHoop = nextHoop(f);
    f.powerUp(g, 'speed', f.ex, f.ey);
    const speedHoop = nextHoop(f);
    return { without, withMagnet, normalHoop, speedHoop };
  `);
  expect(r.withMagnet).toBeLessThan(r.without);
  expect(r.speedHoop).toBeGreaterThanOrEqual(r.normalHoop * 1.8);
});

test('a flock friend only comes when somebody is home, and it clears the screen', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const lonely = fly('hatchling', 0);
    const noFriend = !lonely.hz.queue.some((e) => e.power === 'friend');
    const f = fly('storm', 4);
    steer(f, 1);
    const crowd = [put(f, 'gust', { x: f.ex + 150, y: 80 }), put(f, 'cloud', { x: f.ex + 200, y: 150 }), put(f, 'gust', { x: f.ex + 260, y: 200 })];
    f.powerUp(g, 'friend', f.ex, f.ey);
    const came = !!f.hz.friend;
    steer(f, 1.6, false);
    return { noFriend, came, popped: crowd.filter((c) => c.popT !== undefined).length, bumps: f.points.bumps };
  `);
  expect(r.noFriend).toBe(true);
  expect(r.came).toBe(true);
  expect(r.popped).toBe(3);
});
