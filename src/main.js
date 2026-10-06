import { VIEW, LOOP, LEVELS } from './config.js';
import { Input } from './input/Input.js';
import { attachPointer, attachMocap, attachKeys } from './input/adapters.js';
import { Beat } from './core/Beat.js';
import { Particles } from './core/Particles.js';
import { SceneManager } from './core/SceneManager.js';
import { Camera } from './core/Camera.js';
import { AuroraStore } from './core/AuroraStore.js';
import { Audio } from './core/Audio.js';
import { Operator } from './core/Operator.js';
import { Motion } from './core/Motion.js';
import { Calibration } from './input/Calibration.js';
import { SoundButton } from './input/SoundButton.js';
import { mulberry32 } from './core/util.js';
import { fillLost } from './core/dragons.js';
import { loadSprites } from './art/sprites.js';
import { AuroraWall } from './art/aurora.js';
import { Attract } from './scenes/Attract.js';
import { FindDragon } from './scenes/FindDragon.js';
import { Choose } from './scenes/Choose.js';
import { Celebration } from './scenes/Celebration.js';
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
// the three dragons that are lost right now. the guest picks one of them (Choose), anything that
// skips the picking (?scene=find, S) gets the first one
game.lost = [];
fillLost(game);
game.dragon = game.lost[0];
// which flight route the next run gets. they take turns, ?route=0..2 pins one for testing
game.routePin = params.has('route') ? +params.get('route') : null;
game.route = game.routePin ?? 0;
// picked on the attract screen. ?level=flier or storm for testing a scene on its own
game.level = LEVELS[params.get('level')] ? params.get('level') : 'hatchling';
game.cal = new Calibration();
input.cal = game.cal;
game.motion = new Motion();
game.cam.motion = game.motion;
game.audio = new Audio(beat);
game.wall = new AuroraWall(game.store);
game.scenes = new SceneManager(game, {
  attract: new Attract(),
  choose: new Choose(),
  find: new FindDragon(),
  flight: new Flight(),
  home: new Home(),
  party: new Celebration(),
  end: new EndCard(),
});
game.op = new Operator(game);
game.soundBtn = new SoundButton(game);

// clicking or tapping the speaker toggles sound. registered before the gate below, so while
// "press any key" is up a click only starts the station. touches use the real finger spot,
// not the light (which sits above the fingertip)
window.addEventListener('pointerdown', (e) => {
  if (game.gate) return;
  const p = toView(e.clientX, e.clientY);
  if (game.soundBtn.contains(p.x, p.y)) game.soundBtn.press();
});

// browsers keep sound locked until someone presses a key or touches the screen. on the lobby
// laptop the operator presses any key once to start the station (M starts it silent instead).
// phones skip that, the first touch turns the sound on
const touchFirst = !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
game.gate = !touchFirst && game.audio.status === 'locked';
game.audio.ctx?.addEventListener('statechange', () => {
  if (game.audio.ctx.state === 'running') game.gate = false;
});
const NOT_A_PRESS = ['Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'Fn'];
window.addEventListener('keydown', (e) => {
  if (NOT_A_PRESS.includes(e.key)) return;
  game.audio.unlock();
  if (!game.gate) return;
  game.gate = false;
  // the key that starts the station doesn't also do its hotkey (S would start a run), except M
  if (e.key.toLowerCase() !== 'm') {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, { capture: true });
for (const ev of ['pointerdown', 'touchend']) {
  window.addEventListener(ev, () => {
    game.audio.unlock();
    game.gate = false;
  }, { passive: true });
}

function step(dt) {
  game.time += dt;
  keys(dt);
  input.update(dt);
  beat.update(dt);
  // the game holds still while the operator calibrates, so aiming at corners can't start a run
  if (!game.op.cal) {
    game.scenes.update(dt);
    game.particles.update(dt);
    game.cam.update(dt);
  }
  game.audio.update();
  game.soundBtn.update(dt);
  game.op.update(dt);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, H);
  game.scenes.draw(ctx);
  game.soundBtn.draw(ctx);
  game.op.draw(ctx);
  // a short delay so a browser that starts audio a moment late doesn't flash the gate
  if (game.gate && game.time > 0.5) game.op.drawGate(ctx);

  dctx.fillStyle = '#000';
  dctx.fillRect(0, 0, display.width, display.height);
  const k = fit.w / W;
  dctx.drawImage(buffer, fit.x + Math.round(game.cam.ox * k), fit.y + Math.round(game.cam.oy * k), fit.w, fit.h);
}

// it used to cap dt at 50ms, so below 20fps the whole game ran in slow motion and a run on
// a weak laptop took way longer. now we catch up in small steps instead
let last = performance.now();
let paused = false;
function frame(now) {
  let left = Math.min(Math.max(0, (now - last) / 1000), LOOP.MAX_CATCHUP);
  last = now;
  while (!paused && left > 1e-6) {
    const dt = Math.min(left, LOOP.MAX_STEP);
    step(dt);
    left -= dt;
  }
  render();
  requestAnimationFrame(frame);
}

// hooks for the playwright tests, guests never touch these
window.__emberwing = {
  game,
  LEVELS,
  goto: (name, data) => game.scenes.enter(name, data || {}),
  pause: (p = true) => (paused = p),
  // fresh random numbers and a fresh beat clock, so a test that steps the game by hand gets the
  // same hoops at the same moments every time (the real-time frames before it paused have already
  // used up a different amount of both)
  reseed: (s) => {
    game.rng = mulberry32(s);
    beat.t = 0;
  },
  toScreen: (x, y) => ({ x: (fit.x + (x / W) * fit.w) / fit.dpr, y: (fit.y + (y / H) * fit.h) / fit.dpr }),
  // draw = false skips the render, for tests that simulate whole flights frame by frame
  step: (seconds, fps = 60, draw = true) => {
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) step(1 / fps);
    if (draw) render();
  },
  state: () => ({
    scene: game.scenes.name,
    title: game.scenes.title?.text ?? null,
    t: game.scenes.current?.t ?? 0,
    count: game.store.count,
    dragon: game.dragon.name,
    lost: game.lost.map((d) => d.name),
    route: game.route,
    level: game.level,
    gate: game.gate,
    sound: game.audio.status,
    runs: game.runs.slice(),
    target: game.scenes.current?.target?.(game) ?? null,
  }),
};

loadSprites().then(() => {
  const start = params.get('scene') || 'attract';
  game.scenes.enter(start);
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
});
