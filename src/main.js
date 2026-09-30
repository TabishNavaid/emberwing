import { VIEW } from './config.js';
import { Input } from './input/Input.js';
import { attachPointer, attachMocap, attachKeys } from './input/adapters.js';
import { Beat } from './core/Beat.js';
import { Particles } from './core/Particles.js';
import { SceneManager } from './core/SceneManager.js';
import { Camera } from './core/Camera.js';
import { AuroraStore } from './core/AuroraStore.js';
import { Audio } from './core/Audio.js';
import { Operator } from './core/Operator.js';
import { mulberry32 } from './core/util.js';
import { loadSprites } from './art/sprites.js';
import { AuroraWall } from './art/aurora.js';
import { Attract } from './scenes/Attract.js';
import { FindEmber } from './scenes/FindEmber.js';
import { Flight } from './scenes/Flight.js';
import { Home } from './scenes/Home.js';
import { EndCard } from './scenes/EndCard.js';

const { W, H } = VIEW;
const params = new URLSearchParams(location.search);

// everything draws into a tiny 480x270 buffer, then it's scaled up with no smoothing
const display = document.getElementById('screen');
const dctx = display.getContext('2d');
const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
const ctx = buffer.getContext('2d');
ctx.imageSmoothingEnabled = false;

let fit = { x: 0, y: 0, w: W, h: H, dpr: 1 };
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  display.width = Math.round(cw * dpr);
  display.height = Math.round(ch * dpr);
  display.style.width = cw + 'px';
  display.style.height = ch + 'px';
  let s = Math.min(display.width / W, display.height / H);
  // snap to a whole number when we're close, uneven pixel sizes look wobbly on the projector
  if (s >= 2 && s - Math.floor(s) < 0.2) s = Math.floor(s);
  const w = Math.round(W * s);
  const h = Math.round(H * s);
  fit = { x: Math.round((display.width - w) / 2), y: Math.round((display.height - h) / 2), w, h, dpr };
  dctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const toView = (cx, cy) => ({
  x: ((cx * fit.dpr - fit.x) / fit.w) * W,
  y: ((cy * fit.dpr - fit.y) / fit.h) * H,
});

const input = new Input();
attachPointer(input, window, toView);
attachMocap(input, params);
const keys = attachKeys(input);

const seed = params.has('seed') ? +params.get('seed') : (Date.now() & 0xffffffff);
const beat = new Beat();
const game = {
  input,
  beat,
  particles: new Particles(),
  cam: new Camera(),
  store: new AuroraStore(),
  rng: mulberry32(seed),
  time: 0,
  runStart: 0,
  runs: [], // finished run lengths, the tests read these
};
game.audio = new Audio(beat);
game.wall = new AuroraWall(game.store);
game.scenes = new SceneManager(game, {
  attract: new Attract(),
  find: new FindEmber(),
  flight: new Flight(),
  home: new Home(),
  end: new EndCard(),
});
game.op = new Operator(game);

function step(dt) {
  game.time += dt;
  keys(dt);
  input.update(dt);
  beat.update(dt);
  game.scenes.update(dt);
  game.particles.update(dt);
  game.cam.update(dt);
  game.audio.update();
  game.op.update(dt);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, H);
  game.scenes.draw(ctx);
  game.op.draw(ctx);

  dctx.fillStyle = '#000';
  dctx.fillRect(0, 0, display.width, display.height);
  const k = fit.w / W;
  dctx.drawImage(buffer, fit.x + Math.round(game.cam.ox * k), fit.y + Math.round(game.cam.oy * k), fit.w, fit.h);
}

// dt capped at 50ms so a laptop hiccup doesn't teleport ember across the screen
let last = performance.now();
let paused = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) step(dt);
  render();
  requestAnimationFrame(frame);
}

// hooks for the playwright tests, guests never touch these
window.__emberwing = {
  game,
  goto: (name, data) => game.scenes.enter(name, data || {}),
  pause: (p = true) => (paused = p),
  toScreen: (x, y) => ({ x: (fit.x + (x / W) * fit.w) / fit.dpr, y: (fit.y + (y / H) * fit.h) / fit.dpr }),
  step: (seconds, fps = 60) => {
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) step(1 / fps);
    render();
  },
  state: () => ({
    scene: game.scenes.name,
    t: game.scenes.current?.t ?? 0,
    count: game.store.count,
    runs: game.runs.slice(),
    target: game.scenes.current?.target?.(game) ?? null,
  }),
};

loadSprites().then(() => {
  const start = params.get('scene') || 'attract';
  game.scenes.enter(start);
  if (params.has('t')) window.__emberwing.step(+params.get('t'));
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
});
