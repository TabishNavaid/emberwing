import { VIEW, PAL } from '../config.js';
import { clamp, lerp, invLerp, mix, glow, disc, makeCanvas } from '../core/util.js';
import { drawSky, SKY, drawStars, drawSea, drawStone, drawStack, drawCloud, drawRays, makeCliff } from './world.js';
import { drawBaseAurora } from './aurora.js';

// three flights that take turns, one per guest. they only change the scenery: the hoops,
// the timing and the brass swell are exactly the same on every route.
// each route draws in layers so the flight scene can slot the gameplay in between:
//   sky (unzoomed) -> ground (unzoomed, drops away in the climb) -> mid (zoomed world) -> front
// s = { t, p, conf, rise, swell, windup } from the flight

const { W, H } = VIEW;
const SEA_Y = 222;

const wrap = (x, span) => ((x % span) + span) % span;

// shared by every route: the climb into the aurora at the end
function climbSky(ctx, f, s) {
  drawSky(ctx, SKY.aurora, 0, H, s.rise);
  if (s.rise > 0) drawBaseAurora(ctx, s.t, s.rise * 1.2, 10);
}
// sky dims a little before the swell so it has somewhere to go
function windupDim(ctx, s) {
  if (s.windup <= 0) return;
  ctx.fillStyle = `rgba(5,7,13,${0.3 * s.windup})`;
  ctx.fillRect(0, 0, W, H);
}
function scrollingLand(ctx, f, land, speed) {
  const off = wrap(f.camX * speed, W);
  ctx.drawImage(land.canvas, -Math.round(off), 0);
  ctx.drawImage(land.canvas, W - Math.round(off), 0);
}

// 1. out past the sea stacks while the storm turns to dusk and then gold
const seaStacks = {
  name: 'SEA STACKS AT DUSK',
  setup(f, r) {
    f.land = makeCliff({ seed: 31, x0: 0, x1: W, top: 196, bottom: SEA_Y + 2, rough: 14, periodic: true, colors: { rock: '#1b2638', rock2: '#223048', rock3: '#2a3a55', grass: '#24403c', grass2: '#2c4c46' } });
    f.stacks = [];
    for (let x = 200; x < 3200; x += 150 + r() * 160) f.stacks.push({ x, w: 16 + Math.floor(r() * 12), h: 60 + Math.floor(r() * 70), seed: Math.floor(r() * 99) });
    f.stones = [];
    for (let x = 380; x < 3200; x += 260 + r() * 220) f.stones.push({ x, h: 26 + Math.floor(r() * 16), w: 11 + Math.floor(r() * 4), rune: Math.floor(r() * 6) });
    f.clouds = Array.from({ length: 7 }, (_, k) => ({ x: k * 110 + r() * 60, y: 40 + r() * 70, w: 70 + r() * 70, seed: k + 40 }));
  },
  sky(ctx, f, g, s) {
    const { p, conf, rise } = s;
    drawSky(ctx, SKY.storm, 0, H);
    drawSky(ctx, SKY.dusk, 0, H, invLerp(0, 0.35, p));
    drawSky(ctx, SKY.gold, 0, H, invLerp(0.4, f.swellP + 0.05, p) * (1 - rise));
    climbSky(ctx, f, s);
    drawStars(ctx, f.stars, s.t, clamp(1 - p * 3) + rise);
    windupDim(ctx, s);
    f.sunX = W * 0.72;
    const sunY = SEA_Y - 4 + f.riseY;
    glow(ctx, f.sunX, sunY, 90 + conf * 40, PAL.amber, 0.25 + conf * 0.35 * (1 - rise));
    if (f.swellFired) drawRays(ctx, f.sunX, sunY, s.t, PAL.gold2, 0.22 * s.swell * (1 - rise) * (0.8 + 0.2 * g.beat.pulse), 13, 560);
    for (const c of f.clouds) {
      const x = wrap(c.x - f.camX * 0.2, W + 200) - 100;
      drawCloud(ctx, x, c.y + f.riseY * 0.5, c.w, mix(mix('#2a3a52', '#f0a890', conf), '#1a2440', rise), c.seed, 0.45 + conf * 0.2);
    }
  },
  ground(ctx, f, g, s) {
    const { conf } = s;
    scrollingLand(ctx, f, f.land, 0.15);
    drawSea(ctx, SEA_Y, s.t, { c1: mix('#10202e', '#3a3a6a', conf), c2: mix('#1b3242', '#6a5a8a', conf), foam: mix('#9fc0cc', '#ffd8a0', conf), scroll: f.camX, glint: conf > 0.2 ? { x: f.sunX, color: PAL.gold2 } : null });
  },
  mid(ctx, f, g, s) {
    const { conf } = s;
    for (const st of f.stacks) {
      const x = st.x - f.camX * 0.7;
      if (x < -60 || x > W + 60) continue;
      drawStack(ctx, x, SEA_Y + 4, st.w, st.h, st.seed, { c1: mix('#1c2738', '#4a3a5a', conf), c2: mix('#2a3a50', '#8a6a7a', conf) });
    }
    for (const st of f.stones) {
      const x = st.x - f.camX;
      if (x < -60 || x > W + 60) continue;
      ctx.fillStyle = mix('#1a2433', '#3a2e48', conf);
      for (let i = -18; i <= 18; i++) ctx.fillRect(Math.round(x + i), SEA_Y + 2 - Math.round(Math.sqrt(324 - i * i) * 0.35), 1, 8);
      drawStone(ctx, x, SEA_Y - 2, st.h, st.w, st.rune, clamp(0.3 + g.beat.pulse * 0.7));
    }
  },
  front() {},
  wind: (conf) => (conf > 0.5 ? '#ffe8b0' : '#bfe8ff'),
};

