// everything in the flight that isn't a hoop: enemies, hatchling's puffs, power-up orbs, fireballs,
// the flock friend and storm rider's gusts. none of it can end a run, a bump is just a tumble
import { VIEW, PAL, ENEMY, POWER, SCORE, FLIGHT } from '../config.js';
import { clamp, lerp, mulberry32, approach, dist } from './util.js';
import { drawGrumpyCloud, drawGustSprite, drawFogWisp, drawPuff, drawOrb, drawFireball } from '../art/critters.js';
import { drawMember, chirp } from '../art/flock.js';

const { W, H } = VIEW;
const SPAWN_X = W + 40;
const GATE = 150; // where the hoops cross on the beat (REF_X in Flight.js)

// drops what fails ok() from the list in place (a new array every step was garbage)
function keep(list, ok) {
  let j = 0;
  for (const it of list) if (ok(it)) list[j++] = it;
  list.length = j;
}

// lives in the same world coordinates as the hoops
export class Hazards {
  constructor(f, seed) {
    this.f = f;
    const r = (this.r = mulberry32(seed));
    const L = f.L;
    this.list = [];
    this.shots = [];
    this.queue = [];
    this.gusts = [];
    this.friend = null;
    this.fireT = 0; // time to the next fireball
    this.spawned = []; // what showed up, in order (the tests read it)
    // things show up after the first hoop is on its way, are gone before the climb, and keep
    // clear of the swell
    const t0 = 2.0;
    const t1 = f.T * FLIGHT.RISE_AT - 2.0;
    const slots = (n, phase) => Array.from({ length: n }, (_, i) => lerp(t0, t1, (i + phase) / Math.max(1, n)));
    const clear = (at) => (Math.abs(at - f.swellAt) < 1.0 ? f.swellAt + 1.2 : at);
    const kinds = [];
    for (const [k, n] of Object.entries(L.enemies)) for (let i = 0; i < n; i++) kinds.push(k);
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    let clouds = 0;
    slots(kinds.length, 0.5).forEach((at, i) => {
      const e = { at: clear(at + (r() - 0.5) * 0.6), kind: kinds[i] };
      // clouds take turns: one guards a hoop, the next sits on one and zaps it. the guards take
      // turns too, above the hoop then below the next one
      if (e.kind === 'cloud') {
        const n = clouds++;
        e.zapper = n % 2 === 1;
        e.side = (n >> 1) % 2 ? 1 : -1;
      }
      this.queue.push(e);
    });
    slots(L.puffs, 0.3).forEach((at) => this.queue.push({ at: clear(at), kind: 'puff', y: 60 + r() * 140 }));
    // a flock friend needs somebody at home to send. first guest of the night gets a fireball
    const ups = L.powerups.map((k) => (k === 'friend' && !f.flock.length ? 'fireball' : k));
    slots(ups.length, 0.4).forEach((at, i) => this.queue.push({ at: clear(at), kind: 'orb', power: ups[i] }));
    slots(L.gusts, 0.7).forEach((at) => this.gusts.push({ at: clear(at), dir: r() < 0.5 ? -1 : 1, fired: false }));
    this.queue.sort((a, b) => a.at - b.at);
  }

  // the next hoop that's somewhere in [x0, x1] right now
  ringIn(x0, x1) {
    const f = this.f;
    return f.rings.find((ring) => !ring.tutorial && ring.state === 'coming' && !ring.taken && f.ringX(ring) > x0 && f.ringX(ring) < x1);
  }

  // how far an enemy has to stay above or below a hoop's middle so its bump circle stays out of
  // the opening
  clearOf(ring) {
    return this.f.ringOpen(ring) + ENEMY.HIT_R + ENEMY.CLEAR;
  }
  // a zapper sits on top of its hoop, a guard above or below it
  sideOf(it) {
    return it.zapper ? -1 : (it.side ?? -1);
  }

