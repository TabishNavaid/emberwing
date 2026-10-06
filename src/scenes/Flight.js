import { VIEW, DUR, FLIGHT, PAL, MUSIC, MOTION, INPUT, LEVELS, SCORE, ENEMY, POWER } from '../config.js';
import { Points } from '../core/Points.js';
import { Hazards } from '../core/Hazards.js';
import { drawPowerIcon, POWER_COLORS } from '../art/critters.js';
import { clamp, lerp, approach, glow, ease, mix, invLerp, mulberry32 } from '../core/util.js';
import { drawText, drawTextPop, fitScale } from '../art/font.js';
import { drawKnotRing, drawKnotBand } from '../art/knotwork.js';
import { drawDragon, drawSpeck } from '../art/dragon.js';
import { flockOf, member, chirp, updateMember, drawMember } from '../art/flock.js';
import { makeStars, drawWind, drawRune } from '../art/world.js';
import { ROUTES, RAINBOW } from '../art/routes.js';
import { drawHorn, drawSoundLines, drawCursorLight, drawStarIcon } from '../art/icons.js';

// second instruction at the start of the flight (the first one has the dragon's name in it)
const HOOPS = 'FLY THROUGH THE HOOPS';
// where the flock flies around the guest's dragon after the swell, newest first.
// a loose wedge trailing behind, so 1 or 12 of them both look like a flock
const WEDGE = [[-36, -30], [-44, 28], [-70, -4], [-78, -50], [-84, 46], [-106, 14], [-112, -28], [-128, 60], [-138, -62], [-142, -6], [-162, 34], [-170, -40]];

const { W, H } = VIEW;
// the gate: every hoop is judged when it crosses this x, exactly on its beat. it used to be
// judged at the dragon's x, and the dragon could chase the light to x=320, so the first hoop could
// arrive 0.8s into the flight while the screen was still fading in
const REF_X = 150;

export class Flight {
  interactive = true;

  enter(g, data = {}) {
    this.gentle = g.motion.reduced;
    this.d = g.dragon;
    this.me = member(this.d);
    this.follows = `${this.d.name} FOLLOWS YOUR LIGHT`;
    const r = mulberry32(g.rng.int(1, 1e6));
    // the level picked on the attract screen: hoop size, speed, how many move, enemies...
    this.levelId = g.level;
    this.L = LEVELS[this.levelId];
    this.T = this.L.timeline;
    // the swell lands on a bar downbeat near 2/3 of the way through (12s on hatchling)
    const bar = (4 * 60) / MUSIC.BPM;
    this.swellAt = Math.ceil((FLIGHT.SWELL_AT * this.T) / bar - 1e-6) * bar;
    this.swellP = this.swellAt / this.T;
    this.ex = REF_X - 30;
    this.ey = data.fromY ? clamp(data.fromY, 80, 200) : 150;
    this.vy = 0;
    this.camX = 0;
    this.loopT = 0;
    this.cheerT = 0;
    this.rollT = 0;
    this.streak = 0;
    this.flapPh = 0;
    this.camY = 0; // gentle vertical follow, in world px
    this.squash = 0;
    this.path = [];
    this.pathT = 0;
    this.trail = [];
    this.swellFired = false;
    // scene objects get reused every run. done used to stay true after the first guest, so every
    // later flight never handed off to home (and never saved the ribbon)
    this.done = false;
    this.windupCued = false;
    this.climbing = false;
    g.audio.section('flightIntro');
    this.swellT = 0;
    this.riseY = 0;
    // two clocks: this.t runs from the start, this.tt (the timeline: hoops, swell, climb) only
    // starts once the tutorial hoop is done, so nobody misses the start while learning to steer
    this.tt = 0;
    this.tutorial = true;
    this.tutT = 0;
    this.points = new Points(this.levelId);
    this.countPop = 0;
    this.prompt = this.follows;
    this.promptT = 0;
    this.stars = makeStars(13, 80, 160);
    // the swell brings out everyone who's already home tonight. nobody home yet = nobody comes,
    // the first dragon of the night does this part on its own
    const { near, far } = flockOf(g.store);
    this.flock = near.reverse().map((d, i) => ({ ...member(d, i), x: -60 - i * 26, y: 50 + ((i * 37) % 160), ox: WEDGE[i][0], oy: WEDGE[i][1], trail: [] }));
    this.distant = far.map((d, i) => ({ d, x: -20 - ((i * 53) % 200), y: 18 + ((i * 29) % 70), ph: i * 1.7, sp: 0.9 + ((i * 7) % 5) * 0.06 }));

    // hoop 1 is the tutorial hoop: it parks above or below the dragon and waits to be flown through.
    // the rest are scheduled on the timeline so each one crosses REF_X exactly on a beat.
    // always the level's hoop count, so every guest on a level gets the same flight
    const beat = 60 / MUSIC.BPM;
    const L = this.L;
    // kept between 110 and 190: higher and the zoomed-in camera pushes it up into the instruction text
    const tutY = clamp(this.ey >= 150 ? this.ey - 62 : this.ey + 62, 110, 190);
    this.rings = [{ tutorial: true, y: tutY, p: 0, rune: 0, state: 'coming', fx: 0, seenAt: 0 }];
    let y = tutY;
    for (let i = 1; i < L.hoops; i++) {
      const at = FLIGHT.FIRST_RING_AT + (i - 1) * L.hoopBeats * beat;
      const p = at / this.T;
      const amp = lerp(40, 65, clamp(p / this.swellP));
      const ny = 140 + Math.sin(i * 1.15 + r() * 0.6) * amp + Math.sin(i * 0.43) * 18;
      // lerp from the last hoop so consecutive hoops are always reachable
      y = clamp(lerp(y, ny, 0.8), 60, 196);
      const ring = { at, y, p, rune: i, state: 'coming', fx: 0 };
      // on the harder levels some hoops bob up and down (kept clear of the top and the sea)
      if (L.moving > 0 && r() < L.moving) {
        ring.y = clamp(y, 60 + L.moveAmp * 0.6, 196 - L.moveAmp * 0.6);
        ring.move = { amp: L.moveAmp, w: L.moveSpeed * Math.PI * 2 * (0.8 + r() * 0.4), ph: r() * Math.PI * 2 };
      }
      this.rings.push(ring);
    }

    // which of the three routes this guest gets. only the scenery changes, the hoops above are
    // laid out before this so every route gets the same flight
    this.routeIndex = g.route % ROUTES.length;
    this.route = ROUTES[this.routeIndex];
    this.route.setup(this, r);

    // enemies, power-ups and gusts for this level (none of it can end the run)
    this.fireT = 0; // seconds of fireball left
    this.speedT = 0;
    this.magnetT = 0;
    this.shield = false;
    this.tumbleT = 0; // tumbling after a bump
    this.safeT = 0; // can't be bumped again yet
    this.push = 0; // a gust's shove, px/sec, fades out
    this.hz = new Hazards(this, Math.floor(r() * 1e9));
  }