// 2. into a rain squall, then out the other side into clearing sky (and a rainbow at the swell)
const SQUALL = [[0, '#141a24'], [0.55, '#262f3c'], [1, '#3c4756']];
const CLEAR = [[0, '#2a4a8a'], [0.5, '#5a8ac8'], [0.82, '#e8b8a0'], [1, '#ffdca0']];
export const RAINBOW = ['#ff6a6a', '#ffb04a', '#ffe86a', '#7ae07a', '#5ab0ff', '#9a7aff'];
const squall = {
  name: 'THROUGH THE SQUALL',
  setup(f, r) {
    f.land = makeCliff({ seed: 57, x0: 0, x1: W, top: 204, bottom: SEA_Y + 2, rough: 8, periodic: true, colors: { rock: '#1a2230', rock2: '#222c3c', rock3: '#2a3648', grass: '#2a3a40', grass2: '#34484c' } });
    f.skerries = [];
    for (let x = 160; x < 3200; x += 120 + r() * 150) f.skerries.push({ x, w: 26 + Math.floor(r() * 26), h: 14 + Math.floor(r() * 22), seed: 100 + Math.floor(r() * 99) });
    f.clouds = Array.from({ length: 9 }, (_, k) => ({ x: k * 80 + r() * 50, y: 26 + r() * 40, w: 110 + r() * 80, seed: k + 70 }));
    f.drops = Array.from({ length: 170 }, () => ({ x: r() * W, y: r() * H, s: 0.8 + r() * 0.6 }));
  },
  // 0 inside the squall .. 1 clear sky
  clearing: (p) => invLerp(0.22, 0.55, p),
  rain(p) {
    return 1 - this.clearing(p);
  },
  sky(ctx, f, g, s) {
    const { p, conf, rise } = s;
    const clr = this.clearing(p);
    drawSky(ctx, SQUALL, 0, H);
    drawSky(ctx, CLEAR, 0, H, clr * (1 - rise));
    drawSky(ctx, SKY.gold, 0, H, invLerp(f.swellP - 0.1, f.swellP + 0.1, p) * 0.6 * (1 - rise));
    climbSky(ctx, f, s);
    drawStars(ctx, f.stars, s.t, rise);
    windupDim(ctx, s);
    f.sunX = W * 0.62;
    const sunY = 96 + f.riseY;
    // the sun breaks through as the squall moves off
    glow(ctx, f.sunX, sunY, 70 + clr * 60, '#fff0c0', clr * 0.55 * (1 - rise));
    if (clr > 0) drawRays(ctx, f.sunX, sunY - 60, s.t, '#fff4d0', 0.08 * clr * (1 - rise), 7, 360);
    if (f.swellFired) {
      // a rainbow over the sea at the swell
      const k = s.swell * (1 - rise);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      RAINBOW.forEach((c, i) => {
        const r = 210 - i * 5;
        ctx.globalAlpha = 0.22 * k;
        ctx.fillStyle = c;
        for (let a = Math.PI * 1.08; a < Math.PI * 1.92; a += 0.006) ctx.fillRect(Math.round(W * 0.5 + Math.cos(a) * r), Math.round(SEA_Y + 30 + Math.sin(a) * r * 0.72 + f.riseY), 2, 4);
      });
      ctx.restore();
      drawRays(ctx, f.sunX, sunY, s.t, PAL.gold2, 0.18 * s.swell * (1 - rise) * (0.8 + 0.2 * g.beat.pulse), 11, 520);
    }
    // the heavy clouds lift and thin out as it clears
    for (const c of f.clouds) {
      const x = wrap(c.x - f.camX * 0.35, W + 240) - 120;
      const col = mix(mix('#1c2430', '#e8e0f0', clr), '#1a2440', rise);
      drawCloud(ctx, x, c.y - clr * 34 + f.riseY * 0.5, c.w, col, c.seed, lerp(0.95, 0.35, clr));
    }
  },
  ground(ctx, f, g, s) {
    const clr = this.clearing(s.p);
    scrollingLand(ctx, f, f.land, 0.15);
    drawSea(ctx, SEA_Y, s.t * (1.6 - clr * 0.6), { c1: mix('#121a24', '#2a4a7a', clr), c2: mix('#1e2a36', '#4a70a8', clr), foam: mix('#c8d4dc', '#fff0d0', clr), scroll: f.camX, glint: clr > 0.4 ? { x: f.sunX, color: '#fff0c0' } : null });
  },
  mid(ctx, f, g, s) {
    const clr = this.clearing(s.p);
    for (const k of f.skerries) {
      const x = k.x - f.camX * 0.8;
      if (x < -60 || x > W + 60) continue;
      drawStack(ctx, x, SEA_Y + 4, k.w, k.h, k.seed, { c1: mix('#1a2230', '#3a4a66', clr), c2: mix('#26303e', '#5a6e8a', clr), grass: mix('#2a3a3a', '#4a7a5a', clr) });
    }
  },
  // rain, slanting with the wind, until the squall passes
  front(ctx, f, g, s) {
    const a = 1 - this.clearing(s.p);
    if (a <= 0.01) return;
    ctx.fillStyle = '#c4d6ec';
    for (const d of f.drops) {
      const y = (d.y + s.t * 300 * d.s) % (H + 10);
      const x = wrap(d.x - y * 0.45 - s.t * 90, W);
      ctx.globalAlpha = a * 0.55;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 6);
    }
    ctx.globalAlpha = 1;
  },
  wind: (conf) => (conf > 0.5 ? '#fff4d8' : '#d8e4f0'),
};