  spawn(e) {
    const f = this.f;
    const s = f.L.scroll;
    const it = { kind: e.kind, x: SPAWN_X, y: 130, vx: -s, t: 0, alpha: 1 };
    if (e.kind === 'cloud') {
      // a zapper needs its hoop further out, to settle on it and charge up in plain view
      it.ring = e.zapper ? this.ringIn(480, 760) : this.ringIn(330, 600);
      it.zapper = e.zapper;
      it.side = e.side;
      if (it.ring) {
        it.ring.taken = true;
        // it comes in level with its hoop and on its own side of it, so it never crosses the opening
        it.x = Math.max(SPAWN_X, f.ringX(it.ring));
        it.y = f.ringY(it.ring) + this.sideOf(it) * (this.clearOf(it.ring) + 10);
      } else it.y = 60 + this.r() * 120;
      it.vx = -s * 0.6;
    } else if (e.kind === 'gust') {
      it.y = clamp(f.ey + (this.r() - 0.5) * 70, 50, 205);
      it.vx = -s * 0.8 - 30;
    } else if (e.kind === 'wisp') {
      it.ring = this.ringIn(300, 600);
      if (it.ring) it.ring.taken = true;
      it.y = 40;
    } else if (e.kind === 'puff') {
      it.y = e.y;
      it.vx = -s * 0.65;
    } else if (e.kind === 'orb') {
      it.power = e.power;
      // it crosses the gate exactly halfway between two hoops, at a height between theirs, so
      // it's a small detour and never sits on top of a hoop
      // (the first gap that's still off screen to the right, so it never pops in on screen)
      const cross = f.tt + (SPAWN_X - GATE) / s;
      const rs = f.rings.filter((ring) => !ring.tutorial);
      let i = rs.findIndex((ring, k) => k + 1 < rs.length && (ring.at + rs[k + 1].at) / 2 >= cross);
      if (i < 0) i = Math.max(0, rs.length - 2);
      const a = rs[i];
      const b = rs[Math.min(i + 1, rs.length - 1)];
      it.x = GATE + Math.max((a.at + b.at) / 2 - f.tt, (SPAWN_X - GATE) / s) * s;
      it.y = clamp((a.y + b.y) / 2 + (this.r() - 0.5) * 30, 55, 200);
    }
    this.list.push(it);
    this.spawned.push(e.kind === 'orb' ? e.power : e.kind);
  }

  update(g, dt) {
    const f = this.f;
    while (this.queue.length && f.tt >= this.queue[0].at && !f.tutorial) this.spawn(this.queue.shift());
    for (const e of this.gusts) {
      if (!e.fired && f.tt >= e.at + ENEMY.GUST_WARN) {
        e.fired = true;
        f.push += e.dir * f.L.gustPush;
        g.audio.cue('gust');
      }
    }
    for (const it of this.list) {
      it.t += dt;
      if (it.popT !== undefined) {
        it.popT += dt;
        continue;
      }
      if (it.kind === 'cloud') this.updateCloud(g, it, dt);
      else if (it.kind === 'wisp') this.updateWisp(g, it, dt);
      else {
        it.x += it.vx * dt;
        // a gust sprite drifts toward the dragon's height, but not in the last stretch, so it can be dodged
        if (it.kind === 'gust') it.y = (it.x - f.ex > ENEMY.HOME_UNTIL ? approach(it.y, f.ey, 0.35, dt) : it.y) + Math.sin(it.t * 4) * 0.6;
      }
      const enemy = it.kind === 'cloud' || it.kind === 'gust';
      if (enemy && !(it.kind === 'cloud' && it.ring && !it.done)) this.keepClear(it, dt);
      // how long it's been on screen: an enemy gathers for ENEMY.WARN first and can't bump until then
      if (it.warm !== undefined) it.warm += dt;
      else if ((it.x - W / 2) * f.zoom + W / 2 < W + 4) it.warm = 0;
      // touching the dragon
      const d = dist(it.x, it.y, f.ex, f.ey);
      if (it.kind === 'orb' && d < POWER.REACH + 8) {
        it.popT = 0;
        f.powerUp(g, it.power, it.x, it.y);
      } else if (enemy && d < ENEMY.HIT_R && it.warm >= ENEMY.WARN) {
        f.bump(g, Math.sign(f.ey - it.y) || 1, it);
        if (it.kind === 'gust') this.pop(g, it, 0); // a gust sprite spends itself on the shove
      } else if ((it.kind === 'puff' || it.kind === 'wisp') && d < ENEMY.HIT_R && !it.touched) {
        // harmless: a giggle and some sparkles
        it.touched = true;
        g.particles.burst(it.x, it.y, 10, { speed: 50, colors: ['#ffffff', PAL.cream], kind: 'spark', size: 1, drag: 3, life: 0.5 }, g.rng);
        if (it.kind === 'wisp') {
          this.release(it);
          it.leaving = true;
        }
      }
    }
    // fog thins out again once its wisp has gone
    for (const ring of f.rings) if (ring.fog > 0 && !ring.hidden) ring.fog = Math.max(0, ring.fog - dt / ENEMY.WISP_GATHER);
    keep(this.list, (it) => it.x > -40 && it.alpha > 0.02 && !(it.popT > 0.5));
    this.updateFire(g, dt);
    this.updateFriend(g, dt);
  }