  // flew through a power-up orb
  powerUp(g, kind, x, y) {
    const at = this.toScreen(x, y);
    const names = { fireball: 'FIREBALL!', speed: 'SPEED BURST!', shield: 'SHIELD!', magnet: 'MAGNET!', friend: 'FLOCK FRIEND!' };
    this.points.add(SCORE.POWERUP, at.x, at.y, names[kind], POWER_COLORS[kind]);
    if (kind === 'fireball') this.fireT = POWER.FIREBALL;
    else if (kind === 'speed') this.speedT = POWER.SPEED;
    else if (kind === 'magnet') this.magnetT = POWER.MAGNET;
    else if (kind === 'shield') this.shield = true;
    else if (kind === 'friend') this.hz.startFriend(g);
    g.audio.cue('power');
    g.particles.burst(x, y, 24, { speed: 80, colors: [POWER_COLORS[kind], '#ffffff'], kind: 'spark', size: 2, drag: 2.5, life: 0.7 }, g.rng);
  }

  // bumped by an enemy: a tumble, the streak and a few points, never the run
  bump(g, dir, by) {
    if (this.safeT > 0 || this.p > FLIGHT.RISE_AT) return;
    this.safeT = ENEMY.SAFE;
    const at = this.toScreen(this.ex, this.ey);
    if (this.shield) {
      // the bubble takes it instead
      this.shield = false;
      this.points.add(0, at.x, at.y - 10, 'BLOCKED!', '#8ad8ff');
      g.audio.cue('shield');
      g.particles.burst(this.ex, this.ey, 20, { speed: 90, colors: ['#e8f8ff', '#8ad8ff'], kind: 'spark', size: 1, drag: 2, life: 0.6 }, g.rng);
      return;
    }
    this.tumbleT = ENEMY.TUMBLE;
    this.streak = 0;
    this.points.bumps++;
    this.points.add(SCORE.BUMP, at.x, at.y - 10, `WHOA! ${SCORE.BUMP}`);
    this.push += dir * 110;
    g.audio.cue('bump');
    g.cam.shake(2);
  }

  // everyone who's home tonight comes out at the swell: near + far is always the count
  visibleDragons() {
    return { near: this.flock.length, far: this.distant.length, names: this.flock.map((m) => m.d.name) };
  }

  get p() {
    return clamp(this.tt / this.T);
  }
  get conf() {
    return ease.inOutSine(clamp(this.p / this.swellP));
  }
  // 0..1 during the wind-up right before the swell
  get windup() {
    return this.swellFired ? 0 : invLerp(this.swellAt - FLIGHT.SWELL_WINDUP, this.swellAt, this.tt);
  }
  get zoom() {
    const base = lerp(FLIGHT.ZOOM_START, FLIGHT.ZOOM_END, ease.inOutSine(invLerp(0.05, this.swellP + 0.08, this.p)));
    // lean in during the wind-up, then punch out past normal and settle back
    const st = this.swellT ?? 0;
    const punch = this.swellFired ? ease.outCubic(clamp(st / 0.25)) * Math.exp(-st * 1.6) : 0;
    // reduced motion: half the zoom swing, no lean-in or punch
    if (this.gentle) return 1 + (base - 1) * MOTION.ZOOM_SCALE;
    return base * (1 + 0.06 * this.windup - 0.07 * punch);
  }
  ringX(ring) {
    // the tutorial hoop glides in to the dragon's column and stays there
    if (ring.tutorial) return lerp(W + 40, this.ex, ease.outCubic(clamp(this.tutT / FLIGHT.TUT_SLIDE)));
    return REF_X + (ring.at - this.tt) * this.L.scroll;
  }
  ringR(ring) {
    if (ring.tutorial) return this.L.tutR;
    const [a, b] = this.L.ringR;
    return lerp(a, b, ease.inOutSine(clamp(ring.p / FLIGHT.RISE_AT)));
  }
  // where a hoop is up and down right now (the moving ones bob on the timeline clock)
  ringY(ring) {
    return ring.move ? ring.y + ring.move.amp * Math.sin(ring.move.w * this.tt + ring.move.ph) : ring.y;
  }
  // the pointer is in screen space but the dragon lives in the zoomed world
  toWorld(x, y) {
    const z = this.zoom;
    return { x: (x - W / 2) / z + W / 2, y: (y - H / 2) / z + H / 2 + this.camY };
  }
  nextRing() {
    return this.rings.find((r) => r.state === 'coming' && (r.tutorial || this.ringX(r) > REF_X - 4));
  }
  target() {
    const r = this.nextRing();
    if (!r) return { x: W * 0.4, y: H * 0.3 };
    // screen coords, the playwright "guest" steers toward this
    return this.toScreen(REF_X, this.ringY(r));
  }