// 3. low over the moor, past standing stones and stone circles, while the aurora comes out
const DUSK_NIGHT = [[0, '#060a1e'], [0.5, '#121e48'], [0.85, '#2a3466'], [1, '#4a4478']];
let moon = null;
function crescent() {
  if (!moon) {
    const [c, g] = makeCanvas(17, 17);
    g.fillStyle = '#f4f0dc';
    disc(g, 8, 8, 7);
    g.globalCompositeOperation = 'destination-out';
    disc(g, 12, 6, 7);
    moon = c;
  }
  return moon;
}
const stones = {
  name: 'PAST THE STANDING STONES',
  setup(f, r) {
    f.hillsFar = makeCliff({ seed: 77, x0: 0, x1: W, top: 186, bottom: H + 16, rough: 12, periodic: true, colors: { rock: '#121c30', rock2: '#16223a', rock3: '#1c2a46', grass: '#1e3440', grass2: '#26424a' } });
    f.hillsNear = makeCliff({ seed: 91, x0: 0, x1: W, top: 214, bottom: H + 16, rough: 7, periodic: true, colors: { rock: '#0e1626', rock2: '#142034', rock3: '#1a2840', grass: '#1c3a34', grass2: '#2a5044' } });
    f.circles = [];
    for (let x = 200; x < 3400; x += 170 + r() * 150) {
      const n = r() < 0.45 ? 5 : r() < 0.5 ? 2 : 1; // a stone circle, a pair, or one tall stone
      f.circles.push({ x, n, h: 30 + Math.floor(r() * 18), seed: Math.floor(r() * 99) });
    }
    f.heather = Array.from({ length: 60 }, () => ({ x: r() * W, y: 222 + r() * 40, c: r() < 0.5 ? '#8a5aa8' : '#6a4a8a' }));
    f.wisps = Array.from({ length: 14 }, (_, k) => ({ x: r() * W, y: 120 + r() * 90, ph: r() * 6, sp: 0.3 + r() * 0.5 }));
  },
  sky(ctx, f, g, s) {
    const { p, conf, rise } = s;
    drawSky(ctx, DUSK_NIGHT, 0, H);
    drawSky(ctx, SKY.aurora, 0, H, Math.max(rise, invLerp(0.2, 0.7, p) * 0.6));
    drawStars(ctx, f.stars, s.t, 0.7 + 0.3 * conf);
    // early aurora: faint at first, brighter as the flight goes, and it flares at the swell
    drawBaseAurora(ctx, s.t, 0.35 + conf * 0.6 + s.swell * 0.6 + s.rise * 0.6, 8);
    windupDim(ctx, s);
    // a thin moon
    const mx = W * 0.78;
    const my = 44 + f.riseY * 0.3;
    glow(ctx, mx, my, 26, '#e8f0ff', 0.35);
    ctx.drawImage(crescent(), mx - 8, my - 8);
    f.sunX = mx;
    if (f.swellFired) drawRays(ctx, W * 0.5, -40 + f.riseY, s.t, PAL.teal, 0.14 * s.swell * (1 - rise) * (0.8 + 0.2 * g.beat.pulse), 11, 420);
  },
  ground(ctx, f, g, s) {
    scrollingLand(ctx, f, f.hillsFar, 0.2);
    scrollingLand(ctx, f, f.hillsNear, 0.55);
    for (const h of f.heather) {
      ctx.fillStyle = h.c;
      ctx.fillRect(Math.round(wrap(h.x - f.camX * 0.55, W)), Math.round(h.y), 1, 1);
    }
  },
  mid(ctx, f, g, s) {
    const pulse = clamp(0.3 + g.beat.pulse * 0.7 + s.swell * 0.3);
    for (const c of f.circles) {
      const x = c.x - f.camX * 0.9;
      if (x < -80 || x > W + 80) continue;
      if (c.n < 5) {
        for (let i = 0; i < c.n; i++) drawStone(ctx, x + i * 22, SEA_Y - 2 - i * 3, c.h + 10 - i * 8, 14 - i * 2, c.seed + i, pulse);
        continue;
      }
      // a ring of stones seen from low down: the back ones smaller and higher
      for (let i = 0; i < c.n; i++) {
        const a = (i / c.n) * Math.PI * 2 + 0.4;
        const depth = (Math.sin(a) + 1) / 2;
        drawStone(ctx, x + Math.cos(a) * 40, SEA_Y - 10 + depth * 10, Math.round(c.h * (0.7 + depth * 0.3)), Math.round(9 + depth * 4), c.seed + i, pulse * (0.6 + depth * 0.4));
      }
    }
    // little will-o-wisps drifting over the heather
    for (const w of f.wisps) {
      const x = wrap(w.x - f.camX * 0.6 + Math.sin(s.t * w.sp + w.ph) * 20, W + 40) - 20;
      const y = w.y + Math.sin(s.t * 1.7 * w.sp + w.ph) * 8;
      glow(ctx, x, y, 7, PAL.teal, 0.5 + 0.3 * Math.sin(s.t * 2 + w.ph));
      ctx.fillStyle = '#e8fffb';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  },
  front() {},
  wind: (conf) => (conf > 0.5 ? '#bff8ee' : '#9fc8ff'),
};

export const ROUTES = [seaStacks, squall, stones];