  // an enemy's bump circle stays out of every hoop's opening, and out of the stretch the dragon
  // flies just before and after it. so there's always a way through, even if getting lined up for
  // it is harder. a bit further out than that it already starts sliding clear, so it's clear in
  // time, and a bobbing hoop just carries it along (sliding, a storm hoop could catch up with it)
  keepClear(it, dt) {
    const f = this.f;
    const front = ENEMY.APPROACH * f.L.scroll + 40;
    for (const ring of f.rings) {
      if (ring.tutorial || ring.state !== 'coming') continue;
      const dx = it.x - f.ringX(ring);
      if (dx < -front || dx > ENEMY.HIT_R + 16) continue;
      const y = f.ringY(ring);
      const clear = this.clearOf(ring);
      if (Math.abs(it.y - y) >= clear) continue;
      const want = y + (it.y < y ? -clear : clear);
      it.y = Math.abs(it.y - want) < 6 ? want : approach(it.y, want, 10, dt);
    }
  }

  updateCloud(g, it, dt) {
    const f = this.f;
    const ring = it.ring;
    if (ring && ring.state === 'coming' && !it.done) {
      // fly to the hoop and stay with it, moving ones too: the guard just in front of it, above or
      // below the opening, the zapper on top of it. either way its bump circle stays out of the opening
      const rx = f.ringX(ring);
      const ry = f.ringY(ring);
      if (it.ox === undefined) {
        it.ox = it.x - rx;
        it.oy = it.y - ry;
      }
      const k = 1 - Math.exp(-dt * 5);
      it.ox += ((it.zapper ? 0 : -16) - it.ox) * k;
      it.oy += (this.sideOf(it) * this.clearOf(ring) - it.oy) * k;
      it.x = rx + it.ox;
      it.y = ry + it.oy;
      // the zapper charges up in full view for ENEMY.ZAP_CHARGE, timed to zap when the hoop is
      // ENEMY.ZAP_LEAD ahead of the gate. a dragon that flies ahead to meet the hoop gets there
      // first, or a fireball or a flock friend pops the cloud. (if it settled late it still charges in full)
      const left = (rx - GATE - ENEMY.ZAP_LEAD) / f.L.scroll;
      if (it.zapper && Math.abs(it.ox) < 8 && (it.zapT !== undefined || left <= ENEMY.ZAP_CHARGE)) {
        if (it.zapT === undefined) g.audio.cue('charge');
        it.zapT = (it.zapT ?? 0) + dt;
        ring.charge = clamp(it.zapT / ENEMY.ZAP_CHARGE);
        if (it.zapT >= ENEMY.ZAP_CHARGE) {
          // zap: the hoop goes poof. not the guest's fault, so it doesn't count as a miss
          ring.state = 'zapped';
          ring.hitX = rx;
          ring.hitY = ry;
          ring.fx = 0;
          it.done = true;
          it.boltT = 0;
          const at = f.toScreen(rx, ry);
          f.points.add(0, at.x, at.y - 10, 'ZAPPED!', '#bfcfff');
          g.audio.cue('zap');
          g.particles.burst(ring.hitX, ring.hitY, 16, { speed: 60, colors: [PAL.gold2, '#bfefff'], kind: 'spark', size: 1, drag: 2, life: 0.6 }, g.rng);
        }
      }
    } else {
      // its hoop is gone: flown through first (a charging zapper says so), or zapped
      if (!it.done && it.zapT > 0 && ring.state === 'hit') {
        const at = f.toScreen(ring.hitX, ring.hitY);
        f.points.add(0, at.x, at.y - 22, 'SAVED!', PAL.teal);
      }
      if (!it.done) this.release(it);
      it.done = true;
      it.x += -f.L.scroll * 0.6 * dt;
    }
    if (it.boltT !== undefined) it.boltT += dt;
  }