  skip(g) {
    this.finish(g);
  }
  finish(g) {
    if (this.done) return;
    this.done = true;
    const pts = this.points;
    // what the dragon card and the best-flight board need
    g.lastRun = { flown: true, level: this.levelId, score: pts.score, stars: pts.stars, hits: pts.hits, hoops: this.L.hoops, bumps: pts.bumps, popped: pts.popped };
    g.scenes.go('home', { path: this.path, run: g.lastRun }, { color: '#0a1024' });
  }

  // world (zoomed camera) to screen, for the floating score numbers
  toScreen(x, y) {
    const z = this.zoom;
    return { x: (x - W / 2) * z + W / 2, y: (y - this.camY - H / 2) * z + H / 2 };
  }

  // one instruction at a time, each readable for PROMPT_MIN, then gone for the rest of the flight
  wantPrompt() {
    if (this.prompt === this.follows) return this.promptT >= DUR.PROMPT_MIN ? HOOPS : this.follows;
    if (this.prompt === HOOPS) return !this.tutorial && this.promptT >= DUR.PROMPT_MIN ? null : HOOPS;
    return null;
  }

  update(g, dt) {
    const inp = g.input;
    if (!this.tutorial) this.tt += dt;
    const p = this.p;
    const conf = this.conf;
    // the world drifts slowly during the tutorial so it still feels like flying
    this.camX += this.L.scroll * dt * (this.tutorial ? 0.4 : 1);
    this.promptT += dt;
    const want = this.wantPrompt();
    if (want !== this.prompt && this.promptT >= DUR.PROMPT_MIN) {
      this.prompt = want;
      this.promptT = 0;
    }
    this.countPop = Math.max(0, this.countPop - dt);
    // autopilot only when the pointer is really gone, not just resting for a second
    const gone = inp.idle > INPUT.GONE_AFTER;

    // follow the light. if nobody's pointing, autopilot to the next ring so it still looks good
    const w = this.toWorld(inp.x, inp.y);
    // the dragon mostly steers up and down near the gate, a little sideways play so it feels alive
    let tx = clamp(w.x, REF_X - FLIGHT.X_PLAY, REF_X + FLIGHT.X_PLAY);
    let ty = clamp(w.y, 34, 212);
    const next = this.nextRing();
    if (next) {
      const dx = this.ringX(next) - this.ex;
      // a magnet power-up pulls a lot harder and from further out
      const magnet = this.magnetT > 0 ? POWER.MAGNET_PULL * clamp(1 - dx / 200) : this.L.magnet * clamp(1 - dx / 120);
      const pull = next.tutorial ? 0 : magnet * (gone ? 0 : 1);
      ty = lerp(ty, this.ringY(next), pull);
      if (gone) {
        tx = lerp(this.ex, REF_X, 0.5);
        ty = this.ringY(next);
      }
    }
    if (p > FLIGHT.RISE_AT) {
      ty = 20;
      tx = W * 0.45;
      this.riseY += dt * 150 * ease.inCubic(invLerp(FLIGHT.RISE_AT, 1, p) + 0.2);
    }
    // camera drifts a little toward the dragon so high and low flying both feel framed.
    // the dragon still lands right under the light on screen because toWorld adds camY back
    this.gentle = g.motion.reduced;
    this.camY = approach(this.camY, this.gentle ? 0 : (this.ey - H / 2) * FLIGHT.CAM_FOLLOW, 2, dt);

    // a little looser at first, snappier as the dragon gets confident. tumbling it barely
    // steers, a speed burst makes it snappier still
    const follow = FLIGHT.FOLLOW * lerp(0.85, 1, conf) * (this.tumbleT > 0 ? 0.3 : 1) * (this.speedT > 0 ? POWER.SPEED_STEER : 1);
    let ny = approach(this.ey, ty, follow, dt);
    // a gust (or a bump) shoves it off course for a moment
    ny = clamp(ny + this.push * dt, 30, 214);
    this.push = approach(this.push, 0, 3, dt);
    this.vy = (ny - this.ey) / dt;
    this.ex = approach(this.ex, tx, follow * 0.6, dt);
    this.ey = ny;

    if (this.loopT > 0) this.loopT = Math.max(0, this.loopT - dt);
    this.squash = approach(this.squash, 0, 6, dt);
    this.cheerT = Math.max(0, this.cheerT - dt);
    if (this.rollT > 0) {
      this.rollT = Math.max(0, this.rollT - dt);
      if (g.rng() < dt * 40) g.particles.add({ x: this.ex - 10, y: this.ey + (g.rng() - 0.5) * 16, vx: -60, vy: 0, life: 0.5, color: g.rng() < 0.5 ? PAL.gold2 : this.d.colors.wingLit, kind: 'spark', size: 1 });
    }
    // accumulate the phase, t * speed jumps the wings whenever the speed changes
    this.flapPh += dt * (this.vy < -20 ? 4.5 : lerp(3.6, 2.4, conf));
    updateMember(g, this.me, dt, this.ex, this.ey);

    if (this.tutorial) this.updateTutorial(g, dt);
    g.audio.rain(this.route.rain ? this.route.rain(p) : 0);
    for (const k of ['fireT', 'speedT', 'magnetT', 'tumbleT', 'safeT']) this[k] = Math.max(0, this[k] - dt);
    this.hz.update(g, dt);

    for (const ring of this.rings) {
      if (ring.state !== 'coming') {
        ring.fx += dt;
        continue;
      }
      if (ring.tutorial) continue;
      const rx = this.ringX(ring);
      // when it first shows up on screen (the cold-run test checks every hoop gets real warning)
      if (ring.seenAt === undefined && (rx - W / 2) * this.zoom + W / 2 < W) ring.seenAt = this.t;
      if (rx <= REF_X) {
        ring.gateAt = this.t;
        const r = this.ringR(ring);
        // a little slack so grazing the edge still counts (less of it on the harder levels)
        const hit = Math.abs(this.ey - this.ringY(ring)) < r + this.L.slack;
        this.resolveRing(g, ring, rx, hit);
      }
    }
    this.updateTail(g, dt, p, conf);
  }

