// everything in the flight that isn't a hoop: enemies, hatchling's puffs, power-up orbs, fireballs,
// the flock friend and storm rider's gusts. none of it can end a run, a bump is just a tumble
import { VIEW, PAL, ENEMY, POWER, SCORE, FLIGHT } from '../config.js';
import { clamp, lerp, mulberry32, approach, dist } from './util.js';
import { drawGrumpyCloud, drawGustSprite, drawFogWisp, drawPuff, drawOrb, drawFireball } from '../art/critters.js';
import { drawMember, chirp } from '../art/flock.js';

const { W, H } = VIEW;
const SPAWN_X = W + 40;

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
      // clouds take turns: one parks in front of a hoop, the next sits on one and zaps it
      if (e.kind === 'cloud') e.zapper = clouds++ % 2 === 1;
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

  spawn(e) {
    const f = this.f;
    const s = f.L.scroll;
    const it = { kind: e.kind, x: SPAWN_X, y: 130, vx: -s, t: 0, alpha: 1 };
    if (e.kind === 'cloud') {
      it.ring = this.ringIn(330, 600);
      it.zapper = e.zapper;
      if (it.ring) it.ring.taken = true;
      it.y = it.ring ? f.ringY(it.ring) - 30 : 60 + this.r() * 120;
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
      const cross = f.tt + (SPAWN_X - 150) / s;
      const rs = f.rings.filter((ring) => !ring.tutorial);
      let i = rs.findIndex((ring, k) => k + 1 < rs.length && (ring.at + rs[k + 1].at) / 2 >= cross);
      if (i < 0) i = Math.max(0, rs.length - 2);
      const a = rs[i];
      const b = rs[Math.min(i + 1, rs.length - 1)];
      it.x = 150 + Math.max((a.at + b.at) / 2 - f.tt, (SPAWN_X - 150) / s) * s;
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
        if (it.kind === 'gust') {
          it.y = approach(it.y, f.ey, 0.35, dt) + Math.sin(it.t * 4) * 0.6;
        }
      }
      // touching the dragon
      const d = dist(it.x, it.y, f.ex, f.ey);
      if (it.kind === 'orb' && d < POWER.REACH + 8) {
        it.popT = 0;
        f.powerUp(g, it.power, it.x, it.y);
      } else if ((it.kind === 'cloud' || it.kind === 'gust') && d < ENEMY.HIT_R) {
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
    this.list = this.list.filter((it) => it.x > -40 && it.alpha > 0.02 && !(it.popT > 0.5));
    this.updateFire(g, dt);
    this.updateFriend(g, dt);
  }

  updateCloud(g, it, dt) {
    const f = this.f;
    const ring = it.ring;
    if (ring && ring.state === 'coming' && !it.done) {
      // fly to the hoop: the blocker parks right in front of it, the zapper sits on top of it
      const tx = f.ringX(ring) + (it.zapper ? 0 : -16);
      const ty = f.ringY(ring) + (it.zapper ? -20 : 0);
      this.chase(it, tx, ty, 5, dt);
      if (it.zapper && Math.abs(it.x - tx) < 8) {
        it.zapT = (it.zapT ?? 0) + dt;
        if (it.zapT >= ENEMY.ZAP_AFTER + 0.5) {
          // zap: the hoop goes poof. not the guest's fault, so it doesn't count as a miss
          ring.state = 'zapped';
          ring.hitX = f.ringX(ring);
          ring.hitY = f.ringY(ring);
          ring.fx = 0;
          it.done = true;
          g.audio.cue('zap');
          g.particles.burst(ring.hitX, ring.hitY, 16, { speed: 60, colors: [PAL.gold2, '#bfefff'], kind: 'spark', size: 1, drag: 2, life: 0.6 }, g.rng);
        }
      }
    } else {
      it.done = true;
      it.x += -f.L.scroll * 0.6 * dt;
    }
  }

  updateWisp(g, it, dt) {
    const f = this.f;
    const ring = it.ring;
    if (ring && ring.state === 'coming' && !it.leaving) {
      const tx = f.ringX(ring);
      this.chase(it, tx, f.ringY(ring), 6, dt);
      if (Math.abs(it.x - tx) < 10) {
        it.sat = (it.sat ?? 0) + dt;
        ring.hidden = true;
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

  release(it) {
    if (it.ring) it.ring.hidden = false;
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
    this.shots = this.shots.filter((s) => !s.dead);
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
      if (it.kind === 'cloud') drawGrumpyCloud(ctx, it.x, it.y, t, it.zapper && it.zapT > ENEMY.ZAP_AFTER ? 1 : 0);
      else if (it.kind === 'gust') drawGustSprite(ctx, it.x, it.y, t + it.y);
      else if (it.kind === 'wisp') drawFogWisp(ctx, it.x, it.y, t, it.alpha);
      else if (it.kind === 'puff') drawPuff(ctx, it.x, it.y, t + it.y);
      else if (it.kind === 'orb') drawOrb(ctx, it.power, it.x, it.y, t);
    }
    for (const s of this.shots) drawFireball(ctx, s.x, s.y, t);
    const fr = this.friend;
    if (fr) drawMember(ctx, fr.m, fr.x, fr.y, { mood: 'joy', flap: t * 3, life: t, glow: 2, scale: 0.8 });
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
