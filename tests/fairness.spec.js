// the harder levels have to be hard but fair: a hoop the dragon visibly flies through counts,
// wherever the dragon is and however fast the hoop moves. stepped by hand so it's exact
import { test, expect } from '@playwright/test';
import { boot } from './helpers.js';

const SETUP = `
  const w = window.__emberwing;
  const g = w.game;
  w.pause(true);
  const flight = (level, seed) => {
    w.reseed(seed * 1000 + 7);
    g.store.clear();
    for (let i = 0; i < 3; i++) g.store.add([[0, 0.5], [1, 0.4]], i);
    g.level = level;
    g.scenes.pending = null;
    g.scenes.fadeDir = 0;
    g.scenes.fade = 0;
    w.goto('flight');
    return g.scenes.current;
  };
  const flying = () => g.scenes.name === 'flight' && !g.scenes.pending;
  // nothing but hoops, so it only measures the hoops
  const noHazards = (f) => {
    f.hz.queue.length = 0;
    f.hz.gusts.length = 0;
  };
  // where a hoop will be a moment from now (the dragon takes a moment to get there)
  const yAhead = (f, ring, s) => ring.move ? ring.y + ring.move.amp * Math.sin(ring.move.w * (f.tt + s) + ring.move.ph) : ring.y;
`;
const run = (page, body) => page.evaluate(`(() => { ${SETUP} ${body} })()`);

// the light right where the middle of each hoop will be when it reaches the dragon
const CENTER = `
  const out = [];
  for (const level of ['hatchling', 'flier', 'storm']) {
    for (const fps of [60, 30]) {
      for (const seed of [11, 37]) {
        const f = flight(level, seed);
        noHazards(f);
        for (let i = 0; i < 80 * fps && flying(); i++) {
          const ring = f.nextRing();
          const at = f.toScreen(150, ring ? yAhead(f, ring, 1 / 12) : 120);
          g.input.feed(at.x, at.y, 'mouse');
          w.step(1 / fps, fps, false);
        }
        const rings = f.rings.slice(1);
        out.push({ level, fps, seed, hits: f.points.hits, hoops: f.L.hoops, moving: rings.filter((r) => r.move).length,
          off: +Math.max(...rings.map((r) => r.offA / f.ringR(r))).toFixed(2) });
      }
    }
  }
  return out;
`;

test('a dragon flying through the middle of every hoop gets every one, moving ones too, on every level, in A and B, at 60 and 30 fps', async ({ page }) => {
  const all = [];
  for (const v of ['', '&v=b']) {
    await boot(page, v);
    for (const x of await run(page, CENTER)) all.push({ v: v ? 'b' : 'a', ...x });
  }
  console.log('center bot:', all.map((x) => `${x.v} ${x.level} ${x.fps}fps #${x.seed}: ${x.hits}/${x.hoops} (${x.moving} moving, worst ${x.off} of the radius off)`).join('\n  '));
  for (const x of all) {
    expect(x.hits).toBe(x.hoops);
    // it really did go through the middle half of every hoop, so a miss would have been the game's fault
    expect(x.off).toBeLessThan(0.5);
  }
  expect(all.filter((x) => x.level === 'storm').every((x) => x.moving > 10)).toBe(true);
});

