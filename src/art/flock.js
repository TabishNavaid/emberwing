// tonight's flock: the dragons people brought home, each one with its own quirk and chirp
import { FLOCK, PAL } from '../config.js';
import { drawDragon, drawChirp, noseOffset } from './dragon.js';
import { Quirk } from './quirks.js';
import { standIn } from '../core/dragons.js';

// the flock is always the dragons people actually brought home tonight. the newest FLOCK.CLOSE
// get drawn up close, everyone else is a speck further off. near + far always adds up to the count
export function flockOf(store, upTo = store.count) {
  const all = store.dragons;
  const count = Math.min(upTo, store.count);
  const have = all.slice(0, count);
  // the store keeps at most STORE.MAX_RIBBONS ribbons, the count keeps going (a very long night only)
  while (have.length < count) have.unshift(standIn(have.length));
  const near = have.slice(-FLOCK.CLOSE);
  const far = have.slice(0, have.length - near.length);
  return { near, far };
}

export function member(d, i = 0) {
  return { d, i, q: new Quirk(d, i * 0.77), chirpT: -1 };
}

const CHIRP = 0.5;

export function chirp(m, delay = 0) {
  m.chirpIn = delay;
}

// x/y/scale/flip: where the scene is drawing this member right now
// quiet: sparks but no sneeze sound (a dozen dragons sneezing on attract got noisy)
export function updateMember(g, m, dt, x, y, { scale = 1, flip = false, flying = true, quiet = false } = {}) {
  if (m.chirpIn !== undefined) {
    m.chirpIn -= dt;
    if (m.chirpIn <= 0) {
      m.chirpIn = undefined;
      m.chirpT = 0;
      g.audio.chirp(m.d);
    }
  }
  if (m.chirpT >= 0) {
    m.chirpT += dt;
    if (m.chirpT > CHIRP) m.chirpT = -1;
  }
  if (m.q.update(dt, flying) === 'sneeze') sneeze(g, m.d, x, y, scale, flip, quiet);
}

function sneeze(g, d, x, y, scale = 1, flip = false, quiet = false) {
  const n = noseOffset(d, scale, flip);
  g.particles.burst(x + n.x, y + n.y, 9, { speed: 70, angle: flip ? Math.PI : 0, spread: 1.2, colors: [PAL.gold2, PAL.amber, '#ffffff'], kind: 'spark', size: 1, drag: 3, life: 0.5 }, g.rng);
  if (!quiet) g.audio.cue('sneeze');
}

// draws one member with its quirk on top of the scene's own pose
export function drawMember(ctx, m, x, y, o = {}) {
  const p = m.q.pose(o.flying ?? true);
  const flip = !!o.flip;
  const s = o.scale ?? 1;
  const dx = (flip ? -p.dx : p.dx) * s;
  const dy = p.dy * s;
  drawDragon(ctx, x + dx, y + dy, m.d, {
    ...o,
    rot: (o.rot ?? 0) + (flip ? -p.rot : p.rot),
    sx: (o.sx ?? 1) * p.sx,
    sy: (o.sy ?? 1) * p.sy,
    mood: p.mood ?? o.mood,
    look: p.look ?? o.look,
    blink: p.blink ?? o.blink,
  });
  if (m.chirpT >= 0) {
    const n = noseOffset(m.d, s, flip);
    drawChirp(ctx, x + dx + n.x, y + dy + n.y, m.chirpT / CHIRP, flip);
  }
}