  updateWisp(g, it, dt) {
    const f = this.f;
    const ring = it.ring;
    if (ring && ring.state === 'coming' && !it.leaving) {
      const tx = f.ringX(ring);
      this.chase(it, tx, f.ringY(ring), 6, dt);
      if (Math.abs(it.x - tx) < 10) {
        it.sat = (it.sat ?? 0) + dt;
        // the fog thickens over ENEMY.WISP_GATHER, so the hoop never just vanishes
        ring.hidden = true;
        ring.fog = Math.min(1, (ring.fog ?? 0) + dt / ENEMY.WISP_GATHER);
        if (it.sat >= ENEMY.WISP_HIDE) {
          this.release(it);
          it.leaving = true;
        }
      }
    } else {
      // drifts off upwards and fades
      this.release(it);
      it.leaving = true;
      it.x += -f.L.scroll * 0.5 * dt;
      it.y -= 25 * dt;
      it.alpha = Math.max(0, it.alpha - dt * 1.2);
    }
  }

  // glide toward a hoop while still drifting with the scroll, so it settles on a moving target
  chase(it, tx, ty, rate, dt) {
    const k = 1 - Math.exp(-dt * rate);
    it.x += (tx - it.x) * k + (this.f.L.scroll * -dt) * (1 - k);
    it.y += (ty - it.y) * k;
  }

  // lets go of its hoop: the fog starts to clear, a zapper's charge is gone
  release(it) {
    if (!it.ring) return;
    it.ring.hidden = false;
    if (it.zapper && it.ring.state === 'coming') it.ring.charge = 0;
  }

  // popped by a fireball or a flock friend. points only for enemies and puffs, not the
  // gust sprite that already shoved you
  pop(g, it, points = it.kind === 'puff' ? SCORE.PUFF : SCORE.POP) {
    if (it.popT !== undefined) return;
    it.popT = 0;
    this.release(it);
    const f = this.f;
    g.particles.burst(it.x, it.y, 22, { speed: 90, colors: ['#ffffff', PAL.gold2, PAL.teal, PAL.rose], kind: 'spark', size: 2, drag: 2.5, life: 0.7 }, g.rng);
    if (points > 0) {
      f.points.popped++;
      const at = f.toScreen(it.x, it.y);
      f.points.add(points, at.x, at.y, `POP! +${points}`, PAL.teal);
      g.audio.cue('pop');
    }
  }

  // things a fireball or a flock friend can pop
  targets() {
    return this.list.filter((it) => it.popT === undefined && it.kind !== 'orb' && !(it.kind === 'wisp' && it.alpha < 0.5));
  }