test('the hit area is the drawn hoop and a little more: through the rope counts (it used to be a miss), past it does not', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    const out = {};
    for (const level of ['flier', 'storm']) {
      for (const [name, place] of [['rope', (f, ring) => f.ringR(ring) * 1.06 + 0.5], ['past', (f, ring) => f.ringReach(ring, false) + 3]]) {
        const f = flight(level, 23);
        noHazards(f);
        f.rings.forEach((ring) => { ring.move = undefined; });
        const zoom = [];
        for (let i = 0; i < 80 * 60 && flying(); i++) {
          const at = f.toScreen(150, 135);
          g.input.feed(at.x, at.y, 'mouse');
          // the next hoop goes above the dragon, so the dragon goes through its rope at the rope's
          // biggest (until now only the rope's resting size counted, so that was a miss), or just
          // past what counts. above both dragons, the one the game steers and the one on screen
          const ring = f.rings.find((x) => !x.tutorial && x.state === 'coming' && f.ringX(x) > f.ex - 4 && f.ringX(x) < f.ex + 120);
          if (ring && !f.tutorial) {
            ring.y = Math.min(f.ey, f.drawnAt().y) - place(f, ring);
            if (Math.abs(f.ringX(ring) - f.ex) < 6) zoom.push(f.zoom);
          }
          if (f.tutorial) f.rings[0].y = f.ey;
          w.step(1 / 60, 60, false);
        }
        const rings = f.rings.slice(1);
        out[level + ':' + name] = { hit: rings.filter((x) => x.state === 'hit').length, miss: rings.filter((x) => x.state === 'miss').length, of: rings.length, zoom: [Math.min(...zoom), Math.max(...zoom)].map((z) => +z.toFixed(2)) };
      }
    }
    return out;
  `);
  console.log('hit area:', JSON.stringify(r));
  for (const level of ['flier', 'storm']) {
    const rope = r[level + ':rope'];
    const past = r[level + ':past'];
    expect(rope.hit).toBe(rope.of);
    expect(past.miss).toBe(past.of);
    // across the whole zoom, zoomed in at the start and out after the swell
    expect(rope.zoom[0]).toBeLessThan(0.95);
    expect(rope.zoom[1]).toBeGreaterThan(1.1);
  }
});

// guests who don't hold the light where the hoops get timed: on the hoop as it comes in (most
// people), well behind, well ahead. wobbly hands, every enemy left in. the dragon is read where it's
// really drawn on screen
const RECORD = `
  const PROFILES = {
    chaser: { follow: 6, noise: 6, seed: 4, onHoop: true },
    behind: { follow: 6, noise: 6, seed: 5, dx: -40 },
    ahead: { follow: 6, noise: 6, seed: 6, dx: 40 },
  };
  const out = [];
  const fps = 60;
  for (const level of ['flier', 'storm']) {
    for (const [who, P] of Object.entries(PROFILES)) {
      for (const seed of [11, 41]) {
        const f = flight(level, seed);
        const rings = f.rings.slice(1).map((r) => ({ r, last: null, cross: null, judged: null }));
        let px = 240, py = 150;
        for (let i = 0; i < 80 * fps && flying(); i++) {
          const t = i / fps;
          const ring = f.nextRing();
          let aim = f.toScreen(150, 120);
          if (ring) aim = f.toScreen(P.onHoop && !ring.tutorial ? f.ringX(ring) : 150, f.ringY(ring));
          if (P.dx) aim.x += P.dx;
          const k = 1 - Math.exp(-P.follow / fps);
          px += (aim.x - px) * k;
          py += (aim.y + P.noise * Math.sin(t * 1.3 + P.seed * 7) - py) * k;
          g.input.feed(px, py, 'mouse');
          const before = rings.map((o) => o.r.state);
          w.step(1 / fps, fps, false);
          const near = rings.some((o) => Math.abs(f.ringX(o.r) - f.ex) < 40);
          if (!near) {
            for (const o of rings) o.last = null;
            continue;
          }
          w.step(0, fps, true);
          const dr = f.drawn;
          const q = f.busy ? { dx: 0, dy: 0 } : f.me.q.pose(true);
          const dx = dr.x + q.dx;
          const dy = dr.y + q.dy;
          rings.forEach((o, n) => {
            const x = f.ringX(o.r);
            const y = f.ringY(o.r);
            if (before[n] === 'coming' && o.r.state !== 'coming') o.judged = { state: o.r.state, gap: +(x - f.ex).toFixed(1) };
            const now = { rel: x - dx, off: dy - y, state: before[n] };
            if (o.last && o.last.rel > 0 && now.rel <= 0 && !o.cross) {
              const u = o.last.rel / (o.last.rel - now.rel);
              o.cross = { off: Math.abs(o.last.off + (now.off - o.last.off) * u), r: f.ringR(o.r), state: o.last.state };
            }
            o.last = now;
          });
        }
        for (const o of rings) {
          const amp = Math.min(2 + o.cross?.r * 0.08, o.cross?.r * 0.2);
          out.push({ level, who, seed, final: o.r.state, judged: o.judged, cross: o.cross, inner: o.cross ? o.cross.r - amp - 1 : null, moving: !!o.r.move });
        }
      }
    }
  }
  return out;
`;

test('recorded flights: every hoop the dragon is drawn flying through counts, and every hoop is judged right beside the dragon', async ({ page }) => {
  await boot(page);
  const rows = await run(page, RECORD);
  const through = rows.filter((x) => x.cross && x.final !== 'zapped' && x.cross.off < x.inner);
  const notCounted = through.filter((x) => x.final !== 'hit');
  const far = rows.filter((x) => x.judged && x.judged.state !== 'zapped' && Math.abs(x.judged.gap) > 20);
  const by = {};
  for (const x of rows) {
    const k = `${x.level} ${x.who}`;
    const s = (by[k] ??= { hit: 0, of: 0, through: 0 });
    s.of++;
    if (x.final === 'hit') s.hit++;
    if (x.cross && x.final !== 'zapped' && x.cross.off < x.inner) s.through++;
  }
  console.log('recorded flights (hoops counted / hoops, drawn clearly inside the ring):', JSON.stringify(by));
  if (notCounted.length) console.log('flew through but not counted:', JSON.stringify(notCounted));
  if (far.length) console.log('judged away from the dragon:', JSON.stringify(far));
  // every guest flew through plenty of hoops, moving ones included, so this means something
  for (const s of Object.values(by)) expect(s.through).toBeGreaterThan(s.of * 0.3);
  expect(through.filter((x) => x.moving).length).toBeGreaterThan(30);
  expect(notCounted).toEqual([]);
  expect(far).toEqual([]);
});

// the light on the middle of every hoop, every enemy left in: a dragon lined up with a hoop for the
// last ENEMY.APPROACH seconds before it gets there, anywhere in the hoop's opening, never touches a
// cloud or a gust sprite. enemies can make lining up harder, never impossible
const CORRIDOR = `
  const E = w.ENEMY;
  const out = { rings: 0, near: 0, blocked: [] };
  for (const level of ['flier', 'storm']) {
    for (const seed of [11, 23, 37, 41]) {
      const f = flight(level, seed);
      const fps = 30;
      for (let i = 0; i < 80 * fps && flying(); i++) {
        const ring = f.nextRing();
        const at = f.toScreen(150, ring ? yAhead(f, ring, 1 / 12) : 120);
        g.input.feed(at.x, at.y, 'mouse');
        w.step(1 / fps, fps, false);
        for (const r of f.rings) {
          if (r.tutorial || r.state !== 'coming') continue;
          const ahead = (f.ringX(r) - f.ex) / f.L.scroll;
          if (ahead < -0.05 || ahead > E.APPROACH) continue;
          if (ahead < 0.05) out.rings++;
          const open = f.ringOpen(r);
          for (const it of f.hz.list) {
            if (it.popT !== undefined || (it.kind !== 'cloud' && it.kind !== 'gust')) continue;
            const dx = it.x - f.ex;
            const dy = Math.max(0, Math.abs(it.y - f.ringY(r)) - open);
            const d = Math.hypot(dx, dy);
            if (d < E.HIT_R + 10) out.near++;
            if (d < E.HIT_R) out.blocked.push({ level, seed, ring: f.rings.indexOf(r), kind: it.kind, guard: !!(it.ring === r && !it.zapper), zapper: !!it.zapper, ahead: +ahead.toFixed(2), d: +d.toFixed(1) });
          }
        }
      }
    }
  }
  return out;
`;

test('no cloud or gust sprite ever sits in the opening of a hoop or in the way of it, while the dragon would be flying through', async ({ page }) => {
  const all = [];
  for (const v of ['', '&v=b']) {
    await boot(page, v);
    all.push(await run(page, CORRIDOR));
  }
  console.log('hoop openings checked:', all.map((x) => `${x.rings} hoops, ${x.near} times an enemy came close`).join(' / '));
  if (all.some((x) => x.blocked.length)) console.log('in the way:', JSON.stringify(all.flatMap((x) => x.blocked)));
  // enemies really did come close, so the check means something
  for (const x of all) expect(x.near).toBeGreaterThan(20);
  for (const x of all) expect(x.blocked).toEqual([]);
});

// what a guest sees before anything costs them: every bump comes from an enemy that's been on
// screen gathering for a second, every zap from a spark that charged for over a second, every
// wind gust after a second of streaks and arrows. and each cost says what it was
const WARNINGS = `
  const E = w.ENEMY;
  const PROFILES = {
    kid: { follow: 2.2, noise: 26, seed: 1 },
    teen: { follow: 6, noise: 10, seed: 2 },
    chaser: { follow: 6, noise: 6, seed: 4, onHoop: true },
  };
  const out = { bumps: [], zaps: [], gusts: [], saved: 0 };
  const fps = 30;
  for (const level of ['flier', 'storm']) {
    for (const [who, P] of Object.entries(PROFILES)) {
      for (const seed of [11, 23, 37, 41]) {
        const f = flight(level, seed);
        const proto = Object.getPrototypeOf(f);
        const bump = proto.bump;
        f.bump = (gg, dir, by) => {
          const ready = f.safeT <= 0 && f.p <= w.FLIGHT.RISE_AT;
          const shown = f.points.popups.length;
          bump.call(f, gg, dir, by);
          if (ready) out.bumps.push({ level, who, seed, kind: by.kind, onScreen: +(f.t - by.firstSeen).toFixed(2), said: f.points.popups.slice(shown).map((p) => p.text) });
        };
        const charging = new Map();
        let px = 240, py = 150;
        for (let i = 0; i < 80 * fps && flying(); i++) {
          const t = i / fps;
          const ring = f.nextRing();
          let aim = f.toScreen(150, 120);
          if (ring) aim = f.toScreen(P.onHoop && !ring.tutorial ? f.ringX(ring) : 150, f.ringY(ring));
          const k = 1 - Math.exp(-P.follow / fps);
          px += (aim.x - px) * k;
          py += (aim.y + P.noise * Math.sin(t * 1.3 + P.seed * 7) - py) * k;
          g.input.feed(px, py, 'mouse');
          const before = f.rings.map((r) => r.state);
          const shown = f.points.popups.length;
          const pushes = f.hz.gusts.map((e) => e.fired);
          w.step(1 / fps, fps, false);
          // the test's own idea of when each enemy first showed up on screen
          for (const it of f.hz.list) if (it.firstSeen === undefined && f.toScreen(it.x, it.y).x < 480) it.firstSeen = f.t;
          f.rings.forEach((r, n) => {
            if (r.charge > 0 && !charging.has(r)) charging.set(r, f.t);
            if (before[n] === 'coming' && r.state === 'zapped') {
              const cloud = f.hz.list.find((it) => it.ring === r && it.zapper);
              out.zaps.push({ level, who, seed, ring: n, charged: +(f.t - charging.get(r)).toFixed(2), onScreen: +(f.t - cloud.firstSeen).toFixed(2), said: f.points.popups.slice(shown).map((p) => p.text) });
            }
          });
          if (f.points.popups.slice(shown).some((p) => p.text === 'SAVED!')) out.saved++;
          f.hz.gusts.forEach((e, n) => {
            if (!pushes[n] && e.fired) out.gusts.push({ level, who, seed, warned: +(f.tt - e.at).toFixed(2) });
          });
        }
        delete f.bump;
      }
    }
  }
  return out;
`;

test('every bump, every zapped hoop and every wind gust comes after a warning of a second or more, and says what it was', async ({ page }) => {
  await boot(page);
  const r = await run(page, WARNINGS);
  const min = (list, k) => Math.min(...list.map((x) => x[k]));
  console.log(`bumps: ${r.bumps.length} (on screen at least ${min(r.bumps, 'onScreen')}s first)  zaps: ${r.zaps.length} (spark charging at least ${min(r.zaps, 'charged')}s)  saved by flying through first: ${r.saved}  wind gusts: ${r.gusts.length} (warned at least ${min(r.gusts, 'warned')}s)`);
  expect(r.bumps.length).toBeGreaterThan(5);
  expect(r.zaps.length).toBeGreaterThan(3);
  expect(r.gusts.length).toBeGreaterThan(5);
  for (const b of r.bumps) {
    expect(b.onScreen).toBeGreaterThanOrEqual(1);
    expect(b.said.some((s) => s === 'WHOA! -50' || s === 'BLOCKED!')).toBe(true);
  }
  for (const z of r.zaps) {
    expect(z.charged).toBeGreaterThanOrEqual(1);
    expect(z.onScreen).toBeGreaterThanOrEqual(1);
    expect(z.said).toContain('ZAPPED!');
  }
  for (const e of r.gusts) expect(e.warned).toBeGreaterThanOrEqual(1);
});

test('a zapper can be beaten: fly ahead and through the hoop first, or pop the cloud. hold back and it zaps, not your miss', async ({ page }) => {
  await boot(page);
  const r = await run(page, `
    // a zapper on a hoop that's still well off to the right. the light holds the hoop's height,
    // ahead of the gate as far as the dragon can go (ahead), at the gate (hold), or at the gate with
    // a fireball aimed at the cloud (pop)
    const tryIt = (how) => {
      const f = flight('flier', 23);
      noHazards(f);
      for (let i = 0; i < 400 && f.tutorial; i++) {
        const s = w.state();
        if (s.target) g.input.feed(s.target.x, s.target.y, 'mouse');
        w.step(1 / 30, 30, false);
      }
      const ring = f.hz.ringIn(480, 760);
      ring.taken = true;
      const cloud = { kind: 'cloud', zapper: true, ring, x: f.ringX(ring), y: f.ringY(ring) - 40, vx: 0, t: 0, alpha: 1 };
      f.hz.list.push(cloud);
      if (how === 'pop') f.powerUp(g, 'fireball', f.ex, f.ey);
      const misses = f.points.misses;
      let chargedFor = 0;
      const said = [];
      // (and a few steps after it's gone, for what it says)
      for (let i = 0, after = 0; i < 6 * 30 && after < 10; i++) {
        const gate = f.toScreen(150, f.ringY(ring));
        const x = how === 'ahead' ? gate.x + w.FLIGHT.X_PLAY : gate.x;
        // a fireball goes where the light points: at the cloud
        const at = how === 'pop' ? f.toScreen(cloud.x, cloud.y) : { x, y: gate.y };
        g.input.feed(at.x, at.y, 'mouse');
        const shown = f.points.popups.length;
        w.step(1 / 30, 30, false);
        if (ring.charge > 0 && ring.state === 'coming') chargedFor += 1 / 30;
        said.push(...f.points.popups.slice(shown).map((p) => p.text));
        if (ring.state !== 'coming') after++;
      }
      return { state: ring.state, popped: cloud.popT !== undefined, misses: f.points.misses - misses, chargedFor: +chargedFor.toFixed(2), said };
    };
    return { ahead: tryIt('ahead'), hold: tryIt('hold'), pop: tryIt('pop') };
  `);
  console.log('zapper:', JSON.stringify(r));
  expect(r.ahead.state).toBe('hit');
  expect(r.ahead.said).toContain('SAVED!');
  expect(r.hold.state).toBe('zapped');
  expect(r.hold.misses).toBe(0);
  expect(r.hold.chargedFor).toBeGreaterThanOrEqual(1.15);
  expect(r.hold.said).toContain('ZAPPED!');
  expect(r.pop.popped).toBe(true);
  expect(r.pop.state).not.toBe('zapped');
});
