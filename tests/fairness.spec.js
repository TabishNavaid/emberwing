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