  updateFire(g, dt) {
    const f = this.f;
    if (f.fireT > 0) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        // the dragon fires at whatever the light is pointing near
        const at = f.toWorld(g.input.x, g.input.y);
        let best = null;
        let bestD = POWER.FIRE_NEAR;
        for (const it of this.targets()) {
          const d = dist(it.x, it.y, at.x, at.y);
          if (d < bestD && it.x > f.ex - 10) {
            best = it;
            bestD = d;
          }
        }
        if (best) {
          this.shots.push({ x: f.ex + 18 * f.d.size, y: f.ey - 6, target: best, t: 0 });
          g.audio.cue('fire');
          this.fireT = POWER.FIRE_EVERY;
        } else this.fireT = 0.05;
      }
    }
    for (const s of this.shots) {
      s.t += dt;
      const tg = s.target;
      const d = dist(s.x, s.y, tg.x, tg.y);
      if (tg.popT !== undefined || s.t > 1.5) {
        s.dead = true;
        continue;
      }
      if (d < 8) {
        s.dead = true;
        this.pop(g, tg);
        continue;
      }
      const v = 340 * dt;
      s.x += ((tg.x - s.x) / d) * v;
      s.y += ((tg.y - s.y) / d) * v;
    }
    keep(this.shots, (s) => !s.dead);
  }

  // a dragon from tonight's flock swoops across and pops everything on screen
  startFriend(g) {
    const f = this.f;
    if (!f.flock.length) return false;
    const m = f.flock[Math.floor(this.r() * f.flock.length)];
    this.friend = { m, t: 0, x: -40, y: 80 };
    chirp(m, 0.1);
    return true;
  }

  updateFriend(g, dt) {
    const fr = this.friend;
    if (!fr) return;
    fr.t += dt;
    const k = fr.t / POWER.FRIEND;
    fr.x = lerp(-40, W + 60, k);
    fr.y = 70 + Math.sin(k * Math.PI) * 50;
    for (const it of this.targets()) if (it.x < fr.x + 10) this.pop(g, it);
    if (k >= 1) this.friend = null;
  }

  // where a scripted test guest sees things, in screen coords
  view() {
    const f = this.f;
    const scr = (it) => ({ kind: it.kind, power: it.power, ...f.toScreen(it.x, it.y) });
    return {
      enemies: this.list.filter((it) => it.popT === undefined && (it.kind === 'cloud' || it.kind === 'gust')).map(scr),
      orbs: this.list.filter((it) => it.popT === undefined && it.kind === 'orb').map(scr),
    };
  }

  draw(ctx, t) {
    for (const it of this.list) {
      if (it.popT !== undefined) continue;
      if (it.kind === 'cloud' || it.kind === 'gust') {
        // gathering: faint, with specks closing in on it, until it can bump
        const k = clamp((it.warm ?? 0) / ENEMY.WARN);
        if (k < 1) this.drawGather(ctx, it, k);
        ctx.globalAlpha = 0.35 + 0.65 * k;
      }
      // a zapper's spark grows down onto its hoop while it charges, and stays a moment after the zap
      const spark = it.boltT !== undefined ? (it.boltT < 0.3 ? 1 : 0) : (it.ring?.state === 'coming' ? it.ring.charge ?? 0 : 0);
      if (it.kind === 'cloud') drawGrumpyCloud(ctx, it.x, it.y, t, it.zapper ? spark : 0);
      else if (it.kind === 'gust') drawGustSprite(ctx, it.x, it.y, t + it.y);
      else if (it.kind === 'wisp') drawFogWisp(ctx, it.x, it.y, t, it.alpha);
      else if (it.kind === 'puff') drawPuff(ctx, it.x, it.y, t + it.y);
      else if (it.kind === 'orb') drawOrb(ctx, it.power, it.x, it.y, t);
      ctx.globalAlpha = 1;
    }
    for (const s of this.shots) drawFireball(ctx, s.x, s.y, t);
    const fr = this.friend;
    if (fr) drawMember(ctx, fr.m, fr.x, fr.y, { mood: 'joy', flap: t * 3, life: t, glow: 2, scale: 0.8 });
  }

  // a ring of specks that closes in on an enemy as it gathers
  drawGather(ctx, it, k) {
    const r = lerp(30, 12, k);
    ctx.fillStyle = it.kind === 'cloud' ? '#c8d2ea' : '#e8fbff';
    ctx.globalAlpha = 0.3 + 0.5 * k;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + k * 2;
      ctx.fillRect(Math.round(it.x + Math.cos(a) * r), Math.round(it.y + Math.sin(a) * r * 0.8), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // storm rider's gusts: wind streaks sweep across, then the dragon gets pushed. screen space
  drawGusts(ctx, t) {
    const f = this.f;
    for (const e of this.gusts) {
      const k = (f.tt - e.at) / (ENEMY.GUST_WARN + 0.6);
      if (k <= 0 || k >= 1) continue;
      const a = Math.sin(k * Math.PI);
      ctx.fillStyle = '#e8f6ff';
      for (let i = 0; i < 14; i++) {
        const x = ((i * 67 + t * 300) % (W + 60)) - 30;
        const y = 40 + ((i * 41) % 180) + e.dir * ((t * 90 + i * 13) % 40);
        ctx.globalAlpha = a * 0.55;
        for (let s = 0; s < 18; s++) ctx.fillRect(Math.round(x - s * 2), Math.round(y - e.dir * s * 0.8), 2, 1);
      }
      ctx.globalAlpha = a;
      // big arrows say which way it's going to push
      for (const ax of [W * 0.25, W * 0.5, W * 0.75]) {
        const ay = H / 2 + e.dir * 10;
        // head: narrow tip on the side it'll push toward, then the shaft behind it
        for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(ax - i), Math.round(ay + e.dir * (6 - i) * 1.5), 2 * i + 1, 2);
        ctx.fillRect(Math.round(ax - 1), Math.round(e.dir > 0 ? ay - 14 : ay + 2), 3, 12);
      }
      ctx.globalAlpha = 1;
    }
  }
}