  resolveRing(g, ring, rx, hit) {
    const r = this.ringR(ring);
    ring.state = hit ? 'hit' : 'miss';
    ring.beat = g.beat.beat; // the music test checks these land on the beat
    ring.hitX = rx;
    ring.hitY = this.ringY(ring);
    const gold = ring.p > FLIGHT.WOBBLY_UNTIL;
    if (hit) {
      this.countPop = 0.4;
      this.squash = 1;
      this.cheerT = 0.4;
      // every 3 in a row earns a barrel roll
      this.streak++;
      if (this.streak % 3 === 0) this.rollT = 0.7;
      const at = this.toScreen(rx, ring.hitY);
      this.points.hoop(at.x, at.y, this.streak, Math.abs(this.ey - ring.hitY) < r * SCORE.PERFECT_ZONE, this.speedT > 0 ? 2 : 1);
      g.audio.cue('ring');
      g.cam.shake(1 + ring.p * 2);
      g.particles.burst(rx, ring.hitY, 26 + Math.round(ring.p * 20), { speed: 80 + ring.p * 60, colors: gold ? [PAL.gold, PAL.gold2, '#fff6d8'] : ['#bff8ee', PAL.teal, '#ffffff'], kind: 'spark', size: 2, drag: 2.5, life: 0.8 }, g.rng);
    } else {
      // a miss is never a fail: the dragon does a loop and the ring's sparkles fly into it anyway
      g.audio.cue('miss');
      this.points.misses++;
      this.loopT = 0.75;
      this.streak = 0;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        g.particles.add({ x: rx + Math.cos(a) * r, y: ring.hitY + Math.sin(a) * r, vx: (this.ex - rx) * 1.6, vy: (this.ey - ring.hitY) * 1.6, life: 0.6, color: gold ? PAL.gold2 : '#bff8ee', kind: 'spark', size: 1, drag: 0.5 });
      }
    }
  }

  // the tutorial hoop waits at the dragon's column until you steer through it (or TUT_CAP runs out)
  updateTutorial(g, dt) {
    this.tutT += dt;
    const ring = this.rings[0];
    if (ring.state !== 'coming') return;
    const parked = this.tutT >= FLIGHT.TUT_SLIDE;
    // counts as soon as the dragon's middle is inside the hoop. at 80% of the radius, the dragon visibly
    // overlapped the hoop and still didn't count, which read as "it's broken"
    const inside = Math.abs(this.ey - ring.y) < this.L.tutR;
    if ((parked && inside) || this.tutT >= FLIGHT.TUT_CAP) {
      ring.gateAt = this.t;
      this.resolveRing(g, ring, this.ringX(ring), parked && inside);
      this.tutorial = false;
      // the timeline snaps to the nearest beat (at most a quarter second early or late) so every
      // hoop and the swell land right on the music. waiting for the next beat instead added up
      // to half a second to every run
      const per = g.beat.period;
      const since = g.beat.phase * per;
      this.tt = since <= per / 2 ? since : since - per;
      g.audio.section('flight', { zeroBeat: Math.round(g.beat.beat - this.tt / per), lead: 2 });
    }
  }

  updateTail(g, dt, p, conf) {
    if (!this.windupCued && this.windup > 0) {
      this.windupCued = true;
      g.audio.cue('windup');
    }
    if (!this.climbing && p > FLIGHT.RISE_AT) {
      this.climbing = true;
      g.audio.section('climb', { keep: true });
      // no bumps and at most one missed hoop
      if (this.points.clean) this.points.add(SCORE.CLEAN, W / 2, 150, `CLEAN FLYING +${SCORE.CLEAN}`, PAL.teal);
    }
    this.points.update(dt);
    if (!this.swellFired && this.tt >= this.swellAt) {
      this.swellFired = true;
      this.swellT = 0;
      this.swellBeat = g.beat.beat;
      this.swellX = this.ex;
      this.swellY = this.ey;
      g.cam.shake(4);
      g.audio.cue('swell');
      // everyone who's home calls out as they swoop in
      this.flock.forEach((f, i) => chirp(f, 0.35 + i * 0.11));
      // gold confetti over the whole screen
      for (let i = 0; i < 70; i++) {
        const r = g.rng;
        g.particles.add({ x: r() * W, y: -10 - r() * 50, vx: (r() - 0.5) * 30, vy: 40 + r() * 60, grav: 30, drag: 0.5, life: 2.4, color: [PAL.gold, PAL.gold2, PAL.cream, PAL.teal][Math.floor(r() * 4)], kind: r() < 0.3 ? 'spark' : 'px', size: 2, layer: 1 });
      }
    }
    if (this.swellFired) this.swellT += dt;
    for (const f of this.flock) {
      const on = this.swellFired;
      const tx2 = on ? this.ex + f.ox : -80;
      const ty2 = on ? this.ey + f.oy + Math.sin(this.t * 2 + f.i) * 5 : f.y;
      f.x = approach(f.x, tx2, on ? 2.2 - Math.min(f.i, 8) * 0.18 : 1, dt);
      f.y = approach(f.y, ty2, 2.4 - Math.min(f.i, 8) * 0.2, dt);
      updateMember(g, f, dt, f.x, f.y, { scale: 0.72 });
      // light trails so the swoop-in reads from across the room
      if (on) {
        f.trail.push({ x: this.camX + f.x, y: f.y });
        if (f.trail.length > 40) f.trail.shift();
      }
    }

    this.trail.push({ x: this.camX + this.ex, y: this.ey });
    if (this.trail.length > 90) this.trail.shift();
    if (!this.tutorial) this.pathT -= dt;
    if (this.pathT <= 0) {
      this.pathT = this.T / 48; // ~48 points is plenty for a ribbon and keeps localStorage small
      this.path.push([p, clamp(this.ey / H)]);
    }

    if (g.rng() < dt * (4 + conf * 10)) {
      g.particles.add({ x: W / 2 + (g.rng() - 0.5) * W * 1.2, y: g.rng() * H * 0.8, vx: -this.L.scroll * 0.6, vy: 0, life: 1.4, color: conf > 0.5 ? PAL.gold2 : '#bfe8ff', kind: 'px', size: 1, layer: 1 });
    }

    if (this.tt >= this.T) this.finish(g);
  }

  draw(g, ctx) {
    const t = this.t;
    const p = this.p;
    const conf = this.conf;
    const rise = invLerp(FLIGHT.RISE_AT, 1, p);
    const swell = this.swellFired ? clamp(this.swellT / 1.2) : 0;

    const route = this.route;
    const s = { t, p, conf, rise, swell, windup: this.windup };
    // the route's sky: clouds, sun or moon, and how it changes over the flight
    route.sky(ctx, this, g, s);

    // dragons from earlier tonight that don't fit up close, out in the far sky
    if (this.swellFired) {
      const k = ease.outCubic(clamp(this.swellT / 2.5));
      for (const f of this.distant) {
        const x = lerp(f.x, 30 + ((f.ph * 97) % 420), k) + Math.sin(t * 0.7 * f.sp + f.ph) * 6;
        drawSpeck(ctx, x, f.y + Math.sin(t * 1.3 + f.ph) * 3 + this.riseY * 0.3, f.d, t);
      }
    }

    // sea, land and islands drop away during the climb
    ctx.save();
    ctx.translate(0, Math.round(this.riseY - this.camY * this.zoom));
    route.ground(ctx, this, g, s);
    ctx.restore();

    drawWind(ctx, t, g.beat, { lanes: [0.2, 0.46, 0.7], alpha: 0.25 + conf * 0.2 + swell * 0.2, color: route.wind(conf), speed: 160, thick: this.swellFired });

    // camera starts close and pulls back as the dragon gets confident. sky and sea stay unzoomed
    // because they're full-width cached images and would show their edges
    const z = this.zoom;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2 + this.riseY - this.camY);

    route.mid(ctx, this, g, s);
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2 - this.camY);
    this.drawTrail(ctx, conf);
    for (const ring of this.rings) this.drawRing(g, ctx, ring);
    this.hz.draw(ctx, t);
    for (const f of this.flock) {
      for (let i = 1; i < f.trail.length; i++) {
        const k = i / f.trail.length;
        ctx.globalAlpha = k * 0.6;
        ctx.fillStyle = f.d.colors.wingLit;
        ctx.fillRect(Math.round(f.trail[i].x - this.camX - 10), Math.round(f.trail[i].y + 3), 2, 1 + Math.round(k * 2));
      }
      ctx.globalAlpha = 1;
    }
    if (this.swellFired && this.swellT < 1.2) {
      // shockwave rings, gold then teal
      for (const [delay, color] of [[0, PAL.gold], [0.15, PAL.teal]]) {
        const k = clamp((this.swellT - delay) / 0.9);
        if (k <= 0 || k >= 1) continue;
        ctx.globalAlpha = 1 - k;
        drawKnotRing(ctx, this.swellX, this.swellY, 20 + ease.outCubic(k) * 300, 1, { lobes: 16, amp: 5, width: 2, on: color });
        ctx.globalAlpha = 1;
      }
    }
    for (let i = this.flock.length - 1; i >= 0; i--) {
      const f = this.flock[i];
      if (f.x < -50) continue;
      drawMember(ctx, f, f.x, f.y, { mood: 'fly', flap: t * 2.6 + f.i * 0.21, life: t, glow: 2, scale: 0.72, rot: Math.sin(t * 2 + f.i) * 0.06 });
    }
    this.drawFlyer(g, ctx, t, conf);
    g.particles.draw(ctx, 0);
    ctx.restore();
    g.particles.draw(ctx, 1);
    route.front(ctx, this, g, s);
    this.hz.drawGusts(ctx, t);

    this.drawJourney(ctx, p, t);
    this.drawCounter(ctx);
    this.drawScore(ctx);
    this.points.drawPopups(ctx);
    if (this.prompt) {
      drawText(ctx, this.prompt, W / 2, 30, { scale: fitScale(this.prompt, W - 10), align: 'center', color: PAL.cream, alpha: clamp(this.promptT / 0.25) });
    }
    this.drawGuides(ctx, g.input.x, g.input.y, t);
    if (this.swellFired && this.swellT < 0.4) {
      // one soft flash, only once (photosensitivity)
      ctx.fillStyle = `rgba(255,226,138,${0.3 * g.motion.flash * (1 - this.swellT / 0.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.swellFired && this.swellT < 2.2) {
      const a = clamp((2.2 - this.swellT) * 2);
      drawTextPop(ctx, 'SOAR!', W / 2 + 14, 40, this.swellT * 1.4, { scale: 5, color: PAL.gold2, alpha: a });
      ctx.globalAlpha = a;
      drawHorn(ctx, W / 2 - 88, 40, 2);
      drawSoundLines(ctx, W / 2 - 64, 40, 1, t, PAL.gold2);
      ctx.globalAlpha = 1;
    }
    if (rise > 0.1) drawText(ctx, 'HOME IS UP THERE', W / 2, 236, { scale: 2, align: 'center', color: '#bff8ee', alpha: clamp(rise * 3) });

    if (this.prompt !== this.follows) this.drawTether(ctx, g.input.x, g.input.y, t);
    drawCursorLight(ctx, g.input.x, g.input.y, t, 1);
  }

  // teaching arrows: light -> dragon while "PIP FOLLOWS YOUR LIGHT" is up, then a bouncing
  // chevron from the dragon toward the tutorial hoop while it's waiting
  drawGuides(ctx, lx, ly, t) {
    const e = this.toScreen(this.ex, this.ey);
    if (this.prompt === this.follows) {
      const d = Math.hypot(e.x - lx, e.y - ly);
      if (d > 30) {
        const ux = (e.x - lx) / d;
        const uy = (e.y - ly) / d;
        ctx.fillStyle = PAL.gold2;
        for (let s = 10 + ((t * 40) % 8); s < d - 30; s += 8) ctx.fillRect(Math.round(lx + ux * s) - 1, Math.round(ly + uy * s) - 1, 3, 3);
        // arrowhead pointing at the dragon
        const hx = e.x - ux * 26;
        const hy = e.y - uy * 26;
        for (let i = 0; i < 7; i++) {
          const w = 7 - i;
          ctx.fillRect(Math.round(hx - ux * i - uy * w), Math.round(hy - uy * i + ux * w), 2, 2);
          ctx.fillRect(Math.round(hx - ux * i + uy * w), Math.round(hy - uy * i - ux * w), 2, 2);
        }
      }
    }
    const tut = this.rings[0];
    if (this.tutorial && this.tutT >= FLIGHT.TUT_SLIDE && tut.state === 'coming') {
      const hy = this.toScreen(0, tut.y).y;
      const dir = Math.sign(hy - e.y);
      if (Math.abs(hy - e.y) > 24) {
        const bob = Math.sin(t * 8) * 3;
        const cy = (e.y + hy) / 2 + bob * dir;
        ctx.fillStyle = PAL.gold2;
        for (let k = 0; k < 2; k++) {
          for (let i = 0; i < 6; i++) {
            const yy = Math.round(cy + dir * (k * 7 + i)); // tip of the V points at the hoop
            ctx.fillRect(Math.round(e.x - 6 + i), yy, 2, 2);
            ctx.fillRect(Math.round(e.x + 6 - i), yy, 2, 2);
          }
        }
      }
    }
  }

  // score in the top left corner, with the stars earned so far filling in as you go, and
  // whatever power-up is running with a bar for how long it has left
  drawScore(ctx) {
    const pts = this.points;
    const stars = pts.stars;
    for (let i = 0; i < 3; i++) drawStarIcon(ctx, 10 + i * 12, 12, i < stars, 1);
    const pop = pts.pop > 0 ? 1 + Math.sin((pts.pop / 0.35) * Math.PI) * 0.25 : 1;
    drawText(ctx, String(pts.score), 46, 6, { scale: 2, color: PAL.gold2, alpha: 1 });
    if (pop > 1.01) drawText(ctx, String(pts.score), 46, 6, { scale: 2, color: '#ffffff', alpha: (pop - 1) * 3 });
    const running = [['fireball', this.fireT, POWER.FIREBALL], ['speed', this.speedT, POWER.SPEED], ['magnet', this.magnetT, POWER.MAGNET], ['shield', this.shield ? 1 : 0, 1]].filter(([, v]) => v > 0);
    running.forEach(([kind, v, max], i) => {
      const x = 12 + i * 26;
      glow(ctx, x, 32, 10, POWER_COLORS[kind], 0.5);
      drawPowerIcon(ctx, kind, x, 32, this.t);
      ctx.fillStyle = POWER_COLORS[kind];
      ctx.fillRect(x - 8, 41, Math.round(16 * (v / max)), 2);
    });
  }

  // "3 / 8" up in the corner with a little hoop, pops when you get one
  drawCounter(ctx) {
    const pop = this.countPop > 0 ? 1 + Math.sin((this.countPop / 0.4) * Math.PI) * 0.3 : 1;
    const label = `${this.points.hits} / ${this.L.hoops}`;
    drawKnotRing(ctx, 412, 14, 7 * pop, 1, { lobes: 5, amp: 1.5, width: 1, on: PAL.gold });
    drawTextPop(ctx, label, 446, 14, 1, { scale: Math.round(2 * pop) || 2, color: PAL.gold2 });
  }

  // lighthouse -> home track across the top. someone who glances over mid-flight gets
  // "it's flying home" without reading anything
  drawJourney(ctx, p, t) {
    const x0 = 150, x1 = 330, y = 13;
    const px = Math.round(lerp(x0, x1, p));
    drawKnotBand(ctx, x0, y, x1 - x0, { color: 'rgba(255,243,214,0.5)' });
    if (px > x0) drawKnotBand(ctx, x0, y, px - x0);
    // tiny lighthouse
    ctx.fillStyle = '#e8e0cc';
    ctx.fillRect(x0 - 16, y - 6, 5, 12);
    ctx.fillStyle = '#46546e';
    ctx.fillRect(x0 - 16, y - 2, 5, 3);
    ctx.fillStyle = PAL.gold2;
    ctx.fillRect(x0 - 16, y - 9, 5, 3);
    glow(ctx, x0 - 14, y - 8, 7, PAL.gold, 0.7);
    // home: three stones under an aurora arc
    const hx = x1 + 14;
    glow(ctx, hx, y - 4, 12, PAL.teal, 0.35 + 0.25 * Math.sin(t * 2));
    ctx.fillStyle = PAL.teal;
    for (let i = -6; i <= 6; i++) ctx.fillRect(hx + i, y - 7 + Math.round((i * i) / 12), 1, 2);
    ctx.fillStyle = '#56698a';
    for (const [dx, h] of [[-5, 6], [0, 8], [5, 6]]) ctx.fillRect(hx + dx - 1, y + 5 - h, 3, h);
    // the dragon's marker, in its own colors: body, wing, one eye
    const bob = Math.round(Math.sin(t * 6) * 1);
    ctx.fillStyle = this.d.colors.wingLit;
    ctx.fillRect(px - 4, y - 6 + bob, 4, 3);
    ctx.fillStyle = this.d.colors.body;
    ctx.fillRect(px - 3, y - 3 + bob, 7, 6);
    ctx.fillRect(px + 3, y - 4 + bob, 3, 4);
    ctx.fillStyle = '#1b1030';
    ctx.fillRect(px + 4, y - 3 + bob, 1, 1);
  }

  // dotted light from the guest's light to the dragon when they drift apart, so it's obvious
  // the dragon is following YOU
  drawTether(ctx, x, y, t) {
    const { x: ex, y: ey } = this.toScreen(this.ex, this.ey);
    const d = Math.hypot(ex - x, ey - y);
    if (d < 28 || this.p > FLIGHT.RISE_AT) return;
    const a = clamp((d - 28) / 40) * 0.6;
    ctx.fillStyle = PAL.gold2;
    const off = (t * 40) % 7;
    for (let s = off; s < d - 14; s += 7) {
      const k = s / d;
      ctx.globalAlpha = a * (1 - k * 0.5);
      ctx.fillRect(Math.round(x + (ex - x) * k), Math.round(y + (ey - y) * k), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  drawRing(g, ctx, ring) {
    const x = this.ringX(ring);
    const r = this.ringR(ring);
    if (x > W / 2 + (W / 2) / this.zoom + r + 10) return;
    const gold = invLerp(FLIGHT.WOBBLY_UNTIL * 0.6, this.swellP, ring.p);
    const ry = this.ringY(ring);
    const color = mix('#bff8ee', PAL.gold, gold);
    // a fog wisp sitting on it makes it hard to see for a moment
    if (ring.hidden) ctx.globalAlpha = 0.2;
    if (ring.state === 'coming') {
      const pulse = 1 + g.beat.pulse * 0.06;
      // the waiting tutorial hoop breathes so it's obviously the thing to aim for
      if (ring.tutorial) glow(ctx, x, ry, r * 2.2, PAL.teal, 0.25 + 0.2 * Math.sin(this.t * 5));
      glow(ctx, x, ry, r * 1.6, gold > 0.5 ? PAL.gold : PAL.teal, 0.25 + 0.15 * g.beat.pulse);
      drawKnotRing(ctx, x, ry, r * pulse, 1, { lobes: 6 + Math.round(gold * 4), amp: Math.min(2 + r * 0.08, r * 0.2), width: 2, on: color });
      drawRune(ctx, x, ry, Math.max(6, r * 0.55), ring.rune, mix('#e8fffb', PAL.gold2, gold), 1);
      // little up/down ticks on the bobbing ones so it reads as "this one moves"
      if (ring.move) {
        ctx.fillStyle = color;
        for (const dir of [-1, 1]) for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(x - 2 + k), Math.round(ry + dir * (r + 6 + k)), 5 - k * 2, 1);
      }
    } else if (ring.fx < 0.5) {
      const k = ring.fx / 0.5;
      ctx.globalAlpha = 1 - k;
      const rr = ring.state === 'hit' ? r * (1 + ease.outCubic(k) * 1.2) : r * (1 - k);
      // a zapped hoop goes grey as it shrinks away
      drawKnotRing(ctx, ring.hitX - ring.fx * this.L.scroll, ring.hitY, Math.max(2, rr), 1, { lobes: 8, amp: 2, width: 2, on: ring.state === 'zapped' ? '#8a96b8' : color });
    }
    ctx.globalAlpha = 1;
  }

  drawTrail(ctx, conf) {
    // this trail is what becomes the aurora ribbon at home, so it should look like one
    const tr = this.trail;
    for (let i = 1; i < tr.length; i++) {
      const k = i / tr.length;
      const x = tr[i].x - this.camX - 12;
      const y = tr[i].y + 3 + Math.sin(i * 0.5 + this.t * 6) * (1 - k) * 2;
      const w = 1 + Math.round(k * 3);
      ctx.globalAlpha = k * (0.45 + conf * 0.45);
      // a speed burst leaves a rainbow trail
      ctx.fillStyle = this.speedT > 0 ? RAINBOW[Math.floor(i / 4 + this.t * 10) % RAINBOW.length] : mix(PAL.teal, PAL.gold2, clamp(k * 0.5 + conf * 0.6));
      ctx.fillRect(Math.round(x), Math.round(y - w / 2), 2, w);
    }
    ctx.globalAlpha = 1;
  }

  drawFlyer(g, ctx, t, conf) {
    const wob = FLIGHT.WOBBLE * (1 - conf);
    const wx = Math.sin(t * 9.3) * wob * 0.5;
    const wy = Math.sin(t * 7.1) * wob + Math.sin(t * 13) * wob * 0.3;
    let rot = clamp(this.vy * 0.004, -0.5, 0.5) + Math.sin(t * 6) * 0.15 * (1 - conf);
    let x = this.ex + wx;
    let y = this.ey + wy;
    if (this.loopT > 0) {
      const k = 1 - this.loopT / 0.75;
      rot = -k * Math.PI * 2;
      y -= Math.sin(k * Math.PI) * 18;
      x += Math.sin(k * Math.PI * 2) * 8;
    }
    const s = this.squash;
    let sy = 1 - s * 0.2;
    let sxw = 1 + s * 0.25;
    // "breath in" before the swell
    const w = this.windup;
    sy *= 1 - 0.1 * w;
    sxw *= 1 + 0.08 * w;
    if (this.cheerT > 0) y -= Math.sin((this.cheerT / 0.4) * Math.PI) * 5; // little hop
    // barrel roll: squash the body through zero and out upside down, reads as a roll in 2d
    if (this.rollT > 0) sy *= Math.cos((1 - this.rollT / 0.7) * Math.PI * 2);
    // bumped: a dizzy tumble (just a wobble in reduced motion)
    const tumble = this.tumbleT > 0 ? 1 - this.tumbleT / ENEMY.TUMBLE : 0;
    if (this.tumbleT > 0) rot += this.gentle ? Math.sin(tumble * Math.PI * 4) * 0.35 : tumble * Math.PI * 2;
    let mood = 'fly';
    if (this.tumbleT > 0) mood = 'scared';
    else if (this.loopT > 0 || this.rollT > 0) mood = 'joy';
    else if (this.cheerT > 0) mood = 'happy';
    const glide = this.vy > 60 && conf > 0.4;
    glow(ctx, x - 6, y - 6, 26, this.d.colors.wingLit, 0.3 + conf * 0.2);
    if (this.fireT > 0) {
      // fired up: a warm glow and little flames at its mouth
      glow(ctx, x + 6, y - 4, 22, PAL.amber, 0.45);
      if (Math.floor(t * 12) % 2 === 0) drawPowerIcon(ctx, 'fireball', x + 22 * this.d.size, y - 7, t);
    }
    // its quirk goes on top, except while it's busy with a hoop trick or tumbling
    const busy = this.loopT > 0 || this.rollT > 0 || this.tumbleT > 0;
    const o = { mood, glow: 2, rot, sx: sxw, sy, life: t, ...(glide ? { wing: 'mid' } : { flap: this.flapPh }) };
    if (busy) drawDragon(ctx, x, y, this.d, o);
    else drawMember(ctx, this.me, x, y, o);
    if (this.shield) {
      // a bubble that shimmers around it until it takes a hit
      ctx.fillStyle = '#c8f0ff';
      for (let a = 0; a < Math.PI * 2; a += 0.12) {
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(a * 3 + t * 4);
        ctx.fillRect(Math.round(x + Math.cos(a) * 22), Math.round(y - 4 + Math.sin(a) * 19), 1, 1);
      }
      ctx.globalAlpha = 1;
      glow(ctx, x - 8, y - 14, 6, '#ffffff', 0.5);
    }
  }
}
